# Graph Report - 3D game  (2026-09-26)

## Corpus Check
- 169 files · ~303,443 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 3 file(s) not represented in the graph (top: .example 1, (none) 1, .woff2 1)

## Summary
- 2668 nodes · 6017 edges · 133 communities (106 shown, 27 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 478 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cd9b5338`
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
- Player
- Telemetry
- make-photos.py
- compilerOptions
- suite-app.check.ts
- agent-prompts.check.ts
- Interaction
- agent-gemini.check.ts
- run.mjs
- SuiteController
- world.check.ts
- checks/tsconfig.json
- ui.ts
- enabled.ts
- tools.ts
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
- gemini.ts
- CameraUI
- SuiteAudio
- summary
- selectProvider.ts
- camera.check.ts
- Q: How do uploaded images modify the game environment?
- proposals.fixtures.ts
- CameraSnapshot
- summary
- authoring.ts
- validate
- VisionBridge
- integration.ts
- Rig
- explore.ts
- validate.ts
- CameraAdapterApi
- FakeUI
- World.ts
- FakeConsumer
- worldSnapshot.ts
- createCameraIntegration
- EnvironmentEditor.ts
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
- h
- SceneObject
- resolve.ts
- home
- build-content.mjs
- en/app.json
- hi/app.json
- ActivitySessionApi
- FakeUI
- place
- place
- app/index.ts
- suite-profile.check.ts
- profile/media.ts
- activity
- closeup
- activity
- closeup
- agent.check.ts
- Personalization in the Reminiscence Therapy Suite
- caregiver
- caregiver
- caregiver
- caregiver
- Reminiscence Therapy Suite — implementation plan and working agreement
- .endStep
- Languages in the Reminiscence Therapy Suite
- who
- SuiteTelemetryPort
- plan.ts
- pause
- pause
- State.ts
- AssetLibrary
- SuiteStatePort
- fetch-textures.mjs
- PlacedPlayer
- run-check.mjs
- Fonts

## God Nodes (most connected - your core abstractions)
1. `Kit` - 102 edges
2. `SuiteController` - 86 edges
3. `boot()` - 84 edges
4. `openCaregiverSetup()` - 46 edges
5. `MissionRunner` - 37 edges
6. `SuiteAudio` - 33 edges
7. `buildHouse()` - 32 edges
8. `three` - 30 edges
9. `CameraAdapter` - 30 edges
10. `str()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `environmentEditor()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentEditor.ts
- `run()` --calls--> `styleMaterial()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentMaterials.ts
- `main()` --calls--> `newProfile()`  [EXTRACTED]
  tools/checks/suite-profile.check.ts → src/LocalProfile.ts
- `mutate()` --calls--> `validate()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts
- `mediaFor()` --calls--> `loadMedia()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three levels in one caregiver pack** — spec_memory_pack, spec_water, spec_morning_walk, spec_familiar_memories [EXTRACTED 1.00]

## Communities (133 total, 27 thin omitted)

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
Nodes (101): frameBars(), legs(), mat(), num(), Params, pivot(), runtimeText(), str() (+93 more)

### Community 7 - "boot"
Cohesion: 0.08
Nodes (6): boot(), PackVoices, MissionRunnerDeps, State, escapeText(), UI

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, name (+19 more)

### Community 9 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (53): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+45 more)

### Community 10 - "MemoryPack.ts"
Cohesion: 0.07
Nodes (36): three, applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), CardStyle, fitToPlate(), injectAnchors(), Json (+28 more)

### Community 11 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 14 - "make-photos.py"
Cohesion: 0.29
Nodes (16): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+8 more)

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 16 - "suite-app.check.ts"
Cohesion: 0.06
Nodes (40): no(), angleDelta(), BoxLike, clamp(), clampLook(), collides(), dampFactor(), DEG (+32 more)

### Community 17 - "agent-prompts.check.ts"
Cohesion: 0.09
Nodes (29): colors, describeEnvironment(), ENVIRONMENT_TOOL, validateEnvironment(), anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext (+21 more)

