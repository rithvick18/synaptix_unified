/**
 * courtyardVeranda — an open-sky courtyard, 7 × 7 m inside plastered compound walls, with a
 * covered veranda (2.2 m deep, roof at 2.8 m on four posts) along the house wall at the
 * back. The house wall has a panelled double door and two barred windows; the front
 * compound wall has an iron gate. Trees show over the walls.
 */
import * as THREE from 'three'
import { ShellKit } from './kit'
import type { ShellDef, SlotDef } from './types'

const W = 7.0, D = 7.0, T = 0.2
const X = W / 2, Z = D / 2
const HOUSE_H = 3.4, WALL_H = 2.0, ROOF = 2.8, VERANDA = 2.15
const POST_Z = -Z + VERANDA
const LEFT = Math.PI / 2, RIGHT = -Math.PI / 2, FRONT = Math.PI
const POSTS = [-2.6, -0.9, 0.9, 2.6]

const slots: SlotDef[] = [
  // The house wall under the veranda.
  { id: 'house-wall-a', mount: 'wall', position: [-1.0, 1.6, -Z], yaw: 0, maxSize: [0.75, 0.8, 0.2] },
  { id: 'house-wall-b', mount: 'wall', position: [1.0, 1.6, -Z], yaw: 0, maxSize: [0.75, 0.8, 0.2] },
  { id: 'house-wall-c', mount: 'wall', position: [-3.05, 1.6, -Z], yaw: 0, maxSize: [0.7, 0.9, 0.2] },
  { id: 'house-wall-d', mount: 'wall', position: [3.05, 1.6, -Z], yaw: 0, maxSize: [0.7, 0.9, 0.2] },
  { id: 'house-wall-high', mount: 'wall', position: [0, 2.45, -Z], yaw: 0, maxSize: [0.8, 0.5, 0.12] },
  { id: 'veranda-bench', mount: 'floor', position: [-2.0, 0, -Z + 0.25], yaw: 0, maxSize: [1.8, 1.0, 0.5], align: 'back' },
  { id: 'bench-top-left', mount: 'surface', position: [-2.42, 0.45, -Z + 0.3], yaw: 0, maxSize: [0.55, 0.5, 0.36], host: { slot: 'veranda-bench', height: 0.45 } },
  { id: 'bench-top-right', mount: 'surface', position: [-1.58, 0.45, -Z + 0.3], yaw: 0, maxSize: [0.55, 0.5, 0.36], host: { slot: 'veranda-bench', height: 0.45 } },
  { id: 'veranda-right', mount: 'floor', position: [2.0, 0, -Z + 0.3], yaw: 0, maxSize: [1.1, 1.3, 0.6], align: 'back' },
  { id: 'veranda-right-top', mount: 'surface', position: [2.0, 0.6, -Z + 0.3], yaw: 0, maxSize: [0.45, 0.6, 0.42], host: { slot: 'veranda-right', height: 0.6 } },
  { id: 'veranda-seat-left', mount: 'floor', position: [-1.75, 0, -2.0], yaw: 0.35, maxSize: [0.85, 1.0, 0.85] },
  { id: 'veranda-seat-right', mount: 'floor', position: [1.75, 0, -2.0], yaw: -0.35, maxSize: [0.85, 1.0, 0.85] },
  { id: 'veranda-mat', mount: 'floor', position: [0, 0, -2.35], yaw: 0, maxSize: [1.4, 0.03, 1.0] },
  { id: 'veranda-hang-left', mount: 'wall', position: [-1.75, ROOF - 0.12, POST_Z], yaw: 0, maxSize: [0.5, 0.9, 0.5], hang: true },
  { id: 'veranda-hang-right', mount: 'wall', position: [1.75, ROOF - 0.12, POST_Z], yaw: 0, maxSize: [0.5, 0.9, 0.5], hang: true },
  // The courtyard.
  { id: 'clothesline', mount: 'floor', position: [-1.5, 0, 1.2], yaw: 0, maxSize: [2.9, 2.0, 0.4] },
  { id: 'pots-front', mount: 'floor', position: [-1.6, 0, Z - 0.3], yaw: FRONT, maxSize: [1.6, 0.7, 0.55], align: 'back' },
  { id: 'corner-front-right', mount: 'floor', position: [3.05, 0, Z - 0.45], yaw: FRONT, maxSize: [0.8, 1.4, 0.8] },
  { id: 'right-wall-floor', mount: 'floor', position: [X - 0.4, 0, 0.9], yaw: RIGHT, maxSize: [1.9, 1.2, 0.75], align: 'back' },
  { id: 'tap-floor', mount: 'floor', position: [X - 0.3, 0, -0.75], yaw: RIGHT, maxSize: [0.5, 0.5, 0.5] },
  { id: 'left-wall-floor', mount: 'floor', position: [-X + 0.3, 0, -0.6], yaw: LEFT, maxSize: [1.0, 1.2, 0.6], align: 'back' },
  { id: 'right-wall-hang', mount: 'wall', position: [X, 1.35, 2.5], yaw: RIGHT, maxSize: [0.7, 1.0, 0.2] },
  { id: 'left-wall-hang', mount: 'wall', position: [-X, 1.35, 2.3], yaw: LEFT, maxSize: [0.7, 1.0, 0.2] },
  { id: 'courtyard-centre', mount: 'floor', position: [1.0, 0, 1.2], yaw: 0, maxSize: [1.0, 0.6, 1.0] }
]

