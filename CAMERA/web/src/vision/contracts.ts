/**
 * Contracts between the MediaPipe runtime (landmarker/worker/FaceObserver) and the pure
 * signal processor (signals.ts). The processor never sees MediaPipe objects — only these
 * plain, transferable structures — so it can be unit-tested with synthetic frames.
 */

import type { CalibrationStatus, Gesture, ObservationBody, PerfInfo, TrackingStatus } from '../protocol/types.ts'

/** One detected face, extracted from a MediaPipe FaceLandmarkerResult. */
export interface FaceData {
  /** Normalized [0,1] bounding box of all landmarks, in the raw (unmirrored) image. */
  box: { x0: number; y0: number; x1: number; y1: number }
  /** Fraction of the 478 landmarks lying inside the image, [0,1]. */
  inFrameFraction: number
  /**
   * Eye aspect ratio per eye, by the PLAYER's anatomy (left = player's left eye =
   * MediaPipe landmarks 362/385/387/263/373/380). Computed in pixel space (x scaled by
   * width, y by height) so aspect ratio is correct. null if not computable.
   */
  earLeft: number | null
  earRight: number | null
  /** Raw blendshape coefficients 'eyeBlinkLeft' / 'eyeBlinkRight' as MediaPipe names them. */
  blinkLeft: number | null
  blinkRight: number | null
  /**
   * facialTransformationMatrixes[i].data — 4x4, column-major (element (r,c) = m[c*4+r]).
   * Canonical face -> camera space (right-handed, camera looks down -Z, +Y up, +X = image
   * right). null if the model did not output it.
   */
  matrix: number[] | null
  /** Optional flat [x,y,z,...] normalized landmarks for the preview overlay only. */
  landmarks?: Float32Array
}

export interface FaceFrame {
  /** Capture time, ms, monotonic (performance.now()). Strictly increasing. */
  t: number
  width: number
  height: number
  faces: FaceData[]
  /** Wall time spent in detectForVideo for this frame, ms. */
  inferenceMs: number
}

export interface SignalConfig {
  // Smoothing (time constants, ms; EMA alpha = 1 - exp(-dt / tau))
  angleTauMs: number // 120
  gestureTauMs: number // 50

  // Head-facing heuristic: e = hypot(yaw/yawLimitDeg, pitch/pitchLimitDeg); score = clamp(1-e,0,1)
  yawLimitDeg: number // 40
  pitchLimitDeg: number // 30
  // Orientation hysteresis on the smoothed score, with minimum durations
  awayEnterScore: number // 0.35 (score below -> candidate away)
  towardEnterScore: number // 0.55 (score above -> candidate toward)
  awayMinMs: number // 300
  towardMinMs: number // 200

  // Tracking validity
  minQuality: number // 0.4
  recoveryMs: number // 500 — after any invalid period, stay 'recovering' this long
  relockGraceMs: number // 5000 — face absent longer than this => 'lost', recalibration required
  multiFaceIouMin: number // 0.2

  // Calibration
  calibrationSettleMs: number // 800
  calibrationDurationMs: number // 2000
  calibrationMinSamples: number // 8
  calibrationMaxStdDeg: number // 4
  calibrationMaxAbsDeg: number // 30 (raw pose must be roughly toward the camera)

  // Eyes
  eyeCloseRatio: number // 0.6 (relative EAR below -> closed)
  eyeOpenRatio: number // 0.8 (relative EAR above -> open)
  blinkMinMs: number // 40
  blinkMaxMs: number // 500
  eyeMaxYawDeg: number // 30 (eye measurements null beyond this)
  eyeMaxPitchDeg: number // 25

  // Gestures (swing detection on gesture-smoothed relative angles)
  nodMinSwingDeg: number // 7
  nodMinSwings: number // 2
  nodMaxDurationMs: number // 1200
  shakeMinSwingDeg: number // 9
  shakeMinSwings: number // 3
  shakeMaxDurationMs: number // 1500
  minSwingMs: number // 60
  crossAxisRatio: number // 0.6
  returnToleranceRatio: number // 0.5
  gestureCooldownMs: number // 800
}

/** Snapshot the processor exposes for UI (calibration guidance, overlay colours). */
export interface ProcessorStatus {
  tracking: TrackingStatus
  calibration: CalibrationStatus
  calibrationPhase: 'idle' | 'settle' | 'collect'
  calibrationProgress: number | null
  calibrationReason: string | null
  /** Index into FaceFrame.faces of the locked face, or null. */
  lockedFaceIndex: number | null
}

/**
 * Implemented by signals.ts `SignalProcessor`. Pure and deterministic: all time comes from
 * FaceFrame.t / the `t` arguments; no Date/performance calls inside.
 */
