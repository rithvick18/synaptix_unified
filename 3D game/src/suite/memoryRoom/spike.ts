/**
 * DEV ONLY — never imported by production code. Phase-1 spike: pick a photo, estimate depth
 * on this device, and look around the resulting relief.
 *   npx vite --port 5195  →  http://localhost:5195/src/suite/memoryRoom/spike.html
 */
import * as THREE from 'three'
import { buildDepthGeometry, type DepthMap } from './depthMesh'

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const status = $('status')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(innerWidth, innerHeight)
renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
$('app').appendChild(renderer.domElement)
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x0e0f11)
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 50)
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() })

const worker = new Worker(new URL('./depth.worker.ts', import.meta.url), { type: 'module' })
let current: { depth: DepthMap; texture: THREE.Texture; aspect: number } | null = null
let mesh: THREE.Mesh | null = null
let backdrop: THREE.Mesh | null = null
let nextId = 1

function rebuild(): void {
  if (!current) return
  mesh?.geometry.dispose()
  const geo = buildDepthGeometry(current.depth, current.aspect, {
    relief: Number($<HTMLInputElement>('relief').value), edgeCut: Number($<HTMLInputElement>('edge').value)
  })
  if (!mesh) {
    mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: current.texture, side: THREE.DoubleSide, vertexColors: true, transparent: true }))
    scene.add(mesh)
  } else { mesh.geometry = geo; (mesh.material as THREE.MeshBasicMaterial).map = current.texture }
  ;(mesh.material as THREE.MeshBasicMaterial).wireframe = $<HTMLInputElement>('wire').checked
}
for (const id of ['relief', 'edge', 'wire']) $(id).addEventListener('input', rebuild)

function drawDepth(d: DepthMap): void {
  const c = $<HTMLCanvasElement>('depthview')
  c.width = d.width; c.height = d.height
  const ctx = c.getContext('2d')!, img = ctx.createImageData(d.width, d.height)
  let lo = Infinity, hi = -Infinity
  for (const v of d.data) { lo = Math.min(lo, v); hi = Math.max(hi, v) }
  for (let i = 0; i < d.data.length; i++) { const g = ((d.data[i] - lo) / (hi - lo || 1)) * 255; img.data.set([g, g, g, 255], i * 4) }
  ctx.putImageData(img, 0, 0)
}
$('showdepth').addEventListener('change', () => { $('depthview').style.display = $<HTMLInputElement>('showdepth').checked ? 'block' : 'none' })

async function fit(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const s = Math.min(1, 1024 / Math.max(bmp.width, bmp.height))
  const c = new OffscreenCanvas(Math.round(bmp.width * s), Math.round(bmp.height * s))
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.92 }) // re-encode strips EXIF, as in agent/images.ts
}

$<HTMLInputElement>('file').addEventListener('change', async (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  status.textContent = 'Estimating depth…'
  const image = await fit(file)
  const id = nextId++
  worker.postMessage({ id, image, base: new URL('./depth-models/', document.baseURI).href })
  const tex = new THREE.Texture(await createImageBitmap(image))
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  const aspect = tex.image.width / tex.image.height
  worker.onmessage = (m: MessageEvent) => {
    if (m.data.id !== id) return
    if (m.data.error) { status.textContent = 'Depth failed: ' + m.data.error; return }
    current = { depth: { width: m.data.width, height: m.data.height, data: m.data.data }, texture: tex, aspect }
    drawDepth(current.depth)
    status.textContent = `Depth ${m.data.width}×${m.data.height} in ${Math.round(m.data.ms)} ms`
    // Blurred, enlarged copy far behind so edges never show empty space.
    if (!backdrop) {
      const plane = new THREE.PlaneGeometry(1, 1)
      const uv = plane.attributes.uv // default plane UVs assume a flipped texture; ours is not
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
      backdrop = new THREE.Mesh(plane, new THREE.MeshBasicMaterial())
      scene.add(backdrop)
    }
    const bm = backdrop.material as THREE.MeshBasicMaterial
    bm.map?.dispose()
    bm.map = blurred(image); bm.color.set(0x777777); bm.needsUpdate = true
    backdrop.scale.set(aspect * 3, 3, 1); backdrop.position.z = -1.5
    rebuild()
  }
})

/** A small, heavily blurred copy: a soft surround, not a second copy of the room. */
function blurred(blob: Blob): THREE.Texture {
  const tex = new THREE.Texture()
  tex.colorSpace = THREE.SRGBColorSpace
  createImageBitmap(blob).then((bmp) => {
    const c = new OffscreenCanvas(128, Math.max(1, Math.round((128 * bmp.height) / bmp.width)))
    const ctx = c.getContext('2d')!
    ctx.filter = 'blur(6px)'
    ctx.drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close()
    tex.image = c; tex.needsUpdate = true
  })
  return tex
}

const pointer = new THREE.Vector2()
addEventListener('pointermove', (e) => { pointer.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1) })
const look = new THREE.Vector2()
renderer.setAnimationLoop(() => {
  const max = THREE.MathUtils.degToRad(Number($<HTMLInputElement>('motion').value))
  look.lerp(pointer, 0.06)
  const dist = 1.4, ax = look.x * max, ay = look.y * max
  camera.position.set(Math.sin(ax) * dist, -Math.sin(ay) * dist * 0.6, Math.cos(ax) * dist)
  camera.lookAt(0, 0, -0.15)
  renderer.render(scene, camera)
})
