"""Engine tests: gating, staleness, ordering, and gameplay-driven policy."""

from __future__ import annotations

import pytest

from app.config import PolicyConfig
from app.engine import IngestError, SessionEngine
from app.schemas import GameEventMessage, ObservationMessage
from helpers import FakeClock, game_event, gesture, observation

SID = "s_test"


class Harness:
    """Drives one engine with a producer and a game on independent clocks."""

    def __init__(self, **policy: float) -> None:
        self.clock = FakeClock()
        self.engine = SessionEngine(SID, PolicyConfig(**policy), wall_ms=lambda: 0.0)
        self.obs_seq = 0
        self.cam_ts = 50_000.0  # producer monotonic clock: unrelated to server clock
        self.game_seq = 0
        self.game_ts = 7_000_000.0  # game monotonic clock: unrelated to both
        self.actions: list = []
        self.gestures: list = []

    def obs(self, **kw):
        self.obs_seq += 1
        msg = ObservationMessage.model_validate(
            observation(SID, self.obs_seq, self.cam_ts, **kw)
        )
        status, gestures = self.engine.ingest_observation(msg, self.clock())
        self.gestures.extend(gestures)
        return status

    def game(self, event_type: str, task_id: str | None = None, **data):
        self.game_seq += 1
        msg = GameEventMessage.model_validate(
            game_event(SID, self.game_seq, event_type, self.game_ts, task_id=task_id, **data)
        )
        status = self.engine.ingest_game_event(msg, self.clock())
        self.evaluate()
        return status

    def evaluate(self):
        state, changed, actions = self.engine.evaluate(self.clock())
        self.actions.extend(actions)
        return state

    def run_away(self, seconds: float, fps: float = 10.0, episode: int = 1, start_ms: float = 0.0):
        """Head away for `seconds`, reported at `fps`, advancing all clocks together."""
        dt = 1.0 / fps
        steps = int(round(seconds * fps))
        for i in range(1, steps + 1):
            self.clock.advance(dt)
            self.cam_ts += dt * 1000
            self.game_ts += dt * 1000
            self.obs(orientation="away", head_away_ms=start_ms + i * dt * 1000, episode=episode)
            self.evaluate()

    def run_toward(self, seconds: float, fps: float = 10.0, episode: int = 1):
        dt = 1.0 / fps
        for _ in range(int(round(seconds * fps))):
            self.clock.advance(dt)
            self.cam_ts += dt * 1000
            self.game_ts += dt * 1000
            self.obs(orientation="toward", episode=episode)
            self.evaluate()

    def kinds(self) -> list[str]:
        return [a.action for a in self.actions]


# --- Gating ---------------------------------------------------------------------------


def test_no_observations_is_unknown_with_null_measurements():
    h = Harness()
    state = h.evaluate()
    assert state.attention_state == "UNKNOWN"
    assert state.attention_reason == "no_observations"
    assert state.vision.head_facing_score.value is None
    assert state.vision.head_facing_score.reason == "no_observations"
    assert state.policy.vision_adaptation == "held"


def test_calibrating_gates_state_actions_and_gestures():
    h = Harness(delay_instruction_after_ms=0)
    h.obs(
        calibration="calibrating",
        orientation="away",
        head_away_ms=5000,
        gestures=[gesture("nod", h.cam_ts - 300, h.cam_ts - 10)],
    )
    state = h.evaluate()
    assert state.attention_state == "CALIBRATING"
    assert state.policy.vision_adaptation == "held"
    assert state.policy.hold_new_instructions is False
    assert h.actions == []
    assert h.gestures == []
    assert h.engine.suppressed_gestures == 1


def test_uncalibrated_is_unknown_and_holds_vision():
    h = Harness()
    h.obs(calibration="uncalibrated", orientation="away", head_away_ms=9000)
    state = h.evaluate()
    assert state.attention_state == "UNKNOWN"
    assert state.attention_reason == "calibration_uncalibrated"
    assert state.policy.vision_adaptation == "held"


def test_tracking_loss_and_recovery():
    h = Harness()
    h.obs(orientation="toward")
    assert h.evaluate().attention_state == "HEAD_TOWARD_SCREEN"
    h.clock.advance(0.1)
    h.cam_ts += 100
    h.obs(valid=False, status="no_face")
    state = h.evaluate()
    assert state.attention_state == "TRACKING_UNAVAILABLE"
    assert state.attention_reason == "no_face"
    assert state.vision.head_facing_score.value is None
    h.clock.advance(0.1)
    h.cam_ts += 100
    h.obs(valid=False, status="recovering")
    assert h.evaluate().attention_state == "TRACKING_UNAVAILABLE"
    h.clock.advance(0.1)
    h.cam_ts += 100
    h.obs(orientation="toward")
    assert h.evaluate().attention_state == "HEAD_TOWARD_SCREEN"


