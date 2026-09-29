/**
 * "Step into this photo": the photograph as a shallow 3D relief the viewer can look around
 * a little, with a soft blurred surround. It draws only what the photograph contains — the
 * surround is a blur of the same picture, nothing is generated — and the range of movement
 * is small and capped so it stays calm.
 *
 * Owns its own renderer, so it does not touch the main scene; `destroy()` releases the
 * canvas, the WebGL context and every texture.
 */
import * as THREE from 'three'
import { buildDepthGeometry, type DepthMap } from './depthMesh'

export interface MemoryRoomOptions {
  /** The photograph (any URL the page can read, e.g. an object URL). */
  photoUrl: string
  depth: DepthMap
  /** Accessible name and instructions for the viewing area. */
  label: string
  /** Largest tilt from straight-on, in degrees. */
  maxDegrees?: number
  /** Called if the photograph cannot be shown; the caller should fall back to the flat picture. */
  onError?: () => void
}

const FOV = 45
const FILL = 0.92
const BLUR_EDGE = 128
export const DEFAULT_MAX_DEGREES = 14
export const MAX_ALLOWED_DEGREES = 20

export class MemoryRoomView {
  readonly el: HTMLElement
  private readonly canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer | null = null
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 60)
  private readonly disposables: { dispose(): void }[] = []
  private readonly target = new THREE.Vector2()
  private readonly look = new THREE.Vector2()
  private aspect = 1
  private destroyed = false
  private readonly observer: ResizeObserver | null
  private readonly reduced: boolean
  private readonly maxRad: number

  constructor(private readonly opts: MemoryRoomOptions) {
    this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    this.maxRad = THREE.MathUtils.degToRad(Math.min(MAX_ALLOWED_DEGREES, Math.max(0, opts.maxDegrees ?? DEFAULT_MAX_DEGREES)))
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    this.el = document.createElement('div')
    this.el.className = 's-room'
    this.el.tabIndex = 0
    this.el.setAttribute('role', 'group')
    this.el.setAttribute('aria-label', opts.label)
    this.el.style.cssText = 'position:relative;flex:1;min-height:0;overflow:hidden;touch-action:none;background:#111;outline-offset:-3px'
    this.el.append(this.canvas)
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
      this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2))
    } catch {
      queueMicrotask(() => opts.onError?.())
    }
    this.scene.background = new THREE.Color(0x111111)
    this.observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.resize()) : null
    this.observer?.observe(this.el)
    this.bind()
    if (this.renderer) void this.build()
  }

  destroy(): void {
    this.destroyed = true
    this.observer?.disconnect()
    this.renderer?.setAnimationLoop(null)
    for (const d of this.disposables) d.dispose()
    this.renderer?.dispose()
    this.renderer?.forceContextLoss()
    this.renderer = null
    this.el.remove()
  }

  private async build(): Promise<void> {
    try {
      const blob = await (await fetch(this.opts.photoUrl)).blob()
      // Not flipped on decode: for an ImageBitmap the picture's top row is at v = 0, which is
      // how the relief's UVs are laid out.
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      if (this.destroyed) { bitmap.close(); return }
      this.aspect = bitmap.width / bitmap.height

      const photo = new THREE.Texture(bitmap as unknown as HTMLImageElement)
      photo.colorSpace = THREE.SRGBColorSpace
      photo.generateMipmaps = true
      photo.minFilter = THREE.LinearMipmapLinearFilter
      photo.needsUpdate = true
      this.disposables.push(photo, { dispose: () => bitmap.close() })

      const surround = this.blurredSurround(bitmap)
      this.disposables.push(surround)
      const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 20), new THREE.MeshBasicMaterial({ map: surround, color: 0x8a8a8a }))
      this.flipPlaneUvs(back.geometry as THREE.PlaneGeometry)
      back.position.z = -3
      back.renderOrder = 0
      this.disposables.push(back.geometry, back.material as THREE.Material)

      const geometry = buildDepthGeometry(this.opts.depth, this.aspect)
      const relief = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: photo, vertexColors: true, transparent: true, side: THREE.DoubleSide }))
      relief.renderOrder = 1
      this.disposables.push(geometry, relief.material as THREE.Material)
      this.scene.add(back, relief)

      this.resize()
      this.renderer?.setAnimationLoop(() => this.frame())
    } catch (error) {
      console.warn('[memory room] the photograph could not be shown', error)
      if (!this.destroyed) this.opts.onError?.()
    }
  }

  /** A tiny, heavily blurred copy: a soft surround, not a second copy of the scene. */
  private blurredSurround(bitmap: ImageBitmap): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = BLUR_EDGE
    canvas.height = Math.max(1, Math.round((BLUR_EDGE * bitmap.height) / bitmap.width))
    const ctx = canvas.getContext('2d')!
    ctx.filter = 'blur(6px)'
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  /** PlaneGeometry's UVs assume a flipped texture; ours is not. */
  private flipPlaneUvs(plane: THREE.PlaneGeometry): void {
    const uv = plane.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i))
  }

  private bind(): void {
    const aim = (e: PointerEvent): void => {
      const r = this.el.getBoundingClientRect()
      if (!r.width || !r.height) return
      this.target.set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1)
    }
    this.el.addEventListener('pointermove', aim)
    this.el.addEventListener('pointerdown', aim)
    this.el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.target.set(0, 0) })
    this.el.addEventListener('keydown', (e) => {
      const step = 0.4
      if (e.key === 'ArrowLeft') this.target.x = Math.max(-1, this.target.x - step)
      else if (e.key === 'ArrowRight') this.target.x = Math.min(1, this.target.x + step)
      else if (e.key === 'ArrowUp') this.target.y = Math.max(-1, this.target.y - step)
      else if (e.key === 'ArrowDown') this.target.y = Math.min(1, this.target.y + step)
      else if (e.key === 'Home') this.target.set(0, 0)
      else return
      e.preventDefault()
    })
  }

  private resize(): void {
    if (!this.renderer) return
    const w = this.el.clientWidth, h = this.el.clientHeight
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    const view = w / h
    this.camera.aspect = view
    this.camera.updateProjectionMatrix()
    // Far enough back that the whole picture fits, whatever its shape or the window's.
    const half = Math.tan(THREE.MathUtils.degToRad(FOV / 2))
    this.distance = Math.max(0.5 / half, (this.aspect / 2) / (half * view)) / FILL
  }

  private distance = 1.6

  private frame(): void {
    if (!this.renderer || document.hidden) return
    // Ease toward the target so movement is smooth, never abrupt.
    this.look.lerp(this.reduced ? new THREE.Vector2(0, 0) : this.target, 0.06)
    const ax = this.look.x * this.maxRad, ay = this.look.y * this.maxRad
    this.camera.position.set(Math.sin(ax) * this.distance, -Math.sin(ay) * this.distance * 0.6, Math.cos(ax) * this.distance)
    this.camera.lookAt(0, 0, -0.15)
    this.renderer.render(this.scene, this.camera)
  }
}
