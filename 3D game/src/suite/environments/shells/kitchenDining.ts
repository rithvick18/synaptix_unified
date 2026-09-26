/**
 * kitchenDining — a 6.0 × 5.4 m kitchen with a dining area, 2.9 m ceiling. A built-in
 * cooking platform runs along the back wall (granite top, cupboards below, a steel sink,
 * a tiled splashback and a window over the sink). The dining table stands in the front
 * half. Surface slots on the platform need no host: the platform is part of the shell.
 */
import * as THREE from 'three'
import { ShellKit } from './kit'
import type { ShellDef, SlotDef } from './types'

const W = 6.0, D = 5.4, H = 2.9, T = 0.15
const X = W / 2, Z = D / 2
const LEFT = Math.PI / 2, RIGHT = -Math.PI / 2, FRONT = Math.PI
const TOP = 0.87, DEPTH = 0.62, COUNTER_END = 0.9
const CZ = -Z + 0.31

const onCounter = (id: string, x: number, w: number): SlotDef =>
  ({ id, mount: 'surface', position: [x, TOP, CZ], yaw: 0, maxSize: [w, 0.5, 0.45] })

const slots: SlotDef[] = [
  onCounter('counter-stove', -2.45, 0.75),
  onCounter('counter-2', -1.83, 0.46),
  onCounter('counter-3', -0.55, 0.4),
  onCounter('counter-4', -0.1, 0.4),
  onCounter('counter-5', 0.45, 0.5),
  { id: 'wall-above-stove', mount: 'wall', position: [-2.45, 1.75, -Z], yaw: 0, maxSize: [0.95, 0.4, 0.26] },
  { id: 'wall-rack', mount: 'wall', position: [0.2, 1.8, -Z], yaw: 0, maxSize: [0.9, 0.8, 0.3] },
  { id: 'back-right', mount: 'floor', position: [1.95, 0, -Z + 0.3], yaw: 0, maxSize: [1.1, 2.0, 0.6], align: 'back' },
  { id: 'pot-corner', mount: 'floor', position: [-2.6, 0, -1.55], yaw: LEFT, maxSize: [0.5, 0.7, 0.5] },
  // Left wall.
  { id: 'left-wall', mount: 'wall', position: [-X, 1.6, -0.35], yaw: LEFT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'left-floor', mount: 'floor', position: [-2.6, 0, -0.35], yaw: LEFT, maxSize: [0.6, 0.6, 0.6] },
  { id: 'left-wall-2', mount: 'wall', position: [-X, 1.65, 1.35], yaw: LEFT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'left-floor-2', mount: 'floor', position: [-X + 0.3, 0, 1.5], yaw: LEFT, maxSize: [1.0, 1.3, 0.6], align: 'back' },
  // Dining.
  { id: 'dining', mount: 'floor', position: [0.6, 0, 0.65], yaw: 0, maxSize: [1.6, 0.8, 1.0] },
  { id: 'dining-cloth', mount: 'surface', position: [0.6, 0.75, 0.65], yaw: 0, maxSize: [1.3, 0.05, 0.8], host: { slot: 'dining', height: 0.75 } },
  { id: 'table-1', mount: 'surface', position: [0.18, 0.755, 0.55], yaw: 0, maxSize: [0.42, 0.5, 0.4], host: { slot: 'dining', height: 0.75 } },
  { id: 'table-2', mount: 'surface', position: [0.62, 0.755, 0.72], yaw: 0, maxSize: [0.42, 0.5, 0.4], host: { slot: 'dining', height: 0.75 } },
  { id: 'table-3', mount: 'surface', position: [1.05, 0.755, 0.52], yaw: 0, maxSize: [0.42, 0.5, 0.4], host: { slot: 'dining', height: 0.75 } },
  { id: 'chair-back-1', mount: 'floor', position: [0.25, 0, -0.08], yaw: 0, maxSize: [0.6, 1.0, 0.6] },
  { id: 'chair-back-2', mount: 'floor', position: [0.98, 0, -0.08], yaw: 0, maxSize: [0.6, 1.0, 0.6] },
  { id: 'chair-front-1', mount: 'floor', position: [0.25, 0, 1.38], yaw: FRONT, maxSize: [0.6, 1.0, 0.6] },
  { id: 'chair-front-2', mount: 'floor', position: [0.98, 0, 1.38], yaw: FRONT, maxSize: [0.6, 1.0, 0.6] },
  // Right wall (the door is towards the back).
  { id: 'right-wall', mount: 'wall', position: [X, 1.6, 0.75], yaw: RIGHT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'right-floor', mount: 'floor', position: [X - 0.3, 0, 0.75], yaw: RIGHT, maxSize: [0.6, 0.8, 0.6] },
  { id: 'right-floor-top', mount: 'surface', position: [X - 0.3, 0.6, 0.75], yaw: RIGHT, maxSize: [0.45, 0.6, 0.42], host: { slot: 'right-floor', height: 0.6 } },
  // Front wall.
  { id: 'front-floor', mount: 'floor', position: [1.7, 0, Z - 0.3], yaw: FRONT, maxSize: [1.1, 1.3, 0.6], align: 'back' },
  { id: 'front-wall', mount: 'wall', position: [1.7, 1.7, Z], yaw: FRONT, maxSize: [0.7, 0.8, 0.12] },
  { id: 'ceiling', mount: 'wall', position: [0.6, H, 0.65], yaw: 0, maxSize: [1.3, 0.6, 1.3], hang: true }
]