### Community 19 - "agent-gemini.check.ts"
Cohesion: 0.09
Nodes (25): AgentConfig, agentConfigStore, AgentProvider, CONSENT_PROMPT, ConsentPrompt, consentPromptFor(), ensureConsent(), isAgentProvider() (+17 more)

### Community 20 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 21 - "SuiteController"
Cohesion: 0.11
Nodes (5): createSuiteAppWith(), dispose(), SuiteController, focusFirst(), renderSettingsDialog()

### Community 22 - "world.check.ts"
Cohesion: 0.10
Nodes (17): PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS, ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs (+9 more)

### Community 23 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../../tsconfig.json, compilerOptions, noEmit, types, extends, include

### Community 24 - "ui.ts"
Cohesion: 0.12
Nodes (11): DeviceInfo, EnvironmentReport, Renderer, AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage (+3 more)

### Community 26 - "tools.ts"
Cohesion: 0.12
Nodes (9): ChoiceType, FindStepProposal, hints, LevelProposal, NavigateStepProposal, PhotoPlacementProposal, ReadContext, rect (+1 more)

### Community 37 - "llamaCpp.ts"
Cohesion: 0.15
Nodes (19): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), LlamaCppProviderAdapter, ParsedEnvelope (+11 more)

### Community 38 - "grammar.ts"
Cohesion: 0.49
Nodes (9): asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule(), ParsedCall, SchemaNode (+1 more)

### Community 39 - "review.ts"
Cohesion: 0.11
Nodes (19): AuthoringRun, Violation, computeProvenance(), ProvenanceBlock, ProposalStatus, ReviewCounts, ReviewedProposal, ReviewSession (+11 more)

### Community 40 - "LocalProfile.ts"
Cohesion: 0.15
Nodes (26): applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId(), newProfile() (+18 more)

### Community 41 - "agent-images.check.ts"
Cohesion: 0.15
Nodes (8): eq(), expectReject(), failures, FakeCanvas, FakeCtx, FakeSource, ok(), text()

### Community 42 - "firewall.ts"
Cohesion: 0.17
Nodes (18): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+10 more)

### Community 43 - "profile-check.mjs"
Cohesion: 0.12
Nodes (12): /src/templates/index.ts, /src/LocalProfile.ts, /src/templates/plan.ts, /tools/profile-browser.check.ts, args, CDP, chrome, originArg (+4 more)

### Community 44 - "main.ts"
Cohesion: 0.06
Nodes (34): samplePerf(), describe(), FocusProbe, percentile(), PerfResult, renderOnly(), breakagesFromLocation(), patientIdFromLocation() (+26 more)

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
Nodes (7): AuditEntry, AuditLog, AuditSink, consoleAuditSink, failures, REQUEST, WITH_IMAGE

### Community 49 - "Quality.ts"
Cohesion: 0.13
Nodes (14): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), isSmall(), median() (+6 more)

### Community 50 - "gemini.ts"
Cohesion: 0.19
Nodes (15): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), GeminiProviderAdapter, imagePart(), InteractionStep, isGoogleEndpoint() (+7 more)

### Community 51 - "CameraUI"
Cohesion: 0.16
Nodes (6): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref()

### Community 52 - "SuiteAudio"
Cohesion: 0.08
Nodes (12): channelLevel(), choosePromptRoute(), findVoice(), norm(), Playing, PromptRoute, SuiteAudio, SuiteAudioOptions (+4 more)

### Community 53 - "summary"
Cohesion: 0.05
Nodes (38): one, other, one, other, summary, activity, another, closeups (+30 more)

### Community 54 - "selectProvider.ts"
Cohesion: 0.21
Nodes (9): DEFAULT_GEMINI_MODEL, GeminiConfig, LlamaCppConfig, ProviderAdapter, EMPTY_STUB_SCRIPT, NullProviderAdapter, SelectProviderOptions, StubProviderAdapter (+1 more)

