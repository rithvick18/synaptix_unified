# Memoria 3D × player observation — optional camera assistance

> **Superseded in the Memoria_Unified workspace.** There the game imports `CAMERA/web/src`
> in place (no vendored copy) — see `../../../README.md` and `3D game/src/camera/`. This
> patch is kept for applying the integration to a standalone checkout of the game.

A patch that adds **optional, off-by-default** camera assistance to the Memoria 3D game
(`/Users/rithvick/Desktop/3D game`). With it off, the game behaves exactly as before: no
network request, no camera, and none of the observation code is loaded. With it on, the
game sends its telemetry to the local observation service and acts on the suggestions that
come back, all through the game's own hint ladder.

## Files here

| File | What it is |
| --- | --- |
| `VisionBridge.ts` | Pure mapping layer (becomes `src/observation/VisionBridge.ts`). Type-only imports of the contracts, no implementation classes, never touches a game object. Also holds the on/off preference helpers and `InstructionHold`. |
| `observation.ts` | Game-side setup/teardown (becomes `src/observation/observation.ts`). |
| `memoria-3d.patch` | Unified diff for the game, `git apply` at its root. Contains copies of the two files above. |
| `apply.sh` / `unapply.sh` | Install / remove (see below). |
| `bridge.check.ts` | Headless check of the bridge with a fake `GameAdapterApi`: `node integrations/memoria-3d/bridge.check.ts` (Node ≥ 23.6). |

## What the patch changes in the game

| Path | Change |
| --- | --- |
| `src/observation/VisionBridge.ts` | new |
| `src/observation/observation.ts` | new — creates the session, GameAdapter, FaceObserver + ProducerConnection, preview + Calibrate; all vendored code is imported dynamically on enable |
| `src/Missions.ts` | `instructionGate` field (null = speak at once, as before), `requestHint()`, `gentleCue()`; `beginStep` speaks through `speakInstruction()` |
| `src/main.ts` | +4 lines: import, `createObservation({ state, telemetry })` after the existing `telemetry.onEvent` assignment (it **chains**, calling the original first), `cameraAssist:` on the level list, `observation.attach(runner)` |
| `src/ui.ts` | optional `cameraAssist` on `LevelSelectView`: a button "Camera assistance (optional): Off/On" and the note "Video stays on this computer." |
| `vite.config.ts` | `worker: { format: 'es' }` |
| `.gitignore` | `/public/mediapipe/`, `/public/models/face_landmarker.task` |

`apply.sh` additionally (not in the patch): copies `web/src/{protocol,transport,vision}` (no
tests) into `src/observation/vendor/`, the WASM runtime and face model into `public/`, and
runs `npm install --save-exact @mediapipe/tasks-vision@<web's version>` (changes
`package.json` / `package-lock.json`; skip with `--no-npm`).

## Install and run

```sh
# once, in the observation project
cd /Users/rithvick/Desktop/CAMERA/web && npm install && npm run setup:assets

# into a clean checkout of the game (refuses a dirty tree; re-running only refreshes vendor + assets)
/Users/rithvick/Desktop/CAMERA/integrations/memoria-3d/apply.sh "/path/to/3D game"

# service (default http://127.0.0.1:8765; allows http://localhost:5173)
cd /Users/rithvick/Desktop/CAMERA/service && .venv/bin/python -m app

# game
cd "/path/to/3D game" && npm run dev        # http://localhost:5173
```

On the level list press **Camera assistance (optional)**. A small preview appears in the
bottom-right corner while the camera is on; press **Calibrate** while looking at the screen.
Another service address can be set at build time with `VITE_OBSERVATION_URL`; anything that
is not loopback (`127.0.0.1`, `localhost`, `[::1]`) is refused.

## Mapping

Telemetry → service game events (`client_ts_ms` = `State.elapsed()`, paused time removed,
offset so it stays monotonic across `resetTimers()`):

