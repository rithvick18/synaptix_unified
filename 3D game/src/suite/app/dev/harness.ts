/**
 * DEV ONLY — never imported by production code. Drives the suite app with fakes built
 * from the contract types (a box-furnished room, a two-item activity) plus the real
 * i18n module, so the screens can be checked in a browser before the other modules land.
 *
 *   npx vite --port 5194  →  http://localhost:5194/src/suite/app/dev/harness.html
 *   ?screen=home|place|activity|explore|closeup|pause|summary|settings  &lang=hi  &hc=1  &scale=1.5
 */
import * as THREE from 'three'
import type {
  ActivityDefinition, ActivityItem, ActivityKind, ActivitySessionApi, AssetLibrary, DisplayPhoto, LoadedContentPack,
  SceneObject, SessionEvent, SuiteHost, SuiteScene
} from '../../contracts'
import { loadI18n } from '../../i18n'
import { createSuiteAppWith } from '../app'
import { summaryFromLog } from '../summary'

const q = new URLSearchParams(location.search)
if (q.get('fresh') !== '0') try { localStorage.removeItem('memoria-suite-settings-v1') } catch { /* ignore */ }
if (q.get('hc') || q.get('scale')) {
  localStorage.setItem('memoria-suite-settings-v1', JSON.stringify({ highContrast: q.get('hc') === '1', textScale: Number(q.get('scale') ?? 1) }))
}

const app = document.getElementById('app')!
const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
app.appendChild(renderer.domElement)
const scene3 = new THREE.Scene()
scene3.background = new THREE.Color(0x8fb3d9)
scene3.add(new THREE.HemisphereLight(0xffffff, 0x886644, 2.2))
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 120)
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() })

