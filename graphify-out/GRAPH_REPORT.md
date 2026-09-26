# Graph Report - Memoria_Unified  (2026-09-26)

## Corpus Check
- 253 files · ~417,538 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 4, .example 3, .woff2 1)

## Summary
- 4122 nodes · 9388 edges · 183 communities (156 shown, 24 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 596 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd9b5338`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- camera.check.ts
- ProducerConnection
- agent-prompts.check.ts
- integration-check.ts
- ProducerConnection.ts
- Kit
- tools.ts
- agent-gemini.check.ts
- protocol/types.ts
- MissionRunner
- model_validator
- create_app
- signals.test.ts
- landmarker.ts
- templates/types.ts
- world.check.ts
- Quality.ts
- agent-images.check.ts
- templates/index.ts
- CameraUI
- Session
- demo-check.mjs
- suite-app.check.ts
- FaceObserver
- gestures.ts
- review.ts
- SuiteAudio
- PolicyConfig
- 3D game/package.json
- gemini.ts
- offline-check.mjs
- FastAPI observation service (engine.py, sessions.py, main.py)
- protocol/validate.ts
- grammar.ts
- agent-review.check.ts
- State
- worldSnapshot.ts
- Memoria 3D
- Memoria 3D Specification
- agent-provider.check.ts
- World.ts
- profile-check.mjs
- browser-check.mjs
- demo/main.ts
- app/app.ts
- SuiteController
- compilerOptions
- Content firewall validateProposal (rules F-a to F-i)
- CameraAdapter
- harness.ts
- Telemetry
- make-photos.py
- compilerOptions
- observation.ts
- FaceObserver.ts
- CameraSnapshot
- Privacy: offline default, online opt-in
- .t
- memoria-3d/VisionBridge.ts
- VisionBridge
- perf-templates.mjs
- ObservationBody
- suite-activities.check.ts
- web/package.json
- content/validate.ts
- ui.ts
- test_api.py
- InstructionHold
- setup-assets.mjs
- House templates
- run.mjs
- scripts
- FaceObserverApi
- camera-e2e.mjs
- definitions.ts
- HintBeacon
- proposals.fixtures.ts
- createObservation
- checks/tsconfig.json
- Connection
- devDependencies
- .schedule
- VisionBridge
- Memoria 3D camera assistance patch
- suite/contracts.ts
- enabled.ts
- make-media.sh
- apply.sh
- unapply.sh
- 3D game/vite.config.ts
- content/prompts.ts
- dev.mjs
- make-sounds.mjs
- Memoria Unified: Memoria 3D, the Reminiscence Therapy Suite, and optional camera support
- package.json
- openCaregiverSetup
- summary
- InstructionHold
- summary
- Canvas
- check.mjs
- setup.mjs
- CameraUI.ts
- assets/index.ts
- Agent-assisted caregiver setup (Checkpoint F)
- environments/index.ts
- VisionBridgeCallbacks
- three
- AdaptableRunner
- editor.ts
- settings
- settings
- explore
- explore
- ExploreView
- resolve.ts
- prototypes.ts
- materials.ts
- gltf.ts
- caregiver
- caregiver
- i18n/index.ts
- suite-profile.check.ts
- ShellKit
- model.ts
- home
- home
- en/app.json
- hi/app.json
- integration.ts
- ActivitySessionApi
- ScenePhotoSurface
- FakeUI
- place
- place
- h
- runtimeText.ts
- Reminiscence Therapy Suite: controls, comfort and accessibility
- activity
- closeup
- activity
- closeup
- errMsg
- createCameraIntegration
- Content packs
- Personalization in the Reminiscence Therapy Suite
- suite-assets.check.ts
- vision
- vision
- render-thumbnails.mjs
- suite/browser-check.mjs
- Activities
- Languages in the Reminiscence Therapy Suite
- Reminiscence Therapy Suite — implementation plan and working agreement
- Reminiscence Therapy Suite
- who
- who
- SuiteTelemetryPort
- _BoundedSet
- Suite assets — provenance and attribution
- pause
- pause
- Assets and environments
- SuiteStatePort
- fetch-textures.mjs
- write-environments.py
- run-check.mjs
- .constructor
- manifest.json
- Fonts

## God Nodes (most connected - your core abstractions)
1. `Kit` - 102 edges
2. `SuiteController` - 86 edges
3. `boot()` - 78 edges
4. `FaceObserver` - 54 edges
5. `GameAdapter` - 53 edges
6. `ProducerConnection` - 53 edges
7. `openCaregiverSetup()` - 46 edges
8. `three` - 44 edges
9. `SessionEngine` - 43 edges
10. `create_app()` - 43 edges

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

## Communities (183 total, 24 thin omitted)

### Community 0 - "test_engine.py"
Cohesion: 0.09
Nodes (40): IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., ObservationMessage, gesture(), answer(), Harness, parametrize (+32 more)

### Community 1 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (54): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+46 more)

### Community 2 - "boot"
Cohesion: 0.07
Nodes (7): boot(), standableIn(), PackVoices, MissionRunnerDeps, Player, escapeText(), UI

### Community 3 - "src/main.ts"
Cohesion: 0.06
Nodes (34): samplePerf(), describe(), FocusProbe, percentile(), PerfResult, renderOnly(), breakagesFromLocation(), patientIdFromLocation() (+26 more)

### Community 4 - "MemoryPack.ts"
Cohesion: 0.07
Nodes (35): CardStyle, fitToPlate(), injectAnchors(), isObject(), Json, loadAudio(), LoadedPack, loadImage() (+27 more)

### Community 5 - "SessionEngine"
Cohesion: 0.07
Nodes (38): _Answer, _BufferedEvent, _median(), _Producer, GestureEventMessage, Per-session engine: ordering/dedup, derived state, and the deterministic…, Time-weight the previous observation over the interval up to this one., Freeze the inactivity clock while paused or in an expected idle period. (+30 more)

### Community 6 - "pack.check.ts"
Cohesion: 0.05
Nodes (20): PackProblem, FakeImage, failures, fakeCtx, FakeImage, fakeLoad(), FakePlayer, FakeState (+12 more)

### Community 7 - "GameAdapter"
Cohesion: 0.12
Nodes (6): GameEventMessage, ConnectionStatus, GameAdapterOptions, detach(), GameAdapter, randomId()

### Community 8 - "LocalProfile.ts"
Cohesion: 0.13
Nodes (27): applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId(), newProfile() (+19 more)

### Community 9 - "transport.test.ts"
Cohesion: 0.08
Nodes (22): Backoff, backoffDelay(), classifyClose(), CloseOutcome, DEFAULT_RECONNECT, finiteOr(), resolveReconnectOptions(), ReconnectOptions (+14 more)

### Community 10 - "camera.check.ts"
Cohesion: 0.04
Nodes (31): GameEventSink, InstructionHoldOptions, OpenTask, OUTCOME_MAP, VisionBridgeOptions, adapterState(), away, body (+23 more)

### Community 11 - "ProducerConnection"
Cohesion: 0.14
Nodes (4): fatalHttpReason(), WebSocketLike, noop(), ProducerConnection

### Community 12 - "agent-prompts.check.ts"
Cohesion: 0.09
Nodes (27): colors, ENVIRONMENT_TOOL, validateEnvironment(), anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext, buildAuthoringSystemPrompt() (+19 more)

### Community 13 - "integration-check.ts"
Cohesion: 0.10
Nodes (25): AdapterProbe, assert(), freePort(), m(), main(), makeProducer(), now(), originFetch (+17 more)

### Community 14 - "ProducerConnection.ts"
Cohesion: 0.08
Nodes (31): HelloMessage, SCHEMA_VERSION, ServerMessage, streamUrl(), toWebSocketUrl(), trimBaseUrl(), ProducerConnectionOptions, WebSocketFactory (+23 more)

### Community 15 - "Kit"
Cohesion: 0.08
Nodes (100): frameBars(), legs(), mat(), num(), Params, pivot(), runtimeText(), str() (+92 more)

### Community 16 - "tools.ts"
Cohesion: 0.10
Nodes (30): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), dispatch() (+22 more)

### Community 17 - "agent-gemini.check.ts"
Cohesion: 0.08
Nodes (32): AgentConfig, agentConfigStore, AgentProvider, consentPromptFor(), ensureConsent(), isAgentProvider(), isSetupMode(), needsSetup() (+24 more)

### Community 18 - "protocol/types.ts"
Cohesion: 0.04
Nodes (68): LocalCamera, VisionView, AckMessage, ActionType, AngleMeasurement, ApiErrorBody, BoolMeasurement, CalibrationInfo (+60 more)

### Community 19 - "MissionRunner"
Cohesion: 0.11
Nodes (6): instructionOf(), MissionRunner, speak(), stopSpeaking(), Outcome, ChoiceCard

### Community 21 - "create_app"
Cohesion: 0.08
Nodes (49): Player-observation service: ingests derived webcam measurements and gameplay…, ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state() (+41 more)

### Community 22 - "signals.test.ts"
Cohesion: 0.12
Nodes (19): faceMatrixFromRotation(), rotationFromEuler(), assertBodyValid(), assertFinite(), assertMeasurement(), awayTransition(), Box, Driver (+11 more)

### Community 23 - "landmarker.ts"
Cohesion: 0.11
Nodes (23): blendshape(), clamp01(), CreatedLandmarker, createLandmarker(), CreateLandmarkerOptions, errMsg(), extractFaces(), eyeAspectRatio() (+15 more)

### Community 24 - "templates/types.ts"
Cohesion: 0.11
Nodes (33): extent(), FACING, mirrorTemplate(), mirrorYaw(), mount(), neg(), opening(), point2() (+25 more)

### Community 25 - "world.check.ts"
Cohesion: 0.10
Nodes (17): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+9 more)

### Community 26 - "Quality.ts"
Cohesion: 0.08
Nodes (18): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+10 more)

### Community 27 - "agent-images.check.ts"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

### Community 28 - "templates/index.ts"
Cohesion: 0.18
Nodes (21): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+13 more)

### Community 30 - "Session"
Cohesion: 0.13
Nodes (7): BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket, StateMessage

### Community 31 - "demo-check.mjs"
Cohesion: 0.10
Nodes (21): cdp(), chrome, click(), clickEv(), ev(), page, pending, procs (+13 more)

### Community 32 - "suite-app.check.ts"
Cohesion: 0.06
Nodes (39): angleDelta(), BoxLike, clamp(), clampLook(), classifyGesture(), collides(), dampFactor(), DEG (+31 more)

### Community 34 - "gestures.ts"
Cohesion: 0.11
Nodes (11): DetectedHeadGesture, HeadGestureConfig, HeadGestureDetector, HeadGestureType, Sample, SwingMatch, SwingParams, SwingPoint (+3 more)

### Community 35 - "review.ts"
Cohesion: 0.08
Nodes (25): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), ConsentPrompt, FirewallContext, Violation, ProposalFixture, computeProvenance() (+17 more)

### Community 36 - "SuiteAudio"
Cohesion: 0.08
Nodes (12): channelLevel(), choosePromptRoute(), findVoice(), norm(), Playing, PromptRoute, SuiteAudio, SuiteAudioOptions (+4 more)

### Community 37 - "PolicyConfig"
Cohesion: 0.12
Nodes (14): BaseSettings, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig., Process settings. Read from environment variables prefixed OBS_ (see… (+6 more)

### Community 38 - "3D game/package.json"
Cohesion: 0.09
Nodes (22): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, @types/node (+14 more)

### Community 39 - "gemini.ts"
Cohesion: 0.08
Nodes (43): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), DEFAULT_GEMINI_MODEL, friendlyMessage(), GeminiConfig, GeminiProviderAdapter, imagePart() (+35 more)

### Community 40 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 41 - "FastAPI observation service (engine.py, sessions.py, main.py)"
Cohesion: 0.11
Nodes (34): Actions are suggestions; game decides, Connecting a game (integration guide), createSession / deleteSession, Game hooks for adapter outputs, apply.sh / unapply.sh, observation.ts createObservation, Calibration (neutral pose reference), DerivedState / attention_state (+26 more)

### Community 42 - "protocol/validate.ts"
Cohesion: 0.23
Nodes (20): ACTION_SOURCES, ACTION_TYPES, allNumbersFinite(), ATTENTION_STATES, GESTURE_TYPES, hasVersion(), isDerivedState(), isGesture() (+12 more)

### Community 43 - "grammar.ts"
Cohesion: 0.35
Nodes (12): asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule(), ParsedCall, parseProposalCalls() (+4 more)

### Community 44 - "agent-review.check.ts"
Cohesion: 0.09
Nodes (28): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+20 more)

### Community 45 - "State"
Cohesion: 0.10
Nodes (6): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, State, StateListener, TIMERS_RUN

### Community 46 - "worldSnapshot.ts"
Cohesion: 0.18
Nodes (16): out, snapshot, w, world, snap(), box(), canonicalQuaternion(), Json (+8 more)

### Community 47 - "Memoria 3D"
Cohesion: 0.24
Nodes (13): CSP allowances (dl.polyhaven.org, generativelanguage.googleapis.com), Memoria 3D Deployment (incomplete), Netlify deployment, Never set VITE_GEMINI_API_KEY for hosted builds, Vercel deployment, vite.config base './', Memoria 3D HTML shell (#app, /src/main.ts), npm run check:offline (+5 more)

### Community 48 - "Memoria 3D Specification"
Cohesion: 0.15
Nodes (16): Adaptive resolution (texture upgrade, anisotropy, pixel-ratio ladder), window.__memoria debug handle, debug.canFocus reachability probe, Checkpoints A–G, glbHouse.ts (deferred), Highlight (emissive lift, cloned material), Interaction raycast with Box3 occlusion, Levels (water, morning-walk, familiar-memories) (+8 more)

### Community 49 - "agent-provider.check.ts"
Cohesion: 0.13
Nodes (8): AuditEntry, AuditLog, AuditSink, consoleAuditSink, CONSENT_PROMPT, failures, REQUEST, WITH_IMAGE

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

### Community 54 - "app/app.ts"
Cohesion: 0.07
Nodes (30): Overlay, Run, Screen, isControl(), isTyping(), ARROWS, BLOCKING_SELECTORS, keyAction (+22 more)

### Community 55 - "SuiteController"
Cohesion: 0.11
Nodes (5): createSuiteAppWith(), SuiteController, focusFirst(), setText(), walkVector()

### Community 56 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 57 - "Content firewall validateProposal (rules F-a to F-i)"
Cohesion: 0.16
Nodes (17): commitPack.ts draft pack folding, Demo memory packs (Mira, Raju), Generated pack media (make-media.sh, make-photos.py, say), ReviewSession (review.ts), Caregiver personalisation (local browser profile), Content firewall validateProposal (rules F-a to F-i), Image may license visual properties, never autobiographical facts, IndexedDB memoria-caregiver-v1 profile store (+9 more)

### Community 58 - "CameraAdapter"
Cohesion: 0.06
Nodes (24): CameraAdapter, CameraAdapterOptions, errText(), Runtime, buildSnapshot(), copy(), localCamera(), observerError() (+16 more)

### Community 59 - "harness.ts"
Cohesion: 0.08
Nodes (29): SummaryInput, ACTIVITIES, broken, buildScene(), camera, clock, d, demoPhoto (+21 more)

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
Cohesion: 0.15
Nodes (14): ErrorCode, INFERENCE_TIMEOUT_MS, InFlight, LandmarkerModule, MainLandmarker, mapCameraError(), MAX_CONSECUTIVE_FAILURES, VideoWithRvfc (+6 more)

### Community 65 - "CameraSnapshot"
Cohesion: 0.23
Nodes (4): AdaptationEffects, AdaptationPolicy, CameraSnapshot, policyRig()

### Community 66 - "Privacy: offline default, online opt-in"
Cohesion: 0.21
Nodes (12): AGENT_TOOL_SCHEMA constrained tool calls, Generate home appearance from room photos, GeminiProviderAdapter (gemini.ts), images.ts EXIF strip and derivatives, LlamaCppProviderAdapter (llamaCpp.ts), Prompt layer prompts.ts (version f-2, reasoning steps), agent-audit.jsonl audit log, D-1 Online setup mode deviation (+4 more)

### Community 67 - ".t"
Cohesion: 0.12
Nodes (10): dispose(), activityCard(), badge(), durationText(), header(), renderActivity(), renderHome(), renderPlace() (+2 more)

### Community 68 - "memoria-3d/VisionBridge.ts"
Cohesion: 0.16
Nodes (12): eq(), FakeAdapter, ok(), setup(), CAMERA_ASSIST_STORAGE_KEY, DelayInstructionSuggestion, InstructionHoldOptions, OUTCOME_MAP (+4 more)

### Community 70 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 71 - "ObservationBody"
Cohesion: 0.05
Nodes (28): SnapshotInputs, FakeObserver, FakeProducer, matrixFromPlayerAngles(), Motion, SimulatedFaceSource, SimulationControls, ObservationBody (+20 more)

### Community 72 - "suite-activities.check.ts"
Cohesion: 0.11
Nodes (32): ACTIVITIES, createActivitySession(), EventInput, gentleCueShown(), buildSummary(), loadContentPacks, packDisplayMedia, ActivitySessionOptions (+24 more)

### Community 73 - "web/package.json"
Cohesion: 0.17
Nodes (11): dependencies, @mediapipe/tasks-vision, @types/node, typescript, vite, name, private, type (+3 more)

### Community 74 - "content/validate.ts"
Cohesion: 0.16
Nodes (32): LoadContentOptions, loadContentPacks(), loadOne(), message(), ASSET_CATEGORIES, AssetLookup, checkActivities(), checkProvenance() (+24 more)

### Community 75 - "ui.ts"
Cohesion: 0.25
Nodes (7): AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage, RenderedProblem, SummaryView

### Community 76 - "test_api.py"
Cohesion: 0.15
Nodes (30): game_event(), m(), observation(), Any, Builders for well-formed messages, so each test only states what it cares about., auth(), create(), parametrize (+22 more)

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
Cohesion: 0.06
Nodes (32): ffprobeDurationMs(), GENERATED, imageDefs(), IMAGES, NORTHEAST_PROMPTS, NORTHEAST_SOUND_IDS, NOTICE, p() (+24 more)

### Community 84 - "definitions.ts"
Cohesion: 0.13
Nodes (28): assignPhotos(), Availability, avoidOf(), define(), DEMO_SEQUENCE_OBJECTS, demoSequence(), highlighted(), isAlbum() (+20 more)

### Community 86 - "proposals.fixtures.ts"
Cohesion: 0.16
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

### Community 92 - "VisionBridge"
Cohesion: 0.21
Nodes (3): taskIdFor(), VisionBridge, Event

### Community 93 - "Memoria 3D camera assistance patch"
Cohesion: 0.19
Nodes (13): Stub model (stubModel.ts), Agent configuration (enabled false, setupMode, provider stub), Completion outcomes (independent, cued, revealed, skipped), Hint ladder (repeat, highlight, guide/reveal), Recorder.beginAttempt (one attempt per export), Telemetry event contract and summary, bridge.check.ts (62 assertions), Camera assistance toggle (memoria-camera-assist-v1) (+5 more)

### Community 94 - "suite/contracts.ts"
Cohesion: 0.10
Nodes (25): Prepared, SuiteDeps, ActivityContext, ActivityRegistry, AssetSource, AssignPhotos, AudioRef, BuildSceneOptions (+17 more)

### Community 99 - "3D game/vite.config.ts"
Cohesion: 0.29
Nodes (5): CAMERA_ASSETS, CAMERA_PUBLIC, CAMERA_WEB, here, TYPES

### Community 102 - "content/prompts.ts"
Cohesion: 0.08
Nodes (19): ContentState, DEMO_TEXTURE_MAX, demoPhoto(), packDisplayMedia(), packSound(), allows(), GENERIC_PROMPT_COUNTS, ItemKind (+11 more)

### Community 103 - "dev.mjs"
Cohesion: 0.13
Nodes (12): busy, CAMERA_WEB, children, GAME, GAME_PORT, OBS_PORT, problems, PYTHON (+4 more)

### Community 104 - "make-sounds.mjs"
Cohesion: 0.09
Nodes (25): biquad(), buf(), burst(), durationMs(), fades(), FFMPEG, filter(), LAME (+17 more)

### Community 105 - "Memoria Unified: Memoria 3D, the Reminiscence Therapy Suite, and optional camera support"
Cohesion: 0.11
Nodes (17): Adaptation rules, Architecture as built, Environment, Field mapping: camera app to game, Files that connect the projects, Gameplay telemetry to service events, Known limitations, Manual webcam check (about 5 minutes) (+9 more)

### Community 106 - "package.json"
Cohesion: 0.14
Nodes (13): description, engines, node, name, private, scripts, check, check:e2e (+5 more)

### Community 107 - "openCaregiverSetup"
Cohesion: 0.25
Nodes (31): openCaregiverSetup(), addPhotos(), addSounds(), applyLanguage(), audioFrom(), audioPreview(), button(), checkField() (+23 more)

### Community 108 - "summary"
Cohesion: 0.07
Nodes (30): one, other, one, other, summary, activity, another, closeups (+22 more)

### Community 110 - "summary"
Cohesion: 0.07
Nodes (30): one, other, one, other, summary, activity, another, closeups (+22 more)

### Community 111 - "Canvas"
Cohesion: 0.14
Nodes (17): bamboo_grove(), Canvas, flowers(), fruit_bowl(), hexrgb(), hills_mist(), hills_morning(), paddy_fields() (+9 more)

### Community 112 - "check.mjs"
Cohesion: 0.25
Nodes (7): full, GAME, results, ROOT, SERVICE, steps, WEB

### Community 113 - "setup.mjs"
Cohesion: 0.25
Nodes (6): CAMERA_WEB, force, GAME, ROOT, SERVICE, venvPython

### Community 114 - "CameraUI.ts"
Cohesion: 0.16
Nodes (6): CameraUICallbacks, describeError(), describeHold(), describeSnapshot(), StepState, writePref()

### Community 115 - "assets/index.ts"
Cohesion: 0.13
Nodes (20): hasBuilder(), createAssetLibrary(), Library, loadAssetLibrary(), MANIFEST_PATH, ACCEPTED_LICENSES, CATEGORIES, hasEn() (+12 more)

### Community 116 - "Agent-assisted caregiver setup (Checkpoint F)"
Cohesion: 0.50
Nodes (5): Agent-assisted caregiver setup (Checkpoint F), Agent tool contracts (read and proposal tools), request_caregiver_input escape hatch, Rule F-1: no model call during a patient session, Rule F-2: agent proposes, never commits

### Community 117 - "environments/index.ts"
Cohesion: 0.13
Nodes (26): createCanvas(), ObjectOverrides, Placement, SceneReport, buildSuiteScene(), Built, downscale(), FLOOR_SETS (+18 more)

### Community 119 - "three"
Cohesion: 0.13
Nodes (20): ShellInfo, ShellMaterials, ShellSlot, courtyardVeranda, POSTS, slots, LIGHT_COLOUR, Opening (+12 more)

### Community 120 - "AdaptableRunner"
Cohesion: 0.14
Nodes (3): CameraIntegration, AdaptableRunner, SuiteCameraPort

### Community 121 - "editor.ts"
Cohesion: 0.10
Nodes (16): CaregiverAudio, CaregiverPrompt, SequenceRef, SuitePhoto, SuiteSound, SectionName, SECTIONS, Vars (+8 more)

### Community 122 - "settings"
Cohesion: 0.08
Nodes (26): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+18 more)

### Community 123 - "settings"
Cohesion: 0.08
Nodes (26): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+18 more)

### Community 124 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 125 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 127 - "resolve.ts"
Cohesion: 0.22
Nodes (13): createSuiteApp(), SuiteMediaApi, envKey(), objectPromptKey(), suiteOf(), close(), displayPhoto(), fitWithin() (+5 more)

### Community 128 - "prototypes.ts"
Cohesion: 0.12
Nodes (15): BUILDERS, BuilderContext, FLAT_ENV, MaterialLease, acquireProcedural(), envSignature(), Prototype, prototypes (+7 more)

### Community 129 - "materials.ts"
Cohesion: 0.15
Nodes (15): cache, create(), MaterialEnv, MatSpec, PALETTE, signature(), tintFor(), weaveTexture() (+7 more)

### Community 130 - "gltf.ts"
Cohesion: 0.13
Nodes (9): Disposable, RefCache, acquireGltf(), cache, GltfPrototype, load(), pending, releaseGltf() (+1 more)

### Community 131 - "caregiver"
Cohesion: 0.11
Nodes (19): addNote, failed, hide, hint, homeHint, homeOpen, homeTitle, items (+11 more)

### Community 132 - "caregiver"
Cohesion: 0.11
Nodes (19): addNote, failed, hide, hint, homeHint, homeOpen, homeTitle, items (+11 more)

### Community 133 - "i18n/index.ts"
Cohesion: 0.26
Nodes (17): LanguageInfo, flattenEntries(), flattenKeys(), formatNumber(), interpolate(), isTree(), lookup(), pluralCategory() (+9 more)

### Community 134 - "suite-profile.check.ts"
Cohesion: 0.18
Nodes (18): LocaleIndex, placeholders(), resolveText(), audioMime(), defaultSuiteProfile(), mb(), validateAudioFile(), validatePhotoFile() (+10 more)

### Community 136 - "model.ts"
Cohesion: 0.21
Nodes (17): audio(), AUDIO_ALIASES, AUDIO_EXTENSIONS, isBlob(), isObject(), language(), Loose, MediaCheck (+9 more)

### Community 137 - "home"
Cohesion: 0.11
Nodes (18): hint, open, title, hint, open, title, hint, open (+10 more)

### Community 138 - "home"
Cohesion: 0.11
Nodes (18): hint, open, title, hint, open, title, hint, open (+10 more)

### Community 139 - "en/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 140 - "hi/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 141 - "integration.ts"
Cohesion: 0.16
Nodes (13): AdaptationConfig, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraIntegrationDeps, Env, LOOPBACK (+5 more)

### Community 143 - "ScenePhotoSurface"
Cohesion: 0.17
Nodes (6): PhotoSurface, DecorativeLoader, FACING, fitInside(), MAT_MARGIN, ScenePhotoSurface

### Community 144 - "FakeUI"
Cohesion: 0.13
Nodes (4): endToEnd(), FakeState, FakeUI, makeWorld()

### Community 145 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 146 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 147 - "h"
Cohesion: 0.29
Nodes (9): append(), AttrValue, button(), Child, clear(), h(), trapFocus(), ActionName (+1 more)

### Community 148 - "runtimeText.ts"
Cohesion: 0.22
Nodes (9): drawCalendar(), drawRuntimeText(), drawSpines(), fitFont(), RuntimeTextInput, RuntimeTextSpec, RuntimeTextSurface, safeFormat() (+1 more)

### Community 149 - "Reminiscence Therapy Suite: controls, comfort and accessibility"
Cohesion: 0.15
Nodes (13): Camera movement, Camera support wording, Checks, Comfort choices, Comfort settings, Controls, Keyboard, Languages (+5 more)

### Community 150 - "activity"
Cohesion: 0.17
Nodes (12): activity, failed, guidedFirst, note, otherPlace, place, preparing, retry (+4 more)

### Community 151 - "closeup"
Cohesion: 0.17
Nodes (12): closeup, alt, altNone, back, close, demoNotice, fit, people (+4 more)

### Community 152 - "activity"
Cohesion: 0.17
Nodes (12): activity, failed, guidedFirst, note, otherPlace, place, preparing, retry (+4 more)

### Community 153 - "closeup"
Cohesion: 0.17
Nodes (12): closeup, alt, altNone, back, close, demoNotice, fit, people (+4 more)

### Community 154 - "errMsg"
Cohesion: 0.30
Nodes (5): Aborted, absoluteUrl(), errMsg(), ObserverError, Delegate

### Community 155 - "createCameraIntegration"
Cohesion: 0.38
Nodes (7): createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera(), syncTick()

### Community 156 - "Content packs"
Cohesion: 0.20
Nodes (10): content.json, Content packs, Demo pictures, Files, How `appliesTo` is matched, Regenerating, Sounds, To add a pack (+2 more)

### Community 157 - "Personalization in the Reminiscence Therapy Suite"
Cohesion: 0.20
Nodes (9): Limits, Media that cannot be shown, Personalization in the Reminiscence Therapy Suite, Privacy, Prompts, Storage, The "no inference" rules, Verification (+1 more)

### Community 158 - "suite-assets.check.ts"
Cohesion: 0.20
Nodes (7): SHELLS, SHELL_DEFS, errors, failures, packErrors, shells, SUITE

### Community 159 - "vision"
Cohesion: 0.25
Nodes (8): vision, cues, held, label, samples, title, tracking, unmeasured

### Community 160 - "vision"
Cohesion: 0.25
Nodes (8): vision, cues, held, label, samples, title, tracking, unmeasured

### Community 161 - "render-thumbnails.mjs"
Cohesion: 0.25
Nodes (6): chrome, out, profile, root, vite, work

### Community 162 - "suite/browser-check.mjs"
Cohesion: 0.25
Nodes (5): chrome, failures, profile, root, server

### Community 163 - "Activities"
Cohesion: 0.29
Nodes (7): Activities, Adding an activity, How camera timing interacts, Prompt order, The five activities, The no-scoring rule, The session

### Community 164 - "Languages in the Reminiscence Therapy Suite"
Cohesion: 0.29
Nodes (6): About the Hindi, Adding a language (example: Bengali, `bn`), Current coverage, How it works, Languages in the Reminiscence Therapy Suite, Longest strings

### Community 165 - "Reminiscence Therapy Suite — implementation plan and working agreement"
Cohesion: 0.29
Nodes (7): Architecture, Conventions, File ownership, Fixed ids (so parallel work lines up), Flow, Reminiscence Therapy Suite — implementation plan and working agreement, Sequencing

### Community 166 - "Reminiscence Therapy Suite"
Cohesion: 0.29
Nodes (7): Guides, Known limitations, Language coverage, Not verified here, Reminiscence Therapy Suite, Verification (2026-09-26, macOS, Node 26, headless Chrome with the SwiftShader software renderer), What it is

### Community 167 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 168 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 171 - "Suite assets — provenance and attribution"
Cohesion: 0.33
Nodes (5): Fonts, pictures and sounds, Models, Suite assets — provenance and attribution, Textures (Poly Haven, CC0-1.0), Thumbnails

### Community 172 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 173 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 175 - "Assets and environments"
Cohesion: 0.40
Nodes (4): Add an asset, Add or change an environment, Assets and environments, Budgets

### Community 177 - "fetch-textures.mjs"
Cohesion: 0.40
Nodes (3): OUT, ROOT, SETS

### Community 178 - "write-environments.py"
Cohesion: 0.50
Nodes (3): env(), Writes public/suite/packs/*/environments.json (the environment dressing…, slots()

### Community 179 - "run-check.mjs"
Cohesion: 0.50
Nodes (3): bundle, out, root

## Knowledge Gaps
- **1008 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+1003 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1541 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `three` to `prototypes.ts`, `proceduralHouse.ts`, `gltf.ts`, `src/main.ts`, `MemoryPack.ts`, `materials.ts`, `pack.check.ts`, `LocalProfile.ts`, `agent-prompts.check.ts`, `Kit`, `ScenePhotoSurface`, `runtimeText.ts`, `world.check.ts`, `Quality.ts`, `suite-assets.check.ts`, `suite-app.check.ts`, `3D game/package.json`, `agent-review.check.ts`, `worldSnapshot.ts`, `World.ts`, `harness.ts`, `suite-activities.check.ts`, `suite/contracts.ts`, `content/prompts.ts`, `environments/index.ts`, `resolve.ts`?**
  _High betweenness centrality (0.105) - this node is a cross-community bridge._
- **Why does `ObservationBody` connect `ObservationBody` to `FaceObserver.ts`, `FaceObserver`, `transport.test.ts`, `camera.check.ts`, `ProducerConnection`, `integration-check.ts`, `integration.ts`, `ProducerConnection.ts`, `protocol/types.ts`, `FaceObserverApi`, `demo/main.ts`, `signals.test.ts`, `CameraAdapter`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Why does `ProducerConnection` connect `ProducerConnection` to `ObservationBody`, `GameAdapter`, `transport.test.ts`, `camera.check.ts`, `integration-check.ts`, `ProducerConnection.ts`, `demo/main.ts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 36 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 36 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _1008 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `test_engine.py` be split into smaller, more focused modules?**
  _Cohesion score 0.08880666049953746 - nodes in this community are weakly interconnected._
- **Should `proceduralHouse.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0697980684811238 - nodes in this community are weakly interconnected._