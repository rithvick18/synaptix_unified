# Personalization in the Reminiscence Therapy Suite

A caregiver can shape what the activity space shows with **Caregiver setup**
(`openCaregiverSetup` in `src/suite/profile/`). Everything is stored in the same local
profile that **Personalise Home** uses.

## What a caregiver can configure

| Area | What can be set |
|---|---|
| Profile | The profile display name. With no saved profile, a new one is created (`newProfile()`, `skipRecall: true`) and must pass `profileErrors`. |
| Language | The preferred language, chosen explicitly from `locales/index.json`. The translation status is shown beside it. |
| Place | A content pack and one of its environments, shown with the environment thumbnail when one exists. Regional packs sit in a separate "Optional regional packs" group with their coverage note, and are never selected automatically. "No preference" is allowed. |
| How a session starts | Open exploration or a guided sequence, and whether the caregiver panel (prompt list and notes) is shown by default. |
| Topics | Chips for topics to include and topics to leave out, from the fixed `TOPICS` list. A topic on both lists is left out. |
| Objects | For the chosen environment, per object: hide it, override the name or description shown, and add a prompt with an optional recording. |
| Photographs | Upload several at once. Each photograph has a caption, rows of people (name and relationship, typed only), an optional prompt with an optional recording, and an optional preferred frame (a placement in the chosen place that has a photo surface). Photographs can be replaced, removed and reordered. |
| Sounds | Upload files, or record with the microphone. Each sound has a title, a kind (familiar sound or voice message), and an optional prompt. Sounds can be replaced or removed. |
| Guided sequence | An ordered list of photographs, objects in the chosen place, and sounds, with add, up, down and remove. |

Photographs added in Personalise Home also appear in sessions, so they do not need to be
added twice:

- **Portraits** carry the name and relationship typed there.
- **The wall photograph** carries nothing extra.
- **The event photograph** carries its typed caption.

### Prompts

A prompt is the caregiver's own open question, stored with the language it was written in,
so that speech uses a matching voice. A recorded prompt plays instead of synthetic speech.
The prompt text is always shown on screen.

## Storage

- Everything is saved as the optional `suite` field of the existing `LocalProfile`, through
  the existing `profileStore.save`, in the browser's **IndexedDB** (database
  `memoria-caregiver-v1`). One transaction replaces the whole profile; if it fails, the
  previously saved profile stays intact.
- Photographs go through the existing `importPhoto`, which:
  - checks the type;
  - applies the EXIF orientation;
  - makes a runtime derivative (up to 2048 or 4096 px, depending on the profile's quality
    setting) and a 384 px thumbnail;
  - keeps **the original file unchanged**.
- Sounds are stored as the uploaded or recorded file. Their duration is measured by
  decoding the file in the browser.
- Profiles saved before the suite existed have no `suite` field. `suiteOf(profile)` gives
  them defaults without changing the stored profile. `suiteOf` also normalises stored
  data:
  - it drops unknown modes and topics, duplicate ids, sequence entries that point at
    missing items, and entries with no media at all, logging a warning for each;
  - it never rewrites caregiver text.
- Saving from Personalise Home keeps the freshest stored `suite` field
  (`src/ProfileEditor.ts`). Saving from Caregiver setup merges its settings into the
  freshest stored profile, so neither editor overwrites the other's work. If a
  *different* profile was saved in another tab in the meantime, Caregiver setup refuses to
  save and says so.

### Limits