export const kitchenDining: ShellDef = {
  id: 'kitchenDining',
  name: { en: 'Kitchen and dining area', hi: 'रसोई और खाने की जगह' },
  slots,
  defaults: { wall: '#eee7d6', trim: '#6b4a32', floor: 'tile', light: 'neutral', accent: '#4f7a5a' },
  build(ctx) {
    const k = new ShellKit(ctx)
    k.floor(-X - T, -Z - T, X + T, Z + T)
    k.ceilingSlab(-X - T, -Z - T, X + T, Z + T, H)
    k.wallRun({ axis: 'x', at: -Z, from: -X - T, to: X + T, height: H, thickness: T, outward: -1, openings: [{ from: -1.8, to: -0.6, bottom: 1.2, top: 2.1, kind: 'window' }] })
    k.wallRun({ axis: 'x', at: Z, from: -X - T, to: X + T, height: H, thickness: T, outward: 1, openings: [{ from: -1.6, to: -0.3, bottom: 0.9, top: 2.1, kind: 'window' }] })
    k.wallRun({ axis: 'z', at: -X, from: -Z, to: Z, height: H, thickness: T, outward: -1 })
    k.wallRun({ axis: 'z', at: X, from: -Z, to: Z, height: H, thickness: T, outward: 1, openings: [{ from: -1.9, to: -0.9, bottom: 0, top: 2.1, kind: 'door' }] })
    // The cooking platform: cupboards, granite top, splashback, sink and tap.
    const x0 = -X, x1 = COUNTER_END, z0 = -Z, z1 = -Z + DEPTH
    const cabinet = k.m('woodPainted', '#d9cdb4')
    const granite = k.m('stone', '#3f3d3b')
    k.box(cabinet, [x0, 0.08, z0], [x1, TOP - 0.04, z1 - 0.03], { block: true })
    k.box(k.m('woodDark'), [x0, 0, z0], [x1, 0.08, z1 - 0.06])
    const seams = k.m('woodDark')
    for (let x = x0 + 0.6; x < x1 - 0.1; x += 0.6) k.box(seams, [x - 0.004, 0.1, z1 - 0.032], [x + 0.004, TOP - 0.07, z1 - 0.026])
    for (let x = x0 + 0.3; x < x1; x += 0.6) k.box(k.m('brass'), [x - 0.04, TOP - 0.2, z1 - 0.03], [x + 0.04, TOP - 0.185, z1 - 0.01])
    k.box(granite, [x0, TOP - 0.04, z0], [x1 + 0.02, TOP, z1 + 0.02], { bevel: 0.01 })
    k.box(k.m('ceramic', '#f1ede2'), [x0, TOP, z0], [x1, TOP + 0.6, z0 + 0.012])
    const grout = k.m('ceramic', '#cfc8b8')
    for (let y = TOP + 0.15; y < TOP + 0.6; y += 0.15) k.box(grout, [x0, y - 0.003, z0 + 0.012], [x1, y + 0.003, z0 + 0.014])
    for (let x = x0 + 0.15; x < x1; x += 0.15) k.box(grout, [x - 0.003, TOP, z0 + 0.012], [x + 0.003, TOP + 0.6, z0 + 0.014])
    const steel = k.m('steel')
    const sx = -1.2
    k.box(steel, [sx - 0.3, TOP - 0.2, z0 + 0.08], [sx + 0.3, TOP - 0.19, z0 + 0.52])
    for (const [a, b, c, d] of [[sx - 0.3, sx - 0.29, z0 + 0.08, z0 + 0.52], [sx + 0.29, sx + 0.3, z0 + 0.08, z0 + 0.52], [sx - 0.3, sx + 0.3, z0 + 0.08, z0 + 0.09], [sx - 0.3, sx + 0.3, z0 + 0.51, z0 + 0.52]]) {
      k.box(steel, [a, TOP - 0.2, c], [b, TOP + 0.005, d])
    }
    k.box(steel, [sx - 0.02, TOP, z0 + 0.03], [sx + 0.02, TOP + 0.26, z0 + 0.07])
    k.box(steel, [sx - 0.015, TOP + 0.23, z0 + 0.05], [sx + 0.015, TOP + 0.26, z0 + 0.24])
    // The sink's hole in the granite is implied by a dark recess plane.
    k.box(k.m('black', '#2a2a2c'), [sx - 0.28, TOP + 0.001, z0 + 0.1], [sx + 0.28, TOP + 0.003, z0 + 0.5])
    k.tubeLight([-0.6, 2.5, -Z + 0.035], 'x')
    const centre = new THREE.Vector3(0, 0, -0.1)
    k.interiorLights(centre, { x: X, z: Z }, H, [2.0, 6, 2.0])
    const geometries = k.finish()
    return {
      group: k.group,
      geometries,
      lights: k.lights,
      blockers: k.blockers,
      walkable: new THREE.Box3(new THREE.Vector3(-X + 0.1, 0, -Z + 0.1), new THREE.Vector3(X - 0.1, H, Z - 0.1)),
      seat: { position: new THREE.Vector3(-1.2, 1.25, 1.75), target: new THREE.Vector3(-0.3, 0.95, -1.6) },
      spawn: { position: new THREE.Vector3(X - 0.7, 0, -1.4), yaw: Math.PI / 2 },
      centre
    }
  }
}
