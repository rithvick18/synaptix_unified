# Graph Report - 3D game  (2026-09-23)

## Corpus Check
- 82 files · ~140,661 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 2 file(s) not represented in the graph (top: .example 1, (none) 1)

## Summary
- 1085 nodes · 2378 edges · 63 communities (42 shown, 21 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 84 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `dcebd65c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- perf-templates.mjs
- pack.check.ts
- HintBeacon
- MissionRunner
- Three levels
- types.ts
- ChoiceCard
- boot
- package.json
- proceduralHouse.ts
- Missions.ts
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
- main.ts
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
- authoring.ts
- review.ts
- LocalProfile.ts
- agent-images.check.ts
- firewall.ts
- profile-check.mjs
- telemetry.check.ts
- agent-review.check.ts
- agent-provenance.check.ts
- MemoryPack.ts
- agent-provider.check.ts
- Quality.ts
- gemini.ts
- PlacedPlayer
- loadMedia
- loadPack
- selectProvider.ts
- Q: How do uploaded images modify the game environment?
- proposals.fixtures.ts
- Renderer
- ToolResult
- validate
- Rig
- FakeUI
- State.ts

## God Nodes (most connected - your core abstractions)
1. `boot()` - 89 edges
2. `MissionRunner` - 33 edges
3. `buildHouse()` - 32 edges
4. `UI` - 28 edges
5. `Telemetry` - 25 edges
6. `Player` - 23 edges
7. `State` - 19 edges
8. `ReviewSession` - 19 edges
9. `three` - 17 edges
10. `loadMedia()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `ctx()` --calls--> `buildAllowedTokens()`  [EXTRACTED]
  tools/checks/agent-provenance.check.ts → src/agent/tokens.ts
- `run()` --calls--> `styleMaterial()`  [EXTRACTED]
  tools/profile-browser.check.ts → src/EnvironmentMaterials.ts
- `mutate()` --calls--> `validate()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts
- `mediaFor()` --calls--> `loadMedia()`  [EXTRACTED]
  tools/checks/pack.check.ts → src/MemoryPack.ts
- `Rig` --references--> `MissionRunner`  [EXTRACTED]
  tools/checks/pack.check.ts → src/Missions.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Three levels in one caregiver pack** — spec_memory_pack, spec_water, spec_morning_walk, spec_familiar_memories [EXTRACTED 1.00]

## Communities (63 total, 21 thin omitted)

### Community 0 - "perf-templates.mjs"
Cohesion: 0.18
Nodes (9): chrome, evaluate(), ONLY, pending, profile, REPO, rows, send() (+1 more)

### Community 1 - "pack.check.ts"
Cohesion: 0.14
Nodes (13): PackProblem, failures, fakeCtx, FakeImage, fakeLoad(), LoadFn, makeWorld(), MISSING (+5 more)

### Community 3 - "MissionRunner"
Cohesion: 0.18
Nodes (4): instructionOf(), MissionRunner, stopSpeaking(), Outcome

### Community 4 - "Three levels"
Cohesion: 0.09
Nodes (30): Deployment incomplete, Vercel and Netlify static hosting, Poly Haven runtime textures and HDRI, Smriti HTML entry, Smriti debug handle, Mira and Raju fictional demo packs, Headless and offline checks, Personalisation anchors (+22 more)

### Community 5 - "types.ts"
Cohesion: 0.08
Nodes (51): ARCH_HEIGHT, CEILING_HEIGHT, DOOR_HEIGHT, EXT_WALL_T, INT_WALL_T, PLAYER_BODY_MAX_Y, PLAYER_BODY_MIN_Y, PLAYER_RADIUS (+43 more)

### Community 7 - "boot"
Cohesion: 0.15
Nodes (3): boot(), escapeText(), UI

### Community 8 - "package.json"
Cohesion: 0.08
Nodes (22): dependencies, three, devDependencies, @types/node, @types/three, typescript, vite, name (+14 more)

### Community 9 - "proceduralHouse.ts"
Cohesion: 0.07
Nodes (53): EnvironmentStyle, colourFor(), styleAnisotropy(), styleMaterial(), stylesSurface(), addSkirting(), auditDoorways(), auditReachability() (+45 more)

### Community 10 - "Missions.ts"
Cohesion: 0.14
Nodes (16): applyNonLevelProposal(), AssetUrlResolver, buildPackFromProposals(), LoadedPack, ChoiceFormat, DemoNotice, FindStep, HINT_DELAYS_MS (+8 more)

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
Cohesion: 0.09
Nodes (29): colors, describeEnvironment(), ENVIRONMENT_TOOL, validateEnvironment(), LlamaCppProviderAdapter, anchorLines(), assetLines(), AUTHORING_REASONING (+21 more)

### Community 19 - "agent-gemini.check.ts"
Cohesion: 0.10
Nodes (25): AgentConfig, AgentProvider, applySetupMode(), consentPromptFor(), defaultModelForMode(), ensureConsent(), isAgentProvider(), isSetupMode() (+17 more)

### Community 20 - "run.mjs"
Cohesion: 0.20
Nodes (9): checks, esbuild, filter, here, out, root, three, threeExamples (+1 more)

### Community 22 - "world.check.ts"
Cohesion: 0.05
Nodes (44): Focus, SwappedMaterial, StepContext, ANCHOR_PLATE, HouseWorld, assertWorldContract(), InteractableMeta, readMeta() (+36 more)

### Community 23 - "checks/tsconfig.json"
Cohesion: 0.29
Nodes (6): ../../tsconfig.json, compilerOptions, noEmit, types, extends, include

### Community 24 - "main.ts"
Cohesion: 0.13
Nodes (16): three, describeSetup(), describe(), FocusProbe, percentile(), PerfResult, breakagesFromLocation(), patientIdFromLocation() (+8 more)

### Community 26 - "tools.ts"
Cohesion: 0.14
Nodes (21): construct(), dispatch(), ScriptedCall, ScriptedToolName, ChoiceType, FindStepProposal, hints, LevelProposal (+13 more)

### Community 37 - "llamaCpp.ts"
Cohesion: 0.17
Nodes (18): classifyStatus(), classifyThrown(), friendlyMessage(), imageBlock(), isLoopback(), isRetryable(), ParsedEnvelope, parseEnvelope() (+10 more)

### Community 38 - "authoring.ts"
Cohesion: 0.20
Nodes (18): matchesType(), missingArgument(), runAuthoringPass(), SkippedCall, toProposals(), asNode(), buildProposalGrammar(), jsonKey() (+10 more)

### Community 39 - "review.ts"
Cohesion: 0.14
Nodes (15): ConsentPrompt, Violation, ProposalStatus, ReviewedProposal, ReviewSession, CropHandles, ProposalReviewList, renderProvenanceSummary() (+7 more)

### Community 40 - "LocalProfile.ts"
Cohesion: 0.11
Nodes (35): agentConfigStore, needsSetup(), geminiConfigFromEnv(), llamaCppConfigFromEnv(), destinationLine(), environmentEditor(), waitingLine(), Crop (+27 more)

### Community 41 - "agent-images.check.ts"
Cohesion: 0.11
Nodes (16): ACCEPTED_MIME, dimensionsFor(), encode(), ImageDerivatives, ImagePipelineError, ImagePipelineErrorReason, nextPowerOfTwo(), receiveImage() (+8 more)

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

### Community 46 - "agent-provenance.check.ts"
Cohesion: 0.18
Nodes (7): FirewallContext, ProposalFixture, computeProvenance(), ProvenanceBlock, ReviewCounts, ctx(), failures

### Community 47 - "MemoryPack.ts"
Cohesion: 0.23
Nodes (9): CardStyle, fitToPlate(), injectAnchors(), Json, LoadOptions, MediaOptions, plateOf(), REDUCE_SENTINEL (+1 more)

### Community 48 - "agent-provider.check.ts"
Cohesion: 0.13
Nodes (8): AuditEntry, AuditLog, AuditSink, consoleAuditSink, CONSENT_PROMPT, failures, REQUEST, WITH_IMAGE

### Community 49 - "Quality.ts"
Cohesion: 0.12
Nodes (15): AdaptiveOptions, AdaptiveResolution, AdaptiveStep, clampRatio(), detectQuality(), detectTier(), DeviceInfo, isSmall() (+7 more)

### Community 50 - "gemini.ts"
Cohesion: 0.22
Nodes (14): ALLOWED_HOSTS, classifyStatus(), classifyThrown(), friendlyMessage(), imagePart(), InteractionStep, isGoogleEndpoint(), isRetryable() (+6 more)

### Community 52 - "loadMedia"
Cohesion: 0.22
Nodes (7): loadAudio(), loadImage(), loadMedia(), loadTexture(), PackMedia, placeholderTexture(), mediaFor()

### Community 53 - "loadPack"
Cohesion: 0.40
Nodes (3): loadPack(), PackRejected, resolvePackPath()

### Community 54 - "selectProvider.ts"
Cohesion: 0.21
Nodes (11): DEFAULT_GEMINI_MODEL, GeminiConfig, GeminiProviderAdapter, LlamaCppConfig, ProviderAdapter, EMPTY_STUB_SCRIPT, NullProviderAdapter, selectProvider() (+3 more)

### Community 56 - "Q: How do uploaded images modify the game environment?"
Cohesion: 0.40
Nodes (4): Answer, Outcome, Q: How do uploaded images modify the game environment?, Source Nodes

### Community 57 - "proposals.fixtures.ts"
Cohesion: 0.15
Nodes (14): DEFAULT_AGENT_CONFIG, baseContext(), CAREGIVER_FIELDS, CAREGIVER_TEXTS, makeAssets(), makeWorld(), PROPOSAL_FIXTURES, sparseContext() (+6 more)

### Community 60 - "ToolResult"
Cohesion: 0.33
Nodes (3): AuthoringRun, StubModel, ToolResult

### Community 61 - "validate"
Cohesion: 0.52
Nodes (4): isObject(), Problems, validate(), validateStep()

### Community 64 - "Rig"
Cohesion: 0.17
Nodes (5): Event, FakePlayer, FakeState, FakeVoices, Rig

### Community 70 - "State.ts"
Cohesion: 0.33
Nodes (5): GameState, MOVEMENT_ENABLED, POINTER_LOCK_WANTED, StateListener, TIMERS_RUN

## Knowledge Gaps
- **233 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+228 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 384 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `three` connect `main.ts` to `pack.check.ts`, `types.ts`, `package.json`, `proceduralHouse.ts`, `Missions.ts`, `LocalProfile.ts`, `telemetry.check.ts`, `agent-review.check.ts`, `MemoryPack.ts`, `agent-prompts.check.ts`, `world.check.ts`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `boot()` connect `boot` to `MissionRunner`, `types.ts`, `proceduralHouse.ts`, `Player`, `Telemetry`, `State`, `Interaction`, `agent-gemini.check.ts`, `PackVoices`, `world.check.ts`, `main.ts`, `LocalProfile.ts`, `telemetry.check.ts`, `MemoryPack.ts`, `Quality.ts`, `loadMedia`, `loadPack`, `Renderer`, `validate`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `MissionRunner` connect `MissionRunner` to `Rig`, `pack.check.ts`, `HintBeacon`, `ChoiceCard`, `boot`, `Missions.ts`, `telemetry.check.ts`, `main.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Are the 49 inferred relationships involving `boot()` (e.g. with `.activate()` and `.clear()`) actually correct?**
  _`boot()` has 49 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _233 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `pack.check.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1437908496732026 - nodes in this community are weakly interconnected._
- **Should `Three levels` be split into smaller, more focused modules?**
  _Cohesion score 0.0896551724137931 - nodes in this community are weakly interconnected._