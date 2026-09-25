/**
 * FaceObserver — the camera-owning producer. Opens the webcam (on explicit start()), runs
 * MediaPipe FaceLandmarker in a module Web Worker (or a throttled main-thread fallback),
 * feeds FaceFrames to the SignalProcessor and emits ObservationBody objects.
 *
 * Privacy: frames are only ever handed to MediaPipe inside this page (worker or main
 * thread). This module makes no network requests of its own besides loading the local
 * WASM/model assets. There is no simulated fallback: failures surface as ObserverStatus
 * errors.
 */

import type { ObservationBody, PerfInfo } from '../protocol/types.ts'
import type {
  FaceData,
  FaceFrame,
  FaceObserverApi,
  FaceObserverOptions,
  ObserverStatus,
  ProcessorStatus,
  SignalProcessorApi
} from './contracts.ts'
import type { CreatedLandmarker, Delegate, WorkerRequest, WorkerResponse } from './landmarker.ts'
import { clearOverlay, drawOverlay } from './overlay.ts'
import { SignalProcessor } from './signals.ts'

type ErrorCode = Extract<ObserverStatus, { kind: 'error' }>['code']
type LandmarkerModule = typeof import('./landmarker.ts')
type MainLandmarker = CreatedLandmarker['landmarker']

/** Per-frame inference watchdog. */
export const INFERENCE_TIMEOUT_MS = 5000
/** Consecutive failures before switching backend / giving up. */
export const MAX_CONSECUTIVE_FAILURES = 3
/** Worker init (WASM + model load) timeout. */
export const WORKER_INIT_TIMEOUT_MS = 60_000
const EMA_ALPHA = 0.2
/**
 * Frame-timing jitter allowance for the sampling gate: with a 30 fps camera two frames are
 * ~66.7 ms apart but callback jitter puts many gaps at 62-66 ms, which a strict 66 ms gate
 * would alias down to ~10-12 Hz. Capped at 10 % of the interval.
 */
const SAMPLE_JITTER_TOLERANCE_MS = 4

interface InFlight {
  id: number
  t: number
  timer: ReturnType<typeof setTimeout> | null
}

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: unknown) => void) => number
  cancelVideoFrameCallback?: (handle: number) => void
}

class ObserverError extends Error {
  code: ErrorCode
  constructor(code: ErrorCode, message: string) {
    super(message)
    this.code = code
  }
}

class Aborted extends Error {}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message ? `${e.name}: ${e.message}` : e.name
  return String(e)
}

/** Map a getUserMedia rejection to an ObserverStatus error code. */
export function mapCameraError(e: unknown): ErrorCode {
  const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: unknown }).name) : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'permission_denied'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'no_camera'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'camera_in_use'
    default:
      return 'camera_error'
  }
}

function absoluteUrl(u: string): string {
  const base = typeof location !== 'undefined' ? location.href : 'http://localhost/'
  return new URL(u, base).href
}

export class FaceObserver implements FaceObserverApi {
  private readonly video: VideoWithRvfc
  private readonly overlay: HTMLCanvasElement | null
  private readonly processor: SignalProcessorApi
  private readonly wasmBaseUrl: string
  private readonly modelUrl: string
  private readonly sampleIntervalMs: number
  private readonly fallbackSampleIntervalMs: number
  private readonly preferWorker: boolean
  private readonly delegatePref: Delegate
  private overlayEnabled: boolean
  private mirror: boolean

  private status: ObserverStatus = { kind: 'idle' }
  private perfState: PerfInfo
  private readonly obsListeners = new Set<(b: ObservationBody) => void>()
  private readonly statusListeners = new Set<(s: ObserverStatus) => void>()
  private readonly procListeners = new Set<(s: ProcessorStatus) => void>()

