# Graph Report - Memoria_Unified  (2026-09-25)

## Corpus Check
- 147 files · ~226,617 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 4, .example 3, .patch 1)

## Summary
- 2531 nodes · 5661 edges · 121 communities (100 shown, 19 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 201 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- test_engine.py
- proceduralHouse.ts
- boot
- src/main.ts
- MemoryPack.ts
- SessionEngine
- pack.check.ts
- GameAdapter
- LocalProfile.ts
- transport.test.ts
- app.ts
- ProducerConnection
- agent-prompts.check.ts
- integration-check.ts
- ProducerConnection.ts
- SignalProcessor
- authoring.ts
- agent-gemini.check.ts
- protocol/types.ts
- MissionRunner
- schemas.py
- create_app
- ObservationBody
- landmarker.ts
- templates/types.ts
- world.check.ts
- Quality.ts
- agent-images.check.ts
- index.ts
- CameraUI
- Session
- demo-check.mjs
- PerfInfo
- FaceObserver
- vision/contracts.ts
- review.ts
- agent-provenance.check.ts
- PolicyConfig
- 3D game/package.json
- llamaCpp.ts
- offline-check.mjs
- FastAPI observation service (engine.py, sessions.py, main.py)
- validate.ts
- grammar.ts
- firewall.ts
- State
- worldSnapshot.ts
- Memoria 3D
- Memoria 3D Specification
- agent-provider.check.ts
- World.ts
- profile-check.mjs
- browser-check.mjs
- demo/main.ts
- gemini.ts
- agent-review.check.ts
- compilerOptions
- Content firewall validateProposal (rules F-a to F-i)
- CameraAdapter
- tools.ts
- Telemetry
- make-photos.py
- compilerOptions
- observation.ts
- FaceObserver.ts
- integration.ts
- Privacy: offline default, online opt-in
- sessions.py
- memoria-3d/VisionBridge.ts
- VisionBridge
- perf-templates.mjs
- verify/main.ts
- geometry.ts
- web/package.json
- selectProvider.ts
- ui.ts
- snapshot.ts
- InstructionHold
- setup-assets.mjs
- House templates
- run.mjs
- scripts
- FaceObserverApi
- camera-e2e.mjs
- EnvironmentEditor.ts
- HintBeacon
- proposals.fixtures.ts
- createObservation
- checks/tsconfig.json
- Connection
- devDependencies
- vision.worker.ts
- VisionBridge
- Memoria 3D camera assistance patch
- camera.check.ts
- enabled.ts
- make-media.sh
- apply.sh
- unapply.sh
- 3D game/vite.config.ts
- Player
- dev.mjs
- environment.ts
- Memoria Unified: Memoria 3D with optional camera support
- package.json
- FakeUI
- Rig
- InstructionHold
- .endStep
- FakeSocket
- check.mjs
- setup.mjs
- CameraUICallbacks
- plan.ts
- Agent-assisted caregiver setup (Checkpoint F)
- .value
- VisionBridgeCallbacks
- BoundedSet
- CameraIntegration

## God Nodes (most connected - your core abstractions)
1. `boot()` - 85 edges
2. `FaceObserver` - 54 edges
3. `GameAdapter` - 53 edges
4. `ProducerConnection` - 53 edges
5. `SessionEngine` - 43 edges
6. `create_app()` - 43 edges
7. `Harness` - 43 edges
8. `ObservationBody` - 41 edges
9. `MissionRunner` - 39 edges
10. `CameraAdapter` - 38 edges

## Surprising Connections (you probably didn't know these)
- `task_engagement_score heuristic` --semantically_similar_to--> `Telemetry event contract and summary`  [INFERRED] [semantically similar]
  CAMERA/README.md → 3D game/SPEC.md
- `Offline setup mode (llama-server, Gemma 3 4B)` --semantically_similar_to--> `Player observation service`  [INFERRED] [semantically similar]
  3D game/README.md → CAMERA/README.md
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
- **Measured world audits (clearance measured, never eyeballed)** — 3d_game_spec_auditdoorways, 3d_game_spec_auditreachability, 3d_game_spec_canfocus, 3d_game_spec_regression_snapshot, 3d_game_spec_four_templates [EXTRACTED 1.00]
- **Agent trust boundary: model proposes, firewall and caregiver gate** — 3d_game_spec_rule_f1_no_model_in_session, 3d_game_spec_rule_f2_propose_never_commit, 3d_game_spec_agent_tool_contracts, 3d_game_spec_request_caregiver_input, 3d_game_spec_content_firewall, 3d_game_spec_prompt_injection, 3d_game_readme_review_session [INFERRED 0.85]

## Communities (121 total, 19 thin omitted)

### Community 0 - "test_engine.py"
Cohesion: 0.06
Nodes (70): IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., FakeClock, game_event(), gesture(), m(), observation() (+62 more)

### Community 1 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (54): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+46 more)

### Community 2 - "boot"
Cohesion: 0.09
Nodes (7): boot(), renderOnly(), PackVoices, MissionRunnerDeps, Renderer, escapeText(), UI

### Community 3 - "src/main.ts"
Cohesion: 0.05
Nodes (34): describe(), FocusProbe, percentile(), PerfResult, QualityProfile, buildExport(), downloadJson(), DWELL_THRESHOLD_MS (+26 more)

### Community 4 - "MemoryPack.ts"
Cohesion: 0.07
Nodes (38): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), breakagesFromLocation(), CardStyle, fitToPlate(), injectAnchors(), isObject() (+30 more)

