/** Music and media: radios, cassette player, harmonium, television. */
import { Kit, type Builder } from '../kit'
import { str } from './common'

/** A leather-cased transistor radio with a dial and strap. 0.3 × 0.23 × 0.1. */
export const radioTransistor: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const casing = k.m('leather', str(p, 'colour', '#6a3f28'))
  k.slab(casing, [0.3, 0.19, 0.09], [0, 0, 0], { bevel: 0.02, shadow: true })
  const vc = k.m('vc')
  k.box(vc, [0.15, 0.13, 0.004], [-0.06, 0.095, 0.046], { vc: '#2e2a26', bevel: 0 })
  for (let i = 0; i < 8; i++) k.box(vc, [0.14, 0.004, 0.003], [-0.06, 0.04 + i * 0.015, 0.049], { vc: '#b9a88a', bevel: 0 })
  k.cyl(k.m('ceramic', '#efe3c8'), 0.045, 0.045, 0.006, [0.08, 0.1, 0.047], { rot: [Math.PI / 2, 0, 0], seg: 24 })
  for (let i = 0; i < 9; i++) {
    const a = -1.2 + i * 0.3
    k.box(vc, [0.002, 0.01, 0.002], [0.08 + Math.sin(a) * 0.036, 0.1 + Math.cos(a) * 0.036, 0.051], { rot: [0, 0, -a], vc: '#3a2a20', bevel: 0 })
  }
  k.box(vc, [0.003, 0.05, 0.002], [0.08, 0.1, 0.052], { rot: [0, 0, -0.4], vc: '#b3202a', bevel: 0 })
  k.cyl(k.m('chrome'), 0.014, 0.014, 0.014, [0.08, 0.035, 0.05], { rot: [Math.PI / 2, 0, 0], seg: 14 })
  const strap = k.m('leather', '#4d2c1c')
  k.tube(strap, [[-0.13, 0.17, 0], [-0.1, 0.225, 0], [0.1, 0.225, 0], [0.13, 0.17, 0]], 0.006, { seg: 16 })
  k.rod(k.m('chrome'), [0.12, 0.19, -0.02], [0.14, 0.22, -0.035], 0.003)
  return k.root
}

/** A wooden valve radio with cloth speaker panel, dial window and knobs. 0.52 × 0.33 × 0.24. */
export const radioValve: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(str(p, 'wood', 'woodDark') as 'woodDark')
  k.slab(wood, [0.52, 0.3, 0.24], [0, 0.02, 0], { bevel: 0.025, shadow: true })
  k.slab(k.m('woodLight'), [0.5, 0.02, 0.22], [0, 0, 0])
  k.box(k.m('fabric', '#cdb68e'), [0.44, 0.13, 0.006], [0, 0.23, 0.12], { bevel: 0 })
  const vc = k.m('vc')
  for (let i = 0; i < 4; i++) k.box(vc, [0.012, 0.13, 0.006], [-0.15 + i * 0.1, 0.23, 0.123], { vc: '#5b3a25', bevel: 0 })
  k.box(k.m('ceramic', '#efe0b8'), [0.34, 0.05, 0.006], [0, 0.12, 0.121], { bevel: 0 })
  for (let i = 0; i < 12; i++) k.box(vc, [0.003, i % 3 === 0 ? 0.025 : 0.014, 0.002], [-0.15 + i * 0.027, 0.12, 0.125], { vc: '#3a2a20', bevel: 0 })
  k.box(vc, [0.004, 0.045, 0.003], [0.03, 0.12, 0.126], { vc: '#b3202a', bevel: 0 })
  for (const x of [-0.2, 0.2]) k.cyl(k.m('ceramic', '#e8dcc0'), 0.022, 0.024, 0.02, [x, 0.12, 0.128], { rot: [Math.PI / 2, 0, 0], seg: 16 })
  for (let i = 0; i < 4; i++) k.box(k.m('ceramic', '#f1e8d2'), [0.035, 0.018, 0.02], [-0.06 + i * 0.04, 0.055, 0.125], { bevel: 0.004 })
  return k.root
}

/** A two-in-one cassette player with twin speakers. 0.44 × 0.21 × 0.12. */
export const cassettePlayer: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const body = k.m('plastic', str(p, 'colour', '#2c2c30'))
  k.slab(body, [0.44, 0.17, 0.11], [0, 0, 0], { bevel: 0.015, shadow: true })
  const grille = k.m('vc')
  const silver = k.m('aluminium')
  for (const s of [-1, 1]) {
    k.cyl(silver, 0.058, 0.058, 0.006, [s * 0.14, 0.085, 0.055], { rot: [Math.PI / 2, 0, 0], seg: 24 })
    k.cyl(grille, 0.05, 0.05, 0.004, [s * 0.14, 0.085, 0.059], { rot: [Math.PI / 2, 0, 0], seg: 24, vc: '#1a1a1c' })
    k.cyl(silver, 0.012, 0.012, 0.004, [s * 0.14, 0.085, 0.062], { rot: [Math.PI / 2, 0, 0], seg: 10 })
  }
  k.box(silver, [0.13, 0.1, 0.004], [0, 0.085, 0.056], { bevel: 0 })
  k.box(grille, [0.1, 0.055, 0.003], [0, 0.09, 0.059], { vc: '#3b3f44', bevel: 0 })
  for (const x of [-0.022, 0.022]) k.cyl(grille, 0.012, 0.012, 0.003, [x, 0.09, 0.061], { rot: [Math.PI / 2, 0, 0], vc: '#c9c3b5', seg: 12 })
  for (let i = 0; i < 6; i++) k.box(silver, [0.018, 0.012, 0.03], [-0.05 + i * 0.02, 0.176, 0.02], { bevel: 0.003 })
  k.tube(silver, [[-0.16, 0.17, -0.02], [-0.12, 0.21, -0.02], [0.12, 0.21, -0.02], [0.16, 0.17, -0.02]], 0.007, { seg: 16 })
  return k.root
}

