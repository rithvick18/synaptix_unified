# Graph Report - CAMERA  (2026-09-25)

## Corpus Check
- Corpus is ~12,814 words - fits in a single context window. You may not need a graph.

## Summary
- 408 nodes · 822 edges · 15 communities (12 shown, 1 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 53 edges (avg confidence: 0.95)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Engine State Derivation
- Engine Policy Tests
- Test Message Builders
- Wire Protocol Types
- FastAPI Routes
- Adapter Contracts
- Web Dependencies
- Session Fan-out
- Settings And Thresholds
- TypeScript Config
- Observation Pipeline Contract
- Vision Contracts
- Engagement Score Type

## God Nodes (most connected - your core abstractions)
1. `SessionEngine` - 43 edges
2. `create_app()` - 43 edges
3. `Harness` - 43 edges
4. `Strict` - 29 edges
5. `create()` - 20 edges
6. `Session` - 18 edges
7. `observation()` - 18 edges
8. `SessionStore` - 17 edges
9. `compilerOptions` - 16 edges
10. `PolicyConfig` - 15 edges

## Surprising Connections (you probably didn't know these)
- `SessionEngine` --uses--> `PolicyConfig`  [INFERRED]
  service/app/engine.py → service/app/config.py
- `SessionStore` --uses--> `PolicyConfig`  [INFERRED]
  service/app/sessions.py → service/app/config.py
- `env()` --uses--> `PolicyConfig`  [INFERRED]
  service/tests/test_api.py → service/app/config.py
- `Harness` --uses--> `PolicyConfig`  [INFERRED]
  service/tests/test_engine.py → service/app/config.py
- `create_app()` --uses--> `PolicyOverrides`  [INFERRED]
  service/app/main.py → service/app/config.py

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "Engine State Derivation"
Cohesion: 0.06
Nodes (61): DerivedState, EngagementScore, GameplayState, IngestStatus, model_validator, _Answer, _BufferedEvent, _median() (+53 more)

### Community 1 - "Engine Policy Tests"
Cohesion: 0.09
Nodes (40): IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., ObservationMessage, gesture(), answer(), Harness, parametrize (+32 more)

### Community 2 - "Test Message Builders"
Cohesion: 0.12
Nodes (33): fixture, FakeClock, game_event(), m(), observation(), Any, Builders for well-formed messages, so each test only states what it cares about., auth() (+25 more)

### Community 3 - "Wire Protocol Types"
Cohesion: 0.05
Nodes (37): AckMessage, ActionType, AngleMeasurement, ApiErrorBody, AttentionState, BoolMeasurement, CalibrationInfo, CloseCode (+29 more)

### Community 4 - "FastAPI Routes"
Cohesion: 0.09
Nodes (29): FastAPI, ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state() (+21 more)

### Community 5 - "Adapter Contracts"
Cohesion: 0.07
Nodes (15): DerivedState, GameEventInput, GestureEventMessage, SuggestedActionMessage, AdapterState, ConnectionStatus, ConnectionStatusEvent, GameAdapterApi (+7 more)

### Community 6 - "Web Dependencies"
Cohesion: 0.07
Nodes (28): @mediapipe/tasks-vision, @types/node, @types/ws, typescript, vite, vitest, ws, dependencies (+20 more)

### Community 7 - "Session Fan-out"
Cohesion: 0.12
Nodes (8): HeartbeatMessage, BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket, StateMessage

### Community 8 - "Settings And Thresholds"
Cohesion: 0.11
Nodes (13): BaseSettings, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig., Process settings. Read from environment variables prefixed OBS_ (see… (+5 more)

### Community 9 - "TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 10 - "Observation Pipeline Contract"
Cohesion: 0.20
Nodes (4): ObservationBody, ObservationMessage, PerfInfo, SignalProcessorApi

### Community 11 - "Vision Contracts"
Cohesion: 0.22
Nodes (9): CalibrationStatus, Gesture, TrackingStatus, DEFAULT_SIGNAL_CONFIG, FaceData, FaceFrame, ObserverStatus, ProcessorStatus (+1 more)

## Knowledge Gaps
- **90 isolated node(s):** `name`, `private`, `version`, `type`, `setup:assets` (+85 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 177 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SessionEngine` connect `Engine State Derivation` to `Settings And Thresholds`, `Engine Policy Tests`, `Test Message Builders`, `Session Fan-out`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `create_app()` connect `FastAPI Routes` to `Engine State Derivation`, `Engine Policy Tests`, `Test Message Builders`, `Session Fan-out`, `Settings And Thresholds`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Why does `Harness` connect `Engine Policy Tests` to `Settings And Thresholds`, `Engine State Derivation`, `Test Message Builders`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 18 inferred relationships involving `SessionEngine` (e.g. with `PolicyConfig` and `AngleMeasurement`) actually correct?**
  _`SessionEngine` has 18 INFERRED edges - model-reasoned connections that need verification._
- **Are the 12 inferred relationships involving `create_app()` (e.g. with `PolicyOverrides` and `IngestError`) actually correct?**
  _`create_app()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `Harness` (e.g. with `PolicyConfig` and `SessionEngine`) actually correct?**
  _`Harness` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _90 weakly-connected nodes found - possible documentation gaps or missing edges._