| Telemetry | Game event |
| --- | --- |
| `mission_start` | (remembers mission id) |
| `step_start` | `task_started`, `task_id = <missionId>:<step>` |
| `question_shown` | (response-time mark) |
| `answer_selected` | `answer_submitted {correct, response_ms}`; after a level-3 reveal → `player_activity answer_after_reveal` |
| `object_interact` | `player_activity object_interact` (doors are interactables; a correct find is the `step_end` that follows) |
| `room_enter` / `object_dwell` | `player_activity` (dwell at most once per 5 s) |
| `hint_shown` | `hint_shown {hint_level}` |
| `step_end` | independent → `task_completed success`; cued → `success_with_help`; revealed → `revealed`; skipped → `task_skipped` |
| `pause` / `resume` | `paused` / `resumed` |
| `restart`, level list | open task → `task_skipped` |

Suggestions → game (only via the runner's public methods; stale `task_id` ≠ current task is
ignored; vision-sourced ones are ignored while vision adaptation is off):

| Action | Callback | What the game does |
| --- | --- | --- |
| `offer_hint` | `onOfferHint` | `runner.requestHint()` — next ladder level now, if level < 3 and not paused. Same levels, telemetry and §4.3 scoring. |
| `gentle_cue` | `onGentleCue` | `runner.gentleCue()` — the pack's `hints.repeat`, shown if no hint is up and spoken; once per step; not a hint level, outcome unchanged. |
| `delay_instruction` | `onDelayInstruction` | `InstructionHold.open(max_delay_ms)`: a *new* step's text shows at once, its speech waits until the service stops holding (head back) or the window ends (≤ 10 s cap). Dropped if the step moved on, a hint spoke, or the game is paused. Never blocks progress. |
| `increase_difficulty` | `onIncreaseDifficulty` | Logged and recorded in `bridge.suggestions` only — Memoria has no difficulty setting. |

## Disable / remove

- In the game: press the toggle again (stops camera, closes sockets, deletes the session,
  removes the preview; stored as `memoria-camera-assist-v1 = '0'` in localStorage).
- Remove entirely: `unapply.sh "/path/to/3D game"` (reverses the patch, restores
  `package.json`/`package-lock.json`, deletes `src/observation/`, `public/mediapipe/`,
  `public/models/face_landmarker.task`). Blunt alternative on an otherwise clean tree:
  `git checkout -- . && git clean -fd src/observation && rm -rf public/mediapipe public/models/face_landmarker.task`.

## Verified (in a scratch copy of the game, never the original)

- `bridge.check.ts`: 62 assertions pass (mapping, outcome table, stale task, no-task,
  vision gating, toggle + persistence, restart, adoption mid-step, instruction hold); it
  also typechecks under the game's strict tsconfig.
- `apply.sh` on a clean copy, re-run (idempotent), `unapply.sh` back to a clean tree, re-apply.
- `npm run build` passes; `npm run check` passes (12 suites, 366 assertions, as before).
- `node tools/offline-check.mjs`: 803 assertions pass, same as the unpatched baseline; no
  request to the service, no observation chunk, model or WASM loaded with the toggle off.
- Headless Chrome with a fake camera against a private service instance (33 checks): off —
  no request, no `getUserMedia`, nothing stored; on — session on loopback, consumer and
  producer sockets, worker backend running (ES-module worker), observations flowing,
  `adaptation_setting true` after the camera starts, `task_started`/`hint_shown`/
  `task_skipped` frames, `requestHint()` refused while paused, one gentle cue per step,
  summary and export shape unchanged; off again — preview gone, session deleted, no more
  observations.

## Not verified

- Suggestions *emitted by the service* in a live session (needs a real face turning away,
  or repeated errors): the callbacks were exercised directly and with the fake adapter.
- Calibration quality and head-away detection with a real person; GPU vs CPU delegate on
  the demo machine; spoken-instruction timing with real speech synthesis.
- `npm run check:profile` (headless Chrome editor harness) was not run.