/** A hand harmonium: wooden box, keyboard, stops and folded bellows. 0.62 × 0.3 × 0.36. */
export const harmonium: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('woodDark')
  k.slab(wood, [0.62, 0.2, 0.36], [0, 0, 0], { bevel: 0.01, shadow: true })
  const vc = k.m('vcGloss')
  // Keyboard along the front of the top.
  const keys = 24
  for (let i = 0; i < keys; i++) k.box(vc, [0.019, 0.018, 0.1], [-0.23 + i * 0.02, 0.21, 0.1], { vc: '#f3eee2', bevel: 0.001 })
  const black = [1, 3, 6, 8, 10]
  for (let o = 0; o < 4; o++) for (const b of black) {
    const i = o * 7 + b
    if (i >= keys) continue
    k.box(vc, [0.011, 0.016, 0.06], [-0.23 + i * 0.02 - 0.01, 0.226, 0.075], { vc: '#1d1b1a', bevel: 0.001 })
  }
  k.box(wood, [0.6, 0.03, 0.02], [0, 0.215, 0.165])
  // Stop knobs along the front face.
  for (let i = 0; i < 7; i++) k.cyl(k.m('ceramic', '#efe6d0'), 0.009, 0.009, 0.025, [-0.21 + i * 0.07, 0.13, 0.19], { rot: [Math.PI / 2, 0, 0], seg: 10 })
  // Bellows at the back.
  const bellows = k.m('vc', undefined, { rough: 0.9 })
  for (let i = 0; i < 5; i++) k.box(bellows, [0.6, 0.012, 0.1], [0, 0.205 + i * 0.016, -0.12], { vc: i % 2 ? '#2a2724' : '#6b2a22', bevel: 0 })
  k.box(wood, [0.6, 0.02, 0.12], [0, 0.29, -0.12])
  for (let i = 0; i < 3; i++) k.cyl(k.m('brass'), 0.02, 0.02, 0.004, [-0.2 + i * 0.2, 0.1, 0.181], { rot: [Math.PI / 2, 0, 0], seg: 12 })
  return k.root
}

/** A CRT television on a wooden cabinet. 0.8 × 1.02 × 0.5. */
export const televisionCrt: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('wood')
  k.slab(wood, [0.8, 0.52, 0.48], [0, 0.04, 0], { shadow: true })
  k.slab(k.m('woodDark'), [0.78, 0.04, 0.44], [0, 0, 0])
  for (const s of [-1, 1]) {
    k.box(wood, [0.36, 0.4, 0.012], [s * 0.19, 0.3, 0.244], { bevel: 0.004 })
    k.sphere(k.m('brass'), 0.012, [s * 0.03, 0.3, 0.255], { seg: 8 })
  }
  k.box(k.m('fabric', '#efe6d2'), [0.5, 0.004, 0.36], [0, 0.562, 0.02], { bevel: 0 })
  const casing = k.m('plastic', '#5a4a3a')
  k.slab(casing, [0.6, 0.44, 0.4], [0, 0.564, 0.02], { bevel: 0.03, shadow: true })
  k.slab(casing, [0.42, 0.3, 0.12], [0, 0.6, -0.22], { bevel: 0.03 })
  k.box(k.m('screen'), [0.4, 0.32, 0.04], [-0.05, 0.785, 0.21], { bevel: 0.03 })
  const vc = k.m('vc')
  k.box(vc, [0.1, 0.34, 0.004], [0.24, 0.784, 0.222], { vc: '#3a2e24', bevel: 0 })
  for (let i = 0; i < 2; i++) k.cyl(k.m('chrome'), 0.018, 0.018, 0.02, [0.245, 0.88 - i * 0.07, 0.228], { rot: [Math.PI / 2, 0, 0], seg: 12 })
  for (let i = 0; i < 5; i++) k.box(vc, [0.06, 0.005, 0.003], [0.245, 0.72 - i * 0.02, 0.225], { vc: '#1b1714', bevel: 0 })
  k.rod(k.m('chrome'), [-0.08, 1.0, -0.2], [-0.24, 1.17, -0.22], 0.004)
  k.rod(k.m('chrome'), [-0.06, 1.0, -0.2], [0.1, 1.17, -0.22], 0.004)
  k.cyl(k.m('black'), 0.03, 0.035, 0.02, [-0.07, 0.99, -0.2], { seg: 12 })
  return k.root
}
