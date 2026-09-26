/** Kitchen and food: vessels, utensils, the stove, the water pot, the xorai. */
import { Kit, type Builder } from '../kit'
import { TAU } from './common'

/** A stovetop pressure cooker with a long handle and whistle. 0.44 × 0.26 × 0.23. */
export const pressureCooker: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const al = k.m('aluminium')
  const black = k.m('black')
  const ox = -0.06
  k.lathe(al, [[0, 0], [0.1, 0], [0.108, 0.01], [0.11, 0.16], [0.114, 0.166], [0.108, 0.17], [0.1, 0.17]], [ox, 0, 0], { seg: 28 })
  k.lathe(al, [[0, 0.188], [0.07, 0.186], [0.098, 0.178], [0.102, 0.168], [0, 0.168]], [ox, 0, 0], { seg: 28 })
  k.cyl(al, 0.009, 0.011, 0.03, [ox, 0.2, 0], { seg: 10 })
  k.cyl(black, 0.016, 0.018, 0.028, [ox, 0.228, 0], { seg: 12 })
  k.sphere(black, 0.01, [ox, 0.245, 0], { seg: 8 })
  k.box(black, [0.17, 0.028, 0.034], [ox + 0.19, 0.18, 0], { bevel: 0.01 })
  k.box(black, [0.16, 0.026, 0.032], [ox + 0.185, 0.148, 0], { bevel: 0.01 })
  k.box(black, [0.05, 0.024, 0.03], [ox - 0.14, 0.15, 0], { bevel: 0.008 })
  return k.root
}

/** Three steel tumblers. 0.23 × 0.12 × 0.19. */
export const steelTumblerSet: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  const tumbler: [number, number][] = [[0, 0], [0.028, 0], [0.036, 0.115], [0.033, 0.115], [0.026, 0.004], [0, 0.004]]
  for (const [x, z] of [[-0.075, 0.03], [0.0, -0.05], [0.075, 0.03]] as const) k.lathe(steel, tumbler, [x, 0, z], { seg: 20 })
  return k.root
}

/** A steel thali with two small bowls. 0.3 × 0.05 × 0.3. */
export const steelPlate: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  k.lathe(steel, [[0, 0.004], [0.12, 0.004], [0.14, 0.018], [0.15, 0.022], [0.146, 0.024], [0.136, 0.02], [0.118, 0.008], [0, 0.008]], [0, 0, 0], { seg: 36 })
  k.cyl(steel, 0.12, 0.12, 0.004, [0, 0.002, 0], { seg: 36 })
  const bowl: [number, number][] = [[0, 0], [0.03, 0], [0.042, 0.035], [0.04, 0.038], [0.028, 0.006], [0, 0.006]]
  k.lathe(steel, bowl, [-0.06, 0.008, -0.05], { seg: 18 })
  k.lathe(steel, bowl, [0.04, 0.008, -0.07], { seg: 18 })
  return k.root
}

/** A three-tier steel tiffin carrier with its clamp and handle. 0.17 × 0.36 × 0.14. */
export const tiffinCarrier: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  for (let i = 0; i < 3; i++) {
    const y = 0.005 + i * 0.085
    k.lathe(steel, [[0, 0], [0.058, 0], [0.062, 0.006], [0.062, 0.078], [0.066, 0.082], [0.058, 0.085], [0, 0.085]], [0, y, 0], { seg: 24 })
  }
  k.lathe(steel, [[0, 0.26], [0.064, 0.26], [0.05, 0.28], [0, 0.285]], [0, 0, 0], { seg: 24 })
  for (const s of [-1, 1]) {
    k.box(steel, [0.008, 0.33, 0.018], [s * 0.074, 0.165, 0], { bevel: 0.002 })
  }
  k.box(steel, [0.156, 0.008, 0.018], [0, 0.325, 0], { bevel: 0.002 })
  k.torus(k.m('black'), 0.03, 0.007, [0, 0.333, 0], { arc: Math.PI, seg: 12 })
  return k.root
}

/** An open round spice box: seven small bowls of spices. 0.24 × 0.08 × 0.24. */
export const spiceBox: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  k.lathe(steel, [[0, 0], [0.11, 0], [0.12, 0.01], [0.12, 0.07], [0.116, 0.07], [0.114, 0.012], [0, 0.012]], [0, 0, 0], { seg: 32 })
  const spices = ['#d9a21c', '#b8321f', '#6d4a2a', '#3a2a1f', '#8c7a3a', '#c2862f', '#e9e2d0']
  const vc = k.m('vc', undefined, { rough: 0.95 })
  const cup: [number, number][] = [[0, 0], [0.026, 0], [0.034, 0.05], [0.032, 0.05], [0.024, 0.004], [0, 0.004]]
  const spots: [number, number][] = [[0, 0]]
  for (let i = 0; i < 6; i++) spots.push([Math.sin((i / 6) * TAU) * 0.074, Math.cos((i / 6) * TAU) * 0.074])
  spots.forEach(([x, z], i) => {
    k.lathe(steel, cup, [x, 0.012, z], { seg: 14 })
    k.sphere(vc, 0.031, [x, 0.052, z], { vc: spices[i], seg: 12, scale: [1, 0.28, 1] })
  })
  k.box(steel, [0.012, 0.004, 0.08], [0.02, 0.07, 0.02], { rot: [0, 0.5, 0.3], bevel: 0 })
  return k.root
}

