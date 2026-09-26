# Fonts

## Noto Sans Devanagari

| | |
|---|---|
| File | `NotoSansDevanagari-Variable-devanagari.woff2` (121,188 bytes) |
| Family | Noto Sans Devanagari, version 2.006 (from the font's `name` table) |
| Format | WOFF2 (magic bytes `wOF2`), variable, `wght` axis 100–900 (default 400) |
| Coverage | The Google Fonts `devanagari` subset: U+0900–097F, U+1CD0–1CF9, U+200C–200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830–A839, U+A8E0–A8FF, U+11B00–11B09. Latin text falls back to the next fonts in the stack in `locales/index.json`. |
| Copyright | Copyright 2022 The Noto Project Authors (https://github.com/notofonts/devanagari) |
| Licence | SIL Open Font License 1.1 (`OFL-1.1`); full text in `OFL.txt` beside this file |
| Source | Google Fonts, `https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600` → `https://fonts.gstatic.com/s/notosansdevanagari/v30/TuG7UUFzXI5FBtUq5a8bjKYTZjtRU6Sgv3NaV_SNmI0b8QQCQmHN5TV_5Kl4-GIB.woff2` (the same variable file is served for weights 400 and 600) |
| Upstream | https://github.com/notofonts/devanagari (latest release at retrieval: NotoSansDevanagari-v2.007) |
| Licence text source | https://raw.githubusercontent.com/notofonts/devanagari/main/OFL.txt |
| Retrieved | 2026-09-25 |
| Modified | Not modified. The file is used exactly as Google Fonts serves it; only the file name was chosen here. |

The font is loaded at runtime with the `FontFace` API when Hindi is chosen
(`src/suite/i18n/index.ts`), from this same-origin copy. Nothing is fetched from Google at
runtime.

Under the OFL, the font may be bundled and redistributed with this software, provided the
copyright notice and licence travel with it (they do: this file and `OFL.txt`). It may not
be sold on its own. The copyright line declares no Reserved Font Name.
