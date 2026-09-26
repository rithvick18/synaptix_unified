/**
 * livingRoom — a 6.4 × 5.6 m sitting room, 2.9 m ceiling. The sofa wall is at the back
 * (−z); the seated overview looks at it from near the front. A window on the left wall with
 * curtains, a second on the front wall, a panelled door on the right wall.
 */
import * as THREE from 'three'
import { ShellKit } from './kit'
import type { ShellDef, SlotDef } from './types'

const W = 6.4, D = 5.6, H = 2.9, T = 0.15
const X = W / 2, Z = D / 2
const LEFT = Math.PI / 2, RIGHT = -Math.PI / 2, FRONT = Math.PI

const slots: SlotDef[] = [
  // Back wall: the sofa, pictures above it, shelves either side.
  { id: 'sofa', mount: 'floor', position: [0, 0, -Z + 0.45], yaw: 0, maxSize: [2.1, 1.0, 0.9], align: 'back' },
  { id: 'sofa-seat', mount: 'surface', position: [0, 0.45, -Z + 0.34], yaw: 0, maxSize: [1.3, 0.5, 0.3], host: { slot: 'sofa', height: 0.85 } },
  { id: 'above-sofa', mount: 'wall', position: [0, 1.62, -Z], yaw: 0, maxSize: [0.9, 0.7, 0.1] },
  { id: 'above-sofa-left', mount: 'wall', position: [-0.8, 1.55, -Z], yaw: 0, maxSize: [0.45, 0.5, 0.1] },
  { id: 'above-sofa-right', mount: 'wall', position: [0.8, 1.55, -Z], yaw: 0, maxSize: [0.45, 0.5, 0.1] },
  { id: 'back-left', mount: 'floor', position: [-2.5, 0, -Z + 0.3], yaw: 0, maxSize: [1.1, 2.0, 0.6], align: 'back' },
  { id: 'back-left-high', mount: 'wall', position: [-1.6, 2.05, -Z], yaw: 0, maxSize: [0.5, 0.5, 0.1] },
  { id: 'back-right', mount: 'floor', position: [2.5, 0, -Z + 0.3], yaw: 0, maxSize: [1.1, 2.0, 0.6], align: 'back' },
  { id: 'back-gap-right', mount: 'floor', position: [1.45, 0, -Z + 0.4], yaw: 0, maxSize: [0.75, 1.3, 0.8], align: 'back' },
  // The middle of the room: a durrie with a low table on it.
  { id: 'rug', mount: 'floor', position: [0, 0, -0.95], yaw: 0, maxSize: [2.2, 0.03, 1.6] },
  { id: 'centre', mount: 'floor', position: [0, 0, -1.0], yaw: 0, maxSize: [1.2, 0.5, 0.7] },
  { id: 'centre-top-left', mount: 'surface', position: [-0.25, 0.42, -1.0], yaw: 0, maxSize: [0.45, 0.5, 0.45], host: { slot: 'centre', height: 0.42 } },
  { id: 'centre-top-right', mount: 'surface', position: [0.26, 0.42, -1.0], yaw: 0, maxSize: [0.45, 0.5, 0.45], host: { slot: 'centre', height: 0.42 } },
  // Left wall, by the window.
  { id: 'armchair-left', mount: 'floor', position: [-2.45, 0, -0.75], yaw: LEFT, maxSize: [0.85, 1.0, 0.85] },
  { id: 'side-left', mount: 'floor', position: [-2.85, 0, 0.45], yaw: LEFT, maxSize: [0.55, 0.8, 0.55] },
  { id: 'side-left-top', mount: 'surface', position: [-2.85, 0.6, 0.45], yaw: LEFT, maxSize: [0.45, 0.6, 0.42], host: { slot: 'side-left', height: 0.6 } },
  { id: 'left-wall-front', mount: 'wall', position: [-X, 1.6, 1.7], yaw: LEFT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'left-floor-front', mount: 'floor', position: [-X + 0.3, 0, 1.7], yaw: LEFT, maxSize: [1.0, 1.3, 0.6], align: 'back' },
  // Right wall, before the door.
  { id: 'right-mid', mount: 'floor', position: [X - 0.3, 0, -0.55], yaw: RIGHT, maxSize: [1.0, 1.3, 0.6], align: 'back' },
  { id: 'right-wall-high', mount: 'wall', position: [X, 1.95, -0.55], yaw: RIGHT, maxSize: [0.6, 0.6, 0.12] },
  { id: 'right-wall-front', mount: 'wall', position: [X, 1.6, 0.6], yaw: RIGHT, maxSize: [0.6, 0.8, 0.12] },
  // Front wall (behind the seated view).
  { id: 'front-left', mount: 'floor', position: [-1.9, 0, Z - 0.3], yaw: FRONT, maxSize: [1.1, 1.3, 0.6], align: 'back' },
  { id: 'front-wall-left', mount: 'wall', position: [-1.9, 1.7, Z], yaw: FRONT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'front-right', mount: 'floor', position: [1.7, 0, Z - 0.3], yaw: FRONT, maxSize: [1.0, 1.3, 0.6], align: 'back' },
  // The ceiling fan above the low table.
  { id: 'ceiling', mount: 'wall', position: [0, H, -0.9], yaw: 0, maxSize: [1.3, 0.6, 1.3], hang: true }
]