/** A round board on short legs with a rolling pin. 0.38 × 0.07 × 0.3. */
export const rollingBoardPin: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('woodLight')
  k.cyl(wood, 0.135, 0.135, 0.022, [0, 0.036, 0], { seg: 32 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU
    k.cyl(wood, 0.014, 0.012, 0.026, [Math.sin(a) * 0.09, 0.013, Math.cos(a) * 0.09], { seg: 8 })
  }
  const pin = k.group([0.02, 0.063, 0.05], { rot: [0, 0.45, Math.PI / 2] })
  k.cyl(wood, 0.016, 0.016, 0.24, [0, 0, 0], { seg: 12, parent: pin })
  for (const s of [-1, 1]) k.cyl(wood, 0.008, 0.014, 0.06, [0, s * 0.15, 0], { seg: 10, parent: pin, rot: s < 0 ? [Math.PI, 0, 0] : undefined })
  return k.root
}

/** An iron kadai with two loop handles. 0.44 × 0.13 × 0.34. */
export const kadai: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const iron = k.m('iron')
  k.lathe(iron, [[0, 0.01], [0.06, 0.012], [0.11, 0.035], [0.15, 0.085], [0.168, 0.125], [0.162, 0.127], [0.144, 0.088], [0.105, 0.042], [0.055, 0.02], [0, 0.018]], [0, 0, 0], { seg: 32 })
  k.cyl(iron, 0.05, 0.05, 0.01, [0, 0.005, 0], { seg: 16 })
  for (const s of [-1, 1]) k.torus(iron, 0.036, 0.007, [s * 0.18, 0.112, 0], { rot: [Math.PI / 2, 0, s < 0 ? Math.PI / 2 : -Math.PI / 2], arc: Math.PI, seg: 12 })
  return k.root
}

/** A flat iron griddle with a handle. 0.44 × 0.04 × 0.28. */
export const tawa: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const iron = k.m('iron')
  k.lathe(iron, [[0, 0.012], [0.13, 0.008], [0.14, 0.018], [0.136, 0.02], [0.126, 0.012], [0, 0.017]], [-0.07, 0, 0], { seg: 32 })
  k.cyl(iron, 0.02, 0.02, 0.012, [-0.07, 0.006, 0], { seg: 12 })
  k.box(iron, [0.1, 0.008, 0.022], [0.115, 0.024, 0], { rot: [0, 0, 0.1] })
  k.box(k.m('woodDark'), [0.1, 0.022, 0.028], [0.2, 0.032, 0], { rot: [0, 0, 0.1], bevel: 0.008 })
  return k.root
}

/** A round clay water pot on a small iron stand, with a lid and a cup. 0.4 × 0.58 × 0.4. */
export const clayWaterPot: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const clay = k.m('clay')
  const iron = k.m('iron')
  k.torus(iron, 0.13, 0.008, [0, 0.12, 0], { rot: [Math.PI / 2, 0, 0], seg: 24 })
  k.torus(iron, 0.16, 0.008, [0, 0.01, 0], { rot: [Math.PI / 2, 0, 0], seg: 24 })
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3
    k.rod(iron, [Math.sin(a) * 0.16, 0.01, Math.cos(a) * 0.16], [Math.sin(a) * 0.13, 0.12, Math.cos(a) * 0.13], 0.008)
  }
  k.lathe(clay, [[0, 0.08], [0.08, 0.085], [0.15, 0.13], [0.19, 0.24], [0.18, 0.35], [0.12, 0.44], [0.075, 0.47], [0.07, 0.49], [0.085, 0.51], [0.08, 0.52], [0.06, 0.5], [0, 0.5]], [0, 0, 0], { seg: 32, shadow: true })
  k.cyl(k.m('steel'), 0.1, 0.1, 0.008, [0, 0.522, 0], { seg: 28 })
  k.lathe(k.m('steel'), [[0, 0], [0.028, 0], [0.034, 0.08], [0.031, 0.08], [0.025, 0.004], [0, 0.004]], [0.02, 0.526, 0.0], { seg: 16 })
  return k.root
}

/** A brass lota: round belly, narrow neck, flared lip. 0.18 × 0.22 × 0.18. */
export const brassVessel: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  k.lathe(k.m('brass'), [[0, 0], [0.05, 0], [0.06, 0.008], [0.085, 0.05], [0.09, 0.09], [0.075, 0.14], [0.045, 0.17], [0.042, 0.19], [0.06, 0.215], [0.056, 0.218], [0.036, 0.19], [0, 0.19]], [0, 0, 0], { seg: 28 })
  return k.root
}

