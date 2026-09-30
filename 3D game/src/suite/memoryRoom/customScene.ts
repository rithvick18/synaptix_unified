/**
 * The "place" of a custom session: the caregiver's own photographs, with no template room.
 * There is nothing to build in 3D here: ExploreView displays the current photograph
 * over this empty, quiet scene. Close-up can add depth motion when available.
 * Activities that need template objects report themselves unavailable on their own.
 */
import * as THREE from 'three'
import type { I18n, LoadedContentPack, SuiteScene } from '../contracts'

export const CUSTOM_PACK_ID = 'custom'
export const CUSTOM_ENVIRONMENT_ID = 'photographs'

/** A stand-in content pack: no places, prompts, sounds or pictures of its own. */
export function buildCustomPack(): LoadedContentPack {
  return {
    meta: {
      schema: 1, id: CUSTOM_PACK_ID, name: 'Your photographs', description: 'The photographs added in Caregiver setup.',
      status: 'starter', regional: false, coverageNote: '', files: { environments: '', content: '' }, authors: []
    },
    baseUrl: '',
    environments: [],
    prompts: [], sounds: [], images: [], assets: [], problems: []
  }
}

export function buildCustomScene(_i18n?: I18n): SuiteScene {
  const root = new THREE.Group()
  root.name = 'custom-place'
  // A dim, plain surround so nothing of the house or of a template room shows behind a photograph.
  const surround = new THREE.Mesh(
    new THREE.SphereGeometry(30, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x1b1a18, side: THREE.BackSide })
  )
  surround.name = 'custom-surround'
  root.add(surround)
  const anchor = new THREE.Group()
  root.add(anchor)
  return {
    packId: CUSTOM_PACK_ID,
    environmentId: CUSTOM_ENVIRONMENT_ID,
    shell: 'memoryRoom',
    root,
    blockers: [],
    walkable: new THREE.Box3(new THREE.Vector3(-0.1, 0, -0.1), new THREE.Vector3(0.1, 2, 0.1)),
    spawn: { position: new THREE.Vector3(0, 1.4, 0), yaw: 0 },
    seat: { position: new THREE.Vector3(0, 1.4, 0), target: new THREE.Vector3(0, 1.4, -1) },
    objects: [],
    audioAnchor: anchor,
    report: { packId: CUSTOM_PACK_ID, environmentId: CUSTOM_ENVIRONMENT_ID, objectCount: 0, missingAssets: [], fallbacksUsed: [], unknownSlots: [], rejectedPlacements: [], triangles: 0, meshes: 1, textureKB: 0, buildMs: 0 },
    relabel() { /* nothing to relabel */ },
    dispose() {
      surround.geometry.dispose()
      ;(surround.material as THREE.Material).dispose()
      root.removeFromParent()
    }
  }
}
