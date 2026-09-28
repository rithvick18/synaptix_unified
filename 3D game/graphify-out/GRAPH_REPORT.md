# Graph Report - 3D game  (2026-09-29)

## Corpus Check
- 206 files · ~380,534 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: .glb 5, .example 1, (none) 1)

## Summary
- 3007 nodes · 6777 edges · 164 communities (134 shown, 30 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 497 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e665c24a`
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
- config.ts
- run.mjs
- agent-gemini.check.ts
- world.check.ts
- checks/tsconfig.json
- three
- enabled.ts
- fetch-models.mjs
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
- authoring.ts
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
- createCameraIntegration
- summary
- tools.ts
- ScenePhotoSurface
- VisionBridge
- integration.ts
- prototypes.ts
- ExploreView
- content/validate.ts
- CameraAdapterApi
- screenshot-environments.mjs
- World.ts
- FakeConsumer
- worldSnapshot.ts
- InstructionHold
- Reminiscence Therapy Suite: controls, comfort and accessibility
- preview.ts
- FakeProducer
- materials.ts
- CameraUICallbacks
- h
- app/app.ts
- make-sounds.mjs
- openCaregiverSetup
- Player
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
- SuiteController
- .t
- Navigator
- home
- build-content.mjs
- en/app.json
- hi/app.json
- ActivitySessionApi
- runtimeText.ts
- place
- place
- suite-activities.check.ts
- FakeUI
- model.ts
- activity
- closeup
- activity
- closeup
- ui.ts
- Personalization in the Reminiscence Therapy Suite
- caregiver
- caregiver
- FakeObserver
- State.ts
- Reminiscence Therapy Suite — implementation plan and working agreement
- Content packs
- README.md
- who
- suite-assets.check.ts
- browser-check.mjs
- pause
- pause
- plan.ts
- assets/index.ts
- .endRun
- fetch-textures.mjs
- FakeUI
- run-check.mjs
- Fonts
- SuiteAudioApi
- Rig
- EnvironmentEditor.ts
- render-thumbnails.mjs
- agent-provenance.check.ts
- Activities
- Reminiscence Therapy Suite
- who
- Suite assets — provenance and attribution
- keyboard.ts
- Assets and environments
- write-environments.py
- caregiver
- vision
- caregiver
- .endStep
- audio.ts
- fetch-panoramas.mjs
- manifest.json
- vision
- camera
- comfort
- textSizes
- camera
- comfort
- textSizes
- PlacedPlayer
- minutes
- minutes
- seconds
- seconds

## God Nodes (most connected - your core abstractions)
1. `Kit` - 102 edges
2. `SuiteController` - 87 edges
3. `boot()` - 84 edges
4. `three` - 46 edges
5. `openCaregiverSetup()` - 46 edges
6. `MissionRunner` - 37 edges
7. `SuiteAudio` - 33 edges
8. `buildHouse()` - 32 edges
9. `CameraAdapter` - 30 edges
10. `str()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `ctx()` --calls--> `buildAllowedTokens()`  [EXTRACTED]
  tools/checks/agent-provenance.check.ts → src/agent/tokens.ts
- `policyRig()` --calls--> `AdaptationPolicy`  [EXTRACTED]
  tools/checks/camera.check.ts → src/camera/AdaptationPolicy.ts
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

## Communities (164 total, 30 thin omitted)

### Community 0 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 1 - "pack.check.ts"
Cohesion: 0.14
Nodes (13): PackProblem, failures, fakeCtx, FakeImage, fakeLoad(), LoadFn, makeWorld(), MISSING (+5 more)

### Community 3 - "MissionRunner"
Cohesion: 0.15
Nodes (4): instructionOf(), MissionRunner, speak(), stopSpeaking()

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
Cohesion: 0.06
Nodes (7): Interaction, boot(), PackVoices, MissionRunnerDeps, State, escapeText(), UI

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, name (+19 more)

### Community 9 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (53): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+45 more)

### Community 10 - "MemoryPack.ts"
Cohesion: 0.06
Nodes (40): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), breakagesFromLocation(), CardStyle, fitToPlate(), injectAnchors(), isObject() (+32 more)