/** An aluminium kettle with a spout and handle. 0.28 × 0.24 × 0.18. */
export const kettle: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const al = k.m('aluminium')
  k.lathe(al, [[0, 0], [0.085, 0], [0.09, 0.01], [0.09, 0.1], [0.07, 0.14], [0.05, 0.15], [0, 0.15]], [-0.02, 0, 0], { seg: 28 })
  k.cyl(k.m('black'), 0.012, 0.02, 0.025, [-0.02, 0.162, 0], { seg: 10 })
  k.tube(al, [[0.05, 0.05, 0], [0.09, 0.08, 0], [0.11, 0.12, 0], [0.12, 0.14, 0]], 0.011, { seg: 12 })
  k.tube(k.m('black'), [[-0.09, 0.12, 0], [-0.08, 0.215, 0], [-0.02, 0.232, 0], [0.04, 0.215, 0], [0.05, 0.13, 0]], 0.008, { seg: 18 })
  return k.root
}

/** A glazed ceramic pickle jar with a lid. 0.17 × 0.25 × 0.17. */
export const jarPickle: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  k.lathe(k.m('ceramic', '#e6dcc3'), [[0, 0], [0.06, 0], [0.078, 0.04], [0.082, 0.11], [0.08, 0.14], [0, 0.14]], [0, 0, 0], { seg: 24 })
  k.lathe(k.m('ceramic', '#7a4a26'), [[0, 0.14], [0.08, 0.14], [0.074, 0.18], [0.05, 0.2], [0.045, 0.21], [0, 0.21]], [0, 0, 0], { seg: 24 })
  k.lathe(k.m('ceramic', '#7a4a26'), [[0, 0.21], [0.055, 0.21], [0.05, 0.225], [0.02, 0.232], [0.014, 0.248], [0, 0.25]], [0, 0, 0], { seg: 20 })
  k.box(k.m('fabric', '#b5432f'), [0.12, 0.004, 0.12], [0, 0.226, 0], { rot: [0, 0.4, 0], bevel: 0 })
  return k.root
}

/** A two-burner gas stove. 0.7 × 0.13 × 0.4. */
export const gasStove: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const steel = k.m('steel')
  const black = k.m('black')
  k.slab(steel, [0.68, 0.075, 0.38], [0, 0.015, 0], { bevel: 0.01 })
  k.slab(k.m('screen', '#1c1c1e'), [0.64, 0.006, 0.3], [0, 0.09, -0.02], { bevel: 0 })
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(black, 0.012, 0.012, 0.015, [sx * 0.3, 0.0075, sz * 0.16], { seg: 8 })
  for (const s of [-1, 1]) {
    const x = s * 0.17
    k.cyl(black, 0.06, 0.065, 0.015, [x, 0.103, -0.02], { seg: 20 })
    k.cyl(k.m('brass'), 0.035, 0.04, 0.014, [x, 0.114, -0.02], { seg: 16 })
    k.cyl(black, 0.02, 0.02, 0.008, [x, 0.124, -0.02], { seg: 12 })
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4
      k.box(black, [0.012, 0.012, 0.06], [x + Math.sin(a) * 0.06, 0.118, -0.02 + Math.cos(a) * 0.06], { rot: [0, a, 0], bevel: 0 })
    }
    k.cyl(black, 0.022, 0.022, 0.025, [x, 0.052, 0.2], { rot: [Math.PI / 2, 0, 0], seg: 14 })
  }
  return k.root
}

/** A stone mortar with its pestle. 0.2 × 0.2 × 0.2. */
export const mortarPestle: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const stone = k.m('stone', '#7d7a73')
  k.lathe(stone, [[0, 0], [0.08, 0], [0.095, 0.03], [0.1, 0.09], [0.094, 0.1], [0.075, 0.1], [0.06, 0.04], [0, 0.035]], [0, 0, 0], { seg: 24 })
  k.cyl(stone, 0.022, 0.03, 0.17, [0.025, 0.12, 0.0], { rot: [0, 0, -0.35], seg: 12 })
  return k.root
}

/**
 * A xorai: a bell-metal tray on a stand with a domed cover and a finial.
 * 0.3 × 0.42 × 0.3.
 */
export const xorai: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const bm = k.m('bellMetal')
  k.lathe(bm, [[0, 0], [0.1, 0], [0.105, 0.008], [0.07, 0.03], [0.035, 0.06], [0.03, 0.1], [0.04, 0.115], [0.03, 0.13], [0.03, 0.15], [0.06, 0.16], [0.13, 0.17], [0.145, 0.185], [0.14, 0.19], [0.1, 0.18], [0, 0.18]], [0, 0, 0], { seg: 32, shadow: true })
  k.lathe(bm, [[0.12, 0.19], [0.118, 0.215], [0.1, 0.26], [0.07, 0.3], [0.035, 0.33], [0.02, 0.345], [0, 0.35]], [0, 0, 0], { seg: 32 })
  k.lathe(bm, [[0, 0.345], [0.02, 0.345], [0.03, 0.36], [0.018, 0.375], [0.012, 0.39], [0.02, 0.4], [0.008, 0.42], [0, 0.425]], [0, 0, 0], { seg: 16 })
  k.torus(bm, 0.119, 0.004, [0, 0.215, 0], { rot: [Math.PI / 2, 0, 0], seg: 32 })
  return k.root
}
