# Assets and environments

The suite's 3D content is packaged locally under `public/suite/`, and nothing is hotlinked at runtime.

| What | Where |
|---|---|
| Asset manifest (76 assets) | `public/suite/assets/manifest.json` |
| Procedural builders | `src/suite/assets/builders/*.ts`, registered in `builders/index.ts` |
| Shells (the rooms) and their slots | `src/suite/environments/shells/{livingRoom,kitchenDining,courtyardVeranda}.ts` |
| Scene builder | `src/suite/environments/index.ts` (`buildSuiteScene`) |
| Environment dressing presets | `public/suite/packs/<pack>/environments.json`, written by `tools/suite/assets/write-environments.py` |
| Textures (CC0, Poly Haven) | `public/suite/assets/textures/`, where `sources.json` records the source of every file |
| Thumbnails | `public/suite/assets/thumbs/<id>.webp`, rendered by `tools/suite/assets/render-thumbnails.mjs` |
| Provenance | `public/suite/assets/ATTRIBUTION.md` |

## Add an asset

1. **Write the builder.** Add a builder to a file in `src/suite/assets/builders/` and register it in `builders/index.ts`. Follow these conventions:
   - put the origin at the base centre, with +Z as the front;
   - work in real-world metres;
   - use palette materials through `Kit`, which caches and reference-counts them;
   - render text such as a calendar month at runtime, through `runtimeText` in the active language, never baked into a texture.
2. **Add a manifest entry.** Fill in the id, category, mount, `source.builder`, and label and description in English and Hindi (the Hindi is marked as needing review). Also fill in `size` as the built bounding box, `collision`, `activities`, `topics`, `provenance` and `budget`. A region-specific item also needs `tags.regions` and `descriptionSources`, the sources where its description was checked. Keep the description short and factual, and never claim that everyone in a region uses the item.
3. **Render and check.** Run `node tools/suite/assets/render-thumbnails.mjs`, then `npm run check -- suite-assets`.

An external model is allowed only with a verified redistributable licence (CC0 is preferred). Record it in `provenance` and in `ATTRIBUTION.md`, keep it under 3 MB, and give it a procedural `fallback`.

## Add or change an environment

An environment is a list of placements in a pack's `environments.json`, and each placement puts one asset in one slot of a shell. A slot accepts one mount (`floor`, `wall` or `surface`) and has a `maxSize`. A `surface` slot with a `host` sits on the furniture that is placed in the host slot, and that furniture must be the stated height: for example, the living room's `centre-top-left` needs a 0.42 m table in `centre`. Edit `tools/suite/assets/write-environments.py`, which validates every placement before writing the file, and then run the check.

## Budgets

The limits for a standard-quality environment are 180 draw calls, 250k triangles and 48 MB of textures. The starter environments measure:

| Environment | Objects | Photo surfaces | Triangles | Meshes |
|---|---|---|---|---|
| everyday-home/living-room | 25 | 6 | 29,654 | 112 |
| everyday-home/kitchen-dining | 28 | 2 | 30,390 | 98 |
| everyday-home/courtyard-veranda | 24 | 2 | 33,958 | 104 |
| northeast-home/ne-living-room | 25 | 6 | 31,666 | 106 |
| northeast-home/ne-veranda | 24 | 2 | 37,024 | 100 |

These figures are measured headless with flat materials. Prototypes are built once and shared by reference count, so they are cloned rather than rebuilt, and `dispose()` releases them. The `low` quality tier has no shadow maps.
