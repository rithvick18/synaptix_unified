/** Travel, hobbies and games, community, lighting, decor and the jaapi. */
import * as THREE from 'three'
import { Kit, type Builder } from '../kit'
import { pivot, str, TAU } from './common'

// ------------------------------------------------------------------------------ travel

/** An old hard suitcase standing on its long edge. 0.62 × 0.5 × 0.2. */
export const suitcaseOld: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const shell = k.m('leather', str(p, 'colour', '#7a5a3a'))
  k.slab(shell, [0.62, 0.43, 0.2], [0, 0.0, 0], { bevel: 0.025, shadow: true })
  const trim = k.m('leather', '#4a3222')
  k.box(trim, [0.625, 0.02, 0.205], [0, 0.215, 0], { bevel: 0.006 })
  const brass = k.m('brass')
  for (const x of [-0.18, 0.18]) k.box(brass, [0.04, 0.03, 0.012], [x, 0.4, 0.1], { bevel: 0.003 })
  for (const sx of [-1, 1]) for (const y of [0.025, 0.405]) k.box(brass, [0.05, 0.05, 0.21], [sx * 0.3, y, 0], { bevel: 0.01 })
  k.tube(trim, [[-0.08, 0.43, 0], [-0.06, 0.49, 0], [0.06, 0.49, 0], [0.08, 0.43, 0]], 0.012, { seg: 14 })
  return k.root
}

/** A black bicycle on its stand, seen side-on. 1.75 × 1.08 × 0.56. */
export const bicycle: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const frame = k.m('black', '#1f2124')
  const chrome = k.m('chrome')
  const rubber = k.m('rubber')
  const R = 0.34
  const rear: [number, number, number] = [-0.54, R + 0.02, 0], front: [number, number, number] = [0.54, R + 0.02, 0]
  for (const c of [rear, front]) {
    k.torus(rubber, R, 0.022, c, { seg: 40, tube: 8, shadow: true })
    k.torus(chrome, R - 0.03, 0.008, c, { seg: 40 })
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU
      k.rod(chrome, c, [c[0] + Math.cos(a) * (R - 0.03), c[1] + Math.sin(a) * (R - 0.03), 0], 0.0018, { seg: 4 })
    }
    k.cyl(chrome, 0.025, 0.025, 0.07, c, { rot: [Math.PI / 2, 0, 0], seg: 10 })
  }
  const crank: [number, number, number] = [-0.04, 0.32, 0]
  const seatTop: [number, number, number] = [-0.2, 0.86, 0]
  const head: [number, number, number] = [0.4, 0.86, 0]
  const headLow: [number, number, number] = [0.43, 0.72, 0]
  const tube = 0.017
  k.rod(frame, crank, seatTop, tube, { shadow: true })
  k.rod(frame, seatTop, head, tube, { shadow: true })
  k.rod(frame, crank, headLow, tube, { shadow: true })
  k.rod(frame, head, headLow, tube)
  k.rod(frame, crank, rear, 0.011)
  k.rod(frame, seatTop, rear, 0.011)
  k.rod(frame, headLow, front, 0.012)
  k.rod(chrome, head, [0.38, 0.98, 0], 0.012)
  k.rod(chrome, [0.38, 0.98, -0.27], [0.38, 0.98, 0.27], 0.011)
  for (const s of [-1, 1]) k.cyl(rubber, 0.016, 0.016, 0.1, [0.36, 0.98, s * 0.26], { rot: [Math.PI / 2, 0, 0], seg: 8 })
  k.rod(chrome, seatTop, [-0.22, 0.94, 0], 0.012)
  k.box(k.m('leather', '#2a2220'), [0.24, 0.05, 0.13], [-0.21, 0.97, 0], { bevel: 0.02 })
  // Carrier over the rear wheel, chain guard and pedal.
  k.box(chrome, [0.4, 0.012, 0.14], [-0.5, 0.74, 0])
  k.rod(chrome, [-0.66, 0.74, 0], [-0.54, R + 0.02, 0], 0.006)
  k.box(frame, [0.52, 0.06, 0.012], [-0.3, 0.33, 0.04], { rot: [0, 0, 0.03] })
  k.cyl(chrome, 0.08, 0.08, 0.02, [-0.04, 0.32, 0.03], { rot: [Math.PI / 2, 0, 0], seg: 18 })
  k.box(rubber, [0.1, 0.02, 0.05], [0.08, 0.2, 0.08])
  for (const c of [rear, front]) k.torus(frame, R + 0.04, 0.02, c, { arc: Math.PI * 0.55, rot: [0, 0, c === rear ? Math.PI * 0.35 : Math.PI * 0.1], seg: 16 })
  // A rear stand keeping it upright.
  for (const s of [-1, 1]) k.rod(chrome, [-0.54, R + 0.02, s * 0.04], [-0.62, 0.0, s * 0.13], 0.007)
  k.torus(k.m('chrome'), 0.03, 0.006, [0.33, 0.99, 0.2], { seg: 12 })
  return k.root
}

