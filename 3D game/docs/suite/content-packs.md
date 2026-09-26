# Content packs

A content pack is a folder under `public/suite/packs/<id>/` that gives the suite its
rooms, prompts, sounds and demo pictures. Two packs ship:

| Pack | Regional | Environments | Notes |
|---|---|---|---|
| `everyday-home` | no (the default) | `living-room`, `kitchen-dining`, `courtyard-veranda` | Generic, pan-India. No religious objects. |
| `northeast-home` | yes, optional | `ne-living-room`, `ne-veranda` | Adds the gamosa, jaapi, xorai and a bamboo basket. Never chosen automatically. |

The loader is `loadContentPacks(library, load?)` in `src/suite/content/index.ts`. It
never throws for bad content: each problem becomes a `ContentProblem`, and a pack with
errors is still returned so a caregiver can see why it is not offered. The app offers
only error-free packs.

## Files

```
public/suite/packs/
  index.json                  { "schema": 1, "packs": [{ "id", "path" }] }  (first non-regional pack is the default)
  <id>/pack.json              metadata: name, description, status, regional, coverageNote, tags, files, authors
  <id>/environments.json      rooms: a shell and its placements (environment module)
  <id>/content.json           prompts, sounds, decorative pictures (this document)
  <id>/assets.json            optional pack-local AssetDefs, added through library.addPackAssets
  <id>/sounds/*.mp3           packaged sounds
  <id>/images/*.webp          packaged demo pictures
```

All types are in `src/suite/contracts.ts` (`ContentPackMeta`, `PackEnvironments`,
`PackContent`, `PromptDef`, `SoundDef`, `DecorativeImageDef`).

### To add a pack

1. Create `public/suite/packs/<id>/` with `pack.json`, `environments.json` and
   `content.json`, and add `{ "id": "<id>", "path": "<id>/pack.json" }` to `index.json`
   (the primary integration layer owns those two files).
2. Write every piece of text as a language map with English: `{ "en": "…", "hi": "…" }`.
   A plain string is only for a caregiver's own words.
3. Run `node tools/suite/run-check.mjs tools/checks/suite-activities.check.ts`. The
   loader's rules are in `src/suite/content/validate.ts`.

## content.json

```jsonc
{
  "schema": 1,
  "prompts": [
    {
      "id": "a-clock",
      "appliesTo": { "assets": ["clock-wall", "clock-table"] },   // and/or "categories", "activities"
      "text": { "en": "Would you like to say something about this clock?", "hi": "…" },
      "topics": ["home"]
    }
  ],
  "sounds": [
    {
      "id": "snd-wall-clock", "label": { "en": "Wall clock" }, "description": { "en": "…" },
      "path": "sounds/snd-wall-clock.mp3", "mime": "audio/mpeg", "durationMs": 10056,
      "topics": ["home"], "synthesized": true,
      "provenance": { "source": "project-generated", "author": "Memoria project", "license": "CC0-1.0", "modified": "…" }
    }
  ],
  "images": [
    {
      "id": "pic-river-dusk", "path": "images/pic-river-dusk.webp", "width": 1200, "height": 675,
      "alt": { "en": "An illustration of a river at dusk, …" },
      "kind": "decorative-generated",
      "notice": { "en": "Demo picture — an illustration, not a real place or memory" },
      "provenance": { "source": "project-generated", "author": "Memoria project", "license": "CC0-1.0" }
    }
  ]
}
```

### How `appliesTo` is matched

For each item the activity picks, in this order:

1. the caregiver's own prompt (`objectPrompt`, or a photo's or sound's prompt);
2. a pack prompt whose `assets` include the object's asset. For a **sound** item, only
   asset prompts that list `"sound"` in `activities` are used (the object is linked
   through its asset's `soundId`, e.g. the wall clock and `snd-wall-clock`);
3. a pack prompt whose `categories` include the object's category, and whose
   `activities` (if given) include the running activity;
4. a pack prompt with only `activities`, matched on the item's own kind (`photo`,
   `sound`, `space`). A sound prompt with topics is used only for a sound that shares
   one of those topics ("…the weather…" goes with rain, not with a train);
5. a generic prompt from `public/suite/locales/<lang>/activities.json`
   (`activities.generic.<kind>.<n>`).

Prompts touching a topic on the caregiver's avoid-list are never chosen. Within a level,
prompts sharing a topic the caregiver wants to include come first, then the least-used
one, so the wording varies from item to item.

### Validation rules

The loader reports:

- **Schema and ids:** `schema: 1`, and ids unique within prompts, sounds, images,
  environments and placements.
- **Language:** `en` present and non-empty in every `LocalizedText`, and a valid code for
  every language.
- **Provenance:** `source`, `author` and `license`, where the licence is an accepted SPDX
  id (`SPDX_LICENSES` in `validate.ts`; `unknown` is never accepted). A `url` is https
  and is only a record, never fetched.
