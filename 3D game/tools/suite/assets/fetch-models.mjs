#!/usr/bin/env node
/**
 * Vendors the suite's CC0 scanned models from Poly Haven into public/suite/assets/models/
 * and points their manifest entries at them. Run once by a developer; the app never
 * downloads a model at runtime.
 *
 *   node tools/suite/assets/fetch-models.mjs
 *
 * For each model it downloads the 1k glTF, shrinks the textures to what an object seen
 * from a metre or two needs (base colour and normal 512 px; roughness/metal 256 px; small
 * props' normals 256 px too), re-encodes them to WebP, packs one .glb with its base centre
 * at the origin, and measures it. Needs network, `npx` and @gltf-transform/cli (fetched by
 * npx, pinned below).
 *
 * The manifest entry `<asset>` becomes the glTF, sized to fit `fit` (its slots' limits);
 * the procedural build it replaces is kept as `<asset>-simple`, the glTF's `fallback`, so
 * the low tier, node checks and any load failure still get a real object. Provenance goes
 * to models/sources.json; ATTRIBUTION.md lists the same sets.
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ASSETS = path.join(ROOT, 'public', 'suite', 'assets')
const OUT = path.join(ASSETS, 'models')
const MANIFEST = path.join(ASSETS, 'manifest.json')
const GLTF_TRANSFORM = '@gltf-transform/cli@4.5.1'

/**
 * asset id → Poly Haven model, and the box [w, h, d] (metres) it is scaled to fit. `fit`
 * scales uniformly, up or down, to the largest size inside the box; `height` instead pins
 * the height exactly (furniture other things stand on) and fits the footprint in `fit`,
 * stretching one axis by at most a few percent if it has to. `small` models get 256 px
 * normals (props, and anything with several materials). `description` replaces the old one where the scan differs from the old model.
 */
export const MODELS = [
  { asset: 'chair-plastic', source: 'plastic_monobloc_chair_01', fit: [0.85, 1.0, 0.6] },
  { asset: 'stool-low', source: 'wooden_stool_02', fit: [0.4, 0.26, 0.4], small: true },
  {
    asset: 'bamboo-basket', source: 'wicker_basket_02', fit: [0.47, 0.39, 0.47], small: true,
    description: {
      en: 'A basket woven from bamboo or cane. Baskets like this are made in many shapes in Assam and elsewhere in Northeast India, for carrying things and for storing things such as grain.',
      hi: 'बाँस या बेंत से बुनी टोकरी। असम और पूर्वोत्तर भारत के दूसरे हिस्सों में ऐसी टोकरियाँ कई आकारों में बनती हैं — चीज़ें ढोने और अनाज जैसी चीज़ें रखने के लिए।'
    }
  },
  // Three materials (pot, soil, leaves): 256 px normals keep a veranda inside 48 MB.
  { asset: 'potted-plant-large', source: 'potted_plant_02', fit: [0.78, 1.2, 0.78], small: true },
  {
    asset: 'side-table', source: 'side_table_01', fit: [0.55, 0.8, 0.55], height: 0.6,
    description: { en: 'A small wooden table with a shelf underneath.', hi: 'नीचे शेल्फ़ वाली छोटी लकड़ी की मेज़।' }
  }
]