### Community 5 - "SessionEngine"
Cohesion: 0.09
Nodes (30): _Answer, _median(), Per-session engine: ordering/dedup, derived state, and the deterministic…, Freeze the inactivity clock while paused or in an expected idle period., Returns (vision, attention_state, attention_reason, usable_for_adaptation)., task_engagement_score: a documented heuristic, null until enough gameplay.…, Recompute state and run the policy. Returns (state, changed, new_actions)., SessionEngine (+22 more)

### Community 6 - "pack.check.ts"
Cohesion: 0.12
Nodes (14): PackProblem, failures, fakeCtx, fakeLoad(), LoadFn, makeWorld(), mediaFor(), MISSING (+6 more)

### Community 7 - "GameAdapter"
Cohesion: 0.10
Nodes (6): GameEventMessage, parseServerMessage(), ConnectionStatus, detach(), GameAdapter, randomId()

### Community 8 - "LocalProfile.ts"
Cohesion: 0.15
Nodes (27): applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId(), newProfile() (+19 more)

### Community 9 - "transport.test.ts"
Cohesion: 0.12
Nodes (24): streamUrl(), toWebSocketUrl(), trimBaseUrl(), createSession(), CreateSessionOptions, deleteSession(), isCreateSessionResponse(), networkError() (+16 more)

### Community 10 - "app.ts"
Cohesion: 0.08
Nodes (9): GameEventSink, FakeConsumer, GameEventInput, GameEventType, GestureEventMessage, SuggestedActionMessage, TaskOutcome, AdapterState (+1 more)

### Community 11 - "ProducerConnection"
Cohesion: 0.15
Nodes (3): fatalHttpReason(), noop(), ProducerConnection

### Community 12 - "agent-prompts.check.ts"
Cohesion: 0.15
Nodes (17): anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext, buildAuthoringSystemPrompt(), bullets(), PROMPT_VERSION, AnchorSummary (+9 more)

### Community 13 - "integration-check.ts"
Cohesion: 0.12
Nodes (23): AdapterProbe, assert(), freePort(), m(), main(), makeProducer(), now(), originFetch (+15 more)

### Community 14 - "ProducerConnection.ts"
Cohesion: 0.06
Nodes (32): DerivedState, HelloMessage, SCHEMA_VERSION, ServerMessage, Backoff, backoffDelay(), classifyClose(), CloseOutcome (+24 more)

