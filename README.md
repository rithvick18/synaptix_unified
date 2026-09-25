# Memoria Unified: Memoria 3D with optional camera support

This workspace holds two projects that were built separately. They now run as one game:

| Folder | What it is | Stack |
|---|---|---|
| `3D game/` | **Memoria 3D.** A three.js reminiscence game, and the entry point for players. | TypeScript, Vite 7, three.js |
| `CAMERA/web/` | The camera app. MediaPipe face landmarks run in a Web Worker and produce derived head and eye signals. It also contains the transport clients and a standalone demo page. | TypeScript, Vite 7, `@mediapipe/tasks-vision` |
| `CAMERA/service/` | The player-observation service. It derives state from observations plus game events and runs the suggestion policy. | Python 3.12, FastAPI, in-memory sessions |

Camera support is **optional and off by default**. With it off, Memoria behaves exactly as before: it makes no service request, does not open the camera, and does not load any camera code.

## Quick start

The 2D game suite in `SYNAPTIX/` is a git submodule, so clone with submodules:

```sh
git clone --recurse-submodules https://github.com/rithvick18/synaptix_unified
```

If you already cloned without them, run `git submodule update --init` inside the repo; otherwise `SYNAPTIX/` stays empty.

From this folder:

```sh
npm run setup      # once: service virtualenv, both npm installs, MediaPipe runtime + verified face model
npm run dev        # starts the observation service and the game together
```

| URL | What |
|---|---|
| **http://localhost:5173/** | The game. Play here. |
| http://127.0.0.1:8765/health | The observation service (loopback only) |
| http://127.0.0.1:5174/ | The standalone camera app, for debugging. Started only by `npm run dev:debug`. |

**Shutdown.** Press Ctrl+C once in the terminal running `npm run dev`. That stops the service and every Vite server, including their process groups, and deletes all in-memory sessions. If a port stays busy afterwards, run `lsof -i :5173 -i :8765` to find the leftover process.

**In the game.** On the level list, press **Camera support (optional)**, then **Turn on camera**. Allow the camera, look at the screen and press **Calibrate**, then **Start playing**. You can also press **Continue without camera** at any point.

## Architecture as built

```
 3D game (the page the player opens)                               CAMERA/service (loopback)
 ┌─────────────────────────────────────────────────────────────┐  ┌──────────────────────────┐
 │ main.ts ── telemetry.onEvent ──▶ VisionBridge ──game events──┼─▶│ SessionEngine            │
 │    │                               (src/camera/)             │  │  derived state           │
 │    ├─ MissionRunner hooks ◀── AdaptationPolicy ◀─suggestions─┼──│  policy: thresholds,     │
 │    │   requestHint()              (game decides, logs)       │  │  hysteresis, cooldowns   │
 │    │   gentleCue()                    ▲                      │  │  (suggests only)         │
 │    │   instructionGate ◀─ InstructionHold                    │  └──────────▲───────────────┘
 │    │                                  │ CameraSnapshot       │             │ observations
 │    └─ CameraUI (setup sheet, HUD chip, settings, dev panel)  │             │ (derived numbers,
 │                                       │                      │             │  never frames)
 │  CameraAdapter ── owns, one each ─────┴────────────────────────────────────┤
 │    GameAdapter (consumer WS)   ProducerConnection (producer WS) ───────────┘
 │    FaceObserver → MediaPipe worker → SignalProcessor          ← CAMERA/web/src, imported in place
 └─────────────────────────────────────────────────────────────┘
```

- **The vision pipeline stays single-sourced.** The game imports `CAMERA/web/src` in place: there is no copy and no second implementation. `src/camera/app.ts` holds the types and `runtime.ts` loads the classes through a dynamic `import()`. The standalone camera app runs from the same files.
- **Frames stay in the browser.** The camera app already runs its analysis in the browser, so the game now hosts that analysis itself. The player never needs a camera-app tab. Raw frames never leave the page, and nothing is recorded.
- **One of everything per player session.** `CameraAdapter` refuses a second live instance. Each enable period has exactly one camera capture, one inference pipeline, one producer socket, one consumer socket and one service session. The producer and consumer share that session's id.
- **The browser still produces the observations.** Connecting the game to the service is not enough on its own: `startCamera()` also starts `FaceObserver`, which feeds `ProducerConnection`.
- **The game is the authority.** The service only suggests. `AdaptationPolicy` decides whether to act and calls one of three narrow hooks on the runner. No action is applied in both places.

