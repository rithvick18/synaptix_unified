# Reminiscence Therapy Suite: controls, comfort and accessibility

This page covers the suite's 3D experience and screens (`src/suite/app/`): how to move and
choose things, the comfort settings, the choices behind them, how camera support is
described, and how the layout adapts to the screen. "Reminiscence Therapy Suite" is
product branding. The suite is an activity space, not a medical treatment.

## Screens

1. **Home**: choose who the session is for, change the language, open comfort settings,
   caregiver setup, home personalisation, camera support, and guided tasks (the older
   tasks with caregiver-set answers, kept in a separate group).
2. **Place**: choose a content pack and a room. Regional packs appear in their own
   "Optional regional packs" group, with their coverage note, and are never pre-selected.
3. **Activity**: the five activities, each with its availability. It says clearly:
   "No scores, no timers, no right or wrong answers."
4. **Explore**: the 3D room and the activity panel.
5. **Summary**: a factual record of the session, with any camera information in a
   separate, labelled block.

## Controls

### Keyboard

| Key | Where | What it does |
|---|---|---|
| Tab / Shift+Tab | Everywhere | Moves through buttons, the object list and the caregiver panel |
| Arrow keys | Explore, seated | Move focus through "Things in this room"; the focused object gets a soft highlight |
| Arrow keys | Explore, walk mode | Walk, unless focus is in the object list (then they move through the list) |
| W A S D | Explore, walk mode | Walk slowly (1.4 m/s) |
| Enter | Explore | Chooses the highlighted object (on a button, it presses that button) |
| Space | Explore, close-up | Replays the prompt (on a button, it presses that button) |
| P | Explore | Pause or resume |
| + / − | Photo close-up | Zoom in or out |
| Esc | Anywhere in the suite | Closes the close-up, the settings or the pause screen; in Explore, asks "Would you like to end this activity?" before ending anything |

The suite ignores all of these while the caregiver setup (`#suite-setup` or its mount
point), the camera sheet (`#camera-setup`) or the house's `#profile-editor` is open, and
while someone is typing a note. Keys with Ctrl, Cmd or Alt are left alone.

### Pointer and touch

| Gesture | Where | What it does |
|---|---|---|
| Drag | 3D room | Looks around: up to about 70° left or right and 35° up or down from the resting view, with gentle damping. In walk mode, dragging sideways turns freely. |
| Tap or click | 3D room | Chooses the object under the pointer. A drag is never read as a tap: a tap moves less than 8 px and lasts less than 0.65 s. |
| Hover | 3D room, object list | A soft, steady warm tint on the object, with no flashing or pulsing |
| Buttons, wheel, pinch | Photo close-up | Zoom from 100% to 500%; drag to pan when zoomed |

There is no pointer lock, so touch screens work the same way as a mouse.

### Camera movement

- **Seated** is the default. The view rests at the room's seat, and choosing an object
  glides to its viewpoint with an ease-in-out lasting 1.2 s or less.
- With **reduce motion** on, the view cuts straight to the new place instead of gliding.
- The view never turns by itself.
- **Walk mode** is optional: a slow walk that cannot pass through furniture (a 0.25 m
  radius) and stays inside the room's floor area.

## Comfort settings

These are saved on this device only, under the localStorage key `memoria-suite-settings-v1`.
If storage is unavailable, they last until the page is closed, and the panel says so.
They can be opened from Home and from the pause screen.

