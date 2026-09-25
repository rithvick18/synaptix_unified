"""Wire schemas (schema_version 1.0). Mirrored by web/src/protocol/types.ts.

Conventions
-----------
* Every measurement is ``{"value": <number|null>, "reason": <code|null>}``. Exactly one of
  the two is non-null: an unavailable measurement is ``null`` with a reason, never ``0``.
* Timestamps named ``*_ts_ms`` from a client are that client's monotonic clock
  (``performance.now()``-style). They are only ever subtracted from timestamps of the same
  client. ``server_*`` timestamps are wall-clock epoch ms and are informational; freshness
  is computed with the server's own monotonic clock.
* Non-finite floats (NaN, ±Infinity) and unknown fields are rejected everywhere.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, model_validator

from . import SCHEMA_VERSION

ID_PATTERN = r"^[A-Za-z0-9_.:-]{1,128}$"
REASON_PATTERN = r"^[a-z0-9_]{1,64}$"
MAX_TS_MS = 1e13  # generous bound for monotonic clocks; rejects absurd values

Id = Annotated[str, Field(pattern=ID_PATTERN)]
Reason = Annotated[str, Field(pattern=REASON_PATTERN)]
SchemaVersion = Literal["1.0"]
Seq = Annotated[int, Field(ge=0, le=2**53 - 1)]
ClientTs = Annotated[float, Field(ge=0, le=MAX_TS_MS)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_max_length=512)


# ---------------------------------------------------------------------------------------
# Measurements
# ---------------------------------------------------------------------------------------


class _Measurement(Strict):
    reason: Reason | None = None

    @model_validator(mode="after")
    def _exactly_one(self) -> "_Measurement":
        value = getattr(self, "value")
        if (value is None) == (self.reason is None):
            raise ValueError("exactly one of value and reason must be non-null")
        return self


class AngleMeasurement(_Measurement):
    value: Annotated[float, Field(ge=-180, le=180)] | None = None


class UnitMeasurement(_Measurement):
    value: Annotated[float, Field(ge=0, le=1)] | None = None


class RatioMeasurement(_Measurement):
    value: Annotated[float, Field(ge=0, le=5)] | None = None


class DurationMeasurement(_Measurement):
    value: Annotated[float, Field(ge=0, le=86_400_000)] | None = None


class BoolMeasurement(_Measurement):
    value: bool | None = None


HeadOrientation = Literal["toward", "away", "uncertain"]


class OrientationMeasurement(_Measurement):
    value: HeadOrientation | None = None


def unavailable(cls: type[_Measurement], reason: str) -> Any:
    return cls(value=None, reason=reason)


# ---------------------------------------------------------------------------------------
# Producer -> service
# ---------------------------------------------------------------------------------------

TrackingStatus = Literal[
    "not_started",  # camera/model not running yet
    "tracking",  # locked face, quality acceptable
    "recovering",  # face re-acquired; waiting out the recovery window
    "no_face",
    "multiple_faces",  # more than one face and the locked face is ambiguous
    "low_quality",
    "lost",  # locked face gone beyond the re-lock grace; recalibration required
    "suspended",  # tab hidden or producer paused; no inference running
    "error",
]
CalibrationStatus = Literal["uncalibrated", "calibrating", "calibrated", "failed", "required"]


class TrackingInfo(Strict):
    status: TrackingStatus
    valid: bool
    reason: Reason | None = None
    face_count: int = Field(ge=0, le=16)
    multiple_faces_visible: bool
    quality: UnitMeasurement

    @model_validator(mode="after")
    def _consistent(self) -> "TrackingInfo":
        if self.valid and self.status != "tracking":
            raise ValueError("tracking.valid requires status 'tracking'")
        if self.valid and self.quality.value is None:
            raise ValueError("tracking.valid requires a quality value")
        return self


class CalibrationInfo(Strict):
    status: CalibrationStatus
    reason: Reason | None = None
    progress: Annotated[float, Field(ge=0, le=1)] | None = None


class VisionMeasurements(Strict):
    # Head orientation relative to the calibrated neutral pose. Conventions (player's own
    # perspective, independent of preview mirroring): yaw > 0 = head turned to the
    # player's right; pitch > 0 = chin up; roll > 0 = head tilted toward right shoulder.
    head_yaw_deg: AngleMeasurement
    head_pitch_deg: AngleMeasurement
    head_roll_deg: AngleMeasurement
    # Heuristic in [0,1]: 1 = head at the calibrated neutral pose. NOT eye gaze.
    head_facing_score: UnitMeasurement
    head_orientation: OrientationMeasurement
    # Sustained head-away duration on the producer's clock; 0 when oriented toward.
    head_away_ms: DurationMeasurement
    head_away_episode: int | None = Field(default=None, ge=0, le=2**31)
    # Eye aspect ratio relative to the calibrated open-eye value (1 ~ as calibrated).
    eye_openness_left: RatioMeasurement
    eye_openness_right: RatioMeasurement
    # Raw MediaPipe blendshape coefficients (NOT calibrated probabilities).
    eye_blink_coefficient_left: UnitMeasurement
    eye_blink_coefficient_right: UnitMeasurement
    eyes_closed: BoolMeasurement
    eyes_closed_ms: DurationMeasurement


GestureType = Literal["blink", "nod", "head_shake"]


class Gesture(Strict):
    gesture_id: Id
    type: GestureType
    start_ts_ms: ClientTs
    end_ts_ms: ClientTs
    amplitude_deg: Annotated[float, Field(ge=0, le=180)] | None = None
    swings: int | None = Field(default=None, ge=0, le=20)

    @model_validator(mode="after")
    def _ordered(self) -> "Gesture":
        if self.end_ts_ms < self.start_ts_ms:
            raise ValueError("end_ts_ms before start_ts_ms")
        return self


class PerfInfo(Strict):
    backend: Literal["worker", "main_thread"]
    delegate: Literal["GPU", "CPU"] | None = None
    inference_ms: Annotated[float, Field(ge=0, le=60_000)] | None = None
    processed_fps: Annotated[float, Field(ge=0, le=1000)] | None = None
    dropped_frames: int = Field(ge=0, le=2**31)


class ObservationMessage(Strict):
    type: Literal["observation"]
    schema_version: SchemaVersion
    session_id: Id
    producer_id: Id
    seq: Seq
    capture_ts_ms: ClientTs
    tracking: TrackingInfo
    calibration: CalibrationInfo
    measurements: VisionMeasurements
    gestures: list[Gesture] = Field(default_factory=list, max_length=16)
    perf: PerfInfo | None = None
    # True only for the demo's explicitly started simulation mode. Never set implicitly.
    simulated: bool = False


# ---------------------------------------------------------------------------------------
# Game -> service
# ---------------------------------------------------------------------------------------

GameEventType = Literal[
    "task_started",
    "answer_submitted",
    "hint_requested",
    "hint_shown",
    "task_completed",
    "task_skipped",
    "paused",
    "resumed",
    "player_activity",
    "expected_idle_start",
    "expected_idle_end",
    "adaptation_setting",
]
TASK_EVENTS = {
    "task_started",
    "answer_submitted",
    "hint_requested",
    "hint_shown",
    "task_completed",
    "task_skipped",
}
TaskOutcome = Literal["success", "success_with_help", "failed", "revealed"]


class GameEventData(Strict):
    correct: bool | None = None
    # Paused-time-excluded response time measured by the game, if it has one.
    response_ms: Annotated[float, Field(ge=0, le=3_600_000)] | None = None
    hint_level: int | None = Field(default=None, ge=0, le=100)
    outcome: TaskOutcome | None = None
    difficulty: Annotated[str, Field(max_length=64)] | None = None
    activity: Annotated[str, Field(pattern=REASON_PATTERN)] | None = None
    vision_adaptation_enabled: bool | None = None


class GameEventMessage(Strict):
    type: Literal["game_event"]
    schema_version: SchemaVersion
    session_id: Id
    source_id: Id
    seq: Seq
    event_id: Id
    client_ts_ms: ClientTs
    event_type: GameEventType
    task_id: Id | None = None
    data: GameEventData = Field(default_factory=GameEventData)

    @model_validator(mode="after")
    def _required_fields(self) -> "GameEventMessage":
        if self.event_type in TASK_EVENTS and self.task_id is None:
            raise ValueError(f"{self.event_type} requires task_id")
        if self.event_type == "answer_submitted" and self.data.correct is None:
            raise ValueError("answer_submitted requires data.correct")
        if (
            self.event_type == "adaptation_setting"
            and self.data.vision_adaptation_enabled is None
        ):
            raise ValueError("adaptation_setting requires data.vision_adaptation_enabled")
        return self


# ---------------------------------------------------------------------------------------
# WebSocket control messages
# ---------------------------------------------------------------------------------------


class HelloMessage(Strict):
    type: Literal["hello"]
    schema_version: SchemaVersion
    role: Literal["producer", "consumer"]
    client_id: Id
    token: Annotated[str, Field(min_length=16, max_length=256)]
    # Consumer only: replay buffered gestures/actions with event_seq greater than this.
    resume_after_event_seq: Seq | None = None


class PingMessage(Strict):
    type: Literal["ping"]
    nonce: Annotated[str, Field(max_length=64)] | None = None


# ---------------------------------------------------------------------------------------
# Service -> clients
# ---------------------------------------------------------------------------------------

AttentionState = Literal[
    "CALIBRATING", "TRACKING_UNAVAILABLE", "HEAD_TOWARD_SCREEN", "HEAD_AWAY", "UNKNOWN"
]


class VisionState(Strict):
    fresh: bool
    simulated: bool
    observation_age_ms: Annotated[float, Field(ge=0)] | None
    producer_id: Id | None
    tracking_status: TrackingStatus | None
    tracking_valid: bool
    tracking_quality: UnitMeasurement
    calibration_status: CalibrationStatus | None
    head_yaw_deg: AngleMeasurement
    head_pitch_deg: AngleMeasurement
    head_roll_deg: AngleMeasurement
    head_facing_score: UnitMeasurement
    head_away_ms: DurationMeasurement
    eye_openness_left: RatioMeasurement
    eye_openness_right: RatioMeasurement
    eyes_closed: BoolMeasurement
    eyes_closed_ms: DurationMeasurement
    processed_fps: Annotated[float, Field(ge=0)] | None
    inference_ms: Annotated[float, Field(ge=0)] | None


class GameplayState(Strict):
    paused: bool
    expected_idle: bool
    current_task_id: Id | None
    inactivity_ms: DurationMeasurement
    tasks_completed: int
    answers_total: int
    recent_accuracy: UnitMeasurement
    recent_response_ms_median: DurationMeasurement


class EngagementScore(UnitMeasurement):
    """Heuristic only. See README 'task_engagement_score'."""

    components: dict[str, float | None] = Field(default_factory=dict)


class PolicyState(Strict):
    vision_adaptation: Literal["active", "held", "disabled"]
    vision_hold_reason: Reason | None
    hold_new_instructions: bool
    hold_reason: Reason | None


class DerivedState(Strict):
    attention_state: AttentionState
    attention_reason: Reason
    vision: VisionState
    gameplay: GameplayState
    task_engagement_score: EngagementScore
    policy: PolicyState


class StateMessage(Strict):
    type: Literal["state"] = "state"
    schema_version: SchemaVersion = SCHEMA_VERSION
    session_id: Id
    state_seq: int
    server_ts_ms: float
    state: DerivedState


class GestureEventMessage(Strict):
    type: Literal["gesture"] = "gesture"
    schema_version: SchemaVersion = SCHEMA_VERSION
    session_id: Id
    event_seq: int
    producer_id: Id
    server_receipt_ts_ms: float
    gesture: Gesture


ActionType = Literal["delay_instruction", "gentle_cue", "offer_hint", "increase_difficulty"]
EvidenceValue = Union[float, int, str, bool, None]


class SuggestedActionMessage(Strict):
    type: Literal["suggested_action"] = "suggested_action"
    schema_version: SchemaVersion = SCHEMA_VERSION
    session_id: Id
    event_seq: int
    action_id: Id
    action: ActionType
    source: Literal["vision", "gameplay", "vision+gameplay"]
    task_id: Id | None
    reason: str
    evidence: dict[str, EvidenceValue]
    server_ts_ms: float
    expires_in_ms: float


class AckMessage(Strict):
    type: Literal["ack"] = "ack"
    kind: Literal["observation", "game_event"]
    seq: int
    status: Literal["accepted", "duplicate"]
    id: str | None = None


class ErrorMessage(Strict):
    type: Literal["error"] = "error"
    code: Reason
    message: str
    seq: int | None = None


class WelcomeMessage(Strict):
    type: Literal["welcome"] = "welcome"
    schema_version: SchemaVersion = SCHEMA_VERSION
    session_id: Id
    role: Literal["producer", "consumer"]
    heartbeat_interval_ms: float
    last_event_seq: int


class HeartbeatMessage(Strict):
    type: Literal["heartbeat"] = "heartbeat"
    server_ts_ms: float


class PongMessage(Strict):
    type: Literal["pong"] = "pong"
    nonce: str | None = None


# ---------------------------------------------------------------------------------------
# HTTP bodies
# ---------------------------------------------------------------------------------------


class CreateSessionRequest(Strict):
    label: Annotated[str, Field(max_length=64)] | None = None
    policy_overrides: dict[str, float | int] | None = None


class SessionEndpoints(Strict):
    observations: str
    game_events: str
    state: str
    stream: str


class CreateSessionResponse(Strict):
    schema_version: SchemaVersion = SCHEMA_VERSION
    session_id: Id
    producer_token: str
    consumer_token: str
    endpoints: SessionEndpoints
    idle_ttl_s: float
    limits: dict[str, float | int]
    policy: dict[str, float | int]


class IngestResponse(Strict):
    status: Literal["accepted", "duplicate"]
    seq: int
    state_seq: int
