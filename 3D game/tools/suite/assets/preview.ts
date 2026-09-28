/**
 * Dev-only: builds one starter environment with the real scene builder inside the game's
 * own Renderer (same lights, HDRI, tone mapping), so how a room looks can be checked
 * without clicking through the app. Served by `vite` from the project root; never part of
 * the app build. Driven by tools/suite/assets/screenshot-environments.mjs.
 *
 *   http://localhost:5191/tools/suite/assets/preview.html?pack=everyday-home&env=living-room
 *   &quality=standard|low   &view=seat|<placement id>   &ao=0 (as the software/baseline tiers draw)
 */
import * as THREE from 'three'
import { Renderer } from '../../../src/Renderer'
import { loadAssetLibrary } from '../../../src/suite/assets'
import { loadContentPacks } from '../../../src/suite/content'
import { buildSuiteScene } from '../../../src/suite/environments'
import { loadI18n } from '../../../src/suite/i18n'
import type { SuiteScene } from '../../../src/suite/contracts'

const q = new URLSearchParams(location.search)
const packId = q.get('pack') ?? 'everyday-home'
const envId = q.get('env') ?? 'living-room'
const quality = q.get('quality') === 'low' ? 'low' : 'standard'

const r = new Renderer(document.getElementById('app')!)
if (q.get('ao') !== '0' && quality === 'standard') r.enableAmbientOcclusion()
let scene: SuiteScene | null = null

function view(name: string): void {
  if (!scene) return
  const cam = r.camera
  if (name === 'seat') {
    cam.position.copy(scene.seat.position)
    cam.lookAt(scene.seat.target)
  } else {
    const obj = scene.objects.find((o) => o.id === name)
    if (!obj) throw new Error(`no object ${name}`)
    cam.position.copy(obj.viewpoint.position)
    cam.lookAt(obj.viewpoint.target)
  }
  cam.updateMatrixWorld()
  r.refreshShadows()
  r.render()
}

async function main(): Promise<void> {
  const env = await r.setupEnvironment()
  const i18n = await loadI18n({ initial: 'en' })
  const library = await loadAssetLibrary()
  const { packs } = await loadContentPacks(library)
  const pack = packs.find((p) => p.meta.id === packId)
  if (!pack) throw new Error(`no pack ${packId}`)
  const device = r.deviceInfo()
  scene = await buildSuiteScene({
    pack, environmentId: envId, library, i18n, quality,
    anisotropy: Math.min(8, device.maxAnisotropy), maxTextureSize: device.maxTextureSize
  })
  r.scene.add(scene.root)
  if (q.get('reflect') !== '0') r.captureLocalEnvironment(scene.seat.position)
  view(q.get('view') ?? 'seat')
  const w = window as unknown as Record<string, unknown>
  w.previewView = (name: string) => { view(name); return true }
  w.previewObjects = () => scene!.objects.map((o) => o.id)
  w.previewReport = () => ({ ...scene!.report, hdri: env.hdri, calls: r.renderer.info.render.calls })
  w.previewReady = true
}

main().catch((error) => {
  ;(window as unknown as Record<string, unknown>).previewError = String(error?.stack ?? error)
  console.error(error)
})

// Keeps the loop alive for a person looking at the page (the screenshot driver renders on demand).
const clock = new THREE.Clock()
r.renderer.setAnimationLoop(() => { scene?.update(clock.getDelta()); if (q.get('live')) r.render() })