| Setting | Values | Default |
|---|---|---|
| Text size | Standard (18 px base), Larger (×1.25), Largest (×1.5) | Standard |
| High contrast | on / off | off |
| Reduce motion | on / off | follows the system's `prefers-reduced-motion` |
| Moving around | Seated / Walk with the keyboard | Seated |
| Show prompt text | on / off | on |
| Read prompts aloud when there is no recording | on / off | on |
| Volume | Overall, Voice, Sounds (0–100% each) | 80%, 100%, 80% |
| Mute all sound | on / off | off |
| Show the caregiver panel | on / off | on (a saved profile's own setting replaces it when a session starts) |

## Comfort choices

- **Nothing is timed or scored.** There are no countdowns, clocks, progress-to-a-goal
  numbers, red crosses, confetti or "well done" messages. The paused screen has no clock.
- **Nothing flashes.** The stylesheet has no animations. Highlights are steady, and the
  only transitions are the camera glide (off with reduce motion) and a progress bar.
- **Text is always there.** Prompts are written on screen, and the prompt and gentle-cue
  lines are `aria-live="polite"`. With "Show prompt text" off, a prompt that was not
  spoken (no recording and no voice) is still shown, so no one is left with nothing.
- **Audio never blocks.** Recorded prompt audio plays first. Without a recording, speech
  synthesis is used only if it is on and the device has a voice for the language (an exact
  tag such as `hi-IN`, or the same primary language). Otherwise the prompt is text only.
  A recording that fails to load also falls back to text only, and nothing throws.
- **Gentle wording.** The suite invites, and never tests. "Skip" is recorded as "items
  moved past", never counted against anyone, and ending early is worded neutrally
  ("Ended before the last item").
- **Demo content is labelled.** Demo pictures carry their notice ("Demo picture: an
  illustration, not a real memory"). In a personal session, frames without a personal
  photograph show a plain mat, so a demo picture is never mistaken for a personal one.

## Visual design and contrast

The palette is warm and neutral, defined as CSS custom properties on `#suite` (`--s-bg`,
`--s-surface`, `--s-text`, `--s-accent`, …) in `src/suite/app/theme.ts`. The check
computes the WCAG ratios of every text and background pair the UI uses:

- default palette: every text pair is 4.5:1 or better (the worst is 6.66:1);
- high contrast: every text pair is 7:1 or better (the worst is 13.58:1);
- the focus ring and control borders are 3:1 or better against their backgrounds.

Other points:

- Every button has a text label and is at least 48 × 48 px.
- A 3 px focus ring is shown on keyboard focus.
- `#suite` carries `lang` and `dir` for the active language, and the font family from the
  language registry (Noto Sans Devanagari for Hindi).
- Buttons wrap their text, but never break inside a word.

## Camera support wording

- Home shows one line, taken from the camera's own status: "Camera support: …", or
  "Camera support is off".
- In Explore, the line appears only while the camera is on. Otherwise it is hidden, which
  is calmer.
- The person is never shown an attention, head or eye judgement.
- The summary's camera block appears only if the camera was on during the session. It is
  labelled: "These numbers describe how the camera's tracking worked during the session,
  not the person. They are heuristic and are not a clinical measure." It shows:
  - the share of sampled seconds (about one sample a second, pauses excluded) in which
    the snapshot's `visionUsable` flag was true;
  - the number of gentle re-offers shown;
  - the number of times a new prompt's speech was held.

## Layouts

| Width | Explore panel | Notes |
|---|---|---|
| Under 768 px (checked at 360 × 740) | Bottom sheet, up to 62% of the height, scrolling | The object list scrolls sideways. The sheet's footer (Pause, Exit) keeps the bottom-right corner free for the camera chip dock. |
| 768 px and wider (checked at 768 × 1024) | Side panel on the left, full height | The dock at the bottom right is never covered. |
| Desktop (checked at 1280 × 800) | Side panel on the left | Home, Place, Activity and Summary are centred columns up to 46em wide. |

Stacking order:

- `#suite` sits at z-index 30, above the house UI (`#answer` at 4, `#overlay` at 5) and
  below the camera sheet (40) and the chip dock (41). The camera sheet opened from Home
  therefore appears above the suite.
- Scrolling pages keep 72 px of space at the bottom, so their last line can scroll clear
  of the dock.
- The layout has no fixed widths that truncate text, so longer Hindi strings wrap.

What was checked: screenshots of Home, Place, Activity, Explore, the object and photo
close-ups, Pause, Settings and Summary in headless Chrome. These used the development
harness (`src/suite/app/dev/harness.html`), which uses fake rooms and the real i18n, at
360 × 740, 768 × 1024 and 1280 × 800, in English, and in Hindi at 1.25× and 1.5× text size.

## Languages

All app strings are in `public/suite/locales/<lang>/app.json`. The Hindi strings are
**machine-generated and need review by a fluent speaker** (the registry marks Hindi
`machine-generated-needs-review`), and the Home screen says so when Hindi is chosen.

## Checks

```
node tools/suite/run-check.mjs tools/checks/suite-app.check.ts
```

This covers:

- settings normalisation, including bad stored JSON and storage that throws;
- look clamping, the 1.2 s tween cap, the reduced-motion cut, and walk collision;
- the keyboard map, including the blocking editors;
- the audio fallback decision with fake speech and audio;
- the vision note from fake snapshots and adaptation records;
- the computed contrast ratios;
- highlight restore and dispose, and picking;
- the summary fallback;
- matching keys and placeholders between en and hi, and the tone rules.
