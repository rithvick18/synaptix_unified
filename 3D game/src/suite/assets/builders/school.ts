/** School and work: books, slate, bag, sewing machine, typewriter, ledger. */
import { Kit, type Builder } from '../kit'
import { runtimeText, TAU } from './common'

/**
 * A stack of four books, spines facing the viewer. Spine titles are drawn at runtime in the
 * active language (runtimeText 'spines', slots spine-0 … spine-3, bottom to top).
 */
export const booksStack: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const W = 0.24
  const books: [number, number, string][] = [[0.045, 0.19, '#2f4f6f'], [0.035, 0.18, '#7b2e2a'], [0.05, 0.2, '#3e5f3a'], [0.03, 0.17, '#b28a3c']]
  const front = 0.1
  const vc = k.m('vc')
  const pages = k.m('paper', '#ece3cd')
  let y = 0
  const spines: { y0: number; y1: number; colour: string }[] = []
  for (const [t, d, colour] of books) {
    k.box(vc, [W, t, d], [0, y + t / 2, front - d / 2], { vc: colour, bevel: 0.003 })
    k.box(pages, [W - 0.012, t - 0.008, 0.004], [0, y + t / 2, front - d - 0.0005], { bevel: 0 })
    spines.push({ y0: y, y1: y + t, colour })
    y += t
  }
  const total = y
  const plane = k.plane(k.m('vc'), W - 0.004, total - 0.002, [0, total / 2, front + 0.0012], { vc: '#ffffff' })
  runtimeText(plane, 'spines', [256, Math.round((256 * total) / W)], {
    spines: spines.map((s) => ({ y0: s.y0 / total, y1: s.y1 / total, colour: s.colour }))
  })
  return k.root
}

/** A wooden-framed writing slate with a stick of chalk. 0.32 × 0.02 × 0.24. */
export const schoolSlate: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('woodLight')
  k.slab(k.m('slate'), [0.28, 0.008, 0.2], [0, 0.004, 0], { bevel: 0 })
  k.slab(wood, [0.32, 0.016, 0.022], [0, 0, 0.109])
  k.slab(wood, [0.32, 0.016, 0.022], [0, 0, -0.109])
  k.slab(wood, [0.022, 0.016, 0.2], [0.149, 0, 0])
  k.slab(wood, [0.022, 0.016, 0.2], [-0.149, 0, 0])
  const chalk = k.m('vc', undefined, { rough: 1 })
  // Simple chalk marks: lines and a circle, not letters.
  k.box(chalk, [0.16, 0.001, 0.004], [-0.02, 0.0085, -0.05], { vc: '#e8e6df', bevel: 0 })
  k.box(chalk, [0.12, 0.001, 0.004], [-0.04, 0.0085, -0.01], { vc: '#e8e6df', bevel: 0 })
  k.torus(chalk, 0.03, 0.002, [0.07, 0.0085, 0.04], { rot: [Math.PI / 2, 0, 0], vc: '#e8e6df', seg: 18 })
  k.cyl(chalk, 0.005, 0.005, 0.05, [0.2 - 0.07, 0.022, 0.13], { rot: [0, 0.4, Math.PI / 2], vc: '#f4f2ea', seg: 8 })
  return k.root
}

/** A canvas school satchel with a flap, buckles and a shoulder strap. 0.36 × 0.42 × 0.16. */
export const schoolBag: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const cloth = k.m('fabric', '#3f5f7f')
  k.slab(cloth, [0.34, 0.28, 0.12], [0, 0, 0], { bevel: 'soft', shadow: true })
  k.box(k.m('fabric', '#35516d'), [0.345, 0.16, 0.02], [0, 0.2, 0.06], { bevel: 0.006, rot: [0.05, 0, 0] })
  const leather = k.m('leather', '#6a3f28')
  for (const x of [-0.09, 0.09]) {
    k.box(leather, [0.03, 0.14, 0.006], [x, 0.16, 0.072])
    k.box(k.m('brass'), [0.03, 0.022, 0.006], [x, 0.11, 0.076], { bevel: 0.002 })
  }
  k.tube(leather, [[-0.16, 0.25, 0], [-0.13, 0.4, 0], [0.13, 0.4, 0], [0.16, 0.25, 0]], 0.01, { seg: 16 })
  return k.root
}

