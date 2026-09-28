# Graph Report - 3D game  (2026-09-29)

## Corpus Check
- 198 files · ~348,324 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .woff2 1)

## Summary
- 2923 nodes · 6592 edges · 163 communities (136 shown, 26 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 494 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1c654fb0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- perf-templates.mjs
- pack.check.ts
- HintBeacon
- MissionRunner
- Three levels
- templates/types.ts
- Kit
- boot
- package.json
- proceduralHouse.ts
- MemoryPack.ts
- offline-check.mjs
- gemini.ts
- Telemetry
- make-photos.py
- compilerOptions
- navigator.ts
- agent-prompts.check.ts
- environments/index.ts
- agent-gemini.check.ts
- run.mjs
- SuiteController
- world.check.ts
- checks/tsconfig.json
- shells/types.ts
- enabled.ts
- buildSuiteScene
- make-media.sh
- Illustrated portrait with dark hair, pink clothing, and letter A
- Illustration of four silhouettes around a warm light beneath an orange sky
- Illustrated portrait with dark hair bun, green clothing, and letter B
- Illustrated portrait with gray hair bun, yellow clothing, and letter R
- Illustration of a sailboat on blue water with sun and birds
- Illustrated portrait with pale hair and beard, green clothing, and letter I
- Illustrated portrait with dark hair and beard, blue clothing, and letter M
- Illustrated portrait with pale hair bun, purple clothing, and letter S
- Measured frame time
- llamaCpp.ts
- grammar.ts
- review.ts
- LocalProfile.ts
- agent-images.check.ts
- firewall.ts
- profile-check.mjs
- main.ts
- agent-review.check.ts
- camera/types.ts
- CameraAdapter
- agent-provider.check.ts
- Quality.ts
- suite-app.check.ts
- CameraUI
- SuiteAudio
- summary
- ShellKit
- camera.check.ts
- Q: How do uploaded images modify the game environment?
- proposals.fixtures.ts
- CameraSnapshot
- summary
- authoring.ts
- three
- VisionBridge
- integration.ts
- gltf.ts
- ExploreView
- content/validate.ts
- CameraAdapterApi
- Navigator
- World.ts
- FakeConsumer
- worldSnapshot.ts
- createCameraIntegration
- Reminiscence Therapy Suite: controls, comfort and accessibility
- app/app.ts
- FakeProducer
- materials.ts
- CameraUICallbacks
- model.ts
- harness.ts
- make-sounds.mjs
- openCaregiverSetup
- content/prompts.ts
- contracts.ts
- Canvas
- templates/index.ts
- settings
- settings
- definitions.ts
- home
- explore
- explore
- settings.ts
- i18n/index.ts
- .startActivity
- h
- resolve.ts
- home
- build-content.mjs
- en/app.json
- hi/app.json
- ActivitySessionApi
- runtimeText.ts
- place
- place
- suite-activities.check.ts
- suite-profile.check.ts
- profile/media.ts
- activity
- closeup
- activity
- closeup
- SuiteAudioApi
- Personalization in the Reminiscence Therapy Suite
- caregiver
- caregiver
- tools.ts
- ui.ts
- Reminiscence Therapy Suite — implementation plan and working agreement
- Content packs
- Languages in the Reminiscence Therapy Suite
- who
- SuiteTelemetryPort
- FakeObserver
- pause
- pause
- FakeUI
- assets/index.ts
- screens.ts
- fetch-textures.mjs
- audio.ts
- run-check.mjs
- Fonts
- EnvironmentMaterials.ts
- selectProvider.ts
- EnvironmentEditor.ts
- render-thumbnails.mjs
- .constructor
- Activities
- Reminiscence Therapy Suite
- who
- Suite assets — provenance and attribution
- Assets and environments
- write-environments.py
- Missions.ts
- caregiver
- caregiver
- keyboard.ts
- thumbs.ts
- vision
- manifest.json
- vision
- camera
- comfort
- textSizes
- camera
- comfort
- textSizes
- minutes
- seconds
- minutes
- seconds

## God Nodes (most connected - your core abstractions)
1. `Kit` - 102 edges
2. `SuiteController` - 87 edges
3. `boot()` - 84 edges
4. `openCaregiverSetup()` - 46 edges
5. `three` - 44 edges
6. `MissionRunner` - 37 edges
7. `SuiteAudio` - 33 edges
8. `buildHouse()` - 32 edges
9. `CameraAdapter` - 30 edges
10. `str()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `ctx()` --calls--> `buildAllowedTokens()`  [EXTRACTED]
  tools/checks/agent-provenance.check.ts → src/agent/tokens.ts
- `renderThumb()` --calls--> `acquireProcedural()`  [EXTRACTED]
  tools/suite/assets/thumbs.ts → src/suite/assets/prototypes.ts
- `run()` --calls--> `environmentEditor()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentEditor.ts
- `run()` --calls--> `styleMaterial()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentMaterials.ts
- `main()` --calls--> `newProfile()`  [EXTRACTED]
  tools/checks/suite-profile.check.ts → src/LocalProfile.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three levels in one caregiver pack** — spec_memory_pack, spec_water, spec_morning_walk, spec_familiar_memories [EXTRACTED 1.00]

## Communities (163 total, 26 thin omitted)

### Community 0 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 1 - "pack.check.ts"
Cohesion: 0.06
Nodes (19): PackProblem, failures, fakeCtx, FakeImage, fakeLoad(), FakePlayer, FakeState, FakeUI (+11 more)

### Community 3 - "MissionRunner"
Cohesion: 0.12
Nodes (6): instructionOf(), MissionRunner, speak(), stopSpeaking(), Outcome, ChoiceCard

### Community 4 - "Three levels"
Cohesion: 0.09
Nodes (30): Deployment incomplete, Vercel and Netlify static hosting, Poly Haven runtime textures and HDRI, Smriti HTML entry, Smriti debug handle, Mira and Raju fictional demo packs, Headless and offline checks, Personalisation anchors (+22 more)

### Community 5 - "templates/types.ts"
Cohesion: 0.13
Nodes (27): extent(), FACING, mirrorTemplate(), mirrorYaw(), mount(), neg(), opening(), point2() (+19 more)

### Community 6 - "Kit"
Cohesion: 0.08
Nodes (100): frameBars(), legs(), mat(), num(), Params, pivot(), runtimeText(), str() (+92 more)

### Community 7 - "boot"
Cohesion: 0.05
Nodes (8): boot(), standableIn(), PackVoices, MissionRunnerDeps, Player, State, escapeText(), UI

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, name (+19 more)

### Community 9 - "proceduralHouse.ts"
Cohesion: 0.09
Nodes (42): addSkirting(), auditDoorways(), auditReachability(), boxMesh(), buildChair(), buildFrameAnchor(), buildHouse(), buildLamp() (+34 more)

### Community 10 - "MemoryPack.ts"
Cohesion: 0.09
Nodes (25): breakagesFromLocation(), CardStyle, fitToPlate(), injectAnchors(), isObject(), Json, loadAudio(), loadImage() (+17 more)

### Community 11 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 12 - "gemini.ts"
Cohesion: 0.19
Nodes (15): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), GeminiProviderAdapter, imagePart(), InteractionStep, isGoogleEndpoint() (+7 more)

### Community 14 - "make-photos.py"
Cohesion: 0.29
Nodes (16): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+8 more)

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "navigator.ts"
Cohesion: 0.11
Nodes (23): BoxLike, clamp(), clampLook(), classifyGesture(), collides(), dampFactor(), DEG, DRAG_SENSITIVITY (+15 more)

### Community 17 - "agent-prompts.check.ts"
Cohesion: 0.08
Nodes (31): DEFAULT_AGENT_CONFIG, colors, describeEnvironment(), ENVIRONMENT_TOOL, validateEnvironment(), LlamaCppProviderAdapter, anchorLines(), assetLines() (+23 more)

### Community 18 - "environments/index.ts"
Cohesion: 0.17
Nodes (18): Placement, SceneReport, Built, FLOOR_SETS, SuiteSceneReport, CLEARANCE, clearOfBlockers(), EYE_HEIGHT (+10 more)

### Community 19 - "agent-gemini.check.ts"
Cohesion: 0.09
Nodes (24): AgentConfig, agentConfigStore, AgentProvider, CONSENT_PROMPT, consentPromptFor(), ensureConsent(), isAgentProvider(), isSetupMode() (+16 more)

### Community 20 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 22 - "world.check.ts"
Cohesion: 0.10
Nodes (16): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+8 more)

### Community 23 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../../tsconfig.json, compilerOptions, noEmit, types, extends, include

### Community 24 - "shells/types.ts"
Cohesion: 0.11
Nodes (21): ShellId, ShellInfo, ShellMaterials, ShellSlot, courtyardVeranda, POSTS, slots, SHELL_DEFS (+13 more)

### Community 26 - "buildSuiteScene"
Cohesion: 0.14
Nodes (15): releaseGltf(), BuilderContext, MaterialLease, acquireProcedural(), envSignature(), Prototype, prototypes, releasePrototype() (+7 more)

### Community 37 - "llamaCpp.ts"
Cohesion: 0.16
Nodes (19): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), ParsedEnvelope, parseEnvelope() (+11 more)

### Community 38 - "grammar.ts"
Cohesion: 0.39
Nodes (11): asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule(), ParsedCall, parseProposalCalls() (+3 more)

### Community 39 - "review.ts"
Cohesion: 0.09
Nodes (22): ConsentPrompt, FirewallContext, Violation, ProposalFixture, computeProvenance(), ProvenanceBlock, ProposalStatus, ReviewCounts (+14 more)

### Community 40 - "LocalProfile.ts"
Cohesion: 0.12
Nodes (32): applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId(), newProfile() (+24 more)

### Community 41 - "agent-images.check.ts"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

### Community 42 - "firewall.ts"
Cohesion: 0.17
Nodes (18): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+10 more)

### Community 43 - "profile-check.mjs"
Cohesion: 0.12
Nodes (12): /src/templates/index.ts, /src/LocalProfile.ts, /src/templates/plan.ts, /tools/profile-browser.check.ts, args, CDP, chrome, originArg (+4 more)

### Community 44 - "main.ts"
Cohesion: 0.06
Nodes (34): describe(), FocusProbe, PerfResult, renderOnly(), QualityProfile, buildExport(), downloadJson(), DWELL_THRESHOLD_MS (+26 more)

### Community 45 - "agent-review.check.ts"
Cohesion: 0.16
Nodes (11): assets(), ctx(), emptyPack, failures, fakeCtx, FakeImage, fakeLoad(), firewallWorld() (+3 more)

### Community 46 - "camera/types.ts"
Cohesion: 0.16
Nodes (17): buildSnapshot(), copy(), localCamera(), phaseOf(), SnapshotInputs, visionBlockedReason(), AttentionState, CameraErrorCode (+9 more)

### Community 47 - "CameraAdapter"
Cohesion: 0.11
Nodes (8): CameraAdapter, CameraAdapterOptions, errText(), Runtime, observerError(), toGesture(), toSuggestion(), CameraGesture

### Community 48 - "agent-provider.check.ts"
Cohesion: 0.13
Nodes (8): AuditEntry, AuditLog, AuditSink, consoleAuditSink, AGENT_TOOL_SCHEMA, failures, REQUEST, WITH_IMAGE

### Community 49 - "Quality.ts"
Cohesion: 0.13
Nodes (14): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), isSmall(), median() (+6 more)

### Community 50 - "suite-app.check.ts"
Cohesion: 0.12
Nodes (15): no(), DOCK_CLEAR_PX, SUITE_CSS, SUITE_Z, channel(), contrastRatio(), cssName(), PALETTE (+7 more)

### Community 51 - "CameraUI"
Cohesion: 0.16
Nodes (6): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref()

### Community 52 - "SuiteAudio"
Cohesion: 0.17
Nodes (3): channelLevel(), SuiteAudio, AudioChannel

### Community 53 - "summary"
Cohesion: 0.08
Nodes (24): summary, activity, another, closeups, content, download, endedExited, endedFinished (+16 more)

### Community 55 - "camera.check.ts"
Cohesion: 0.12
Nodes (14): adapterState(), away, body, derived(), failures, fakeRuntime, Listeners, m() (+6 more)

### Community 56 - "Q: How do uploaded images modify the game environment?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do uploaded images modify the game environment?, Source Nodes

### Community 57 - "proposals.fixtures.ts"
Cohesion: 0.17
Nodes (12): baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), PROPOSAL_FIXTURES, sparseContext(), buildAllowedTokens() (+4 more)

### Community 58 - "CameraSnapshot"
Cohesion: 0.22
Nodes (5): AdaptationEffects, AdaptationPolicy, CameraSnapshot, CameraSuggestion, policyRig()

### Community 59 - "summary"
Cohesion: 0.08
Nodes (24): summary, activity, another, closeups, content, download, endedExited, endedFinished (+16 more)

### Community 60 - "authoring.ts"
Cohesion: 0.18
Nodes (21): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), dispatch() (+13 more)

### Community 61 - "three"
Cohesion: 0.15
Nodes (7): three, PhotoSurface, DecorativeLoader, FACING, fitInside(), MAT_MARGIN, ScenePhotoSurface

### Community 62 - "VisionBridge"
Cohesion: 0.13
Nodes (7): GameEventSink, InstructionHoldOptions, OpenTask, OUTCOME_MAP, taskIdFor(), VisionBridge, VisionBridgeOptions

### Community 63 - "integration.ts"
Cohesion: 0.08
Nodes (16): AdaptationConfig, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraIntegration, CameraIntegrationDeps, Env (+8 more)

### Community 64 - "gltf.ts"
Cohesion: 0.16
Nodes (7): Disposable, RefCache, acquireGltf(), cache, GltfPrototype, load(), pending

### Community 66 - "content/validate.ts"
Cohesion: 0.20
Nodes (28): LoadContentOptions, loadContentPacks(), loadOne(), message(), ASSET_CATEGORIES, AssetLookup, checkActivities(), checkProvenance() (+20 more)

### Community 68 - "Navigator"
Cohesion: 0.23
Nodes (3): angleDelta(), lookAngles(), Navigator

### Community 69 - "World.ts"
Cohesion: 0.11
Nodes (15): Focus, Interaction, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS (+7 more)

### Community 71 - "worldSnapshot.ts"
Cohesion: 0.17
Nodes (17): out, snapshot, w, world, snap(), box(), canonicalQuaternion(), diffSnapshots() (+9 more)

### Community 72 - "createCameraIntegration"
Cohesion: 0.18
Nodes (8): createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera(), syncTick(), InstructionHold

### Community 73 - "Reminiscence Therapy Suite: controls, comfort and accessibility"
Cohesion: 0.15
Nodes (13): Camera movement, Camera support wording, Checks, Comfort choices, Comfort settings, Controls, Keyboard, Languages (+5 more)

### Community 74 - "app/app.ts"
Cohesion: 0.06
Nodes (30): ContentState, Overlay, Prepared, Run, Screen, AttrValue, Child, focusFirst() (+22 more)

### Community 76 - "materials.ts"
Cohesion: 0.15
Nodes (15): cache, create(), MaterialEnv, MatSpec, PALETTE, signature(), tintFor(), weaveTexture() (+7 more)

### Community 78 - "model.ts"
Cohesion: 0.12
Nodes (27): CaregiverAudio, CaregiverPrompt, ObjectOverrides, SequenceRef, SuitePhoto, SuiteSound, TOPICS, SectionName (+19 more)

### Community 79 - "harness.ts"
Cohesion: 0.07
Nodes (23): ACTIVITIES, broken, buildScene(), camera, clock, d, demoPhoto, fakeSession() (+15 more)

### Community 80 - "make-sounds.mjs"
Cohesion: 0.09
Nodes (25): biquad(), buf(), burst(), durationMs(), fades(), FFMPEG, filter(), LAME (+17 more)

### Community 81 - "openCaregiverSetup"
Cohesion: 0.25
Nodes (31): openCaregiverSetup(), addPhotos(), addSounds(), applyLanguage(), audioFrom(), audioPreview(), button(), checkField() (+23 more)

### Community 82 - "content/prompts.ts"
Cohesion: 0.12
Nodes (14): DEMO_TEXTURE_MAX, demoPhoto(), packDisplayMedia(), packSound(), allows(), GENERIC_PROMPT_COUNTS, ItemKind, promptLevels() (+6 more)

### Community 83 - "contracts.ts"
Cohesion: 0.10
Nodes (26): SuiteDeps, ACTIVITY_KINDS, ActivityRegistry, AssetSource, AssignPhotos, AudioRef, BuildSceneOptions, BuildSuiteScene (+18 more)

### Community 84 - "Canvas"
Cohesion: 0.14
Nodes (17): bamboo_grove(), Canvas, flowers(), fruit_bowl(), hexrgb(), hills_mist(), hills_morning(), paddy_fields() (+9 more)

### Community 85 - "templates/index.ts"
Cohesion: 0.18
Nodes (21): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+13 more)

### Community 86 - "settings"
Cohesion: 0.09
Nodes (22): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+14 more)

### Community 87 - "settings"
Cohesion: 0.09
Nodes (22): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+14 more)

### Community 88 - "definitions.ts"
Cohesion: 0.14
Nodes (26): Availability, avoidOf(), define(), DEMO_SEQUENCE_OBJECTS, demoSequence(), highlighted(), isAlbum(), isFrame() (+18 more)

### Community 89 - "home"
Cohesion: 0.17
Nodes (12): hint, open, title, home, guided, language, more, start (+4 more)

### Community 90 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 91 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 92 - "settings.ts"
Cohesion: 0.15
Nodes (12): browserStorage(), defaultSettings(), loadSettings(), normaliseSettings(), prefersReducedMotion(), saveSettings(), SETTINGS_KEY, SettingsStorage (+4 more)

### Community 93 - "i18n/index.ts"
Cohesion: 0.18
Nodes (22): JsonLoader, LanguageInfo, LocaleIndex, LocalizedText, flattenKeys(), formatNumber(), interpolate(), isTree() (+14 more)

### Community 94 - ".startActivity"
Cohesion: 0.16
Nodes (4): dispose(), activityCard(), renderActivityPicker(), renderPlaceSection()

### Community 95 - "h"
Cohesion: 0.24
Nodes (6): h(), badge(), header(), renderHome(), renderSummary(), renderSettingsDialog()

### Community 96 - "resolve.ts"
Cohesion: 0.23
Nodes (13): envKey(), MediaCheck, MediaProblem, objectPromptKey(), suiteOf(), close(), displayPhoto(), fitWithin() (+5 more)

### Community 97 - "home"
Cohesion: 0.17
Nodes (12): hint, open, title, home, guided, language, more, start (+4 more)

### Community 98 - "build-content.mjs"
Cohesion: 0.12
Nodes (13): ffprobeDurationMs(), GENERATED, imageDefs(), IMAGES, NORTHEAST_PROMPTS, NORTHEAST_SOUND_IDS, NOTICE, PACKS (+5 more)

### Community 99 - "en/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 100 - "hi/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 102 - "runtimeText.ts"
Cohesion: 0.22
Nodes (9): drawCalendar(), drawRuntimeText(), drawSpines(), fitFont(), RuntimeTextInput, RuntimeTextSpec, RuntimeTextSurface, safeFormat() (+1 more)

### Community 103 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 104 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 105 - "suite-activities.check.ts"
Cohesion: 0.13
Nodes (30): ACTIVITIES, assignPhotos(), createActivitySession(), gentleCueShown(), createSuiteAppWith(), createSuiteApp(), loadContentPacks, packDisplayMedia (+22 more)

### Community 106 - "suite-profile.check.ts"
Cohesion: 0.19
Nodes (18): flattenEntries(), placeholders(), resolveText(), audioMime(), defaultSuiteProfile(), mb(), validateAudioFile(), validatePhotoFile() (+10 more)

### Community 107 - "profile/media.ts"
Cohesion: 0.18
Nodes (6): AudioContextCtor, DurationMeter, mediaElementDuration(), Recorder, RecorderFailure, SUITE_LIMITS

### Community 108 - "activity"
Cohesion: 0.17
Nodes (12): activity, failed, guidedFirst, note, otherPlace, place, preparing, retry (+4 more)

### Community 109 - "closeup"
Cohesion: 0.17
Nodes (12): closeup, alt, altNone, back, close, demoNotice, fit, people (+4 more)

### Community 110 - "activity"
Cohesion: 0.17
Nodes (12): activity, failed, guidedFirst, note, otherPlace, place, preparing, retry (+4 more)

### Community 111 - "closeup"
Cohesion: 0.17
Nodes (12): closeup, alt, altNone, back, close, demoNotice, fit, people (+4 more)

### Community 113 - "Personalization in the Reminiscence Therapy Suite"
Cohesion: 0.20
Nodes (9): Limits, Media that cannot be shown, Personalization in the Reminiscence Therapy Suite, Privacy, Prompts, Storage, The "no inference" rules, Verification (+1 more)

### Community 114 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 115 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 116 - "tools.ts"
Cohesion: 0.12
Nodes (10): ChoiceType, FindStepProposal, hints, JsonSchemaTool, LevelProposal, NavigateStepProposal, PhotoPlacementProposal, ReadContext (+2 more)

### Community 117 - "ui.ts"
Cohesion: 0.12
Nodes (11): DeviceInfo, EnvironmentReport, Renderer, AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage (+3 more)

### Community 118 - "Reminiscence Therapy Suite — implementation plan and working agreement"
Cohesion: 0.29
Nodes (7): Architecture, Conventions, File ownership, Fixed ids (so parallel work lines up), Flow, Reminiscence Therapy Suite — implementation plan and working agreement, Sequencing

### Community 119 - "Content packs"
Cohesion: 0.20
Nodes (10): content.json, Content packs, Demo pictures, Files, How `appliesTo` is matched, Regenerating, Sounds, To add a pack (+2 more)

### Community 120 - "Languages in the Reminiscence Therapy Suite"
Cohesion: 0.29
Nodes (6): About the Hindi, Adding a language (example: Bengali, `bn`), Current coverage, How it works, Languages in the Reminiscence Therapy Suite, Longest strings

### Community 121 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 123 - "FakeObserver"
Cohesion: 0.13
Nodes (3): samplePerf(), percentile(), FakeObserver

### Community 124 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 125 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 127 - "assets/index.ts"
Cohesion: 0.09
Nodes (23): BUILDERS, hasBuilder(), createAssetLibrary(), Library, loadAssetLibrary(), MANIFEST_PATH, ACCEPTED_LICENSES, CATEGORIES (+15 more)

### Community 128 - "screens.ts"
Cohesion: 0.29
Nodes (11): EventInput, buildSummary(), SummaryInput, durationText(), splitDuration(), ActivityItem, ActivityKind, ActivitySessionOptions (+3 more)

### Community 129 - "fetch-textures.mjs"
Cohesion: 0.40
Nodes (3): OUT, ROOT, SETS

### Community 130 - "audio.ts"
Cohesion: 0.29
Nodes (7): choosePromptRoute(), findVoice(), norm(), Playing, PromptRoute, SuiteAudioOptions, VoiceLike

### Community 131 - "run-check.mjs"
Cohesion: 0.50
Nodes (3): bundle, out, root

### Community 133 - "EnvironmentMaterials.ts"
Cohesion: 0.19
Nodes (11): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), BuildOptions, createProceduralHouse(), loadSet() (+3 more)

### Community 134 - "selectProvider.ts"
Cohesion: 0.25
Nodes (8): DEFAULT_GEMINI_MODEL, GeminiConfig, LlamaCppConfig, EMPTY_STUB_SCRIPT, NullProviderAdapter, SelectProviderOptions, StubProviderAdapter, StubModelScript

### Community 135 - "EnvironmentEditor.ts"
Cohesion: 0.50
Nodes (7): needsSetup(), geminiConfigFromEnv(), llamaCppConfigFromEnv(), selectProvider(), destinationLine(), environmentEditor(), waitingLine()

### Community 136 - "render-thumbnails.mjs"
Cohesion: 0.25
Nodes (6): chrome, out, profile, root, vite, work

### Community 137 - ".constructor"
Cohesion: 0.21
Nodes (4): append(), button(), clear(), itemLabel()

### Community 138 - "Activities"
Cohesion: 0.29
Nodes (7): Activities, Adding an activity, How camera timing interacts, Prompt order, The five activities, The no-scoring rule, The session

### Community 139 - "Reminiscence Therapy Suite"
Cohesion: 0.29
Nodes (7): Guides, Known limitations, Language coverage, Not verified here, Reminiscence Therapy Suite, Verification (2026-09-26, macOS, Node 26, headless Chrome with the SwiftShader software renderer), What it is

### Community 140 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 141 - "Suite assets — provenance and attribution"
Cohesion: 0.33
Nodes (5): Fonts, pictures and sounds, Models, Suite assets — provenance and attribution, Textures (Poly Haven, CC0-1.0), Thumbnails

### Community 143 - "Assets and environments"
Cohesion: 0.40
Nodes (4): Add an asset, Add or change an environment, Assets and environments, Budgets

### Community 144 - "write-environments.py"
Cohesion: 0.50
Nodes (3): env(), Writes public/suite/packs/*/environments.json (the environment dressing…, slots()

### Community 145 - "Missions.ts"
Cohesion: 0.10
Nodes (21): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), LoadedPack, ChoiceFormat, DemoNotice, FindStep, HINT_DELAYS_MS (+13 more)

### Community 146 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 147 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 148 - "keyboard.ts"
Cohesion: 0.25
Nodes (7): ARROWS, BLOCKING_SELECTORS, keyAction, KeyContext, KeyInput, keysBlocked(), WALK_CODES

### Community 149 - "thumbs.ts"
Cohesion: 0.22
Nodes (8): FLAT_ENV, camera, defs, ready, renderer, renderThumb(), scene, sun

### Community 150 - "vision"
Cohesion: 0.25
Nodes (8): vision, cues, held, label, samples, title, tracking, unmeasured

### Community 152 - "vision"
Cohesion: 0.25
Nodes (8): vision, cues, held, label, samples, title, tracking, unmeasured

### Community 153 - "camera"
Cohesion: 0.50
Nodes (4): hint, open, title, camera

### Community 154 - "comfort"
Cohesion: 0.50
Nodes (4): hint, open, title, comfort

### Community 155 - "textSizes"
Cohesion: 0.50
Nodes (4): textSizes, larger, largest, standard

### Community 156 - "camera"
Cohesion: 0.50
Nodes (4): hint, open, title, camera

### Community 157 - "comfort"
Cohesion: 0.50
Nodes (4): hint, open, title, comfort

### Community 158 - "textSizes"
Cohesion: 0.50
Nodes (4): textSizes, larger, largest, standard

### Community 159 - "minutes"
Cohesion: 0.67
Nodes (3): one, other, minutes

### Community 160 - "seconds"
Cohesion: 0.67
Nodes (3): one, other, seconds

### Community 161 - "minutes"
Cohesion: 0.67
Nodes (3): one, other, minutes

### Community 162 - "seconds"
Cohesion: 0.67
Nodes (3): one, other, seconds

## Knowledge Gaps
- **803 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+798 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1169 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `three` to `pack.check.ts`, `EnvironmentMaterials.ts`, `Kit`, `package.json`, `proceduralHouse.ts`, `MemoryPack.ts`, `navigator.ts`, `Missions.ts`, `environments/index.ts`, `agent-prompts.check.ts`, `thumbs.ts`, `world.check.ts`, `shells/types.ts`, `buildSuiteScene`, `LocalProfile.ts`, `main.ts`, `agent-review.check.ts`, `suite-app.check.ts`, `gltf.ts`, `World.ts`, `worldSnapshot.ts`, `app/app.ts`, `materials.ts`, `harness.ts`, `content/prompts.ts`, `contracts.ts`, `resolve.ts`, `runtimeText.ts`, `suite-activities.check.ts`, `ui.ts`, `assets/index.ts`?**
  _High betweenness centrality (0.153) - this node is a cross-community bridge._
- **Why does `boot()` connect `boot` to `MissionRunner`, `World.ts`, `EnvironmentMaterials.ts`, `EnvironmentEditor.ts`, `createCameraIntegration`, `LocalProfile.ts`, `MemoryPack.ts`, `suite-activities.check.ts`, `main.ts`, `Telemetry`, `Quality.ts`, `agent-gemini.check.ts`, `ui.ts`, `templates/index.ts`, `FakeObserver`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `CameraSnapshot` connect `CameraSnapshot` to `createCameraIntegration`, `camera/types.ts`, `CameraAdapter`, `CameraUI`, `contracts.ts`, `camera.check.ts`, `integration.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 42 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _803 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pack.check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05708245243128964 - nodes in this community are weakly interconnected._
- **Should `MissionRunner` be split into smaller, more focused modules?**
  _Cohesion score 0.11942959001782531 - nodes in this community are weakly interconnected._