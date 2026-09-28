/**
 * Dev-only: builds one starter environment with the real scene builder inside the game's
 * own Renderer (same lights, HDRI, tone mapping), so how a room looks can be checked
 * without clicking through the app. Served by `vite` from the project root; never part of
 * the app build. Driven by tools/suite/assets/screenshot-environments.mjs.
 *
 *   http://localhost:5191/tools/suite/assets/preview.html?pack=everyday-home&env=living-room
 *   &quality=standard|low   &ao=0 (as the software/baseline tiers draw)   &reflect=0
 *   &view=seat | <placement id> | look:<yaw>,<pitch>[,<fov>]
 *
 * For authoring a room, and a photo room's slots in particular:
 *   ?shell=<shellId>       the bare shell with no placements (a panorama with no preset yet)
 *   &grid=1                a 1 m floor grid (0.5 m faint) with the x and z axes labelled in
 *                          metres and the seat marked: where the floor is, in slot coordinates
 *   &slots=1               every slot's maxSize as a wireframe box, labelled with its id
 *                          (orange floor, green surface, blue wall, purple hanging)
 *   &probe=1               a matte white ball and a mirror ball 1.6 m ahead: brightness and
 *                          the lighting's turn against the photograph
 *   &yaw=&pitch=&fov=      degrees: point the camera from the seat (yaw 0 looks along −z,
 *                          positive turns right; pitch positive looks up; fov is vertical)
 * The grid and slot overlays switch ambient occlusion off, so it cannot shade around them.
 */
import * as THREE from 'three'
import { Renderer } from '../../../src/Renderer'
import { loadAssetLibrary } from '../../../src/suite/assets'
import { loadContentPacks } from '../../../src/suite/content'
import { SHELL_DEFS, buildSuiteScene } from '../../../src/suite/environments'
import type { SlotDef } from '../../../src/suite/environments/shells'
import { loadI18n } from '../../../src/suite/i18n'
import type { ShellId, SuiteScene } from '../../../src/suite/contracts'

const q = new URLSearchParams(location.search)
const shellOnly = q.get('shell') as ShellId | null
const packId = q.get('pack') ?? 'everyday-home'
const envId = shellOnly ? 'shell-preview' : q.get('env') ?? 'living-room'
const quality = q.get('quality') === 'low' ? 'low' : 'standard'
const overlays = q.get('grid') === '1' || q.get('slots') === '1'
const DEG = Math.PI / 180

const r = new Renderer(document.getElementById('app')!)
if (q.get('ao') !== '0' && quality === 'standard' && !overlays) r.enableAmbientOcclusion()
let scene: SuiteScene | null = null
const baseFov = r.camera.fov

/** Seat-relative look: yaw 0 along −z, positive to the right; pitch positive up (degrees). */
function look(yaw: number, pitch: number, fov: number): void {
  if (!scene) return
  const cam = r.camera
  cam.position.copy(scene.seat.position)
  const dir = new THREE.Vector3(Math.sin(yaw * DEG) * Math.cos(pitch * DEG), Math.sin(pitch * DEG), -Math.cos(yaw * DEG) * Math.cos(pitch * DEG))
  cam.lookAt(cam.position.clone().add(dir))
  cam.fov = fov
  cam.updateProjectionMatrix()
}

function view(name: string): void {
  if (!scene) return
  const cam = r.camera
  cam.fov = baseFov
  cam.updateProjectionMatrix()
  if (name.startsWith('look:')) {
    const [yaw, pitch = 0, fov = baseFov] = name.slice(5).split(',').map(Number)
    look(yaw, pitch, fov)
  } else if (name === 'seat') {
    cam.fov = scene.seat.fov ?? baseFov
    cam.updateProjectionMatrix()
    if (q.has('yaw') || q.has('pitch') || q.has('fov')) {
      const s = scene.seat
      const rest = new THREE.Vector3().subVectors(s.target, s.position)
      const restYaw = Math.atan2(rest.x, -rest.z) / DEG
      const restPitch = Math.atan2(rest.y, Math.hypot(rest.x, rest.z)) / DEG
      look(Number(q.get('yaw') ?? restYaw), Number(q.get('pitch') ?? restPitch), Number(q.get('fov') ?? baseFov))
    } else {
      cam.position.copy(scene.seat.position)
      cam.lookAt(scene.seat.target)
    }
  } else {
    const obj = scene.objects.find((o) => o.id === name)
    if (!obj) throw new Error(`no object ${name}`)
    cam.position.copy(obj.viewpoint.position)
    cam.lookAt(obj.viewpoint.target)
    // A photo room's viewpoint zooms rather than moves (navigator.ts does the same).
    if (obj.viewpoint.fov) { cam.fov = obj.viewpoint.fov; cam.updateProjectionMatrix() }
  }
  cam.updateMatrixWorld()
  r.refreshShadows()
  r.render()
}