  /** Incremented by every stop/teardown; async steps compare against it to abort. */
  private gen = 0
  private startPromise: Promise<void> | null = null
  private stream: MediaStream | null = null
  private worker: Worker | null = null
  private mainLm: MainLandmarker | null = null
  private lmModule: LandmarkerModule | null = null
  private backend: PerfInfo['backend'] | null = null
  private switching = false
  private suspended = false
  private processorSuspended = false
  private rvfcHandle: number | null = null
  private tickTimer: ReturnType<typeof setTimeout> | null = null
  private inFlight: InFlight | null = null
  private frameId = 0
  private lastSubmitAt = -Infinity
  private lastFrameT = -Infinity
  private lastProcessedAt: number | null = null
  private inferenceEma: number | null = null
  private intervalEma: number | null = null
  private consecutiveFailures = 0
  private lastProcStatusKey = ''
  private visibilityHandler: (() => void) | null = null

  /** Non-contract diagnostics (backend init errors, delegate fallbacks, last failure). */
  readonly diagnostics: {
    initErrors: string[]
    warnings: string[]
    warmupMs: number | null
    lastFailure: string | null
    failures: number
  } = {
    initErrors: [],
    warnings: [],
    warmupMs: null,
    lastFailure: null,
    failures: 0
  }

  constructor(opts: FaceObserverOptions) {
    this.video = opts.video as VideoWithRvfc
    this.overlay = opts.overlay ?? null
    this.processor = opts.processor ?? new SignalProcessor()
    this.wasmBaseUrl = opts.wasmBaseUrl ?? '/mediapipe/wasm'
    this.modelUrl = opts.modelUrl ?? '/models/face_landmarker.task'
    this.sampleIntervalMs = opts.sampleIntervalMs ?? 66
    this.fallbackSampleIntervalMs = opts.fallbackSampleIntervalMs ?? 150
    this.preferWorker = opts.preferWorker ?? true
    this.delegatePref = opts.delegate ?? 'GPU'
    this.overlayEnabled = opts.overlayEnabled ?? true
    this.mirror = opts.mirrorPreview ?? true
    this.perfState = {
      backend: this.preferWorker ? 'worker' : 'main_thread',
      delegate: null,
      inference_ms: null,
      processed_fps: null,
      dropped_frames: 0
    }
    this.applyMirror()
  }

  // --- public API ------------------------------------------------------------------

  get perf(): PerfInfo {
    return { ...this.perfState }
  }

  get observerStatus(): ObserverStatus {
    return this.status
  }

  onObservation(cb: (body: ObservationBody) => void): () => void {
    this.obsListeners.add(cb)
    return () => this.obsListeners.delete(cb)
  }

  onStatus(cb: (s: ObserverStatus) => void): () => void {
    this.statusListeners.add(cb)
    return () => this.statusListeners.delete(cb)
  }

  onProcessorStatus(cb: (s: ProcessorStatus) => void): () => void {
    this.procListeners.add(cb)
    return () => this.procListeners.delete(cb)
  }

  startCalibration(): void {
    this.processor.startCalibration(performance.now())
    this.emitProcessorStatus()
  }

  cancelCalibration(): void {
    this.processor.cancelCalibration(performance.now())
    this.emitProcessorStatus()
  }

  setOverlayEnabled(enabled: boolean): void {
    this.overlayEnabled = enabled
    if (!enabled) clearOverlay(this.overlay)
  }

  setMirrorPreview(enabled: boolean): void {
    this.mirror = enabled
    this.applyMirror()
  }

  /**
   * Request the camera, load the model and start the loop. Resolves when running or when
   * an error status has been emitted (it does not reject). Safe to call again while
   * starting/running (returns the same promise).
   */
  start(): Promise<void> {
    if (this.startPromise) return this.startPromise
    if (this.status.kind === 'running' || this.status.kind === 'suspended') return Promise.resolve()
    const gen = ++this.gen
    const p = this.doStart(gen).finally(() => {
      if (this.startPromise === p) this.startPromise = null
    })
    this.startPromise = p
    return p
  }

