"""Service settings and policy thresholds.

Every threshold here is an initial, tunable default, not a validated constant. They are
chosen to be conservative (slow to act, quick to hold) and are expected to be tuned per
game and per player population.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class PolicyConfig(BaseModel):
    """Thresholds for derived state and the suggestion policy. All durations are ms."""

    model_config = ConfigDict(extra="forbid")

    # --- Freshness ------------------------------------------------------------------
    # Server-clock age after which the latest observation is treated as stale. Stale
    # vision is never used: measurements become null and the state becomes UNKNOWN.
    stale_after_ms: float = Field(1500, ge=200, le=60_000)
    # A different producer may take over a session only after the current one has been
    # silent this long. Prevents two cameras (or two players) silently interleaving.
    producer_takeover_after_ms: float = Field(3000, ge=0, le=600_000)
    # Gestures whose end is older than this (producer clock, relative to the carrying
    # observation) are dropped instead of being delivered late after a reconnect.
    gesture_max_age_ms: float = Field(5000, ge=100, le=60_000)

    # --- Delay instruction (vision) --------------------------------------------------
    delay_instruction_after_ms: float = Field(1500, ge=0, le=60_000)
    # A hold never lasts longer than this per head-away episode, so an instruction is
    # never blocked indefinitely.
    max_instruction_hold_ms: float = Field(8000, ge=0, le=120_000)
    delay_instruction_cooldown_ms: float = Field(5000, ge=0, le=600_000)

    # --- Gentle cue (vision + gameplay inactivity) -----------------------------------
    cue_head_away_ms: float = Field(6000, ge=0, le=600_000)
    cue_inactivity_ms: float = Field(10_000, ge=0, le=600_000)
    cue_max_per_task: int = Field(1, ge=0, le=10)
    cue_cooldown_ms: float = Field(60_000, ge=0, le=3_600_000)

    # --- Offer hint (gameplay) -------------------------------------------------------
    hint_error_window: int = Field(6, ge=2, le=50)
    hint_min_errors: int = Field(2, ge=1, le=50)
    hint_min_prior_answers: int = Field(2, ge=1, le=50)
    hint_slowdown_ratio: float = Field(1.25, ge=1.0, le=10.0)
    hint_max_per_task: int = Field(1, ge=0, le=10)
    hint_cooldown_ms: float = Field(30_000, ge=0, le=3_600_000)

    # --- Increase difficulty (gameplay) ----------------------------------------------
    difficulty_success_streak: int = Field(5, ge=2, le=50)
    difficulty_slowdown_tolerance: float = Field(1.1, ge=1.0, le=10.0)
    difficulty_cooldown_ms: float = Field(180_000, ge=0, le=86_400_000)

    # --- task_engagement_score --------------------------------------------------------
    engagement_min_answers: int = Field(3, ge=1, le=100)
    engagement_min_completed_tasks: int = Field(2, ge=1, le=100)
    engagement_window_answers: int = Field(10, ge=2, le=100)
    engagement_vision_window_ms: float = Field(120_000, ge=5_000, le=3_600_000)
    engagement_min_vision_coverage: float = Field(0.5, ge=0.0, le=1.0)

    # --- Actions ---------------------------------------------------------------------
    action_ttl_ms: float = Field(15_000, ge=1000, le=600_000)


class PolicyOverrides(BaseModel):
    """Per-session overrides supplied at session creation. Same bounds as PolicyConfig."""

    model_config = ConfigDict(extra="forbid")

    stale_after_ms: float | None = Field(None, ge=200, le=60_000)
    delay_instruction_after_ms: float | None = Field(None, ge=0, le=60_000)
    max_instruction_hold_ms: float | None = Field(None, ge=0, le=120_000)
    delay_instruction_cooldown_ms: float | None = Field(None, ge=0, le=600_000)
    cue_head_away_ms: float | None = Field(None, ge=0, le=600_000)
    cue_inactivity_ms: float | None = Field(None, ge=0, le=600_000)
    cue_cooldown_ms: float | None = Field(None, ge=0, le=3_600_000)
    hint_min_errors: int | None = Field(None, ge=1, le=50)
    hint_slowdown_ratio: float | None = Field(None, ge=1.0, le=10.0)
    hint_cooldown_ms: float | None = Field(None, ge=0, le=3_600_000)
    difficulty_success_streak: int | None = Field(None, ge=2, le=50)
    difficulty_cooldown_ms: float | None = Field(None, ge=0, le=86_400_000)

    def apply(self, base: PolicyConfig) -> PolicyConfig:
        changes = {k: v for k, v in self.model_dump().items() if v is not None}
        return base.model_copy(update=changes)


class Settings(BaseSettings):
    """Process settings. Read from environment variables prefixed OBS_ (see .env.example)."""

    model_config = SettingsConfigDict(
        env_prefix="OBS_", env_file=".env", env_nested_delimiter="__", extra="ignore"
    )

    host: str = "127.0.0.1"
    port: int = 8765
    # Exact origins allowed for CORS and WebSocket upgrades. No wildcards.
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ]
    # Non-browser clients do not send Origin. Keep False unless a trusted local tool
    # needs it; the bundled integration check sends an explicit Origin instead.
    allow_missing_origin: bool = False
    # When set, POST /v1/sessions requires header X-Session-Create-Key with this value.
    session_create_key: str | None = None

    max_sessions: int = Field(50, ge=1, le=10_000)
    session_idle_ttl_s: float = Field(900, ge=10, le=86_400)
    session_max_age_s: float = Field(4 * 3600, ge=60, le=7 * 86_400)

    max_body_bytes: int = Field(16_384, ge=1024, le=1_048_576)
    max_ws_message_bytes: int = Field(16_384, ge=1024, le=1_048_576)
    observation_rate_per_s: float = Field(40, gt=0, le=1000)
    observation_burst: int = Field(80, ge=1, le=10_000)
    game_event_rate_per_s: float = Field(20, gt=0, le=1000)
    # >= GameAdapter outboxLimit (200) so a full outbox resent after a reconnect fits.
    game_event_burst: int = Field(200, ge=1, le=10_000)

    hello_timeout_s: float = Field(5, gt=0, le=60)
    tick_interval_s: float = Field(0.25, gt=0.01, le=5)
    heartbeat_interval_s: float = Field(2.0, gt=0.1, le=60)
    state_min_interval_s: float = Field(0.1, ge=0, le=5)
    consumer_queue_max: int = Field(256, ge=8, le=10_000)

    policy: PolicyConfig = PolicyConfig()