def test_stale_input_withdraws_favourable_values():
    h = Harness(stale_after_ms=1500)
    h.obs(orientation="toward")
    state = h.evaluate()
    assert state.attention_state == "HEAD_TOWARD_SCREEN"
    assert state.vision.head_facing_score.value == pytest.approx(0.95)

    h.clock.advance(1.4)
    assert h.evaluate().attention_state == "HEAD_TOWARD_SCREEN"
    h.clock.advance(0.2)  # 1.6 s on the server clock with no new observation
    state = h.evaluate()
    assert state.attention_state == "UNKNOWN"
    assert state.attention_reason == "stale_observations"
    assert state.vision.fresh is False
    assert state.vision.head_facing_score.value is None
    assert state.vision.head_facing_score.reason == "stale"
    assert state.policy.vision_adaptation == "held"


def test_stale_uses_server_clock_not_client_timestamps():
    """A producer whose clock runs far ahead or behind must not affect freshness."""
    h = Harness()
    h.cam_ts = 9_999_999_999.0
    h.obs(orientation="toward")
    assert h.evaluate().vision.fresh is True
    h.clock.advance(5)
    assert h.evaluate().vision.fresh is False


# --- Ordering, duplicates, producers ---------------------------------------------------


def test_duplicate_and_out_of_order_observations():
    h = Harness()
    first = ObservationMessage.model_validate(observation(SID, 5, 100.0))
    assert h.engine.ingest_observation(first, h.clock())[0] == "accepted"
    assert h.engine.ingest_observation(first, h.clock())[0] == "duplicate"
    with pytest.raises(IngestError) as err:
        h.engine.ingest_observation(
            ObservationMessage.model_validate(observation(SID, 4, 101.0)), h.clock()
        )
    assert err.value.code == "out_of_order"
    with pytest.raises(IngestError) as err:
        h.engine.ingest_observation(
            ObservationMessage.model_validate(observation(SID, 6, 99.0)), h.clock()
        )
    assert err.value.code == "out_of_order"


def test_session_mismatch_rejected():
    h = Harness()
    with pytest.raises(IngestError) as err:
        h.engine.ingest_observation(
            ObservationMessage.model_validate(observation("s_other", 1, 1.0)), h.clock()
        )
    assert err.value.code == "session_mismatch"


def test_second_producer_cannot_take_over_while_first_is_active():
    h = Harness(producer_takeover_after_ms=3000)
    h.obs()
    other = ObservationMessage.model_validate(observation(SID, 1, 5.0, producer_id="cam-2"))
    with pytest.raises(IngestError) as err:
        h.engine.ingest_observation(other, h.clock())
    assert err.value.code == "producer_conflict"
    h.clock.advance(3.5)
    assert h.engine.ingest_observation(other, h.clock())[0] == "accepted"
    assert h.evaluate().vision.producer_id == "cam-2"


def test_gesture_ids_are_delivered_once():
    h = Harness()
    g = gesture("nod", h.cam_ts - 400, h.cam_ts - 20, gesture_id="g-1")
    h.obs(gestures=[g])
    h.clock.advance(0.1)
    h.cam_ts += 100
    h.obs(gestures=[g])  # resent after a lost ack
    assert [x.gesture.gesture_id for x in h.gestures] == ["g-1"]


def test_stale_gestures_are_not_delivered_late():
    h = Harness(gesture_max_age_ms=5000)
    h.obs(gestures=[gesture("nod", h.cam_ts - 9000, h.cam_ts - 8000)])
    assert h.gestures == []


def test_duplicate_and_out_of_order_game_events():
    h = Harness()
    msg = GameEventMessage.model_validate(
        game_event(SID, 1, "task_started", 10.0, task_id="t1", event_id="e1")
    )
    assert h.engine.ingest_game_event(msg, h.clock()) == "accepted"
    assert h.engine.ingest_game_event(msg, h.clock()) == "duplicate"
    stale = GameEventMessage.model_validate(
        game_event(SID, 1, "player_activity", 11.0, event_id="e2")
    )
    with pytest.raises(IngestError) as err:
        h.engine.ingest_game_event(stale, h.clock())
    assert err.value.code == "out_of_order"


