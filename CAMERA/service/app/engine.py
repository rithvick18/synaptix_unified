"""Per-session engine: ordering/dedup, derived state, and the deterministic policy.

Three layers are kept apart:

1. Raw observations (``ObservationMessage``) as received from the producer.
2. Derived state (``DerivedState``): freshness, validity gating, attention state, gameplay
   aggregates and the optional engagement heuristic.
3. Suggested actions (``SuggestedActionMessage``): deterministic rules over (2), with
   reasons, evidence and cooldowns.

Clocks. ``now`` is always the server's monotonic clock in seconds and is used for
freshness, inactivity and cooldowns. Producer durations (head-away, eye closure) are
computed by the producer on its own monotonic clock and used as durations. Game response
times are computed from the game's own clock. Client and server timestamps are never
subtracted from each other.

This module performs no I/O and is fully deterministic given its inputs.
"""

from __future__ import annotations

import statistics
import uuid
from collections import OrderedDict, deque
from dataclasses import dataclass, field
from typing import Callable, Literal

from .config import PolicyConfig
from .schemas import (
    AngleMeasurement,
    BoolMeasurement,
    DerivedState,
    DurationMeasurement,
    EngagementScore,
    GameEventMessage,
    GameplayState,
    GestureEventMessage,
    ObservationMessage,
    PolicyState,
    RatioMeasurement,
    SuggestedActionMessage,
    UnitMeasurement,
    VisionState,
)

IngestStatus = Literal["accepted", "duplicate"]
RECENT_SEQ_MEMORY = 512
SEEN_ID_MEMORY = 4096
EVENT_BUFFER = 256


class IngestError(Exception):
    """A message that is well-formed but must be rejected (ordering, conflicts)."""

    def __init__(self, code: str, message: str, http_status: int = 409) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class _BoundedSet:
    """Insertion-ordered set that forgets the oldest entries beyond ``capacity``."""

    def __init__(self, capacity: int) -> None:
        self._items: OrderedDict[object, None] = OrderedDict()
        self._capacity = capacity

    def __contains__(self, item: object) -> bool:
        return item in self._items

    def add(self, item: object) -> None:
        self._items[item] = None
        self._items.move_to_end(item)
        while len(self._items) > self._capacity:
            self._items.popitem(last=False)


@dataclass
class _Answer:
    task_id: str
    correct: bool
    response_ms: float | None


@dataclass
class _Task:
    task_id: str
    source_id: str
    started_client_ts: float
    mark_client_ts: float  # response times are measured from here (start or last answer)
    paused_client_ms_since_mark: float = 0.0
    errors: int = 0
    answers: int = 0
    hints: int = 0
    cues_offered: int = 0
    hints_offered: int = 0
    outcome: str | None = None


@dataclass
class _Producer:
    producer_id: str
    last_seq: int = -1
    last_capture_ts: float = -1.0
    recent_seqs: _BoundedSet = field(default_factory=lambda: _BoundedSet(RECENT_SEQ_MEMORY))


@dataclass
class _Source:
    last_seq: int = -1
    paused_at_client_ts: float | None = None


@dataclass
class _BufferedEvent:
    event_seq: int
    expires_at: float
    message: GestureEventMessage | SuggestedActionMessage


def _median(values: list[float]) -> float | None:
    return statistics.median(values) if values else None


