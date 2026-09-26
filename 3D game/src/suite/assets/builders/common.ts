import * as THREE from 'three'
import type { MatName } from '../materials'
import type { Kit, V3 } from '../kit'

export type Params = Record<string, number | string | boolean>

export const num = (p: Params, key: string, fallback: number): number =>
  typeof p[key] === 'number' ? (p[key] as number) : fallback

export const str = (p: Params, key: string, fallback: string): string =>
  typeof p[key] === 'string' ? (p[key] as string) : fallback

export const mat = (p: Params, key: string, fallback: MatName): MatName => str(p, key, fallback) as MatName

/** Four square legs under a top, inset from the corners. */
export function legs(k: Kit, m: THREE.Material, w: number, d: number, h: number, t: number, inset = 0.03, shadow = true): void {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      k.box(m, [t, h, t], [sx * (w / 2 - inset - t / 2), h / 2, sz * (d / 2 - inset - t / 2)], { shadow })
    }
  }
}

/** A rectangular frame of four bars in the XY plane, centred at `at`. */
export function frameBars(k: Kit, m: THREE.Material, w: number, h: number, bar: number, depth: number, at: V3, shadow = false): void {
  const [x, y, z] = at
  k.box(m, [w, bar, depth], [x, y - h / 2 + bar / 2, z], { shadow })
  k.box(m, [w, bar, depth], [x, y + h / 2 - bar / 2, z], { shadow })
  k.box(m, [bar, h - bar * 2, depth], [x - w / 2 + bar / 2, y, z], { shadow })
  k.box(m, [bar, h - bar * 2, depth], [x + w / 2 - bar / 2, y, z], { shadow })
}

/**
 * A group that pivots at `at`, for animated parts (clock hands, fan rotor). Children are
 * positioned relative to the pivot.
 */
export function pivot(k: Kit, name: string, at: V3): THREE.Group {
  return k.group(at, { name, keep: true })
}

/** Marks a mesh as a runtime-text surface: the scene draws `kind` on it with a canvas. */
export function runtimeText(mesh: THREE.Mesh, kind: string, px: [number, number], extra: Record<string, unknown> = {}): THREE.Mesh {
  mesh.userData.keep = true
  mesh.userData.runtimeText = { kind, px, ...extra }
  return mesh
}

export const TAU = Math.PI * 2
