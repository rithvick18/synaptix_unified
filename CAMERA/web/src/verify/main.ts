/**
 * Bare verification page for FaceObserver, driven by scripts/browser-check.mjs over CDP.
 * Exposes window.__verify with status, perf, the last observation body and a compact
 * per-frame timeline. Query params: ?worker=0 (force main thread), ?delegate=CPU,
 * ?autostart=0, ?model=<url> (e.g. a missing file, to exercise model_load_failed).
 */

import type { ObservationBody, PerfInfo } from '../protocol/types.ts'
import type { FaceFrame, ObserverStatus, ProcessorStatus, SignalProcessorApi } from '../vision/contracts.ts'
import { FaceObserver } from '../vision/FaceObserver.ts'
import { eulerFromFaceMatrix } from '../vision/geometry.ts'
import { SignalProcessor } from '../vision/signals.ts'

interface TimelineEntry {
  t: number
  faces: number
  inFrame: number | null
  /** Uncalibrated pose from the raw face matrix (processor's player-perspective convention). */
  rawRoll: number | null
  rawYaw: number | null
  rawPitch: number | null
  status: string
  cal: string
  roll: number | null
  yaw: number | null
  pitch: number | null
  inferenceMs: number
}

interface VerifyState {
  status: ObserverStatus
  statusHistory: Array<{ t: number; status: ObserverStatus }>
  perf: PerfInfo | null
  lastBody: ObservationBody | null
  bodies: number
  processorStatus: ProcessorStatus | null
  errors: string[]
  timeline: TimelineEntry[]
  diagnostics: FaceObserver['diagnostics'] | null
  /** Histogram (4 ms buckets) of intervals between camera frames seen by an independent rVFC loop. */
  cameraFrameIntervals: Record<string, number>
  start: () => Promise<void>
  stop: () => void
  calibrate: () => void
  cancelCalibration: () => void
}

const params = new URLSearchParams(location.search)
const video = document.getElementById('video') as HTMLVideoElement
const overlay = document.getElementById('overlay') as HTMLCanvasElement
const out = document.getElementById('out') as HTMLPreElement

const real = new SignalProcessor()
let pendingFrame: FaceFrame | null = null

/** Delegates to the real SignalProcessor; records the raw frame for the timeline. */
const recording: SignalProcessorApi = {
  process(frame, perf) {
    pendingFrame = frame
    const body = real.process(frame, perf)
    record(frame, body)
    return body
  },
  startCalibration: (t) => real.startCalibration(t),
  cancelCalibration: (t) => real.cancelCalibration(t),
  suspend: (t, perf) => real.suspend(t, perf),
  resume: (t) => real.resume(t),
  reset: () => real.reset(),
  status: () => real.status(),
  lastGestures: () => real.lastGestures()
}

const observer = new FaceObserver({
  video,
  overlay,
  processor: recording,
  preferWorker: params.get('worker') !== '0',
  delegate: params.get('delegate') === 'CPU' ? 'CPU' : 'GPU',
  modelUrl: params.get('model') ?? undefined
})

const state: VerifyState = {
  status: observer.observerStatus,
  statusHistory: [],
  perf: null,
  lastBody: null,
  bodies: 0,
  processorStatus: null,
  errors: [],
  timeline: [],
  diagnostics: observer.diagnostics,
  cameraFrameIntervals: {},
  start: () => observer.start(),
  stop: () => observer.stop(),
  calibrate: () => observer.startCalibration(),
  cancelCalibration: () => observer.cancelCalibration()
}
;(window as unknown as { __verify: VerifyState }).__verify = state

function record(frame: FaceFrame, body: ObservationBody): void {
  const idx = real.status().lockedFaceIndex ?? (frame.faces.length > 0 ? 0 : null)
  const face = idx !== null ? frame.faces[idx] : undefined
  const raw = face ? eulerFromFaceMatrix(face.matrix) : null
  const m = body.measurements
  state.timeline.push({
    t: Math.round(frame.t),
    faces: frame.faces.length,
    inFrame: face ? Math.round(face.inFrameFraction * 1000) / 1000 : null,
    rawRoll: raw ? round1(raw.roll) : null,
    rawYaw: raw ? round1(raw.yaw) : null,
    rawPitch: raw ? round1(raw.pitch) : null,
    status: body.tracking.status,
    cal: body.calibration.status,
    roll: m.head_roll_deg.value !== null ? round1(m.head_roll_deg.value) : null,
    yaw: m.head_yaw_deg.value !== null ? round1(m.head_yaw_deg.value) : null,
    pitch: m.head_pitch_deg.value !== null ? round1(m.head_pitch_deg.value) : null,
    inferenceMs: Math.round(frame.inferenceMs * 10) / 10
  })
  if (state.timeline.length > 5000) state.timeline.splice(0, state.timeline.length - 5000)
}

const round1 = (v: number) => Math.round(v * 10) / 10

observer.onStatus((s) => {
  state.status = s
  state.statusHistory.push({ t: Math.round(performance.now()), status: s })
  if (s.kind === 'error') state.errors.push(`${s.code}: ${s.message}`)
  render()
})
observer.onObservation((b) => {
  state.lastBody = b
  state.bodies++
  state.perf = observer.perf
  if (state.bodies % 5 === 0) render()
})
observer.onProcessorStatus((ps) => {
  state.processorStatus = ps
})
window.addEventListener('error', (e) => state.errors.push(`window.error: ${e.message}`))
window.addEventListener('unhandledrejection', (e) => state.errors.push(`unhandledrejection: ${String(e.reason)}`))

function render(): void {
  const b = state.lastBody
  out.textContent = JSON.stringify(
    {
      status: state.status,
      perf: state.perf,
      bodies: state.bodies,
      tracking: b?.tracking,
      calibration: b?.calibration,
      roll: b?.measurements.head_roll_deg,
      last: pendingFrame ? { faces: pendingFrame.faces.length, t: Math.round(pendingFrame.t) } : null,
      errors: state.errors
    },
    null,
    2
  )
}

// Independent measurement of camera frame cadence (to interpret processed_fps).
{
  let prev: number | null = null
  const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: (now: number) => void) => number }
  const onFrame = (now: number) => {
    if (prev !== null) {
      const k = String(Math.round((now - prev) / 4) * 4)
      state.cameraFrameIntervals[k] = (state.cameraFrameIntervals[k] ?? 0) + 1
    }
    prev = now
    v.requestVideoFrameCallback?.(onFrame)
  }
  v.requestVideoFrameCallback?.(onFrame)
}

if (params.get('autostart') !== '0') void observer.start()
