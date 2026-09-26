/** Storage: almirah, cupboard, trunk, kitchen rack, bamboo basket. */
import { Kit, type Builder } from '../kit'
import { mat, str, TAU } from './common'

/** A painted steel almirah with two doors. 0.9 × 1.95 × 0.5. */
export const almirahSteel: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const paint = k.m('steelPainted', str(p, 'colour', '#8fa39a'))
  const chrome = k.m('chrome')
  const dark = k.m('vc')
  k.slab(paint, [0.9, 1.85, 0.5], [0, 0.1, 0], { bevel: 0.02, shadow: true })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.slab(k.m('iron'), [0.05, 0.1, 0.05], [sx * 0.4, 0, sz * 0.2])
  k.box(dark, [0.006, 1.7, 0.004], [0, 1.02, 0.251], { vc: '#3c4642', bevel: 0 })
  for (const y of [0.24, 1.8]) k.box(dark, [0.84, 0.006, 0.004], [0, y, 0.251], { vc: '#6f7f78', bevel: 0 })
  // Pressed panels on each door.
  for (const sx of [-1, 1]) {
    k.box(paint, [0.36, 0.62, 0.008], [sx * 0.215, 1.36, 0.252], { bevel: 0.003 })
    k.box(paint, [0.36, 0.62, 0.008], [sx * 0.215, 0.62, 0.252], { bevel: 0.003 })
  }
  k.box(chrome, [0.018, 0.22, 0.025], [0.04, 1.05, 0.265])
  k.box(chrome, [0.05, 0.08, 0.008], [-0.035, 1.05, 0.255])
  k.cyl(k.m('black'), 0.008, 0.008, 0.01, [-0.035, 1.06, 0.26], { rot: [Math.PI / 2, 0, 0], seg: 8 })
  return k.root
}

/** A wooden cupboard: glazed upper doors, panelled lower doors. 1.0 × 1.8 × 0.45. */
export const cupboardWood: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  const dark = k.m('woodDark')
  k.slab(wood, [1.0, 1.72, 0.44], [0, 0.04, 0], { shadow: true })
  k.slab(dark, [1.0, 0.04, 0.42], [0, 0, 0])
  k.slab(wood, [1.06, 0.04, 0.47], [0, 1.76, 0.005])
  // Glazed upper doors: a dark interior with plates standing behind the glass.
  const inside = k.m('vc')
  k.box(inside, [0.9, 0.78, 0.01], [0, 1.3, 0.2], { vc: '#3b2a1e', bevel: 0 })
  const steel = k.m('steel')
  for (const x of [-0.3, -0.12, 0.12, 0.3]) k.cyl(steel, 0.1, 0.1, 0.01, [x, 1.36, 0.205], { rot: [Math.PI / 2 - 0.15, 0, 0], seg: 24 })
  k.box(inside, [0.9, 0.015, 0.01], [0, 1.245, 0.21], { vc: '#6b4a32', bevel: 0 })
  const glass = k.m('glass')
  for (const s of [-1, 1]) {
    const cx = s * 0.245
    k.box(dark, [0.47, 0.84, 0.02], [cx, 1.3, 0.225], { bevel: 0.004 })
    k.box(glass, [0.39, 0.74, 0.004], [cx, 1.3, 0.238], { bevel: 0 })
    k.box(dark, [0.47, 0.8, 0.025], [cx, 0.46, 0.232], { bevel: 0.004 })
    k.box(wood, [0.35, 0.62, 0.01], [cx, 0.46, 0.248], { bevel: 0.003 })
    k.sphere(k.m('brass'), 0.014, [s * 0.03, 0.8, 0.25], { seg: 8 })
  }
  // The rail between the glazed and the panelled doors.
  k.box(dark, [0.94, 0.03, 0.02], [0, 0.88, 0.225])
  return k.root
}