### Community 15 - "SignalProcessor"
Cohesion: 0.11
Nodes (14): clamp(), emaAlpha(), mean(), roundTo(), stdDev(), TimeEma, EulerDeg, angleM() (+6 more)

### Community 16 - "authoring.ts"
Cohesion: 0.18
Nodes (23): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), parseProposalCalls() (+15 more)

### Community 17 - "agent-gemini.check.ts"
Cohesion: 0.09
Nodes (25): AgentConfig, agentConfigStore, AgentProvider, CONSENT_PROMPT, ConsentPrompt, consentPromptFor(), ensureConsent(), isAgentProvider() (+17 more)

### Community 18 - "protocol/types.ts"
Cohesion: 0.05
Nodes (44): LocalCamera, VisionView, AckMessage, ActionType, AngleMeasurement, ApiErrorBody, BoolMeasurement, CalibrationInfo (+36 more)

### Community 19 - "MissionRunner"
Cohesion: 0.15
Nodes (4): instructionOf(), MissionRunner, speak(), stopSpeaking()

### Community 20 - "schemas.py"
Cohesion: 0.13
Nodes (24): Player-observation service: ingests derived webcam measurements and gameplay…, FastAPI application: HTTP endpoints, the WebSocket stream and the background…, AckMessage, CalibrationInfo, CreateSessionRequest, CreateSessionResponse, GameEventData, GameEventMessage (+16 more)

### Community 21 - "create_app"
Cohesion: 0.12
Nodes (26): ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state(), ingest_game_event() (+18 more)

### Community 22 - "ObservationBody"
Cohesion: 0.09
Nodes (19): FakeProducer, ObservationBody, assertBodyValid(), assertFinite(), assertMeasurement(), awayTransition(), Box, Driver (+11 more)

### Community 23 - "landmarker.ts"
Cohesion: 0.16
Nodes (17): blendshape(), clamp01(), createLandmarker(), CreateLandmarkerOptions, errMsg(), extractFaces(), eyeAspectRatio(), LEFT_EYE_EAR_IDX (+9 more)

### Community 24 - "templates/types.ts"
Cohesion: 0.13
Nodes (27): extent(), FACING, mirrorTemplate(), mirrorYaw(), mount(), neg(), opening(), point2() (+19 more)

### Community 25 - "world.check.ts"
Cohesion: 0.10
Nodes (18): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+10 more)

### Community 26 - "Quality.ts"
Cohesion: 0.12
Nodes (15): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+7 more)

### Community 27 - "agent-images.check.ts"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

### Community 28 - "index.ts"
Cohesion: 0.19
Nodes (20): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+12 more)

### Community 29 - "CameraUI"
Cohesion: 0.10
Nodes (17): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref(), createCameraIntegration(), disable() (+9 more)

### Community 30 - "Session"
Cohesion: 0.12
Nodes (8): HeartbeatMessage, BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket, StateMessage

### Community 31 - "demo-check.mjs"
Cohesion: 0.10
Nodes (21): cdp(), chrome, click(), clickEv(), ev(), page, pending, procs (+13 more)

### Community 32 - "PerfInfo"
Cohesion: 0.14
Nodes (7): matrixFromPlayerAngles(), Motion, SimulatedFaceSource, SimulationControls, PerfInfo, FaceData, SignalProcessorApi

### Community 33 - "FaceObserver"
Cohesion: 0.12
Nodes (8): FaceObserverOptions, Aborted, absoluteUrl(), errMsg(), FaceObserver, ObserverError, Delegate, clearOverlay()

### Community 34 - "vision/contracts.ts"
Cohesion: 0.10
Nodes (13): DEFAULT_SIGNAL_CONFIG, SignalConfig, DetectedHeadGesture, HeadGestureConfig, HeadGestureDetector, HeadGestureType, Sample, SwingMatch (+5 more)

