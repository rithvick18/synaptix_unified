/** Textiles: durrie, woven mat, cushions, table cloth, gamosa. */
import { Kit, type Builder } from '../kit'
import { str } from './common'

/** A flat-woven cotton durrie with bands and fringes. 2.0 × 0.012 × 1.4. */
export const rugDurrie: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const vc = k.m('vc', undefined, { rough: 0.95 })
  const base = str(p, 'base', '#2f4c6e'), band = str(p, 'band', '#b3452f'), light = str(p, 'light', '#e7dcc3')
  const W = 1.9, D = 1.4
  k.box(vc, [W, 0.008, D], [0, 0.004, 0], { vc: base, bevel: 0 })
  // Border and bands across the width (along x).
  for (const s of [-1, 1]) {
    k.box(vc, [W - 0.1, 0.002, 0.06], [0, 0.009, s * (D / 2 - 0.08)], { vc: band, bevel: 0 })
    k.box(vc, [W - 0.1, 0.002, 0.03], [0, 0.009, s * (D / 2 - 0.15)], { vc: light, bevel: 0 })
    k.box(vc, [0.06, 0.002, D - 0.1], [s * (W / 2 - 0.08), 0.009, 0], { vc: band, bevel: 0 })
  }
  for (const z of [-0.36, 0, 0.36]) {
    k.box(vc, [W - 0.3, 0.002, 0.08], [0, 0.009, z], { vc: z === 0 ? band : light, bevel: 0 })
  }
  for (const z of [-0.18, 0.18]) k.box(vc, [W - 0.3, 0.002, 0.03], [0, 0.009, z], { vc: '#d39b3a', bevel: 0 })
  // Fringes at the two short ends.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 14; i++) k.box(vc, [0.05, 0.003, 0.018], [s * (W / 2 + 0.025), 0.002, -D / 2 + 0.08 + i * ((D - 0.16) / 13)], { vc: light, bevel: 0 })
  }
  return k.root
}

/** A woven reed or grass floor mat with a cloth border. 1.2 × 0.01 × 0.8. */
export const floorMatWoven: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  k.box(k.m('jute', str(p, 'colour', '#c7a768')), [1.2, 0.007, 0.8], [0, 0.0035, 0], { bevel: 0 })
  const vc = k.m('vc', undefined, { rough: 0.95 })
  const edge = str(p, 'edge', '#8a2f2a')
  for (const s of [-1, 1]) {
    k.box(vc, [1.2, 0.009, 0.035], [0, 0.0045, s * 0.3825], { vc: edge, bevel: 0 })
    k.box(vc, [0.035, 0.009, 0.8], [s * 0.5825, 0.0045, 0], { vc: edge, bevel: 0 })
    k.box(vc, [1.0, 0.0085, 0.02], [0, 0.0045, s * 0.25], { vc: '#3e6a4a', bevel: 0 })
  }
  return k.root
}

/** Two cushions leaning back, for a sofa or bench. 0.92 × 0.42 × 0.24. */
export const cushionSet: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const a = k.m('fabric', str(p, 'a', '#b5543c'))
  const b = k.m('fabric', str(p, 'b', '#d6a13a'))
  k.box(a, [0.43, 0.41, 0.14], [-0.235, 0.205, 0.0], { bevel: 'soft', rot: [-0.22, 0, 0.03] })
  k.box(b, [0.43, 0.41, 0.14], [0.235, 0.205, 0.0], { bevel: 'soft', rot: [-0.22, 0, -0.03] })
  const vc = k.m('vc')
  k.sphere(vc, 0.014, [-0.235, 0.215, 0.072], { vc: '#e8dcc0', seg: 8 })
  k.sphere(vc, 0.014, [0.235, 0.215, 0.072], { vc: '#7a2f2a', seg: 8 })
  return k.root
}

/** An embroidered cotton cloth spread on a table. 1.2 × 0.008 × 0.75. */
export const tableCloth: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  k.box(k.m('fabric', str(p, 'colour', '#efe6d2')), [1.2, 0.004, 0.75], [0, 0.002, 0], { bevel: 0 })
  const vc = k.m('vc', undefined, { rough: 0.95 })
  for (const s of [-1, 1]) {
    k.box(vc, [1.1, 0.004, 0.02], [0, 0.005, s * 0.33], { vc: '#a8402f', bevel: 0 })
    k.box(vc, [0.02, 0.004, 0.68], [s * 0.53, 0.005, 0], { vc: '#a8402f', bevel: 0 })
  }
  for (let i = -4; i <= 4; i++) {
    k.box(vc, [0.03, 0.004, 0.03], [i * 0.11, 0.005, 0.3], { vc: '#3f6b4a', rot: [0, Math.PI / 4, 0], bevel: 0 })
    k.box(vc, [0.03, 0.004, 0.03], [i * 0.11, 0.005, -0.3], { vc: '#3f6b4a', rot: [0, Math.PI / 4, 0], bevel: 0 })
  }
  return k.root
}

/**
 * A gamosa hung from a wooden rod: white woven cotton with red borders along the sides
 * and a red woven band at the end. 0.6 × 0.95 × 0.05.
 */
export const gamosa: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('woodDark')
  const clothW = 0.46, top = 0.9, bottom = 0.06
  k.cyl(wood, 0.012, 0.012, 0.6, [0, top + 0.012, 0.018], { rot: [0, 0, Math.PI / 2], seg: 10 })
  for (const s of [-1, 1]) k.cyl(wood, 0.008, 0.008, 0.036, [s * 0.27, top + 0.012, 0.0], { rot: [Math.PI / 2, 0, 0], seg: 8 })
  const white = k.m('fabric', '#f6f2e8')
  const len = top - bottom
  k.box(white, [clothW, len, 0.004], [0, bottom + len / 2, 0.01], { bevel: 0 })
  // The fold over the rod.
  k.box(white, [clothW, 0.12, 0.004], [0, top - 0.05, 0.03], { bevel: 0 })
  const vc = k.m('vc', undefined, { rough: 0.95 })
  const red = '#b3202a'
  for (const s of [-1, 1]) {
    k.box(vc, [0.026, len, 0.002], [s * (clothW / 2 - 0.02), bottom + len / 2, 0.0132], { vc: red, bevel: 0 })
    k.box(vc, [0.026, 0.12, 0.002], [s * (clothW / 2 - 0.02), top - 0.05, 0.0332], { vc: red, bevel: 0 })
  }
  // The woven band at the lower end: a red line and a row of small woven motifs.
  k.box(vc, [clothW - 0.02, 0.018, 0.002], [0, bottom + 0.05, 0.0132], { vc: red, bevel: 0 })
  k.box(vc, [clothW - 0.02, 0.008, 0.002], [0, bottom + 0.165, 0.0132], { vc: red, bevel: 0 })
  for (let i = 0; i < 7; i++) {
    const x = -0.18 + i * 0.06
    k.box(vc, [0.034, 0.034, 0.002], [x, bottom + 0.11, 0.0134], { vc: red, rot: [0, 0, Math.PI / 4], bevel: 0 })
    k.box(vc, [0.014, 0.014, 0.002], [x, bottom + 0.11, 0.0138], { vc: '#f6f2e8', rot: [0, 0, Math.PI / 4], bevel: 0 })
  }
  for (let i = 0; i < 16; i++) k.box(vc, [0.006, 0.05, 0.002], [-clothW / 2 + 0.02 + i * ((clothW - 0.04) / 15), bottom - 0.025, 0.01], { vc: '#eee8da', bevel: 0 })
  return k.root
}