  /** Stop everything and release the camera. Idempotent; aborts an in-flight start(). */
  stop(): void {
    if (this.status.kind === 'stopped' || this.status.kind === 'idle') {
      if (!this.startPromise && !this.stream && !this.worker && !this.mainLm) return
    }
    this.emitSuspendBody()
    this.teardown()
    this.setStatus({ kind: 'stopped' })
  }

  // --- start -----------------------------------------------------------------------

  private async doStart(gen: number): Promise<void> {
    this.setStatus({ kind: 'starting' })
    this.diagnostics.initErrors = []
    this.diagnostics.warnings = []
    try {
      await this.openCamera(gen)
      await this.initBackend(gen)
      this.check(gen)
      this.consecutiveFailures = 0
      this.lastProcessedAt = null
      this.inferenceEma = null
      this.intervalEma = null
      this.perfState.inference_ms = null
      this.perfState.processed_fps = null
      if (this.processorSuspended) {
        this.processor.resume(performance.now())
        this.processorSuspended = false
      }
      this.visibilityHandler = () => this.onVisibilityChange()
      document.addEventListener('visibilitychange', this.visibilityHandler)
      this.setStatus({ kind: 'running', backend: this.perfState.backend, delegate: this.perfState.delegate })
      if (document.hidden) this.suspendForHidden()
      else this.schedule()
    } catch (e) {
      if (e instanceof Aborted || gen !== this.gen) return // stop() already cleaned up
      const code: ErrorCode = e instanceof ObserverError ? e.code : 'camera_error'
      this.fail(code, e instanceof ObserverError ? e.message : errMsg(e))
    }
  }

  private check(gen: number): void {
    if (gen !== this.gen) throw new Aborted()
  }

