/**
 * Dev-only harness for render-thumbnails.mjs: renders one procedural asset, with its real
 * builder and the flat palette, to a 256 × 256 PNG data URL. Served by `vite` from the
 * project root; never part of the app build.
 */
import * as THREE from 'three'
import type { AssetDef } from '../../../src/suite/contracts'
import { acquireProcedural } from '../../../src/suite/assets/prototypes'
import { FLAT_ENV } from '../../../src/suite/assets/materials'

const SIZE = 256
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
renderer.setSize(SIZE, SIZE)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
document.body.append(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#f4eee4')
scene.add(new THREE.HemisphereLight(0xfff4e6, 0x8a7a66, 1.6))
const sun = new THREE.DirectionalLight(0xffffff, 2.2)
sun.position.set(2, 4, 3)
scene.add(sun)
const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50)

let defs: AssetDef[] = []
const ready = fetch('/suite/assets/manifest.json').then((r) => r.json()).then((m) => { defs = m.assets })

async function renderThumb(id: string): Promise<string> {
  await ready
  const def = defs.find((d) => d.id === id)
  if (!def) throw new Error(`no asset ${id}`)
  const proto = acquireProcedural(def, FLAT_ENV, 'standard')
  const object = proto.object.clone()
  scene.add(object)
  const box = new THREE.Box3().setFromObject(object)
  const centre = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const radius = Math.max(size.length() / 2, 0.05)
  const distance = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05
  // Wall items are seen straight on; everything else from a three-quarter view.
  const dir = def.mount === 'wall' ? new THREE.Vector3(0.25, 0.1, 1) : new THREE.Vector3(0.7, 0.55, 1)
  camera.position.copy(centre).addScaledVector(dir.normalize(), distance)
  camera.lookAt(centre)
  camera.updateProjectionMatrix()
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(object)
  return url
}

;(window as unknown as { renderThumb: typeof renderThumb; thumbIds: () => Promise<string[]> }).renderThumb = renderThumb
;(window as unknown as { thumbIds: () => Promise<string[]> }).thumbIds = async () => { await ready; return defs.map((d) => d.id) }