export interface SignalProcessorApi {
  /** Process one frame; returns the observation body (perf filled from `perf`). */
  process(frame: FaceFrame, perf: PerfInfo | null): ObservationBody
  /** Begin guided neutral-pose calibration at time t (settle, then collect). */
  startCalibration(t: number): void
  cancelCalibration(t: number): void
  /** Producer paused (tab hidden / stop). Returns a 'suspended' observation body. */
  suspend(t: number, perf: PerfInfo | null): ObservationBody
  /** Producer resumed after suspend; next valid frames go through 'recovering'. */
  resume(t: number): void
  /** Forget calibration and all temporal state. */
  reset(): void
  status(): ProcessorStatus
  /** Gestures emitted by the most recent process() call (also included in its body). */
  lastGestures(): Gesture[]
}

export const DEFAULT_SIGNAL_CONFIG: SignalConfig = {
  angleTauMs: 120,
  gestureTauMs: 50,
  yawLimitDeg: 40,
  pitchLimitDeg: 30,
  awayEnterScore: 0.35,
  towardEnterScore: 0.55,
  awayMinMs: 300,
  towardMinMs: 200,
  minQuality: 0.4,
  recoveryMs: 500,
  relockGraceMs: 5000,
  multiFaceIouMin: 0.2,
  calibrationSettleMs: 800,
  calibrationDurationMs: 2000,
  calibrationMinSamples: 8,
  calibrationMaxStdDeg: 4,
  calibrationMaxAbsDeg: 30,
  eyeCloseRatio: 0.6,
  eyeOpenRatio: 0.8,
  blinkMinMs: 40,
  blinkMaxMs: 500,
  eyeMaxYawDeg: 30,
  eyeMaxPitchDeg: 25,
  nodMinSwingDeg: 7,
  nodMinSwings: 2,
  nodMaxDurationMs: 1200,
  shakeMinSwingDeg: 9,
  shakeMinSwings: 3,
  shakeMaxDurationMs: 1500,
  minSwingMs: 60,
  crossAxisRatio: 0.6,
  returnToleranceRatio: 0.5,
  gestureCooldownMs: 800
}

/** Emitted by FaceObserver (the camera-owning producer module). */
export type ObserverStatus =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; backend: PerfInfo['backend']; delegate: PerfInfo['delegate'] }
  | { kind: 'suspended'; reason: 'tab_hidden' }
  | { kind: 'stopped' }
  | {
      kind: 'error'
      code:
        | 'camera_unsupported'
        | 'permission_denied'
        | 'no_camera'
        | 'camera_in_use'
        | 'camera_error'
        | 'model_load_failed'
        | 'inference_failed'
      message: string
    }

export interface FaceObserverOptions {
  /** Element the camera stream is attached to (shown as the preview). */
  video: HTMLVideoElement
  /** Optional canvas stacked over the video for the landmark overlay. */
  overlay?: HTMLCanvasElement | null
  /** Defaults to a new SignalProcessor with DEFAULT_SIGNAL_CONFIG. */
  processor?: SignalProcessorApi
  /** Directory holding MediaPipe WASM files (copied by scripts/setup-assets.mjs). Default '/mediapipe/wasm'. */
  wasmBaseUrl?: string
  /** Default '/models/face_landmarker.task'. */
  modelUrl?: string
  /** Minimum ms between submitted frames when running in the worker. Default 66 (~15 Hz). */
  sampleIntervalMs?: number
  /** Minimum ms between frames on the main-thread fallback. Default 150 (~6.7 Hz). */
  fallbackSampleIntervalMs?: number
  /** Try a Web Worker first. Default true. */
  preferWorker?: boolean
  /** Preferred delegate; falls back to CPU if GPU init fails. Default 'GPU'. */
  delegate?: 'GPU' | 'CPU'
  /** CSS-mirror the preview + overlay (display only; measurements are unaffected). Default true. */
  mirrorPreview?: boolean
  overlayEnabled?: boolean
}

/**
 * The camera-owning producer module (FaceObserver.ts). It never opens a network
 * connection itself: wire onObservation -> ProducerConnection.submit.
 */
export interface FaceObserverApi {
  /** Requests camera permission, loads the model, starts the inference loop. Never falls back to simulated data. */
  start(): Promise<void>
  /** Stops camera tracks, inference loop, worker/landmarker; idempotent. */
  stop(): void
  startCalibration(): void
  cancelCalibration(): void
  setOverlayEnabled(enabled: boolean): void
  setMirrorPreview(enabled: boolean): void
  onObservation(cb: (body: ObservationBody) => void): () => void
  onStatus(cb: (s: ObserverStatus) => void): () => void
  onProcessorStatus(cb: (s: ProcessorStatus) => void): () => void
  readonly perf: PerfInfo
  readonly observerStatus: ObserverStatus
}
