/** Plants and outdoor things: pots, hanging plant, bucket, clothesline. */
import * as THREE from 'three'
import { Kit, type Builder } from '../kit'
import { str, TAU } from './common'

const POT: [number, number][] = [[0, 0], [0.7, 0], [0.75, 0.05], [0.95, 0.85], [1.02, 0.88], [1.02, 1.0], [0.9, 1.0], [0.88, 0.92], [0, 0.92]]

function pot(k: Kit, r: number, h: number, at: [number, number, number], colour?: string): void {
  k.lathe(k.m('clay', colour), POT.map(([x, y]) => [x * r, y * h]), at, { seg: 24, shadow: true })
  k.cyl(k.m('vc', undefined, { rough: 1 }), r * 0.86, r * 0.86, 0.01, [at[0], at[1] + h * 0.9, at[2]], { vc: '#4a3526', seg: 18 })
}

/** Leaves: flattened, pointed ellipsoids fanning out from a centre. */
function leafFan(k: Kit, centre: [number, number, number], count: number, len: number, width: number, lift: number, seedStart: number, dark = false): void {
  const leaf = k.m(dark ? 'leafDark' : 'leaf')
  let seed = seedStart
  const rand = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rand() * 0.5
    const tilt = lift + rand() * 0.5
    const g = k.group(centre, { rot: [0, a, 0] })
    const inner = k.group([0, 0, 0], { rot: [tilt, 0, 0], parent: g })
    k.sphere(leaf, 1, [0, len * 0.5, 0], { parent: inner, scale: [width, len * 0.5, width * 0.18], seg: 8 })
  }
}

/** A large potted plant in a terracotta pot. 0.7 × 1.25 × 0.7. */
export const pottedPlantLarge: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  pot(k, 0.2, 0.36, [0, 0, 0], str(p, 'pot', '#b4673f'))
  const stem = k.m('leafDark')
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU
    k.rod(stem, [0, 0.3, 0], [Math.sin(a) * 0.12, 0.8 + (i % 2) * 0.15, Math.cos(a) * 0.12], 0.008)
  }
  leafFan(k, [0, 0.33, 0], 9, 0.55, 0.075, 0.5, 11)
  leafFan(k, [0, 0.55, 0], 7, 0.5, 0.07, 0.25, 23, true)
  leafFan(k, [0, 0.75, 0], 5, 0.42, 0.065, 0.1, 37)
  return k.root
}

/** A small potted plant with round leaves. 0.26 × 0.36 × 0.26. */
export const pottedPlantSmall: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  pot(k, 0.1, 0.14, [0, 0, 0], str(p, 'pot', '#b4673f'))
  const leaf = k.m('leaf', '#5b8a3f')
  const spots: [number, number, number, number][] = [[0, 0.24, 0, 0.08], [0.06, 0.2, 0.04, 0.06], [-0.06, 0.21, -0.03, 0.065], [0.02, 0.29, -0.04, 0.055], [-0.04, 0.2, 0.06, 0.055]]
  for (const [x, y, z, r] of spots) k.mesh(new THREE.IcosahedronGeometry(r, 1), leaf, [x, y, z])
  return k.root
}

/** A plant in a clay pot hung from three cords. 0.44 × 0.8 × 0.44 (origin at the bottom). */
export const hangingPlant: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const vine = k.m('leaf', '#4f8a3a')
  // Trailing vines below the pot.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    const r = 0.14
    const pts: [number, number, number][] = [[Math.sin(a) * r, 0.34, Math.cos(a) * r], [Math.sin(a) * (r + 0.05), 0.2, Math.cos(a) * (r + 0.05)], [Math.sin(a + 0.3) * (r + 0.06), 0.04 + (i % 3) * 0.05, Math.cos(a + 0.3) * (r + 0.06)]]
    k.tube(vine, pts, 0.004, { seg: 10 })
    for (let j = 0; j < 3; j++) {
      const t = 0.2 + j * 0.3
      const [x, y, z] = [pts[0][0] * (1 - t) + pts[2][0] * t, pts[0][1] * (1 - t) + pts[2][1] * t, pts[0][2] * (1 - t) + pts[2][2] * t]
      k.sphere(vine, 1, [x, y, z], { scale: [0.03, 0.022, 0.012], rot: [0, a, 0.4], seg: 6 })
    }
  }
  pot(k, 0.14, 0.16, [0, 0.3, 0])
  k.mesh(new THREE.IcosahedronGeometry(0.12, 1), k.m('leaf', '#5b8a3f'), [0, 0.5, 0])
  const cord = k.m('jute', '#8a6a44')
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU
    k.rod(cord, [Math.sin(a) * 0.14, 0.45, Math.cos(a) * 0.14], [0, 0.79, 0], 0.003, { seg: 5 })
  }
  k.torus(k.m('iron'), 0.015, 0.003, [0, 0.79, 0], { seg: 10 })
  return k.root
}