/** A painted tin trunk with metal corners and a hasp. 0.86 × 0.46 × 0.52. */
export const trunkTin: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const paint = k.m('tin', str(p, 'colour', '#3f6b8a'))
  const metal = k.m('aluminium')
  k.slab(paint, [0.8, 0.37, 0.5], [0, 0, 0], { shadow: true })
  k.slab(paint, [0.82, 0.08, 0.52], [0, 0.37, 0], { shadow: true, bevel: 0.015 })
  for (const x of [-0.2, 0.2]) {
    k.slab(metal, [0.04, 0.45, 0.004], [x, 0.0, 0.262], { bevel: 0 })
    k.slab(metal, [0.04, 0.004, 0.52], [x, 0.451, 0], { bevel: 0 })
  }
  k.slab(metal, [0.05, 0.1, 0.012], [0, 0.3, 0.262])
  k.torus(k.m('brass'), 0.02, 0.004, [0, 0.29, 0.272], { seg: 12 })
  for (const sx of [-1, 1]) {
    for (const [y, sz] of [[0.02, 1], [0.02, -1], [0.43, 1], [0.43, -1]] as const) {
      k.box(k.m('brass'), [0.05, 0.05, 0.05], [sx * 0.39, y, sz * 0.24])
    }
    k.torus(metal, 0.04, 0.006, [sx * 0.41, 0.25, 0], { rot: [0, Math.PI / 2, 0], arc: Math.PI, seg: 12 })
  }
  return k.root
}

/** A steel wall rack with standing plates and tumblers. 0.8 × 0.7 × 0.26. */
export const kitchenRack: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  const W = 0.8
  for (const s of [-1, 1]) {
    k.rod(steel, [s * W / 2, 0, -0.11], [s * W / 2, 0.7, -0.11], 0.008)
    k.rod(steel, [s * W / 2, 0.02, -0.11], [s * W / 2, 0.02, 0.1], 0.006)
    k.rod(steel, [s * W / 2, 0.36, -0.11], [s * W / 2, 0.36, 0.1], 0.006)
  }
  for (const [y, z] of [[0.02, 0.1], [0.02, -0.02], [0.36, 0.1], [0.36, -0.02], [0.7, -0.11], [0.2, -0.11], [0.55, -0.11]] as const) {
    k.rod(steel, [-W / 2, y, z], [W / 2, y, z], 0.005)
  }
  // Plates standing on the upper shelf, bowls and tumblers below.
  for (let i = 0; i < 6; i++) k.cyl(steel, 0.12, 0.12, 0.012, [-0.28 + i * 0.11, 0.49, 0.03], { rot: [Math.PI / 2 - 0.25, 0, 0], seg: 28 })
  for (let i = 0; i < 4; i++) k.lathe(steel, [[0, 0], [0.028, 0], [0.036, 0.11], [0.033, 0.11], [0.025, 0.004]], [-0.28 + i * 0.09, 0.025, 0.03], { seg: 16 })
  for (let i = 0; i < 2; i++) k.lathe(steel, [[0, 0], [0.04, 0], [0.065, 0.05], [0.06, 0.05], [0.035, 0.005]], [0.14 + i * 0.14, 0.025, 0.03], { seg: 18 })
  return k.root
}

/** A round woven bamboo basket with a rim. 0.46 × 0.4 × 0.46. */
export const bambooBasket: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const bamboo = k.m('cane', '#c49a5c')
  const strip = k.m('bamboo', '#a9824f')
  k.lathe(bamboo, [[0, 0.01], [0.17, 0.01], [0.2, 0.08], [0.22, 0.3], [0.225, 0.38], [0.215, 0.38], [0.21, 0.3], [0.19, 0.08], [0.16, 0.02], [0, 0.02]], [0, 0, 0], { seg: 28 })
  k.torus(strip, 0.222, 0.012, [0, 0.382, 0], { rot: [Math.PI / 2, 0, 0], seg: 32 })
  k.torus(strip, 0.19, 0.01, [0, 0.03, 0], { rot: [Math.PI / 2, 0, 0], seg: 32 })
  k.torus(strip, 0.215, 0.007, [0, 0.2, 0], { rot: [Math.PI / 2, 0, 0], seg: 32 })
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    k.rod(strip, [Math.sin(a) * 0.172, 0.015, Math.cos(a) * 0.172], [Math.sin(a) * 0.228, 0.375, Math.cos(a) * 0.228], 0.006)
  }
  return k.root
}