// ---------------------------------------------------------------- authoring overlays

function label(text: string, colour: string, size = 0.032): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = 'bold 40px sans-serif'
  canvas.width = Math.ceil(ctx.measureText(text).width) + 24
  canvas.height = 56
  ctx.font = 'bold 40px sans-serif'
  ctx.fillStyle = 'rgba(0,0,0,0.62)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = colour
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, 29)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, toneMapped: false, sizeAttenuation: false }))
  sprite.scale.set((size * canvas.width) / canvas.height, size, 1)
  sprite.renderOrder = 20
  return sprite
}

function lines(points: number[], colour: number, opacity = 1, depthTest = true): THREE.LineSegments {
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  const mat = new THREE.LineBasicMaterial({ color: colour, transparent: opacity < 1, opacity, depthTest, toneMapped: false })
  const seg = new THREE.LineSegments(geo, mat)
  seg.renderOrder = 10
  return seg
}

function grid(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'preview:grid'
  const R = 5, y = 0.004
  const major: number[] = [], minor: number[] = []
  for (let v = -R; v <= R + 1e-6; v += 0.5) {
    const into = Math.abs(v - Math.round(v)) < 1e-6 ? major : minor
    into.push(v, y, -R, v, y, R, -R, y, v, R, y, v)
  }
  g.add(lines(minor, 0x7fe8ff, 0.35), lines(major, 0x3fd8ff, 0.9))
  g.add(lines([-R, y + 0.001, 0, R, y + 0.001, 0], 0xff5050), lines([0, y + 0.001, -R, 0, y + 0.001, R], 0x50ff70))
  for (let v = -R; v <= R; v++) {
    if (v === 0) continue
    const x = label(`x ${v}`, '#ff8080', 0.026); x.position.set(v, y, 0); g.add(x)
    const z = label(`z ${v}`, '#80ff90', 0.026); z.position.set(0, y, v); g.add(z)
  }
  if (scene) {
    const s = scene.seat.position
    g.add(lines([s.x - 0.15, y, s.z, s.x + 0.15, y, s.z, s.x, y, s.z - 0.15, s.x, y, s.z + 0.15], 0xffffff))
    const seat = label(`seat (${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`, '#ffffff', 0.026)
    seat.position.set(s.x, y, s.z)
    g.add(seat)
    const w = scene.walkable
    g.add(lines([w.min.x, y, w.min.z, w.max.x, y, w.min.z, w.max.x, y, w.min.z, w.max.x, y, w.max.z,
      w.max.x, y, w.max.z, w.min.x, y, w.max.z, w.min.x, y, w.max.z, w.min.x, y, w.min.z], 0xffffff, 0.7))
  }
  return g
}

const SLOT_COLOURS: Record<string, [number, string]> = {
  floor: [0xff9a3c, '#ffb26b'], surface: [0x5cff7a, '#8dff9f'], wall: [0x4aa8ff, '#8cc6ff'], hang: [0xc07cff, '#d7a8ff']
}