### Community 11 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 12 - "gemini.ts"
Cohesion: 0.18
Nodes (15): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), imagePart(), InteractionStep, isGoogleEndpoint(), isRetryable() (+7 more)

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
Cohesion: 0.13
Nodes (20): colors, anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext, buildAuthoringSystemPrompt(), bullets(), ENVIRONMENT_REASONING (+12 more)

### Community 18 - "environments/index.ts"
Cohesion: 0.13
Nodes (28): createCanvas(), SceneReport, ShellMaterials, buildSuiteScene(), contactShadowMaterial(), downscale(), FLOOR_SETS, isHanging() (+20 more)

### Community 19 - "config.ts"
Cohesion: 0.12
Nodes (20): AgentConfig, AgentProvider, ConsentPrompt, consentPromptFor(), ensureConsent(), isAgentProvider(), isSetupMode(), OFFLINE_MODEL (+12 more)

### Community 20 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 21 - "agent-gemini.check.ts"
Cohesion: 0.13
Nodes (16): DEFAULT_GEMINI_MODEL, GeminiConfig, GeminiProviderAdapter, LlamaCppConfig, LlamaCppProviderAdapter, ProviderAdapter, EMPTY_STUB_SCRIPT, NullProviderAdapter (+8 more)

### Community 22 - "world.check.ts"
Cohesion: 0.10
Nodes (17): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+9 more)

### Community 23 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../../tsconfig.json, compilerOptions, noEmit, types, extends, include

### Community 24 - "three"
Cohesion: 0.10
Nodes (28): three, LocalizedText, SceneEnvironment, ShellId, ShellInfo, ShellSlot, courtyardVeranda, POSTS (+20 more)

### Community 26 - "fetch-models.mjs"
Cohesion: 0.22
Nodes (14): ASSETS, download(), gt(), inspect(), main(), MANIFEST, measure(), MODELS (+6 more)

### Community 37 - "llamaCpp.ts"
Cohesion: 0.17
Nodes (17): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), ParsedEnvelope, parseEnvelope() (+9 more)

### Community 38 - "authoring.ts"
Cohesion: 0.22
Nodes (18): matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), asNode(), buildProposalGrammar(), jsonKey() (+10 more)

### Community 39 - "review.ts"
Cohesion: 0.13
Nodes (15): Violation, ProposalStatus, ReviewCounts, ReviewedProposal, ReviewSession, CropHandles, ProposalReviewList, renderProvenanceSummary() (+7 more)

### Community 40 - "LocalProfile.ts"
Cohesion: 0.12
Nodes (29): agentConfigStore, applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId() (+21 more)

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
Cohesion: 0.08
Nodes (30): describe(), FocusProbe, PerfResult, renderOnly(), QualityProfile, buildExport(), downloadJson(), DWELL_THRESHOLD_MS (+22 more)

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
Nodes (8): AuditEntry, AuditLog, AuditSink, consoleAuditSink, CONSENT_PROMPT, failures, REQUEST, WITH_IMAGE

### Community 49 - "Quality.ts"
Cohesion: 0.12
Nodes (15): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+7 more)

### Community 50 - "suite-app.check.ts"
Cohesion: 0.13
Nodes (14): DOCK_CLEAR_PX, SUITE_CSS, SUITE_Z, channel(), contrastRatio(), cssName(), PALETTE, PALETTE_HC (+6 more)

### Community 51 - "CameraUI"
Cohesion: 0.17
Nodes (7): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref(), CameraSnapshot

### Community 52 - "SuiteAudio"
Cohesion: 0.17
Nodes (3): channelLevel(), SuiteAudio, AudioChannel

### Community 53 - "summary"
Cohesion: 0.08
Nodes (24): summary, activity, another, closeups, content, download, endedExited, endedFinished (+16 more)

### Community 55 - "camera.check.ts"
Cohesion: 0.11
Nodes (15): adapterState(), away, body, derived(), failures, fakeRuntime, Listeners, m() (+7 more)

### Community 56 - "Q: How do uploaded images modify the game environment?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do uploaded images modify the game environment?, Source Nodes

### Community 57 - "proposals.fixtures.ts"
Cohesion: 0.14
Nodes (15): DEFAULT_AGENT_CONFIG, ENVIRONMENT_TOOL, baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), PROPOSAL_FIXTURES (+7 more)

