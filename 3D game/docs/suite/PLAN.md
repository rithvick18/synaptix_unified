# Reminiscence Therapy Suite — implementation plan and working agreement

"Reminiscence Therapy Suite" is product branding. The suite is an activity space for
exploring familiar places, objects, sounds and personal memories with a caregiver. It is
not a clinically validated treatment. It does not diagnose, and it does not claim improved
medical outcomes. No UI string, document or comment may claim otherwise.

The shared types are in `src/suite/contracts.ts`. Read that file first. It is owned by the
integration layer (the primary agent). If you need a change to it, say so in your final
report; do not edit it yourself.

## Flow

1. **Home.** Choose a saved profile, or the generic demo. Also here: language,
   comfort settings, caregiver setup, camera support (optional), and the existing guided
   tasks. Guided tasks are the old scored levels, relabelled as "tasks with known answers".
2. **Place.** Choose a content pack and one of its environments. Cards show thumbnails.
3. **Activity.** Choose from photo exploration, familiar objects, sound and memory,
   familiar space, or guided sequence.
4. **Explore.** The 3D scene with an activity panel: the prompt text (always shown),
   replay, skip or next, pause, close-up, exit, the object list, and the caregiver panel.
5. **Summary.** Factual only: items and objects visited, prompts played and replayed,
   skips, duration, and caregiver notes. Vision data sits in a separate, labelled block.

There are no timers, no scores and no correct or incorrect answers in the suite. The
existing guided tasks keep their behaviour and stay reachable, unchanged.

## Architecture

```
main.ts (boot, house, guided tasks) ──SuiteHost──▶ src/suite/app (SuiteApp)
                                                    ├─ i18n        loadI18n
                                                    ├─ assets      loadAssetLibrary
                                                    ├─ content     loadContentPacks, packDisplayMedia
                                                    ├─ environments buildSuiteScene, SHELLS
                                                    ├─ profile     suiteOf, resolveSuiteProfile, openCaregiverSetup
                                                    ├─ activities  ACTIVITIES, createActivitySession, assignPhotos
                                                    └─ app/audio   SuiteAudio (implements SuiteAudioApi)
camera/integration.ts ◀── attach(session.adaptable) ── the suite's session
```

- The suite builds its own small scene, one environment at a time, and adds it under
  `host.three.scene`. `host.setActive(true)` hides the house and stops the house loop's
  player and interaction. On exit the suite disposes its scene and calls `setActive(false)`.
- The suite does **not** use pointer lock, which keeps it touch friendly. Seated mode is
  the default: the camera sits at `scene.seat`, and choosing an object moves the view to
  `object.viewpoint`. That move is a gentle tween of 1.2 s or less, or an instant cut
  with reduced motion. Look-around by dragging is limited. Walk mode is optional: WASD or
  the arrow keys, with collision against `scene.blockers`, inside `scene.walkable`.
- Vision works through `host.camera.attach(session.adaptable)`. A reminiscence item is a
  service "task" only so that presentation timing works: the service holds a new prompt's
  speech, or offers one gentle re-offer of the same prompt. `requestHint()` always returns
  false. Items end as `task_skipped` at the service boundary, because the service has no
  neutral outcome. Nothing reads that as a result.

## File ownership

Only edit files you own. Create new files only inside your own directories. The 2D game
suite (`~/Desktop/2D game`) is outside this repository and must never be touched. Nothing
under `CAMERA/` may be edited.