  private async openCamera(gen: number): Promise<void> {
    const md = typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined
    if (!md || typeof md.getUserMedia !== 'function') {
      throw new ObserverError(
        'camera_unsupported',
        'navigator.mediaDevices.getUserMedia is unavailable (requires a secure context: https or localhost)'
      )
    }
    let stream: MediaStream
    try {
      stream = await md.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      })
    } catch (e) {
      if (gen !== this.gen) throw new Aborted()
      throw new ObserverError(mapCameraError(e), errMsg(e))
    }
    if (gen !== this.gen) {
      // stop() ran while the permission prompt was open: release the camera immediately.
      for (const t of stream.getTracks()) t.stop()
      throw new Aborted()
    }
    this.stream = stream
    for (const track of stream.getVideoTracks()) {
      track.addEventListener('ended', () => {
        if (gen === this.gen && this.stream === stream) this.fail('camera_error', 'camera track ended')
      })
    }

    const v = this.video
    v.muted = true
    v.playsInline = true
    v.setAttribute('playsinline', '')
    v.autoplay = true
    v.srcObject = stream
    try {
      await v.play()
    } catch (e) {
      this.check(gen)
      throw new ObserverError('camera_error', `video playback failed: ${errMsg(e)}`)
    }
    this.check(gen)
    if (!(v.videoWidth > 0)) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          v.removeEventListener('loadedmetadata', onMeta)
          reject(new ObserverError('camera_error', 'camera produced no frames within 5 s'))
        }, 5000)
        const onMeta = () => {
          clearTimeout(timer)
          resolve()
        }
        v.addEventListener('loadedmetadata', onMeta, { once: true })
      })
      this.check(gen)
    }
  }

  private canUseWorker(): boolean {
    return (
      this.preferWorker &&
      typeof Worker !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      typeof createImageBitmap === 'function'
    )
  }

  private async initBackend(gen: number): Promise<void> {
    if (this.canUseWorker()) {
      const res = await this.initWorker(gen)
      this.check(gen)
      if (res) {
        this.worker = res.worker
        this.backend = 'worker'
        this.perfState.backend = 'worker'
        this.perfState.delegate = res.delegate
        return
      }
    } else if (this.preferWorker) {
      this.diagnostics.initErrors.push('worker: Worker/OffscreenCanvas/createImageBitmap unavailable')
    }
    try {
      await this.initMainThread(gen)
    } catch (e) {
      if (e instanceof Aborted) throw e
      throw new ObserverError('model_load_failed', this.diagnostics.initErrors.join(' | ') || errMsg(e))
    }
  }

  private initWorker(gen: number): Promise<{ worker: Worker; delegate: Delegate } | null> {
    let worker: Worker
    try {
      worker = new Worker(new URL('./vision.worker.ts', import.meta.url), { type: 'module', name: 'face-vision' })
    } catch (e) {
      this.diagnostics.initErrors.push(`worker: construct failed: ${errMsg(e)}`)
      return Promise.resolve(null)
    }
    return new Promise((resolve) => {
      let settled = false
      const done = (delegate: Delegate | null, err?: string) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        clearInterval(abortPoll)
        if (delegate && gen === this.gen) {
          worker.onmessage = (ev: MessageEvent<WorkerResponse>) => this.onWorkerMessage(worker, ev.data)
          worker.onerror = (ev) => {
            ev.preventDefault()
            this.onWorkerCrash(worker, ev.message || 'worker error')
          }
          resolve({ worker, delegate })
        } else {
          if (err) this.diagnostics.initErrors.push(`worker: ${err}`)
          worker.terminate()
          resolve(null)
        }
      }
      const timer = setTimeout(() => done(null, `init timed out after ${WORKER_INIT_TIMEOUT_MS} ms`), WORKER_INIT_TIMEOUT_MS)
      // Abort promptly if stop() is called while the model loads.
      const abortPoll = setInterval(() => {
        if (gen !== this.gen) done(null)
      }, 100)
      worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
        const m = ev.data
        if (m.type === 'ready') {
          this.diagnostics.warnings.push(...m.warnings.map((w) => `worker ${w}`))
          this.diagnostics.warmupMs = Math.round(m.warmupMs)
          done(m.delegate)
        } else if (m.type === 'init_error') done(null, m.message)
      }
      worker.onerror = (ev) => {
        ev.preventDefault()
        done(null, `script error: ${ev.message || 'failed to load worker module'}`)
      }
      worker.onmessageerror = () => done(null, 'messageerror')
      const init: WorkerRequest = {
        type: 'init',
        wasmBaseUrl: absoluteUrl(this.wasmBaseUrl),
        modelUrl: absoluteUrl(this.modelUrl),
        delegate: this.delegatePref
      }
      worker.postMessage(init)
    })
  }

  private async initMainThread(gen: number): Promise<void> {
    let created: CreatedLandmarker
    try {
      this.lmModule ??= await import('./landmarker.ts')
      this.check(gen)
      created = await this.lmModule.createLandmarker({
        wasmBaseUrl: absoluteUrl(this.wasmBaseUrl),
        modelUrl: absoluteUrl(this.modelUrl),
        delegate: this.delegatePref,
        canvas: document.createElement('canvas'),
        useModule: false
      })
    } catch (e) {
      if (e instanceof Aborted) throw e
      this.diagnostics.initErrors.push(`main_thread: ${errMsg(e)}`)
      throw e
    }
    if (gen !== this.gen) {
      created.landmarker.close()
      throw new Aborted()
    }
    this.diagnostics.warnings.push(...created.warnings.map((w) => `main_thread ${w}`))
    this.diagnostics.warmupMs = Math.round(created.warmupMs)
    this.mainLm = created.landmarker
    this.backend = 'main_thread'
    this.perfState.backend = 'main_thread'
    this.perfState.delegate = created.delegate
  }

  // --- loop ------------------------------------------------------------------------

  private isLive(): boolean {
    return this.status.kind === 'running' && !this.suspended
  }

  private schedule(): void {
    if (!this.isLive() || this.rvfcHandle !== null || this.tickTimer !== null) return
    const v = this.video
    if (typeof v.requestVideoFrameCallback === 'function') {
      this.rvfcHandle = v.requestVideoFrameCallback(() => {
        this.rvfcHandle = null
        this.schedule()
        this.onVideoFrame()
      })
    } else {
      const interval = this.currentInterval()
      const wait = Math.max(10, interval - (performance.now() - this.lastSubmitAt))
      this.tickTimer = setTimeout(() => {
        this.tickTimer = null
        this.schedule()
        this.onVideoFrame()
      }, Math.min(wait, interval))
    }
  }

  private cancelSchedule(): void {
    if (this.rvfcHandle !== null) {
      this.video.cancelVideoFrameCallback?.(this.rvfcHandle)
      this.rvfcHandle = null
    }
    if (this.tickTimer !== null) {
      clearTimeout(this.tickTimer)
      this.tickTimer = null
    }
  }

  private currentInterval(): number {
    return this.backend === 'worker' ? this.sampleIntervalMs : this.fallbackSampleIntervalMs
  }

  private includeLandmarks(): boolean {
    return this.overlayEnabled && this.overlay !== null
  }

  private onVideoFrame(): void {
    if (!this.isLive() || this.switching) return
    const v = this.video
    if (v.readyState < 2 || !(v.videoWidth > 0)) return
    const now = performance.now()
    const interval = this.currentInterval()
    if (now - this.lastSubmitAt < interval - Math.min(SAMPLE_JITTER_TOLERANCE_MS, interval * 0.1)) return
    if (this.inFlight) {
      // A frame is due but the previous one is still being processed: drop, never queue.
      this.perfState.dropped_frames++
      return
    }
    let t = now
    if (!(t > this.lastFrameT)) t = this.lastFrameT + 0.001
    this.lastFrameT = t
    this.lastSubmitAt = now
    if (this.backend === 'worker' && this.worker) this.submitToWorker(this.worker, t)
    else if (this.backend === 'main_thread' && this.mainLm) this.runMainThread(this.mainLm, t)
  }

  private submitToWorker(worker: Worker, t: number): void {
    const id = ++this.frameId
    const entry: InFlight = { id, t, timer: null }
    this.inFlight = entry
    const gen = this.gen
    entry.timer = setTimeout(() => {
      if (this.inFlight !== entry) return
      this.inFlight = null
      this.onInferenceFailure(`frame ${id}: no result within ${INFERENCE_TIMEOUT_MS} ms`)
    }, INFERENCE_TIMEOUT_MS)
    createImageBitmap(this.video).then(
      (bitmap) => {
        if (gen !== this.gen || this.inFlight !== entry || this.worker !== worker) {
          bitmap.close()
          return
        }
        const msg: WorkerRequest = { type: 'frame', id, t, bitmap, includeLandmarks: this.includeLandmarks() }
        worker.postMessage(msg, [bitmap])
      },
      (e) => {
        if (gen !== this.gen || this.inFlight !== entry) return
        this.clearInFlight()
        this.onInferenceFailure(`createImageBitmap: ${errMsg(e)}`)
      }
    )
  }

  private clearInFlight(): void {
    if (this.inFlight?.timer) clearTimeout(this.inFlight.timer)
    this.inFlight = null
  }

  private onWorkerMessage(worker: Worker, m: WorkerResponse): void {
    if (worker !== this.worker) return
    if (m.type !== 'result' && m.type !== 'frame_error') return
    if (!this.inFlight || this.inFlight.id !== m.id) return // late result after watchdog: ignore
    this.clearInFlight()
    if (m.type === 'frame_error') {
      this.onInferenceFailure(`worker: ${m.message}`)
      return
    }
    this.consecutiveFailures = 0
    if (!this.isLive()) return // suspended while in flight: discard
    this.handleFrame({ t: m.t, width: m.width, height: m.height, faces: m.faces, inferenceMs: m.inferenceMs })
  }

  private onWorkerCrash(worker: Worker, message: string): void {
    if (worker !== this.worker) return
    this.clearInFlight()
    this.onInferenceFailure(`worker crashed: ${message}`)
  }

  private runMainThread(lm: MainLandmarker, t: number): void {
    const mod = this.lmModule
    if (!mod) return
    const v = this.video
    const width = v.videoWidth
    const height = v.videoHeight
    let faces: FaceData[]
    const t0 = performance.now()
    let ms: number
    try {
      const result = lm.detectForVideo(v, t)
      ms = performance.now() - t0
      faces = mod.extractFaces(result, width, height, this.includeLandmarks())
    } catch (e) {
      this.onInferenceFailure(`main_thread: ${errMsg(e)}`)
      return
    }
    if (ms > INFERENCE_TIMEOUT_MS) {
      // Synchronous call cannot be interrupted; treat an over-long frame as a failure.
      this.onInferenceFailure(`main_thread: inference took ${ms.toFixed(0)} ms`)
      return
    }
    this.consecutiveFailures = 0
    this.handleFrame({ t, width, height, faces, inferenceMs: ms })
  }

  private onInferenceFailure(reason: string): void {
    this.diagnostics.failures++
    this.diagnostics.lastFailure = reason
    this.consecutiveFailures++
    if (this.consecutiveFailures < MAX_CONSECUTIVE_FAILURES) return
    if (this.backend === 'worker') void this.switchToMainThread(reason)
    else this.fail('inference_failed', `${MAX_CONSECUTIVE_FAILURES} consecutive inference failures: ${reason}`)
  }

  private async switchToMainThread(reason: string): Promise<void> {
    if (this.switching) return
    this.switching = true
    const gen = this.gen
    this.diagnostics.initErrors.push(`worker: switched to main thread after failures (${reason})`)
    this.clearInFlight()
    this.releaseWorker()
    this.backend = null
    try {
      await this.initMainThread(gen)
    } catch (e) {
      if (e instanceof Aborted || gen !== this.gen) return
      this.switching = false
      this.fail('inference_failed', `worker failed (${reason}) and main-thread fallback could not start: ${errMsg(e)}`)
      return
    }
    this.switching = false
    if (gen !== this.gen) return
    this.consecutiveFailures = 0
    this.lastProcessedAt = null
    this.intervalEma = null
    this.inferenceEma = null
    this.perfState.inference_ms = null
    this.perfState.processed_fps = null
    if (this.status.kind === 'running') {
      this.setStatus({ kind: 'running', backend: 'main_thread', delegate: this.perfState.delegate })
    }
    this.schedule()
  }

  private handleFrame(frame: FaceFrame): void {
    const now = performance.now()
    this.inferenceEma =
      this.inferenceEma === null ? frame.inferenceMs : this.inferenceEma + EMA_ALPHA * (frame.inferenceMs - this.inferenceEma)
    if (this.lastProcessedAt !== null) {
      const dt = now - this.lastProcessedAt
      if (dt > 0) this.intervalEma = this.intervalEma === null ? dt : this.intervalEma + EMA_ALPHA * (dt - this.intervalEma)
    }
    this.lastProcessedAt = now
    this.perfState.inference_ms = round2(this.inferenceEma)
    this.perfState.processed_fps = this.intervalEma ? round2(1000 / this.intervalEma) : null

    let body: ObservationBody
    try {
      body = this.processor.process(frame, this.perf)
    } catch (e) {
      console.error('[FaceObserver] signal processor threw', e)
      return
    }
    this.emitObservation(body)
    const ps = this.emitProcessorStatus()
    if (this.overlay && this.overlayEnabled) drawOverlay(this.overlay, frame, ps.tracking, ps.lockedFaceIndex)
  }

  // --- visibility ------------------------------------------------------------------

  private onVisibilityChange(): void {
    if (document.hidden) this.suspendForHidden()
    else this.resumeFromHidden()
  }

  private suspendForHidden(): void {
    if (this.status.kind !== 'running' || this.suspended) return
    this.suspended = true
    this.cancelSchedule()
    this.emitSuspendBody()
    clearOverlay(this.overlay)
    this.setStatus({ kind: 'suspended', reason: 'tab_hidden' })
  }

  private resumeFromHidden(): void {
    if (this.status.kind !== 'suspended' || !this.suspended) return
    this.suspended = false
    const now = performance.now()
    if (this.processorSuspended) {
      this.processor.resume(now)
      this.processorSuspended = false
      this.emitProcessorStatus()
    }
    this.lastProcessedAt = null
    this.lastFrameT = Math.max(this.lastFrameT, now)
    this.setStatus({ kind: 'running', backend: this.perfState.backend, delegate: this.perfState.delegate })
    this.schedule()
  }

  /** Emit processor.suspend() once per active period (tab hidden / stop / fatal error). */
  private emitSuspendBody(): void {
    if (this.processorSuspended || this.status.kind !== 'running') return
    const t = Math.max(performance.now(), this.lastFrameT + 0.001)
    this.lastFrameT = t
    try {
      const body = this.processor.suspend(t, this.perf)
      this.processorSuspended = true
      this.emitObservation(body)
      this.emitProcessorStatus()
    } catch (e) {
      console.error('[FaceObserver] signal processor suspend threw', e)
    }
  }

  // --- teardown --------------------------------------------------------------------

  private fail(code: ErrorCode, message: string): void {
    this.emitSuspendBody()
    this.teardown()
    this.setStatus({ kind: 'error', code, message })
  }

  private releaseWorker(): void {
    const w = this.worker
    if (!w) return
    this.worker = null
    w.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      if (ev.data?.type === 'closed') w.terminate()
    }
    w.onerror = null
    try {
      const msg: WorkerRequest = { type: 'close' }
      w.postMessage(msg)
    } catch {
      // ignore
    }
    // Give the worker a moment to release WebGL/WASM resources, then terminate regardless.
    setTimeout(() => w.terminate(), 500)
  }

  private teardown(): void {
    this.gen++
    this.startPromise = null
    this.cancelSchedule()
    this.clearInFlight()
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler)
      this.visibilityHandler = null
    }
    this.releaseWorker()
    if (this.mainLm) {
      try {
        this.mainLm.close()
      } catch {
        // ignore
      }
      this.mainLm = null
    }
    this.backend = null
    this.switching = false
    this.suspended = false
    if (this.stream) {
      for (const t of this.stream.getTracks()) t.stop()
      this.stream = null
    }
    if (this.video.srcObject) {
      this.video.pause()
      this.video.srcObject = null
    }
    clearOverlay(this.overlay)
  }

  // --- emit helpers ----------------------------------------------------------------

  private setStatus(s: ObserverStatus): void {
    this.status = s
    for (const cb of this.statusListeners) {
      try {
        cb(s)
      } catch (e) {
        console.error('[FaceObserver] status listener threw', e)
      }
    }
  }

  private emitObservation(body: ObservationBody): void {
    for (const cb of this.obsListeners) {
      try {
        cb(body)
      } catch (e) {
        console.error('[FaceObserver] observation listener threw', e)
      }
    }
  }

  /** Emit processor status to listeners if it changed; returns the current status. */
  private emitProcessorStatus(): ProcessorStatus {
    const ps = this.processor.status()
    const key = JSON.stringify(ps)
    if (key !== this.lastProcStatusKey) {
      this.lastProcStatusKey = key
      for (const cb of this.procListeners) {
        try {
          cb(ps)
        } catch (e) {
          console.error('[FaceObserver] processor-status listener threw', e)
        }
      }
    }
    return ps
  }

  private applyMirror(): void {
    const tf = this.mirror ? 'scaleX(-1)' : ''
    this.video.style.transform = tf
    if (this.overlay) this.overlay.style.transform = tf
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}
