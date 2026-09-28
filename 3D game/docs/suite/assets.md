# Assets and environments

The suite's 3D content is packaged locally under `public/suite/`, and nothing is hotlinked at runtime.

| What | Where |
|---|---|
| Asset manifest (81 assets) | `public/suite/assets/manifest.json` |
| Procedural builders | `src/suite/assets/builders/*.ts`, registered in `builders/index.ts` |
| Scanned models (CC0, Poly Haven) | `public/suite/assets/models/*.glb`, packed by `tools/suite/assets/fetch-models.mjs`, which records each source in `models/sources.json` |
| Shells (the rooms) and their slots | `src/suite/environments/shells/{livingRoom,kitchenDining,courtyardVeranda}.ts` |
| Scene builder | `src/suite/environments/index.ts` (`buildSuiteScene`) |
| Environment dressing presets | `public/suite/packs/<pack>/environments.json`, written by `tools/suite/assets/write-environments.py` |
| Textures (CC0, Poly Haven) | `public/suite/assets/textures/`, where `sources.json` records the source of every file |
| Thumbnails | `public/suite/assets/thumbs/<id>.webp`, rendered by `tools/suite/assets/render-thumbnails.mjs` |
| Provenance | `public/suite/assets/ATTRIBUTION.md` |
| How a room looks | `tools/suite/assets/screenshot-environments.mjs <out-dir>` screenshots every starter environment through `preview.html`, with the game's own renderer |

## Add an asset

1. **Write the builder.** Add a builder to a file in `src/suite/assets/builders/` and register it in `builders/index.ts`. Follow these conventions:
   - put the origin at the base centre, with +Z as the front;
   - work in real-world metres;
   - use palette materials through `Kit`, which caches and reference-counts them;
   - render text such as a calendar month at runtime, through `runtimeText` in the active language, never baked into a texture.
2. **Add a manifest entry.** Fill in the id, category, mount, `source.builder`, and label and description in English and Hindi (the Hindi is marked as needing review). Also fill in `size` as the built bounding box, `collision`, `activities`, `topics`, `provenance` and `budget`. A region-specific item also needs `tags.regions` and `descriptionSources`, the sources where its description was checked. Keep the description short and factual, and never claim that everyone in a region uses the item.
3. **Render and check.** Run `node tools/suite/assets/render-thumbnails.mjs`, then `npm run check -- suite-assets`.

An external model is allowed only with a verified redistributable licence (CC0 is preferred). Record it in `provenance` and in `ATTRIBUTION.md`, keep it under 3 MB, and give it a procedural `fallback`.

To use a Poly Haven model, add a line to `MODELS` in `tools/suite/assets/fetch-models.mjs` and run the tool. Give the line a `fit` box taken from the limits of the slots the asset is placed in. Add `height` if other objects stand on the model, because a host's height must stay exact. The tool packs the model with small WebP textures and sizes it to fit. The asset's old procedural entry is kept as `<id>-simple`, which is the model's `fallback`. The low tier, the node checks and any failed load use that fallback. After the tool, render thumbnails and run the check as in step 3. Pick models that look like the homes the packs describe; most of Poly Haven's catalogue does not.

## Add or change an environment

An environment is a list of placements in a pack's `environments.json`, and each placement puts one asset in one slot of a shell. A slot accepts one mount (`floor`, `wall` or `surface`) and has a `maxSize`. A `surface` slot with a `host` sits on the furniture that is placed in the host slot, and that furniture must be the stated height: for example, the living room's `centre-top-left` needs a 0.42 m table in `centre`. Edit `tools/suite/assets/write-environments.py`, which validates every placement before writing the file, and then run the check.

## Budgets

The limits for a standard-quality environment are 180 draw calls, 250k triangles and 48 MB of textures. Measured in the browser with textures and the scanned models loaded, the starter environments come to:

| Environment | Objects | Photo surfaces | Triangles | Meshes | Textures |
|---|---|---|---|---|---|
| everyday-home/living-room | 25 | 6 | 31,142 | 110 | 31.6 MB |
| everyday-home/kitchen-dining | 28 | 2 | 44,800 | 95 | 42.8 MB |
| everyday-home/courtyard-veranda | 24 | 2 | 105,488 | 99 | 45.9 MB |
| northeast-home/ne-living-room | 25 | 6 | 49,092 | 103 | 33.6 MB |
| northeast-home/ne-veranda | 24 | 2 | 132,350 | 95 | 47.5 MB |

`npm run check -- suite-assets` measures the same environments headless, with flat materials and the procedural fallbacks, so its triangle counts are lower. Prototypes are built once and shared by reference count, so they are cloned rather than rebuilt, and `dispose()` releases them. The `low` quality tier has no shadow maps.

## Lighting

Rooms and the house draw through one renderer (`src/Renderer.ts`). On the `full` quality tier it adds screen-space ambient occlusion (GTAO), which darkens contact points and corners. The software and baseline tiers draw without it. An interior shell's sun comes in through its windows: the walls, ceiling and window grills cast shadows, so the sunlight falls on the floor as a patch with bar shadows. The hemisphere fill keeps the rest of the room bright, because a dim corner hides what is in it. Once a room is on screen, the suite captures it into a small environment map from the seat, so steel, glass and polished floors reflect the room rather than a studio. The house's HDRI comes back when the suite closes.
