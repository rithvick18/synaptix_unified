# Player observation service

Webcam-derived, **numerical** player observations for games, plus a deterministic policy
that suggests when to delay an instruction, offer a cue or hint, or raise difficulty.

- **Vision** runs in the browser with MediaPipe Face Landmarker. Frames never leave the
  page; only numbers are sent.
- **Service** is FastAPI. It validates observations and gameplay events, derives a state,
  and runs the policy.
- **TypeScript**: a camera producer (`FaceObserver` + `ProducerConnection`) and a separate
  game adapter (`GameAdapter`). The game can consume the service without opening a camera.

> Head orientation is not eye gaze. `head_facing_score` is a head-pose heuristic relative
> to a calibrated neutral pose. None of these signals establish engagement, emotion,
> fatigue or cognitive state.

See [INTEGRATION.md](INTEGRATION.md) for connecting a game, and
[integrations/memoria-3d/](integrations/memoria-3d/) for the Memoria 3D patch.

---

## Layout

```
service/                 FastAPI service (Python 3.12)
  app/schemas.py         wire schemas (schema_version 1.0)
  app/engine.py          ordering/dedup, derived state, policy, engagement heuristic
  app/sessions.py        in-memory sessions, rate limits, fan-out
  app/main.py            HTTP + WebSocket endpoints
  app/config.py          settings and policy thresholds (env OBS_*)
  tests/                 pytest (engine + API/WebSocket)
web/                     TypeScript (Vite)
  src/protocol/          wire types (mirror of schemas.py) + runtime validation
  src/vision/            FaceObserver, worker, landmarker, signal processing
  src/transport/         ProducerConnection, GameAdapter, session helpers
  src/demo/              interactive demo (+ labelled simulation mode)
  scripts/               asset setup, integration check, headless browser check
  tests/                 vitest
integrations/memoria-3d/ patch + bridge for the Memoria 3D game
.env.example             every service setting with its default
```

## Setup