/** A black umbrella hanging by its crook handle. 0.16 × 0.95 × 0.1. */
export const umbrella: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const cloth = k.m('fabric', '#1f2226')
  const wood = k.m('woodDark')
  k.cyl(cloth, 0.012, 0.05, 0.5, [0, 0.33, 0], { seg: 12 })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU
    k.box(cloth, [0.01, 0.42, 0.03], [Math.sin(a) * 0.028, 0.36, Math.cos(a) * 0.028], { rot: [0, a, 0], bevel: 0 })
  }
  k.cyl(k.m('chrome'), 0.004, 0.006, 0.1, [0, 0.05, 0], { seg: 6 })
  k.cyl(wood, 0.012, 0.012, 0.3, [0, 0.72, 0], { seg: 10 })
  k.torus(wood, 0.05, 0.013, [-0.05, 0.87, 0], { arc: Math.PI, seg: 14 })
  k.cyl(k.m('iron'), 0.006, 0.006, 0.05, [-0.05, 0.93, -0.03], { rot: [Math.PI / 2, 0, 0], seg: 6 })
  return k.root
}

// ------------------------------------------------------------------------------ hobbies

/** A carrom board with its coins set out and a striker. 0.9 × 0.05 × 0.9. */
export const carromBoard: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const frame = k.m('woodDark')
  const S = 0.9, inner = 0.74
  for (const s of [-1, 1]) {
    k.slab(frame, [S, 0.045, 0.08], [0, 0, s * (S / 2 - 0.04)], { shadow: true })
    k.slab(frame, [0.08, 0.045, S - 0.16], [s * (S / 2 - 0.04), 0, 0], { shadow: true })
  }
  k.slab(k.m('woodLight', '#e0c48e'), [inner, 0.02, inner], [0, 0.005, 0], { bevel: 0 })
  const vc = k.m('vc')
  const top = 0.0255
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    k.cyl(vc, 0.024, 0.024, 0.002, [sx * (inner / 2 - 0.03), top, sz * (inner / 2 - 0.03)], { vc: '#1a1a1a', seg: 16 })
  }
  for (const s of [-1, 1]) {
    for (const along of [0, 1]) {
      const off = s * (inner / 2 - 0.1)
      const pos: [number, number, number] = along ? [0, top, off] : [off, top, 0]
      const size: [number, number, number] = along ? [0.46, 0.001, 0.003] : [0.003, 0.001, 0.46]
      k.box(vc, size, pos, { vc: '#2a2a2a', bevel: 0 })
      const pos2: [number, number, number] = along ? [0, top, off + s * 0.03] : [off + s * 0.03, top, 0]
      k.box(vc, size, pos2, { vc: '#2a2a2a', bevel: 0 })
    }
  }
  k.torus(vc, 0.085, 0.002, [0, top, 0], { rot: [Math.PI / 2, 0, 0], vc: '#9b2a24', seg: 32 })
  k.torus(vc, 0.02, 0.002, [0, top, 0], { rot: [Math.PI / 2, 0, 0], vc: '#9b2a24', seg: 16 })
  const coin = (x: number, z: number, colour: string, r = 0.0155): void => { k.cyl(vc, r, r, 0.008, [x, top + 0.004, z], { vc: colour, seg: 14 }) }
  coin(0, 0, '#b3202a')
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; coin(Math.sin(a) * 0.032, Math.cos(a) * 0.032, i % 2 ? '#f2ead8' : '#2a2320') }
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + 0.26; coin(Math.sin(a) * 0.063, Math.cos(a) * 0.063, i % 2 ? '#2a2320' : '#f2ead8') }
  coin(0, 0.26, '#e9e4d8', 0.021)
  return k.root
}