class SessionEngine:
    def __init__(
        self,
        session_id: str,
        config: PolicyConfig,
        wall_ms: Callable[[], float],
    ) -> None:
        self.session_id = session_id
        self.config = config
        self._wall_ms = wall_ms

        # Producer / vision
        self._producer: _Producer | None = None
        self._last_obs: ObservationMessage | None = None
        self._last_obs_receipt: float | None = None
        self._seen_gestures = _BoundedSet(SEEN_ID_MEMORY)
        self.suppressed_gestures = 0
        # (server_now, active_s, valid_s, toward_s) per interval of active gameplay.
        self._vision_intervals: deque[tuple[float, float, float, float]] = deque(maxlen=4096)

        # Game
        self._sources: dict[str, _Source] = {}
        self._seen_events = _BoundedSet(SEEN_ID_MEMORY)
        self._tasks: OrderedDict[str, _Task] = OrderedDict()
        self._current_task_id: str | None = None
        self._answers: deque[_Answer] = deque(maxlen=100)
        self._completed: deque[_Task] = deque(maxlen=100)
        self._paused = False
        self._expected_idle = False
        self._suspended_since: float | None = None
        self._last_input: float | None = None
        self.vision_adaptation_enabled = True

        # Policy memory
        self._last_action_at: dict[str, float] = {}
        self._delay_episode: int | None = None  # head-away episode that got a delay
        self._hold_started: float | None = None
        self._hold_episode: int | None = None
        self._tasks_since_difficulty = 0

        # Output
        self._event_seq = 0
        self._events: deque[_BufferedEvent] = deque(maxlen=EVENT_BUFFER)
        self.state_seq = 0
        self._last_state_fingerprint: str | None = None
        self._last_state: DerivedState | None = None

    # ------------------------------------------------------------------------------------
    # Ingestion
    # ------------------------------------------------------------------------------------

    def ingest_observation(
        self, obs: ObservationMessage, now: float
    ) -> tuple[IngestStatus, list[GestureEventMessage]]:
        if obs.session_id != self.session_id:
            raise IngestError("session_mismatch", "session_id does not match", 400)

        producer = self._producer
        if producer is None or producer.producer_id != obs.producer_id:
            if producer is not None and self._last_obs_receipt is not None:
                silent_ms = (now - self._last_obs_receipt) * 1000
                if silent_ms < self.config.producer_takeover_after_ms:
                    raise IngestError(
                        "producer_conflict",
                        "another producer is active on this session",
                    )
            producer = _Producer(obs.producer_id)
            self._producer = producer
            self._last_obs = None
            self._last_obs_receipt = None

        if obs.seq in producer.recent_seqs:
            return "duplicate", []
        if obs.seq <= producer.last_seq:
            raise IngestError("out_of_order", f"seq {obs.seq} <= last {producer.last_seq}")
        if obs.capture_ts_ms < producer.last_capture_ts:
            raise IngestError("out_of_order", "capture_ts_ms went backwards")

        self._accumulate_vision(obs, now)

        producer.recent_seqs.add(obs.seq)
        producer.last_seq = obs.seq
        producer.last_capture_ts = obs.capture_ts_ms
        self._last_obs = obs
        self._last_obs_receipt = now

        out: list[GestureEventMessage] = []
        # Defence in depth: the producer already suppresses gestures while calibrating,
        # during tracking loss and recovery, but the service does not trust that.
        gestures_allowed = obs.tracking.valid and obs.calibration.status == "calibrated"
        for gesture in obs.gestures:
            if gesture.gesture_id in self._seen_gestures:
                continue
            self._seen_gestures.add(gesture.gesture_id)
            too_old = obs.capture_ts_ms - gesture.end_ts_ms > self.config.gesture_max_age_ms
            if not gestures_allowed or too_old:
                self.suppressed_gestures += 1
                continue
            message = GestureEventMessage(
                session_id=self.session_id,
                event_seq=self._next_event_seq(),
                producer_id=obs.producer_id,
                server_receipt_ts_ms=self._wall_ms(),
                gesture=gesture,
            )
            self._buffer(message, now + self.config.gesture_max_age_ms / 1000)
            out.append(message)
        return "accepted", out

    def _accumulate_vision(self, obs: ObservationMessage, now: float) -> None:
        """Time-weight the previous observation over the interval up to this one."""
        prev = self._last_obs
        if prev is None or not self._gameplay_active():
            return
        dt_s = min(max(obs.capture_ts_ms - prev.capture_ts_ms, 0.0), 1000.0) / 1000.0
        usable = prev.tracking.valid and prev.calibration.status == "calibrated"
        toward = usable and prev.measurements.head_orientation.value == "toward"
        self._vision_intervals.append(
            (now, dt_s, dt_s if usable else 0.0, dt_s if toward else 0.0)
        )

    def ingest_game_event(self, ev: GameEventMessage, now: float) -> IngestStatus:
        if ev.session_id != self.session_id:
            raise IngestError("session_mismatch", "session_id does not match", 400)
        if ev.event_id in self._seen_events:
            return "duplicate"
        source = self._sources.setdefault(ev.source_id, _Source())
        if ev.seq <= source.last_seq:
            raise IngestError("out_of_order", f"seq {ev.seq} <= last {source.last_seq}")
        source.last_seq = ev.seq
        self._seen_events.add(ev.event_id)
        self._apply_game_event(ev, source, now)
        return "accepted"

    def _apply_game_event(self, ev: GameEventMessage, source: _Source, now: float) -> None:
        kind = ev.event_type
        task = self._tasks.get(ev.task_id) if ev.task_id else None

        if kind == "task_started":
            task = _Task(ev.task_id or "", ev.source_id, ev.client_ts_ms, ev.client_ts_ms)
            self._tasks[task.task_id] = task
            self._tasks.move_to_end(task.task_id)
            while len(self._tasks) > 200:
                self._tasks.popitem(last=False)
            self._current_task_id = task.task_id
            self._last_input = now
        elif kind == "answer_submitted":
            if task is None:
                raise IngestError("unknown_task", "answer_submitted for a task never started")
            response_ms = ev.data.response_ms
            if response_ms is None and ev.source_id == task.source_id:
                response_ms = max(
                    ev.client_ts_ms - task.mark_client_ts - task.paused_client_ms_since_mark,
                    0.0,
                )
            task.mark_client_ts = ev.client_ts_ms
            task.paused_client_ms_since_mark = 0.0
            task.answers += 1
            if not ev.data.correct:
                task.errors += 1
            self._answers.append(_Answer(task.task_id, bool(ev.data.correct), response_ms))
            self._last_input = now
        elif kind in ("hint_requested", "hint_shown"):
            if task is not None:
                task.hints += 1
            if kind == "hint_requested":
                self._last_input = now
        elif kind in ("task_completed", "task_skipped"):
            if task is not None and task.outcome is None:
                task.outcome = "skipped" if kind == "task_skipped" else (
                    ev.data.outcome or "success"
                )
                self._completed.append(task)
                self._tasks_since_difficulty += 1
            if self._current_task_id == ev.task_id:
                self._current_task_id = None
            self._last_input = now
        elif kind == "paused":
            self._paused = True
            source.paused_at_client_ts = ev.client_ts_ms
            self._update_suspension(now)
        elif kind == "resumed":
            self._paused = False
            if source.paused_at_client_ts is not None:
                paused_ms = max(ev.client_ts_ms - source.paused_at_client_ts, 0.0)
                for t in self._tasks.values():
                    if t.outcome is None and t.source_id == ev.source_id:
                        t.paused_client_ms_since_mark += paused_ms
                source.paused_at_client_ts = None
            self._update_suspension(now)
        elif kind == "expected_idle_start":
            self._expected_idle = True
            self._update_suspension(now)
        elif kind == "expected_idle_end":
            self._expected_idle = False
            self._update_suspension(now)
        elif kind == "player_activity":
            self._last_input = now
        elif kind == "adaptation_setting":
            self.vision_adaptation_enabled = bool(ev.data.vision_adaptation_enabled)

    def _update_suspension(self, now: float) -> None:
        """Freeze the inactivity clock while paused or in an expected idle period."""
        suspended = self._paused or self._expected_idle
        if suspended and self._suspended_since is None:
            self._suspended_since = now
        elif not suspended and self._suspended_since is not None:
            if self._last_input is not None:
                self._last_input += now - self._suspended_since
            self._suspended_since = None

    def _gameplay_active(self) -> bool:
        return (
            self._current_task_id is not None and not self._paused and not self._expected_idle
        )

    # ------------------------------------------------------------------------------------
    # Derived state
    # ------------------------------------------------------------------------------------

    def _inactivity_ms(self, now: float) -> float | None:
        if self._last_input is None:
            return None
        end = self._suspended_since if self._suspended_since is not None else now
        return max((end - self._last_input) * 1000, 0.0)

    def _vision_state(self, now: float) -> tuple[VisionState, str, str, bool]:
        """Returns (vision, attention_state, attention_reason, usable_for_adaptation)."""
        obs = self._last_obs
        age_ms = None if self._last_obs_receipt is None else (now - self._last_obs_receipt) * 1000

        def blank(reason: str, **extra: object) -> VisionState:
            base: dict[str, object] = dict(
                fresh=False,
                simulated=bool(obs and obs.simulated),
                observation_age_ms=age_ms,
                producer_id=self._producer.producer_id if self._producer else None,
                tracking_status=obs.tracking.status if obs else None,
                tracking_valid=False,
                tracking_quality=UnitMeasurement(reason=reason),
                calibration_status=obs.calibration.status if obs else None,
                head_yaw_deg=AngleMeasurement(reason=reason),
                head_pitch_deg=AngleMeasurement(reason=reason),
                head_roll_deg=AngleMeasurement(reason=reason),
                head_facing_score=UnitMeasurement(reason=reason),
                head_away_ms=DurationMeasurement(reason=reason),
                eye_openness_left=RatioMeasurement(reason=reason),
                eye_openness_right=RatioMeasurement(reason=reason),
                eyes_closed=BoolMeasurement(reason=reason),
                eyes_closed_ms=DurationMeasurement(reason=reason),
                processed_fps=None,
                inference_ms=None,
            )
            base.update(extra)
            return VisionState(**base)  # type: ignore[arg-type]

        if obs is None or age_ms is None:
            return blank("no_observations"), "UNKNOWN", "no_observations", False
        if age_ms > self.config.stale_after_ms:
            # Never keep a stale favourable value: every measurement is withdrawn.
            return blank("stale"), "UNKNOWN", "stale_observations", False

        m = obs.measurements
        vision = VisionState(
            fresh=True,
            simulated=obs.simulated,
            observation_age_ms=age_ms,
            producer_id=obs.producer_id,
            tracking_status=obs.tracking.status,
            tracking_valid=obs.tracking.valid,
            tracking_quality=obs.tracking.quality,
            calibration_status=obs.calibration.status,
            head_yaw_deg=m.head_yaw_deg,
            head_pitch_deg=m.head_pitch_deg,
            head_roll_deg=m.head_roll_deg,
            head_facing_score=m.head_facing_score,
            head_away_ms=m.head_away_ms,
            eye_openness_left=m.eye_openness_left,
            eye_openness_right=m.eye_openness_right,
            eyes_closed=m.eyes_closed,
            eyes_closed_ms=m.eyes_closed_ms,
            processed_fps=obs.perf.processed_fps if obs.perf else None,
            inference_ms=obs.perf.inference_ms if obs.perf else None,
        )
        cal = obs.calibration.status
        if cal == "calibrating":
            return vision, "CALIBRATING", "calibration_in_progress", False
        if not obs.tracking.valid:
            reason = obs.tracking.reason or f"tracking_{obs.tracking.status}"
            return vision, "TRACKING_UNAVAILABLE", reason, False
        if cal != "calibrated":
            return vision, "UNKNOWN", f"calibration_{cal}", False
        orientation = m.head_orientation.value
        if orientation == "toward":
            return vision, "HEAD_TOWARD_SCREEN", "head_within_neutral_range", True
        if orientation == "away":
            return vision, "HEAD_AWAY", "head_outside_neutral_range", True
        return vision, "UNKNOWN", m.head_orientation.reason or "orientation_uncertain", True

    def _gameplay_state(self, now: float) -> GameplayState:
        inactivity = self._inactivity_ms(now)
        window = list(self._answers)[-self.config.engagement_window_answers :]
        accuracy = (
            UnitMeasurement(value=sum(a.correct for a in window) / len(window))
            if window
            else UnitMeasurement(reason="no_answers")
        )
        rts = [a.response_ms for a in window if a.response_ms is not None]
        median_rt = _median(rts)
        return GameplayState(
            paused=self._paused,
            expected_idle=self._expected_idle,
            current_task_id=self._current_task_id,
            inactivity_ms=(
                DurationMeasurement(value=min(inactivity, 86_400_000))
                if inactivity is not None
                else DurationMeasurement(reason="no_gameplay_events")
            ),
            tasks_completed=len(self._completed),
            answers_total=len(self._answers),
            recent_accuracy=accuracy,
            recent_response_ms_median=(
                DurationMeasurement(value=median_rt)
                if median_rt is not None
                else DurationMeasurement(reason="no_response_times")
            ),
        )

    def _engagement(self, now: float) -> EngagementScore:
        """task_engagement_score: a documented heuristic, null until enough gameplay.

        components (each in [0,1], None when unavailable):
          accuracy     fraction correct over the last N answers
          independence fraction of the last N completed tasks finished without hints
          pace         min(1, baseline median RT / recent median RT); needs >= 5 RTs
          head_toward  share of valid-vision active-task time with head toward screen,
                       over the last engagement_vision_window_ms; needs coverage
        score = weighted mean of available components
                (accuracy 0.4, independence 0.2, pace 0.2, head_toward 0.2)
        """
        cfg = self.config
        if len(self._answers) < cfg.engagement_min_answers:
            return EngagementScore(reason="insufficient_gameplay_history")
        if len(self._completed) < cfg.engagement_min_completed_tasks:
            return EngagementScore(reason="insufficient_gameplay_history")

        window = list(self._answers)[-cfg.engagement_window_answers :]
        accuracy = sum(a.correct for a in window) / len(window)
        tasks = list(self._completed)[-cfg.engagement_window_answers :]
        independence = sum(t.hints == 0 for t in tasks) / len(tasks)

        rts = [a.response_ms for a in self._answers if a.response_ms is not None]
        pace: float | None = None
        if len(rts) >= 5:
            baseline = statistics.median(rts[:5])
            recent = statistics.median(rts[-3:])
            pace = 1.0 if recent <= 0 else min(1.0, baseline / recent)

        horizon = now - cfg.engagement_vision_window_ms / 1000
        active_s = valid_s = toward_s = 0.0
        for at, active, valid, toward in self._vision_intervals:
            if at >= horizon:
                active_s += active
                valid_s += valid
                toward_s += toward
        head_toward: float | None = None
        if active_s > 0 and valid_s / active_s >= cfg.engagement_min_vision_coverage:
            head_toward = toward_s / valid_s if valid_s > 0 else None
        if not self.vision_adaptation_enabled:
            head_toward = None

        weights = {"accuracy": 0.4, "independence": 0.2, "pace": 0.2, "head_toward": 0.2}
        components: dict[str, float | None] = {
            "accuracy": accuracy,
            "independence": independence,
            "pace": pace,
            "head_toward": head_toward,
        }
        total_w = sum(w for k, w in weights.items() if components[k] is not None)
        score = sum(weights[k] * v for k, v in components.items() if v is not None) / total_w
        return EngagementScore(value=max(0.0, min(1.0, score)), components=components)

    # ------------------------------------------------------------------------------------
    # Evaluation and policy
    # ------------------------------------------------------------------------------------

    def evaluate(
        self, now: float
    ) -> tuple[DerivedState, bool, list[SuggestedActionMessage]]:
        """Recompute state and run the policy. Returns (state, changed, new_actions)."""
        cfg = self.config
        vision, attention, attention_reason, vision_ok = self._vision_state(now)
        gameplay = self._gameplay_state(now)

        if not self.vision_adaptation_enabled:
            vision_mode, vision_hold = "disabled", "disabled_by_game"
        elif not vision_ok:
            vision_mode, vision_hold = "held", attention_reason
        else:
            vision_mode, vision_hold = "active", None

        actions: list[SuggestedActionMessage] = []
        suspended = self._paused or self._expected_idle
        away_ms = vision.head_away_ms.value if vision.head_away_ms.value is not None else 0.0
        episode = self._last_obs.measurements.head_away_episode if self._last_obs else None
        head_away = vision_mode == "active" and attention == "HEAD_AWAY"

        # --- Hold new instructions (level-triggered, capped per episode) -----------------
        hold, hold_reason = False, None
        if suspended:
            hold_reason = "game_paused" if self._paused else "expected_idle"
        elif vision_mode != "active":
            hold_reason = f"vision_{vision_mode}"
        elif head_away and away_ms >= cfg.delay_instruction_after_ms:
            if self._hold_episode != episode:
                self._hold_episode, self._hold_started = episode, now
            held_ms = (now - (self._hold_started or now)) * 1000
            if held_ms < cfg.max_instruction_hold_ms:
                hold, hold_reason = True, "sustained_head_away"
            else:
                hold_reason = "max_instruction_hold_reached"

        if not suspended:
            # --- delay_instruction ------------------------------------------------------
            if hold and self._delay_episode != episode and self._ready(
                "delay_instruction", cfg.delay_instruction_cooldown_ms, now
            ):
                self._delay_episode = episode
                actions.append(
                    self._action(
                        "delay_instruction",
                        "vision",
                        now,
                        "Head has been turned away from the screen for a sustained period; "
                        "consider delaying the next new instruction until the player looks back.",
                        {
                            "head_away_ms": round(away_ms),
                            "threshold_ms": cfg.delay_instruction_after_ms,
                            "head_facing_score": vision.head_facing_score.value,
                            "tracking_quality": vision.tracking_quality.value,
                            "max_delay_ms": cfg.max_instruction_hold_ms,
                        },
                        expires_in_ms=cfg.max_instruction_hold_ms,
                    )
                )

            # --- gentle_cue -------------------------------------------------------------
            task = self._tasks.get(self._current_task_id) if self._current_task_id else None
            inactivity = self._inactivity_ms(now)
            if (
                task is not None
                and head_away
                and away_ms >= cfg.cue_head_away_ms
                and inactivity is not None
                and inactivity >= cfg.cue_inactivity_ms
                and task.cues_offered < cfg.cue_max_per_task
                and self._ready("gentle_cue", cfg.cue_cooldown_ms, now)
            ):
                task.cues_offered += 1
                actions.append(
                    self._action(
                        "gentle_cue",
                        "vision+gameplay",
                        now,
                        "Head turned away and no gameplay input for a sustained period; "
                        "consider one gentle, non-judgemental cue.",
                        {
                            "head_away_ms": round(away_ms),
                            "head_away_threshold_ms": cfg.cue_head_away_ms,
                            "inactivity_ms": round(inactivity),
                            "inactivity_threshold_ms": cfg.cue_inactivity_ms,
                            "tracking_quality": vision.tracking_quality.value,
                        },
                        task_id=task.task_id,
                    )
                )

            # --- offer_hint (performance only; independent of vision) -------------------
            hint = self._hint_evidence(task)
            if hint is not None and task is not None and self._ready(
                "offer_hint", cfg.hint_cooldown_ms, now
            ):
                task.hints_offered += 1
                actions.append(
                    self._action(
                        "offer_hint",
                        "gameplay",
                        now,
                        "Repeated errors with slowing responses on recent answers; "
                        "consider offering a hint.",
                        hint,
                        task_id=task.task_id,
                    )
                )

            # --- increase_difficulty (performance only) ---------------------------------
            diff = self._difficulty_evidence()
            if diff is not None and self._ready(
                "increase_difficulty", cfg.difficulty_cooldown_ms, now
            ):
                self._tasks_since_difficulty = 0
                actions.append(
                    self._action(
                        "increase_difficulty",
                        "gameplay",
                        now,
                        "Sustained successful performance without hints or slowing; "
                        "consider a small difficulty increase.",
                        diff,
                    )
                )

        state = DerivedState(
            attention_state=attention,  # type: ignore[arg-type]
            attention_reason=attention_reason,
            vision=vision,
            gameplay=gameplay,
            task_engagement_score=self._engagement(now),
            policy=PolicyState(
                vision_adaptation=vision_mode,  # type: ignore[arg-type]
                vision_hold_reason=vision_hold,
                hold_new_instructions=hold,
                hold_reason=hold_reason,
            ),
        )
        fingerprint = state.model_dump_json(
            exclude={"vision": {"observation_age_ms"}, "gameplay": {"inactivity_ms"}}
        )
        changed = fingerprint != self._last_state_fingerprint
        if changed:
            self._last_state_fingerprint = fingerprint
            self.state_seq += 1
        self._last_state = state
        return state, changed, actions

    def _ready(self, action: str, cooldown_ms: float, now: float) -> bool:
        last = self._last_action_at.get(action)
        return last is None or (now - last) * 1000 >= cooldown_ms

    def _hint_evidence(self, task: _Task | None) -> dict[str, float | int | None] | None:
        cfg = self.config
        if task is None or task.errors == 0 or task.hints_offered >= cfg.hint_max_per_task:
            return None
        window = list(self._answers)[-cfg.hint_error_window :]
        errors = sum(not a.correct for a in window)
        if errors < cfg.hint_min_errors:
            return None
        rts = [a.response_ms for a in window if a.response_ms is not None]
        if len(rts) < cfg.hint_min_prior_answers + 1:
            return None
        latest, prior = rts[-1], rts[:-1]
        prior_median = statistics.median(prior)
        if prior_median <= 0 or latest < cfg.hint_slowdown_ratio * prior_median:
            return None
        return {
            "errors_in_window": errors,
            "window_answers": len(window),
            "task_errors": task.errors,
            "latest_response_ms": round(latest),
            "prior_median_response_ms": round(prior_median),
            "slowdown_ratio": round(latest / prior_median, 3),
            "slowdown_threshold": cfg.hint_slowdown_ratio,
        }

    def _difficulty_evidence(self) -> dict[str, float | int | None] | None:
        cfg = self.config
        n = cfg.difficulty_success_streak
        if self._tasks_since_difficulty < n or len(self._completed) < n:
            return None
        recent = list(self._completed)[-n:]
        if any(t.outcome != "success" or t.errors or t.hints for t in recent):
            return None
        ids = {t.task_id for t in recent}
        rts = [a.response_ms for a in self._answers if a.task_id in ids and a.response_ms]
        if len(rts) < n:
            return None
        overall, last3 = statistics.median(rts), statistics.median(rts[-3:])
        if last3 > overall * cfg.difficulty_slowdown_tolerance:
            return None
        return {
            "success_streak": n,
            "median_response_ms": round(overall),
            "recent_median_response_ms": round(last3),
            "magnitude": "small",
        }

    def _action(
        self,
        action: str,
        source: str,
        now: float,
        reason: str,
        evidence: dict,
        task_id: str | None = None,
        expires_in_ms: float | None = None,
    ) -> SuggestedActionMessage:
        self._last_action_at[action] = now
        ttl = expires_in_ms if expires_in_ms is not None else self.config.action_ttl_ms
        message = SuggestedActionMessage(
            session_id=self.session_id,
            event_seq=self._next_event_seq(),
            action_id=uuid.uuid4().hex,
            action=action,  # type: ignore[arg-type]
            source=source,  # type: ignore[arg-type]
            task_id=task_id,
            reason=reason,
            evidence=evidence,
            server_ts_ms=self._wall_ms(),
            expires_in_ms=ttl,
        )
        self._buffer(message, now + ttl / 1000)
        return message

    # ------------------------------------------------------------------------------------
    # Event buffer (replay on consumer reconnect)
    # ------------------------------------------------------------------------------------

    def _next_event_seq(self) -> int:
        self._event_seq += 1
        return self._event_seq

    @property
    def last_event_seq(self) -> int:
        return self._event_seq

    def _buffer(self, message: GestureEventMessage | SuggestedActionMessage, expires_at: float) -> None:
        self._events.append(_BufferedEvent(message.event_seq, expires_at, message))

    def replay_after(
        self, event_seq: int, now: float
    ) -> list[GestureEventMessage | SuggestedActionMessage]:
        return [
            e.message for e in self._events if e.event_seq > event_seq and e.expires_at > now
        ]