Requirements: Python 3.12 (via [uv](https://docs.astral.sh/uv/) or any venv), Node 22+
(tested on Node 26), a Chromium-based browser or Firefox for the demo.

```bash
# Service
cd service
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements-dev.txt   # or: python -m pip install -r requirements-dev.txt

# Web
cd ../web
npm ci
npm run setup:assets      # copies MediaPipe WASM, downloads + SHA-256-verifies the model
```

### Model assets

`npm run setup:assets` (`web/scripts/setup-assets.mjs`):

1. Copies `node_modules/@mediapipe/tasks-vision/wasm/*` (package pinned at **1.0.1**) to
   `web/public/mediapipe/wasm/`. WASM is served locally, not from a CDN.
2. Downloads the official model bundle
   `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
   to `web/public/models/face_landmarker.task` and verifies
   SHA-256 `64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff`
   (3,758,596 bytes). A mismatch fails loudly.
3. For offline setup: `FACE_MODEL_PATH=/path/to/face_landmarker.task npm run setup:assets`.

Both directories are gitignored.

## Run

```bash
# Terminal 1: service (binds 127.0.0.1:8765, ONE worker)
cd service && .venv/bin/python -m app

# Terminal 2: demo (http://127.0.0.1:5174)
cd web && npm run dev
```

Open the demo, then:

1. **Create session & connect**.
2. **Start camera** and allow access.
3. **Calibrate** (see below).

Use the gameplay buttons to drive the policy.

### Calibration

Press **Calibrate**, look at the centre of the screen and keep still:

- about 0.8 s to settle;
- about 2 s of sampling.

It fails with a stated reason when there are too few valid frames, the head is moving,
the pose is far from the camera, the eyes are not open, or more than one face is visible.
Just retry. Head angles, the facing score, eye openness and all gestures stay `null`
(with reason `uncalibrated`) until calibration succeeds. The calibrated pose is the
reference for "toward the screen", so a camera mounted beside or above the screen is
fine. Recalibrate after moving the camera or seat, or whenever the status says
`required` (for example after the face was lost for more than 5 s).

## Checks

```bash
cd service && .venv/bin/python -m pytest -q          # service unit + API/WebSocket tests
cd web && npm test                                   # vitest: signals, transport, extraction
cd web && npm run typecheck && npm run build         # TypeScript + production build
cd web && npm run integration                        # starts the real service, drives it through ProducerConnection + GameAdapter
cd web && npm run check:browser                      # headless Chrome, FaceObserver on a fake camera (no real webcam)
cd web && npm run check:demo -- --video face.y4m     # headless Chrome drives the whole demo; needs a .y4m with one face
```

A face video for the Chrome checks can be made from any portrait you have the rights to use:
`ffmpeg -loop 1 -i face.jpg -t 20 -vf scale=640:480 -r 30 -pix_fmt yuv420p face.y4m`.

## Verification status

What has been verified, and how. **No physical webcam was used**: every browser run used
Chrome's fake capture device. Live-camera accuracy and performance are therefore
**unverified**.

| Area | Evidence |
|---|---|
| Service: validation, auth, origins, limits, dedup/ordering, isolation, staleness, policy, cooldowns, WebSocket replay/cleanup | `pytest` 62 tests (mutation-checked: breaking the stale check or the cooldowns fails tests) |
| Signal processing: calibration gating, time-based thresholds at 10/30/60 fps, hysteresis, gestures and debounce, loss/recovery/re-lock, multiple faces, eye/blink, null-with-reason invariants | vitest (geometry, gestures, signals) on synthetic frames |
| Producer/adapter: seq, throttling, stale-drop, gesture resend, reconnect/backoff, heartbeat staleness, outbox resend, exactly-once delivery, rate-limit requeue, cleanup | vitest `transport.test.ts` (fake sockets, fake timers) |
| Real service + real `ProducerConnection` + `GameAdapter` | `npm run integration`, 11/11 scenarios (synthetic observations flagged `simulated`) |
| MediaPipe in a module Web Worker, GPU delegate, fallback, model-missing error, `stop()` releases camera | `npm run check:browser` (fake camera, synthetic pattern and a still-portrait video) |
| Roll sign convention | Portrait rotated ±20° in the fake video: measured roll −19° / +18° vs the predicted signs. Yaw/pitch signs are verified only by math and unit tests. |
| Whole demo in a browser | `npm run check:demo`, 14/14 (session → camera → calibration → `HEAD_TOWARD_SCREEN` → gameplay-driven `offer_hint` → adaptation off → stale `UNKNOWN` → cleanup) |
| Memoria 3D patch | fresh scratch copy: `apply.sh`, the game's `npm run build` and `npm run check` (366 assertions), bridge check 62/62; the original repo is untouched |

### Measured performance vs configuration targets

These are **measurements** from headless Chrome on this Mac (Apple Silicon), fake camera,
640×480, Web Worker, GPU delegate.

| Metric | Measured | Configured target |
|---|---|---|
| Inference per frame | p50 ≈ 10–15 ms, p90 ≈ 16–24 ms | none (reported as `perf.inference_ms`) |
| Processed frame rate | ≈ 10–14 frames/s (the fake camera delivers about 20–30 frames/s) | `sampleIntervalMs` 66 ms ≈ 15 Hz, worker path |
| Main-thread fallback | ≈ 6 frames/s, inference ≈ 15 ms | `fallbackSampleIntervalMs` 150 ms ≈ 6.7 Hz |
| Dropped (busy) frames | 0 | no queue: at most one frame in flight |
| Model warm-up | ≈ 200 ms (first inference without warm-up was 3.6 s) | none |
| State staleness after the producer stops | ≈ 1.6 s to `UNKNOWN` | `stale_after_ms` 1500 + tick 250 ms |

A real webcam, other hardware, or a busy game render loop will give different numbers.
The live values are shown in the demo and sent in every observation's `perf`.

### Known limitations

- **Accuracy.** Not validated on live people. Angles, the facing score, EAR thresholds and
  gesture parameters are initial defaults; tune them with real users. Yaw and pitch signs
  are verified by math only (roll by the rotated-portrait video).
- **Blinks.** At about 10 processed frames/s, very short blinks can fall between frames and
  be missed. Blink durations are quantised to the frame interval.
- **Blendshape sides.** `eye_blink_coefficient_left/right` use MediaPipe's own side labels,
  which are not independently verified.
- **Identity.** The face lock is geometric, not recognition. A different person who sits in
  the same place within the 5 s re-lock grace is treated as the same player.
- **Storage.** The store is in-memory and needs a single worker. Sessions are lost on
  restart.
- **Replayed task ids.** The service keys tasks by `task_id`, so reusing a `task_id` (for
  example on a replayed level) merges its history. Games should make task ids unique per
  attempt where possible.
- **`task_engagement_score`.** A heuristic, not a validated measure. See its section below.

---

## Endpoints

All bodies are JSON. `schema_version` is `"1.0"`. The full JSON Schemas are served at
`GET /v1/schema`, and OpenAPI docs at `/docs`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | liveness, schema version, session count |
| POST | `/v1/sessions` | optional `X-Session-Create-Key` | create an isolated session; returns `producer_token`, `consumer_token`, endpoint paths, limits, policy |
| POST | `/v1/sessions/{id}/observations` | `Bearer <producer_token>` | HTTP ingestion fallback |
| POST | `/v1/sessions/{id}/game-events` | `Bearer <consumer_token>` | gameplay events |
| GET | `/v1/sessions/{id}/state` | either token | latest derived state (`StateMessage`) |
| WS | `/v1/sessions/{id}/stream` | `hello` message carries the token | producer: observations in, acks out. Consumer: game events in; state, gestures and actions out |
| DELETE | `/v1/sessions/{id}` | either token | close sessions and sockets |

**WebSocket protocol.** The first client message must be
`{"type":"hello","schema_version":"1.0","role":"producer"|"consumer","client_id":…,"token":…,"resume_after_event_seq":n|null}`
within 5 s. The server replies `welcome`. Consumers then get a `state` snapshot plus any
buffered, unexpired gestures and actions with `event_seq > resume_after_event_seq`.

**Roles are separate, so nothing echoes back:**

- Producers may send only `observation` and `ping`. They receive only `ack`, `error`,
  `heartbeat` and `pong`.
- Consumers may send only `game_event` and `ping`. They receive `state`, `gesture`,
  `suggested_action`, `ack`, `error`, `heartbeat` and `pong`.

**Close codes:**

| Code | Meaning |
|---|---|
| 4000 | session closed |
| 4401 | bad token or role |
| 4403 | origin not allowed |
| 4404 | unknown session |
| 4408 | hello timeout |
| 4409 | consumer too slow |
| 1008 | rate abuse |
| 1009 | message too large |

**Errors.** HTTP errors are `{"error":{"code","message"}}`. WebSocket errors are
`{"type":"error","code","message","seq"}`.

| Status | Codes |
|---|---|
| 400 | `session_mismatch` |
| 401 / 403 | auth failures, `origin_not_allowed` |
| 404 | `session_not_found` |
| 409 | `out_of_order`, `producer_conflict`, `unknown_task` |
| 413 | `payload_too_large` |
| 422 | `invalid_message` (locations only, never input values) |
| 429 | `rate_limited` |

### Messages (abridged; authoritative: `service/app/schemas.py`, `web/src/protocol/types.ts`)

**Observation** (producer → service)

```jsonc
{
  "type": "observation", "schema_version": "1.0",
  "session_id": "s_…", "producer_id": "demo-camera-x1", "seq": 42,
  "capture_ts_ms": 183204.5,                // producer monotonic clock (performance.now)
  "tracking": { "status": "tracking", "valid": true, "reason": null,
                "face_count": 1, "multiple_faces_visible": false,
                "quality": { "value": 0.86, "reason": null } },
  "calibration": { "status": "calibrated", "reason": null, "progress": null },
  "measurements": {
    "head_yaw_deg":   { "value": -4.2, "reason": null },
    "head_pitch_deg": { "value": 1.1,  "reason": null },
    "head_roll_deg":  { "value": 0.3,  "reason": null },
    "head_facing_score": { "value": 0.88, "reason": null },
    "head_orientation":  { "value": "toward", "reason": null },
    "head_away_ms": { "value": 0, "reason": null }, "head_away_episode": 3,
    "eye_openness_left":  { "value": 1.02, "reason": null },
    "eye_openness_right": { "value": 0.97, "reason": null },
    "eye_blink_coefficient_left":  { "value": 0.04, "reason": null },
    "eye_blink_coefficient_right": { "value": 0.05, "reason": null },
    "eyes_closed":    { "value": false, "reason": null },
    "eyes_closed_ms": { "value": 0, "reason": null }
  },
  "gestures": [ { "gesture_id": "…uuid…", "type": "nod", "start_ts_ms": 182700.1,
                  "end_ts_ms": 183150.9, "amplitude_deg": 11.4, "swings": 2 } ],
  "perf": { "backend": "worker", "delegate": "GPU", "inference_ms": 9.8,
            "processed_fps": 14.9, "dropped_frames": 3 },
  "simulated": false
}
```

An unavailable measurement is `{"value": null, "reason": "<code>"}`. It is never `0`.
Examples: `uncalibrated`, `calibrating`, `no_face`, `recovering`, `stale`,
`head_pose_out_of_range`, `transformation_matrix_unavailable`.

**Game event** (game → service)

```jsonc
{ "type": "game_event", "schema_version": "1.0", "session_id": "s_…",
  "source_id": "memoria-3d", "seq": 7, "event_id": "…uuid…",
  "client_ts_ms": 90412.0,                  // game monotonic clock
  "event_type": "answer_submitted", "task_id": "level-1:2",
  "data": { "correct": false, "response_ms": 5200 } }
```

**Event types:**

| Event type | Notes |
|---|---|
| `task_started` | `task_id` required |
| `answer_submitted` | requires `data.correct`; `data.response_ms` optional |
| `hint_requested` | player asked for help |
| `hint_shown` | `data.hint_level` |
| `task_completed` | `data.outcome`: `success`, `success_with_help`, `failed` or `revealed` |
| `task_skipped` | |
| `paused` / `resumed` | |
| `player_activity` | `data.activity`, e.g. `moved` |
| `expected_idle_start` / `expected_idle_end` | e.g. a cut-scene or a spoken instruction |
| `adaptation_setting` | `data.vision_adaptation_enabled` |

All task, answer and hint events require `task_id`.

**State** (service → consumers): `StateMessage.state` is a `DerivedState`.

| Field | Contents |
|---|---|
| `attention_state` | `CALIBRATING`, `TRACKING_UNAVAILABLE`, `HEAD_TOWARD_SCREEN`, `HEAD_AWAY` or `UNKNOWN`, plus `attention_reason` |
| `vision` | freshness, age, `simulated` flag, tracking and calibration status, measurements (all `null`/`stale` once stale) |
| `gameplay` | paused, expected idle, current task, inactivity, accuracy, median response time |
| `task_engagement_score` | heuristic with its components; `null` until there is enough history |
| `policy` | `vision_adaptation` (`active`, `held` or `disabled`) with its reason, and `hold_new_instructions` with its reason |

**Gesture** (service → consumers): `{type:"gesture", event_seq, gesture:{gesture_id, …}}`.

**Suggested action** (service → consumers)

```jsonc
{ "type": "suggested_action", "event_seq": 12, "action_id": "…",
  "action": "offer_hint", "source": "gameplay", "task_id": "level-1:2",
  "reason": "Repeated errors with slowing responses on recent answers; consider offering a hint.",
  "evidence": { "errors_in_window": 3, "latest_response_ms": 7400,
                "prior_median_response_ms": 4100, "slowdown_ratio": 1.8, "slowdown_threshold": 1.25 },
  "expires_in_ms": 15000 }
```

### Validation, ordering and limits

- Pydantic models forbid unknown fields and non-finite numbers, and bound every value
  and list. Each measurement must carry exactly one of value or reason.
- **Session binding.** The body's `session_id` must match the path. On WebSocket, the
  `producer_id` must match `hello`.
- **Observations** are deduplicated by `(producer_id, seq)`; a retry gets `duplicate`.
  A lower `seq`, or a `capture_ts_ms` that goes backwards, is rejected as
  `out_of_order`.
- **Game events** are deduplicated by `event_id` first, then `seq` must increase per
  `source_id`.
- **Gestures** are deduplicated by `gesture_id`. The service drops gestures when the
  carrying observation is untracked or uncalibrated, and drops any older than 5 s
  (defence in depth).
- **Single producer.** A second `producer_id` is refused (`producer_conflict`) until the
  current producer has been silent for 3 s. Two cameras or players never interleave.
  `ProducerConnection` adds a random suffix to its `producerId` per instance, so a
  reloaded page never collides with its old sequence numbers.
- **Limits.** Body and WebSocket message size are capped at 16 KiB. Observations are
  limited to 40/s (burst 80) and game events to 20/s (burst 200, at least the adapter outbox), per session. Buffers
  are bounded, and each consumer has a bounded send queue: a slow consumer is
  disconnected, reconnects and replays.
- **Session lifetime.** Sessions expire after 15 min idle (none while sockets are open)
  or 4 h total. At most 50 sessions exist at once.

### Security

- **Local by default.** Binds `127.0.0.1`.
- **Origins.** CORS and WebSocket origins come from an explicit allowlist, with no
  wildcards. Requests with a missing Origin are refused on WebSocket.
- **Tokens.** Tokens are per-session and role-scoped (producer or consumer), 256-bit
  random, and compared in constant time. They travel only in the `Authorization`
  header or the WebSocket `hello` message, never in URLs, so they never reach access
  logs. The service never logs tokens.
- **Creation key.** Optionally, `OBS_SESSION_CREATE_KEY` gates session creation.

### In-memory store: operational limits

- Sessions live in process memory, so run **exactly one worker**; `python -m app` does
  this.
- A restart loses every session. Clients see `session_not_found`, and the adapter's
  status becomes `failed`; create a new session.
- For multiple workers or persistence you would need a shared store and pub/sub. That
  is not implemented.

---

## Signals and semantics

The producer computes all signals from one locked face.

**Timing.** Every duration uses elapsed monotonic time, never frame counts. EMAs use
`alpha = 1 − exp(−dt/τ)`.

**Angle conventions.** These are from the player's own perspective and are unaffected
by preview mirroring. Measurements use the raw, unmirrored frame; mirroring is
CSS-only.

| Field | Positive means |
|---|---|
| `head_yaw_deg` | head turned to the player's **right** |
| `head_pitch_deg` | chin **up** |
| `head_roll_deg` | head tilted toward the player's **right** shoulder |

Angles come from MediaPipe's facial transformation matrix. The matrix maps the
canonical face to camera space; its rotation is decomposed as R = Ry·Rx·Rz. Angles are
reported relative to the calibrated neutral pose (R_rel = R·R_calᵀ).

**`head_facing_score`** = `clamp(1 − hypot(yaw/40°, pitch/30°), 0, 1)` on smoothed
relative angles (τ = 120 ms). It is a head-orientation heuristic, not gaze or screen
fixation.

**Orientation hysteresis:**

- **Away** after the score stays below 0.35 for ≥ 300 ms.
- **Toward** after it stays above 0.55 for ≥ 200 ms.

`head_away_ms` counts from when the score first dropped below 0.35 in the current
episode. `head_away_episode` increments with each new episode.

**Eyes:**

- **Eye aspect ratio** (landmarks 33/160/158/133/153/144 for the right eye and
  362/385/387/263/373/380 for the left), measured in pixel space. It is divided by the
  calibrated open-eye value.
- **Closure hysteresis.** Eyes count as closed below 0.6 and open again above 0.8.
- **Blink.** A closed episode lasting 40–500 ms is reported as a blink.
- **`eyes_closed_ms`** gives the sustained closure time.
- **Out-of-range poses.** Eye values are `null` when |yaw| > 30° or |pitch| > 25°.
- **Blendshape coefficients.** `eye_blink_coefficient_*` pass through MediaPipe's
  `eyeBlinkLeft`/`eyeBlinkRight` values unchanged. They are coefficients, not
  probabilities. The left/right labels are MediaPipe's; they are not relabelled.

**Nod and head shake.** A zig-zag swing detector runs on lightly smoothed relative
pitch (nod) and yaw (shake), τ = 50 ms.

| | Nod | Head shake |
|---|---|---|
| Swings required | ≥ 2 | ≥ 3 |
| Minimum swing | ≥ 7° | ≥ 9° |
| Completed within | 1.2 s | 1.5 s |

- Each swing must last ≥ 60 ms.
- The head must return to within 50% of the excursion.
- The other axis must move ≤ 0.6× as much.
- Per-type cooldown is 800 ms.
- Both detectors reset after any gesture.
- Each gesture gets a UUID `gesture_id`. The producer resends it until acked, and the
  service and adapter deduplicate it, so it is consumed exactly once.

**Suppression.** Gestures and blinks are suppressed while calibrating, before
calibration, during tracking loss, and during the 500 ms recovery window after any
loss.

### `tracking_quality`

MediaPipe's Face Landmarker gives no per-face confidence in this API, so none is
invented. `tracking_quality` is a heuristic: the product of the factors below, clamped
to [0,1].

| Factor | Value |
|---|---|
| face size | `clamp((box_width − 0.06)/0.09, 0, 1)` (full at ≥ 15% of frame width) |
| in-frame | `clamp((fraction_of_landmarks_in_image − 0.85)/0.15, 0, 1)` |
| pose | `max(0.5, clamp(1 − max(0, e − 1)/0.5, 0, 1))`, where `e = max(|yaw|/45°, |pitch|/35°)`. Extreme poses lower confidence but alone do not invalidate tracking. |
| motion | `clamp(1 − (v − 2)/4, 0.3, 1)`, where `v` = face-centre speed in face-widths per second |
| other faces visible | × 0.8 |
| no transformation matrix | × 0.5 |
| inference > 150 ms | × 0.8 |

Tracking is `valid` only when all of these hold:

- a single face is locked unambiguously;
- quality ≥ 0.4;
- the recovery window has passed.

### Face lock and players

- The first time, the producer locks only when exactly one face is visible.
- With several faces, it follows the locked face by box overlap. If that becomes
  ambiguous, the status becomes `multiple_faces` and tracking turns invalid; it never
  silently switches.
- If the face is absent for up to 5 s, it can be re-acquired (via `recovering`).
- After more than 5 s the status becomes `lost`, and calibration becomes `required`.
  Whoever sits down next must recalibrate before vision is used again.

---

## Derived state and policy (service)

Raw observations, derived state and suggested actions are kept separate
(`engine.py`). The policy is deterministic. All thresholds are **initial, tunable
defaults** (`service/app/config.py`, `.env.example`, or per-session `policy_overrides`
on `POST /v1/sessions`).

### Attention state

Checks run in this order:

1. **`UNKNOWN`** when there are no observations, or the latest is **stale**, meaning no
   observation received for 1.5 s on the *server* clock. When stale, every vision
   measurement becomes `null` with reason `stale`; a favourable value is never kept.
2. **`CALIBRATING`** while calibration is in progress.
3. **`TRACKING_UNAVAILABLE`** while tracking is invalid.
4. **`UNKNOWN`** when not calibrated.
5. Otherwise **`HEAD_TOWARD_SCREEN`**, **`HEAD_AWAY`**, or `UNKNOWN` while the
   orientation is still uncertain.

**Clocks.**

- **Freshness** uses the server's monotonic receipt time.
- **Head-away and eye durations** are measured on the producer's clock.
- **Response times** use the game's clock, minus paused time.
- **Inactivity** uses the server clock, frozen while paused or during an expected idle
  period.

Timestamps from different clocks are never subtracted from each other.

### Vision gating

Vision-driven rules run only when vision is fresh, valid and calibrated, and the game
has vision adaptation enabled. Otherwise `policy.vision_adaptation` is `held` (with the
reason) or `disabled`. No actions are emitted while the game is paused or in an
expected idle period.

### Rules

| Action | Source | Condition (defaults) | Limits |
|---|---|---|---|
| `delay_instruction` | vision | `HEAD_AWAY` with `head_away_ms` ≥ 1.5 s | once per head-away episode, cooldown 5 s; `hold_new_instructions` is true for at most 8 s per episode, so instructions are never blocked indefinitely |
| `gentle_cue` | vision + gameplay | active task, head away ≥ 6 s **and** no gameplay input ≥ 10 s | at most 1 per task, cooldown 60 s |
| `offer_hint` | gameplay | ≥ 2 errors in the last 6 answers, ≥ 1 in the current task, **and** the latest response ≥ 1.25 × the median of the prior answers (needs ≥ 2 prior) | 1 per task, cooldown 30 s |
| `increase_difficulty` | gameplay | last 5 completed tasks all `success` with no errors or hints, and not slowing (median of the last 3 ≤ 1.1 × the overall median) | cooldown 180 s, and at least 5 new tasks between suggestions; always "small" |

There is **no** rule that lowers difficulty, and nothing is inferred from a neutral
expression, closed eyes or looking away. Difficulty depends only on task performance.
Every action carries a human-readable `reason`, numeric `evidence`, a `source`, a
`task_id` where relevant, a unique `action_id`, and an expiry.

### `task_engagement_score` (optional heuristic)

The score is `null` (reason `insufficient_gameplay_history`) until there are ≥ 3
answers and ≥ 2 completed tasks. After that it is a weighted mean of the available
components:

| Component | Weight | Definition |
|---|---|---|
| accuracy | 0.4 | fraction correct over the last 10 answers |
| independence | 0.2 | fraction of the last 10 completed tasks finished without hints |
| pace | 0.2 | `min(1, median(first 5 response times) / median(last 3))`; needs ≥ 5 response times |
| head_toward | 0.2 | share of valid-vision, active-task time with the head toward the screen over the last 120 s. Needs ≥ 50% valid coverage, and is omitted when vision adaptation is disabled. |

Missing components are dropped, and the remaining weights are renormalised.

**Limitations.** This is a summary of task performance plus head orientation, and
nothing more. It is not validated against any engagement measure. It is sensitive to
task difficulty and to the player's baseline speed. Head orientation can be toward the
screen while the player is not attending, and the reverse. Do not use it for
decisions about a person.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Camera status `permission_denied` | Allow camera access for `127.0.0.1:5174` in the browser's site settings and press Start again. Nothing is simulated. |
| `no_camera` / `camera_in_use` | Connect a camera, or close other apps using it (Zoom, FaceTime, another tab). |
| `model_load_failed` | Run `npm run setup:assets`; check `web/public/models/face_landmarker.task` and `web/public/mediapipe/wasm/` exist. |
| Backend says "main thread (throttled fallback)" | The browser lacks module workers/OffscreenCanvas or worker init failed. Sampling drops to ~6.7 Hz to protect rendering. |
| Tracking `multiple_faces` | Another face is visible and the locked face is ambiguous. Only the player should be in view. |
| Calibration `required` | The face was lost for more than 5 s. Recalibrate. |
| Calibration `failed (unstable_pose)` | Keep still for the 2 s sampling window; improve lighting. |
| State `UNKNOWN (stale_observations)` | No observation for 1.5 s: the camera stopped, the tab is hidden, or the producer link dropped. |
| WebSocket closes 4403 | The page origin is not in `OBS_ALLOWED_ORIGINS`. |
| Adapter `failed (session_not_found)` | The service restarted (in-memory sessions). Create a new session. |
| 429 `rate_limited` | Lower the producer send rate or raise `OBS_OBSERVATION_RATE_PER_S`. |
