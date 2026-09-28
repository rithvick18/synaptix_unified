import type * as THREE from 'three'
import type { LocalizedText, SceneEnvironment, ShellInfo, ShellMaterials, ShellSlot } from '../../contracts'
import type { MaterialLease } from '../../assets/materials'
import type { PhotoShellConfig } from './photo'

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
  /** Invisible interaction target on a photographed object, in panorama UV coordinates. */
  photoHotspot?: { u: number; v: number; width: number; height: number }
}

export interface ResolvedMaterials extends Required<Omit<ShellMaterials, 'floorColour' | 'accent'>> {
  floorColour?: string
  accent: string
}

export interface ShellBuildContext {
  mats: MaterialLease
  materials: ResolvedMaterials
  quality: 'low' | 'standard'
  /** False under node checks: a shell must not fetch anything (see BuildSceneOptions). */
  loadTextures: boolean
  maxTextureSize: number
}

export interface ShellBuild {
  group: THREE.Group
  /** Geometry the shell owns (merged per material). */
  geometries: THREE.BufferGeometry[]
  lights: THREE.Light[]
  blockers: THREE.Box3[]
  walkable: THREE.Box3
  seat: { position: THREE.Vector3; target: THREE.Vector3; fov?: number }
  spawn: { position: THREE.Vector3; yaw: number }
  centre: THREE.Vector3
  /**
   * Set by a photo room, which is correct only near where its photograph was taken: every
   * object is then looked at from the seat, moved at most `radius` metres toward it,
   * instead of from a viewpoint searched for around the room.
   */
  fixedViewpoint?: { radius: number }
  /**
   * Lay a soft dark patch under every floor object. Light from a whole ceiling or an
   * overcast window casts no crisp shadow, but it leaves the floor darker under and around
   * a chair; without that, an object standing on a photograph looks pasted on.
   */
  contactShadows?: boolean
  /** Settles when whatever the shell loads in the background has arrived or failed. */
  ready?: Promise<void>
  /** The light the room's objects should be lit by, once `ready` has settled (photo rooms). */
  environment?: SceneEnvironment | null
  /** Warnings from background loads, read once `ready` has settled. */
  problems?: string[]
  /** GPU memory (KB) the shell holds that is not a material's map, such as its lighting. */
  extraTextureKB?(): number
  /** Frees what the shell made outside the material lease and `geometries`. */
  dispose?(): void
}

export interface ShellDef extends ShellInfo {
  slots: readonly SlotDef[]
  defaults: ResolvedMaterials
  /** Set for a photo room (shells/photo.ts): what it was made from. */
  photo?: Readonly<PhotoShellConfig>
  build(ctx: ShellBuildContext): ShellBuild
}

export type { LocalizedText }
