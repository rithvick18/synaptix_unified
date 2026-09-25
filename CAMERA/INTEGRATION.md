# Connecting a game

The game talks to the service through **`GameAdapter`**. The camera is a separate producer
(`FaceObserver` → `ProducerConnection`) on its own connection. It can live in the same page,
in another page, or be absent. The adapter never opens a camera, and it never changes game
state itself: it calls your callbacks, and you map them to your game's functions.

```
 camera page / module                    service                       game
 ┌──────────────────────┐   observations  ┌──────────┐  state, gestures,  ┌─────────────┐
 │ FaceObserver ──────▶ │ ──────────────▶ │ derive + │ ─────────────────▶ │ GameAdapter │
 │ ProducerConnection   │   (producer WS) │ policy   │ ◀───────────────── │  callbacks  │
 └──────────────────────┘                 └──────────┘   game events      └─────────────┘
```

## 1. Create a session

```ts
import { createSession } from './transport/session.ts'

const session = await createSession('http://127.0.0.1:8765')
// session.consumer_token -> GameAdapter;  session.producer_token -> ProducerConnection
```

Create the session wherever it suits your setup:

- **Game page.** Create it in the page, as the demo and the Memoria 3D patch do.
- **Game backend.** Create it on the server and hand the tokens to the page in a response
  body.
- **Never a URL.** Do not put tokens in URLs or logs.

## 2. Connect the adapter and map callbacks to your game

```ts
import { GameAdapter } from './transport/GameAdapter.ts'

const adapter = new GameAdapter({
  baseUrl: 'http://127.0.0.1:8765',
  sessionId: session.session_id,
  consumerToken: session.consumer_token,
  sourceId: 'my-game',
  visionAdaptationEnabled: settings.cameraAssist // your visible toggle
})

const offs = [
  adapter.onSuggestedAction((a) => {
    switch (a.action) {
      case 'delay_instruction':   // head turned away: hold the NEXT new instruction
        instructions.deferNext({ maxDelayMs: Number(a.evidence.max_delay_ms) })
        break
      case 'gentle_cue':          // away + inactive: one neutral cue
        ui.showGentleCue()
        break
      case 'offer_hint':          // performance-driven
        if (a.task_id === currentTaskId) hints.offerNext()
        break
      case 'increase_difficulty': // performance-driven, "small"
        difficulty.suggestSmallIncrease(a.evidence)
        break
    }
  }),
  adapter.onGesture((g) => { if (g.gesture.type === 'nod') ui.onNod() }),
  adapter.onState((s) => hud.setHoldInstructions(s.state?.policy.hold_new_instructions ?? false)),
  adapter.onConnectionStatus((e) => hud.setServiceStatus(e.status, e.reason))
]
await adapter.connect()
```

**Rules of thumb:**

- **Treat actions as suggestions.** The game decides. Every action has a `reason`,
  `evidence`, `source` and `expires_in_ms`.
- **Consumed once.** Each `action_id` and `gesture_id` fires once per adapter, even after
  reconnects that replay buffered events.
- **Stale means unknown.** `getLatestState()` returns `state: null` whenever the connection
  is stale. Treat that as "unknown", never as "looking at the screen".
- **Vision-sourced actions are opt-in.** While vision adaptation is disabled, `source:
  'vision'` and `'vision+gameplay'` actions are not delivered. The service also stops
  producing them (`adaptation_setting` event).
- **Difficulty follows performance only.** Do not lower difficulty because of anything
  the camera sees. The service never suggests that.

## 3. Report gameplay events

```ts
adapter.sendGameEvent({ event_type: 'task_started', task_id: 'level-2:step-1' })
adapter.sendGameEvent({ event_type: 'answer_submitted', task_id: 'level-2:step-1', data: { correct: false } })
adapter.sendGameEvent({ event_type: 'hint_shown', task_id: 'level-2:step-1', data: { hint_level: 1 } })
adapter.sendGameEvent({ event_type: 'task_completed', task_id: 'level-2:step-1', data: { outcome: 'success_with_help' } })
adapter.sendGameEvent({ event_type: 'paused' })            // and 'resumed'
adapter.sendGameEvent({ event_type: 'player_activity', data: { activity: 'moved' } })
adapter.sendGameEvent({ event_type: 'expected_idle_start' }) // cut-scene / narration; 'expected_idle_end'
```

- **Clock.** `client_ts_ms` defaults to `performance.now()`. Pass your own monotonic game
  clock if you have one; a pause-aware clock is fine. Response times are computed from
  your clock and exclude paused time. Alternatively, supply `data.response_ms` directly.
- **Retries.** Events are kept until acked and resent after a reconnect with the same
  `event_id`, so retries are idempotent.
- **Inactivity.** Send `player_activity` for meaningful input (movement, interaction), so
  inactivity reflects real idleness. Send `paused`/`resumed` and expected-idle markers, so
  the policy never nudges during pauses or narration.

## 4. Optional: run the camera producer in the game page

```ts
import { FaceObserver } from './vision/FaceObserver.ts'
import { ProducerConnection } from './transport/ProducerConnection.ts'

const producer = new ProducerConnection({
  baseUrl, sessionId: session.session_id, producerToken: session.producer_token, producerId: 'game-camera'
})
await producer.connect()
const observer = new FaceObserver({ video: previewVideo, overlay: previewCanvas })
observer.onObservation((body) => producer.submit(body))
observer.onStatus((s) => { if (s.kind === 'error') ui.showCameraProblem(s.code) }) // never simulate instead
await observer.start()      // asks for permission
observer.startCalibration() // show your own "look at the centre and hold still" prompt
```

Serve `public/mediapipe/wasm/` and `public/models/face_landmarker.task` (copy them from
`web/public` after `npm run setup:assets`). Your bundler must emit the worker as an ES
module; in Vite, use `worker: { format: 'es' }`.

## 5. Shut down

```ts
observer?.stop(); producer?.disconnect()
offs.forEach((off) => off()); adapter.disconnect()
await deleteSession(baseUrl, session.session_id, session.consumer_token)
```

`stop()` and `disconnect()` release everything: camera tracks, the inference loop, the
worker, sockets and timers. Both are idempotent.

## Hooks to provide in your game

| Adapter output | Suggested game hook | Notes |
|---|---|---|
| `delay_instruction` / `state.policy.hold_new_instructions` | defer speaking/showing the next *new* instruction | cap at `evidence.max_delay_ms`; never block progress |
| `gentle_cue` | one neutral re-statement of the current goal | at most once per task by policy |
| `offer_hint` | advance your hint ladder by one step or offer a hint button | performance-driven |
| `increase_difficulty` | optional small increase, if your game has a knob | never decrease from vision |
| `gesture: nod / head_shake` | optional yes/no affordance | heuristic; always keep a non-camera input |
| connection `failed` / state `null` | fall back to normal behaviour | the game must be fully playable without the service |

For a worked example on a real game, see [integrations/memoria-3d/](integrations/memoria-3d/).
