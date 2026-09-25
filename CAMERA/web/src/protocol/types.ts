/**
 * Wire types, schema_version 1.0. Mirrors service/app/schemas.py exactly — field names are
 * snake_case on the wire. Change both files together.
 *
 * Conventions
 * - Every measurement is { value, reason }: exactly one is non-null. Unavailable is
 *   `null` + reason, never 0.
 * - Client `*_ts_ms` values are that client's monotonic clock (performance.now()). They
 *   are only ever compared with timestamps from the same client.
 */

export const SCHEMA_VERSION = '1.0' as const
export type SchemaVersion = typeof SCHEMA_VERSION

/** Reason codes match /^[a-z0-9_]{1,64}$/. IDs match /^[A-Za-z0-9_.:-]{1,128}$/. */
export type Reason = string

export interface Measurement<T> {
  value: T | null
  reason: Reason | null
}
export type AngleMeasurement = Measurement<number> // degrees, [-180, 180]
export type UnitMeasurement = Measurement<number> // [0, 1]
export type RatioMeasurement = Measurement<number> // [0, 5]
export type DurationMeasurement = Measurement<number> // ms, [0, 86_400_000]
export type BoolMeasurement = Measurement<boolean>
export type HeadOrientation = 'toward' | 'away' | 'uncertain'
export type OrientationMeasurement = Measurement<HeadOrientation>

export function measured<T>(value: T): Measurement<T> {
  return { value, reason: null }
}
export function unavailable<T = never>(reason: Reason): Measurement<T> {
  return { value: null, reason }
}

// --- Producer -> service -------------------------------------------------------------

export type TrackingStatus =
  | 'not_started'
  | 'tracking'
  | 'recovering'
  | 'no_face'
  | 'multiple_faces'
  | 'low_quality'
  | 'lost'
  | 'suspended'
  | 'error'

export type CalibrationStatus = 'uncalibrated' | 'calibrating' | 'calibrated' | 'failed' | 'required'

export interface TrackingInfo {
  status: TrackingStatus
  /** true only when status === 'tracking' and quality.value !== null */
  valid: boolean
  reason: Reason | null
  face_count: number
  multiple_faces_visible: boolean
  quality: UnitMeasurement
}

export interface CalibrationInfo {
  status: CalibrationStatus
  reason: Reason | null
  progress: number | null
}

export interface VisionMeasurements {
  /** Relative to calibrated neutral. yaw>0 = head turned to player's right. */
  head_yaw_deg: AngleMeasurement
  /** pitch>0 = chin up. */
  head_pitch_deg: AngleMeasurement
  /** roll>0 = head tilted toward the player's right shoulder. */
  head_roll_deg: AngleMeasurement
  /** Heuristic in [0,1]; 1 = at calibrated neutral. Head orientation, NOT eye gaze. */
  head_facing_score: UnitMeasurement
  head_orientation: OrientationMeasurement
  /** Sustained head-away duration (producer clock); 0 while oriented toward. */
  head_away_ms: DurationMeasurement
  /** Increments for each new head-away episode; null before the first. */
  head_away_episode: number | null
  /** Eye aspect ratio relative to calibrated open-eye value (player's own left/right). */
  eye_openness_left: RatioMeasurement
  eye_openness_right: RatioMeasurement
  /** Raw MediaPipe eyeBlinkLeft/eyeBlinkRight blendshape coefficients (not probabilities). */
  eye_blink_coefficient_left: UnitMeasurement
  eye_blink_coefficient_right: UnitMeasurement
  eyes_closed: BoolMeasurement
  eyes_closed_ms: DurationMeasurement
}

export type GestureType = 'blink' | 'nod' | 'head_shake'

export interface Gesture {
  gesture_id: string
  type: GestureType
  start_ts_ms: number
  end_ts_ms: number
  amplitude_deg: number | null
  swings: number | null
}

export interface PerfInfo {
  backend: 'worker' | 'main_thread'
  delegate: 'GPU' | 'CPU' | null
  inference_ms: number | null
  processed_fps: number | null
  dropped_frames: number
}

/** The part of an observation the vision pipeline produces (no session/seq/producer). */
export interface ObservationBody {
  capture_ts_ms: number
  tracking: TrackingInfo
  calibration: CalibrationInfo
  measurements: VisionMeasurements
  gestures: Gesture[]
  perf: PerfInfo | null
  simulated: boolean
}

export interface ObservationMessage extends ObservationBody {
  type: 'observation'
  schema_version: SchemaVersion
  session_id: string
  producer_id: string
  seq: number
}

// --- Game -> service -----------------------------------------------------------------

export type GameEventType =
  | 'task_started'
  | 'answer_submitted'
  | 'hint_requested'
  | 'hint_shown'
  | 'task_completed'
  | 'task_skipped'
  | 'paused'
  | 'resumed'
  | 'player_activity'
  | 'expected_idle_start'
  | 'expected_idle_end'
  | 'adaptation_setting'

export type TaskOutcome = 'success' | 'success_with_help' | 'failed' | 'revealed'

export interface GameEventData {
  correct?: boolean | null
  response_ms?: number | null
  hint_level?: number | null
  outcome?: TaskOutcome | null
  difficulty?: string | null
  activity?: string | null
  vision_adaptation_enabled?: boolean | null
}

export interface GameEventMessage {
  type: 'game_event'
  schema_version: SchemaVersion
  session_id: string
  source_id: string
  seq: number
  event_id: string
  client_ts_ms: number
  event_type: GameEventType
  task_id: string | null
  data: GameEventData
}

