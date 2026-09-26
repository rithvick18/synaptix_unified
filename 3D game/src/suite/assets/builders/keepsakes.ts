/** Photos and keepsakes: frames, album, letters, calendar, clocks. */
import { Kit, type Builder } from '../kit'
import { frameBars, mat, num, pivot, runtimeText, str, TAU } from './common'

/**
 * A picture frame hung on a wall. The picture area (the manifest's photoSurface) is the
 * opening inside the moulding: w − 2·border by h − 2·border, centred at [0, h/2, 0].
 */
export const frameWall: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const w = num(p, 'w', 0.62), h = num(p, 'h', 0.48), d = num(p, 'd', 0.03), b = num(p, 'border', 0.05)
  const moulding = k.m(mat(p, 'mat', 'woodDark'), p.colour as string | undefined)
  frameBars(k, moulding, w, h, b, d, [0, h / 2, 0])
  // A thin gilt fillet inside the moulding catches the light and frames the picture.
  if (p.fillet !== false) frameBars(k, k.m('brass'), w - b * 2 + 0.012, h - b * 2 + 0.012, 0.008, d * 0.6, [0, h / 2, 0.002])
  k.box(k.m('woodLight'), [w - b * 2 + 0.01, h - b * 2 + 0.01, 0.005], [0, h / 2, -d / 2 + 0.003], { bevel: 0 })
  return k.root
}

/** A standing photo frame with a strut. Picture area centred at [0, 0.135, 0.035]. */
export const frameTable: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const w = 0.2, h = 0.25, b = 0.025, d = 0.016, z = 0.034
  const moulding = k.m(mat(p, 'mat', 'wood'), p.colour as string | undefined)
  frameBars(k, moulding, w, h, b, d, [0, h / 2 + 0.01, z])
  k.box(k.m('woodLight'), [w - b * 2 + 0.01, h - b * 2 + 0.01, 0.004], [0, h / 2 + 0.01, z - 0.006], { bevel: 0 })
  // Strut behind, and a low foot so it plainly stands on its own.
  k.rod(moulding, [0, h * 0.72, z - 0.01], [0, 0.002, -0.048], 0.008)
  k.box(moulding, [w * 0.9, 0.01, 0.03], [0, 0.005, z - 0.004])
  return k.root
}

/** An open album lying flat. The right-hand page carries the photo surface (+y). */
export const photoAlbum: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const cover = k.m('fabric', str(p, 'cover', '#7a2f2a'))
  const page = k.m('paper', '#e9e0cc')
  for (const s of [-1, 1]) {
    k.box(cover, [0.28, 0.012, 0.3], [s * 0.142, 0.006, 0])
    k.box(page, [0.262, 0.018, 0.282], [s * 0.136, 0.021, 0], { bevel: 0.004 })
  }
  k.cyl(cover, 0.016, 0.016, 0.3, [0, 0.012, 0], { rot: [Math.PI / 2, 0, 0], seg: 10 })
  // The left page: two empty mounts with photo corners, clearly not pictures.
  const vc = k.m('vc')
  for (const [x, z] of [[-0.14, -0.06], [-0.14, 0.075]] as const) {
    k.box(vc, [0.17, 0.002, 0.1], [x, 0.0312, z], { vc: '#d9cfb8', bevel: 0 })
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) {
      k.box(vc, [0.014, 0.003, 0.014], [x + cx * 0.08, 0.0322, z + cz * 0.045], { vc: '#3a3230', bevel: 0 })
    }
  }
  return k.root
}

/** A small bundle of envelopes tied with string. */
export const lettersBundle: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const vc = k.m('vc', undefined, { rough: 0.9 })
  const tones = ['#efe6cf', '#e3d9c0', '#f2ecdc', '#dcd2bb', '#e9dfc4']
  tones.forEach((tone, i) => {
    k.box(vc, [0.2, 0.009, 0.12], [((i * 37) % 7 - 3) * 0.002, 0.005 + i * 0.0095, ((i * 53) % 5 - 2) * 0.002], { vc: tone, rot: [0, ((i * 29) % 5 - 2) * 0.03, 0], bevel: 0.002 })
  })
  // A pale blue airmail envelope on top, with a stamp.
  k.box(vc, [0.19, 0.006, 0.11], [0.004, 0.051, 0], { vc: str(p, 'top', '#bcd0e0'), rot: [0, 0.05, 0], bevel: 0.002 })
  k.box(vc, [0.022, 0.002, 0.026], [0.07, 0.055, -0.03], { vc: '#b7412e', bevel: 0 })
  const twine = k.m('jute', '#a47c4c')
  k.box(twine, [0.006, 0.064, 0.126], [0.02, 0.03, 0], { bevel: 0 })
  k.box(twine, [0.206, 0.064, 0.006], [0.0, 0.03, 0.012], { bevel: 0 })
  k.torus(twine, 0.012, 0.0025, [0.02, 0.06, 0.012], { rot: [Math.PI / 2, 0, 0], seg: 10 })
  return k.root
}