// ---- fake content ------------------------------------------------------------------
const svg = (fill: string, label: string): string =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="${fill}"/><text x="20" y="130" font-size="28" fill="#333">${label}</text></svg>`)
const pack = (id: string, regional: boolean): LoadedContentPack => ({
  meta: { schema: 1, id, name: regional ? 'Northeast home (fake)' : 'Everyday home (fake)', description: 'Harness pack built from fakes.',
    status: regional ? 'preview' : 'starter', regional, coverageNote: 'Fake coverage note for the harness.',
    files: { environments: '', content: '' }, authors: [] },
  baseUrl: location.origin + '/',
  environments: regional
    ? [{ id: 'ne-veranda', shell: 'courtyardVeranda', name: 'Veranda', description: 'A covered veranda.', thumbnail: svg('#d8e6c8', 'Veranda'), placements: [] }]
    : [{ id: 'living-room', shell: 'livingRoom', name: 'Living room', description: 'A sofa, a radio and pictures.', thumbnail: svg('#ecd9bd', 'Living room'), placements: [] },
       { id: 'kitchen-dining', shell: 'kitchenDining', name: 'Kitchen and dining', description: 'Steel vessels and a table.', thumbnail: svg('#f1e4cf', 'Kitchen'), placements: [] }],
  prompts: [], sounds: [], images: [], assets: [], problems: []
})
const broken = { ...pack('broken-pack', false), problems: [{ severity: 'error' as const, where: 'packs/broken', message: 'fake error' }] }
broken.meta = { ...broken.meta, id: 'broken-pack', name: 'Broken pack (fake)' }
const library = { get: () => undefined, all: () => [], url: (p: string) => p, addPackAssets: () => [], problems: [] } as AssetLibrary

function buildScene(packId: string, environmentId: string): SuiteScene {
  const root = new THREE.Group()
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0xc9a77c }))
  floor.rotation.x = -Math.PI / 2
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshStandardMaterial({ color: 0xf2e6d2 }))
  wall.position.set(0, 1.5, -3)
  root.add(floor, wall)
  const mk = (id: string, label: string, color: number, pos: [number, number, number], size: [number, number, number], photo = false): SceneObject => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshStandardMaterial({ color })))
    g.position.set(...pos)
    root.add(g)
    const focus = new THREE.Vector3(...pos)
    return { id, assetId: id, category: 'furniture', label, description: `A fake ${label.toLowerCase()} for the harness.`, object: g, focus,
      viewpoint: { position: focus.clone().add(new THREE.Vector3(0, 0.3, 1.6)), target: focus.clone() },
      activities: ['object', 'space', 'photo'], photoSurface: photo ? { width: 0.6, height: 0.45, show: () => undefined, blank: () => undefined, reset: () => undefined } : null,
      personal: false, highlight: false, topics: [] }
  }
  const objects = [
    mk('radio', 'Radio', 0x7a4a2a, [-1.5, 0.5, -2], [0.6, 0.4, 0.3]),
    mk('frame', 'Picture frame', 0x553311, [0, 1.6, -2.95], [0.7, 0.55, 0.05], true),
    mk('sofa', 'Sofa', 0x6b8e6b, [1.4, 0.4, -2.2], [1.6, 0.8, 0.8]),
    mk('clock', 'Wall clock', 0xddddcc, [-0.9, 2.2, -2.95], [0.4, 0.4, 0.05])
  ]
  return {
    packId, environmentId, shell: 'livingRoom', root, blockers: [], walkable: new THREE.Box3(new THREE.Vector3(-3.5, 0, -2.5), new THREE.Vector3(3.5, 3, 3.5)),
    spawn: { position: new THREE.Vector3(0, 0, 2.5), yaw: 0 },
    seat: { position: new THREE.Vector3(0, 1.2, 2.2), target: new THREE.Vector3(0, 1, -2) },
    objects, audioAnchor: objects[0].object,
    report: { packId, environmentId, objectCount: objects.length, missingAssets: [], fallbacksUsed: [], unknownSlots: [], rejectedPlacements: [], triangles: 0, meshes: 0, textureKB: 0, buildMs: 1 },
    relabel: () => undefined, dispose: () => root.traverse((n) => { const m = n as THREE.Mesh; if (m.isMesh) { m.geometry.dispose(); (m.material as THREE.Material).dispose() } })
  }
}
const demoPhoto: DisplayPhoto = { id: 'pic-river-dusk', url: svg('#c9d8e8', 'Demo picture (fake)'), thumbUrl: '', width: 320, height: 240,
  caption: 'A river at dusk (illustration)', people: [], personal: false, notice: 'Demo picture: an illustration, not a real memory',
  prompt: { text: 'Would you like to tell us about this picture?', lang: 'en', source: 'generic' }, topics: [], texture: async () => null }

const def = (kind: ActivityKind, name: string): ActivityDefinition => ({
  kind, nameKey: name, descriptionKey: name, answerMode: 'open-ended',
  available: () => (kind === 'sound' ? { ok: false, reasonKey: 'app.activity.setupHint' } : { ok: true }),
  items: (ctx) => kind === 'photo'
    ? [{ id: 'p1', kind: 'photo', title: 'River at dusk', prompt: demoPhoto.prompt, personal: false, photo: demoPhoto, objectId: 'frame' }]
    : ctx.scene.objects.slice(0, 3).map((o): ActivityItem => ({ id: `i-${o.id}`, kind: 'object', objectId: o.id, title: o.label, personal: false,
        prompt: { text: `Would you like to tell us about the ${o.label.toLowerCase()}?`, lang: 'en', source: 'generic' } }))
})
const ACTIVITIES = { photo: def('photo', 'Photo exploration (fake)'), object: def('object', 'Familiar objects (fake)'), sound: def('sound', 'Sound and memory (fake)'),
  space: def('space', 'Familiar space (fake)'), sequence: def('sequence', 'Guided sequence (fake)') }

// ---- fake session -----------------------------------------------------------------
function fakeSession(o: Parameters<typeof createSuiteAppWith>[1]['createActivitySession'] extends (x: infer X) => unknown ? X : never): ActivitySessionApi {
  const items = o.definition.items(o.context)
  const log: SessionEvent[] = []
  const t0 = performance.now()
  const now = () => performance.now() - t0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())
  let index = -1, paused = false, ended = false, started = false
  const show = (i: number) => {
    index = Math.max(0, Math.min(items.length - 1, i)); const it = items[index]
    log.push({ t: now(), kind: 'item_shown', itemId: it.id, itemKind: it.kind, objectId: it.objectId })
    if (it.prompt) o.audio.playPrompt(it.prompt).then((via) => { log.push({ t: now(), kind: 'prompt_played', itemId: it.id, via }); emit() })
    emit()
  }
  const sum = (endedBy: 'finished' | 'exited') => { ended = true; log.push({ t: now(), kind: 'session_end', reason: endedBy });
    return summaryFromLog({ log, items, objects: o.context.scene.objects, activity: o.definition.kind, packId: o.context.pack.meta.id,
      environmentId: o.context.scene.environmentId, profile: o.context.profile ? 'saved' : 'demo', language: 'en', startedAt: new Date().toISOString(), endedBy }) }
  const api: ActivitySessionApi = {
    get activity() { return o.definition.kind }, items, get index() { return index }, get current() { return index >= 0 ? items[index] : null },
    get started() { return started }, get paused() { return paused }, get ended() { return ended }, log,
    adaptable: { active: true, current: null, stepIndex: 0, stepAgeMs: null, level: 0, instructionGate: null, requestHint: () => false,
      gentleCue: () => { const it = items[index]; if (!it) return false; log.push({ t: now(), kind: 'gentle_cue', itemId: it.id }); emit(); return true } },
    start: () => { started = true; log.push({ t: 0, kind: 'session_start', activity: o.definition.kind, packId: o.context.pack.meta.id, environmentId: o.context.scene.environmentId, profile: 'demo', language: 'en' }); if (items.length) show(0) },
    next: () => show(index + 1), previous: () => show(index - 1),
    skip: () => { const it = items[index]; if (it) log.push({ t: now(), kind: 'item_skipped', itemId: it.id }); show(index + 1) },
    goTo: (id) => show(items.findIndex((i) => i.id === id)),
    replayPrompt: () => { const it = items[index]; if (it?.prompt) { log.push({ t: now(), kind: 'prompt_replayed', itemId: it.id }); void o.audio.playPrompt(it.prompt) } emit() },
    playSound: () => undefined, stopSound: () => undefined,
    pause: () => { paused = true; log.push({ t: now(), kind: 'paused' }); emit() }, resume: () => { paused = false; log.push({ t: now(), kind: 'resumed' }); emit() },
    selectObject: (id) => { log.push({ t: now(), kind: 'object_selected', objectId: id }); emit() },
    noteCloseup: (open) => { const it = items[index]; log.push({ t: now(), kind: open ? 'closeup_opened' : 'closeup_closed', itemId: it?.id ?? '' }); emit() },
    addNote: (text, itemId) => { log.push({ t: now(), kind: 'caregiver_note', text, itemId }); emit() },
    exit: () => sum('exited'), finish: () => sum('finished'),
    onChange: (l) => { listeners.add(l); return () => listeners.delete(l) }
  }
  return api
}

// ---- host ---------------------------------------------------------------------------
let cameraOn = q.get('camera') === '1'
const host: SuiteHost = {
  root: app,
  three: { scene: scene3, camera, renderer, refreshShadows: () => undefined },
  listener: new THREE.AudioListener(),
  state: { current: 'completed', set: () => undefined, pause: () => undefined, resume: () => undefined, resetTimers: () => undefined },
  telemetry: { missionStart: () => undefined, missionComplete: () => undefined, stepStart: () => undefined, stepEnd: () => undefined, pause: () => undefined, resume: () => undefined },
  camera: { attach: () => undefined, openSetup: () => { cameraOn = !cameraOn }, summary: () => ({ on: cameraOn, status: cameraOn ? 'ready (fake)' : null }),
    snapshot: () => ({ visionUsable: true }) as never, adaptations: () => [] },
  quality: { tier: 'baseline', anisotropy: 4, maxTextureSize: 4096 },
  profile: { saved: undefined, storageWarning: q.get('warn') ? 'Browser storage is unavailable (fake warning).' : '' },
  setActive: (on) => { renderer.domElement.style.visibility = on ? 'visible' : 'hidden' },
  openGuidedTasks: () => console.log('[harness] guided tasks'),
  openHomePersonalisation: () => console.log('[harness] home personalisation')
}

const suite = createSuiteAppWith(host, {
  loadI18n, loadAssetLibrary: async () => library,
  loadContentPacks: async () => ({ packs: [pack('everyday-home', false), pack('northeast-home', true), broken], problems: [] }),
  packDisplayMedia: () => ({ demoPhotos: [demoPhoto], packSounds: [], dispose: () => undefined }),
  buildSuiteScene: async (o) => buildScene(o.pack.meta.id, o.environmentId),
  ACTIVITIES, createActivitySession: fakeSession,
  assignPhotos: () => new Map([['frame', demoPhoto]]),
  resolveSuiteProfile: async () => { throw new Error('no profile in the harness') },
  suiteOf: () => ({ version: 1, language: 'en', packId: null, environmentId: null, objects: {}, objectPrompts: {}, photos: [], sounds: [], topics: { include: [], avoid: [] }, mode: 'open', sequence: [], caregiverAssist: true }),
  openCaregiverSetup: (o) => { const d = document.createElement('div'); d.id = 'suite-setup'; d.textContent = 'fake caregiver setup'; o.root.append(d); setTimeout(() => { d.remove(); o.onClose() }, 1500) }
})
;(window as unknown as { __suite: unknown }).__suite = suite.debug
suite.showHome()

const clock = new THREE.Clock()
renderer.setAnimationLoop(() => { suite.update(Math.min(clock.getDelta(), 0.05)); renderer.render(scene3, camera) })

// Drive to a screen for screenshots.
const d = suite.debug as Record<string, (...a: unknown[]) => unknown>
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  while (!(suite.debug as { language: string | null }).language) await wait(20)
  if (q.get('lang')) await d.setLanguage(q.get('lang'))
  const screen = q.get('screen') ?? 'home'
  if (screen === 'place' || screen === 'activity') { d.go('place'); await wait(100); if (screen === 'activity') { d.go('activity'); await wait(200) } }
  if (screen === 'settings') d.openSettings()
  if (['explore', 'closeup', 'pause', 'summary', 'objcloseup'].includes(screen)) {
    await d.start('everyday-home', 'living-room', screen === 'closeup' ? 'photo' : 'object', 'demo')
    await wait(1500)
    if (screen === 'closeup' || screen === 'objcloseup') d.closeup()
    if (screen === 'pause') d.pause()
    if (screen === 'summary') { d.note('Talked about the old radio.'); d.next(); await wait(300); d.exit() }
  }
  document.title = 'ready'
})()
