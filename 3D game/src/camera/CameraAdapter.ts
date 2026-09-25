/**
 * CameraAdapter — the game's one handle on the camera application.
 *
 * It owns the camera app's lifecycle objects and nothing else:
 *
 *   createSession ─┬─ GameAdapter        (consumer socket: state, gestures, suggestions; game events out)
 *                  └─ ProducerConnection (producer socket: observations out)
 *                        ▲
 *                     FaceObserver       (webcam + MediaPipe in a worker + SignalProcessor)
 *
 * All four are the camera app's own classes (CAMERA/web/src), loaded on demand through
 * `runtime.ts`. This file adds no vision code, no scoring and no policy: it sequences
 * start/stop, translates outputs into `CameraSnapshot` (snapshot.ts), and guarantees:
 *
 *  - **One of everything.** At most one live adapter per page, so there is exactly one
 *    camera capture, one inference pipeline, one producer and one consumer socket.
 *    Constructing a second while one is live throws.
 *  - **One session identity.** The producer and the consumer share the session this
 *    adapter created; `dispose()` deletes it.
 *  - **Clean teardown.** `stopCamera()` releases the camera, worker and producer socket;
 *    `dispose()` also closes the consumer and deletes the session. Both are idempotent,
 *    and an overtaken async start cleans up after itself (generation counter).
 *  - **Raw frames stay in this page.** Only the derived numbers in ObservationBody leave,
 *    to the loopback service; nothing is recorded or uploaded.
 */

import type {
  AdapterState,
  GameAdapterApi,
  GameEventInput,
  ObservationBody,
  ObserverStatus,
  PerfInfo,
  ProcessorStatus,
  ProducerConnectionApi,
  FaceObserverApi,
  Unsubscribe
} from './app'
import { buildSnapshot, observerError, toGesture, toSuggestion } from './snapshot'
import type {
  CameraAdapterApi,
  CameraErrorCode,
  CameraGesture,
  CameraSnapshot,
  CameraSuggestion
} from './types'

type Runtime = typeof import('./runtime')

export interface CameraAdapterOptions {
  /** Loopback service origin, e.g. http://127.0.0.1:8765. */
  baseUrl: string
  /** Stored on the service session for debugging. */
  label?: string
  /** Per-session service policy overrides (same names and bounds as OBS_POLICY__*). */
  policyOverrides?: Record<string, number>
  /** Initial adaptation switch. Default true (it still does nothing until calibrated). */
  adaptationEnabled?: boolean
  /** Relative to the page (the game is built with base './'). */
  wasmBaseUrl?: string
  modelUrl?: string
  /**
   * TEST ONLY: allow `injectObservation()` — labelled synthetic observations sent through
   * the real producer socket instead of the webcam. Never enabled by the game UI.
   */
  allowInjection?: boolean
  /** For headless checks: supply fake runtime classes. */
  loadRuntime?: () => Promise<Runtime>
  now?: () => number
  log?: (message: string, detail?: unknown) => void
}

let live: CameraAdapter | null = null

/** The live adapter, if any — for the debug handle and the single-instance guarantee. */
export function liveCameraAdapter(): CameraAdapter | null {
  return live
}

const EMIT_INTERVAL_MS = 100

export class CameraAdapter implements CameraAdapterApi {
  private readonly opts: CameraAdapterOptions
  private readonly now: () => number
  private readonly log: (message: string, detail?: unknown) => void

  private runtime: Runtime | null = null
  private session: { id: string; consumerToken: string; producerToken: string } | null = null
  private consumer: GameAdapterApi | null = null
  private producer: ProducerConnectionApi | null = null
  private observer: FaceObserverApi | null = null
  private consumerOffs: Unsubscribe[] = []
  private cameraOffs: Unsubscribe[] = []

  private adapterState: AdapterState | null = null
  private serviceReason: string | null = null
  private observerStatus: ObserverStatus | null = null
  private processorStatus: ProcessorStatus | null = null
  private perf: PerfInfo | null = null
  private pending: 'connecting' | 'starting_camera' | null = null
  private error: { code: CameraErrorCode; message: string } | null = null
  private adaptationEnabled: boolean
  private injecting = false