export const courtyardVeranda: ShellDef = {
  id: 'courtyardVeranda',
  name: { en: 'Courtyard and veranda', hi: 'आँगन और बरामदा' },
  slots,
  defaults: { wall: '#eadcc0', trim: '#6b4a32', floor: 'red-oxide', light: 'warm', accent: '#a8452f' },
  build(ctx) {
    const k = new ShellKit(ctx)
    const trim = k.trim
    // Ground: the veranda in the chosen finish, the courtyard paved in cement or earth.
    k.floor(-X - T, -Z - T, X + T, POST_Z + 0.12)
    const earth = ctx.materials.floor === 'mud-plaster'
    k.floor(-X - T, POST_Z + 0.12, X + T, Z + T, k.m(earth ? 'floorMud' : 'floorCement', earth ? '#b39063' : '#bdb5a5'))
    k.box(k.m('stone', '#8a857c'), [-X, 0, POST_Z - 0.06], [X, 0.035, POST_Z + 0.14])
    // The house wall, taller, with a door and two windows.
    k.wallRun({ axis: 'x', at: -Z, from: -X - T, to: X + T, height: HOUSE_H, thickness: T, outward: -1, openings: [
      { from: -2.5, to: -1.5, bottom: 0.9, top: 2.0, kind: 'window' },
      { from: -0.55, to: 0.55, bottom: 0, top: 2.15, kind: 'door' },
      { from: 1.5, to: 2.5, bottom: 0.9, top: 2.0, kind: 'window' }
    ] })
    const compound = k.m('wall', ctx.materials.wall)
    k.wallRun({ axis: 'z', at: -X, from: -Z, to: Z + T, height: WALL_H, thickness: T, outward: -1, material: compound, skirting: false })
    k.wallRun({ axis: 'z', at: X, from: -Z, to: Z + T, height: WALL_H, thickness: T, outward: 1, material: compound, skirting: false })
    k.wallRun({ axis: 'x', at: Z, from: -X - T, to: X + T, height: WALL_H - 0.1, thickness: T, outward: 1, material: compound, skirting: false, openings: [{ from: 0.6, to: 1.8, bottom: 0, top: 1.75, kind: 'gate' }] })
    // Coping on the compound walls and the side walls rising to meet the veranda roof.
    const coping = k.m('stone', '#9a948a')
    k.box(coping, [-X - T - 0.03, WALL_H, -Z], [-X + 0.03, WALL_H + 0.06, Z + T])
    k.box(coping, [X - 0.03, WALL_H, -Z], [X + T + 0.03, WALL_H + 0.06, Z + T])
    k.box(coping, [-X - T, WALL_H - 0.1, Z - 0.03], [0.6, WALL_H - 0.04, Z + T + 0.03])
    k.box(coping, [1.8, WALL_H - 0.1, Z - 0.03], [X + T, WALL_H - 0.04, Z + T + 0.03])
    for (const s of [-1, 1]) k.box(compound, s < 0 ? [-X - T, WALL_H, -Z] : [X, WALL_H, -Z], s < 0 ? [-X, ROOF, POST_Z] : [X + T, ROOF, POST_Z])
    // Veranda: posts on stone bases, a beam and a tiled roof.
    const wood = k.m('trim', ctx.materials.trim)
    for (const x of POSTS) {
      k.box(k.m('stone', '#8a857c'), [x - 0.14, 0, POST_Z - 0.14], [x + 0.14, 0.18, POST_Z + 0.14], { block: true, cast: true })
      k.box(wood, [x - 0.08, 0.18, POST_Z - 0.08], [x + 0.08, ROOF - 0.12, POST_Z + 0.08], { block: true, cast: true, bevel: 0.015 })
      k.box(wood, [x - 0.12, ROOF - 0.2, POST_Z - 0.12], [x + 0.12, ROOF - 0.12, POST_Z + 0.12], { bevel: 0.01 })
    }
    k.box(wood, [-X, ROOF - 0.12, POST_Z - 0.1], [X, ROOF, POST_Z + 0.1], { cast: true })
    k.box(k.m('ceiling', '#efe6d4'), [-X - T, ROOF, -Z - T], [X + T, ROOF + 0.08, POST_Z + 0.35], { cast: true })
    const tiles = k.m('clay', '#9c4a30')
    for (let i = 0; i < 9; i++) {
      const z = -Z - T + i * ((VERANDA + 0.55) / 9)
      k.box(tiles, [-X - T - 0.1, ROOF + 0.08 + 0.02 * (9 - i), z], [X + T + 0.1, ROOF + 0.12 + 0.02 * (9 - i), z + 0.34], { cast: true })
    }
    for (let x = -X + 0.4; x < X; x += 0.8) k.box(trim, [x - 0.04, ROOF - 0.1, -Z], [x + 0.04, ROOF, POST_Z])
    // A garden tap on the right wall, with its pipe.
    const steel = k.m('steel')
    k.box(k.m('iron', '#5b6a6a'), [X - 0.04, 0.05, -0.77], [X, 0.72, -0.73])
    k.box(steel, [X - 0.12, 0.66, -0.78], [X - 0.02, 0.7, -0.72])
    k.box(steel, [X - 0.13, 0.6, -0.765], [X - 0.1, 0.68, -0.735])
    // Trees over the walls.
    const leaves = k.m('leafDark', '#4d7040'), trunk = k.m('woodDark')
    for (const [x, z, r] of [[-5.2, 1.5, 1.6], [-4.8, 4.8, 1.3], [4.9, 3.6, 1.5], [2.0, 6.0, 1.4], [-1.8, 6.4, 1.2]] as const) {
      const g = new THREE.IcosahedronGeometry(r, 1)
      g.translate(x, WALL_H + r * 0.9, z)
      k.add(leaves, g)
      k.box(trunk, [x - 0.12, 0, z - 0.12], [x + 0.12, WALL_H + 0.4, z + 0.12])
    }
    const centre = new THREE.Vector3(0, 0, 0)
    k.outdoorLights(centre, Math.max(X, Z))
    const geometries = k.finish()
    return {
      group: k.group,
      geometries,
      lights: k.lights,
      blockers: k.blockers,
      walkable: new THREE.Box3(new THREE.Vector3(-X + 0.1, 0, -Z + 0.1), new THREE.Vector3(X - 0.1, HOUSE_H, Z - 0.1)),
      seat: { position: new THREE.Vector3(0.3, 1.25, 2.65), target: new THREE.Vector3(-0.2, 1.0, -2.2) },
      spawn: { position: new THREE.Vector3(1.2, 0, Z - 0.6), yaw: 0 },
      centre
    }
  }
}