const gt = (...args) => execFileSync('npx', ['-y', GLTF_TRANSFORM, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString()
const round = (v) => Math.round(v * 1000) / 1000

async function download(url, file) {
  const response = await fetch(url, { headers: { 'User-Agent': 'memoria-suite-assets' } })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, Buffer.from(await response.arrayBuffer()))
}

/** `gltf-transform inspect --format csv`, as { SCENES: [{...row}], MESHES: [...], ... }. */
function inspect(glb) {
  const sections = {}
  let name = null, header = null
  const split = (line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => m[2] ?? m[1]).slice(0, -1)
  for (const line of gt('inspect', glb, '--format', 'csv').split('\n')) {
    const t = line.trim()
    if (/^[A-Z]+$/.test(t)) { name = t; header = null; sections[name] = []; continue }
    if (!name || !t || t.startsWith('─')) continue
    if (!header) { header = split(t); continue }
    const cells = split(t)
    sections[name].push(Object.fromEntries(header.map((h, i) => [h, cells[i]])))
  }
  return sections
}

/** Bounding box, triangles and GPU texture memory of a packed model. */
function measure(glb) {
  const report = inspect(glb)
  const scene = report.SCENES[0]
  const min = scene.bboxMin.split(',').map(Number), max = scene.bboxMax.split(',').map(Number)
  const triangles = report.MESHES.reduce((n, m) => n + Number(m.glPrimitives) * Number(m.instances), 0)
  const textureKB = (report.TEXTURES ?? []).reduce((n, t) => n + Number(t.gpuSize) / 1024, 0)
  return { size: [0, 1, 2].map((i) => max[i] - min[i]), triangles, textureKB: Math.round(textureKB) }
}

/** Per-axis scale that fits `size` into the model's box (see MODELS). */
function scaleFor(model, size) {
  const uniform = Math.min(...size.map((v, i) => model.fit[i] / v))
  if (model.height === undefined) return uniform
  const up = model.height / size[1]
  const across = Math.min(up, model.fit[0] / size[0], model.fit[2] / size[2])
  if (up / across > 1.12) throw new Error(`${model.asset}: pinning the height would stretch it ${(up / across).toFixed(2)}×`)
  return across === up ? up : [across, up, across]
}

async function vendor(model, work) {
  const info = await (await fetch(`https://api.polyhaven.com/info/${model.source}`)).json()
  const files = await (await fetch(`https://api.polyhaven.com/files/${model.source}`)).json()
  const entry = files.gltf['1k'].gltf
  const dir = path.join(work, model.source)
  const gltf = path.join(dir, `${model.source}.gltf`)
  await download(entry.url, gltf)
  for (const [rel, file] of Object.entries(entry.include)) await download(file.url, path.join(dir, rel))

  const step = (name) => path.join(dir, `${name}.glb`)
  gt('resize', gltf, step('a'), '--width', '512', '--height', '512')
  gt('resize', step('a'), step('b'), '--width', '256', '--height', '256', '--pattern', '*{rough,metal,arm}*')
  gt('resize', step('b'), step('c'), '--width', model.small ? '256' : '512', '--height', model.small ? '256' : '512', '--pattern', '*nor*')
  gt('optimize', step('c'), step('d'), '--compress', 'false', '--texture-compress', 'webp', '--simplify', 'false', '--instance', 'false')
  gt('center', step('d'), step('e'), '--pivot', 'below')

  const dest = path.join(OUT, `${model.asset}.glb`)
  copyFileSync(step('e'), dest)
  const measured = measure(dest)
  const scale = scaleFor(model, measured.size)
  const axes = typeof scale === 'number' ? [scale, scale, scale] : scale
  const size = measured.size.map((v, i) => round(v * axes[i]))
  const bytes = statSync(dest).size
  if (bytes > 3 * 1024 * 1024) throw new Error(`${model.asset}: ${bytes} bytes is over the 3 MB limit (docs/suite/assets.md)`)
  return {
    model, scale: typeof scale === 'number' ? round(scale) : scale.map(round), size,
    triangles: measured.triangles, textureKB: measured.textureKB, bytes,
    source: {
      id: model.source,
      title: info.name,
      authors: Object.keys(info.authors ?? {}),
      license: 'CC0-1.0',
      page: `https://polyhaven.com/a/${model.source}`,
      file: `models/${model.asset}.glb`,
      url: entry.url,
      modified: `1k glTF packed to GLB with glTF-Transform; textures resized (base colour 512 px, normal ${model.small ? 256 : 512} px, roughness/metal 256 px) and re-encoded to WebP; base centre moved to the origin`
    }
  }
}

function updateManifest(results, today) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const byId = new Map(manifest.assets.map((a) => [a.id, a]))
  for (const r of results) {
    const id = r.model.asset
    const current = byId.get(id)
    if (!current) throw new Error(`manifest has no asset "${id}"`)
    const simpleId = `${id}-simple`
    // The procedural build is kept, once, as the fallback. Re-running leaves it alone.
    if (!byId.has(simpleId)) {
      if (current.source.kind !== 'procedural') throw new Error(`${id} is not procedural and has no ${simpleId}`)
      const simple = { ...structuredClone(current), id: simpleId, thumbnail: `thumbs/${simpleId}.webp` }
      manifest.assets.splice(manifest.assets.indexOf(current) + 1, 0, simple)
      byId.set(simpleId, simple)
    }
    current.source = { kind: 'gltf', path: r.source.file, scale: r.scale }
    current.fallback = simpleId
    current.size = r.size
    if (r.model.description) current.description = r.model.description
    current.provenance = {
      source: 'Poly Haven',
      author: r.source.authors.join(', '),
      license: 'CC0-1.0',
      url: r.source.page,
      attribution: `${r.source.title} by ${r.source.authors.join(', ')}, Poly Haven, CC0 1.0.`,
      retrieved: today,
      modified: r.source.modified
    }
    current.budget = { triangles: Math.ceil(r.triangles / 100) * 100, textureKB: Math.ceil(r.textureKB / 100) * 100 }
  }
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const work = mkdtempSync(path.join(tmpdir(), 'suite-models-'))
  const today = new Date().toISOString().slice(0, 10)
  const only = process.argv.slice(2)
  const results = []
  try {
    for (const model of MODELS.filter((m) => !only.length || only.includes(m.asset))) {
      const r = await vendor(model, work)
      results.push(r)
      console.log(`  ${model.asset.padEnd(20)} ${model.source.padEnd(28)} ${(r.bytes / 1024).toFixed(0).padStart(5)} KB  ${String(r.triangles).padStart(6)} tris  ${String(r.textureKB).padStart(5)} KB GPU  ${r.size.join(' × ')} m  scale ${JSON.stringify(r.scale)}`)
    }
    updateManifest(results, today)
    const sourcesFile = path.join(OUT, 'sources.json')
    const previous = existsSync(sourcesFile) ? JSON.parse(readFileSync(sourcesFile, 'utf8')).models : []
    const models = [...previous.filter((p) => !results.some((r) => r.source.file === p.file)), ...results.map((r) => ({ ...r.source, retrieved: today, bytes: r.bytes, triangles: r.triangles }))]
      .sort((a, b) => a.file.localeCompare(b.file))
    writeFileSync(sourcesFile, JSON.stringify({ retrieved: today, models }, null, 2) + '\n')
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (!existsSync(path.join(ROOT, 'package.json'))) throw new Error('run from the 3D game project')
await main()