## Files that connect the projects

| File | Role |
|---|---|
| `3D game/src/camera/app.ts`, `runtime.ts` | The only place that names `../CAMERA/web/src`. One file re-exports types; the other re-exports the runtime classes and is loaded lazily. |
| `3D game/src/camera/types.ts` | The stable game-facing interface: `CameraAdapterApi`, `CameraSnapshot`, `CameraSuggestion`, `CameraGesture`. |
| `3D game/src/camera/snapshot.ts` | Pure translation from camera-app and service outputs to `CameraSnapshot`. Also defines the vision gate. |
| `3D game/src/camera/CameraAdapter.ts` | Camera lifecycle and transport: `connect`, `startCamera`, `stopCamera`, `calibrate`, `getLatestState`, `onState`, `onGesture`, `onSuggestion`, `sendGameEvent`, `setAdaptationEnabled`, `dispose`. |
| `3D game/src/camera/VisionBridge.ts` | Maps game telemetry to service game events. Also contains `InstructionHold`. |
| `3D game/src/camera/AdaptationPolicy.ts` | The game-side rules, cooldowns and safe points, plus the separate adaptation log. |
| `3D game/src/camera/CameraUI.ts` | The setup sheet, HUD chip, collapsible preview, settings and developer panel. |
| `3D game/src/camera/integration.ts` | Wires the pieces to `State`, `Telemetry` and `MissionRunner`. Also handles tab visibility and input activity. |
| `3D game/src/Missions.ts` | Adds narrow hooks: `instructionGate`, `requestHint()`, `gentleCue()` and `stepAgeMs`. |
| `3D game/src/main.ts`, `src/ui.ts` | Changed in a few lines each: create the integration, add the level-list button, call `attach(runner)` and expose `__memoria.camera`. |
| `3D game/vite.config.ts` | Builds the worker as an ES module and lets Vite read `../CAMERA/web`. It serves `/mediapipe/wasm/*` and `/models/face_landmarker.task` from the camera app. A build copies those files only when `MEMORIA_CAMERA_ASSETS=1`, because they are about 38 MB. |
| `3D game/tools/checks/camera.check.ts` | 130 headless assertions: schema translation, policy, bridge, hold, and adapter lifecycle and leaks. |
| `scripts/dev.mjs`, `setup.mjs`, `check.mjs`, `camera-e2e.mjs` | Scripts for one-command startup, setup, every check, and the end-to-end browser check. |

The camera app's and the service's code were not changed: their existing endpoints, schema version 1.0 and events were enough. The only edit under `CAMERA/` is a short note at the top of `CAMERA/integrations/memoria-3d/README.md`. `CAMERA/integrations/memoria-3d/` holds the camera project's earlier patch-based approach, which copied the vision code into the game. This workspace does not use it.

## Environment

Copy `.env.example` to `.env` if you need anything other than the defaults. Values in the real environment win over `.env`.

| Variable | Default | Used by |
|---|---|---|
| `MEMORIA_GAME_PORT` | `5173` | The launcher. It runs Vite with `--strictPort` and adds this port to the service's allowed origins. |
| `VITE_OBSERVATION_URL` | `http://127.0.0.1:8765` | The game. It must be a loopback `http(s)` origin; anything else is refused. |
| `OBS_HOST` / `OBS_PORT` | `127.0.0.1` / `8765` | The service |
| `OBS_ALLOWED_ORIGINS` | the game port plus 5174, exact origins | The service's CORS and WebSocket origin check. No wildcards. |
| `OBS_POLICY__*` | see `CAMERA/.env.example` | The service's policy thresholds |
| `MEMORIA_WITH_CAMERA_APP` | `0` | `1` also starts the standalone camera app. |
| `MEMORIA_CAMERA_WEB` | `../CAMERA/web` | The game's Vite config, if the projects are not side by side |
| `MEMORIA_CAMERA_ASSETS` | unset | Set to `1` for `npm run build` to copy the WASM runtime and model into `3D game/dist`. |