export const livingRoom: ShellDef = {
  id: 'livingRoom',
  name: { en: 'Living room', hi: 'बैठक' },
  slots,
  defaults: { wall: '#efe4cf', trim: '#6b4a32', floor: 'terrazzo', light: 'warm', accent: '#b0563a' },
  build(ctx) {
    const k = new ShellKit(ctx)
    k.floor(-X - T, -Z - T, X + T, Z + T)
    k.ceilingSlab(-X - T, -Z - T, X + T, Z + T, H)
    k.wallRun({ axis: 'x', at: -Z, from: -X - T, to: X + T, height: H, thickness: T, outward: -1 })
    k.wallRun({ axis: 'x', at: Z, from: -X - T, to: X + T, height: H, thickness: T, outward: 1, openings: [{ from: -0.7, to: 0.7, bottom: 0.9, top: 2.1, kind: 'window' }] })
    k.wallRun({ axis: 'z', at: -X, from: -Z, to: Z, height: H, thickness: T, outward: -1, openings: [{ from: -1.55, to: 0.05, bottom: 0.9, top: 2.15, kind: 'window' }] })
    k.wallRun({ axis: 'z', at: X, from: -Z, to: Z, height: H, thickness: T, outward: 1, openings: [{ from: 1.4, to: 2.4, bottom: 0, top: 2.1, kind: 'door' }] })
    k.tubeLight([X - 0.035, 2.45, -0.55], 'z')
    // A wooden picture rail around the room, as many older rooms have.
    const trim = k.trim
    k.box(trim, [-X, 2.35, -Z], [X, 2.39, -Z + 0.02])
    k.box(trim, [-X, 2.35, Z - 0.02], [X, 2.39, Z])
    const centre = new THREE.Vector3(0, 0, -0.4)
    k.interiorLights(centre, { x: X, z: Z }, H, [-2.5, 6, 1.5])
    const geometries = k.finish()
    return {
      group: k.group,
      geometries,
      lights: k.lights,
      blockers: k.blockers,
      walkable: new THREE.Box3(new THREE.Vector3(-X + 0.1, 0, -Z + 0.1), new THREE.Vector3(X - 0.1, H, Z - 0.1)),
      seat: { position: new THREE.Vector3(0.45, 1.25, 1.75), target: new THREE.Vector3(0, 0.95, -1.9) },
      spawn: { position: new THREE.Vector3(X - 0.7, 0, 1.9), yaw: Math.PI / 2 },
      centre
    }
  }
}
