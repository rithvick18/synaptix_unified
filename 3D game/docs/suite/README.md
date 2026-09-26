# Reminiscence Therapy Suite

"Reminiscence Therapy Suite" is product branding. The suite is an activity space for looking at familiar places, objects, photographs and sounds together, with a caregiver. It is not a clinically validated treatment, it does not diagnose, and it makes no claim about medical outcomes.

## What it is

The suite is the first screen of Memoria 3D, and it works in five steps:

1. **Who.** Choose a saved caregiver profile, or the generic demo. The demo has no personal information and is labelled "Demo" everywhere.
2. **Where.** Choose a content pack and an environment:
   - *Everyday home* is the default. It is a general starting point and is not tied to any region. It has three environments: a living room, a kitchen with a dining area, and a courtyard with a veranda.
   - *Northeast home* is optional and regional, and is never chosen automatically. It has two environments: a living room and a veranda. They include a gamosa, a jaapi and a xorai, with descriptions checked against sources.
3. **What.** Choose an activity: photo exploration, familiar objects, sound and memory, familiar space, or a guided sequence.
4. **Explore.** Every prompt is optional and shown as text, and can be replayed. Next, Skip, Previous, Pause, Close-up and Exit are always available. There is a caregiver panel for notes. No timers, no scores, and no right or wrong answers.
5. **Summary.** The summary is factual: what was looked at, prompts played and replayed, skips, duration and notes. Camera numbers appear in a separate block labelled as describing the camera, not the person.

The existing guided tasks, which are levels with caregiver-set answers, are unchanged. They are reached from the suite's home screen, or opened first with `?start=tasks` or `?patient=`.

## Guides

| Topic | Document |
|---|---|
| Plan, architecture and conventions | [PLAN.md](PLAN.md) |
| Adding an asset or an environment | [assets.md](assets.md) |
| Adding a content pack | [content-packs.md](content-packs.md) |
| Adding an activity | [activities.md](activities.md) |
| Adding a language, and translation coverage | [languages.md](languages.md) |
| Caregiver personalization | [personalization.md](personalization.md) |
| Controls and accessibility | [accessibility.md](accessibility.md) |

## Language coverage

This is the actual coverage, not a claim to support every Indian language.

| Language | UI strings | Pack text | Status |
|---|---|---|---|
| English | 461/461 | complete | source |
| Hindi | 461/461 | complete | **machine-generated; needs fluent human review** |

No other language is registered. The language selector lists only these two.

## Verification (2026-09-26, macOS, Node 26, headless Chrome with the SwiftShader software renderer)

| Check | Result |
|---|---|
| `npm run check` | 17 suites passed, typechecked against `src/`: the 13 existing suites, unchanged and still passing, plus 4 new ones below |
| `suite-assets` | 752 assertions. The manifest is valid. All 76 assets build and have English and Hindi labels, thumbnails and licences. Both packs load with their slots checked. All 5 environments build with no missing asset, unknown slot or rejected placement. Every viewpoint is walkable and clear. Hindi relabelling works, and dispose releases geometry. |
| `suite-activities` | 413 assertions. Pack validation. Every prompt has English and Hindi, and a banned-word scan (wrong, correct, remember?, score, dementia and others) finds nothing. The session lifecycle covers start, replay, next, skip, previous, pause excluded from time, exit and notes. The camera hooks: `requestHint` is always false, one gentle cue per item, and a held prompt is dropped when the item changes. Also covered: avoid-topics, availability rules, and failing audio never blocking progress. |
| `suite-profile` | 167 assertions. Profile defaults and migration, media limits, a blob round-trip, locale parity between English and Hindi, placeholders, fonts, and i18n fallback and plurals. |
| `suite-app` | 491 assertions. Settings, navigator clamps and reduced motion, walk collision, the vision-note calculation, WCAG contrast (worst text pair 6.66:1 by default and 13.58:1 in high contrast), keyboard, and audio fallback. |
| `npm run build` | passes |
| `node tools/suite/browser-check.mjs` | **60 passed** against the built app. Checked in the browser:<br>• the suite is the first screen and shows the branding and disclaimer<br>• all 5 environments build with every asset<br>• five build-and-exit cycles release their geometries and textures<br>• all 5 activities start in the demo, and demo items are never marked personal<br>• replay, skip, pause (which also pauses the game clock), resume, note and finish all work<br>• the summary counts correctly and has no score fields, and has no camera block when the camera was off<br>• the photo close-up uses `object-fit: contain`<br>• Hindi switches the UI to Devanagari<br>• there is no horizontal scroll at 360 px or 1280 px<br>• `?start=tasks` still opens the three guided levels, and they lead back to the suite<br>• no uncaught exceptions |

This run found and fixed one bug: demo pictures on frames were flagged as personal content.

### Not verified here

- **Human review:**
  - The Hindi has not been reviewed by a fluent speaker.
  - Nobody has listened to the synthesized sounds by ear; they were checked by loudness and spectrogram only.
- **Real devices:**
  - No physical device testing: real phones and tablets, touch hardware, or screen readers.
  - No GPU performance figures on a demonstration machine. Headless Chrome used a software renderer.
  - Speech synthesis and recorded caregiver audio with real voices. Headless Chrome is muted.
  - The camera with a real face during suite activities. The camera integration's own checks (`camera.check.ts`, 130 assertions) pass, and the suite drives the same `AdaptableRunner` hooks.
- **Not re-run for this change:** `npm run check -- --full` at the repository root, `check:offline`, `check:profile` and `scripts/camera-e2e.mjs`. Their URLs were updated to `?start=tasks`, because the suite is now the first screen.
- **Outcomes:** no clinical or outcome evaluation of any kind.

## Known limitations

- **Profiles:** there is one saved profile per browser, the existing store's model. A profile saved from Home personalisation is picked up after the page reloads, which that editor already does.
- **Photo sizes:** the photo surfaces are fixed per environment: 6 in each living room, and 2 in the kitchen and verandas.
- **Content:**
  - The starter content does not cover every Indian community, region, religion or household.
  - The Northeast pack is one small, optional example.
  - No pack ships recorded prompt audio: prompts use speech synthesis where a voice exists, and otherwise text only.
- **Editor:** there is no editor UI for per-photo or per-sound topics, although the data model supports them.
- **Build:** Vite's chunk-size warning for the main bundle remains, as before.