### Community 55 - "camera.check.ts"
Cohesion: 0.07
Nodes (15): adapterState(), away, body, derived(), failures, FakeObserver, fakeRuntime, Listeners (+7 more)

### Community 56 - "Q: How do uploaded images modify the game environment?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do uploaded images modify the game environment?, Source Nodes

### Community 57 - "proposals.fixtures.ts"
Cohesion: 0.16
Nodes (13): FirewallContext, baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), ProposalFixture, sparseContext() (+5 more)

### Community 58 - "CameraSnapshot"
Cohesion: 0.16
Nodes (9): AdaptationEffects, AdaptationPolicy, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraSnapshot, CameraSuggestion, SuggestionAction (+1 more)

### Community 59 - "summary"
Cohesion: 0.05
Nodes (38): one, other, one, other, summary, activity, another, closeups (+30 more)

### Community 60 - "authoring.ts"
Cohesion: 0.22
Nodes (21): construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), parseProposalCalls(), proposalTools() (+13 more)

### Community 61 - "validate"
Cohesion: 0.52
Nodes (4): isObject(), Problems, validate(), validateStep()

### Community 62 - "VisionBridge"
Cohesion: 0.13
Nodes (8): GameEventSink, InstructionHoldOptions, OpenTask, OUTCOME_MAP, taskIdFor(), VisionBridge, VisionBridgeOptions, Event

### Community 63 - "integration.ts"
Cohesion: 0.09
Nodes (12): AdaptationConfig, AdaptationRecord, CameraIntegration, CameraIntegrationDeps, Env, LOOPBACK, MOVEMENT_KEYS, readAdaptPref() (+4 more)

### Community 64 - "Rig"
Cohesion: 0.18
Nodes (4): FakePlayer, FakeState, FakeVoices, Rig

### Community 65 - "explore.ts"
Cohesion: 0.12
Nodes (12): append(), AttrValue, button(), Child, clear(), trapFocus(), ActionName, ExploreView (+4 more)

### Community 66 - "validate.ts"
Cohesion: 0.14
Nodes (35): LoadContentOptions, loadContentPacks(), loadOne(), message(), ASSET_CATEGORIES, AssetLookup, checkActivities(), checkProvenance() (+27 more)

### Community 69 - "World.ts"
Cohesion: 0.13
Nodes (14): Focus, SwappedMaterial, StepContext, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS, REQUIRED_HINT_TARGETS (+6 more)

### Community 71 - "worldSnapshot.ts"
Cohesion: 0.19
Nodes (16): out, snapshot, w, world, box(), canonicalQuaternion(), diffSnapshots(), Json (+8 more)

### Community 72 - "createCameraIntegration"
Cohesion: 0.18
Nodes (8): createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera(), syncTick(), InstructionHold

### Community 73 - "EnvironmentEditor.ts"
Cohesion: 0.20
Nodes (15): needsSetup(), geminiConfigFromEnv(), ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason (+7 more)

### Community 74 - "app/app.ts"
Cohesion: 0.08
Nodes (24): ContentState, Overlay, Prepared, Run, Screen, isControl(), isTyping(), ARROWS (+16 more)

### Community 76 - "materials.ts"
Cohesion: 0.08
Nodes (21): Disposable, RefCache, BuilderContext, cache, create(), FLAT_ENV, MaterialEnv, MaterialLease (+13 more)

### Community 78 - "model.ts"
Cohesion: 0.10
Nodes (32): CaregiverAudio, CaregiverPrompt, ObjectOverrides, SequenceRef, SuitePhoto, SuiteSound, SectionName, SECTIONS (+24 more)

### Community 79 - "harness.ts"
Cohesion: 0.09
Nodes (24): SummaryInput, ACTIVITIES, broken, buildScene(), camera, clock, d, demoPhoto (+16 more)

### Community 80 - "make-sounds.mjs"
Cohesion: 0.09
Nodes (25): biquad(), buf(), burst(), durationMs(), fades(), FFMPEG, filter(), LAME (+17 more)