/** A row of four terracotta pots with flowering plants. 1.4 × 0.55 × 0.36. */
export const flowerPotsRow: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const flowers = ['#e8871e', '#c8323a', '#e0609a', '#f2c230']
  const vc = k.m('vc')
  flowers.forEach((colour, i) => {
    const x = -0.52 + i * 0.35
    const r = i % 2 ? 0.14 : 0.16
    pot(k, r, 0.26, [x, 0, 0])
    k.mesh(new THREE.IcosahedronGeometry(r * 0.95, 1), k.m('leaf', '#4c7f38'), [x, 0.33, 0], { scale: [1, 0.7, 1] })
    for (let j = 0; j < 7; j++) {
      const a = (j / 7) * TAU + i
      k.sphere(vc, 0.035, [x + Math.sin(a) * r * 0.65, 0.38 + (j % 3) * 0.03, Math.cos(a) * r * 0.65], { vc: colour, seg: 8 })
    }
  })
  return k.root
}

/** A plastic bucket with a handle, and a mug. 0.4 × 0.36 × 0.32. */
export const bucketMug: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const pl = k.m('plastic', str(p, 'colour', '#2f6fa8'))
  k.lathe(pl, [[0, 0], [0.12, 0], [0.15, 0.3], [0.158, 0.31], [0.152, 0.315], [0.142, 0.3], [0.114, 0.012], [0, 0.012]], [-0.05, 0, 0], { seg: 28, shadow: true })
  k.torus(k.m('steel'), 0.15, 0.004, [-0.05, 0.31, 0], { arc: Math.PI, seg: 16, rot: [0, 0, 0] })
  k.lathe(k.m('vc', undefined, { rough: 0.2 }), [[0, 0.02], [0.14, 0.02], [0.14, 0.24], [0, 0.24]], [-0.05, 0, 0], { seg: 20, vc: '#5f7f90' })
  const mug = k.m('plastic', '#d9453a')
  k.lathe(mug, [[0, 0], [0.05, 0], [0.055, 0.11], [0.052, 0.112], [0.046, 0.006], [0, 0.006]], [0.16, 0, 0.05], { seg: 18 })
  k.torus(mug, 0.03, 0.007, [0.215, 0.06, 0.05], { arc: Math.PI, rot: [0, 0, -Math.PI / 2], seg: 10 })
  return k.root
}

/** A clothesline between two posts with washing pegged to it. 2.6 × 1.9 × 0.2. */
export const clothesline: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const post = k.m('bamboo', '#b58f5a')
  for (const s of [-1, 1]) {
    k.cyl(post, 0.03, 0.035, 1.9, [s * 1.27, 0.95, 0], { seg: 10, shadow: true })
    k.cyl(k.m('stone', '#8c877d'), 0.08, 0.1, 0.08, [s * 1.27, 0.04, 0], { seg: 12 })
  }
  k.rod(k.m('steel'), [-1.27, 1.78, 0], [1.27, 1.78, 0], 0.003, { seg: 4 })
  const clothes: [number, number, number, string][] = [[-0.75, 0.55, 0.6, '#e9e0cc'], [-0.05, 0.6, 1.05, '#b3423c'], [0.62, 0.45, 0.5, '#3c6a8f']]
  const fabric = k.m('vc', undefined, { rough: 0.95 })
  for (const [x, w, h, colour] of clothes) {
    k.box(fabric, [w, h, 0.008], [x, 1.78 - h / 2, 0], { vc: colour, bevel: 0, rot: [0.03, 0, 0] })
    for (const dx of [-w / 2 + 0.05, w / 2 - 0.05]) k.box(fabric, [0.015, 0.05, 0.016], [x + dx, 1.775, 0], { vc: '#d9a93a', bevel: 0 })
  }
  // A border stripe on the long cloth.
  k.box(fabric, [0.6, 0.06, 0.01], [-0.05, 1.78 - 1.0, 0.0], { vc: '#e3b23c', bevel: 0 })
  return k.root
}