function slotBoxes(slots: readonly SlotDef[]): THREE.Group {
  const g = new THREE.Group()
  g.name = 'preview:slots'
  for (const slot of slots) {
    const [w, h, d] = slot.maxSize
    const kind = slot.hang ? 'hang' : slot.mount
    const [colour, text] = SLOT_COLOURS[kind]
    const box = new THREE.BoxGeometry(w, h, d)
    // Slot semantics (shells/types.ts): base centre, picture centre, or top attachment point.
    if (slot.hang) box.translate(0, -h / 2, 0)
    else if (slot.mount === 'wall') box.translate(0, 0, d / 2)
    else box.translate(0, h / 2, 0)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    const seg = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: colour, depthTest: false, toneMapped: false }))
    seg.renderOrder = 11
    seg.position.set(...slot.position)
    seg.rotation.y = slot.yaw
    // A tick showing the way the slot faces (+z of the slot).
    const facing = lines([0, 0.01, 0, 0, 0.01, Math.min(0.35, d / 2 + 0.2)], colour, 1, false)
    seg.add(facing)
    g.add(seg)
    const tag = label(slot.id, text, 0.026)
    const top = slot.hang ? 0.05 : slot.mount === 'wall' ? h / 2 + 0.06 : h + 0.06
    tag.position.set(slot.position[0], slot.position[1] + top, slot.position[2])
    g.add(tag)
  }
  return g
}

function probes(): THREE.Group {
  const g = new THREE.Group()
  g.name = 'preview:probe'
  if (!scene) return g
  const s = scene.seat.position
  const ahead = new THREE.Vector3(0, 0, -1.6).add(new THREE.Vector3(s.x, 0, s.z))
  const ball = new THREE.SphereGeometry(0.14, 48, 24)
  const matte = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 }))
  matte.position.set(ahead.x - 0.2, 0.14, ahead.z)
  const mirror = new THREE.Mesh(ball, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.02, metalness: 1 }))
  mirror.position.set(ahead.x + 0.2, 0.14, ahead.z)
  for (const m of [matte, mirror]) { m.castShadow = true; m.receiveShadow = true; g.add(m) }
  return g
}

async function main(): Promise<void> {
  const env = await r.setupEnvironment()
  const i18n = await loadI18n({ initial: 'en' })
  const library = await loadAssetLibrary()
  const { packs } = await loadContentPacks(library)
  let pack = packs.find((p) => p.meta.id === packId)
  if (!pack) throw new Error(`no pack ${packId}`)
  if (shellOnly) {
    if (!SHELL_DEFS[shellOnly]) throw new Error(`no shell ${shellOnly}`)
    const empty = { en: shellOnly, hi: shellOnly }
    pack = { ...pack, environments: [{ id: envId, shell: shellOnly, name: empty, description: empty, placements: [] }] }
  }
  const device = r.deviceInfo()
  scene = await buildSuiteScene({
    pack, environmentId: envId, library, i18n, quality,
    anisotropy: Math.min(8, device.maxAnisotropy), maxTextureSize: device.maxTextureSize
  })
  r.scene.add(scene.root)
  if (q.get('grid') === '1') scene.root.add(grid())
  if (q.get('slots') === '1') scene.root.add(slotBoxes(SHELL_DEFS[scene.shell].slots))
  if (q.get('probe') === '1') scene.root.add(probes())
  // As the app does: a photo room brings its own light; any other room is captured.
  if (scene.environment) r.useLocalEnvironment(scene.environment.map, scene.environment.intensity, scene.environment.rotation)
  else if (q.get('reflect') !== '0') r.captureLocalEnvironment(scene.seat.position)
  view(q.get('view') ?? 'seat')
  const w = window as unknown as Record<string, unknown>
  w.previewView = (name: string) => { view(name); return true }
  w.previewObjects = () => scene!.objects.map((o) => o.id)
  w.previewReport = () => ({ ...scene!.report, hdri: env.hdri, calls: r.renderer.info.render.calls, photo: !!scene!.environment })
  // For a person at the console, or a CDP script, poking at the built scene.
  w.previewScene = () => scene
  w.previewReady = true
}

main().catch((error) => {
  ;(window as unknown as Record<string, unknown>).previewError = String(error?.stack ?? error)
  console.error(error)
})

// Keeps the loop alive for a person looking at the page (the screenshot driver renders on demand).
const clock = new THREE.Clock()
r.renderer.setAnimationLoop(() => { scene?.update(clock.getDelta()); if (q.get('live')) r.render() })
