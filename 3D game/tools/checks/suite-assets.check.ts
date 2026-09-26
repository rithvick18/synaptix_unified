/**
 * Reminiscence Therapy Suite — asset library and starter environments, headless.
 *
 *   - the asset manifest validates, and every region-tagged asset cites its sources
 *   - every asset builds under node, with English and Hindi labels
 *   - both packs load with no errors, with placements checked against the shells' slots
 *   - every starter environment builds with no missing asset, unknown slot or rejected
 *     placement, within the triangle budget, and every object has a viewpoint that is
 *     inside the walkable area and outside every blocker
 *   - dispose() releases the scene's GPU resources
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as THREE from 'three'
import type { JsonLoader } from '../../src/suite/contracts'
import { BUILDERS, loadAssetLibrary } from '../../src/suite/assets'
import { loadContentPacksWithShells } from '../../src/suite/content'
import { SHELLS, buildSuiteScene } from '../../src/suite/environments'
import { loadI18n } from '../../src/suite/i18n'

let checks = 0
const failures: string[] = []
function ok(condition: boolean, label: string, detail = ''): void {
  checks++
  if (!condition) failures.push(label + (detail ? `\n     ${detail}` : ''))
}

const ROOT = process.env.MEMORIA_ROOT ?? process.cwd()
const SUITE = path.join(ROOT, 'public', 'suite')
const load: JsonLoader = async (p) => JSON.parse(fs.readFileSync(path.join(SUITE, p), 'utf8'))
const TRIANGLE_BUDGET = 250_000

const library = await loadAssetLibrary(load)
const errors = library.problems.filter((p) => p.severity === 'error')
ok(errors.length === 0, 'the asset manifest validates with no errors', errors.slice(0, 5).map((p) => `${p.where}: ${p.message}`).join('\n     '))
ok(library.all().length >= 70, `the library has at least 70 assets (${library.all().length})`)

for (const def of library.all()) {
  const label = def.label as Record<string, string>
  ok(typeof label === 'object' && !!label.en && !!label.hi, `${def.id}: English and Hindi labels`)
  if (def.tags?.regions?.length) ok((def.descriptionSources?.length ?? 0) > 0, `${def.id}: a region-tagged asset cites description sources`)
  if (def.source.kind === 'procedural') ok(def.source.builder in BUILDERS, `${def.id}: builder "${def.source.builder}" is registered`)
  ok(def.provenance.license !== 'unknown' && !!def.provenance.license, `${def.id}: has a licence`)
  const thumb = path.join(SUITE, 'assets', def.thumbnail)
  ok(fs.existsSync(thumb) && fs.statSync(thumb).size <= 40_000, `${def.id}: thumbnail exists and is 40 KB or less`, def.thumbnail)
}
{
  const attribution = fs.readFileSync(path.join(SUITE, 'assets', 'ATTRIBUTION.md'), 'utf8')
  for (const file of fs.readdirSync(path.join(SUITE, 'assets', 'textures')).filter((f) => f.endsWith('.webp'))) {
    ok(attribution.includes(`textures/${file}`), `ATTRIBUTION.md lists textures/${file}`)
  }
}

const shells = Object.fromEntries(Object.values(SHELLS).map((s) => [s.id, s.slots.map((slot) => ({ id: slot.id, mount: slot.mount }))]))
const { packs, problems } = await loadContentPacksWithShells(library, load, { shells })
const packErrors = problems.filter((p) => p.severity === 'error')
ok(packErrors.length === 0, 'both content packs load with no errors', packErrors.slice(0, 5).map((p) => `${p.where}: ${p.message}`).join('\n     '))
ok(packs.length === 2, `two packs are offered (${packs.map((p) => p.meta.id).join(', ')})`)
ok(packs.find((p) => p.meta.id === 'everyday-home')?.meta.regional === false, 'the default pack is not regional')
ok(packs.find((p) => p.meta.id === 'northeast-home')?.meta.regional === true, 'the Northeast pack is marked regional')

const i18n = await loadI18n({ load })
console.log('  environment                         objects  photo  triangles  meshes   build')
for (const pack of packs) {
  for (const env of pack.environments) {
    const scene = await buildSuiteScene({
      pack, environmentId: env.id, library, i18n, anisotropy: 1, maxTextureSize: 2048,
      quality: 'standard', loadTextures: false
    })
    const r = scene.report
    const name = `${pack.meta.id}/${env.id}`
    console.log(`  ${name.padEnd(36)}${String(r.objectCount).padStart(7)}${String(scene.objects.filter((o) => o.photoSurface).length).padStart(7)}${String(r.triangles).padStart(11)}${String(r.meshes).padStart(8)}${`${r.buildMs.toFixed(0)}ms`.padStart(8)}`)
    ok(r.missingAssets.length === 0, `${name}: no missing assets`, r.missingAssets.join(', '))
    ok(r.unknownSlots.length === 0, `${name}: no unknown slots`, r.unknownSlots.join(', '))
    ok(r.rejectedPlacements.length === 0, `${name}: no rejected placements`, JSON.stringify(r.rejectedPlacements))
    ok(r.objectCount === env.placements.length, `${name}: every placement becomes an object (${r.objectCount}/${env.placements.length})`)
    ok(r.triangles <= TRIANGLE_BUDGET, `${name}: ${r.triangles} triangles within ${TRIANGLE_BUDGET}`)
    ok(scene.objects.some((o) => o.photoSurface), `${name}: has at least one photo surface`)
    for (const o of scene.objects) {
      ok(o.label.trim().length > 0, `${name}/${o.id}: labelled`)
      const eye = o.viewpoint.position
      const inside = scene.walkable.containsPoint(new THREE.Vector3(eye.x, scene.walkable.min.y, eye.z))
      ok(inside, `${name}/${o.id}: viewpoint inside the walkable area`, `${eye.x.toFixed(2)}, ${eye.z.toFixed(2)}`)
      const blocked = scene.blockers.some((b) => b.min.x - 0.2 < eye.x && eye.x < b.max.x + 0.2 && b.min.z - 0.2 < eye.z && eye.z < b.max.z + 0.2 && b.max.y > 0.3)
      ok(!blocked, `${name}/${o.id}: viewpoint clear of blockers`)
    }
    // Relabel in Hindi and back, then dispose: every geometry the scene made is released.
    await i18n.setLanguage('hi')
    scene.relabel(i18n)
    ok(scene.objects.every((o) => /[ऀ-ॿ]/.test(o.label)), `${name}: labels relabel into Hindi`)
    await i18n.setLanguage('en')
    scene.relabel(i18n)
    let disposed = 0
    const geometries = new Set<THREE.BufferGeometry>()
    scene.root.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) geometries.add(m.geometry) })
    for (const g of geometries) g.addEventListener('dispose', () => disposed++)
    scene.dispose()
    ok(disposed > 0, `${name}: dispose() releases geometry (${disposed}/${geometries.size})`)
  }
}

console.log('')
if (failures.length) {
  console.log(`${failures.length} of ${checks} checks FAILED:`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exit(1)
}
console.log(`ALL CHECKS PASSED (${checks})`)