/** A chessboard with pieces in their opening positions. 0.42 × 0.1 × 0.42. */
export const chessSet: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const S = 0.4, sq = 0.045
  k.slab(k.m('woodDark'), [S + 0.02, 0.02, S + 0.02], [0, 0, 0])
  const vc = k.m('vc', undefined, { rough: 0.45 })
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    k.box(vc, [sq, 0.002, sq], [(i - 3.5) * sq, 0.021, (j - 3.5) * sq], { vc: (i + j) % 2 ? '#e8d8b4' : '#6b4527', bevel: 0 })
  }
  const pawn: [number, number][] = [[0, 0], [0.014, 0], [0.014, 0.004], [0.008, 0.01], [0.005, 0.022], [0.009, 0.026], [0, 0.034]]
  const big: [number, number][] = [[0, 0], [0.016, 0], [0.016, 0.005], [0.009, 0.012], [0.006, 0.04], [0.011, 0.045], [0.007, 0.052], [0, 0.058]]
  const tall: [number, number][] = [[0, 0], [0.017, 0], [0.017, 0.006], [0.01, 0.014], [0.007, 0.05], [0.012, 0.056], [0.01, 0.066], [0.004, 0.07], [0.004, 0.078], [0, 0.08]]
  for (const [side, colour] of [[-1, 'ceramic'], [1, 'woodDark']] as const) {
    const m = colour === 'ceramic' ? k.m('ceramic', '#f1e9d6') : k.m('woodDark', '#3a2618')
    for (let i = 0; i < 8; i++) {
      k.lathe(m, pawn, [(i - 3.5) * sq, 0.022, side * 2.5 * sq], { seg: 10 })
      const profile = i === 3 || i === 4 ? tall : big
      k.lathe(m, profile, [(i - 3.5) * sq, 0.022, side * 3.5 * sq], { seg: 10 })
    }
  }
  return k.root
}

/** A cricket bat leaning against the wall, with a ball at its foot. 0.3 × 0.86 × 0.26. */
export const cricketBatBall: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const bat = k.group([0.0, 0.0, 0.02], { rot: [-0.2, 0, 0] })
  k.box(k.m('woodLight', '#dcc394'), [0.108, 0.55, 0.04], [0, 0.29, 0], { parent: bat, bevel: 0.012, shadow: true })
  k.cyl(k.m('woodLight', '#c9a871'), 0.016, 0.016, 0.28, [0, 0.7, 0], { parent: bat, seg: 10 })
  k.cyl(k.m('rubber', '#1f3f6a'), 0.019, 0.019, 0.2, [0, 0.74, 0], { parent: bat, seg: 10 })
  k.sphere(k.m('leather', '#9e1f1f'), 0.036, [0.06, 0.036, 0.08], { seg: 14 })
  k.torus(k.m('vc'), 0.036, 0.0015, [0.06, 0.036, 0.08], { rot: [0, 0.6, 0], vc: '#efe6d0', seg: 20 })
  return k.root
}