No secrets are needed. The service's optional `OBS_SESSION_CREATE_KEY` is not used by the game.

**Remote use is not supported, and loopback is enforced.** Browsers expose the camera only in a secure context: `https://` or `http://localhost`. Serving the game from another machine would need HTTPS for the page and HTTPS/WSS for the service. You would also need to relax the game's loopback check and set the service's `OBS_ALLOWED_ORIGINS` to that exact origin. None of that is done here.

## Field mapping: camera app to game

The source is the service's `state` message (`DerivedState`, schema 1.0) or the in-page `FaceObserver` and `SignalProcessor`. Each measurement is `{ value, reason }`, and exactly one of the two is non-null. The game preserves that: when the service reports a value as unavailable, the game keeps it null with the service's reason. `vision`, `policy`, `gameplay` and `engagement` are all `null` whenever the consumer link is stale, meaning not open or silent for 6 s.

| Game field (`CameraSnapshot`) | Source | Units, range | Kind |
|---|---|---|---|
| `vision.fresh` | `vision.fresh` | bool; the observation is younger than `stale_after_ms` (1500) | service |
| `vision.simulated` | `vision.simulated` | bool; true only for injected test data | label |
| `vision.observationAgeMs` | `vision.observation_age_ms` | ms, measured on the server clock | service |
| `vision.attention` / `attentionReason` | `attention_state` / `attention_reason` | `HEAD_TOWARD_SCREEN`, `HEAD_AWAY`, `CALIBRATING`, `TRACKING_UNAVAILABLE` or `UNKNOWN` | rule over model output |
| `vision.trackingValid` / `trackingStatus` | `vision.tracking_valid` / `tracking_status` | bool, or one of 9 statuses | rule |
| `vision.trackingQuality` | `vision.tracking_quality` | 0–1 | **heuristic** |
| `vision.calibration` | `vision.calibration_status` | `uncalibrated`, `calibrating`, `calibrated`, `failed` or `required` | rule |
| `vision.headYawDeg` / `headPitchDeg` / `headRollDeg` | `vision.head_*_deg` | degrees relative to the calibrated neutral pose, ±180. Yaw > 0 means the head is turned to the player's right; pitch > 0 means chin up. | model (MediaPipe transform matrix), smoothed |
| `vision.headFacingScore` | `vision.head_facing_score` | 0–1: `clamp(1 − hypot(yaw/40°, pitch/30°))` | **heuristic**, head orientation only, **not eye gaze** |
| `vision.headAwayMs` | `vision.head_away_ms` | ms on the producer clock. It is 0 while the head faces the screen, and resets on every tracking gap. | rule |
| `vision.eyeOpennessLeft/Right` | `vision.eye_openness_*` | eye aspect ratio relative to the calibrated value, 0–5 | geometry over model output |
| `vision.eyesClosed` / `eyesClosedMs` | `vision.eyes_closed*` | bool / ms | rule |
| `policy.visionAdaptation` / `visionHoldReason` | `policy.vision_adaptation` / `vision_hold_reason` | `active`, `held` or `disabled` | service gate |
| `policy.holdNewInstructions` / `holdReason` | `policy.hold_new_instructions` / `hold_reason` | bool | service rule |
| `gameplay.*` | `gameplay.*` | the service's view of the game's events. Inactivity is in ms and frozen while paused or in an expected idle. | service |
| `engagement` | `task_engagement_score` | 0–1, or null until there is enough history | **heuristic**, shown in the developer panel only, **never used to adapt** |
| `camera.running` / `suspended` / `backend` / `delegate` / `processedFps` / `inferenceMs` / `droppedFrames` | `FaceObserver.observerStatus` / `.perf` | in-page, immediate | runtime |
| `camera.tracking` / `calibration` / `calibrationProgress` / `calibrationReason` | `FaceObserver.onProcessorStatus` | in-page, immediate | rule |
| `service.status` / `stale` / `reason` | `GameAdapter.getLatestState()` / `onConnectionStatus` | `open`, `reconnecting`, `failed`, and so on | transport |
| `visionUsable` / `visionBlockedReason` | derived in `snapshot.ts` | bool / reason code | the gate that vision-driven adaptation passes through |
| `CameraGesture` | `gesture` event | `blink`, `nod` or `head_shake`; producer-clock ms; amplitude in degrees | **heuristic**. Shown in the developer panel only. **Never an answer**, because Memoria has no gesture input. |
| `CameraSuggestion` | `suggested_action` | `action`, `source`, `task_id`, `reason`, `evidence` and `expires_in_ms`, copied unchanged | service suggestion |