  /** Bumped by stopCamera/dispose so an overtaken start abandons itself. */
  private cameraGen = 0
  private disposed = false

  private readonly stateListeners = new Set<(s: CameraSnapshot) => void>()
  private readonly gestureListeners = new Set<(g: CameraGesture) => void>()
  private readonly suggestionListeners = new Set<(s: CameraSuggestion) => void>()
  private emitTimer: ReturnType<typeof setTimeout> | null = null
  private lastEmitAt = Number.NEGATIVE_INFINITY

  constructor(opts: CameraAdapterOptions) {
    if (live && !live.disposed) throw new Error('camera_adapter_already_active')
    live = this
    this.opts = opts
    this.now = opts.now ?? (() => performance.now())
    this.log = opts.log ?? (() => {})
    this.adaptationEnabled = opts.adaptationEnabled ?? true
  }

  get sessionId(): string | null {
    return this.session?.id ?? null
  }

  get isDisposed(): boolean {
    return this.disposed
  }

  /** Counters from the camera app's own classes, for the developer panel. */
  diagnostics(): Record<string, unknown> {
    const c = this.consumer as unknown as { stats?: unknown } | null
    const p = this.producer
    return {
      consumer: c?.stats ?? null,
      producer: p ? p.stats : null,
      producerStatus: p ? p.status : null,
      observer: this.observerStatus,
      injecting: this.injecting
    }
  }

  // --- Lifecycle -----------------------------------------------------------------------

  async connect(): Promise<void> {
    if (this.disposed) throw new Error('camera_adapter_disposed')
    if (this.consumer) return
    this.pending = 'connecting'
    this.error = null
    this.changed(true)
    try {
      const rt = await this.load()
      const created = await rt.createSession(this.opts.baseUrl, {
        label: this.opts.label ?? 'memoria',
        policyOverrides: this.opts.policyOverrides
      })
      if (this.disposed) {
        void rt.deleteSession(this.opts.baseUrl, created.session_id, created.consumer_token).catch(() => {})
        return
      }
      this.session = { id: created.session_id, consumerToken: created.consumer_token, producerToken: created.producer_token }
      const consumer = new rt.GameAdapter({
        baseUrl: this.opts.baseUrl,
        sessionId: created.session_id,
        consumerToken: created.consumer_token,
        sourceId: 'memoria',
        visionAdaptationEnabled: this.adaptationEnabled
      })
      this.consumer = consumer
      this.consumerOffs.push(
        consumer.onState((s) => {
          this.adapterState = s
          this.changed()
        }),
        consumer.onConnectionStatus((e) => {
          this.serviceReason = e.reason
          this.adapterState = consumer.getLatestState()
          this.changed(true)
        }),
        consumer.onGesture((g) => {
          const gesture = toGesture(g, this.now())
          for (const cb of [...this.gestureListeners]) this.safe(() => cb(gesture))
        }),
        consumer.onSuggestedAction((a) => {
          const suggestion = toSuggestion(a, this.now())
          for (const cb of [...this.suggestionListeners]) this.safe(() => cb(suggestion))
        })
      )
      await consumer.connect()
      this.adapterState = consumer.getLatestState()
      this.pending = null
      this.changed(true)
    } catch (e) {
      this.pending = null
      if (this.disposed) return
      this.error = { code: 'service_unreachable', message: errText(e) }
      this.log('could not reach the observation service', e)
      this.teardownConsumer()
      this.changed(true)
      throw e
    }
  }