| | Limit |
|---|---|
| Photographs | JPEG, PNG or WebP; 25 MB or less each; at most 60 |
| Sounds | MP3, M4A/MP4, WAV, OGG or WebM; 15 MB or less and 10 minutes or less each; at most 30 |
| Depth map | at most 512 px on the long edge, 1 byte per cell (typically under 300 KB), made on request |
| In-scene photo textures | 1024 px or less on the long edge (and never above the device's `maxTextureSize`), aspect kept, sRGB, made on demand and cached |

These limits are defined as `SUITE_LIMITS`, `validatePhotoFile` and `validateAudioFile` in
`src/suite/profile/model.ts`.

### Media that cannot be shown

A stored photograph or sound that fails to decode is **never dropped silently**:

- The editor keeps it, marks it "This could not be shown. Replace or remove it." (or
  "played" for sounds), and counts it in the footer.
- At session time, `DisplayPhoto.texture()` resolves `null` for such a photograph instead
  of throwing.

## Stepping into a photograph (memory room)

On each photograph card the caregiver can press **Make explorable**. The close-up then
offers **Step into the photo**: the picture is shown as a shallow 3D relief the viewer can
look around a little (pointer or arrow keys, at most ±14°, and none at all when the device
asks for reduced motion). It is a picture viewer, not a world: nothing outside the frame is
generated. The surround is a blur of the same photograph.

- The depth is worked out **on this device** by a small model (Depth Anything V2 Small,
  int8) run in a worker. The model and the ONNX runtime are served by the site itself.
  The photograph is never sent anywhere. Install them with `npm run setup:depth`; without
  them the editor says so and everything else works unchanged.
- Only a relative depth map is stored: `SuitePhoto.depth`, one byte per cell, at most
  512 px on the longer side (`src/suite/memoryRoom/depthStore.ts`). It is dropped if its
  size does not match, and cleared when the photograph is replaced.
- If depth is missing or the 3D view cannot start, the close-up shows the flat picture as
  before.
- It follows the rules below: the model is used for geometry only. Nothing is recognised,
  captioned or added.

### A custom session has no template place

When the chosen profile is a saved one with photographs, the session does not ask for a
template place. Its environment is the caregiver's own photographs:

- Home lists "Your photographs" in place of the place picker, then the activities.
- The photo activity opens each photograph straight into its memory room, with the
  caregiver's caption, people and prompt. Sounds and the guided sequence work as before.
- Activities that need a template room's objects (familiar objects, familiar space) are
  offered as "needs setup" and cannot be started.
- A photograph without a stored depth map has one worked out the first time it is stepped
  into (a few seconds, once per page load). "Make explorable" in Caregiver setup stores it
  so it is ready every time.
- The generic demo is unchanged and still uses the template places.

The scene behind the photographs is an empty, quiet space (`src/suite/memoryRoom/customScene.ts`).

## Privacy

- Everything a caregiver adds stays **in this browser on this device**, in IndexedDB.
  Nothing from Caregiver setup is uploaded or sent anywhere. Clearing the browser's site
  data removes it, as does **Delete Profile** in Personalise Home.
- The microphone is requested **only** when the caregiver presses a "Record" button. It is
  never requested on opening the editor, and never to test for support. The tracks are
  stopped as soon as recording ends, and when the editor closes. If permission is denied
  or recording is unavailable, a calm message suggests adding a sound file instead.
- Object URLs made for previews and sessions are revoked when the editor closes or when a
  session's `SuiteMediaApi.dispose()` runs. Textures are disposed at the same time.

## The "no inference" rules

These are enforced in code, not only in the UI copy:

1. **Only typed text.** Names, relationships, captions, titles and prompts are exactly what
   the caregiver typed. Nothing is recognised from a photograph, and nothing is taken from
   a file name or metadata.
2. **Empty stays empty.** A photograph with no caption has no caption, and a person row left
   blank is dropped. A sound with no title cannot be saved until it has one; nothing fills
   the title in automatically.
3. **No invented details.** `resolveSuiteProfile` adds no people, dates, places or topics.
   Portraits carry only the typed name and relationship. The wall photograph carries
   nothing extra. The event photograph carries only its typed caption.
4. **No inferred familiarity.** Language, place and regional packs are only ever what the
   caregiver chose. The default language is English and the default place is "no
   preference". Neither is derived from anything about the person.
5. **Personal content is labelled as personal.** Every photograph and sound from a profile
   is marked `personal: true`. Demo pictures come from content packs and are never mixed
   into a profile.

The editor states the first two rules at the top: "Everything you enter here is shown only
as you wrote it. Nothing is guessed, recognised from pictures, filled in or added."

## Verification

- `node tools/suite/run-check.mjs tools/checks/suite-profile.check.ts` is the node
  check. It covers:
  - defaults and normalisation;
  - limits;
  - a `structuredClone` round trip with blobs;
  - locale parity;
  - i18n behaviour;
  - fonts;
  - `resolveSuiteProfile` under node, including URL revocation.
- The editor was also driven in headless Chromium at 360 px wide, through a scratch
  script outside the repository. The run covered:
  - uploads, rejected files, validation and focus;
  - saving through `profileStore` into IndexedDB, and reading the profile back;
  - real `createImageBitmap` textures (for example a 1024×512 texture from a 2048×1024
    photograph);
  - the Devanagari font loading through `FontFace`;
  - broken-media reporting;
  - discard on Escape;
  - 48 px or larger controls, and labels on every input;
  - no horizontal scroll;
  - no microphone request before a Record press.

  A real microphone permission prompt could not be exercised in headless mode. The
  denial path was tested with a stub that rejects with `NotAllowedError`.