### Community 35 - "review.ts"
Cohesion: 0.13
Nodes (15): Violation, ProposalStatus, ReviewCounts, ReviewedProposal, ReviewSession, CropHandles, ProposalReviewList, renderProvenanceSummary() (+7 more)

### Community 36 - "agent-provenance.check.ts"
Cohesion: 0.20
Nodes (6): FirewallContext, ProposalFixture, computeProvenance(), ProvenanceBlock, ctx(), failures

### Community 37 - "PolicyConfig"
Cohesion: 0.10
Nodes (15): BaseSettings, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig., Process settings. Read from environment variables prefixed OBS_ (see… (+7 more)

### Community 38 - "3D game/package.json"
Cohesion: 0.09
Nodes (22): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, @types/node (+14 more)

### Community 39 - "llamaCpp.ts"
Cohesion: 0.15
Nodes (19): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), LlamaCppProviderAdapter, ParsedEnvelope (+11 more)

### Community 40 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 41 - "FastAPI observation service (engine.py, sessions.py, main.py)"
Cohesion: 0.11
Nodes (34): Actions are suggestions; game decides, Connecting a game (integration guide), createSession / deleteSession, Game hooks for adapter outputs, apply.sh / unapply.sh, observation.ts createObservation, Calibration (neutral pose reference), DerivedState / attention_state (+26 more)

### Community 42 - "validate.ts"
Cohesion: 0.25
Nodes (19): ACTION_SOURCES, ACTION_TYPES, allNumbersFinite(), ATTENTION_STATES, GESTURE_TYPES, hasVersion(), isDerivedState(), isGesture() (+11 more)

### Community 43 - "grammar.ts"
Cohesion: 0.42
Nodes (10): asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule(), ParsedCall, SchemaNode (+2 more)

### Community 44 - "firewall.ts"
Cohesion: 0.17
Nodes (18): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+10 more)

### Community 45 - "State"
Cohesion: 0.10
Nodes (6): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, State, StateListener, TIMERS_RUN

### Community 46 - "worldSnapshot.ts"
Cohesion: 0.19
Nodes (16): out, snapshot, w, world, box(), canonicalQuaternion(), diffSnapshots(), Json (+8 more)

### Community 47 - "Memoria 3D"
Cohesion: 0.24
Nodes (13): CSP allowances (dl.polyhaven.org, generativelanguage.googleapis.com), Memoria 3D Deployment (incomplete), Netlify deployment, Never set VITE_GEMINI_API_KEY for hosted builds, Vercel deployment, vite.config base './', Memoria 3D HTML shell (#app, /src/main.ts), npm run check:offline (+5 more)

### Community 48 - "Memoria 3D Specification"
Cohesion: 0.15
Nodes (16): Adaptive resolution (texture upgrade, anisotropy, pixel-ratio ladder), window.__memoria debug handle, debug.canFocus reachability probe, Checkpoints A–G, glbHouse.ts (deferred), Highlight (emissive lift, cloned material), Interaction raycast with Box3 occlusion, Levels (water, morning-walk, familiar-memories) (+8 more)

### Community 49 - "agent-provider.check.ts"
Cohesion: 0.13
Nodes (7): AuditEntry, AuditLog, AuditSink, consoleAuditSink, failures, REQUEST, WITH_IMAGE

### Community 50 - "World.ts"
Cohesion: 0.11
Nodes (14): Focus, Interaction, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS (+6 more)

### Community 51 - "profile-check.mjs"
Cohesion: 0.12
Nodes (12): args, CDP, chrome, originArg, profile, REPO, startServerIfNeeded(), wait() (+4 more)

### Community 52 - "browser-check.mjs"
Cohesion: 0.22
Nodes (12): Cdp, ensureVite(), freePort(), httpOk(), launchChrome(), log(), main(), openPage() (+4 more)

### Community 53 - "demo/main.ts"
Cohesion: 0.21
Nodes (18): endSession(), fmt(), log(), onObservation(), renderAction(), renderGesture(), renderObserverStatus(), renderProcessorStatus() (+10 more)

### Community 54 - "gemini.ts"
Cohesion: 0.19
Nodes (15): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), GeminiProviderAdapter, imagePart(), InteractionStep, isGoogleEndpoint() (+7 more)

