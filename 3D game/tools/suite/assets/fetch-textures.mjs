#!/usr/bin/env node
/**
 * Vendors the suite's CC0 texture sets from Poly Haven into public/suite/assets/textures/.
 * Run once by a developer; the app never downloads textures at runtime.
 *
 *   node tools/suite/assets/fetch-textures.mjs
 *
 * For each set it downloads the 1k diffuse and OpenGL normal JPGs, re-encodes them to WebP
 * with `cwebp` (resizing where noted to keep GPU memory inside the suite budget), and
 * writes textures/sources.json with the author, licence, URL and retrieval date taken from
 * api.polyhaven.com. ATTRIBUTION.md is written from the same data.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const OUT = path.join(ROOT, 'public', 'suite', 'assets', 'textures')

/** Set id → [our name, diffuse px, normal px]. Small props get 512 px maps. */
export const SETS = [
  ['oak_veneer_01', 'wood', 1024, 512],
  ['laminate_floor_02', 'floor-wood', 1024, 512],
  ['painted_plaster_wall', 'plaster', 1024, 512],
  ['mixed_stone_tiles', 'terrazzo', 1024, 512],
  ['floor_tiles_06', 'tile', 1024, 512],
  ['granite_tile', 'stone', 1024, 512],
  ['concrete_floor_worn_001', 'cement', 1024, 512],
  ['clay_floor_001', 'clay', 512, 512],
  ['cotton_jersey', 'fabric', 512, 512],
  ['bamboo_veneer', 'bamboo', 512, 512]
]

async function main() {
  mkdirSync(OUT, { recursive: true })
  const tmp = mkdtempSync(path.join(tmpdir(), 'suite-tex-'))
  const today = new Date().toISOString().slice(0, 10)
  const sources = []
  try {
    for (const [id, name, diffPx, norPx] of SETS) {
      const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json()
      const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json()
      const maps = { diff: files.Diffuse['1k'].jpg.url, nor: files.nor_gl['1k'].jpg.url }
      const out = {}
      for (const [kind, url] of Object.entries(maps)) {
        const jpg = path.join(tmp, `${id}_${kind}.jpg`)
        const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
        writeFileSync(jpg, buf)
        const px = kind === 'diff' ? diffPx : norPx
        const file = `${name}_${kind}.webp`
        const args = ['-quiet', '-q', kind === 'diff' ? '78' : '88']
        if (px !== 1024) args.push('-resize', String(px), String(px))
        execFileSync('cwebp', [...args, jpg, '-o', path.join(OUT, file)])
        out[kind] = { file, px, url, bytes: statSync(path.join(OUT, file)).size }
      }
      sources.push({
        id,
        name,
        title: info.name,
        authors: Object.keys(info.authors ?? {}),
        license: 'CC0-1.0',
        page: `https://polyhaven.com/a/${id}`,
        tileMetres: (info.dimensions?.[0] ?? 2000) / 1000,
        retrieved: today,
        maps: out,
        modified: `1k JPG re-encoded to WebP (cwebp); diffuse ${diffPx}px, normal ${norPx}px; roughness/AO/displacement maps not used`
      })
      console.log(`  ${name.padEnd(11)} ${id}  ${Object.values(out).map((m) => `${m.file} ${(m.bytes / 1024).toFixed(0)} KB`).join(', ')}`)
    }
    writeFileSync(path.join(OUT, 'sources.json'), JSON.stringify({ retrieved: today, sets: sources }, null, 2) + '\n')
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

if (!existsSync(path.join(ROOT, 'package.json'))) throw new Error('run from the 3D game project')
await main()
