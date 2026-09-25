/**
 * The game-facing camera interface — stable types the rest of Memoria codes against.
 *
 * The camera application's wire schema (CAMERA/web/src/protocol/types.ts, schema 1.0) is
 * translated into these by `snapshot.ts`. The full field-by-field mapping, with units and
 * ranges, is in INTEGRATION.md at the workspace root; the short form is on each field.
 *
 * Three rules shape everything here:
 *
 *  - **Unknown stays unknown.** A measurement is `{ value, reason }` with exactly one of
 *    the two non-null. Nothing is ever defaulted to 0, "toward", or "tracking".
 *  - **Head orientation is not eye gaze.** The camera measures where the *head* points
 *    relative to a calibrated neutral pose. Nothing here is called "gaze" or "looking".
 *  - **Scores are labelled.** `headFacingScore` and `engagement` are documented
 *    heuristics, not model outputs, and are for the developer panel only.
 */

import type { CalibrationStatus, TrackingStatus } from './app'

export type Unsubscribe = () => void

/** Exactly one of `value` / `reason` is non-null. */
export interface Measured<T> {
  value: T | null
  reason: string | null
}

/** Where the camera feature is in its lifecycle. Drives the setup sheet and HUD chip. */
export type CameraPhase =
  | 'off'
  | 'connecting' // creating the service session, opening the consumer socket
  | 'starting_camera' // permission prompt / opening the webcam
  | 'loading_model' // MediaPipe WASM + face model loading (worker or main thread)
  | 'needs_calibration'
  | 'calibrating'
  | 'ready' // calibrated; adaptation may run when tracking is valid
  | 'error'

export type CameraErrorCode =
  | 'service_unreachable' // POST /v1/sessions failed (service not running / refused)
  | 'service_url_refused' // VITE_OBSERVATION_URL is not a loopback http(s) origin
  | 'camera_unsupported'
  | 'permission_denied'
  | 'no_camera'
  | 'camera_in_use'
  | 'camera_error'
  | 'model_load_failed'
  | 'inference_failed'

/** The service link (GameAdapter consumer socket). */
export interface ServiceLink {
  /** GameAdapter ConnectionStatus, or 'offline' before a session exists. */
  status: 'offline' | 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed' | 'failed'
  /** True when not open or no message within the adapter's heartbeat timeout (6 s). */
  stale: boolean
  reason: string | null
  sessionId: string | null
}

/** The local camera pipeline (FaceObserver + SignalProcessor), read in this page. */
export interface LocalCamera {
  running: boolean
  /** Tab hidden: capture paused, observations say 'suspended'. */
  suspended: boolean
  backend: 'worker' | 'main_thread' | null
  delegate: 'GPU' | 'CPU' | null
  /** Frames actually processed per second (EMA), or null before the first. */
  processedFps: number | null
  /** detectForVideo wall time, ms (EMA). */
  inferenceMs: number | null
  droppedFrames: number
  /** Local processor view — immediate, not round-tripped through the service. */
  tracking: TrackingStatus | 'unknown'
  calibration: CalibrationStatus | 'unknown'
  /** 0..1 while calibrating, else null. */
  calibrationProgress: number | null
  calibrationReason: string | null
}

export type AttentionState =
  | 'HEAD_TOWARD_SCREEN'
  | 'HEAD_AWAY'
  | 'CALIBRATING'
  | 'TRACKING_UNAVAILABLE'
  | 'UNKNOWN'

/**
 * The service's derived view of the latest observation. Null whenever the service link
 * is stale — "no data" is never presented as "looking at the screen".
 */
export interface VisionView {
  /** Service-side freshness: latest observation younger than stale_after_ms (1500). */
  fresh: boolean
  /** True for injected test observations. Never true for the real camera path. */
  simulated: boolean
  /** Server-clock age of the latest observation, ms. */
  observationAgeMs: number | null
  attention: AttentionState
  attentionReason: string
  trackingValid: boolean
  trackingStatus: TrackingStatus | null
  /** HEURISTIC [0,1]: face size × in-frame share × pose × motion, with penalties (multiple faces, no matrix, slow inference). */
  trackingQuality: Measured<number>
  calibration: CalibrationStatus | null
  /** Degrees relative to the calibrated neutral pose. yaw>0 = head turned to player's right. */
  headYawDeg: Measured<number>
  /** Degrees; pitch>0 = chin up. */
  headPitchDeg: Measured<number>
  /** Degrees; roll>0 = tilted toward the player's right shoulder. */
  headRollDeg: Measured<number>
  /** HEURISTIC [0,1]: 1 = at neutral; clamp(1 − hypot(yaw/40°, pitch/30°)). Not gaze. */
  headFacingScore: Measured<number>
  /** Sustained head-away duration on the producer clock, ms; 0 while toward. Resets on any tracking gap. */
  headAwayMs: Measured<number>
  /** Relative eye aspect ratio (1 = calibrated open), [0,5]. */
  eyeOpennessLeft: Measured<number>
  eyeOpennessRight: Measured<number>
  eyesClosed: Measured<boolean>
  eyesClosedMs: Measured<number>
}