### Community 55 - "agent-review.check.ts"
Cohesion: 0.19
Nodes (10): assets(), ctx(), emptyPack, failures, fakeCtx, fakeLoad(), firewallWorld(), LoadFn (+2 more)

### Community 56 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 57 - "Content firewall validateProposal (rules F-a to F-i)"
Cohesion: 0.16
Nodes (17): commitPack.ts draft pack folding, Demo memory packs (Mira, Raju), Generated pack media (make-media.sh, make-photos.py, say), ReviewSession (review.ts), Caregiver personalisation (local browser profile), Content firewall validateProposal (rules F-a to F-i), Image may license visual properties, never autobiographical facts, IndexedDB memoria-caregiver-v1 profile store (+9 more)

### Community 58 - "CameraAdapter"
Cohesion: 0.12
Nodes (8): CameraAdapter, CameraAdapterOptions, errText(), Runtime, observerError(), toGesture(), toSuggestion(), Unsubscribe

### Community 59 - "tools.ts"
Cohesion: 0.12
Nodes (9): ChoiceType, FindStepProposal, hints, LevelProposal, NavigateStepProposal, PhotoPlacementProposal, ReadContext, rect (+1 more)

### Community 61 - "make-photos.py"
Cohesion: 0.29
Nodes (16): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+8 more)

### Community 62 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 63 - "observation.ts"
Cohesion: 0.19
Nodes (14): enable(), teardown(), createPanel(), describeCalibration(), describeCameraError(), log(), LOOPBACK, Observation (+6 more)

### Community 64 - "FaceObserver.ts"
Cohesion: 0.14
Nodes (16): FaceFrame, ErrorCode, INFERENCE_TIMEOUT_MS, InFlight, LandmarkerModule, MainLandmarker, mapCameraError(), MAX_CONSECUTIVE_FAILURES (+8 more)

### Community 65 - "integration.ts"
Cohesion: 0.12
Nodes (15): AdaptationConfig, AdaptationEffects, AdaptationPolicy, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraIntegrationDeps (+7 more)

### Community 66 - "Privacy: offline default, online opt-in"
Cohesion: 0.21
Nodes (12): AGENT_TOOL_SCHEMA constrained tool calls, Generate home appearance from room photos, GeminiProviderAdapter (gemini.ts), images.ts EXIF strip and derivatives, LlamaCppProviderAdapter (llamaCpp.ts), Prompt layer prompts.ts (version f-2, reasoning steps), agent-audit.jsonl audit log, D-1 Online setup mode deviation (+4 more)

### Community 67 - "sessions.py"
Cohesion: 0.18
Nodes (8): _BufferedEvent, _Producer, GestureEventMessage, Time-weight the previous observation over the interval up to this one., GestureEventMessage, SuggestedActionMessage, In-memory session store. Sessions live in this process only: run a single…, SuggestedActionMessage

### Community 68 - "memoria-3d/VisionBridge.ts"
Cohesion: 0.16
Nodes (12): eq(), FakeAdapter, ok(), setup(), CAMERA_ASSIST_STORAGE_KEY, DelayInstructionSuggestion, InstructionHoldOptions, OUTCOME_MAP (+4 more)

### Community 70 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 71 - "verify/main.ts"
Cohesion: 0.07
Nodes (15): FakeObserver, observer, out, overlay, params, real, record(), recording (+7 more)

### Community 72 - "geometry.ts"
Cohesion: 0.22
Nodes (14): boxCentre(), boxIoU(), boxWidth(), eulerFromFaceMatrix(), eulerFromMatrix(), eyeAspectRatioFromPoints(), faceMatrixFromRotation(), Mat3 (+6 more)