# --- Vision policy ----------------------------------------------------------------------


@pytest.mark.parametrize("fps", [5, 15, 30, 60])
def test_delay_instruction_threshold_is_time_based(fps):
    h = Harness(delay_instruction_after_ms=1500)
    h.game("task_started", "t1")
    h.run_away(1.3, fps=fps)
    assert "delay_instruction" not in h.kinds()
    assert h.evaluate().policy.hold_new_instructions is False
    h.run_away(0.4, fps=fps, start_ms=1300)
    assert h.kinds().count("delay_instruction") == 1
    assert h.evaluate().policy.hold_new_instructions is True


def test_delay_instruction_once_per_episode_and_hold_is_capped():
    h = Harness(delay_instruction_after_ms=1000, max_instruction_hold_ms=3000)
    h.game("task_started", "t1")
    h.run_away(6.0, episode=1)
    assert h.kinds().count("delay_instruction") == 1
    state = h.evaluate()
    assert state.policy.hold_new_instructions is False
    assert state.policy.hold_reason == "max_instruction_hold_reached"
    h.run_toward(1.0)
    h.run_away(2.0, episode=2)
    assert h.kinds().count("delay_instruction") == 2


def test_gentle_cue_needs_inactivity_and_fires_once_per_task():
    h = Harness(cue_head_away_ms=6000, cue_inactivity_ms=10_000)
    h.game("task_started", "t1")
    h.run_toward(5.0)
    h.run_away(4.9)  # inactivity 9.9 s, away 4.9 s
    assert "gentle_cue" not in h.kinds()
    h.run_away(1.2, start_ms=4900)  # away 6.1 s, inactivity 11.1 s
    assert h.kinds().count("gentle_cue") == 1
    h.run_away(60.0, start_ms=6100)  # cooldown and per-task cap
    assert h.kinds().count("gentle_cue") == 1


def test_gentle_cue_blocked_by_recent_activity():
    h = Harness(cue_head_away_ms=2000, cue_inactivity_ms=10_000)
    h.game("task_started", "t1")
    for i in range(12):
        h.run_away(1.0, start_ms=i * 1000)
        h.game("player_activity", activity="moved")
    assert "gentle_cue" not in h.kinds()


def test_pause_holds_actions_and_freezes_inactivity():
    h = Harness(cue_head_away_ms=1000, cue_inactivity_ms=3000, delay_instruction_after_ms=500)
    h.game("task_started", "t1")
    h.clock.advance(1.0)
    h.game("paused")
    h.run_away(30.0)
    state = h.evaluate()
    assert h.actions == []
    assert state.policy.hold_new_instructions is False
    assert state.policy.hold_reason == "game_paused"
    assert state.gameplay.inactivity_ms.value == pytest.approx(1000, abs=1)
    h.game("resumed")
    h.run_away(1.5, start_ms=30_000)
    assert "gentle_cue" not in h.kinds()  # inactivity only ~2.5 s of unpaused time
    h.run_away(1.0, start_ms=31_500)
    assert "gentle_cue" in h.kinds()


def test_expected_idle_suppresses_vision_actions():
    h = Harness(cue_head_away_ms=500, cue_inactivity_ms=500, delay_instruction_after_ms=200)
    h.game("task_started", "t1")
    h.game("expected_idle_start")
    h.run_away(10.0)
    assert h.actions == []
    assert h.evaluate().policy.hold_reason == "expected_idle"


def test_disabled_vision_adaptation_emits_no_vision_actions():
    h = Harness(cue_head_away_ms=500, cue_inactivity_ms=500, delay_instruction_after_ms=200)
    h.game("adaptation_setting", vision_adaptation_enabled=False)
    h.game("task_started", "t1")
    h.run_away(10.0)
    assert h.actions == []
    state = h.evaluate()
    assert state.policy.vision_adaptation == "disabled"
    assert state.attention_state == "HEAD_AWAY"  # still observed, just not acted on


def test_stale_vision_holds_vision_actions():
    h = Harness(delay_instruction_after_ms=500)
    h.game("task_started", "t1")
    h.obs(orientation="away", head_away_ms=10_000, episode=3)
    h.clock.advance(2.0)  # stale before policy could act
    h.actions.clear()
    state = h.evaluate()
    assert state.policy.vision_adaptation == "held"
    assert "delay_instruction" not in h.kinds()


