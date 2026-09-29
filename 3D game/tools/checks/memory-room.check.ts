/**
 * Memory room checks, under node (no DOM, no model): the relief geometry, the stored depth
 * form, and how a stored depth is normalised and resolved with its photograph.
 */
import * as THREE from 'three'
import { buildDepthGeometry, dropSmallIslands, normaliseDepth } from '../../src/suite/memoryRoom/depthMesh'
import { packDepth, unpackDepth, STORE_EDGE } from '../../src/suite/memoryRoom/depthStore'
import { buildCustomPack, buildCustomScene, CUSTOM_ENVIRONMENT_ID, CUSTOM_PACK_ID } from '../../src/suite/memoryRoom/customScene'
import { suiteOf } from '../../src/suite/profile'
import { newProfile, type Photo } from '../../src/LocalProfile'

let passed = 0
const failures: string[] = []
function ok(condition: unknown, label: string): void {
  if (condition) passed++
  else { failures.push(label); console.error(`  FAIL ${label}`) }
}

const grid = (w: number, h: number, f: (x: number, y: number) => number) => {
  const data = new Float32Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) data[y * w + x] = f(x, y)
  return { width: w, height: h, data }
}
const cells = (g: THREE.BufferGeometry) => (g.index?.count ?? 0) / 6

async function main(): Promise<void> {
  // ---- relief geometry
  const flat = buildDepthGeometry(grid(64, 48, () => 0.5), 4 / 3, { resolution: 32 })
  const fullCells = cells(flat)
  ok(fullCells > 0, 'a flat depth map gives a surface')
  const z = flat.attributes.position.array as Float32Array
  let zmin = Infinity, zmax = -Infinity
  for (let i = 2; i < z.length; i += 3) { zmin = Math.min(zmin, z[i]); zmax = Math.max(zmax, z[i]) }
  ok(zmax - zmin < 1e-4, 'a flat depth map gives a flat surface')

  const ramp = buildDepthGeometry(grid(64, 48, (x) => x / 63), 4 / 3, { resolution: 32, relief: 0.4, edgeCut: 1 })
  const rz = ramp.attributes.position.array as Float32Array
  let rmin = Infinity, rmax = -Infinity
  for (let i = 2; i < rz.length; i += 3) { rmin = Math.min(rmin, rz[i]); rmax = Math.max(rmax, rz[i]) }
  ok(rmax <= 1e-6 && rmin >= -0.4 - 1e-6 && rmax - rmin > 0.35, 'relief spans the requested thickness, nearest at z = 0')

  const step = buildDepthGeometry(grid(64, 48, (x) => (x < 32 ? 0.1 : 0.95)), 4 / 3, { resolution: 32, edgeCut: 0.2 })
  ok(cells(step) < fullCells, 'triangles across a large depth jump are dropped, not stretched')

  const uv = ramp.attributes.uv.array as Float32Array
  const pos = ramp.attributes.position.array as Float32Array
  let topV = Infinity, bottomV = -Infinity, topY = -Infinity
  for (let i = 0; i < pos.length / 3; i++) { if (pos[i * 3 + 1] > topY) { topY = pos[i * 3 + 1]; topV = uv[i * 2 + 1] } }
  for (let i = 0; i < pos.length / 3; i++) if (Math.abs(pos[i * 3 + 1] - topY) > 0.9) bottomV = uv[i * 2 + 1]
  ok(topV < bottomV, "the picture's top row maps to the mesh's top (ImageBitmap textures are not flipped)")

  const colors = flat.attributes.color as THREE.BufferAttribute
  ok(colors.itemSize === 4, 'vertices carry alpha for the feathered edge')
  const alphas = Array.from({ length: colors.count }, (_, i) => colors.getW(i))
  ok(alphas.some((a) => a === 0) && alphas.some((a) => a === 1), 'edge vertices fade out and interior vertices stay solid')

  // ---- stray fragments
  const keep = new Uint8Array(10 * 10)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) keep[y * 10 + x] = 1 // a big piece
  keep[9 * 10 + 9] = 1 // a lone cell
  dropSmallIslands(keep, 10, 10, 0.05)
  ok(keep[9 * 10 + 9] === 0, 'a tiny disconnected piece is removed')
  ok(keep[0] === 1 && keep[7 * 10 + 7] === 1, 'the main piece is kept')

  // ---- normalisation
  const outlier = grid(50, 50, (x, y) => (x === 0 && y === 0 ? 1000 : x / 49))
  const n = normaliseDepth(outlier)
  ok(n.data[n.data.length - 1] > 0.9 && n.data[25] > 0.3 && n.data[25] < 0.7, 'a stray extreme pixel does not flatten the rest')
  ok(normaliseDepth(grid(4, 4, () => 7)).data.every((v) => v === 0.5), 'a constant map normalises to the middle')

  // ---- stored form
  const big = grid(2048, 1024, (x, y) => (x + y) / 3072)
  const packed = packDepth(big)
  ok(Math.max(packed.width, packed.height) === STORE_EDGE, 'stored depth is capped at the store edge')
  ok(packed.data.size === packed.width * packed.height, 'stored depth is one byte per cell')
  const back = await unpackDepth(packed)
  ok(!!back && back.width === packed.width && back.data[0] < 0.05 && back.data[back.data.length - 1] > 0.95, 'stored depth reads back')
  ok((await unpackDepth({ ...packed, width: packed.width + 1 })) === null, 'a depth blob that does not match its size is refused')

  // ---- profile
  const photo = (id: string): Photo => ({ id, original: new Blob([new Uint8Array(4)]), runtime: new Blob([new Uint8Array(4)]), thumbnail: new Blob([new Uint8Array(4)]), width: 10, height: 10, crop: { x: .5, y: .5, zoom: 1 } })
  const profile = newProfile()
  const origWarn = console.warn
  console.warn = () => undefined
  profile.suite = {
    ...suiteOf(undefined),
    photos: [
      { id: 'a', photo: photo('pa'), caption: '', people: [], depth: packed },
      { id: 'b', photo: photo('pb'), caption: '', people: [], depth: { data: new Blob([new Uint8Array(3)]), width: 4, height: 4 } },
      { id: 'c', photo: photo('pc'), caption: '', people: [] }
    ]
  }
  const suite = suiteOf(profile)
  console.warn = origWarn
  ok(suite.photos.length === 3, 'a bad depth does not cost the photograph')
  ok(suite.photos[0].depth?.width === packed.width, 'a valid depth is kept')
  ok(suite.photos[1].depth === undefined, 'a depth whose size does not match is dropped')
  ok(suite.photos[2].depth === undefined, 'a photograph without depth stays without')
  const cloned = structuredClone(suite.photos[0])
  ok(cloned.depth?.data instanceof Blob && cloned.depth.data.size === packed.data.size, 'depth survives a structuredClone (IndexedDB) round trip')

  // ---- custom place
  const scene = buildCustomScene()
  ok(scene.packId === CUSTOM_PACK_ID && scene.environmentId === CUSTOM_ENVIRONMENT_ID, 'the custom scene names its own place')
  ok(scene.objects.length === 0 && scene.blockers.length === 0, 'the custom scene has no template objects')
  ok(scene.root.children.length > 0, 'the custom scene has a quiet surround')
  const pack = buildCustomPack()
  ok(pack.environments.length === 0 && pack.prompts.length === 0 && pack.sounds.length === 0, 'the custom pack brings no template content')
  scene.dispose()
  ok(scene.root.parent === null, 'disposing the custom scene detaches it')

  console.log(`memory-room: ${passed} passed, ${failures.length} failed`)
  if (failures.length) process.exit(1)
}
main().catch((error) => { console.error(error); process.exit(1) })