| Owner | Files |
|---|---|
| **Primary (integration)** | `src/suite/contracts.ts`, `src/suite/paths.ts`, `src/main.ts`, `src/ui.ts`, `src/Player.ts`, `src/camera/**`, `index.html`, `vite.config.ts`, `package.json`, `public/suite/packs/index.json`, `public/suite/packs/*/pack.json`, root `README.md`, `3D game/README.md`, `docs/suite/PLAN.md`, `tools/offline-check.mjs`, `../scripts/**` |
| **Environment and assets** | `src/suite/assets/**`, `src/suite/environments/**`, `public/suite/assets/**`, `public/suite/packs/*/environments.json`, `public/suite/packs/*/assets.json`, `public/suite/packs/*/thumbs/**`, `tools/suite/assets/**`, `tools/checks/suite-assets.check.ts`, `docs/suite/assets.md` |
| **Activities and content** | `src/suite/content/**`, `src/suite/activities/**`, `public/suite/packs/*/content.json`, `public/suite/packs/*/images/**`, `public/suite/packs/*/sounds/**`, `public/suite/locales/*/activities.json`, `tools/suite/content/**`, `tools/checks/suite-activities.check.ts`, `docs/suite/content-packs.md`, `docs/suite/activities.md` |
| **Personalization and localization** | `src/suite/i18n/**`, `src/suite/profile/**`, `src/LocalProfile.ts` (additive: the optional `suite` field only), `public/suite/locales/index.json`, `public/suite/locales/*/common.json`, `public/suite/locales/*/setup.json`, `public/suite/fonts/**`, `tools/checks/suite-profile.check.ts`, `docs/suite/languages.md`, `docs/suite/personalization.md` |
| **3D experience and accessibility** | `src/suite/app/**`, `public/suite/locales/*/app.json`, `tools/checks/suite-app.check.ts`, `docs/suite/accessibility.md` |
| **Integration and QA** (runs after the others) | `tools/checks/suite-*.check.ts` additions, `tools/suite/browser-check.mjs`, `docs/suite/verification.md`, `docs/suite/README.md` |

## Conventions

- **TypeScript.** The project is strict, with `noUnusedLocals` and `noUnusedParameters`.
  three is pinned to `0.181.2`: use `three/examples/jsm/...` for add-ons, and `HDRLoader`,
  not `RGBELoader`. Import the contracts with `import type` where you can.
- **Typecheck.** Run `npx tsc --noEmit -p .` from `3D game/` and read only the errors in
  your own files. Other modules may be half written while you work.
- **Your check.** `node tools/suite/run-check.mjs tools/checks/<yours>.check.ts` runs one
  check without the project-wide typecheck. Follow the pattern in the existing checks:
  plain `ok(condition, label)` assertions, a printed count, and a non-zero exit on
  failure. Read files from `process.env.MEMORIA_ROOT`. There is no DOM in checks, so make
  your pure logic importable without one.
- **Strings.** Every new user-visible string comes from i18n: `i18n.t('<namespace>.<key>')`,
  with a `LocalizedText` in manifests and packs. Write English and Hindi for everything
  you add. Hindi counts as `machine-generated-needs-review`: never describe it as reviewed.
  Keys are nested JSON objects inside each namespace file, for example
  `public/suite/locales/en/app.json` → `{ "home": { "title": "…" } }` → `t('app.home.title')`.
- **Tone.** Use invitations, never tests: "Would you like to tell us about this?", "Take
  your time", "We can come back to this". Never use "wrong", "correct", "try again",
  "remember?", "you forgot", "score", "fail", "well done" as a grade, or any clinical term
  (dementia, patient, symptom, therapy outcome, cognitive score). The branding name is
  the only exception.
- **No invention.** Never generate supposed relatives, personal events, dates or places.
  Demo pictures are illustrations and say so on screen. Do not describe
  region-specific items with anything you have not checked; list your sources in
  `descriptionSources`.
- **Assets.** Keep everything local and packaged under `public/suite/`, with no runtime
  hotlinks. External files are allowed only with a verified redistributable licence
  (CC0-1.0 preferred; OFL-1.1 for fonts), recorded in the manifest's `provenance` and in
  `public/suite/assets/ATTRIBUTION.md`.
- **Performance budget** for one built environment on the `standard` tier: 180 draw calls
  or fewer, 250k triangles or fewer, 48 MB of GPU texture memory or less, and a build time
  under 1.5 s on a laptop. Use instancing or merging for repeated items and shared cached
  geometry and materials, and put shadows only on the few objects that need them. The
  `low` tier has no shadow maps.