### Community 58 - "createCameraIntegration"
Cohesion: 0.13
Nodes (12): AdaptationEffects, AdaptationPolicy, createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera() (+4 more)

### Community 59 - "summary"
Cohesion: 0.08
Nodes (24): summary, activity, another, closeups, content, download, endedExited, endedFinished (+16 more)

### Community 60 - "tools.ts"
Cohesion: 0.11
Nodes (24): AuthoringRun, construct(), dispatch(), ScriptedCall, ScriptedToolName, StubModel, ChoiceType, FindStepProposal (+16 more)

### Community 61 - "ScenePhotoSurface"
Cohesion: 0.21
Nodes (5): DecorativeLoader, FACING, fitInside(), MAT_MARGIN, ScenePhotoSurface

### Community 62 - "VisionBridge"
Cohesion: 0.13
Nodes (8): GameEventSink, InstructionHoldOptions, OpenTask, OUTCOME_MAP, taskIdFor(), VisionBridge, VisionBridgeOptions, Event

### Community 63 - "integration.ts"
Cohesion: 0.09
Nodes (14): AdaptationConfig, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraIntegration, CameraIntegrationDeps, Env (+6 more)

### Community 64 - "prototypes.ts"
Cohesion: 0.07
Nodes (24): BUILDERS, Disposable, RefCache, acquireGltf(), cache, GltfPrototype, load(), pending (+16 more)

### Community 66 - "content/validate.ts"
Cohesion: 0.14
Nodes (36): LoadContentOptions, loadContentPacks(), loadOne(), message(), allows(), GENERIC_PROMPT_COUNTS, ItemKind, promptLevels() (+28 more)

### Community 68 - "screenshot-environments.mjs"
Cohesion: 0.17
Nodes (10): args, chrome, flags, out, PASSED, profile, root, views (+2 more)

### Community 69 - "World.ts"
Cohesion: 0.13
Nodes (14): Focus, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS, REQUIRED_HINT_TARGETS (+6 more)

### Community 71 - "worldSnapshot.ts"
Cohesion: 0.18
Nodes (16): out, snapshot, w, world, snap(), box(), canonicalQuaternion(), Json (+8 more)

### Community 73 - "Reminiscence Therapy Suite: controls, comfort and accessibility"
Cohesion: 0.15
Nodes (13): Camera movement, Camera support wording, Checks, Comfort choices, Comfort settings, Controls, Keyboard, Languages (+5 more)

### Community 74 - "preview.ts"
Cohesion: 0.21
Nodes (15): loadContentPacks, SHELL_DEFS, clock, grid(), label(), lines(), look(), main() (+7 more)

### Community 76 - "materials.ts"
Cohesion: 0.15
Nodes (15): cache, create(), MaterialEnv, MatSpec, PALETTE, signature(), tintFor(), weaveTexture() (+7 more)

### Community 78 - "h"
Cohesion: 0.19
Nodes (9): append(), AttrValue, button(), Child, clear(), focusFirst(), h(), itemLabel() (+1 more)

### Community 79 - "app/app.ts"
Cohesion: 0.05
Nodes (48): EventInput, SummaryInput, Overlay, Prepared, Run, Screen, ACTIVITIES, broken (+40 more)

### Community 80 - "make-sounds.mjs"
Cohesion: 0.09
Nodes (25): biquad(), buf(), burst(), durationMs(), fades(), FFMPEG, filter(), LAME (+17 more)

### Community 81 - "openCaregiverSetup"
Cohesion: 0.18
Nodes (33): openCaregiverSetup(), addPhotos(), addSounds(), applyLanguage(), audioFrom(), audioPreview(), button(), checkField() (+25 more)

### Community 83 - "contracts.ts"
Cohesion: 0.07
Nodes (25): SuiteDeps, ActivityRegistry, AssetSource, AssignPhotos, AudioRef, BuildSceneOptions, BuildSuiteScene, CreateActivitySession (+17 more)

### Community 84 - "Canvas"
Cohesion: 0.14
Nodes (17): bamboo_grove(), Canvas, flowers(), fruit_bowl(), hexrgb(), hills_mist(), hills_morning(), paddy_fields() (+9 more)

### Community 85 - "templates/index.ts"
Cohesion: 0.19
Nodes (20): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+12 more)

### Community 86 - "settings"
Cohesion: 0.09
Nodes (22): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+14 more)