### Community 73 - "web/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @mediapipe/tasks-vision, @types/node, typescript, vite, name, private, type (+3 more)

### Community 74 - "selectProvider.ts"
Cohesion: 0.23
Nodes (9): DEFAULT_GEMINI_MODEL, GeminiConfig, LlamaCppConfig, ProviderAdapter, EMPTY_STUB_SCRIPT, NullProviderAdapter, SelectProviderOptions, StubProviderAdapter (+1 more)

### Community 75 - "ui.ts"
Cohesion: 0.18
Nodes (9): EnvironmentReport, AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage, RenderedProblem, StageProgress (+1 more)

### Community 76 - "snapshot.ts"
Cohesion: 0.09
Nodes (16): buildSnapshot(), copy(), localCamera(), phaseOf(), SnapshotInputs, visionBlockedReason(), AttentionState, CameraAdapterApi (+8 more)

### Community 78 - "setup-assets.mjs"
Cohesion: 0.33
Nodes (10): copyWasm(), exists(), fail(), installModel(), modelDst, sha256(), verify(), wasmDst (+2 more)

### Community 79 - "House templates"
Cohesion: 0.29
Nodes (10): Five-room house with fenced garden, auditDoorways, auditReachability, Templates hallway, row, openPlan, courtyard, House templates, Poly Haven texture sets (surfaces and detail), proceduralHouse.ts / buildHouse generator, Determinism and hallway regression snapshot (+2 more)

### Community 80 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 81 - "scripts"
Cohesion: 0.20
Nodes (10): scripts, build, check:browser, check:demo, dev, integration, preview, setup:assets (+2 more)

### Community 83 - "camera-e2e.mjs"
Cohesion: 0.10
Nodes (18): CDP, chrome, cleanup(), failed, freePort(), GAME, kill(), launch() (+10 more)

### Community 84 - "EnvironmentEditor.ts"
Cohesion: 0.50
Nodes (7): needsSetup(), geminiConfigFromEnv(), llamaCppConfigFromEnv(), selectProvider(), destinationLine(), environmentEditor(), waitingLine()

### Community 86 - "proposals.fixtures.ts"
Cohesion: 0.15
Nodes (14): DEFAULT_AGENT_CONFIG, baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), PROPOSAL_FIXTURES, sparseContext() (+6 more)

### Community 87 - "createObservation"
Cohesion: 0.36
Nodes (6): createObservation(), disable(), setEnabled(), readCameraAssist(), StorageLike, writeCameraAssist()

### Community 88 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../../tsconfig.json

### Community 89 - "Connection"
Cohesion: 0.33
Nodes (3): Connection, Any, One WebSocket client. Outgoing messages go through a bounded queue so a slow…

### Community 90 - "devDependencies"
Cohesion: 0.29
Nodes (7): devDependencies, @types/node, @types/ws, typescript, vite, vitest, ws

### Community 91 - "vision.worker.ts"
Cohesion: 0.28
Nodes (6): WARMUP_TIMESTAMP_MS, WorkerRequest, WorkerResponse, post(), scope, WorkerScope

### Community 92 - "VisionBridge"
Cohesion: 0.15
Nodes (7): InstructionHoldOptions, OpenTask, OUTCOME_MAP, taskIdFor(), VisionBridge, VisionBridgeOptions, Event

### Community 93 - "Memoria 3D camera assistance patch"
Cohesion: 0.19
Nodes (13): Stub model (stubModel.ts), Agent configuration (enabled false, setupMode, provider stub), Completion outcomes (independent, cued, revealed, skipped), Hint ladder (repeat, highlight, guide/reveal), Recorder.beginAttempt (one attempt per export), Telemetry event contract and summary, bridge.check.ts (62 assertions), Camera assistance toggle (memoria-camera-assist-v1) (+5 more)

