/**
 * Packaged glTF assets (optional; the starter packs use none — every asset is procedural).
 * A glTF must be a local .glb under public/suite/, and always names a procedural
 * `fallback`, used under node, with `loadTextures: false`, and whenever loading fails.
 */
import * as THREE from 'three'
import { RefCache } from './cache'

interface GltfPrototype {
  object: THREE.Group
  triangles: number
  dispose(): void
}

const cache = new RefCache<GltfPrototype>()
const pending = new Map<string, Promise<THREE.Group>>()

async function load(url: string): Promise<THREE.Group> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const gltf = await new GLTFLoader().loadAsync(url)
  return gltf.scene
}

/** Loads (once) and shares a glTF scene, normalised so its base centre is the origin. */
export async function acquireGltf(url: string, scale: number | [number, number, number] = 1, yaw = 0): Promise<{ key: string; object: THREE.Group; triangles: number }> {
  const key = `${url}|${scale}|${yaw}`
  const existing = cache.peek(key)
  if (existing) return { key, ...cache.acquire(key, () => existing) }
  let promise = pending.get(key)
  if (!promise) {
    promise = load(url)
    pending.set(key, promise)
  }
  let scene: THREE.Group
  try {
    scene = await promise
  } finally {
    pending.delete(key)
  }
  const proto = cache.acquire(key, () => {
    const object = new THREE.Group()
    if (typeof scale === 'number') scene.scale.setScalar(scale)
    else scene.scale.set(...scale)
    scene.rotation.y = yaw
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const centre = box.getCenter(new THREE.Vector3())
    scene.position.set(-centre.x, -box.min.y, -centre.z)
    object.add(scene)
    let triangles = 0
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    object.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      // As a procedural part marked `shadow`: the scene builder still decides, per
      // placement, whether this tier and this kind of object casts at all.
      mesh.castShadow = true
      mesh.receiveShadow = true
      geometries.add(mesh.geometry)
      triangles += mesh.geometry.index ? mesh.geometry.index.count / 3 : mesh.geometry.attributes.position.count / 3
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(m)
    })
    return {
      object,
      triangles,
      dispose() {
        for (const g of geometries) g.dispose()
        for (const m of materials) {
          for (const value of Object.values(m)) if (value instanceof THREE.Texture) value.dispose()
          m.dispose()
        }
      }
    }
  })
  return { key, object: proto.object, triangles: proto.triangles }
}

export function releaseGltf(key: string): void {
  cache.release(key)
}