- **Local media:** sound, image and prompt-audio paths are local files under
  `public/suite/packs/`, with no scheme, no leading slash, and no `..` above `packs/`. A
  pack may reuse another pack's files. `northeast-home` uses
  `../everyday-home/sounds/…`.
- **Prompts:** `appliesTo` names at least one of `assets`, `categories` or `activities`.
  Categories and activities must be real. An unknown asset is a warning, because the
  prompt simply never matches.
- **Placements:** the asset is known (an error otherwise); `image` is one of the pack's
  decorative images; and, when shell slots are passed
  (`loadContentPacksWithShells(library, load, { shells })`), the slot exists and its
  mount fits the asset. Without shell data there is one warning per pack, and the scene
  builder still reports unknown slots.
- **Topics:** unknown topics are warnings, because an avoid-list could not remove them.
  The vocabulary is `TOPICS` in the contracts.
- **Regional packs:** `regional: true` requires `tags.regions`, and region tags require
  `regional: true`. A regional pack first in `index.json` is a warning.
- **`coverageNote`:** required. It is an honest statement of what the pack does and does
  not cover.

## Tone rules for prompts

- A prompt is an **invitation, never a test**: "Would you like to tell us about this?",
  "Does this bring anything to mind?", "Is there a sound you would like to talk about?",
  "We can come back to this whenever you like."
- **Never ask for a fact with an answer.** No "What year…?", "Who is this?" or "Do you
  remember…?". No "wrong", "correct", "try again", "forgot", "score", "points" or "well
  done", and no clinical words (dementia, patient, symptom, diagnosis, cognitive,
  treatment, cure). The check scans every English prompt and `activities.json` for these.
- **Never assume** a religion, region, caste, language, family structure, gender role,
  diet or history. Do not assume someone cooked, went to school, travelled by train or
  kept a particular festival: write "if you'd like" or "anything this brings to mind".
- Prompts that touch **faith or festivals carry those topics**, so an avoid-list removes
  them. The same goes for food, school, work, travel, music and family.
- **Regional prompts never universalise.** Write "Some homes in the region keep a
  gamosa…", never "Your family used a gamosa". Keep region-specific facts to what a
  source says, and list the sources. The Northeast prompts use:
  - https://en.wikipedia.org/wiki/Gamosa: white, rectangular, with a red border; given
    to welcome guests.
  - https://en.wikipedia.org/wiki/Jaapi: a conical hat of bamboo or cane and palm
    leaves; shade from sun and rain.
  - https://en.wikipedia.org/wiki/Xorai: a tray on a pedestal, of bell metal or brass;
    used to offer things to guests and in ceremonies. It is tagged `faith`,
    `festivals` and `community`.

  These were checked on 2026-09-25.
- Hindi is **machine-generated and needs review** by a fluent speaker. Never describe
  it as reviewed.

## Demo pictures

- Demo pictures are **illustrations**, flat and clearly stylised. They contain no people
  (at most tiny silhouettes), no text, no flags, no religious symbols, and no
  recognisable real place or event. None may look like a photograph of a real person or
  event, and none is presented as historical or as anyone's memory.
- Every picture carries a visible `notice` ("Demo picture — an illustration, not a real
  place or memory") in every language. `packDisplayMedia` sets `personal: false` and
  `people: []`, and resolves the notice through i18n.
- Demo pictures are **only for the generic demo**. A saved profile's photo and sequence
  activities show only the caregiver's photographs, and never fill gaps with demo
  pictures.
- Mix aspect ratios so letterboxing is exercised: the shipped set has 16:9, 4:3, 3:4 and
  one square. Keep about 1200 px on the long edge and 120 KB or less, in WebP.
  In-scene textures are downscaled to 1024 px or less, in sRGB.

## Sounds

- Sounds are **made by `tools/suite/content/make-sounds.mjs`**, pure Node synthesis with
  seeded random numbers, then encoded with `lame`. Each is mono, 24 kHz, 48 kbit/s,
  4–15 s and 150 KB or less, at about -18 LUFS with sample peaks at -3 dBFS or below,
  and has soft fades. The wall clock is quieter (about -23 LUFS) because its ticks are
  very peaky.
- Each `SoundDef` has `synthesized: true` and project-generated CC0-1.0 provenance.
  Never use macOS `say` or any other text-to-speech output, whose licences do not allow
  redistribution, and never download sounds.
- `loop: true` marks the rain and fan sounds, which crossfade into themselves. MP3
  encoder padding can leave a short gap at the loop point.

## Regenerating

```sh
node tools/suite/content/make-sounds.mjs          # sounds → packs/everyday-home/sounds/
python3 tools/suite/content/make-images.py        # pictures → packs/<pack>/images/
node tools/suite/content/build-content.mjs        # both content.json files (reads durations and sizes from the files)
node tools/suite/run-check.mjs tools/checks/suite-activities.check.ts
```

The prompt, sound and picture tables live in `build-content.mjs`. Edit them there and
regenerate, rather than editing the two `content.json` files by hand.
