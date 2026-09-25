# Graph Report - CAMERA  (2026-09-25)

## Corpus Check
- 50 files · ~60,893 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 2, .lock 1, .example 1)

## Summary
- 1075 nodes · 2469 edges · 46 communities (35 shown, 9 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 80 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- SessionEngine
- test_engine.py
- test_api.py
- types.ts
- create_app
- GameAdapter.ts
- package.json
- Session
- PolicyConfig
- compilerOptions
- ObservationBody
- signals.ts
- FaceObserver
- landmarker.ts
- integration-check.ts
- ProducerConnection.ts
- ProducerConnection
- Player observation service
- GameAdapter
- transport.test.ts
- schemas.py
- demo-check.mjs
- validate.ts
- demo/main.ts
- VisionBridge.ts
- observation.ts
- VisionBridge
- Backoff
- sessions.py
- Unsubscribe
- GameEventMessage
- InstructionHold
- setup-assets.mjs
- .constructor
- Memoria 3D × player observation — optional camera assistance
- IngestError
- createObservation
- Connection
- .evaluate
- VisionBridgeCallbacks
- _BoundedSet
- WebSocketLike
- apply.sh
- unapply.sh

## God Nodes (most connected - your core abstractions)
1. `FaceObserver` - 53 edges
2. `GameAdapter` - 52 edges
3. `ProducerConnection` - 52 edges
4. `SessionEngine` - 43 edges
5. `create_app()` - 43 edges
6. `Harness` - 43 edges
7. `SignalProcessor` - 37 edges
8. `ObservationBody` - 33 edges
9. `Strict` - 29 edges
10. `run()` - 23 edges

## Surprising Connections (you probably didn't know these)
- `setup()` --calls--> `VisionBridge`  [EXTRACTED]
  integrations/memoria-3d/bridge.check.ts → integrations/memoria-3d/VisionBridge.ts
- `Running` --references--> `VisionBridge`  [EXTRACTED]
  integrations/memoria-3d/observation.ts → integrations/memoria-3d/VisionBridge.ts
- `SessionEngine` --uses--> `PolicyConfig`  [INFERRED]
  service/app/engine.py → service/app/config.py
- `SessionStore` --uses--> `PolicyConfig`  [INFERRED]
  service/app/sessions.py → service/app/config.py
- `Harness` --uses--> `PolicyConfig`  [INFERRED]
  service/tests/test_engine.py → service/app/config.py

## Import Cycles
- None detected.

## Communities (46 total, 9 thin omitted)

### Community 0 - "SessionEngine"
Cohesion: 0.10
Nodes (26): DerivedState, EngagementScore, GameplayState, _median(), Per-session engine: ordering/dedup, derived state, and the deterministic…, Time-weight the previous observation over the interval up to this one., Returns (vision, attention_state, attention_reason, usable_for_adaptation)., task_engagement_score: a documented heuristic, null until enough gameplay.… (+18 more)

### Community 1 - "test_engine.py"
Cohesion: 0.12
Nodes (31): gesture(), answer(), Harness, parametrize, Engine tests: gating, staleness, ordering, and gameplay-driven policy., A producer whose clock runs far ahead or behind must not affect freshness., Drives one engine with a producer and a game on independent clocks., test_calibrating_gates_state_actions_and_gestures() (+23 more)

### Community 2 - "test_api.py"
Cohesion: 0.15
Nodes (30): game_event(), m(), observation(), Any, Builders for well-formed messages, so each test only states what it cares about., auth(), create(), parametrize (+22 more)

### Community 3 - "types.ts"
Cohesion: 0.08
Nodes (24): AckMessage, ActionType, ApiErrorBody, CalibrationInfo, CloseCode, EngagementScore, ErrorMessage, GameEventData (+16 more)

### Community 4 - "create_app"
Cohesion: 0.12
Nodes (26): FastAPI, ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state() (+18 more)

### Community 5 - "GameAdapter.ts"
Cohesion: 0.12
Nodes (12): DerivedState, GameEventInput, GestureEventMessage, HelloMessage, SuggestedActionMessage, AdapterState, GameAdapterApi, WebSocketFactory (+4 more)

### Community 6 - "package.json"
Cohesion: 0.06
Nodes (40): @types/node, @types/ws, typescript, vite, ws, dependencies, @mediapipe/tasks-vision, devDependencies (+32 more)

### Community 7 - "Session"
Cohesion: 0.12
Nodes (8): HeartbeatMessage, BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket, StateMessage

### Community 8 - "PolicyConfig"
Cohesion: 0.11
Nodes (15): BaseSettings, fixture, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig. (+7 more)

### Community 9 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 10 - "ObservationBody"
Cohesion: 0.07
Nodes (25): matrixFromPlayerAngles(), Motion, SimulatedFaceSource, SimulationControls, ObservationBody, ObservationMessage, FaceFrame, SignalProcessorApi (+17 more)

### Community 11 - "signals.ts"
Cohesion: 0.05
Nodes (58): AngleMeasurement, BoolMeasurement, CalibrationStatus, DurationMeasurement, HeadOrientation, OrientationMeasurement, RatioMeasurement, TrackingStatus (+50 more)

### Community 12 - "FaceObserver"
Cohesion: 0.06
Nodes (26): PerfInfo, VerifyState, FaceObserverApi, FaceObserverOptions, ObserverStatus, Aborted, absoluteUrl(), errMsg() (+18 more)

### Community 15 - "landmarker.ts"
Cohesion: 0.06
Nodes (36): @mediapipe/tasks-vision, vitest, DEFAULT_SIGNAL_CONFIG, DetectedHeadGesture, HeadGestureConfig, HeadGestureDetector, HeadGestureType, Sample (+28 more)

### Community 16 - "integration-check.ts"
Cohesion: 0.11
Nodes (25): AdapterProbe, assert(), freePort(), m(), main(), makeProducer(), now(), originFetch (+17 more)

### Community 17 - "ProducerConnection.ts"
Cohesion: 0.10
Nodes (23): CreateSessionRequest, streamUrl(), toWebSocketUrl(), trimBaseUrl(), ProducerConnectionApi, ProducerConnectionOptions, detach(), MAX_GESTURES_PER_OBSERVATION (+15 more)

### Community 19 - "Player observation service"
Cohesion: 0.06
Nodes (31): 1. Create a session, 2. Connect the adapter and map callbacks to your game, 3. Report gameplay events, 4. Optional: run the camera producer in the game page, 5. Shut down, Connecting a game, Hooks to provide in your game, Attention state (+23 more)

### Community 20 - "GameAdapter"
Cohesion: 0.15
Nodes (5): ServerMessage, ConnectionStatus, detach(), GameAdapter, noop()

### Community 21 - "transport.test.ts"
Cohesion: 0.12
Nodes (14): body(), derivedState(), FakeSocket, httpProducer(), m(), makeAdapter(), makeProducer(), noJitter() (+6 more)

### Community 22 - "schemas.py"
Cohesion: 0.18
Nodes (21): Player-observation service: ingests derived webcam measurements and gameplay…, FastAPI application: HTTP endpoints, the WebSocket stream and the background…, AckMessage, CalibrationInfo, CreateSessionRequest, CreateSessionResponse, GameEventData, Gesture (+13 more)

### Community 23 - "demo-check.mjs"
Cohesion: 0.11
Nodes (21): cdp(), chrome, click(), clickEv(), ev(), page, pending, procs (+13 more)

### Community 24 - "validate.ts"
Cohesion: 0.22
Nodes (21): SCHEMA_VERSION, ACTION_SOURCES, ACTION_TYPES, allNumbersFinite(), ATTENTION_STATES, GESTURE_TYPES, hasVersion(), isDerivedState() (+13 more)

### Community 25 - "demo/main.ts"
Cohesion: 0.21
Nodes (18): endSession(), fmt(), log(), onObservation(), renderAction(), renderGesture(), renderObserverStatus(), renderProcessorStatus() (+10 more)

### Community 26 - "VisionBridge.ts"
Cohesion: 0.16
Nodes (12): eq(), FakeAdapter, ok(), setup(), CAMERA_ASSIST_STORAGE_KEY, DelayInstructionSuggestion, InstructionHoldOptions, OUTCOME_MAP (+4 more)

### Community 27 - "observation.ts"
Cohesion: 0.19
Nodes (14): enable(), teardown(), createPanel(), describeCalibration(), describeCameraError(), log(), LOOPBACK, Observation (+6 more)

### Community 29 - "Backoff"
Cohesion: 0.18
Nodes (9): Backoff, backoffDelay(), classifyClose(), CloseOutcome, DEFAULT_RECONNECT, fatalHttpReason(), finiteOr(), resolveReconnectOptions() (+1 more)

### Community 30 - "sessions.py"
Cohesion: 0.22
Nodes (8): IngestStatus, _BufferedEvent, _Producer, GestureEventMessage, GestureEventMessage, SuggestedActionMessage, In-memory session store. Sessions live in this process only: run a single…, SuggestedActionMessage

### Community 31 - "Unsubscribe"
Cohesion: 0.20
Nodes (3): ConnectionStatusEvent, Unsubscribe, BoundedSet

### Community 32 - "GameEventMessage"
Cohesion: 0.18
Nodes (6): model_validator, _Answer, Freeze the inactivity clock while paused or in an expected idle period., _Source, _Task, GameEventMessage

### Community 34 - "setup-assets.mjs"
Cohesion: 0.33
Nodes (10): copyWasm(), exists(), fail(), installModel(), modelDst, sha256(), verify(), wasmDst (+2 more)

### Community 35 - ".constructor"
Cohesion: 0.22
Nodes (3): GameEventMessage, GameAdapterOptions, randomId()

### Community 36 - "Memoria 3D × player observation — optional camera assistance"
Cohesion: 0.22
Nodes (8): Disable / remove, Files here, Install and run, Mapping, Memoria 3D × player observation — optional camera assistance, Not verified, Verified (in a scratch copy of the game, never the original), What the patch changes in the game

### Community 37 - "IngestError"
Cohesion: 0.28
Nodes (7): IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., ObservationMessage, test_duplicate_and_out_of_order_observations(), test_second_producer_cannot_take_over_while_first_is_active(), test_session_mismatch_rejected()

### Community 38 - "createObservation"
Cohesion: 0.36
Nodes (6): createObservation(), disable(), setEnabled(), readCameraAssist(), StorageLike, writeCameraAssist()

### Community 39 - "Connection"
Cohesion: 0.33
Nodes (3): Connection, Any, One WebSocket client. Outgoing messages go through a bounded queue so a slow…

## Knowledge Gaps
- **175 isolated node(s):** `OUTCOME_MAP`, `SuggestionFate`, `VisionBridgeOptions`, `InstructionHoldOptions`, `apply.sh script` (+170 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 335 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FaceObserver` connect `FaceObserver` to `demo/main.ts`, `ObservationBody`, `signals.ts`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `ProducerConnection` connect `ProducerConnection` to `GameAdapter.ts`, `ObservationBody`, `WebSocketLike`, `integration-check.ts`, `ProducerConnection.ts`, `GameAdapter`, `transport.test.ts`, `demo/main.ts`, `Backoff`, `Unsubscribe`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `ObservationBody` connect `ObservationBody` to `types.ts`, `GameAdapter.ts`, `signals.ts`, `FaceObserver`, `landmarker.ts`, `integration-check.ts`, `ProducerConnection.ts`, `ProducerConnection`, `transport.test.ts`, `demo/main.ts`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `SessionEngine` (e.g. with `PolicyConfig` and `AngleMeasurement`) actually correct?**
  _`SessionEngine` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `create_app()` (e.g. with `PolicyOverrides` and `IngestError`) actually correct?**
  _`create_app()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `OUTCOME_MAP`, `SuggestionFate`, `VisionBridgeOptions` to the rest of the system?**
  _175 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `SessionEngine` be split into smaller, more focused modules?**
  _Cohesion score 0.10384068278805121 - nodes in this community are weakly interconnected._