### Community 94 - "camera.check.ts"
Cohesion: 0.12
Nodes (14): adapterState(), away, body, derived(), failures, fakeRuntime, Listeners, m() (+6 more)

### Community 99 - "3D game/vite.config.ts"
Cohesion: 0.29
Nodes (5): CAMERA_ASSETS, CAMERA_PUBLIC, CAMERA_WEB, here, TYPES

### Community 103 - "dev.mjs"
Cohesion: 0.13
Nodes (12): busy, CAMERA_WEB, children, GAME, GAME_PORT, OBS_PORT, problems, PYTHON (+4 more)

### Community 104 - "environment.ts"
Cohesion: 0.16
Nodes (12): colors, describeEnvironment(), ENVIRONMENT_TOOL, validateEnvironment(), ENVIRONMENT_REASONING, ENVIRONMENT_SYSTEM_PROMPT, ProbeImage, image (+4 more)

### Community 105 - "Memoria Unified: Memoria 3D with optional camera support"
Cohesion: 0.13
Nodes (14): Adaptation rules, Architecture as built, Environment, Field mapping: camera app to game, Files that connect the projects, Gameplay telemetry to service events, Known limitations, Manual webcam check (about 5 minutes) (+6 more)

### Community 106 - "package.json"
Cohesion: 0.14
Nodes (13): description, engines, node, name, private, scripts, check, check:e2e (+5 more)

### Community 108 - "Rig"
Cohesion: 0.18
Nodes (4): FakePlayer, FakeState, FakeVoices, Rig

### Community 112 - "check.mjs"
Cohesion: 0.25
Nodes (7): full, GAME, results, ROOT, SERVICE, steps, WEB

### Community 113 - "setup.mjs"
Cohesion: 0.25
Nodes (6): CAMERA_WEB, force, GAME, ROOT, SERVICE, venvPython

### Community 115 - "plan.ts"
Cohesion: 0.52
Nodes (6): band(), cutsWall(), FLOOR, n(), planSvg(), rect()

### Community 116 - "Agent-assisted caregiver setup (Checkpoint F)"
Cohesion: 0.50
Nodes (5): Agent-assisted caregiver setup (Checkpoint F), Agent tool contracts (read and proposal tools), request_caregiver_input escape hatch, Rule F-1: no model call during a patient session, Rule F-2: agent proposes, never commits

## Knowledge Gaps
- **468 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+463 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 859 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ObservationBody` connect `ObservationBody` to `PerfInfo`, `integration.ts`, `vision/contracts.ts`, `FaceObserver.ts`, `FaceObserver`, `verify/main.ts`, `geometry.ts`, `transport.test.ts`, `app.ts`, `ProducerConnection`, `integration-check.ts`, `ProducerConnection.ts`, `SignalProcessor`, `protocol/types.ts`, `FaceObserverApi`, `demo/main.ts`, `CameraAdapter`, `camera.check.ts`?**
  _High betweenness centrality (0.154) - this node is a cross-community bridge._
- **Why does `boot()` connect `boot` to `proceduralHouse.ts`, `src/main.ts`, `MemoryPack.ts`, `Player`, `LocalProfile.ts`, `ui.ts`, `State`, `agent-gemini.check.ts`, `World.ts`, `MissionRunner`, `EnvironmentEditor.ts`, `CameraIntegration`, `Quality.ts`, `Telemetry`, `CameraUI`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `Event` connect `VisionBridge` to `integration.ts`, `src/main.ts`, `agent-provenance.check.ts`, `pack.check.ts`, `Rig`, `camera.check.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **Are the 18 inferred relationships involving `SessionEngine` (e.g. with `PolicyConfig` and `AngleMeasurement`) actually correct?**
  _`SessionEngine` has 18 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _468 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_engine.py` be split into smaller, more focused modules?**
  _Cohesion score 0.05581395348837209 - nodes in this community are weakly interconnected._