  async startCamera(video: HTMLVideoElement, overlay: HTMLCanvasElement | null = null): Promise<void> {
    if (this.disposed) throw new Error('camera_adapter_disposed')
    if (!this.session || !this.runtime) throw new Error('camera_adapter_not_connected')
    if (this.observer || this.injecting) return // exactly one capture and one pipeline
    const gen = ++this.cameraGen
    const rt = this.runtime
    this.error = null
    this.pending = 'starting_camera'
    this.changed(true)

    try {
      await this.ensureProducer(rt)
      if (gen !== this.cameraGen) return
      const observer = new rt.FaceObserver({
        video,
        overlay,
        wasmBaseUrl: this.opts.wasmBaseUrl ?? 'mediapipe/wasm',
        modelUrl: this.opts.modelUrl ?? 'models/face_landmarker.task'
      })
      this.observer = observer
      this.pending = null
      this.cameraOffs.push(
        observer.onObservation((body) => this.producer?.submit(body)),
        observer.onStatus((s) => {
          this.observerStatus = s
          this.perf = observer.perf
          const err = observerError(s)
          if (err) this.fail(err)
          this.changed(true)
        }),
        observer.onProcessorStatus((s) => {
          this.processorStatus = s
          this.perf = observer.perf
          this.changed()
        })
      )
      try {
        await observer.start()
      } catch {
        /* reported through onStatus as an 'error' status */
      }
      if (gen !== this.cameraGen) return
      this.observerStatus = observer.observerStatus
      const err = observerError(observer.observerStatus)
      if (err) this.fail(err)
      this.changed(true)
    } catch (e) {
      if (gen !== this.cameraGen) return
      this.pending = null
      this.fail({ code: 'camera_error', message: errText(e) })
      this.changed(true)
    }
  }

  stopCamera(): void {
    this.cameraGen++
    for (const off of this.cameraOffs.splice(0)) off()
    this.observer?.stop()
    this.observer = null
    this.producer?.disconnect()
    this.producer = null
    this.injecting = false
    this.observerStatus = null
    this.processorStatus = null
    this.perf = null
    if (this.pending === 'starting_camera') this.pending = null
    this.changed(true)
  }

  calibrate(): void {
    this.observer?.startCalibration()
  }

  setAdaptationEnabled(enabled: boolean): void {
    this.adaptationEnabled = enabled
    this.consumer?.setVisionAdaptationEnabled(enabled)
    this.changed(true)
  }