/** The service's own adaptation gate (PolicyState). */
export interface PolicyView {
  visionAdaptation: 'active' | 'held' | 'disabled'
  visionHoldReason: string | null
  /** Service asks the game to hold *new* instructions (sustained head-away, capped per episode). */
  holdNewInstructions: boolean
  holdReason: string | null
}

/** The service's view of gameplay — what the game's events told it. Diagnostic. */
export interface GameplayView {
  paused: boolean
  expectedIdle: boolean
  currentTaskId: string | null
  /** Server-clock ms since the last player input; frozen while paused / expected idle. */
  inactivityMs: Measured<number>
  tasksCompleted: number
  answersTotal: number
  recentAccuracy: Measured<number>
  recentResponseMsMedian: Measured<number>
}

/** HEURISTIC task_engagement_score — diagnostic only, never used to adapt the game. */
export interface EngagementView extends Measured<number> {
  components: Record<string, number | null>
}

export interface CameraSnapshot {
  /** performance.now() when this snapshot was built. */
  at: number
  phase: CameraPhase
  error: { code: CameraErrorCode; message: string } | null
  service: ServiceLink
  camera: LocalCamera
  /** Null while the service link is stale or before the first state message. */
  vision: VisionView | null
  policy: PolicyView | null
  gameplay: GameplayView | null
  engagement: EngagementView | null
  /** The player's adaptation switch. Off stops vision suggestions at the service too. */
  adaptationEnabled: boolean
  /**
   * The one gate vision-driven adaptation passes through: service open and fresh, vision
   * fresh, calibrated, tracking valid, and the service's own vision gate 'active'.
   */
  visionUsable: boolean
  /** Why `visionUsable` is false, as a reason code; null when it is true. */
  visionBlockedReason: string | null
}

/** A head gesture, as the camera app detected it. Heuristic; never an answer by default. */
export interface CameraGesture {
  id: string
  type: 'blink' | 'nod' | 'head_shake'
  /** Producer clock, ms (performance.now() in this page). */
  startMs: number
  endMs: number
  amplitudeDeg: number | null
  swings: number | null
  /** performance.now() when the game received it. */
  receivedAt: number
}

export type SuggestionAction = 'delay_instruction' | 'gentle_cue' | 'offer_hint' | 'increase_difficulty'

/** A service suggestion. The game's AdaptationPolicy decides whether anything happens. */
export interface CameraSuggestion {
  id: string
  action: SuggestionAction
  source: 'vision' | 'gameplay' | 'vision+gameplay'
  /** The task the service meant (`<missionId>:<step>`), or null. */
  taskId: string | null
  /** The service's plain-language trigger. */
  reason: string
  /** The numbers behind it (thresholds, durations, ratios). */
  evidence: Record<string, number | string | boolean | null>
  /** performance.now() when received. */
  receivedAt: number
  /** Valid for this long after `receivedAt`. */
  expiresInMs: number
}

/** A gameplay event for the service. Mirrors the camera app's GameEventInput. */
export type { GameEventInput } from './app'

/** The camera adapter the game uses — see CameraAdapter.ts for the implementation. */
export interface CameraAdapterApi {
  /** Create the service session and open the consumer connection. */
  connect(): Promise<void>
  /** Open the webcam and start inference into `video` (+ optional overlay). Requires connect(). */
  startCamera(video: HTMLVideoElement, overlay?: HTMLCanvasElement | null): Promise<void>
  /** Stop the webcam and inference; the service link stays up. Idempotent. */
  stopCamera(): void
  /** Begin guided neutral-pose calibration (look at the screen, hold still ~3 s). */
  calibrate(): void
  getLatestState(): CameraSnapshot
  onState(cb: (s: CameraSnapshot) => void): Unsubscribe
  onGesture(cb: (g: CameraGesture) => void): Unsubscribe
  onSuggestion(cb: (s: CameraSuggestion) => void): Unsubscribe
  /** Queue a gameplay event (resent with the same id after a reconnect). Null when not connected. */
  sendGameEvent(event: import('./app').GameEventInput): string | null
  setAdaptationEnabled(enabled: boolean): void
  /** Stop everything, close sockets, delete the service session. Idempotent. */
  dispose(): Promise<void>
}
