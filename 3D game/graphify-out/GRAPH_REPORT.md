# Graph Report - 3D game  (2026-09-25)

## Corpus Check
- 92 files · ~157,248 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .example 1, (none) 1)

## Summary
- 1330 nodes · 2868 edges · 82 communities (53 shown, 29 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 100 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `65eac59a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- perf-templates.mjs
- pack.check.ts
- HintBeacon
- MissionRunner
- Three levels
- templates/types.ts
- .showHint
- boot
- package.json
- proceduralHouse.ts
- MemoryPack.ts
- offline-check.mjs
- Player
- Telemetry
- make-photos.py
- compilerOptions
- State
- agent-prompts.check.ts
- Interaction
- agent-gemini.check.ts
- run.mjs
- PackVoices
- world.check.ts
- checks/tsconfig.json
- three
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
- telemetry.check.ts
- agent-review.check.ts
- camera/types.ts
- CameraAdapter
- agent-provider.check.ts
- Quality.ts
- gemini.ts
- CameraUI
- loadMedia
- main.ts
- selectProvider.ts
- camera.check.ts
- Q: How do uploaded images modify the game environment?
- proposals.fixtures.ts
- AdaptationPolicy
- Renderer
- authoring.ts
- validate
- VisionBridge
- integration.ts
- Rig
- createCameraIntegration
- FakeObserver
- CameraAdapterApi
- FakeUI
- World.ts
- FakeConsumer
- worldSnapshot.ts
- InstructionHold
- EnvironmentEditor.ts
- environment.check.ts
- FakeProducer
- VisionBridge.ts
- CameraUICallbacks
- WorldSource
- world.capture.ts
- CameraIntegration
- ChoiceCard

## God Nodes (most connected - your core abstractions)
1. `boot()` - 91 edges
2. `MissionRunner` - 39 edges
3. `buildHouse()` - 32 edges
4. `CameraAdapter` - 30 edges
5. `UI` - 28 edges
6. `Telemetry` - 27 edges
7. `createCameraIntegration()` - 27 edges
8. `CameraUI` - 26 edges
9. `Player` - 23 edges
10. `State` - 21 edges

## Surprising Connections (you probably didn't know these)
- `ctx()` --calls--> `buildAllowedTokens()`  [EXTRACTED]
  tools/checks/agent-provenance.check.ts → src/agent/tokens.ts
- `run()` --calls--> `environmentEditor()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentEditor.ts
- `run()` --calls--> `styleMaterial()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentMaterials.ts
- `mutate()` --calls--> `validate()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts
- `mediaFor()` --calls--> `loadMedia()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three levels in one caregiver pack** — spec_memory_pack, spec_water, spec_morning_walk, spec_familiar_memories [EXTRACTED 1.00]

## Communities (82 total, 29 thin omitted)

### Community 0 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 1 - "pack.check.ts"
Cohesion: 0.11
Nodes (14): PackProblem, failures, fakeCtx, FakeImage, fakeLoad(), LoadFn, makeWorld(), MISSING (+6 more)

### Community 3 - "MissionRunner"
Cohesion: 0.18
Nodes (4): instructionOf(), MissionRunner, stopSpeaking(), Outcome

### Community 4 - "Three levels"
Cohesion: 0.09
Nodes (30): Deployment incomplete, Vercel and Netlify static hosting, Poly Haven runtime textures and HDRI, Smriti HTML entry, Smriti debug handle, Mira and Raju fictional demo packs, Headless and offline checks, Personalisation anchors (+22 more)

### Community 5 - "templates/types.ts"
Cohesion: 0.06
Nodes (61): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS (+53 more)

### Community 7 - "boot"
Cohesion: 0.13
Nodes (5): boot(), describe(), percentile(), escapeText(), UI

### Community 8 - "package.json"
Cohesion: 0.07
Nodes (27): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, name (+19 more)

### Community 9 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (54): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+46 more)

### Community 10 - "MemoryPack.ts"
Cohesion: 0.11
Nodes (24): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), CardStyle, fitToPlate(), injectAnchors(), Json, LoadedPack (+16 more)

### Community 11 - "offline-check.mjs"
Cohesion: 0.11
Nodes (16): args, CDP, chrome, consoleErrors, failures, navigateAndBoot(), ok(), originArg (+8 more)

### Community 14 - "make-photos.py"
Cohesion: 0.29
Nodes (16): band(), blank(), disc(), ellipse(), glyph(), grain(), lerp(), over() (+8 more)

### Community 15 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleResolution, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "agent-prompts.check.ts"
Cohesion: 0.13
Nodes (21): colors, ENVIRONMENT_TOOL, anchorLines(), assetLines(), AUTHORING_REASONING, AuthoringContext, buildAuthoringSystemPrompt(), bullets() (+13 more)

### Community 19 - "agent-gemini.check.ts"
Cohesion: 0.09
Nodes (24): AgentConfig, AgentProvider, CONSENT_PROMPT, ConsentPrompt, consentPromptFor(), ensureConsent(), isAgentProvider(), isSetupMode() (+16 more)

### Community 20 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 22 - "world.check.ts"
Cohesion: 0.11
Nodes (15): ANCHOR_PLATE, HouseWorld, auditLines, cellIn(), configs, crossings(), cx(), cz() (+7 more)

### Community 23 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../../tsconfig.json, compilerOptions, noEmit, types, extends, include

### Community 24 - "three"
Cohesion: 0.17
Nodes (10): three, EnvironmentReport, AnswerCardOptions, CameraEntry, LevelChoice, LevelSelectView, LoadStage, RenderedProblem (+2 more)

### Community 26 - "tools.ts"
Cohesion: 0.12
Nodes (9): ChoiceType, FindStepProposal, hints, LevelProposal, NavigateStepProposal, PhotoPlacementProposal, ReadContext, rect (+1 more)

### Community 37 - "llamaCpp.ts"
Cohesion: 0.16
Nodes (19): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), ParsedEnvelope, parseEnvelope() (+11 more)

### Community 38 - "grammar.ts"
Cohesion: 0.42
Nodes (10): asNode(), buildProposalGrammar(), jsonKey(), kebab(), literal(), objectRule(), ParsedCall, SchemaNode (+2 more)

### Community 39 - "review.ts"
Cohesion: 0.09
Nodes (21): FirewallContext, Violation, ProposalFixture, computeProvenance(), ProvenanceBlock, ProposalStatus, ReviewCounts, ReviewedProposal (+13 more)

### Community 40 - "LocalProfile.ts"
Cohesion: 0.16
Nodes (25): applySetupMode(), defaultModelForMode(), providerForMode(), Crop, LocalPerson, LocalProfile, newId(), newProfile() (+17 more)

### Community 41 - "agent-images.check.ts"
Cohesion: 0.10
Nodes (15): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), eq() (+7 more)

### Community 42 - "firewall.ts"
Cohesion: 0.17
Nodes (18): AssetRegistry, checkClinicalVocabulary(), checkHedgingAndForm(), checkHighlightTarget(), checkHints(), checkText(), checkTokensAgainstAllowlist(), CLINICAL_DENYLIST (+10 more)

### Community 43 - "profile-check.mjs"
Cohesion: 0.12
Nodes (12): /src/templates/index.ts, /src/LocalProfile.ts, /src/templates/plan.ts, /tools/profile-browser.check.ts, args, CDP, chrome, originArg (+4 more)

### Community 44 - "telemetry.check.ts"
Cohesion: 0.05
Nodes (29): buildExport(), downloadJson(), DWELL_THRESHOLD_MS, dwellByObject(), DwellTotal, EventListener, ExportContext, ExportDocument (+21 more)

### Community 45 - "agent-review.check.ts"
Cohesion: 0.16
Nodes (11): assets(), ctx(), emptyPack, failures, fakeCtx, FakeImage, fakeLoad(), firewallWorld() (+3 more)

### Community 46 - "camera/types.ts"
Cohesion: 0.12
Nodes (23): CameraAdapterOptions, Runtime, buildSnapshot(), copy(), localCamera(), observerError(), phaseOf(), SnapshotInputs (+15 more)

### Community 48 - "agent-provider.check.ts"
Cohesion: 0.13
Nodes (7): AuditEntry, AuditLog, AuditSink, consoleAuditSink, failures, REQUEST, WITH_IMAGE

### Community 49 - "Quality.ts"
Cohesion: 0.12
Nodes (15): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+7 more)

### Community 50 - "gemini.ts"
Cohesion: 0.20
Nodes (14): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), GeminiProviderAdapter, imagePart(), InteractionStep, isGoogleEndpoint() (+6 more)

### Community 51 - "CameraUI"
Cohesion: 0.17
Nodes (7): CameraUI, describeError(), describeHold(), describeSnapshot(), StepState, writePref(), CameraSnapshot

### Community 52 - "loadMedia"
Cohesion: 0.21
Nodes (7): loadAudio(), loadImage(), loadMedia(), loadTexture(), PackMedia, placeholderTexture(), mediaFor()

### Community 53 - "main.ts"
Cohesion: 0.18
Nodes (10): agentConfigStore, FocusProbe, PerfResult, breakagesFromLocation(), loadPack(), PackRejected, patientIdFromLocation(), resolvePackPath() (+2 more)

### Community 54 - "selectProvider.ts"
Cohesion: 0.20
Nodes (11): DEFAULT_GEMINI_MODEL, GeminiConfig, LlamaCppConfig, LlamaCppProviderAdapter, ProviderAdapter, ProviderResult, EMPTY_STUB_SCRIPT, NullProviderAdapter (+3 more)

### Community 55 - "camera.check.ts"
Cohesion: 0.12
Nodes (14): adapterState(), away, body, derived(), failures, fakeRuntime, Listeners, m() (+6 more)

### Community 56 - "Q: How do uploaded images modify the game environment?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do uploaded images modify the game environment?, Source Nodes

### Community 57 - "proposals.fixtures.ts"
Cohesion: 0.15
Nodes (14): DEFAULT_AGENT_CONFIG, baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), PROPOSAL_FIXTURES, sparseContext() (+6 more)

### Community 58 - "AdaptationPolicy"
Cohesion: 0.21
Nodes (4): AdaptationEffects, AdaptationPolicy, CameraSuggestion, policyRig()

### Community 60 - "authoring.ts"
Cohesion: 0.18
Nodes (23): AuthoringRun, construct(), matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), parseProposalCalls() (+15 more)

### Community 61 - "validate"
Cohesion: 0.52
Nodes (4): isObject(), Problems, validate(), validateStep()

### Community 62 - "VisionBridge"
Cohesion: 0.21
Nodes (3): taskIdFor(), VisionBridge, Event

### Community 63 - "integration.ts"
Cohesion: 0.21
Nodes (10): AdaptationConfig, AdaptationRecord, DEFAULT_ADAPTATION_CONFIG, GameContext, Outcome, CameraIntegrationDeps, Env, LOOPBACK (+2 more)

### Community 64 - "Rig"
Cohesion: 0.18
Nodes (4): FakePlayer, FakeState, FakeVoices, Rig

### Community 65 - "createCameraIntegration"
Cohesion: 0.24
Nodes (10): createCameraIntegration(), disable(), enable(), installInputListeners(), setAdaptation(), startCamera(), syncTick(), readAdaptPref() (+2 more)

### Community 69 - "World.ts"
Cohesion: 0.23
Nodes (10): Focus, SwappedMaterial, assertWorldContract(), InteractableMeta, readMeta(), REQUIRED_ANCHORS, REQUIRED_HINT_TARGETS, REQUIRED_INTERACTABLES (+2 more)

### Community 71 - "worldSnapshot.ts"
Cohesion: 0.33
Nodes (10): box(), canonicalQuaternion(), Json, material(), placement(), placements(), plain(), scene() (+2 more)

### Community 73 - "EnvironmentEditor.ts"
Cohesion: 0.44
Nodes (8): needsSetup(), geminiConfigFromEnv(), receiveImage(), llamaCppConfigFromEnv(), selectProvider(), destinationLine(), environmentEditor(), waitingLine()

### Community 74 - "environment.check.ts"
Cohesion: 0.25
Nodes (7): describeEnvironment(), validateEnvironment(), image, material, provider, stored, style

### Community 76 - "VisionBridge.ts"
Cohesion: 0.25
Nodes (5): GameEventSink, InstructionHoldOptions, OpenTask, OUTCOME_MAP, VisionBridgeOptions

### Community 78 - "WorldSource"
Cohesion: 0.33
Nodes (3): StepContext, WorldSource, SnapshotInput

### Community 79 - "world.capture.ts"
Cohesion: 0.33
Nodes (5): out, snapshot, w, world, SNAPSHOT_PATH

## Knowledge Gaps
- **263 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+258 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 486 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `three` to `pack.check.ts`, `World.ts`, `templates/types.ts`, `worldSnapshot.ts`, `package.json`, `proceduralHouse.ts`, `MemoryPack.ts`, `environment.check.ts`, `telemetry.check.ts`, `agent-review.check.ts`, `LocalProfile.ts`, `main.ts`, `world.check.ts`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `boot()` connect `boot` to `MissionRunner`, `proceduralHouse.ts`, `MemoryPack.ts`, `Player`, `Telemetry`, `State`, `Interaction`, `agent-gemini.check.ts`, `PackVoices`, `three`, `LocalProfile.ts`, `telemetry.check.ts`, `Quality.ts`, `loadMedia`, `main.ts`, `Renderer`, `validate`, `createCameraIntegration`, `World.ts`, `EnvironmentEditor.ts`, `CameraIntegration`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `createCameraIntegration()` connect `createCameraIntegration` to `.showHint`, `boot`, `InstructionHold`, `camera/types.ts`, `CameraUI`, `main.ts`, `AdaptationPolicy`, `integration.ts`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _263 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pack.check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11255411255411256 - nodes in this community are weakly interconnected._
- **Should `Three levels` be split into smaller, more focused modules?**
  _Cohesion score 0.0896551724137931 - nodes in this community are weakly interconnected._