/**
 * A hanging calendar. The month and day grid are drawn at runtime in the active language
 * (runtimeText 'calendar'); the prototype shows plain paper.
 */
export const calendarWall: Builder = (_p, ctx) => {
  const k = new Kit(ctx)
  const w = 0.34, h = 0.48
  k.box(k.m('paper'), [w, h, 0.004], [0, h / 2, 0], { bevel: 0 })
  k.box(k.m('fabric', '#9c2f28'), [w + 0.01, 0.025, 0.01], [0, h - 0.004, 0.002])
  const face = k.plane(k.m('paper'), w - 0.004, h - 0.03, [0, (h - 0.03) / 2, 0.0026])
  runtimeText(face, 'calendar', [256, 344])
  // Nail and cord.
  const iron = k.m('iron')
  k.rod(iron, [-0.06, h, 0.004], [0, h + 0.06, 0.004], 0.0015)
  k.rod(iron, [0.06, h, 0.004], [0, h + 0.06, 0.004], 0.0015)
  k.cyl(iron, 0.004, 0.004, 0.02, [0, h + 0.062, 0.006], { rot: [Math.PI / 2, 0, 0], seg: 6 })
  return k.root
}

function clockHands(k: Kit, centre: [number, number, number], len: number): void {
  const black = k.m('black')
  const hour = pivot(k, 'hand-hour', centre)
  k.box(black, [len * 0.1, len * 0.62, 0.003], [0, len * 0.26, 0.002], { parent: hour, bevel: 0 })
  const minute = pivot(k, 'hand-minute', centre)
  k.box(black, [len * 0.07, len * 0.95, 0.003], [0, len * 0.4, 0.006], { parent: minute, bevel: 0 })
  k.cyl(k.m('brass'), len * 0.08, len * 0.08, 0.012, [centre[0], centre[1], centre[2] + 0.006], { rot: [Math.PI / 2, 0, 0], seg: 10 })
}

/** A round wall clock with hour markers and moving hands. */
export const clockWall: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const R = 0.17, cy = R + 0.012
  const rim = k.m(mat(p, 'rim', 'woodDark'))
  k.torus(rim, R, 0.014, [0, cy, 0.012], { seg: 36, tube: 8 })
  k.cyl(rim, R, R, 0.03, [0, cy, -0.012], { rot: [Math.PI / 2, 0, 0], seg: 36 })
  k.cyl(k.m('enamel', '#f5efe0'), R - 0.004, R - 0.004, 0.004, [0, cy, 0.006], { rot: [Math.PI / 2, 0, 0], seg: 36 })
  const vc = k.m('vc')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    const big = i % 3 === 0
    k.box(vc, [big ? 0.012 : 0.007, big ? 0.03 : 0.018, 0.002], [Math.sin(a) * 0.135, cy + Math.cos(a) * 0.135, 0.009], { rot: [0, 0, -a], vc: '#2a2622', bevel: 0 })
  }
  clockHands(k, [0, cy, 0.01], 0.13)
  return k.root
}

/** A twin-bell alarm clock with moving hands. */
export const clockTable: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const body = k.m('plastic', str(p, 'colour', '#b43c2e'))
  const cy = 0.095, R = 0.062
  k.cyl(body, R, R, 0.05, [0, cy, 0], { rot: [Math.PI / 2, 0, 0], seg: 28 })
  k.torus(k.m('chrome'), R, 0.006, [0, cy, 0.025], { seg: 28 })
  k.cyl(k.m('enamel', '#f7f1e2'), R - 0.004, R - 0.004, 0.003, [0, cy, 0.024], { rot: [Math.PI / 2, 0, 0], seg: 28 })
  const vc = k.m('vc')
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU
    k.box(vc, [0.005, 0.01, 0.002], [Math.sin(a) * 0.048, cy + Math.cos(a) * 0.048, 0.027], { rot: [0, 0, -a], vc: '#262220', bevel: 0 })
  }
  clockHands(k, [0, cy, 0.027], 0.046)
  const chrome = k.m('chrome')
  for (const s of [-1, 1]) {
    k.sphere(chrome, 0.03, [s * 0.04, cy + 0.058, 0], { thetaLength: Math.PI / 2, rot: [0, 0, -s * 0.5], seg: 14 })
    k.rod(chrome, [s * 0.035, 0.04, 0.012], [s * 0.05, 0.0, 0.02], 0.004)
  }
  k.rod(chrome, [0, cy + R, 0], [0, cy + R + 0.03, 0], 0.003)
  k.torus(chrome, 0.03, 0.003, [0, cy + R + 0.03, 0], { arc: Math.PI, seg: 12 })
  return k.root
}