`visionUsable` is true only when every one of these holds: adaptation is switched on, the service is open and not stale, the camera is running and not suspended, the vision data is fresh, both the service and the local processor report calibrated, tracking is valid, and the service's vision gate is `active`.

### Gameplay telemetry to service events

| Memoria telemetry (`src/Telemetry.ts`) | Service game event |
|---|---|
| `step_start` | `task_started`, `task_id = <missionId>:<stepIndex>` (one task is one step) |
| `question_shown` | Starts the response-time mark (§4.4 `answerLatency`) |
| `answer_selected` | `answer_submitted {correct, response_ms}`. After a level-3 reveal it becomes `player_activity answer_after_reveal` instead. |
| `hint_shown` | `hint_shown {hint_level}` |
| `step_end` | independent → `task_completed success`; cued → `success_with_help`; revealed → `revealed`; skipped → `task_skipped` |
| `pause` / `resume` | `paused` / `resumed` |
| `restart`, level list, camera turned off | `task_skipped` for the open task |
| `room_enter`, `object_interact`, `object_dwell`, WASD, mouse-look, clicks | `player_activity`, at most one every 2 s except room and interact events |
| Tab hidden / shown | `expected_idle_start` / `expected_idle_end`. A hidden tab is never counted as inactivity. |
| Camera stopped or page closed | `DELETE /v1/sessions/{id}`, which ends the session |

`client_ts_ms` is `State.elapsed()`, which already excludes paused time, offset so it stays monotonic across attempts. Every event gets a unique `event_id`, and `GameAdapter` resends it unchanged until the service acknowledges it, so retries and reconnects are idempotent. The game's own §4.3 and §4.4 telemetry, summary and JSON export are unchanged.

## Adaptation rules

The service suggests. Its thresholds are in `CAMERA/service/app/config.py` and can be set with `OBS_POLICY__*`. The game then decides, using `DEFAULT_ADAPTATION_CONFIG` in `AdaptationPolicy.ts`.

| Rule | Service trigger (defaults) | Game policy | What the game does |
|---|---|---|---|
| **Hold a new instruction** | Head away ≥ 1.5 s. It holds at most 8 s per away episode, with a 5 s cooldown. | Vision gate open; not simulated; game cooldown 5 s; applied at the next step boundary | The next step's text appears at once. Its speech waits until the head turns back or the vision gate closes, for at most 10 s. |
| **One gentle cue** | Head away ≥ 6 s **and** no gameplay input for ≥ 10 s, inside a task. At most 1 per task, with a 60 s cooldown. | Vision gate open; step at least 5 s old; at most 1 per step; game cooldown 60 s. If deferred, it is dropped when the head is back by the time it could apply. | Shows and speaks the pack's own `hints.repeat` line once. It is not a hint level and does not change the outcome. |
| **Offer a hint** | ≥ 2 errors in the last 6 answers, **and** the latest response ≥ 1.25 × the median of earlier ones (at least 3 response times). At most 1 per task, with a 30 s cooldown. | Gameplay-sourced suggestions only; waits 1.2 s after the last answer (safe point); step at least 3 s old; at most 1 per step | `runner.requestHint()` moves the game's own hint ladder to its next rung early. Levels, telemetry and §4.3 scoring stay the same. |
| **Increase difficulty** | 5 independent successes in a row, without slowing, with a 180 s cooldown | Always rejected with `no_difficulty_mechanism` and logged | Nothing. Memoria has no difficulty setting, and nothing ever lowers difficulty. |

**Checks every suggestion passes.** Each suggestion is checked in this order. Each check records a reason when it rejects:

1. A duplicate id is rejected.
2. An expired suggestion (past `min(expires_in_ms, 10 s)`) is rejected.
3. If adaptation is switched off, the suggestion is rejected.
4. A vision-sourced suggestion is rejected unless the vision gate is open, and simulated data is always rejected.
5. A hint or difficulty change without gameplay evidence is rejected.
6. A difficulty change is always rejected, because Memoria has no mechanism for it.
7. While the game is paused, the suggestion is deferred.
8. On the level list or summary, the suggestion is rejected.
9. A suggestion for a stale task, or with no task, is rejected.
10. A suggestion inside its game cooldown is rejected.
11. A suggestion over the per-step limit is rejected.
12. Outside a safe point, the suggestion is deferred.
13. Finally, the hook is called, and it can still refuse.

**What never triggers adaptation on its own:** head direction, eye closure, face loss and expression cannot trigger a hint, and nothing can lower difficulty. Face loss or stale data closes the vision gate and releases any held instruction.

**The adaptation log.** Every decision is recorded separately from the game's telemetry, whether it was applied or rejected, with its reason. Each record includes the trigger, the evidence, the source, the vision gate, the remaining cooldowns, the game state, the attempt and task, and how long the suggestion waited. The log is at `__memoria.camera.adaptations`, in the developer panel, and in the console as `[memoria] camera · adaptation …`.

## Turning camera support off

- **For one session.** Press the **Camera** chip (bottom-right), then **Stop camera**. You can also press **Turn camera off** on the setup sheet. Either stops the camera, closes both sockets and deletes the session.
- **Keep the camera but stop adapting.** Clear **Adapt the game to the camera** in the chip panel. The service is also told to stop making vision suggestions. This setting is remembered as `memoria-camera-adaptation-v1`.
- **Entirely.** Never press the button. Nothing loads until you do, and the game does not need the service. `cd "3D game" && npm run dev` runs the game alone, exactly as before.

## Verification

Run from this folder: `npm run check` for everything fast, `npm run check -- --full` to add the slower browser checks, or `npm run check:e2e` for the end-to-end check only. Stop `npm run dev` first, because some checks start their own service on port 8765.

### Results (2026-09-25, macOS, Node 26, Python 3.12, Chrome headless)

| Check | Result | What it proves |
|---|---|---|
| Camera service `pytest` | 62 passed, the same as before | The service is unchanged |
| Camera web `tsc` + `vitest` | clean · 114 passed, the same as before | The camera app is unchanged |
| Camera web `integration-check` | passed | Real transport and policy against the real service, with synthetic data |
| Camera web `check:browser` | passed | **The standalone camera app still works** (fake camera) |
| Game `npm run check` | 13 suites passed | The existing 12 suites plus `camera.check.ts` (130 assertions). `pack.check.ts` gained assertions for the runner hooks. |
| Game `npm run build` | passed | Camera code lands in lazy chunks only (`runtime`, `vision_bundle`, `landmarker`, the worker) |
| Game `check:offline` | passed | The camera-off game with no network: every asset resolves and no remote request succeeds |
| `scripts/camera-e2e.mjs` | 70 passed | See below |
| `npm run dev` then Ctrl+C | verified | Service healthy; game, service and standalone app answer; the game's origin gets 201 and a foreign origin gets 403; after Ctrl+C every process has stopped and every port is free |

The end-to-end check has three parts:

- **Scenario A, camera off.** The level plays to its summary. No request reaches the service, no camera code, WASM or model is downloaded, `getUserMedia` is never called, and no service WebSocket opens.
- **Scenario B, injected observations.** These are **synthetic, labelled `simulated: true`, and accepted only because the test explicitly opts in**. They travel through the real `ProducerConnection` → service → `GameAdapter` → `CameraAdapter` → policy → runner. The run shows:
  - **Connection and events:** one session and exactly two sockets. The game's events reach the service, whose state shows the current task, pause and resume, answers with correctness, and hints.
  - **Adaptations:** sustained head-away leads to `delay_instruction`, which is applied: the next step's speech is held with its text shown, and released when the head turns back. Head-away plus inactivity leads to one gentle cue, using the pack's own words and leaving the hint level unchanged. Repeated wrong answers with slowing responses lead to `offer_hint`, which is deferred about 1.2 s to a safe point and then applied through the game's own ladder.
  - **Gating and holds:** switching adaptation off stops all changes. Stale observations and face loss close the gate, and head-away time goes back to null. Level switches and restarts open no new sockets and create no second session. A network drop is detected, the link recovers by itself, and no suggestion is applied twice.
  - **Shutdown and failure:** Stop camera closes every socket and deletes the session. When the service is killed mid-session, the game stays playable and the chip says so.