/** A paper kite and its wooden spool of string, hung on a wall. 0.5 × 0.8 × 0.1. */
export const kiteSpool: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const vc = k.m('vc', undefined, { rough: 0.8 })
  const cy = 0.52, half = 0.2
  const shape = (x: number[], y: number[]): THREE.Shape => {
    const s = new THREE.Shape()
    s.moveTo(x[0], y[0]); for (let i = 1; i < x.length; i++) s.lineTo(x[i], y[i]); s.closePath()
    return s
  }
  k.extrude(vc, shape([0, half, 0], [half * 1.3, 0, -half * 1.2]), 0.002, [0, cy, -0.01], { vc: '#e04a2f' })
  k.extrude(vc, shape([0, -half, 0], [half * 1.3, 0, -half * 1.2]), 0.002, [0, cy, -0.01], { vc: '#f2c230' })
  const stick = k.m('bamboo')
  k.rod(stick, [0, cy + half * 1.3, -0.006], [0, cy - half * 1.2, -0.006], 0.003)
  k.tube(stick, [[-half, cy, -0.006], [0, cy + 0.07, -0.006], [half, cy, -0.006]], 0.0025, { seg: 12 })
  k.extrude(vc, shape([-0.05, 0.05, 0], [0, 0, -0.06]), 0.002, [0, cy - half * 1.2, -0.01], { vc: '#3f6fb0' })
  // The spool hangs lower right.
  const spool = k.group([0.16, 0.22, 0.0])
  const wood = k.m('woodLight')
  for (const s of [-1, 1]) k.cyl(wood, 0.06, 0.06, 0.008, [0, 0, s * 0.035], { rot: [Math.PI / 2, 0, 0], parent: spool, seg: 8 })
  k.cyl(k.m('vc'), 0.045, 0.045, 0.062, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], parent: spool, vc: '#e9e1d0', seg: 16 })
  k.cyl(wood, 0.008, 0.008, 0.2, [0, -0.1, 0], { parent: spool, seg: 6 })
  k.rod(k.m('paper'), [0.16, 0.26, 0.0], [0.0, cy - 0.1, -0.006], 0.0008, { seg: 4 })
  return k.root
}

/** A cane basket with balls of wool and knitting needles. 0.36 × 0.42 × 0.32. */
export const knittingBasket: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const cane = k.m('cane', '#c8a468')
  k.lathe(cane, [[0, 0], [0.13, 0], [0.16, 0.16], [0.165, 0.2], [0.155, 0.2], [0.15, 0.16], [0.122, 0.012], [0, 0.012]], [0, 0, 0], { seg: 24, scale: [1.08, 1, 0.92] })
  k.torus(k.m('bamboo', '#a9824f'), 0.162, 0.01, [0, 0.2, 0], { rot: [Math.PI / 2, 0, 0], seg: 28, scale: [1.08, 0.92, 1] })
  const vc = k.m('vc', undefined, { rough: 1 })
  const balls: [number, number, number, string][] = [[-0.05, 0.19, 0.02, '#b23a48'], [0.06, 0.2, -0.03, '#e2b33c'], [0.02, 0.21, 0.07, '#4a7a9c'], [-0.03, 0.26, -0.03, '#f0ead8']]
  for (const [x, y, z, c] of balls) k.sphere(vc, 0.055, [x, y, z], { vc: c, seg: 12 })
  const needle = k.m('aluminium')
  k.rod(needle, [-0.08, 0.2, 0.0], [0.07, 0.42, -0.04], 0.003)
  k.rod(needle, [-0.02, 0.2, 0.05], [0.1, 0.4, 0.0], 0.003)
  return k.root
}

// ------------------------------------------------------------------------------ community

/** A folded newspaper: columns and a headline bar, with no legible text. 0.32 × 0.02 × 0.22. */
export const newspaperFolded: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const paper = k.m('paper', '#e7e1d2')
  k.box(paper, [0.3, 0.012, 0.21], [0, 0.006, 0], { bevel: 0.002 })
  k.box(paper, [0.3, 0.004, 0.2], [0.005, 0.014, -0.003], { rot: [0, 0.02, 0.01], bevel: 0 })
  const vc = k.m('vc', undefined, { rough: 0.95 })
  const y = 0.0165
  k.box(vc, [0.26, 0.001, 0.022], [0.005, y, -0.075], { vc: '#3a3a3a', bevel: 0 })
  for (let col = 0; col < 4; col++) {
    for (let line = 0; line < 12; line++) {
      const w = line % 5 === 4 ? 0.035 : 0.055
      k.box(vc, [w, 0.001, 0.004], [-0.1 + col * 0.068 + (0.055 - w) / 2 - 0.005, y, -0.045 + line * 0.011], { vc: '#8a8680', bevel: 0 })
    }
  }
  k.box(vc, [0.08, 0.001, 0.06], [0.07, y + 0.0002, -0.02], { vc: '#9d9890', bevel: 0 })
  return k.root
}

// ------------------------------------------------------------------------------ lighting

