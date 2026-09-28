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
 *   - photo rooms: their panorama files are vendored and attributed; under node they build
 *     with a neutral backdrop and no light fetched; the seat is the lens; every viewpoint and
 *     every walk stays within the parallax radius of it, and close looks zoom instead
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as THREE from 'three'
import type { JsonLoader } from '../../src/suite/contracts'
import { BUILDERS, loadAssetLibrary } from '../../src/suite/assets'
import { loadContentPacksWithShells } from '../../src/suite/content'
import { SHELLS, SHELL_DEFS, buildSuiteScene, panoramaDirection, panoramaFloorPoint, type SuiteSceneReport } from '../../src/suite/environments'
import { SEAT_FOV } from '../../src/suite/environments/viewpoint'
import { walkStep } from '../../src/suite/app/navigator'
import { pickObject } from '../../src/suite/app/highlight'
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

// ---- photo rooms: files and the photograph's geometry helpers
const photoShells = Object.values(SHELL_DEFS).filter((d) => d.photo)
ok(photoShells.length >= 1, `at least one photo room is registered (${photoShells.map((d) => d.id).join(', ')})`)
{
  const attribution = fs.readFileSync(path.join(SUITE, 'assets', 'ATTRIBUTION.md'), 'utf8')
  const sourcesFile = path.join(SUITE, 'assets', 'panoramas', 'sources.json')
  const sources = fs.existsSync(sourcesFile) ? (JSON.parse(fs.readFileSync(sourcesFile, 'utf8')).panoramas as { files: { display: { file: string }; lighting: { file: string } }; license: string }[]) : []
  for (const def of photoShells) {
    const { display, lighting } = def.photo!.panorama
    for (const file of [display, lighting]) {
      const full = path.join(SUITE, file)
      ok(fs.existsSync(full), `${def.id}: ${file} is vendored under public/suite/`)
      const rel = file.replace(/^assets\//, '')
      ok(attribution.includes(rel), `${def.id}: ATTRIBUTION.md lists ${rel}`)
      ok(sources.some((p) => (p.files.display.file === rel || p.files.lighting.file === rel) && !!p.license), `${def.id}: panoramas/sources.json records ${rel} with a licence`)
    }
    ok(fs.statSync(path.join(SUITE, display)).size <= 3_000_000, `${def.id}: the backdrop is 3 MB or less`)
  }
  // Column u faces −z when yaw = 2π(u − 0.5); the floor below the horizon is at y = 0.
  const yaw = 1.1
  const ahead = panoramaDirection(0.5 + yaw / (2 * Math.PI), 0.5, yaw)
  ok(ahead.distanceTo(new THREE.Vector3(0, 0, -1)) < 1e-9, 'panoramaDirection: the yawed column looks along −z')
  const right = panoramaDirection(0.75 + yaw / (2 * Math.PI), 0.5, yaw)
  ok(right.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-9, 'panoramaDirection: a quarter of the image further right is +x')
  const floor = panoramaFloorPoint(0.5 + yaw / (2 * Math.PI), 0.75, yaw, 1.4)
  ok(!!floor && Math.abs(floor.y) < 1e-9 && Math.abs(floor.z + 1.4) < 1e-9, 'panoramaFloorPoint: 45° down lands cameraHeight ahead, on the floor')
}

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
    ok(SHELL_DEFS[env.shell].photo ? scene.objects.every((o) => !o.photoSurface) : scene.objects.some((o) => o.photoSurface),
      `${name}: photographed targets remain part of the photograph; modelled rooms have a photo surface`)
    for (const o of scene.objects) {
      ok(o.label.trim().length > 0, `${name}/${o.id}: labelled`)
      const eye = o.viewpoint.position
      const inside = scene.walkable.containsPoint(new THREE.Vector3(eye.x, scene.walkable.min.y, eye.z))
      ok(inside, `${name}/${o.id}: viewpoint inside the walkable area`, `${eye.x.toFixed(2)}, ${eye.z.toFixed(2)}`)
      const blocked = scene.blockers.some((b) => b.min.x - 0.2 < eye.x && eye.x < b.max.x + 0.2 && b.min.z - 0.2 < eye.z && eye.z < b.max.z + 0.2 && b.max.y > 0.3)
      ok(!blocked, `${name}/${o.id}: viewpoint clear of blockers`)
    }
    const photo = SHELL_DEFS[env.shell].photo
    if (photo) {
      const h = photo.panorama.cameraHeight
      const radius = photo.parallax ?? 0.25
      const lens = new THREE.Vector3(0, h, 0)
      ok(scene.seat.position.distanceTo(lens) < 1e-9, `${name}: the seat is the lens (0, ${h}, 0)`)
      const warnings = (r as SuiteSceneReport).warnings
      ok(warnings.length === 0, `${name}: builds with no warnings`, warnings.map((w) => w.message).join('; '))
      ok(!scene.environment, `${name}: under node no light is fetched (no environment)`)
      const backdrop = scene.root.getObjectByName('photo:backdrop') as THREE.Mesh | undefined
      const mat = backdrop?.material as THREE.MeshBasicMaterial | undefined
      ok(!!mat && !mat.map && !mat.toneMapped && mat.color.getHex() !== 0, `${name}: under node the backdrop is a plain neutral colour, drawn untoned`)
      for (const o of scene.objects) {
        const eye = o.viewpoint.position
        ok(Math.abs(eye.x) <= radius + 1e-6 && Math.abs(eye.z) <= radius + 1e-6 && Math.abs(eye.y - h) < 1e-6,
          `${name}/${o.id}: viewpoint within the parallax radius (${radius} m) of the lens`, `${eye.x.toFixed(2)}, ${eye.y.toFixed(2)}, ${eye.z.toFixed(2)}`)
        const fov = o.viewpoint.fov
        ok(fov !== undefined && fov >= SEAT_FOV.min && fov <= SEAT_FOV.max, `${name}/${o.id}: a closer look is a zoom (${fov}°)`)
        const camera = new THREE.PerspectiveCamera(scene.seat.fov ?? 70, 1, 0.05, 100)
        camera.position.copy(scene.seat.position)
        camera.lookAt(o.focus)
        camera.updateMatrixWorld(true)
        ok(pickObject({ x: 0, y: 0 }, camera, scene.objects)?.id === o.id,
          `${name}/${o.id}: the photographed object can be selected at its visual centre`)
      }
      // A long walk in every direction never leaves the parallax box.
      let pos = { x: 0, z: 0 }, worst = 0
      for (let i = 0; i < 400; i++) {
        const a = i * 2.39996
        pos = walkStep(pos, { x: Math.cos(a) * 0.3, z: Math.sin(a) * 0.3 }, scene.blockers, scene.walkable)
        worst = Math.max(worst, Math.abs(pos.x), Math.abs(pos.z))
      }
      ok(worst <= radius + 1e-6, `${name}: walking stays within ${radius} m of the lens (${worst.toFixed(3)})`)
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
