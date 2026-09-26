import type * as THREE from 'three'
import type { LocalizedText, ShellInfo, ShellMaterials, ShellSlot } from '../../contracts'
import type { MaterialLease } from '../../assets/materials'

/**
 * A slot as the shells declare it. The extra fields are this module's own; the exported
 * `ShellInfo.slots` carries them too (they are optional, so still plain `ShellSlot`s).
 *
 * Slot semantics (see docs/suite/assets.md):
 * - floor / surface: `position` is the base centre of the slot volume `maxSize`.
 *   With `align: 'back'` a shallower asset is pushed back so its back meets the back of
 *   the volume (a sofa against a wall).
 * - wall: `position` is the centre of the picture on the wall surface; the asset is
 *   moved out of the wall by half its depth.
 * - hang: a 'wall' slot on a ceiling or beam: `position` is the top attachment point and
 *   the asset hangs below it. Only assets tagged with the context 'hanging' fit, and they
 *   fit nowhere else.
 * - host: a surface slot on furniture that a preset must place in the named floor slot;
 *   the furniture asset's height (`size[1]`) must match `height` within 4 cm, or the
 *   surface placement is rejected (so nothing ever floats where a table is missing).
 */
export interface SlotDef extends ShellSlot {
  align?: 'back'
  hang?: boolean
  host?: { slot: string; height: number }
}

export interface ResolvedMaterials extends Required<Omit<ShellMaterials, 'floorColour' | 'accent'>> {
  floorColour?: string
  accent: string
}

export interface ShellBuildContext {
  mats: MaterialLease
  materials: ResolvedMaterials
  quality: 'low' | 'standard'
}

export interface ShellBuild {
  group: THREE.Group
  /** Geometry the shell owns (merged per material). */
  geometries: THREE.BufferGeometry[]
  lights: THREE.Light[]
  blockers: THREE.Box3[]
  walkable: THREE.Box3
  seat: { position: THREE.Vector3; target: THREE.Vector3 }
  spawn: { position: THREE.Vector3; yaw: number }
  centre: THREE.Vector3
}

export interface ShellDef extends ShellInfo {
  slots: readonly SlotDef[]
  defaults: ResolvedMaterials
  build(ctx: ShellBuildContext): ShellBuild
}

export type { LocalizedText }