/** What a game passes to GameAdapter.sendGameEvent(); the adapter fills the envelope. */
export interface GameEventInput {
  event_type: GameEventType
  task_id?: string | null
  data?: GameEventData
  /** Defaults to performance.now(). Any monotonic game clock works. */
  client_ts_ms?: number
  /** Defaults to a random UUID. Supply your own to make retries idempotent. */
  event_id?: string
}

// --- WebSocket control ---------------------------------------------------------------

export interface HelloMessage {
  type: 'hello'
  schema_version: SchemaVersion
  role: 'producer' | 'consumer'
  client_id: string
  token: string
  resume_after_event_seq?: number | null
}

export interface PingMessage {
  type: 'ping'
  nonce?: string | null
}

// --- Service -> clients --------------------------------------------------------------

export type AttentionState =
  | 'CALIBRATING'
  | 'TRACKING_UNAVAILABLE'
  | 'HEAD_TOWARD_SCREEN'
  | 'HEAD_AWAY'
  | 'UNKNOWN'

export interface VisionState {
  fresh: boolean
  simulated: boolean
  observation_age_ms: number | null
  producer_id: string | null
  tracking_status: TrackingStatus | null
  tracking_valid: boolean
  tracking_quality: UnitMeasurement
  calibration_status: CalibrationStatus | null
  head_yaw_deg: AngleMeasurement
  head_pitch_deg: AngleMeasurement
  head_roll_deg: AngleMeasurement
  head_facing_score: UnitMeasurement
  head_away_ms: DurationMeasurement
  eye_openness_left: RatioMeasurement
  eye_openness_right: RatioMeasurement
  eyes_closed: BoolMeasurement
  eyes_closed_ms: DurationMeasurement
  processed_fps: number | null
  inference_ms: number | null
}

export interface GameplayState {
  paused: boolean
  expected_idle: boolean
  current_task_id: string | null
  inactivity_ms: DurationMeasurement
  tasks_completed: number
  answers_total: number
  recent_accuracy: UnitMeasurement
  recent_response_ms_median: DurationMeasurement
}

export interface EngagementScore extends UnitMeasurement {
  components: Record<string, number | null>
}

export interface PolicyState {
  vision_adaptation: 'active' | 'held' | 'disabled'
  vision_hold_reason: Reason | null
  hold_new_instructions: boolean
  hold_reason: Reason | null
}

export interface DerivedState {
  attention_state: AttentionState
  attention_reason: Reason
  vision: VisionState
  gameplay: GameplayState
  task_engagement_score: EngagementScore
  policy: PolicyState
}

export interface StateMessage {
  type: 'state'
  schema_version: SchemaVersion
  session_id: string
  state_seq: number
  server_ts_ms: number
  state: DerivedState
}

export interface GestureEventMessage {
  type: 'gesture'
  schema_version: SchemaVersion
  session_id: string
  event_seq: number
  producer_id: string
  server_receipt_ts_ms: number
  gesture: Gesture
}

export type ActionType = 'delay_instruction' | 'gentle_cue' | 'offer_hint' | 'increase_difficulty'

export interface SuggestedActionMessage {
  type: 'suggested_action'
  schema_version: SchemaVersion
  session_id: string
  event_seq: number
  action_id: string
  action: ActionType
  source: 'vision' | 'gameplay' | 'vision+gameplay'
  task_id: string | null
  reason: string
  evidence: Record<string, number | string | boolean | null>
  server_ts_ms: number
  expires_in_ms: number
}

export interface AckMessage {
  type: 'ack'
  kind: 'observation' | 'game_event'
  seq: number
  status: 'accepted' | 'duplicate'
  id: string | null
}

export interface ErrorMessage {
  type: 'error'
  code: Reason
  message: string
  seq: number | null
}

export interface WelcomeMessage {
  type: 'welcome'
  schema_version: SchemaVersion
  session_id: string
  role: 'producer' | 'consumer'
  heartbeat_interval_ms: number
  last_event_seq: number
}

export interface HeartbeatMessage {
  type: 'heartbeat'
  server_ts_ms: number
}

export interface PongMessage {
  type: 'pong'
  nonce: string | null
}

export type ServerMessage =
  | StateMessage
  | GestureEventMessage
  | SuggestedActionMessage
  | AckMessage
  | ErrorMessage
  | WelcomeMessage
  | HeartbeatMessage
  | PongMessage

// --- HTTP ----------------------------------------------------------------------------

export interface CreateSessionRequest {
  label?: string | null
  policy_overrides?: Record<string, number> | null
}

export interface CreateSessionResponse {
  schema_version: SchemaVersion
  session_id: string
  producer_token: string
  consumer_token: string
  endpoints: { observations: string; game_events: string; state: string; stream: string }
  idle_ttl_s: number
  limits: Record<string, number>
  policy: Record<string, number>
}

export interface IngestResponse {
  status: 'accepted' | 'duplicate'
  seq: number
  state_seq: number
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

/** WebSocket close codes used by the service. */
export const CloseCode = {
  SESSION_CLOSED: 4000,
  UNAUTHORIZED: 4401,
  FORBIDDEN_ORIGIN: 4403,
  SESSION_NOT_FOUND: 4404,
  HELLO_TIMEOUT: 4408,
  TOO_SLOW: 4409,
  POLICY: 1008,
  TOO_BIG: 1009
} as const