### Community 81 - "openCaregiverSetup"
Cohesion: 0.25
Nodes (31): openCaregiverSetup(), addPhotos(), addSounds(), applyLanguage(), audioFrom(), audioPreview(), button(), checkField() (+23 more)

### Community 82 - "content/prompts.ts"
Cohesion: 0.10
Nodes (19): spaceItem(), DEMO_TEXTURE_MAX, demoPhoto(), packDisplayMedia(), packSound(), allows(), GENERIC_PROMPT_COUNTS, ItemKind (+11 more)

### Community 83 - "contracts.ts"
Cohesion: 0.12
Nodes (27): SuiteDeps, ActivityRegistry, AssetManifest, AssetSource, AssignPhotos, AudioRef, BuildSceneOptions, BuildSuiteScene (+19 more)

### Community 84 - "Canvas"
Cohesion: 0.14
Nodes (17): bamboo_grove(), Canvas, flowers(), fruit_bowl(), hexrgb(), hills_mist(), hills_morning(), paddy_fields() (+9 more)

### Community 85 - "templates/index.ts"
Cohesion: 0.18
Nodes (21): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, courtyard, OPENINGS, hallway (+13 more)

### Community 86 - "settings"
Cohesion: 0.08
Nodes (26): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+18 more)

### Community 87 - "settings"
Cohesion: 0.08
Nodes (26): settings, caregiverAssist, caregiverAssistHint, done, highContrast, master, muted, navigation (+18 more)

### Community 88 - "definitions.ts"
Cohesion: 0.17
Nodes (23): assignPhotos(), Availability, avoidOf(), define(), DEMO_SEQUENCE_OBJECTS, demoSequence(), highlighted(), isAlbum() (+15 more)

### Community 89 - "home"
Cohesion: 0.08
Nodes (25): hint, open, title, hint, open, title, hint, open (+17 more)

### Community 90 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 91 - "explore"
Cohesion: 0.09
Nodes (23): explore, backToRoom, building, closeup, demoPicture, exit, finish, freeHint (+15 more)

### Community 92 - "settings.ts"
Cohesion: 0.12
Nodes (13): browserStorage(), defaultSettings(), loadSettings(), normaliseSettings(), prefersReducedMotion(), saveSettings(), SETTINGS_KEY, SettingsStorage (+5 more)

### Community 93 - "i18n/index.ts"
Cohesion: 0.21
Nodes (20): JsonLoader, flattenEntries(), flattenKeys(), formatNumber(), interpolate(), isTree(), lookup(), pluralCategory() (+12 more)

### Community 94 - "h"
Cohesion: 0.28
Nodes (10): h(), activityCard(), badge(), durationText(), header(), renderActivity(), renderHome(), renderPlace() (+2 more)

### Community 95 - "SceneObject"
Cohesion: 0.15
Nodes (7): Highlighter, pickObject(), ray, TINT, Tintable, classifyGesture(), SceneObject

### Community 96 - "resolve.ts"
Cohesion: 0.24
Nodes (11): SuiteMediaApi, envKey(), objectPromptKey(), close(), displayPhoto(), fitWithin(), resolvePrompt(), resolveSuiteProfile() (+3 more)

### Community 97 - "home"
Cohesion: 0.11
Nodes (18): hint, open, title, hint, open, title, hint, open (+10 more)

### Community 98 - "build-content.mjs"
Cohesion: 0.12
Nodes (13): ffprobeDurationMs(), GENERATED, imageDefs(), IMAGES, NORTHEAST_PROMPTS, NORTHEAST_SOUND_IDS, NOTICE, PACKS (+5 more)

### Community 99 - "en/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 100 - "hi/app.json"
Cohesion: 0.12
Nodes (16): back, badge, demo, general, personal, brand, camera, off (+8 more)

### Community 102 - "FakeUI"
Cohesion: 0.13
Nodes (4): endToEnd(), FakeState, FakeUI, makeWorld()

### Community 103 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 104 - "place"
Cohesion: 0.13
Nodes (15): place, continue, coverage, failed, general, intro, loading, none (+7 more)

