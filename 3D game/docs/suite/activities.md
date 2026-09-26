# Activities

`src/suite/activities/index.ts` exports:

- `ACTIVITIES`, the registry of the five activities;
- `createActivitySession`, which runs one activity;
- `assignPhotos`, which decides which photo each frame or album shows;
- `gentleCueShown(session)`, which is true while the soft "Take your time — there's no
  hurry" line should show;
- `buildSummary`.

The activities' strings are in `public/suite/locales/<lang>/activities.json`, read as
`t('activities.<path>')`.

## The no-scoring rule

Reminiscence is open-ended. Nothing in an activity has a correct answer, a timer, a
countdown, a score, a tally or a pass mark, and nothing reads silence, looking away,
skipping or ending early as anything. Every prompt is optional text: moving on never
needs an answer, the microphone, or recall. The only scored tasks in Memoria are the
existing guided tasks (`src/Missions.ts`), which are separate and labelled as having
known answers.

The session summary (`SessionSummary`) is factual. It lists the items and objects looked
at, the prompts played and replayed, the sounds played, close-ups, skips, the time spent
(pauses excluded) and the caregiver's notes. An early exit is recorded as
`endedBy: 'exited'` and labelled "Ended before the last item". `vision` is always null
from the session; the app fills it in, in a separate, labelled block.

## The five activities

| Kind | Items | Unavailable when (reason key) |
|---|---|---|
| `photo` | A saved profile's photos (personal). The generic demo shows the pack's demo pictures. | `noPhotos` for a saved profile with no photos (points to caregiver setup); `photosAvoided` when all are removed by avoid-topics; `noDemoPictures` |
| `object` | Scene objects whose `activities` include `'object'`, in placement order. | `noObjects` |
| `sound` | The profile's sounds (personal) first, then the pack's sounds (synthesized). | `noSounds` |
| `space` | A room overview item, then the highlighted objects as a gentle tour. With nothing highlighted, the first six objects with `'space'`. | never |
| `sequence` | A saved profile's `sequence` (photos, `envId/placementId` objects, sounds). Objects from other rooms are left out. The demo has 3 highlighted objects, 1 demo picture and 1 pack sound. | `noSequence`; `sequenceUnresolved` |

A personal session is never filled with demo pictures. `topics.avoid` removes objects,
photos, sounds and prompts everywhere. `topics.include` only reorders prompts.

The reason keys are `activities.unavailable.<key>`. The names and descriptions are
`activities.names.<kind>` and `activities.descriptions.<kind>`. The item kind labels are
`activities.kinds.*`: "Your photo", "Demo picture", "Sound from this pack
(synthesized)" and "Caregiver recording". The summary labels are
`activities.summary.*`.

### Prompt order

For each item, the prompt comes from, in order:

1. the caregiver's prompt;
2. the pack prompt for the asset;
3. the pack prompt for the category and activity;
4. the pack prompt for the item kind;
5. a generic prompt from `activities.json`.

See [content-packs.md](content-packs.md) for the matching rules.

## The session

`createActivitySession({ definition, context, audio, telemetry, now? })` implements
`ActivitySessionApi`:

- **Clock.** The only clock is the injected `now()` (default `performance.now`). Paused
  time is excluded from every log `t`, from `stepAgeMs` and from `durationMs`. There are
  no timers.
- **Showing an item.** Showing an item logs `item_shown` and calls
  `telemetry.stepStart(index, 'reminisce-<kind>')`. The prompt then goes to
  `audio.playPrompt`. If `adaptable.instructionGate` is set, the prompt waits for the gate
  to call back, and it is dropped if the item has changed or the session is paused.
  `prompt_played` is logged with `via` (`audio`, `speech` or `text-only`). A rejected or
  throwing `playPrompt` counts as `text-only`, and nothing ever waits on audio.
- **Moving through items.**
  - `next()` and `previous()` never record a skip. `skip()` logs `item_skipped`.
  - Moving past the last item finishes the session.
  - `goTo(itemId)` jumps to an item.
  - Navigation is ignored while paused.
- **Free exploration.** `selectObject(id)` is always possible. An object in the list
  goes to its item. Any other object becomes a free item, with `index` -1 and a fresh
  telemetry step numbered `items.length + n`. `next()` and `previous()` then continue
  the list from where it was left.
- **Sounds.** `playSound()` plays the current sound item, or the pack sound linked to the
  current object (its `soundId`). It is never automatic, so a prompt and a sound do not
  talk over each other.
- **Pause and resume.** These pause and resume the audio and telemetry, and log
  `paused` and `resumed`.
- **Ending.**
  - `exit()` ends early and `finish()` ends normally. Both return the summary.
  - Both are idempotent: after the first call, they return that call's summary.
  - A note added afterwards with `addNote()` is still added to the summary.
  - A prompt still resolving when the session ends is not logged.
- **Telemetry.**
  1. At start: `missionStart('suite-<kind>')`.
  2. For each item: `stepStart(step, 'reminisce-<kind>')`, then
     `stepEnd(step, 'reminisce-<kind>', 'skipped')` when it is left.
  3. At the end: `missionComplete('suite-<kind>')`. If the session is ended while
     paused, `resume()` is sent first.

## How camera timing interacts

`session.adaptable` is the narrow surface the camera layer drives
(`host.camera.attach(session.adaptable)`, see `src/camera/integration.ts`):

- `active` is true between start and end.
- `current` is `{ type: 'reminisce-<kind>' }` or null.
- `stepIndex` is the open telemetry step. That is the list index for list items, which
  keeps the service's task ids in line with the telemetry.
- `stepAgeMs` excludes paused time.
- `level` is always 0.
- `instructionGate` can **hold a new prompt's speech**, as described under "Showing an
  item". The text is on screen throughout either way.
- `gentleCue()` offers **one gentle re-offer per item**, and only while not paused. It
  logs `gentle_cue`, notifies listeners (the UI shows `activities.gentleCue`: "Take your
  time — there's no hurry") and replays the prompt audio once. A second call on the
  same item returns false.
- `requestHint()` **always returns false**. Reminiscence has no hints and no answers.

Items end as `task_skipped` at the service boundary only because the service has no
neutral outcome. Nothing reads that as a result. Vision can only delay speech or add one
gentle cue. It never ends an item, never chooses content and never appears in the
summary's counts.

## Adding an activity

1. Add the kind to `ActivityKind` and `ACTIVITY_KINDS` in `src/suite/contracts.ts`. The
   primary integration layer owns that file, so ask for the change.
2. Add a definition to `ACTIVITIES` in `src/suite/activities/definitions.ts` with
   `define(kind, available, items)`:
   - `available(ctx)` returns `{ ok: true }` or `{ ok: false, reasonKey }`, with a key
     under `activities.unavailable`;
   - `items(ctx)` builds items with `objectItem`, `photoItem`, `soundItem` or
     `spaceItem`, using one `pickerFor(ctx)` so prompts vary;
   - `answerMode` stays `'open-ended'`.
3. Respect `avoidOf(ctx)` for every item. Never mix demo content into a personal
   session.
4. Add `activities.names.<kind>` and `activities.descriptions.<kind>`, and the generic
   prompts if the item kind is new, to both `activities.json` files.
5. Add pack prompts with `appliesTo.activities` including the kind, then extend
   `tools/checks/suite-activities.check.ts` and run it.

No new activity may add a timer, a score, a correct answer, or anything that reads a
person's silence or attention as a result.