/**
 * A three-blade ceiling fan on a downrod. The rotor is a separate part ('rotor') that the
 * scene turns slowly. 1.2 × 0.45 × 1.2 (origin at the bottom; it hangs from the top).
 */
export const ceilingFan: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const body = k.m('enamel', str(p, 'colour', '#e8e1d2'))
  k.cyl(body, 0.07, 0.08, 0.05, [0, 0.425, 0], { seg: 18 })
  k.cyl(k.m('steel'), 0.012, 0.012, 0.3, [0, 0.25, 0], { seg: 8 })
  const rotor = pivot(k, 'rotor', [0, 0.02, 0])
  rotor.userData.spin = 0.9
  k.cyl(body, 0.1, 0.11, 0.1, [0, 0.05, 0], { parent: rotor, seg: 20, shadow: true })
  k.cyl(body, 0.05, 0.1, 0.03, [0, -0.005, 0], { parent: rotor, seg: 20 })
  const blade = k.m('enamel', str(p, 'blade', '#d9d1bf'))
  for (let i = 0; i < 3; i++) {
    const g = k.group([0, 0.03, 0], { rot: [0, (i / 3) * TAU, 0], parent: rotor })
    k.box(k.m('steel'), [0.12, 0.012, 0.04], [0.14, 0, 0], { parent: g })
    k.box(blade, [0.42, 0.008, 0.11], [0.39, 0, 0], { parent: g, rot: [0.1, 0, 0], bevel: 0.003 })
  }
  return k.root
}

/** A table lamp: turned brass base and a cloth shade, softly lit. 0.3 × 0.5 × 0.3. */
export const tableLamp: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const brass = k.m('brass')
  k.lathe(brass, [[0, 0], [0.09, 0], [0.09, 0.015], [0.05, 0.03], [0.02, 0.05], [0.035, 0.12], [0.02, 0.2], [0.012, 0.28], [0, 0.28]], [0, 0, 0], { seg: 20 })
  k.sphere(k.m('emissive', '#fff1d0'), 0.035, [0, 0.31, 0], { seg: 10 })
  const shade = k.m('fabric', str(p, 'shade', '#efe0bf'))
  k.lathe(shade, [[0.14, 0.24], [0.15, 0.24], [0.09, 0.45], [0.08, 0.45]], [0, 0, 0], { seg: 24 })
  return k.root
}

/** A hurricane lantern: tank, glass globe, wire guard and bail. 0.19 × 0.34 × 0.17. */
export const hurricaneLantern: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const tin = k.m('tin', str(p, 'colour', '#a9392e'))
  k.lathe(tin, [[0, 0], [0.07, 0], [0.078, 0.01], [0.078, 0.05], [0.06, 0.065], [0, 0.065]], [0, 0, 0], { seg: 20 })
  k.lathe(k.m('glass'), [[0.03, 0.07], [0.05, 0.1], [0.058, 0.14], [0.05, 0.19], [0.03, 0.21]], [0, 0, 0], { seg: 20 })
  k.sphere(k.m('emissive', '#ffd79a'), 0.012, [0, 0.12, 0], { seg: 8 })
  k.lathe(tin, [[0.04, 0.2], [0.065, 0.225], [0.06, 0.24], [0.02, 0.26], [0, 0.265]], [0, 0, 0], { seg: 20 })
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4
    k.rod(tin, [Math.sin(a) * 0.07, 0.06, Math.cos(a) * 0.07], [Math.sin(a) * 0.066, 0.22, Math.cos(a) * 0.066], 0.003)
  }
  k.torus(k.m('steel'), 0.08, 0.0025, [0, 0.26, 0], { arc: Math.PI, seg: 16 })
  return k.root
}

// ------------------------------------------------------------------------------ decor

/** A wall mirror in a carved wooden frame. 0.5 × 0.7 × 0.04. */
export const wallMirror: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m('woodDark')
  const shape = new THREE.Shape()
  shape.absellipse(0, 0, 0.25, 0.35, 0, TAU, false, 0)
  const hole = new THREE.Path()
  hole.absellipse(0, 0, 0.2, 0.3, 0, TAU, true, 0)
  shape.holes.push(hole)
  k.extrude(wood, shape, 0.03, [0, 0.35, 0.0], { bevel: 0.006, shadow: true })
  const glass = new THREE.Shape()
  glass.absellipse(0, 0, 0.205, 0.305, 0, TAU, false, 0)
  k.extrude(k.m('mirror'), glass, 0.004, [0, 0.35, -0.004])
  return k.root
}