### Community 87 - "settings"
Cohesion: 0.09
Nodes (22): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+14 more)

### Community 88 - "definitions.ts"
Cohesion: 0.14
Nodes (25): Availability, avoidOf(), define(), DEMO_SEQUENCE_OBJECTS, demoSequence(), highlighted(), no(), objectItem() (+17 more)

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
Cohesion: 0.16
Nodes (28): LocaleIndex, flattenEntries(), flattenKeys(), formatNumber(), interpolate(), isTree(), lookup(), placeholders() (+20 more)

### Community 95 - ".t"
Cohesion: 0.14
Nodes (10): dispose(), activityCard(), badge(), durationText(), header(), renderActivityPicker(), renderHome(), renderPlaceSection() (+2 more)

### Community 96 - "Navigator"
Cohesion: 0.23
Nodes (3): angleDelta(), lookAngles(), Navigator

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
Cohesion: 0.20
Nodes (10): drawCalendar(), drawRuntimeText(), drawSpines(), fitFont(), RuntimeTextInput, RuntimeTextSpec, RuntimeTextSurface, safeFormat() (+2 more)

### Community 103 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 104 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 105 - "suite-activities.check.ts"
Cohesion: 0.11
Nodes (33): ACTIVITIES, assignPhotos(), isAlbum(), isFrame(), createActivitySession(), gentleCueShown(), buildSummary(), createSuiteAppWith() (+25 more)

### Community 106 - "FakeUI"
Cohesion: 0.13
Nodes (4): endToEnd(), FakeState, FakeUI, makeWorld()

### Community 107 - "model.ts"
Cohesion: 0.07
Nodes (49): CaregiverAudio, CaregiverPrompt, SequenceRef, SuiteMediaApi, SuitePhoto, SuiteSound, TOPICS, SectionName (+41 more)

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

### Community 112 - "ui.ts"
Cohesion: 0.11
Nodes (10): EnvironmentReport, Renderer, AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage, RenderedProblem (+2 more)

### Community 113 - "Personalization in the Reminiscence Therapy Suite"
Cohesion: 0.20
Nodes (9): Limits, Media that cannot be shown, Personalization in the Reminiscence Therapy Suite, Privacy, Prompts, Storage, The "no inference" rules, Verification (+1 more)

### Community 114 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 115 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 116 - "FakeObserver"
Cohesion: 0.13
Nodes (3): samplePerf(), percentile(), FakeObserver

### Community 117 - "State.ts"
Cohesion: 0.33
Nodes (5): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, StateListener, TIMERS_RUN

### Community 118 - "Reminiscence Therapy Suite — implementation plan and working agreement"
Cohesion: 0.25
Nodes (7): Architecture, Conventions, File ownership, Fixed ids (so parallel work lines up), Flow, Reminiscence Therapy Suite — implementation plan and working agreement, Sequencing

### Community 119 - "Content packs"
Cohesion: 0.20
Nodes (10): content.json, Content packs, Demo pictures, Files, How `appliesTo` is matched, Regenerating, Sounds, To add a pack (+2 more)

### Community 120 - "README.md"
Cohesion: 0.20
Nodes (6): About the Hindi, Adding a language (example: Bengali, `bn`), Current coverage, How it works, Languages in the Reminiscence Therapy Suite, Longest strings

### Community 121 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 122 - "suite-assets.check.ts"
Cohesion: 0.15
Nodes (11): SHELLS, SuiteSceneReport, panoramaDirection(), panoramaFloorPoint(), SEAT_FOV, errors, failures, packErrors (+3 more)

### Community 123 - "browser-check.mjs"
Cohesion: 0.25
Nodes (5): chrome, failures, profile, root, server

### Community 124 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 125 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 126 - "plan.ts"
Cohesion: 0.52
Nodes (6): band(), cutsWall(), FLOOR, n(), planSvg(), rect()

### Community 127 - "assets/index.ts"
Cohesion: 0.06
Nodes (33): ContentState, hasBuilder(), createAssetLibrary(), Library, loadAssetLibrary(), MANIFEST_PATH, ACCEPTED_LICENSES, CATEGORIES (+25 more)

### Community 129 - "fetch-textures.mjs"
Cohesion: 0.40
Nodes (3): OUT, ROOT, SETS