  sendGameEvent(event: GameEventInput): string | null {
    if (!this.consumer || this.disposed) return null
    try {
      return this.consumer.sendGameEvent(event)
    } catch (e) {
      this.log('sendGameEvent failed', e)
      return null
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return
    this.disposed = true
    this.stopCamera()
    if (this.emitTimer !== null) clearTimeout(this.emitTimer)
    this.emitTimer = null
    const session = this.session
    const consumer = this.consumer
    // Give queued game events (e.g. the closing task_skipped) a moment to leave.
    if (consumer) await new Promise((r) => setTimeout(r, 250))
    this.teardownConsumer()
    if (session && this.runtime) {
      await this.runtime.deleteSession(this.opts.baseUrl, session.id, session.consumerToken).catch((e) => {
        this.log('session delete failed (it will expire on the service)', e)
      })
    }
    this.session = null
    this.stateListeners.clear()
    this.gestureListeners.clear()
    this.suggestionListeners.clear()
    if (live === this) live = null
  }

  // --- TEST ONLY: labelled synthetic observations ----------------------------------------

  /**
   * Sends a synthetic observation through the real ProducerConnection, in place of the
   * webcam. The body is always marked `simulated: true`, and the policy refuses simulated
   * vision unless the test explicitly allows it. Throws unless `allowInjection` was set.
   */
  async injectObservation(body: ObservationBody): Promise<void> {
    if (!this.opts.allowInjection) throw new Error('camera_injection_not_allowed')
    if (!this.runtime || !this.session) throw new Error('camera_adapter_not_connected')
    if (this.observer) throw new Error('camera_running') // never two producers
    await this.ensureProducer(this.runtime)
    this.injecting = true
    this.producer?.submit({ ...body, simulated: true })
    // Mirror the injected body into the local status so the snapshot gate sees it.
    this.observerStatus = { kind: 'running', backend: 'main_thread', delegate: null }
    this.perf = body.perf
    this.processorStatus = {
      tracking: body.tracking.status,
      calibration: body.calibration.status,
      calibrationPhase: 'idle',
      calibrationProgress: body.calibration.progress,
      calibrationReason: body.calibration.reason,
      lockedFaceIndex: body.tracking.valid ? 0 : null
    }
    this.changed()
  }

  // --- Reads and subscriptions ---------------------------------------------------------

  getLatestState(): CameraSnapshot {
    return buildSnapshot({
      at: this.now(),
      sessionId: this.session?.id ?? null,
      // Re-read so freshness is judged now, not when the last message arrived.
      adapter: this.consumer ? this.consumer.getLatestState() : this.adapterState,
      serviceReason: this.serviceReason,
      observer: this.observerStatus,
      processor: this.processorStatus,
      perf: this.perf,
      adaptationEnabled: this.adaptationEnabled,
      pending: this.pending,
      error: this.error
    })
  }

  onState(cb: (s: CameraSnapshot) => void): Unsubscribe {
    return this.subscribe(this.stateListeners, cb)
  }

  onGesture(cb: (g: CameraGesture) => void): Unsubscribe {
    return this.subscribe(this.gestureListeners, cb)
  }

  onSuggestion(cb: (s: CameraSuggestion) => void): Unsubscribe {
    return this.subscribe(this.suggestionListeners, cb)
  }

  // --- Internals -------------------------------------------------------------------------

  private async load(): Promise<Runtime> {
    if (!this.runtime) this.runtime = await (this.opts.loadRuntime ?? (() => import('./runtime')))()
    return this.runtime
  }

  private async ensureProducer(rt: Runtime): Promise<void> {
    if (this.producer || !this.session) return
    const producer = new rt.ProducerConnection({
      baseUrl: this.opts.baseUrl,
      sessionId: this.session.id,
      producerToken: this.session.producerToken,
      producerId: 'memoria-camera'
    })
    this.producer = producer
    this.cameraOffs.push(producer.onStatus(() => this.changed()))
    await producer.connect()
  }

  /** A camera failure stops the camera (releasing it) but keeps the game and service link. */
  private fail(err: { code: CameraErrorCode; message: string }): void {
    this.error = err
    this.log(`camera stopped: ${err.code}`, err.message)
    queueMicrotask(() => {
      if (this.observer || this.producer) {
        const error = this.error
        this.stopCamera()
        this.error = error
        this.changed(true)
      }
    })
  }

  private teardownConsumer(): void {
    for (const off of this.consumerOffs.splice(0)) off()
    this.consumer?.disconnect()
    this.consumer = null
    this.adapterState = null
  }

  private subscribe<T>(set: Set<(v: T) => void>, cb: (v: T) => void): Unsubscribe {
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  private safe(fn: () => void): void {
    try {
      fn()
    } catch (e) {
      this.log('listener threw', e)
    }
  }

  /**
   * Coalesces bursts (processor status arrives per frame) into at most one snapshot per
   * EMIT_INTERVAL_MS. `immediate` is for lifecycle changes the UI must show at once.
   */
  private changed(immediate = false): void {
    if (this.disposed && !immediate) return
    const due = this.lastEmitAt + EMIT_INTERVAL_MS - this.now()
    if (immediate || due <= 0) {
      if (this.emitTimer !== null) clearTimeout(this.emitTimer)
      this.emitTimer = null
      this.emitNow()
      return
    }
    if (this.emitTimer === null) {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = null
        this.emitNow()
      }, due)
    }
  }

  private emitNow(): void {
    this.lastEmitAt = this.now()
    if (this.stateListeners.size === 0) return
    const snapshot = this.getLatestState()
    for (const cb of [...this.stateListeners]) this.safe(() => cb(snapshot))
  }
}

function errText(e: unknown): string {
  if (e instanceof Error) return e.message || e.name
  return String(e)
}