- **Scenario C, Chrome's fake camera device** (a test pattern with no face):
  - **Setup:** the level-list button opens the setup sheet. The real `FaceObserver` starts inside the game, with the worker backend. There is exactly one `getUserMedia` call and no page reload.
  - **Real-pipeline data:** real observations reach the service and come back to the game as fresh, not simulated. The game server serves the WASM runtime and the model, and the asset route refuses path traversal.
  - **Gating:** with no face, adaptation stays held. Calibrate runs the camera app's own flow, which fails with `insufficient_samples`, and the gate stays closed.
  - **Lifecycle:** level switches do not reopen the camera. A hidden tab suspends the pipeline and tells the service `expected_idle`; restoring the tab resumes both. Stop ends every camera track and deletes the session. The page throws no uncaught exceptions.

**Intermittent result.** In the first combined `npm run check -- --full` run, the end-to-end step failed once. Its details were lost, because that run's output was truncated. The next six runs passed, including one from a cold Vite cache. If it recurs, run `npm run check:e2e` to see the failing assertion.

### Not verified here

These need a real webcam and a person:

- Head-away detection and calibration quality with a real face.
- Gestures.
- Whether the thresholds feel right to play with. They are initial defaults and have not been tuned with players.
- Spoken-instruction timing with real speech synthesis. Headless Chrome is muted.
- GPU versus CPU performance on the machine the game will be demonstrated on.

Also not run: the camera app's `check:demo`, because it needs a `.y4m` video containing a real face (`DEMO_VIDEO=face.y4m npm run check -- --full`), and the game's `check:profile`.

### Manual webcam check (about 5 minutes)

1. `npm run dev`, open http://localhost:5173/, press **Camera support (optional)**, then **Turn on camera**, and allow the camera. The four steps should turn to ✓ up to Calibration. The preview is bottom-right.
2. Sit normally, look at the middle of the screen, press **Calibrate** and hold still for about 3 s. The sheet should say *Ready*. Press **Start playing**.
3. Open the chip's **Developer details**. The vision gate should read `OPEN` and attention `HEAD_TOWARD_SCREEN`. Turn your head well away: attention should become `HEAD_AWAY` and head-away ms should climb.
4. Keep your head turned away, then press **K** to skip a step. The new instruction text appears at once, but it is spoken only when you turn back, or after at most 8 s. The log should show `delay_instruction → applied`.
5. Keep your head turned away without touching anything for about 10 s. One gentle cue, the step's own repeat line, should appear. It should not appear again in that step.
6. Cover the camera or leave the frame. The chip should read *Face not in view · adaptation held*, and nothing should adapt.
7. On a question step, pick wrong answers three times, taking longer each time. One hint should arrive about a second after your last answer.
8. Clear **Adapt the game to the camera** and repeat step 4: nothing should be held. Press **Stop camera**: the camera light goes off, and `http://127.0.0.1:8765/health` should show `sessions: 0`.
9. Deny camera permission, or stop the service with Ctrl+C in its terminal, and repeat step 1. You should see a clear message, and **Continue without camera** should let you play normally.

### Known limitations

- **Gestures** are surfaced in the developer panel only. Memoria has no gesture input, so gesture answers stay disabled and ordinary head movement can never answer.
- **Increase difficulty** is logged and rejected, because Memoria has no difficulty setting.
- **Service sessions are in memory.** If the service restarts, the game's link ends with `session_not_found`. Adaptation holds, and pressing **Turn on camera** again starts a new session.
- **The camera always starts off.** It never starts by itself on reload; only the adaptation switch and the preview-collapsed setting are remembered.
- **Loopback only.** Remote or HTTPS deployment is not set up; see Environment.
- **Build size.** `npm run build` still prints Vite's chunk-size warning for the main game chunk. The camera code is in separate lazy chunks.