### Community 131 - "run-check.mjs"
Cohesion: 0.50
Nodes (3): bundle, out, root

### Community 134 - "Rig"
Cohesion: 0.18
Nodes (4): FakePlayer, FakeState, FakeVoices, Rig

### Community 135 - "EnvironmentEditor.ts"
Cohesion: 0.19
Nodes (13): needsSetup(), describeEnvironment(), validateEnvironment(), geminiConfigFromEnv(), llamaCppConfigFromEnv(), destinationLine(), environmentEditor(), waitingLine() (+5 more)

### Community 136 - "render-thumbnails.mjs"
Cohesion: 0.25
Nodes (6): chrome, out, profile, root, vite, work

### Community 137 - "agent-provenance.check.ts"
Cohesion: 0.20
Nodes (6): FirewallContext, ProposalFixture, computeProvenance(), ProvenanceBlock, ctx(), failures

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
Cohesion: 0.29
Nodes (6): Fonts, pictures and sounds, Models (Poly Haven, CC0-1.0), Panoramas (Poly Haven, CC0-1.0), Suite assets — provenance and attribution, Textures (Poly Haven, CC0-1.0), Thumbnails

### Community 142 - "keyboard.ts"
Cohesion: 0.20
Nodes (9): isControl(), isTyping(), ARROWS, BLOCKING_SELECTORS, keyAction, KeyContext, KeyInput, keysBlocked() (+1 more)

### Community 143 - "Assets and environments"
Cohesion: 0.29
Nodes (6): Add a photo room, Add an asset, Add or change an environment, Assets and environments, Budgets, Lighting

### Community 144 - "write-environments.py"
Cohesion: 0.50
Nodes (3): env(), Writes public/suite/packs/*/environments.json (the environment dressing…, slots()

### Community 145 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 146 - "vision"
Cohesion: 0.25
Nodes (8): vision, cues, held, label, samples, title, tracking, unmeasured

### Community 147 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 149 - "audio.ts"
Cohesion: 0.29
Nodes (7): choosePromptRoute(), findVoice(), norm(), Playing, PromptRoute, SuiteAudioOptions, VoiceLike

### Community 150 - "fetch-panoramas.mjs"
Cohesion: 0.36
Nodes (7): download(), main(), OUT, parseArgs(), PY, ROOT, webp()

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

### Community 160 - "minutes"
Cohesion: 0.67
Nodes (3): one, other, minutes

### Community 161 - "minutes"
Cohesion: 0.67
Nodes (3): one, other, minutes

### Community 162 - "seconds"
Cohesion: 0.67
Nodes (3): one, other, seconds

### Community 163 - "seconds"
Cohesion: 0.67
Nodes (3): one, other, seconds

## Knowledge Gaps
- **833 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+828 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1205 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **30 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `three` to `pack.check.ts`, `Kit`, `EnvironmentEditor.ts`, `package.json`, `proceduralHouse.ts`, `MemoryPack.ts`, `navigator.ts`, `environments/index.ts`, `world.check.ts`, `LocalProfile.ts`, `main.ts`, `agent-review.check.ts`, `suite-app.check.ts`, `ScenePhotoSurface`, `prototypes.ts`, `World.ts`, `worldSnapshot.ts`, `preview.ts`, `materials.ts`, `app/app.ts`, `contracts.ts`, `runtimeText.ts`, `suite-activities.check.ts`, `model.ts`, `ui.ts`, `suite-assets.check.ts`, `assets/index.ts`?**
  _High betweenness centrality (0.165) - this node is a cross-community bridge._
- **Why does `boot()` connect `boot` to `MissionRunner`, `World.ts`, `EnvironmentEditor.ts`, `LocalProfile.ts`, `proceduralHouse.ts`, `MemoryPack.ts`, `suite-activities.check.ts`, `main.ts`, `Telemetry`, `ui.ts`, `Quality.ts`, `Player`, `config.ts`, `FakeObserver`, `createCameraIntegration`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `CameraAdapter` connect `CameraAdapter` to `CameraAdapterApi`, `camera/types.ts`, `camera.check.ts`, `createCameraIntegration`, `integration.ts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 42 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _833 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pack.check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Should `MissionRunner` be split into smaller, more focused modules?**
  _Cohesion score 0.1471861471861472 - nodes in this community are weakly interconnected._