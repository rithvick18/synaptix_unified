# Languages in the Reminiscence Therapy Suite

The suite's text lives in JSON files under `public/suite/locales/`. You can add a language
without changing any game logic.

## How it works

```
public/suite/locales/
  index.json               the language registry (LocaleIndex)
  en/common.json           shared words, branding line, disclaimer, media errors
  en/setup.json            the caregiver editor
  en/app.json              suite screens (3D experience agent)
  en/activities.json       activity names and prompts (activities agent)
  hi/…                     the same four files in Hindi
public/suite/fonts/        vendored fonts (woff2) + OFL.txt + ATTRIBUTION.md
src/suite/i18n/            loadI18n: loading, lookup, plurals, fonts
```

- **Keys** are nested objects. `t('setup.photos.title')` reads `locales/<code>/setup.json`
  at the path `photos.title`.
- **Placeholders** are written `{name}` and filled from `t(key, { name })`. Numbers are
  formatted for the active language.
- **Plurals** use an object with `one` and `other`, chosen by `Intl.PluralRules` when
  `vars.count` is a number. Hindi counts 0 and 1 as `one`; English counts only 1.
- **Fallback.** A missing key falls back to English, and then to the key itself. Each
  missing key logs one `console.warn`. A missing namespace file logs a warning and never
  crashes.
- **`LocalizedText`** in packs and manifests resolves in this order: the active language,
  then English, then the first non-empty entry. A plain string is a caregiver's own
  words and is shown exactly as typed.
- **Choosing a language.** The language is only ever what someone chooses: the
  caregiver's saved preference, or a choice on the home screen. It is never inferred
  from a name, a region, the browser, or anything else about a person.
- **Fonts** in `fontFiles` are loaded with the `FontFace` API when a language is chosen.
  A failure is only a warning: the `fontFamily` stack falls back to system fonts.

## Adding a language (example: Bengali, `bn`)

1. **Translate every namespace.** Copy `locales/en/*.json` to `locales/bn/` and translate
   every value. Keep the keys and `{placeholders}` exactly as they are. Add a `one`/`other`
   pair wherever English has one; if the language needs other plural categories (`few`,
   `many`), add them too, because `other` is always the fallback. Do not leave empty
   strings. If a string is not translated yet, leave its key out so it falls back to
   English visibly, rather than shipping a copy of the English.
2. **Register it** in `locales/index.json`:
   ```json
   {
     "code": "bn", "name": "Bengali", "nativeName": "বাংলা", "script": "Beng", "dir": "ltr",
     "speechLang": "bn-IN",
     "fontFamily": "\"Noto Sans Bengali\", \"Nirmala UI\", \"Bangla Sangam MN\", system-ui, sans-serif",
     "fontFiles": [{ "family": "Noto Sans Bengali", "path": "fonts/NotoSansBengali-Variable-bengali.woff2", "weight": "100 900" }],
     "translation": "machine-generated-needs-review",
     "coverage": { "common": 1, "setup": 1, "app": 1, "activities": 1 }
   }
   ```
3. **Vendor a font** if system fonts may not cover the script. Use an OFL-1.1 font from
   Google Fonts or notofonts on GitHub, as woff2, and keep the total under about 400 KB.
   Record the source URL, retrieval date, version and licence in
   `public/suite/fonts/ATTRIBUTION.md`. The check verifies that the file exists, that it
   starts with the `wOF2` magic bytes, and that the index references it.
4. **Speech tag.** `speechLang` is the BCP-47 tag passed to speech synthesis (`bn-IN`).
   Speech is optional everywhere: if a device has no voice for the language, the prompt
   text is still shown. Caregiver recordings play regardless of speech support.
5. **Review status.** Use `machine-generated-needs-review` until a fluent speaker has
   reviewed every string in context. Only then change it to `human-reviewed`. The UI
   shows the status next to the language choice. Never mark a language as reviewed
   because it "looks fine".
6. **Run the check.** `node tools/suite/run-check.mjs tools/checks/suite-profile.check.ts`
   compares every non-English file with English for each namespace. It checks for the same
   keys, no empty strings, matching placeholders and valid JSON, prints coverage per
   namespace, and reports the longest strings, so layouts can be checked for text that
   grows.

Do not register a language whose files are not translated. The selector must offer only
languages a person can actually use.

## Current coverage

This table was measured by `tools/checks/suite-profile.check.ts` on 2026-09-26. The
counts are leaf keys, where a plural pair counts as two.

| Language | Status | common | setup | app | activities |
|---|---|---|---|---|---|
| English (`en`) | source | 84 keys | 147 keys | 170 keys | 60 keys |
| Hindi (`hi`) | **machine-generated-needs-review** | 84/84 (100%) | 147/147 (100%) | 170/170 (100%) | 60/60 (100%) |

"100%" means every English key has a non-empty Hindi string with the same placeholders.
It does **not** mean the Hindi is good. `app.json` and `activities.json` were written by
other agents at the same time, so the figures for those two namespaces describe the
files as they were when the check ran.

### About the Hindi

The Hindi strings in `common.json` and `setup.json` were machine-generated by an AI model
while writing this feature. **No fluent speaker has reviewed them.** Treat them as a
draft: the wording may be unnatural, too formal or wrong in places. In particular, the
tone should be checked, because the suite must always sound like an invitation and never
like a test. Before a Hindi-speaking family or caregiver relies on them, ask a fluent
reviewer to read each namespace in context in the running app. Only then should
`translation` for `hi` change to `human-reviewed`.

The Hindi strings keep a few names in English on purpose:

- **Personalise Home.** This is the name of an existing screen that is only available in
  English.
- **File-format names.** JPEG, PNG, WebP, MP3, M4A, WAV, OGG and WebM stay as written.
- **MB.**

The brand name is transliterated (रेमिनिसेंस थेरेपी सुइट), not translated.

### Longest strings

From the check's long-text report (characters, hi / en):

| Key | hi | en |
|---|---|---|
| `setup.noInference` | 257 | 227 |
| `setup.profile.homePhotos` | 181 | 184 |
| `common.media.storageFailed` | 168 | 136 |
| `common.disclaimer` | 158 | 159 |

Across all four namespaces (461 strings), Hindi averages about 1.07× the English length.
The largest ratio is `common.status.takeYourTime` at about 2.3×, because it is a short
English phrase. After that come `app.summary.notes` (1.67×) and `app.closeup.fit` (1.62×).
In headless Chromium at 360 px, the automatic no-horizontal-scroll check ran on the English
editor. For Hindi, the only check was a visual one: two screenshots, the header and the
photograph card, looked correct. Other screens have not been checked in Hindi.