/** A treadle sewing machine on its iron stand and wooden top. 0.9 × 1.1 × 0.45. */
export const sewingMachine: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const iron = k.m('iron')
  const wood = k.m('wood')
  const black = k.m('black')
  // The cast-iron stand: two side frames with a crossbar and treadle.
  for (const s of [-1, 1]) {
    const x = s * 0.36
    k.rod(iron, [x, 0.02, 0.18], [x, 0.74, 0.16], 0.014, { shadow: true })
    k.rod(iron, [x, 0.02, -0.18], [x, 0.74, -0.16], 0.014, { shadow: true })
    k.rod(iron, [x, 0.74, 0.17], [x, 0.74, -0.17], 0.012)
    k.rod(iron, [x, 0.02, 0.2], [x, 0.02, -0.2], 0.015)
    k.rod(iron, [x, 0.02, 0.18], [x, 0.74, -0.16], 0.008)
    k.rod(iron, [x, 0.02, -0.18], [x, 0.74, 0.16], 0.008)
  }
  k.rod(iron, [-0.36, 0.2, 0], [0.36, 0.2, 0], 0.012)
  k.box(iron, [0.45, 0.02, 0.18], [0, 0.1, 0.05], { rot: [0.2, 0, 0] })
  // The drive wheel on the right.
  k.torus(iron, 0.16, 0.012, [0.28, 0.42, 0.0], { rot: [0, Math.PI / 2, 0], seg: 28 })
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    k.rod(iron, [0.28, 0.42, 0], [0.28, 0.42 + Math.cos(a) * 0.155, Math.sin(a) * 0.155], 0.006)
  }
  // Wooden table and drawers.
  k.slab(wood, [0.9, 0.035, 0.44], [0, 0.75, 0], { shadow: true })
  k.slab(wood, [0.16, 0.14, 0.36], [-0.25, 0.61, 0])
  k.sphere(k.m('brass'), 0.01, [-0.25, 0.68, 0.185], { seg: 8 })
  // The machine head: bed, pillar, arm and hand wheel.
  k.slab(black, [0.36, 0.04, 0.17], [0.02, 0.785, 0.0], { bevel: 0.01 })
  k.slab(black, [0.07, 0.19, 0.08], [0.13, 0.825, 0.0], { bevel: 0.015 })
  k.box(black, [0.3, 0.06, 0.07], [0.02, 0.99, 0.0], { bevel: 0.02 })
  k.slab(black, [0.05, 0.13, 0.05], [-0.11, 0.9, 0.0], { bevel: 0.01 })
  k.cyl(k.m('chrome'), 0.006, 0.006, 0.06, [-0.12, 0.86, 0.0], { seg: 6 })
  k.cyl(k.m('chrome'), 0.055, 0.055, 0.025, [0.19, 0.99, 0.0], { rot: [0, 0, Math.PI / 2], seg: 20 })
  const gold = k.m('brass')
  k.box(gold, [0.2, 0.012, 0.002], [0.02, 1.0, 0.036], { bevel: 0 })
  k.cyl(k.m('vc'), 0.012, 0.012, 0.03, [0.02, 1.03, 0.0], { vc: '#c8ae82', seg: 10 })
  return k.root
}

/** A manual typewriter with a sheet of paper in the roller. 0.46 × 0.26 × 0.38. */
export const typewriter: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const body = k.m('plastic', typeof p.colour === 'string' ? p.colour : '#2e4a3e')
  k.slab(body, [0.42, 0.1, 0.3], [0, 0, 0.02], { bevel: 0.02, shadow: true })
  k.box(body, [0.42, 0.06, 0.12], [0, 0.12, -0.08], { bevel: 0.02 })
  const vc = k.m('vcGloss')
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 10; i++) {
      const x = -0.17 + i * 0.036 + row * 0.008
      k.cyl(vc, 0.011, 0.011, 0.012, [x, 0.105 + row * 0.012, 0.15 - row * 0.03], { vc: '#1d1d1f', seg: 10 })
      k.cyl(vc, 0.009, 0.009, 0.002, [x, 0.112 + row * 0.012, 0.15 - row * 0.03], { vc: '#ece6d6', seg: 10 })
    }
  }
  k.box(vc, [0.18, 0.012, 0.025], [0, 0.1, 0.18], { vc: '#1d1d1f' })
  k.cyl(k.m('black'), 0.022, 0.022, 0.46, [0, 0.165, -0.1], { rot: [0, 0, Math.PI / 2], seg: 16 })
  for (const s of [-1, 1]) k.cyl(k.m('chrome'), 0.03, 0.03, 0.02, [s * 0.235, 0.165, -0.1], { rot: [0, 0, Math.PI / 2], seg: 16 })
  k.box(k.m('paper'), [0.2, 0.09, 0.002], [0, 0.22, -0.12], { rot: [-0.25, 0, 0], bevel: 0 })
  k.rod(k.m('chrome'), [-0.23, 0.17, -0.08], [-0.26, 0.19, 0.0], 0.004)
  return k.root
}

/** An open ledger with ruled pages and a fountain pen. 0.42 × 0.04 × 0.3. */
export const ledgerPen: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const cover = k.m('fabric', '#7a2a2a')
  for (const s of [-1, 1]) {
    k.box(cover, [0.2, 0.01, 0.29], [s * 0.102, 0.005, 0], { rot: [0, 0, s * 0.02] })
    k.box(k.m('paper', '#efe6cf'), [0.19, 0.016, 0.275], [s * 0.098, 0.018, 0], { rot: [0, 0, s * 0.025], bevel: 0.003 })
  }
  const vc = k.m('vc')
  for (let i = 0; i < 14; i++) {
    for (const s of [-1, 1]) k.box(vc, [0.17, 0.0006, 0.0015], [s * 0.1, 0.0265 + (s > 0 ? 0 : 0) , -0.12 + i * 0.018], { vc: '#8fa7c2', bevel: 0 })
  }
  for (const s of [-1, 1]) k.box(vc, [0.0015, 0.0006, 0.26], [s * 0.1 + 0.06, 0.0268, 0], { vc: '#c2605a', bevel: 0 })
  const pen = k.group([0.08, 0.036, 0.04], { rot: [0, 0.6, Math.PI / 2] })
  k.cyl(k.m('black'), 0.007, 0.007, 0.1, [0, 0, 0], { parent: pen, seg: 10 })
  k.cyl(k.m('brass'), 0.0072, 0.0072, 0.008, [0, 0.03, 0], { parent: pen, seg: 10 })
  k.cyl(k.m('brass'), 0.002, 0.006, 0.025, [0, -0.062, 0], { parent: pen, seg: 8, rot: [Math.PI, 0, 0] })
  return k.root
}
