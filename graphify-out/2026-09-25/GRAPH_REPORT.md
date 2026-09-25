# Graph Report - Memoria_Unified  (2026-09-25)

## Corpus Check
- 150 files · ~201,581 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 4, .example 2, .patch 1)

## Summary
- 2196 nodes · 4979 edges · 102 communities (87 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 190 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Service Test Suite
- Procedural House Builder
- Game Boot and UI
- Telemetry Recording
- Memory Pack Loading
- Service Session Engine
- Pack Validation Checks
- Game Adapter Transport
- Local Profile and Setup
- Transport Backoff Tests
- Observation Contracts
- Producer Connection
- Agent Environment Prompts
- Camera Integration Check
- Session and Wire Messages
- Head Signal Processing
- Agent Authoring Tools
- Agent Configuration
- Protocol Wire Types
- Mission Runner
- Service Schemas
- Service HTTP and WebSocket
- Signal Processor Tests
- MediaPipe Landmarker
- Template Mirroring
- World Collision Checks
- Adaptive Quality
- Agent Image Encoding
- House Layout Constants
- Tracking and Calibration Types
- sessions cluster
- demo-check cluster
- simulation cluster
- FaceObserver cluster
- gestures cluster
- setupUI cluster
- review cluster
- config cluster
- package cluster
- llamaCpp cluster
- offline-check cluster
- README cluster
- validate cluster
- grammar cluster
- firewall cluster
- State cluster
- worldSnapshot cluster
- DEPLOY cluster
- SPEC cluster
- audit cluster
- World cluster
- profile-check cluster
- browser-check cluster
- main cluster
- gemini cluster
- agent-review.check cluster
- tsconfig cluster
- SPEC cluster
- Missions cluster
- tools cluster
- Telemetry cluster
- make-photos cluster
- tsconfig cluster
- observation cluster
- FaceObserver cluster
- FaceObserver cluster
- SPEC cluster
- engine cluster
- VisionBridge cluster
- VisionBridge cluster
- perf-templates cluster
- main cluster
- geometry cluster
- package cluster
- selectProvider cluster
- ui cluster
- README cluster
- VisionBridge cluster
- setup-assets cluster
- SPEC cluster
- run cluster
- package cluster
- contracts cluster
- Interaction cluster
- EnvironmentEditor cluster
- Missions cluster
- bridge.check cluster
- VisionBridge cluster
- tsconfig cluster
- sessions cluster
- package cluster
- FaceObserver cluster
- types cluster
- README cluster
- enabled cluster
- make-media cluster
- apply cluster
- unapply cluster

## God Nodes (most connected - your core abstractions)
1. `boot()` - 83 edges
2. `FaceObserver` - 53 edges
3. `GameAdapter` - 52 edges
4. `ProducerConnection` - 52 edges
5. `SessionEngine` - 43 edges
6. `create_app()` - 43 edges
7. `Harness` - 43 edges
8. `SignalProcessor` - 37 edges
9. `MissionRunner` - 33 edges
10. `ObservationBody` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Offline setup mode (llama-server, Gemma 3 4B)` --semantically_similar_to--> `Player observation service`  [INFERRED] [semantically similar]
  3D game/README.md → CAMERA/README.md
- `task_engagement_score heuristic` --semantically_similar_to--> `Telemetry event contract and summary`  [INFERRED] [semantically similar]
  CAMERA/README.md → 3D game/SPEC.md
- `Content firewall validateProposal (rules F-a to F-i)` --semantically_similar_to--> `Actions are suggestions; game decides`  [INFERRED] [semantically similar]
  3D game/SPEC.md → CAMERA/INTEGRATION.md
- `LlamaCppProviderAdapter (llamaCpp.ts)` --semantically_similar_to--> `Security (loopback bind, origin allowlist, role-scoped tokens)`  [INFERRED] [semantically similar]
  3D game/README.md → CAMERA/README.md
- `Agent configuration (enabled false, setupMode, provider stub)` --semantically_similar_to--> `Camera assistance toggle (memoria-camera-assist-v1)`  [INFERRED] [semantically similar]
  3D game/SPEC.md → CAMERA/integrations/memoria-3d/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Camera observation pipeline: producer, service, game adapter** — camera_readme_faceobserver, camera_readme_producerconnection, camera_readme_fastapi_service, camera_readme_gameadapter, camera_readme_derived_state, camera_readme_suggested_action [EXTRACTED 1.00]
- **Agent trust boundary: model proposes, firewall and caregiver gate** — 3d_game_spec_rule_f1_no_model_in_session, 3d_game_spec_rule_f2_propose_never_commit, 3d_game_spec_agent_tool_contracts, 3d_game_spec_request_caregiver_input, 3d_game_spec_content_firewall, 3d_game_spec_prompt_injection, 3d_game_readme_review_session [INFERRED 0.85]
- **Measured world audits (clearance measured, never eyeballed)** — 3d_game_spec_auditdoorways, 3d_game_spec_auditreachability, 3d_game_spec_canfocus, 3d_game_spec_regression_snapshot, 3d_game_spec_four_templates [EXTRACTED 1.00]

## Communities (102 total, 11 thin omitted)

### Community 0 - "Service Test Suite"
Cohesion: 0.06
Nodes (70): IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., FakeClock, game_event(), gesture(), m(), observation() (+62 more)

### Community 1 - "Procedural House Builder"
Cohesion: 0.07
Nodes (53): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+45 more)

### Community 2 - "Game Boot and UI"
Cohesion: 0.06
Nodes (9): boot(), renderOnly(), standableIn(), PackVoices, MissionRunnerDeps, Player, Renderer, escapeText() (+1 more)

### Community 3 - "Telemetry Recording"
Cohesion: 0.05
Nodes (34): describe(), FocusProbe, percentile(), PerfResult, QualityProfile, buildExport(), downloadJson(), DWELL_THRESHOLD_MS (+26 more)

### Community 4 - "Memory Pack Loading"
Cohesion: 0.09
Nodes (26): Crop, breakagesFromLocation(), CardStyle, fitToPlate(), injectAnchors(), isObject(), Json, loadAudio() (+18 more)

### Community 5 - "Service Session Engine"
Cohesion: 0.09
Nodes (30): _Answer, _median(), Per-session engine: ordering/dedup, derived state, and the deterministic…, Freeze the inactivity clock while paused or in an expected idle period., Returns (vision, attention_state, attention_reason, usable_for_adaptation)., task_engagement_score: a documented heuristic, null until enough gameplay.…, Recompute state and run the policy. Returns (state, changed, new_actions)., SessionEngine (+22 more)

### Community 6 - "Pack Validation Checks"
Cohesion: 0.06
Nodes (19): PackProblem, Event, failures, fakeCtx, fakeLoad(), FakePlayer, FakeState, FakeUI (+11 more)

### Community 7 - "Game Adapter Transport"
Cohesion: 0.11
Nodes (5): GameEventMessage, Backoff, detach(), GameAdapter, randomId()

### Community 8 - "Local Profile and Setup"
Cohesion: 0.13
Nodes (31): applySetupMode(), defaultModelForMode(), providerForMode(), LocalPerson, LocalProfile, newId(), newProfile(), openDatabase() (+23 more)

### Community 9 - "Transport Backoff Tests"
Cohesion: 0.08
Nodes (22): backoffDelay(), classifyClose(), CloseOutcome, DEFAULT_RECONNECT, finiteOr(), resolveReconnectOptions(), ReconnectOptions, WebSocketLike (+14 more)

### Community 10 - "Observation Contracts"
Cohesion: 0.08
Nodes (16): DerivedState, GameEventInput, GestureEventMessage, SuggestedActionMessage, AdapterState, ConnectionStatusEvent, GameAdapterApi, GameAdapterOptions (+8 more)

### Community 11 - "Producer Connection"
Cohesion: 0.14
Nodes (4): fatalHttpReason(), ConnectionStatus, noop(), ProducerConnection

### Community 12 - "Agent Environment Prompts"
Cohesion: 0.09
Nodes (30): colors, describeEnvironment(), ENVIRONMENT_TOOL, validateEnvironment(), LlamaCppProviderAdapter, anchorLines(), assetLines(), AUTHORING_REASONING (+22 more)

### Community 13 - "Camera Integration Check"
Cohesion: 0.12
Nodes (23): AdapterProbe, assert(), freePort(), m(), main(), makeProducer(), now(), originFetch (+15 more)

### Community 14 - "Session and Wire Messages"
Cohesion: 0.09
Nodes (25): CreateSessionRequest, HelloMessage, ObservationMessage, SCHEMA_VERSION, ServerMessage, trimBaseUrl(), ProducerConnectionApi, ProducerConnectionOptions (+17 more)

### Community 15 - "Head Signal Processing"
Cohesion: 0.13
Nodes (14): clamp(), roundTo(), boxCentre(), boxWidth(), EulerDeg, relativeEar(), allUnavailable(), angleM() (+6 more)

### Community 16 - "Agent Authoring Tools"
Cohesion: 0.13
Nodes (27): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), baseContext() (+19 more)

### Community 17 - "Agent Configuration"
Cohesion: 0.09
Nodes (24): AgentConfig, agentConfigStore, AgentProvider, CONSENT_PROMPT, consentPromptFor(), ensureConsent(), isAgentProvider(), isSetupMode() (+16 more)

### Community 18 - "Protocol Wire Types"
Cohesion: 0.06
Nodes (30): AckMessage, ActionType, AngleMeasurement, ApiErrorBody, BoolMeasurement, CalibrationInfo, CloseCode, DurationMeasurement (+22 more)

### Community 19 - "Mission Runner"
Cohesion: 0.13
Nodes (6): instructionOf(), MissionRunner, speak(), stopSpeaking(), Outcome, ChoiceCard

### Community 20 - "Service Schemas"
Cohesion: 0.13
Nodes (24): Player-observation service: ingests derived webcam measurements and gameplay…, FastAPI application: HTTP endpoints, the WebSocket stream and the background…, AckMessage, CalibrationInfo, CreateSessionRequest, CreateSessionResponse, GameEventData, GameEventMessage (+16 more)

### Community 21 - "Service HTTP and WebSocket"
Cohesion: 0.12
Nodes (26): ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state(), ingest_game_event() (+18 more)

### Community 22 - "Signal Processor Tests"
Cohesion: 0.12
Nodes (20): ObservationBody, faceMatrixFromRotation(), rotationFromEuler(), assertBodyValid(), assertFinite(), assertMeasurement(), awayTransition(), Box (+12 more)

### Community 23 - "MediaPipe Landmarker"
Cohesion: 0.11
Nodes (23): blendshape(), clamp01(), CreatedLandmarker, createLandmarker(), CreateLandmarkerOptions, errMsg(), extractFaces(), eyeAspectRatio() (+15 more)

### Community 24 - "Template Mirroring"
Cohesion: 0.13
Nodes (27): extent(), FACING, mirrorTemplate(), mirrorYaw(), mount(), neg(), opening(), point2() (+19 more)

### Community 25 - "World Collision Checks"
Cohesion: 0.10
Nodes (17): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+9 more)

### Community 26 - "Adaptive Quality"
Cohesion: 0.12
Nodes (15): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+7 more)

### Community 27 - "Agent Image Encoding"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

### Community 28 - "House Layout Constants"
Cohesion: 0.20
Nodes (19): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+11 more)

### Community 29 - "Tracking and Calibration Types"
Cohesion: 0.14
Nodes (17): CalibrationStatus, HeadOrientation, TrackingStatus, DEFAULT_SIGNAL_CONFIG, FaceFrame, ProcessorStatus, SignalConfig, emaAlpha() (+9 more)

### Community 30 - "sessions cluster"
Cohesion: 0.12
Nodes (8): HeartbeatMessage, BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket, StateMessage

### Community 31 - "demo-check cluster"
Cohesion: 0.10
Nodes (21): cdp(), chrome, click(), clickEv(), ev(), page, pending, procs (+13 more)

### Community 32 - "simulation cluster"
Cohesion: 0.14
Nodes (7): matrixFromPlayerAngles(), Motion, SimulatedFaceSource, SimulationControls, PerfInfo, FaceData, SignalProcessorApi

### Community 33 - "FaceObserver cluster"
Cohesion: 0.16
Nodes (5): VerifyState, FaceObserverOptions, ObserverStatus, FaceObserver, clearOverlay()

### Community 34 - "gestures cluster"
Cohesion: 0.11
Nodes (11): DetectedHeadGesture, HeadGestureConfig, HeadGestureDetector, HeadGestureType, Sample, SwingMatch, SwingParams, SwingPoint (+3 more)

### Community 35 - "setupUI cluster"
Cohesion: 0.16
Nodes (11): ConsentPrompt, ReviewSession, CropHandles, ProposalReviewList, renderProvenanceSummary(), statusLabel(), summarise(), violationLine() (+3 more)

### Community 36 - "review cluster"
Cohesion: 0.13
Nodes (14): FirewallContext, Violation, ProposalFixture, computeProvenance(), ProvenanceBlock, ProposalStatus, ReviewCounts, ReviewedProposal (+6 more)

### Community 37 - "config cluster"
Cohesion: 0.10
Nodes (15): BaseSettings, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig., Process settings. Read from environment variables prefixed OBS_ (see… (+7 more)

### Community 38 - "package cluster"
Cohesion: 0.09
Nodes (22): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, @types/node (+14 more)

### Community 39 - "llamaCpp cluster"
Cohesion: 0.16
Nodes (19): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), ParsedEnvelope, parseEnvelope() (+11 more)

### Community 40 - "offline-check cluster"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 41 - "README cluster"
Cohesion: 0.17
Nodes (23): Actions are suggestions; game decides, Connecting a game (integration guide), createSession / deleteSession, Game hooks for adapter outputs, observation.ts createObservation, DerivedState / attention_state, FastAPI observation service (engine.py, sessions.py, main.py), Game event message (+15 more)

### Community 42 - "validate cluster"
Cohesion: 0.21
Nodes (22): ACTION_SOURCES, ACTION_TYPES, allNumbersFinite(), ATTENTION_STATES, GESTURE_TYPES, hasVersion(), isDerivedState(), isGesture() (+14 more)

### Community 43 - "grammar cluster"
Cohesion: 0.19
Nodes (16): DEFAULT_AGENT_CONFIG, PROPOSAL_FIXTURES, asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule() (+8 more)

### Community 44 - "firewall cluster"
Cohesion: 0.17
Nodes (18): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+10 more)

### Community 45 - "State cluster"
Cohesion: 0.10
Nodes (6): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, State, StateListener, TIMERS_RUN

### Community 46 - "worldSnapshot cluster"
Cohesion: 0.17
Nodes (17): TEMPLATES, out, snapshot, w, world, box(), canonicalQuaternion(), diffSnapshots() (+9 more)

### Community 47 - "DEPLOY cluster"
Cohesion: 0.16
Nodes (19): CSP allowances (dl.polyhaven.org, generativelanguage.googleapis.com), Memoria 3D Deployment (incomplete), Netlify deployment, Never set VITE_GEMINI_API_KEY for hosted builds, Vercel deployment, vite.config base './', Memoria 3D HTML shell (#app, /src/main.ts), npm run check:offline (+11 more)

### Community 48 - "SPEC cluster"
Cohesion: 0.14
Nodes (19): Adaptive resolution (texture upgrade, anisotropy, pixel-ratio ladder), Checkpoints A–G, Completion outcomes (independent, cued, revealed, skipped), glbHouse.ts (deferred), Highlight (emissive lift, cloned material), Hint ladder (repeat, highlight, guide/reveal), Interaction raycast with Box3 occlusion, Memoria 3D Specification (+11 more)

### Community 49 - "audit cluster"
Cohesion: 0.13
Nodes (7): AuditEntry, AuditLog, AuditSink, consoleAuditSink, failures, REQUEST, WITH_IMAGE

### Community 50 - "World cluster"
Cohesion: 0.14
Nodes (15): Focus, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS, REQUIRED_HINT_TARGETS (+7 more)

### Community 51 - "profile-check cluster"
Cohesion: 0.12
Nodes (12): args, CDP, chrome, originArg, profile, REPO, startServerIfNeeded(), wait() (+4 more)

### Community 52 - "browser-check cluster"
Cohesion: 0.22
Nodes (12): Cdp, ensureVite(), freePort(), httpOk(), launchChrome(), log(), main(), openPage() (+4 more)

### Community 53 - "main cluster"
Cohesion: 0.21
Nodes (18): endSession(), fmt(), log(), onObservation(), renderAction(), renderGesture(), renderObserverStatus(), renderProcessorStatus() (+10 more)

### Community 54 - "gemini cluster"
Cohesion: 0.19
Nodes (15): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), GeminiProviderAdapter, imagePart(), InteractionStep, isGoogleEndpoint() (+7 more)

### Community 55 - "agent-review.check cluster"
Cohesion: 0.13
Nodes (12): assets(), ctx(), emptyPack, failures, fakeCtx, FakeImage, fakeLoad(), firewallWorld() (+4 more)

### Community 56 - "tsconfig cluster"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 57 - "SPEC cluster"
Cohesion: 0.16
Nodes (17): commitPack.ts draft pack folding, Demo memory packs (Mira, Raju), Generated pack media (make-media.sh, make-photos.py, say), ReviewSession (review.ts), Caregiver personalisation (local browser profile), Content firewall validateProposal (rules F-a to F-i), Image may license visual properties, never autobiographical facts, IndexedDB memoria-caregiver-v1 profile store (+9 more)

### Community 58 - "Missions cluster"
Cohesion: 0.15
Nodes (15): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), LoadedPack, ChoiceFormat, DemoNotice, FindStep, HINT_DELAYS_MS (+7 more)

### Community 59 - "tools cluster"
Cohesion: 0.12
Nodes (10): ChoiceType, FindStepProposal, hints, JsonSchemaTool, LevelProposal, NavigateStepProposal, PhotoPlacementProposal, ReadContext (+2 more)

### Community 61 - "make-photos cluster"
Cohesion: 0.29
Nodes (16): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+8 more)

### Community 62 - "tsconfig cluster"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 63 - "observation cluster"
Cohesion: 0.19
Nodes (14): enable(), teardown(), createPanel(), describeCalibration(), describeCameraError(), log(), LOOPBACK, Observation (+6 more)

### Community 64 - "FaceObserver cluster"
Cohesion: 0.15
Nodes (14): ErrorCode, INFERENCE_TIMEOUT_MS, InFlight, LandmarkerModule, MainLandmarker, mapCameraError(), MAX_CONSECUTIVE_FAILURES, round2() (+6 more)

### Community 65 - "FaceObserver cluster"
Cohesion: 0.24
Nodes (3): Aborted, errMsg(), ObserverError

### Community 66 - "SPEC cluster"
Cohesion: 0.16
Nodes (16): AGENT_TOOL_SCHEMA constrained tool calls, Generate home appearance from room photos, GeminiProviderAdapter (gemini.ts), images.ts EXIF strip and derivatives, LlamaCppProviderAdapter (llamaCpp.ts), Prompt layer prompts.ts (version f-2, reasoning steps), Agent-assisted caregiver setup (Checkpoint F), agent-audit.jsonl audit log (+8 more)

### Community 67 - "engine cluster"
Cohesion: 0.18
Nodes (8): _BufferedEvent, _Producer, GestureEventMessage, Time-weight the previous observation over the interval up to this one., GestureEventMessage, SuggestedActionMessage, In-memory session store. Sessions live in this process only: run a single…, SuggestedActionMessage

### Community 68 - "VisionBridge cluster"
Cohesion: 0.15
Nodes (9): bridge.check.ts (62 assertions), DelayInstructionSuggestion, InstructionHoldOptions, OUTCOME_MAP, RecordedSuggestion, Suggestion, SuggestionFate, VisionBridgeCallbacks (+1 more)

### Community 70 - "perf-templates cluster"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 71 - "main cluster"
Cohesion: 0.17
Nodes (11): observer, out, overlay, params, real, record(), recording, round1() (+3 more)

### Community 72 - "geometry cluster"
Cohesion: 0.35
Nodes (9): boxIoU(), eulerFromFaceMatrix(), eulerFromMatrix(), eyeAspectRatioFromPoints(), Mat3, mat3Multiply(), mat3Transpose(), relativeRotation() (+1 more)

### Community 73 - "package cluster"
Cohesion: 0.17
Nodes (11): dependencies, @mediapipe/tasks-vision, @types/node, typescript, vite, name, private, type (+3 more)

### Community 74 - "selectProvider cluster"
Cohesion: 0.25
Nodes (8): DEFAULT_GEMINI_MODEL, GeminiConfig, LlamaCppConfig, EMPTY_STUB_SCRIPT, NullProviderAdapter, SelectProviderOptions, StubProviderAdapter, StubModelScript

### Community 75 - "ui cluster"
Cohesion: 0.20
Nodes (8): EnvironmentReport, AnswerCardOptions, LevelChoice, LevelSelectView, LoadStage, RenderedProblem, StageProgress, SummaryView

### Community 76 - "README cluster"
Cohesion: 0.22
Nodes (11): apply.sh / unapply.sh, Calibration (neutral pose reference), FaceObserver, Nod and head-shake detection, head_facing_score heuristic, MediaPipe Face Landmarker (tasks-vision 1.0.1), Observation message, setup-assets.mjs (WASM copy, SHA-256 verified model) (+3 more)

### Community 78 - "setup-assets cluster"
Cohesion: 0.33
Nodes (10): copyWasm(), exists(), fail(), installModel(), modelDst, sha256(), verify(), wasmDst (+2 more)

### Community 79 - "SPEC cluster"
Cohesion: 0.29
Nodes (10): Five-room house with fenced garden, auditDoorways, auditReachability, Templates hallway, row, openPlan, courtyard, House templates, Poly Haven texture sets (surfaces and detail), proceduralHouse.ts / buildHouse generator, Determinism and hallway regression snapshot (+2 more)

### Community 80 - "run cluster"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 81 - "package cluster"
Cohesion: 0.20
Nodes (10): scripts, build, check:browser, check:demo, dev, integration, preview, setup:assets (+2 more)

### Community 84 - "EnvironmentEditor cluster"
Cohesion: 0.50
Nodes (7): needsSetup(), geminiConfigFromEnv(), llamaCppConfigFromEnv(), selectProvider(), destinationLine(), environmentEditor(), waitingLine()

### Community 86 - "bridge.check cluster"
Cohesion: 0.29
Nodes (5): eq(), FakeAdapter, ok(), setup(), CAMERA_ASSIST_STORAGE_KEY

### Community 87 - "VisionBridge cluster"
Cohesion: 0.36
Nodes (6): createObservation(), disable(), setEnabled(), readCameraAssist(), StorageLike, writeCameraAssist()

### Community 88 - "tsconfig cluster"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../../tsconfig.json

### Community 89 - "sessions cluster"
Cohesion: 0.33
Nodes (3): Connection, Any, One WebSocket client. Outgoing messages go through a bounded queue so a slow…

### Community 90 - "package cluster"
Cohesion: 0.29
Nodes (7): devDependencies, @types/node, @types/ws, typescript, vite, vitest, ws

### Community 91 - "FaceObserver cluster"
Cohesion: 0.33
Nodes (3): absoluteUrl(), Delegate, WorkerResponse

### Community 93 - "README cluster"
Cohesion: 0.50
Nodes (4): Stub model (stubModel.ts), Agent configuration (enabled false, setupMode, provider stub), Camera assistance toggle (memoria-camera-assist-v1), Vision gating and adaptation opt-in

## Knowledge Gaps
- **387 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+382 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 705 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TimeEma` connect `Tracking and Calibration Types` to `geometry cluster`, `agent-review.check cluster`?**
  _High betweenness centrality (0.252) - this node is a cross-community bridge._
- **Why does `FakeImage` connect `agent-review.check cluster` to `Pack Validation Checks`?**
  _High betweenness centrality (0.144) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `SessionEngine` (e.g. with `PolicyConfig` and `AngleMeasurement`) actually correct?**
  _`SessionEngine` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _387 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Service Test Suite` be split into smaller, more focused modules?**
  _Cohesion score 0.05581395348837209 - nodes in this community are weakly interconnected._
- **Should `Procedural House Builder` be split into smaller, more focused modules?**
  _Cohesion score 0.0710085933966531 - nodes in this community are weakly interconnected._