## Fixed ids (so parallel work lines up)

**Packs.** `everyday-home` is the default and pan-India generic; it has environments
`living-room`, `kitchen-dining` and `courtyard-veranda`. `northeast-home` is optional
and regional (`regional: true`); it has environments `ne-living-room` and `ne-veranda`.

**Shells.** `livingRoom`, `kitchenDining`, `courtyardVeranda`.

**Sound ids** (content agent, `everyday-home/content.json`; the Northeast pack may reuse
them through its own content.json):
`snd-wall-clock`, `snd-pressure-cooker`, `snd-rain-roof`, `snd-birds-morning`,
`snd-bicycle-bell`, `snd-school-bell`, `snd-radio-tuning`, `snd-ceiling-fan`,
`snd-harmonium`, `snd-train`, `snd-sewing-machine`, `snd-water-pouring`.

**Decorative image ids** (content agent): `everyday-home` has `pic-river-dusk`,
`pic-hills-morning`, `pic-seaside`, `pic-flowers`, `pic-fruit-bowl` and `pic-train-window`.
`northeast-home` has `pic-hills-mist`, `pic-bamboo-grove` and `pic-paddy-fields`. All of
them are illustrations. None may look like a photograph of a real person or event.

**Asset ids.** The environment agent implements at least these; more are welcome. Region
tags apply only where noted.

| Category | Asset ids |
|---|---|
| photos-keepsakes | `frame-wall-large`, `frame-wall-small`, `frame-table`, `photo-album`, `letters-bundle`, `calendar-wall`, `clock-wall`, `clock-table` |
| furniture | `sofa-wood`, `armchair-cane`, `chair-wood`, `chair-plastic`, `stool-low`, `dining-table`, `coffee-table`, `side-table`, `bookshelf`, `wall-shelf`, `bench-veranda` |
| storage | `almirah-steel`, `cupboard-wood`, `trunk-tin`, `kitchen-rack` |
| textiles | `rug-durrie`, `floor-mat-woven`, `cushion-set`, `table-cloth` |
| kitchen-food | `pressure-cooker`, `steel-tumbler-set`, `steel-plate`, `tiffin-carrier`, `spice-box`, `rolling-board-pin`, `kadai`, `tawa`, `clay-water-pot`, `brass-vessel`, `kettle`, `jar-pickle`, `gas-stove`, `mortar-pestle` |
| plants-outdoor | `potted-plant-large`, `potted-plant-small`, `hanging-plant`, `flower-pots-row`, `bucket-mug`, `clothesline` |
| music-media | `radio-transistor`, `radio-valve`, `cassette-player`, `harmonium`, `television-crt` |
| school-work | `books-stack`, `school-slate`, `school-bag`, `sewing-machine`, `typewriter`, `ledger-pen` |
| travel | `suitcase-old`, `bicycle`, `umbrella` |
| hobbies-games | `carrom-board`, `chess-set`, `cricket-bat-ball`, `kite-spool`, `knitting-basket` |
| community | `newspaper-folded` |
| lighting | `ceiling-fan`, `table-lamp`, `hurricane-lantern` |
| decor | `wall-mirror`, `vase-flowers` |
| regional (northeast) | `gamosa` (textiles), `jaapi` (decor), `xorai` (kitchen-food), `bamboo-basket` (storage) |

The generic pack has no religious objects. Prompts that touch faith or festivals carry
those topics, so an avoid-list can remove them.

## Sequencing

1. Primary: contracts, paths, pack skeletons, this plan. Done before delegation.
2. In parallel: environment and assets, activities and content, personalization and
   localization, and 3D experience and accessibility. Each works against the contracts,
   runs its own check, and reports.
3. Primary: wires `main.ts`, resolves conflicts, runs the app and fixes integration
   issues.
4. Integration and QA: full checks, the browser check, responsive screenshots and
   documentation. The primary reviews the results and fixes what they find.
5. Primary: final diff review, including confirmation that nothing outside `3D game/`,
   the root README and `scripts/` changed, then the report.