### Community 105 - "app/index.ts"
Cohesion: 0.22
Nodes (12): ACTIVITIES, pickerFor(), createActivitySession(), EventInput, gentleCueShown(), buildSummary(), createSuiteApp(), loadContentPacks (+4 more)

### Community 106 - "suite-profile.check.ts"
Cohesion: 0.23
Nodes (14): LocaleIndex, placeholders(), resolveText(), defaultSuiteProfile(), blob(), captureWarnings(), failures, fakePhoto() (+6 more)

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

### Community 112 - "agent.check.ts"
Cohesion: 0.18
Nodes (6): DEFAULT_AGENT_CONFIG, PROPOSAL_FIXTURES, StubModel, AGENT_TOOL_SCHEMA, failures, rulesSeen

### Community 113 - "Personalization in the Reminiscence Therapy Suite"
Cohesion: 0.20
Nodes (9): Limits, Media that cannot be shown, Personalization in the Reminiscence Therapy Suite, Privacy, Prompts, Storage, The "no inference" rules, Verification (+1 more)

### Community 114 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 115 - "caregiver"
Cohesion: 0.20
Nodes (10): addNote, hide, items, noteAdded, notePlaceholder, notes, show, tip (+2 more)

### Community 116 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 117 - "caregiver"
Cohesion: 0.22
Nodes (9): failed, hint, homeHint, homeOpen, homeTitle, loading, saved, setup (+1 more)

### Community 118 - "Reminiscence Therapy Suite — implementation plan and working agreement"
Cohesion: 0.25
Nodes (7): Architecture, Conventions, File ownership, Fixed ids (so parallel work lines up), Flow, Reminiscence Therapy Suite — implementation plan and working agreement, Sequencing

### Community 120 - "Languages in the Reminiscence Therapy Suite"
Cohesion: 0.29
Nodes (6): About the Hindi, Adding a language (example: Bengali, `bn`), Current coverage, How it works, Languages in the Reminiscence Therapy Suite, Longest strings

### Community 121 - "who"
Cohesion: 0.29
Nodes (7): who, demo, demoHint, none, savedHint, title, unnamed

### Community 123 - "plan.ts"
Cohesion: 0.52
Nodes (6): band(), cutsWall(), FLOOR, n(), planSvg(), rect()

### Community 124 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 125 - "pause"
Cohesion: 0.33
Nodes (6): pause, body, end, resume, settings, title

### Community 126 - "State.ts"
Cohesion: 0.33
Nodes (5): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, StateListener, TIMERS_RUN

### Community 129 - "fetch-textures.mjs"
Cohesion: 0.40
Nodes (3): OUT, ROOT, SETS

### Community 131 - "run-check.mjs"
Cohesion: 0.50
Nodes (3): bundle, out, root

## Knowledge Gaps
- **721 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+716 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1071 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `MemoryPack.ts` to `pack.check.ts`, `Kit`, `package.json`, `proceduralHouse.ts`, `suite-app.check.ts`, `agent-prompts.check.ts`, `world.check.ts`, `ui.ts`, `LocalProfile.ts`, `main.ts`, `agent-review.check.ts`, `World.ts`, `worldSnapshot.ts`, `materials.ts`, `harness.ts`, `content/prompts.ts`, `contracts.ts`, `SceneObject`, `resolve.ts`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `SuiteController` connect `SuiteController` to `explore.ts`, `LocalProfile.ts`, `app/app.ts`, `harness.ts`, `suite-app.check.ts`, `content/prompts.ts`, `settings.ts`, `h`, `SceneObject`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `LocalProfile` connect `LocalProfile.ts` to `EnvironmentEditor.ts`, `app/app.ts`, `proceduralHouse.ts`, `main.ts`, `suite-profile.check.ts`, `model.ts`, `contracts.ts`, `SuiteController`, `settings.ts`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 42 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 42 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _721 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pack.check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Should `MissionRunner` be split into smaller, more focused modules?**
  _Cohesion score 0.1471861471861472 - nodes in this community are weakly interconnected._