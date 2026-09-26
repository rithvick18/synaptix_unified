/**
 * Asset prototypes: each asset is built and baked once per texture state and shared by
 * reference count. A placement is `prototype.object.clone()`, which shares geometry and
 * materials; per-instance parts (runtime text, photo surfaces) are added by the scene.
 */
import type * as THREE from 'three'
import type { AssetDef } from '../contracts'
import { RefCache } from './cache'
import { BUILDERS } from './builders'
import { bake, type BuilderContext } from './kit'
import { MaterialLease, type MaterialEnv } from './materials'

export interface Prototype {
  key: string
  object: THREE.Group
  geometries: THREE.BufferGeometry[]
  triangles: number
  dispose(): void
}

const prototypes = new RefCache<Prototype>()

export function envSignature(env: MaterialEnv, quality: 'low' | 'standard'): string {
  if (!env.textured) return `${quality}:flat`
  const loaded = [...env.sets].filter(([, v]) => v).map(([k]) => k).sort().join(',')
  return `${quality}:tex:${loaded}`
}

/** Builds (or shares) the baked prototype of a procedural asset. Throws if its builder does. */
export function acquireProcedural(def: AssetDef, env: MaterialEnv, quality: 'low' | 'standard'): Prototype {
  if (def.source.kind !== 'procedural') throw new Error(`${def.id} is not procedural`)
  const source = def.source
  const key = `${def.id}|${source.builder}|${JSON.stringify(source.params ?? {})}|${envSignature(env, quality)}`
  return prototypes.acquire(key, () => {
    const builder = BUILDERS[source.builder]
    if (!builder) throw new Error(`no procedural builder "${source.builder}"`)
    const lease = new MaterialLease(env)
    const ctx: BuilderContext = { mats: lease, quality }
    let baked
    try {
      baked = bake(builder(source.params ?? {}, ctx), def.id)
    } catch (error) {
      lease.releaseAll()
      throw error
    }
    return {
      key,
      object: baked.object,
      geometries: baked.geometries,
      triangles: baked.triangles,
      dispose() {
        for (const g of baked.geometries) g.dispose()
        lease.releaseAll()
      }
    }
  })
}

export function releasePrototype(key: string): void {
  prototypes.release(key)
}

/** For checks. */
export function livePrototypeCount(): number {
  return prototypes.size
}