def test_looking_away_or_closed_eyes_never_changes_difficulty():
    h = Harness(cue_head_away_ms=500, cue_inactivity_ms=500)
    h.game("task_started", "t1")
    h.run_away(120.0)
    assert not any(k == "increase_difficulty" for k in h.kinds())
    assert set(h.kinds()) <= {"delay_instruction", "gentle_cue"}


# --- Gameplay policy -------------------------------------------------------------------


def answer(h: Harness, task: str, correct: bool, response_ms: float):
    h.game_ts += response_ms
    h.clock.advance(response_ms / 1000)
    return h.game("answer_submitted", task, correct=correct)


def test_offer_hint_after_errors_and_slowing_responses_once_with_cooldown():
    h = Harness(hint_min_errors=2, hint_slowdown_ratio=1.25, hint_cooldown_ms=30_000)
    h.game("task_started", "t1")
    answer(h, "t1", False, 3000)
    answer(h, "t1", False, 3100)
    assert "offer_hint" not in h.kinds()  # not slowing yet
    answer(h, "t1", False, 5000)  # 5000 >= 1.25 * median(3000, 3100)
    assert h.kinds().count("offer_hint") == 1
    hint = [a for a in h.actions if a.action == "offer_hint"][0]
    assert hint.task_id == "t1"
    assert hint.evidence["errors_in_window"] == 3
    assert hint.reason
    answer(h, "t1", False, 9000)
    answer(h, "t1", False, 15000)
    assert h.kinds().count("offer_hint") == 1  # per-task cap and cooldown


def test_offer_hint_not_triggered_by_errors_alone():
    h = Harness()
    h.game("task_started", "t1")
    for _ in range(5):
        answer(h, "t1", False, 3000)
    assert "offer_hint" not in h.kinds()


def test_response_time_excludes_paused_time():
    h = Harness()
    h.game("task_started", "t1")
    h.game_ts += 1000
    h.game("paused")
    h.game_ts += 60_000
    h.game("resumed")
    h.game_ts += 1000
    h.game("answer_submitted", "t1", correct=True)
    assert h.evaluate().gameplay.recent_response_ms_median.value == pytest.approx(2000)


def test_difficulty_increase_after_success_streak_then_cooldown():
    h = Harness(difficulty_success_streak=5, difficulty_cooldown_ms=180_000)
    for i in range(5):
        h.game("task_started", f"t{i}")
        answer(h, f"t{i}", True, 2000)
        h.game("task_completed", f"t{i}", outcome="success")
    assert h.kinds().count("increase_difficulty") == 1
    for i in range(5, 10):
        h.game("task_started", f"t{i}")
        answer(h, f"t{i}", True, 2000)
        h.game("task_completed", f"t{i}", outcome="success")
    assert h.kinds().count("increase_difficulty") == 1  # within cooldown


def test_no_difficulty_increase_with_hints_or_errors():
    h = Harness(difficulty_success_streak=3)
    for i in range(3):
        h.game("task_started", f"t{i}")
        if i == 1:
            h.game("hint_shown", f"t{i}", hint_level=1)
        answer(h, f"t{i}", True, 2000)
        h.game("task_completed", f"t{i}", outcome="success")
    assert "increase_difficulty" not in h.kinds()


def test_engagement_score_null_until_history_then_bounded():
    h = Harness()
    state = h.evaluate()
    assert state.task_engagement_score.value is None
    assert state.task_engagement_score.reason == "insufficient_gameplay_history"
    for i in range(2):
        h.game("task_started", f"t{i}")
        answer(h, f"t{i}", True, 2000)
        h.run_toward(1.0)
        h.game("task_completed", f"t{i}")
    assert h.evaluate().task_engagement_score.value is None  # 2 answers < 3
    h.game("task_started", "t2")
    h.run_toward(1.0)
    answer(h, "t2", False, 2000)
    score = h.evaluate().task_engagement_score
    assert score.value is not None and 0 <= score.value <= 1
    assert score.components["accuracy"] == pytest.approx(2 / 3)
    assert score.components["head_toward"] == pytest.approx(1.0)


def test_event_replay_skips_consumed_and_expired():
    h = Harness(delay_instruction_after_ms=100)
    h.game("task_started", "t1")
    h.run_away(1.0)
    [delay] = [a for a in h.actions if a.action == "delay_instruction"]
    assert [e.event_seq for e in h.engine.replay_after(0, h.clock())] == [delay.event_seq]
    assert h.engine.replay_after(delay.event_seq, h.clock()) == []
    h.clock.advance(60)
    assert h.engine.replay_after(0, h.clock()) == []
