# Graph Report - synaptix_unified  (2026-09-25)

## Corpus Check
- Large corpus: 418 files · ~1,259,460 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 3569 nodes · 8217 edges · 158 communities (136 shown, 22 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 261 edges (avg confidence: 0.85)
- Token cost: 151,228 input · 0 output

## Community Hubs (Navigation)
- 2D Daily Sequence Game
- Unified Camera Integration Docs
- 3D Procedural House Geometry
- 3D Agent Gemini Provider
- Camera Web App & Event Sink
- 3D Boot, UI & Player
- 3D Memory Pack & Missions Content
- 3D Telemetry & Perf Checks
- 3D Agent Authoring Pass
- 3D Agent Consent & Provenance
- Camera Service Session Engine
- 3D Missions & Camera Hooks
- 2D Memory Match Frontend
- 2D Trail Trace Game
- 3D Pack Checks
- Camera GameAdapter (Consumer)
- Synaptix App Shell & Navigation
- Camera Integration Check Script
- Camera ProducerConnection
- 2D GameBridge & Number Challenge
- 3D Agent Config & Setup Mode
- Camera LocalCamera & Contracts
- Camera Engine Tests
- Camera API Tests
- 2D Time-Place Anchor Logic
- Synaptix Health Vitals UI
- Synaptix Bottom Nav
- Synaptix Backend API Router
- 3D Agent Content Firewall
- 3D Local Profile & Photos
- 3D Adaptive Resolution
- Camera Vision Measurements & Filters
- Camera Transport Tests
- 2D Games Package Deps
- Synaptix Backend Patients API
- Camera Service HTTP API
- 2D Puzzle Fun & Northeast Assets
- 2D Daily Sequence Logic
- 3D Player Collision & World
- 3D Template Mirroring
- Camera Web Package Deps
- Camera MediaPipe Landmarker
- Camera E2E Script
- Synaptix Game Select Screen
- Synaptix Local DB & Sync Queue
- Camera Producer Runtime & Protocol Msgs
- Camera Signal Tests
- 2D Time-Place Anchor UI
- 3D CameraAdapter
- 3D Interaction & Highlight
- 3D Agent Image Pipeline
- 3D CameraUI Panel
- 3D Layout Constants & Templates
- Root Dev/Setup Scripts & Vite Wiring
- Camera Service Config & Policy
- Camera Service Schemas
- Camera Protocol Types
- 3D AdaptationPolicy
- Camera Simulated Face Source
- Camera Message Validation
- Memoria-3D Patch Bridge Checks
- Camera Service Session Broadcast
- Camera Demo Check Script
- 2D Familiar Faces Content
- 3D Package Deps
- 3D Agent Prompts
- 3D Offline Check Script
- Camera FaceObserver Core
- Synaptix Frontend Deps
- 3D Agent Proposal Grammar
- 3D VisionBridge
- Memoria-3D Patch Observation Panel
- Camera SignalProcessor
- Synaptix Medicine Service
- 3D Camera Types & Adapter API
- 3D Camera Checks
- Synaptix Backend App Init
- 2D Familiar Faces UI
- 3D Game State Machine
- 2D Word Builder Game
- 2D Games TSConfig
- 3D Camera Integration Wiring
- 3D Camera Snapshot & Live Adapter
- Camera Gestures & Fakes
- 3D World Snapshot Checks
- 3D Profile Check Script
- Pytest Conftest & Image Scraper
- Camera Browser Check Script
- Synaptix Health & Medicine UI
- 2D Difficulty & Progress Types
- 3D Photo Generator Script
- Root Dev Orchestrator
- Camera Demo Page
- Camera FaceObserver Inference Loop
- Camera Web TSConfig
- Synaptix Frontend TSConfig
- 3D Agent Audit Log
- 3D Telemetry Events
- 3D TSConfig
- Synaptix Icons
- Memoria 3D Docs & Deploy
- Memoria-3D Patch VisionBridge
- Synaptix Frontend Runtime Deps
- 3D Check Runner
- Camera Worker Backend Init
- Camera Head-Pose Geometry
- Camera Service Docs
- Camera Reconnect Backoff
- Root Package Scripts
- Synaptix Auth Service
- 3D Template Perf Script
- Memoria-3D Patch Docs
- Camera Service Measurement Models
- Camera Verify Page
- Synaptix Offline Sync Endpoint
- Memoria 3D Spec Concepts
- 3D Fake Observer (Checks)
- Camera Engine Dedup & Errors
- Camera Asset Setup Script
- Memory Match Content Provider
- 3D InstructionHold
- Patch InstructionHold
- 2D Memory Lane Logic
- 3D Agent Provider Docs
- Camera Heuristics & Calibration Docs
- 3D Environment Validation
- Camera Test Helpers
- Camera FaceObserver API
- Camera Frame Scheduling
- 2D Memory Lane Screen
- 2D Memory Lane/Match Exports
- 3D Fake Producer (Checks)
- 3D Agent Trust Boundary Docs
- 3D UI View Types
- Synaptix Frontend Dev Deps
- Memory Lane Content Provider
- Memory Lane Game States
- 3D CameraUI Callbacks
- 3D Floor Plan SVG
- 3D Checks TSConfig
- Camera WS Connection Queue
- Camera Engine Test Scenarios
- Synaptix Vite Configs
- Synaptix Frontend Scripts
- Memory Lane Card View
- Patch VisionBridge Callbacks
- 2D Games Web Entry
- Memory Lane Flip Actions
- Synaptix Backend Test Config
- Synaptix Jest Config
- Memory Lane Memorize Timer
- 3D Agent Enable Flag
- 3D Media Script
- Patch Observation Toggle
- Patch apply.sh
- Patch unapply.sh
- Synaptix Backend Schemas Pkg

## God Nodes (most connected - your core abstractions)
1. `boot()` - 85 edges
2. `FaceObserver` - 54 edges
3. `GameAdapter` - 53 edges
4. `ProducerConnection` - 53 edges
5. `DementiaStage` - 51 edges
6. `SessionEngine` - 43 edges
7. `create_app()` - 41 edges
8. `Harness` - 41 edges
9. `ObservationBody` - 41 edges
10. `DifficultyLevel` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Hint ladder (three levels + skip)` --semantically_similar_to--> `Suggested actions: delay_instruction, gentle_cue, offer_hint, increase_difficulty`  [INFERRED] [semantically similar]
  3D game/SPEC.md → CAMERA/README.md
- `Offline setup mode (local llama-server over loopback)` --semantically_similar_to--> `MediaPipe Face Landmarker (tasks-vision 1.0.1)`  [INFERRED] [semantically similar]
  3D game/SPEC.md → CAMERA/README.md
- `memoria-3d.patch with apply.sh / unapply.sh` --references--> `Memoria 3D README`  [INFERRED]
  CAMERA/integrations/memoria-3d/README.md → 3D game/README.md
- `Simulation mode (labelled, not camera data)` --semantically_similar_to--> `Mira and Raju fictional demo packs`  [INFERRED] [semantically similar]
  CAMERA/web/index.html → 3D game/README.md
- `Synaptix backend FastAPI service (profiles, session logging, offline sync)` --semantically_similar_to--> `CAMERA/service player-observation service (FastAPI)`  [INFERRED] [semantically similar]
  SYNAPTIX/README.md → README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Camera observation pipeline (producer to service to game)** — camera_readme_faceobserver, camera_readme_producerconnection, camera_readme_observation_service, camera_readme_policy_engine, camera_readme_gameadapter [EXTRACTED 1.00]
- **Agent-assisted setup trust boundary (propose, firewall, caregiver commit)** — 3d_game_spec_rule_f2_propose_never_commit, 3d_game_spec_content_firewall, 3d_game_readme_review_session, 3d_game_readme_agent_tool_schema, 3d_game_spec_rule_f1_no_model_in_session [EXTRACTED 1.00]
- **Memoria 3D camera-assistance integration** — camera_integrations_memoria_3d_readme_visionbridge, camera_integrations_memoria_3d_readme_instructionhold, camera_integrations_memoria_3d_readme_observation_setup, camera_integrations_memoria_3d_readme_telemetry_mapping, camera_readme_gameadapter [INFERRED 0.85]
- **Memoria in-page vision pipeline to observation service** — readme_faceobserver, readme_mediapipe_face_landmarker, readme_signalprocessor, readme_producerconnection, readme_sessionengine [EXTRACTED 1.00]
- **Memoria camera adaptation rules** — readme_hold_new_instruction, readme_gentle_cue, readme_offer_hint, readme_increase_difficulty, readme_adaptationpolicy [EXTRACTED 1.00]
- **Synaptix cognitive mini-games suite** — synaptix_readme_games_suite, synaptix_readme_daily_sequence, synaptix_readme_familiar_faces, synaptix_readme_memory_lane, synaptix_readme_memory_match, synaptix_readme_number_challenge, synaptix_readme_puzzle_fun, synaptix_readme_time_place_anchor, synaptix_readme_trail_trace, synaptix_readme_word_builder [EXTRACTED 1.00]

## Communities (158 total, 22 thin omitted)

### Community 0 - "2D Daily Sequence Game"
Cohesion: 0.06
Nodes (64): AccessibilityModal(), AccessibilityModalProps, styles, ActivityCard(), ActivityCardProps, styles, CaregiverConfigModal(), CaregiverConfigModalProps (+56 more)

### Community 1 - "Unified Camera Integration Docs"
Cohesion: 0.05
Nodes (71): Memoria Unified README, Adaptation log (__memoria.camera.adaptations), AdaptationPolicy, camera.check.ts (130 headless assertions), camera-e2e end-to-end check (Scenarios A/B/C), Camera support optional and off by default, CAMERA/web camera app (MediaPipe face landmarks), CameraAdapter (+63 more)

### Community 2 - "3D Procedural House Geometry"
Cohesion: 0.07
Nodes (53): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+45 more)

### Community 3 - "3D Agent Gemini Provider"
Cohesion: 0.07
Nodes (49): colors, ALLOWED_HOSTS, classifyStatus(), classifyThrown(), DEFAULT_GEMINI_MODEL, friendlyMessage(), GeminiConfig, GeminiProviderAdapter (+41 more)

### Community 4 - "Camera Web App & Event Sink"
Cohesion: 0.05
Nodes (22): GameEventSink, FakeConsumer, DerivedState, GameEventInput, GameEventType, GestureEventMessage, Measurement, SCHEMA_VERSION (+14 more)

### Community 5 - "3D Boot, UI & Player"
Cohesion: 0.06
Nodes (10): boot(), renderOnly(), standableIn(), PackVoices, MissionRunnerDeps, Player, Renderer, escapeText() (+2 more)

### Community 6 - "3D Memory Pack & Missions Content"
Cohesion: 0.06
Nodes (42): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), breakagesFromLocation(), CardStyle, fitToPlate(), injectAnchors(), isObject() (+34 more)

### Community 7 - "3D Telemetry & Perf Checks"
Cohesion: 0.05
Nodes (34): describe(), FocusProbe, percentile(), PerfResult, QualityProfile, buildExport(), downloadJson(), DWELL_THRESHOLD_MS (+26 more)

### Community 8 - "3D Agent Authoring Pass"
Cohesion: 0.09
Nodes (36): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), baseContext() (+28 more)

### Community 9 - "3D Agent Consent & Provenance"
Cohesion: 0.08
Nodes (26): ConsentPrompt, FirewallContext, FirewallResult, Violation, ProposalFixture, computeProvenance(), ProvenanceBlock, ProposalStatus (+18 more)

### Community 10 - "Camera Service Session Engine"
Cohesion: 0.09
Nodes (28): _Answer, _BufferedEvent, _median(), _Producer, Per-session engine: ordering/dedup, derived state, and the deterministic…, Time-weight the previous observation over the interval up to this one., Freeze the inactivity clock while paused or in an expected idle period., Returns (vision, attention_state, attention_reason, usable_for_adaptation). (+20 more)

### Community 11 - "3D Missions & Camera Hooks"
Cohesion: 0.08
Nodes (8): CameraIntegration, HintBeacon, instructionOf(), MissionRunner, speak(), stopSpeaking(), Outcome, ChoiceCard

### Community 12 - "2D Memory Match Frontend"
Cohesion: 0.07
Nodes (25): THEME, CompletionModalProps, styles, MemorizeTimerProps, styles, MemoryCardView, MemoryCardViewProps, styles (+17 more)

### Community 13 - "2D Trail Trace Game"
Cohesion: 0.10
Nodes (24): ContentItem, styles, TrailCanvas(), TrailCanvasProps, styles, TrailNode(), TrailNodeProps, styles (+16 more)

### Community 14 - "3D Pack Checks"
Cohesion: 0.07
Nodes (17): failures, fakeCtx, fakeLoad(), FakePlayer, FakeState, FakeUI, FakeVoices, LoadFn (+9 more)

### Community 15 - "Camera GameAdapter (Consumer)"
Cohesion: 0.12
Nodes (5): GameEventMessage, ConnectionStatus, GameAdapterOptions, GameAdapter, randomId()

### Community 16 - "Synaptix App Shell & Navigation"
Cohesion: 0.11
Nodes (20): App(), ScreenState, styles, NetworkStatusBar(), styles, CaregiverInfo, DEFAULT_CAREGIVER, ProfileUpdateModal() (+12 more)

### Community 17 - "Camera Integration Check Script"
Cohesion: 0.12
Nodes (23): AdapterProbe, assert(), freePort(), m(), main(), makeProducer(), now(), originFetch (+15 more)

### Community 18 - "Camera ProducerConnection"
Cohesion: 0.15
Nodes (3): fatalHttpReason(), noop(), ProducerConnection

### Community 19 - "2D GameBridge & Number Challenge"
Cohesion: 0.12
Nodes (23): GameBridge, GameBridgeCallbacks, GameMetadata, GameSessionResult, calculateNumberScore(), CountingItem, getFiftyFiftyEliminated(), getNumberProblemsForLevel() (+15 more)

### Community 20 - "3D Agent Config & Setup Mode"
Cohesion: 0.10
Nodes (29): AgentConfig, agentConfigStore, AgentProvider, applySetupMode(), consentPromptFor(), defaultModelForMode(), ensureConsent(), isAgentProvider() (+21 more)

### Community 21 - "Camera LocalCamera & Contracts"
Cohesion: 0.08
Nodes (19): LocalCamera, VisionView, CalibrationStatus, TrackingStatus, DEFAULT_SIGNAL_CONFIG, ProcessorStatus, DetectedHeadGesture, HeadGestureConfig (+11 more)

### Community 22 - "Camera Engine Tests"
Cohesion: 0.11
Nodes (33): ambiguous_python_import_14ff3aea793b, gesture(), answer(), Harness, parametrize, Engine tests: gating, staleness, ordering, and gameplay-driven policy., A producer whose clock runs far ahead or behind must not affect freshness., Drives one engine with a producer and a game on independent clocks. (+25 more)

### Community 23 - "Camera API Tests"
Cohesion: 0.15
Nodes (31): ambiguous_python_import_f03edecda5e1, game_event(), observation(), auth(), create(), parametrize, HTTP and WebSocket tests through the real ASGI app., receive_until() (+23 more)

### Community 24 - "2D Time-Place Anchor Logic"
Cohesion: 0.11
Nodes (13): SessionLog, RecallPreviewModalProps, DAYS_OF_WEEK, MONTHS_OF_YEAR, SeasonInfo, TimePlaceAnchorLogic, GameWorkflowStep, OrientationQuestion (+5 more)

### Community 25 - "Synaptix Health Vitals UI"
Cohesion: 0.12
Nodes (25): ref_react, ActivityMode, GeneralHealthVitalsCard(), GeneralHealthVitalsCardProps, VitalDetailModalState, Avatar, AvatarFallback, AvatarImage (+17 more)

### Community 26 - "Synaptix Bottom Nav"
Cohesion: 0.16
Nodes (23): framer-motion, lucide-react, BottomNavBar(), BottomNavBarProps, NAV_ITEMS, NavItemConfig, TabKey, STAGE_DEFINITIONS (+15 more)

### Community 27 - "Synaptix Backend API Router"
Cohesion: 0.12
Nodes (26): Base, datetime, fastapi, sqlalchemy, sqlalchemy_ext_asyncio, sqlalchemy_orm, API v1 master router., list_sessions() (+18 more)

### Community 28 - "3D Agent Content Firewall"
Cohesion: 0.10
Nodes (27): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+19 more)

### Community 29 - "3D Local Profile & Photos"
Cohesion: 0.18
Nodes (22): Crop, LocalPerson, LocalProfile, newId(), newProfile(), openDatabase(), Photo, photosOf() (+14 more)

### Community 30 - "3D Adaptive Resolution"
Cohesion: 0.10
Nodes (17): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+9 more)

### Community 31 - "Camera Vision Measurements & Filters"
Cohesion: 0.14
Nodes (22): BoolMeasurement, DurationMeasurement, RatioMeasurement, VisionMeasurements, FaceData, clamp(), mean(), roundTo() (+14 more)

### Community 32 - "Camera Transport Tests"
Cohesion: 0.12
Nodes (15): WebSocketLike, body(), derivedState(), FakeSocket, httpProducer(), m(), makeAdapter(), makeProducer() (+7 more)

### Community 33 - "2D Games Package Deps"
Cohesion: 0.06
Nodes (30): dependencies, react, react-dom, react-native, react-native-web, devDependencies, @types/react, @types/react-dom (+22 more)

### Community 34 - "Synaptix Backend Patients API"
Cohesion: 0.14
Nodes (28): base64, delete, clear_patient_assets(), create_patient(), create_patient_asset(), delete_patient_asset(), get_patient_detail(), list_patient_assets() (+20 more)

### Community 35 - "Camera Service HTTP API"
Cohesion: 0.12
Nodes (25): ApiError, create_app(), authorize(), bearer(), create_session(), delete_session(), get_state(), ingest_game_event() (+17 more)

### Community 36 - "2D Puzzle Fun & Northeast Assets"
Cohesion: 0.16
Nodes (24): getNortheastItemsByCategory(), NORTHEAST_ASSETS, NortheastThemeItem, GENERIC_ITEMS, getThemeItemsForRegion(), NORTHEAST_THEME_ITEMS, REGIONAL_ITEMS, ThemeItem (+16 more)

### Community 38 - "3D Player Collision & World"
Cohesion: 0.09
Nodes (18): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, templateFromLocation(), auditLines, cellIn() (+10 more)

### Community 39 - "3D Template Mirroring"
Cohesion: 0.13
Nodes (27): extent(), FACING, mirrorTemplate(), mirrorYaw(), mount(), neg(), opening(), point2() (+19 more)

### Community 40 - "Camera Web Package Deps"
Cohesion: 0.07
Nodes (28): dependencies, @mediapipe/tasks-vision, devDependencies, @types/node, @types/ws, typescript, vite, vitest (+20 more)

### Community 41 - "Camera MediaPipe Landmarker"
Cohesion: 0.12
Nodes (22): blendshape(), clamp01(), CreatedLandmarker, createLandmarker(), CreateLandmarkerOptions, errMsg(), extractFaces(), eyeAspectRatio() (+14 more)

### Community 42 - "Camera E2E Script"
Cohesion: 0.10
Nodes (18): CDP, chrome, cleanup(), failed, freePort(), GAME, kill(), launch() (+10 more)

### Community 43 - "Synaptix Game Select Screen"
Cohesion: 0.14
Nodes (13): HeritageBackground(), HeritageBackgroundProps, PhoneFrame(), PhoneFrameProps, GameCardConfig, GAMES_LIST, GameSelectScreen(), GameSelectScreenProps (+5 more)

### Community 44 - "Synaptix Local DB & Sync Queue"
Cohesion: 0.15
Nodes (5): idbDeleteAsset(), idbGetAllAssets(), idbPutAsset(), LocalDatabase, openIndexedDB()

### Community 45 - "Camera Producer Runtime & Protocol Msgs"
Cohesion: 0.13
Nodes (21): HelloMessage, ObservationMessage, trimBaseUrl(), ProducerConnectionOptions, detach(), MAX_GESTURES_PER_OBSERVATION, MAX_PENDING_GESTURES, positive() (+13 more)

### Community 46 - "Camera Signal Tests"
Cohesion: 0.14
Nodes (18): ObservationBody, assertBodyValid(), assertFinite(), assertMeasurement(), awayTransition(), Box, Driver, face() (+10 more)

### Community 47 - "2D Time-Place Anchor UI"
Cohesion: 0.14
Nodes (16): FaceFeedbackView(), FaceFeedbackViewProps, styles, OrientationCard(), OrientationCardProps, styles, RecallPreviewModal(), styles (+8 more)

### Community 48 - "3D CameraAdapter"
Cohesion: 0.17
Nodes (4): CameraAdapter, errText(), CameraErrorCode, Unsubscribe

### Community 49 - "3D Interaction & Highlight"
Cohesion: 0.11
Nodes (15): Focus, Interaction, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS (+7 more)

### Community 50 - "3D Agent Image Pipeline"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

### Community 51 - "3D CameraUI Panel"
Cohesion: 0.15
Nodes (7): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref(), CameraGesture

### Community 52 - "3D Layout Constants & Templates"
Cohesion: 0.20
Nodes (19): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+11 more)

### Community 53 - "Root Dev/Setup Scripts & Vite Wiring"
Cohesion: 0.09
Nodes (21): CAMERA_ASSETS, CAMERA_PUBLIC, CAMERA_WEB, here, TYPES, ref_node_child_process, ref_node_path, ref_node_url (+13 more)

### Community 54 - "Camera Service Config & Policy"
Cohesion: 0.10
Nodes (21): asyncio, BaseSettings, PolicyConfig, PolicyOverrides, BaseModel, Service settings and policy thresholds. Every threshold here is an initial,…, Thresholds for derived state and the suggestion policy. All durations are ms., Per-session overrides supplied at session creation. Same bounds as PolicyConfig. (+13 more)

### Community 55 - "Camera Service Schemas"
Cohesion: 0.16
Nodes (23): Player-observation service: ingests derived webcam measurements and gameplay…, FastAPI application: HTTP endpoints, the WebSocket stream and the background…, AckMessage, CalibrationInfo, CreateSessionRequest, CreateSessionResponse, GameEventData, Gesture (+15 more)

### Community 56 - "Camera Protocol Types"
Cohesion: 0.08
Nodes (23): AckMessage, AngleMeasurement, ApiErrorBody, CalibrationInfo, CloseCode, CreateSessionRequest, EngagementScore, ErrorMessage (+15 more)

### Community 57 - "3D AdaptationPolicy"
Cohesion: 0.15
Nodes (10): AdaptationEffects, AdaptationPolicy, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraSnapshot, CameraSuggestion (+2 more)

### Community 58 - "Camera Simulated Face Source"
Cohesion: 0.13
Nodes (7): matrixFromPlayerAngles(), Motion, SimulatedFaceSource, SimulationControls, PerfInfo, FaceFrame, SignalProcessorApi

### Community 59 - "Camera Message Validation"
Cohesion: 0.18
Nodes (24): ActionType, GestureType, ACTION_SOURCES, ACTION_TYPES, allNumbersFinite(), ATTENTION_STATES, GESTURE_TYPES, hasVersion() (+16 more)

### Community 60 - "Memoria-3D Patch Bridge Checks"
Cohesion: 0.13
Nodes (17): eq(), FakeAdapter, ok(), setup(), CAMERA_ASSIST_STORAGE_KEY, DelayInstructionSuggestion, InstructionHoldOptions, OUTCOME_MAP (+9 more)

### Community 61 - "Camera Service Session Broadcast"
Cohesion: 0.13
Nodes (7): HeartbeatMessage, BaseModel, Run the engine, push state (throttled) and any new actions to consumers., Periodic work: expiry, staleness re-evaluation, heartbeats., Session, SessionStore, TokenBucket

### Community 62 - "Camera Demo Check Script"
Cohesion: 0.11
Nodes (21): cdp(), chrome, click(), clickEv(), ev(), page, pending, procs (+13 more)

### Community 63 - "2D Familiar Faces Content"
Cohesion: 0.16
Nodes (7): RegionalState, BUNDLED_GENERIC_ITEMS, GenericContentProvider, GenericItem, NOTE: Does NOT reproduce copyrighted test stimuli. Tests confrontation naming…, FamiliarFacesGameScreen(), FamiliarFacesLogic

### Community 64 - "3D Package Deps"
Cohesion: 0.09
Nodes (22): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, @types/node (+14 more)

### Community 65 - "3D Agent Prompts"
Cohesion: 0.13
Nodes (19): anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext, buildAuthoringSystemPrompt(), bullets(), ENVIRONMENT_REASONING, ENVIRONMENT_SYSTEM_PROMPT (+11 more)

### Community 66 - "3D Offline Check Script"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 67 - "Camera FaceObserver Core"
Cohesion: 0.19
Nodes (3): FaceObserverOptions, FaceObserver, clearOverlay()

### Community 68 - "Synaptix Frontend Deps"
Cohesion: 0.09
Nodes (22): class-variance-authority, clsx, jest, @radix-ui/react-avatar, @radix-ui/react-slot, tailwind-merge, tailwindcss, ts-jest (+14 more)

### Community 69 - "3D Agent Proposal Grammar"
Cohesion: 0.16
Nodes (18): DEFAULT_AGENT_CONFIG, ENVIRONMENT_TOOL, PROPOSAL_FIXTURES, asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal() (+10 more)

### Community 70 - "3D VisionBridge"
Cohesion: 0.14
Nodes (8): InstructionHoldOptions, OpenTask, OUTCOME_MAP, taskIdFor(), VisionBridge, VisionBridgeOptions, Event, TaskOutcome

### Community 71 - "Memoria-3D Patch Observation Panel"
Cohesion: 0.16
Nodes (21): createObservation(), disable(), enable(), setEnabled(), teardown(), createPanel(), describeCalibration(), describeCameraError() (+13 more)

### Community 72 - "Camera SignalProcessor"
Cohesion: 0.18
Nodes (4): SignalConfig, allUnavailable(), freshCalibration(), SignalProcessor

### Community 73 - "Synaptix Medicine Service"
Cohesion: 0.17
Nodes (3): getStorage(), medicineService, LocalStorageMock

### Community 74 - "3D Camera Types & Adapter API"
Cohesion: 0.10
Nodes (9): AttentionState, CameraAdapterApi, CameraPhase, EngagementView, GameplayView, Measured, PolicyView, ServiceLink (+1 more)

### Community 75 - "3D Camera Checks"
Cohesion: 0.12
Nodes (14): adapterState(), away, body, derived(), failures, fakeRuntime, Listeners, m() (+6 more)

### Community 76 - "Synaptix Backend App Init"
Cohesion: 0.13
Nodes (19): anyio, contextlib, fastapi_middleware_cors, fastapi_staticfiles, httpx, os, init_db(), Initializes the database schema. (+11 more)

### Community 77 - "2D Familiar Faces UI"
Cohesion: 0.20
Nodes (14): ref_react_native, FaceCard(), FaceCardProps, styles, FamiliarFacesCompletion(), FamiliarFacesCompletionProps, styles, RelationshipRevealCard() (+6 more)

### Community 78 - "3D Game State Machine"
Cohesion: 0.10
Nodes (6): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, State, StateListener, TIMERS_RUN

### Community 79 - "2D Word Builder Game"
Cohesion: 0.19
Nodes (17): BUILTIN_FAMILY_WORDS, calculateWordScore(), createTileLetterItems(), getWordChallengesForLevel(), LEVEL_1_WORDS, LEVEL_3_MYSTERY_WORDS, scrambleWord(), speakWordHint() (+9 more)

### Community 80 - "2D Games TSConfig"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+11 more)

### Community 81 - "3D Camera Integration Wiring"
Cohesion: 0.17
Nodes (15): AdaptationConfig, CameraIntegrationDeps, createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera() (+7 more)

### Community 82 - "3D Camera Snapshot & Live Adapter"
Cohesion: 0.16
Nodes (13): CameraAdapterOptions, Runtime, buildSnapshot(), copy(), localCamera(), observerError(), phaseOf(), SnapshotInputs (+5 more)

### Community 83 - "Camera Gestures & Fakes"
Cohesion: 0.11
Nodes (9): FakeImage, FakeImage, Gesture, HeadOrientation, PendingGesture, emaAlpha(), TimeEma, Box (+1 more)

### Community 84 - "3D World Snapshot Checks"
Cohesion: 0.18
Nodes (16): out, snapshot, w, world, box(), canonicalQuaternion(), diffSnapshots(), Json (+8 more)

### Community 85 - "3D Profile Check Script"
Cohesion: 0.12
Nodes (12): args, CDP, chrome, originArg, profile, REPO, startServerIfNeeded(), wait() (+4 more)

### Community 86 - "Pytest Conftest & Image Scraper"
Cohesion: 0.15
Nodes (15): json, pathlib, Pytest configuration for Memoria Backend test suite. Ensures repository root is…, download_image(), fetch_page_thumbnail(), main(), Downloads 77 authentic real photographs (non-AI) of Northeast India from…, Fetch thumbnail image URL for a Wikipedia page title using Wikipedia API. (+7 more)

### Community 87 - "Camera Browser Check Script"
Cohesion: 0.21
Nodes (12): Cdp, ensureVite(), freePort(), httpOk(), launchChrome(), log(), main(), openPage() (+4 more)

### Community 88 - "Synaptix Health & Medicine UI"
Cohesion: 0.20
Nodes (14): MedicineSchedulerModal(), MedicineSchedulerModalProps, HealthScreen(), HealthScreenProps, MedicineScheduleItem, calculatePatientCognitiveProfile(), calculateSessionDScore(), CognitiveDomainScores (+6 more)

### Community 89 - "2D Difficulty & Progress Types"
Cohesion: 0.18
Nodes (14): DementiaStage, DifficultyLevel, ProgressIndicator(), ProgressIndicatorProps, STAGE_LABELS, styles, DailySequenceGameScreenProps, FamiliarFacesGameScreenProps (+6 more)

### Community 90 - "3D Photo Generator Script"
Cohesion: 0.27
Nodes (17): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+9 more)

### Community 91 - "Root Dev Orchestrator"
Cohesion: 0.12
Nodes (14): portBusy(), ref_node_net, busy, CAMERA_WEB, children, GAME, GAME_PORT, OBS_PORT (+6 more)

### Community 92 - "Camera Demo Page"
Cohesion: 0.23
Nodes (17): endSession(), fmt(), log(), onObservation(), renderAction(), renderGesture(), renderObserverStatus(), renderProcessorStatus() (+9 more)

### Community 93 - "Camera FaceObserver Inference Loop"
Cohesion: 0.14
Nodes (14): ErrorCode, INFERENCE_TIMEOUT_MS, InFlight, LandmarkerModule, MainLandmarker, mapCameraError(), MAX_CONSECUTIVE_FAILURES, round2() (+6 more)

### Community 94 - "Camera Web TSConfig"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+9 more)

### Community 95 - "Synaptix Frontend TSConfig"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, baseUrl, esModuleInterop, isolatedModules, jsx, lib (+9 more)

### Community 96 - "3D Agent Audit Log"
Cohesion: 0.15
Nodes (8): AuditEntry, AuditLog, AuditSink, consoleAuditSink, CONSENT_PROMPT, failures, REQUEST, WITH_IMAGE

### Community 98 - "3D TSConfig"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 100 - "Memoria 3D Docs & Deploy"
Cohesion: 0.14
Nodes (16): Memoria 3D Deployment (incomplete), Vercel / Netlify static deploy of dist/, Memoria 3D HTML entry page, Memoria 3D README, Adaptive resolution (texture upgrade, anisotropy, pixel-ratio ladder), window.__memoria debug handle, Generate home appearance from room photos, npm run check:offline (network-off headless check) (+8 more)

### Community 101 - "Memoria-3D Patch VisionBridge"
Cohesion: 0.19
Nodes (3): Running, taskIdFor(), VisionBridge

### Community 102 - "Synaptix Frontend Runtime Deps"
Cohesion: 0.12
Nodes (16): dependencies, class-variance-authority, clsx, framer-motion, lucide-react, @radix-ui/react-avatar, @radix-ui/react-slot, react (+8 more)

### Community 103 - "3D Check Runner"
Cohesion: 0.13
Nodes (12): nodeJsonlFileSink(), checks, esbuild, filter, here, out, root, three (+4 more)

### Community 104 - "Camera Worker Backend Init"
Cohesion: 0.24
Nodes (5): Aborted, absoluteUrl(), errMsg(), ObserverError, Delegate

### Community 105 - "Camera Head-Pose Geometry"
Cohesion: 0.30
Nodes (10): eulerFromFaceMatrix(), eulerFromMatrix(), eyeAspectRatioFromPoints(), faceMatrixFromRotation(), Mat3, mat3Multiply(), mat3Transpose(), relativeRotation() (+2 more)

### Community 106 - "Camera Service Docs"
Cohesion: 0.19
Nodes (14): Treat actions as suggestions; stale means unknown, deleteSession, InstructionHold, Player Observation Service README, Attention state (HEAD_TOWARD_SCREEN / HEAD_AWAY / UNKNOWN ...), In-memory single-worker session store, Difficulty follows performance only (no lowering from vision), Null-with-reason measurements (+6 more)

### Community 107 - "Camera Reconnect Backoff"
Cohesion: 0.20
Nodes (8): Backoff, backoffDelay(), classifyClose(), CloseOutcome, DEFAULT_RECONNECT, finiteOr(), resolveReconnectOptions(), ReconnectOptions

### Community 108 - "Root Package Scripts"
Cohesion: 0.14
Nodes (13): description, engines, node, name, private, scripts, check, check:e2e (+5 more)

### Community 110 - "3D Template Perf Script"
Cohesion: 0.17
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 111 - "Memoria-3D Patch Docs"
Cohesion: 0.22
Nodes (13): Connecting a game (INTEGRATION.md), createSession (transport/session.ts), Gameplay event reporting (sendGameEvent), Memoria 3D camera-assistance patch README, bridge.check.ts (62 assertions), Camera assistance toggle (off by default), memoria-3d.patch with apply.sh / unapply.sh, observation.ts (createObservation setup/teardown) (+5 more)

### Community 112 - "Camera Service Measurement Models"
Cohesion: 0.18
Nodes (9): blank(), AngleMeasurement, BoolMeasurement, _Measurement, OrientationMeasurement, Any, RatioMeasurement, unavailable() (+1 more)

### Community 113 - "Camera Verify Page"
Cohesion: 0.17
Nodes (11): observer, out, overlay, params, real, record(), recording, round1() (+3 more)

### Community 114 - "Synaptix Offline Sync Endpoint"
Cohesion: 0.22
Nodes (12): Helper to save base64 image data to disk in backend/uploads directory., save_base64_to_disk(), process_sync_batch(), AsyncSession, post, Drains a batch of offline operations sent from React Native mobile client.…, BaseModel, Schemas for offline synchronization protocol. (+4 more)

### Community 115 - "Memoria 3D Spec Concepts"
Cohesion: 0.23
Nodes (12): Memoria 3D Specification, Completion outcomes: independent / cued / revealed / skipped, Hint ladder (three levels + skip), Three levels (§4.5), Memory pack (caregiver content contract), Navigate steps use containment, not entry events, Pack validation reporting all problems at once, Restart (Checkpoint B) (+4 more)

### Community 117 - "Camera Engine Dedup & Errors"
Cohesion: 0.17
Nodes (7): _BoundedSet, IngestError, Exception, A message that is well-formed but must be rejected (ordering, conflicts)., Insertion-ordered set that forgets the oldest entries beyond ``capacity``., test_second_producer_cannot_take_over_while_first_is_active(), test_session_mismatch_rejected()

### Community 118 - "Camera Asset Setup Script"
Cohesion: 0.29
Nodes (11): copyWasm(), exists(), fail(), installModel(), modelDst, sha256(), verify(), wasmDst (+3 more)

### Community 119 - "Memory Match Content Provider"
Cohesion: 0.27
Nodes (5): BUNDLED_ASSET_REGISTRY, BundledAssetInfo, ContentItem, MemoryCardContentProvider, PatientMemoryAsset

### Community 123 - "3D Agent Provider Docs"
Cohesion: 0.27
Nodes (10): Do not set VITE_GEMINI_API_KEY for hosted builds, AGENT_TOOL_SCHEMA grammar-constrained tool calls, GeminiProviderAdapter (src/agent/gemini.ts), LlamaCppProviderAdapter (src/agent/llamaCpp.ts), Reasoning-before-calls prompt form (prompts.ts, version f-2), Setup mode screen (src/agent/setupModeUI.ts), Offline setup mode (local llama-server over loopback), Online setup mode (D-1, hosted Gemini inference) (+2 more)

### Community 124 - "Camera Heuristics & Calibration Docs"
Cohesion: 0.22
Nodes (10): Mira and Raju fictional demo packs, Hard product rule: never invent autobiographical memory, Neutral-pose calibration, FaceObserver, head_facing_score head-pose heuristic, Nod and head-shake gesture detection, tracking_quality heuristic, Player Observation Demo page (+2 more)

### Community 125 - "3D Environment Validation"
Cohesion: 0.22
Nodes (8): describeEnvironment(), validateEnvironment(), image, material, provider, stored, style, ref_node_assert

### Community 126 - "Camera Test Helpers"
Cohesion: 0.20
Nodes (5): FakeClock, m(), Any, Builders for well-formed messages, so each test only states what it cares about., itertools

### Community 129 - "2D Memory Lane Screen"
Cohesion: 0.27
Nodes (8): getStageConfig(), CompletionModal(), COGNITIVE_LEVELS, MemoryLaneGameScreen(), MemoryLaneGameScreenProps, styles, synaptix_games_memory_lane_types_dementiastage, synaptix_games_memory_lane_types_difficultylevel

### Community 130 - "2D Memory Lane/Match Exports"
Cohesion: 0.33
Nodes (4): CompletionModalProps, styles, FlipResult, SessionMetrics

### Community 132 - "3D Agent Trust Boundary Docs"
Cohesion: 0.29
Nodes (8): agent-audit.jsonl audit log, EXIF-stripping image pipeline (src/agent/images.ts), ReviewSession caregiver review and commit (src/agent/review.ts), Content firewall (validateProposal, rules F-a to F-i), Agent may infer only visual, not autobiographical, image properties, Prompt injection defence via caregiver allow-list, Provenance block (§10.8), Rule F-2: the agent proposes, never commits

### Community 133 - "3D UI View Types"
Cohesion: 0.25
Nodes (7): AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage, RenderedProblem, SummaryView

### Community 134 - "Synaptix Frontend Dev Deps"
Cohesion: 0.25
Nodes (8): devDependencies, jest, ts-jest, @types/jest, @types/react, @types/react-dom, @types/react-native, typescript

### Community 135 - "Memory Lane Content Provider"
Cohesion: 0.36
Nodes (4): BUNDLED_ASSET_REGISTRY, BundledAssetInfo, MemoryCardContentProvider, synaptix_games_memory_lane_types_regionalstate

### Community 136 - "Memory Lane Game States"
Cohesion: 0.25
Nodes (8): GameState, ABANDONED, COMPLETED, EVALUATING, MEMORIZING, NOT_STARTED, WAITING_FIRST_CARD, WAITING_SECOND_CARD

### Community 138 - "3D Floor Plan SVG"
Cohesion: 0.52
Nodes (6): band(), cutsWall(), FLOOR, n(), planSvg(), rect()

### Community 139 - "3D Checks TSConfig"
Cohesion: 0.29
Nodes (6): compilerOptions, noEmit, types, extends, include, ../../tsconfig.json

### Community 140 - "Camera WS Connection Queue"
Cohesion: 0.33
Nodes (3): Connection, Any, One WebSocket client. Outgoing messages go through a bounded queue so a slow…

### Community 142 - "Synaptix Vite Configs"
Cohesion: 0.47
Nodes (4): ref_path, @tailwindcss/vite, ref_vite, ref_vitejs_plugin_react

### Community 143 - "Synaptix Frontend Scripts"
Cohesion: 0.33
Nodes (6): scripts, android, build, desktop, start, test

### Community 144 - "Memory Lane Card View"
Cohesion: 0.40
Nodes (4): MemoryCardView, MemoryCardViewProps, styles, MemoryCard

### Community 146 - "2D Games Web Entry"
Cohesion: 0.40
Nodes (3): ref_react_dom, synaptix_games_memory_match_index_memorymatchgame, rootElement

### Community 147 - "Memory Lane Flip Actions"
Cohesion: 0.40
Nodes (5): FlipAction, IGNORED, MATCH, MISMATCH, REVEAL_FIRST

### Community 148 - "Synaptix Backend Test Config"
Cohesion: 0.50
Nodes (3): pytest, anyio_backend(), fixture

### Community 149 - "Synaptix Jest Config"
Cohesion: 0.50
Nodes (4): jest, preset, testEnvironment, testMatch

## Knowledge Gaps
- **712 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+707 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1225 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tailwindcss/vite` connect `Synaptix Vite Configs` to `Synaptix Frontend Deps`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `Synaptix Bottom Nav` to `Synaptix Frontend Deps`, `Synaptix Game Select Screen`, `Synaptix App Shell & Navigation`, `Synaptix Health & Medicine UI`, `Synaptix Health Vitals UI`?**
  _High betweenness centrality (0.119) - this node is a cross-community bridge._
- **Why does `framer-motion` connect `Synaptix Bottom Nav` to `Synaptix Frontend Deps`, `Synaptix Game Select Screen`, `Synaptix App Shell & Navigation`, `Synaptix Health & Medicine UI`, `Synaptix Health Vitals UI`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Are the 43 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 43 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _712 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `2D Daily Sequence Game` be split into smaller, more focused modules?**
  _Cohesion score 0.055822466254861584 - nodes in this community are weakly interconnected._
- **Should `Unified Camera Integration Docs` be split into smaller, more focused modules?**
  _Cohesion score 0.051106639839034206 - nodes in this community are weakly interconnected._