/**
 * Schema translation: the camera app's outputs → the game-facing `CameraSnapshot`.
 *
 * Pure functions of their inputs, no clocks read, no I/O, so they are checked headlessly
 * (tools/checks/camera.check.ts). Every value is copied, never invented: a measurement the
 * camera app marked unavailable arrives here with its reason intact.
 */

import type { AdapterState, GestureEventMessage, ObserverStatus, PerfInfo, ProcessorStatus, SuggestedActionMessage } from './app'
import type {
  CameraErrorCode,
  CameraGesture,
  CameraPhase,
  CameraSnapshot,
  CameraSuggestion,
  LocalCamera,
  Measured
} from './types'

const copy = <T>(m: { value: T | null; reason: string | null }): Measured<T> => ({ value: m.value, reason: m.reason })

export interface SnapshotInputs {
  at: number
  /** Null before a session exists. */
  sessionId: string | null
  adapter: AdapterState | null
  /** Reason from the latest GameAdapter connection-status event. */
  serviceReason: string | null
  observer: ObserverStatus | null
  processor: ProcessorStatus | null
  perf: PerfInfo | null
  adaptationEnabled: boolean
  /** A lifecycle step in progress that the other inputs cannot show (e.g. creating the session). */
  pending: 'connecting' | 'starting_camera' | null
  error: { code: CameraErrorCode; message: string } | null
}

export function localCamera(observer: ObserverStatus | null, processor: ProcessorStatus | null, perf: PerfInfo | null): LocalCamera {
  const running = observer?.kind === 'running' || observer?.kind === 'suspended'
  return {
    running,
    suspended: observer?.kind === 'suspended',
    backend: running ? (perf?.backend ?? null) : null,
    delegate: running ? (perf?.delegate ?? null) : null,
    processedFps: running ? (perf?.processed_fps ?? null) : null,
    inferenceMs: running ? (perf?.inference_ms ?? null) : null,
    droppedFrames: perf?.dropped_frames ?? 0,
    tracking: running && processor ? processor.tracking : 'unknown',
    calibration: running && processor ? processor.calibration : 'unknown',
    calibrationProgress: running && processor ? processor.calibrationProgress : null,
    calibrationReason: running && processor ? processor.calibrationReason : null
  }
}

function phaseOf(i: SnapshotInputs, camera: LocalCamera): CameraPhase {
  if (i.error) return 'error'
  if (i.pending) return i.pending
  if (!i.sessionId) return 'off'
  const kind = i.observer?.kind
  if (kind === 'starting') return 'loading_model'
  if (!camera.running) return 'off'
  if (camera.calibration === 'calibrating') return 'calibrating'
  if (camera.calibration === 'calibrated') return 'ready'
  return 'needs_calibration'
}

/**
 * Why vision may not drive adaptation right now, or null when it may. Checked in order,
 * so the first failing condition is the one reported.
 */
export function visionBlockedReason(s: Omit<CameraSnapshot, 'visionUsable' | 'visionBlockedReason'>): string | null {
  if (!s.adaptationEnabled) return 'adaptation_disabled'
  if (s.service.status !== 'open') return `service_${s.service.status}`
  if (s.service.stale || !s.vision || !s.policy) return 'state_stale'
  if (!s.camera.running) return 'camera_off'
  if (s.camera.suspended) return 'camera_suspended'
  if (!s.vision.fresh) return 'vision_stale'
  if (s.vision.calibration !== 'calibrated' || s.camera.calibration !== 'calibrated') return 'not_calibrated'
  if (!s.vision.trackingValid) return `tracking_${s.vision.trackingStatus ?? 'unknown'}`
  if (s.policy.visionAdaptation !== 'active') return `service_vision_${s.policy.visionAdaptation}:${s.policy.visionHoldReason ?? ''}`
  return null
}

export function buildSnapshot(i: SnapshotInputs): CameraSnapshot {
  const camera = localCamera(i.observer, i.processor, i.perf)
  const a = i.adapter
  const d = a && !a.stale ? a.state : null
  const base: Omit<CameraSnapshot, 'visionUsable' | 'visionBlockedReason'> = {
    at: i.at,
    phase: phaseOf(i, camera),
    error: i.error,
    service: {
      status: a ? a.connection : 'offline',
      stale: a ? a.stale : true,
      reason: i.serviceReason,
      sessionId: i.sessionId
    },
    camera,
    vision: d
      ? {
          fresh: d.vision.fresh,
          simulated: d.vision.simulated,
          observationAgeMs: d.vision.observation_age_ms,
          attention: d.attention_state,
          attentionReason: d.attention_reason,
          trackingValid: d.vision.tracking_valid,
          trackingStatus: d.vision.tracking_status,
          trackingQuality: copy(d.vision.tracking_quality),
          calibration: d.vision.calibration_status,
          headYawDeg: copy(d.vision.head_yaw_deg),
          headPitchDeg: copy(d.vision.head_pitch_deg),
          headRollDeg: copy(d.vision.head_roll_deg),
          headFacingScore: copy(d.vision.head_facing_score),
          headAwayMs: copy(d.vision.head_away_ms),
          eyeOpennessLeft: copy(d.vision.eye_openness_left),
          eyeOpennessRight: copy(d.vision.eye_openness_right),
          eyesClosed: copy(d.vision.eyes_closed),
          eyesClosedMs: copy(d.vision.eyes_closed_ms)
        }
      : null,
    policy: d
      ? {
          visionAdaptation: d.policy.vision_adaptation,
          visionHoldReason: d.policy.vision_hold_reason,
          holdNewInstructions: d.policy.hold_new_instructions,
          holdReason: d.policy.hold_reason
        }
      : null,
    gameplay: d
      ? {
          paused: d.gameplay.paused,
          expectedIdle: d.gameplay.expected_idle,
          currentTaskId: d.gameplay.current_task_id,
          inactivityMs: copy(d.gameplay.inactivity_ms),
          tasksCompleted: d.gameplay.tasks_completed,
          answersTotal: d.gameplay.answers_total,
          recentAccuracy: copy(d.gameplay.recent_accuracy),
          recentResponseMsMedian: copy(d.gameplay.recent_response_ms_median)
        }
      : null,
    engagement: d
      ? {
          value: d.task_engagement_score.value,
          reason: d.task_engagement_score.reason,
          components: { ...d.task_engagement_score.components }
        }
      : null,
    adaptationEnabled: i.adaptationEnabled
  }
  const blocked = visionBlockedReason(base)
  return { ...base, visionUsable: blocked === null, visionBlockedReason: blocked }
}

export function toGesture(g: GestureEventMessage, receivedAt: number): CameraGesture {
  return {
    id: g.gesture.gesture_id,
    type: g.gesture.type,
    startMs: g.gesture.start_ts_ms,
    endMs: g.gesture.end_ts_ms,
    amplitudeDeg: g.gesture.amplitude_deg,
    swings: g.gesture.swings,
    receivedAt
  }
}

export function toSuggestion(a: SuggestedActionMessage, receivedAt: number): CameraSuggestion {
  return {
    id: a.action_id,
    action: a.action,
    source: a.source,
    taskId: a.task_id,
    reason: a.reason,
    evidence: { ...a.evidence },
    receivedAt,
    expiresInMs: a.expires_in_ms
  }
}

/** ObserverStatus error codes map one-to-one onto CameraErrorCode. */
export function observerError(s: ObserverStatus): { code: CameraErrorCode; message: string } | null {
  return s.kind === 'error' ? { code: s.code, message: s.message } : null
}