/** A ceramic vase with a few flowers. 0.22 × 0.46 × 0.22. */
export const vaseFlowers: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  k.lathe(k.m('ceramic', str(p, 'colour', '#5f8b8f')), [[0, 0], [0.05, 0], [0.07, 0.06], [0.065, 0.14], [0.04, 0.2], [0.042, 0.23], [0.05, 0.24], [0.045, 0.24], [0.035, 0.22], [0, 0.22]], [0, 0, 0], { seg: 20 })
  const stem = k.m('leafDark')
  const vc = k.m('vc')
  const flowers: [number, number, number, string][] = [[0.0, 0.44, 0.0, '#f2c230'], [0.07, 0.4, 0.03, '#e0609a'], [-0.06, 0.41, -0.02, '#e8871e'], [0.02, 0.38, -0.07, '#f4f0e6'], [-0.03, 0.37, 0.07, '#c8323a']]
  for (const [x, y, z, c] of flowers) {
    k.rod(stem, [0, 0.2, 0], [x, y, z], 0.003, { seg: 5 })
    k.sphere(vc, 0.03, [x, y, z], { vc: c, seg: 10, scale: [1, 0.6, 1] })
    k.sphere(vc, 0.01, [x, y + 0.016, z], { vc: '#6b4a1f', seg: 6 })
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4
    k.sphere(k.m('leaf'), 1, [Math.sin(a) * 0.04, 0.28, Math.cos(a) * 0.04], { scale: [0.018, 0.06, 0.006], rot: [0.5, a, 0], seg: 6 })
  }
  return k.root
}

/**
 * A jaapi hung on a wall: a broad conical hat of woven bamboo and palm leaf, with coloured
 * cloth bands and a brass finial. The cone's axis points out of the wall (+z).
 * 0.62 × 0.62 × 0.16 (origin at the bottom of its disc).
 */
export const jaapi: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const R = 0.31, H = 0.14, cy = R + 0.01
  const cone = k.group([0, cy, -0.085], { rot: [Math.PI / 2, 0, 0] })
  // Cylinder axis is +y; rotated so +y points to +z (out of the wall).
  k.cyl(k.m('cane', '#cfa865'), 0.012, R, H, [0, H / 2, 0], { parent: cone, open: true, seg: 40 })
  k.cyl(k.m('woodLight', '#8a6a3c'), R * 0.02, R, 0.006, [0, 0.003, 0], { parent: cone, seg: 40 })
  const vc = k.m('vc', undefined, { rough: 0.85 })
  // Bands of coloured cloth work, sitting just proud of the weave.
  const band = (r0: number, r1: number, colour: string, thetaStart = 0, thetaLength = TAU): void => {
    const y0 = H * (1 - r0 / R), y1 = H * (1 - r1 / R)
    k.cyl(vc, r1 * 1.02 + 0.002, r0 * 1.02 + 0.002, y1 - y0, [0, (y0 + y1) / 2, 0], { parent: cone, open: true, seg: 40, vc: colour, thetaStart, thetaLength })
  }
  band(R * 0.96, R * 0.88, '#b3202a')
  band(R * 0.62, R * 0.56, '#1f1f1f')
  for (let i = 0; i < 8; i++) band(R * 0.86, R * 0.66, i % 2 ? '#2f6b3a' : '#b3202a', (i / 8) * TAU + 0.1, TAU / 8 - 0.2)
  band(R * 0.4, R * 0.34, '#b3202a')
  k.cyl(k.m('brass'), 0.0, 0.02, 0.05, [0, H + 0.02, 0], { parent: cone, seg: 12 })
  k.torus(k.m('bamboo', '#9c7440'), R, 0.009, [0, 0.004, 0], { parent: cone, rot: [Math.PI / 2, 0, 0], seg: 40 })
  return k.root
}
