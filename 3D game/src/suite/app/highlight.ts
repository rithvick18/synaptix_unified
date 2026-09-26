/**
 * A soft, steady highlight for the object under the pointer or keyboard focus: a warm
 * emissive tint on cloned materials, restored (and the clones disposed) on unfocus.
 * No pulsing, no flashing. Also: picking scene objects with a ray.
 */
import * as THREE from 'three'
import type { SceneObject } from '../contracts'

const TINT = new THREE.Color('#ffcf8a')
const TINT_STRENGTH = 0.22

type Tintable = THREE.Material & { emissive?: THREE.Color; emissiveIntensity?: number }

export class Highlighter {
  private current: SceneObject | null = null
  private saved: { mesh: THREE.Mesh; material: THREE.Material | THREE.Material[] }[] = []
  private clones: THREE.Material[] = []

  get target(): SceneObject | null {
    return this.current
  }

  set(obj: SceneObject | null): void {
    if (obj === this.current) return
    this.clear()
    if (!obj) return
    this.current = obj
    obj.object.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh || !mesh.material) return
      const original = mesh.material
      const tint = (m: THREE.Material): THREE.Material => {
        const t = m as Tintable & { color?: THREE.Color }
        if (!t.emissive && !t.color) return m
        const c = m.clone() as Tintable & { color?: THREE.Color }
        if (t.emissive && c.emissive) {
          c.emissive = t.emissive.clone().lerp(TINT, TINT_STRENGTH)
          c.emissiveIntensity = Math.max(t.emissiveIntensity ?? 1, 1)
        } else if (t.color && c.color) {
          c.color = t.color.clone().lerp(TINT, TINT_STRENGTH)
        }
        this.clones.push(c)
        return c
      }
      const next = Array.isArray(original) ? original.map(tint) : tint(original)
      if (next === original || (Array.isArray(next) && Array.isArray(original) && next.every((m, i) => m === original[i]))) return
      this.saved.push({ mesh, material: original })
      mesh.material = next
    })
  }

  clear(): void {
    for (const { mesh, material } of this.saved) mesh.material = material
    for (const c of this.clones) c.dispose()
    this.saved = []
    this.clones = []
    this.current = null
  }
}

const ray = new THREE.Raycaster()

/** The scene object hit at normalised device coords, or null. Hidden objects are ignored. */
export function pickObject(ndc: { x: number; y: number }, camera: THREE.Camera, objects: readonly SceneObject[]): SceneObject | null {
  const byRoot = new Map<THREE.Object3D, SceneObject>()
  const roots: THREE.Object3D[] = []
  for (const o of objects) {
    if (!o.object.visible) continue
    byRoot.set(o.object, o)
    roots.push(o.object)
  }
  if (roots.length === 0) return null
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera)
  for (const hit of ray.intersectObjects(roots, true)) {
    let node: THREE.Object3D | null = hit.object
    let visible = true
    while (node) {
      if (!node.visible) visible = false
      const found = byRoot.get(node)
      if (found) {
        if (visible) return found
        break
      }
      node = node.parent
    }
  }
  return null
}
