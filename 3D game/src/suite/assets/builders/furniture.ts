/** Furniture: seating, tables, shelves. Seat heights ~0.45 m, table tops 0.75 m. */
import { Kit, type Builder } from '../kit'
import { legs, mat, str } from './common'

/** A three-seater with a wooden frame, fabric seat and back cushions. 1.9 × 0.85 × 0.8. */
export const sofaWood: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  const cloth = k.m('fabric', str(p, 'fabric', '#8e5a3c'))
  const W = 1.9, D = 0.8
  legs(k, wood, W - 0.04, D - 0.04, 0.2, 0.06, 0.01)
  k.slab(wood, [W, 0.12, D - 0.02], [0, 0.18, 0], { shadow: true })
  for (const s of [-1, 1]) {
    k.slab(wood, [0.1, 0.34, D - 0.04], [s * (W / 2 - 0.05), 0.3, 0], { shadow: true })
    k.slab(wood, [0.13, 0.035, D], [s * (W / 2 - 0.065), 0.62, 0.005], { shadow: true })
  }
  k.slab(wood, [W - 0.2, 0.55, 0.07], [0, 0.3, -D / 2 + 0.035], { shadow: true })
  k.box(wood, [W - 0.16, 0.05, 0.09], [0, 0.85 - 0.025, -D / 2 + 0.045])
  const seatW = (W - 0.22) / 3
  for (let i = -1; i <= 1; i++) {
    k.box(cloth, [seatW - 0.012, 0.15, D - 0.2], [i * seatW, 0.3 + 0.075, 0.07], { bevel: 'soft', shadow: true })
    k.box(cloth, [seatW - 0.02, 0.36, 0.13], [i * seatW, 0.62, -D / 2 + 0.13], { bevel: 'soft', rot: [-0.14, 0, 0], shadow: true })
  }
  return k.root
}

/** A wooden armchair with woven cane seat and back. 0.72 × 0.86 × 0.76. */
export const armchairCane: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'woodDark'))
  const cane = k.m('cane')
  const W = 0.72, D = 0.72
  for (const sx of [-1, 1]) {
    k.box(wood, [0.045, 0.62, 0.045], [sx * (W / 2 - 0.05), 0.31, D / 2 - 0.06], { shadow: true })
    // Back legs rise into the back posts, raked back a little.
    k.rod(wood, [sx * (W / 2 - 0.05), 0, -D / 2 + 0.06], [sx * (W / 2 - 0.05), 0.86, -D / 2 - 0.0], 0.024, { shadow: true })
    k.box(wood, [0.07, 0.03, D + 0.04], [sx * (W / 2 - 0.035), 0.635, 0.0], { shadow: true })
  }
  // Seat frame and woven panel.
  k.box(wood, [W - 0.06, 0.05, 0.05], [0, 0.4, D / 2 - 0.06])
  k.box(wood, [W - 0.06, 0.05, 0.05], [0, 0.4, -D / 2 + 0.07])
  k.box(wood, [0.05, 0.05, D - 0.1], [-(W / 2 - 0.05), 0.4, 0])
  k.box(wood, [0.05, 0.05, D - 0.1], [W / 2 - 0.05, 0.4, 0])
  k.box(cane, [W - 0.14, 0.012, D - 0.16], [0, 0.42, 0.0], { bevel: 0 })
  k.box(cane, [W - 0.14, 0.4, 0.012], [0, 0.66, -D / 2 + 0.03], { rot: [-0.1, 0, 0], bevel: 0 })
  k.box(wood, [W - 0.1, 0.05, 0.04], [0, 0.86, -D / 2 + 0.005], { rot: [-0.1, 0, 0] })
  k.box(wood, [W - 0.1, 0.03, 0.03], [0, 0.12, 0])
  return k.root
}

/** A plain dining chair with slatted back. 0.46 × 0.9 × 0.5. */
export const chairWood: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  const s = 0.46, d = 0.46
  k.slab(wood, [s, 0.035, d], [0, 0.43, 0.02], { shadow: true })
  for (const sx of [-1, 1]) {
    k.box(wood, [0.04, 0.43, 0.04], [sx * (s / 2 - 0.03), 0.215, d / 2 - 0.01], { shadow: true })
    k.box(wood, [0.04, 0.9, 0.04], [sx * (s / 2 - 0.03), 0.45, -d / 2 + 0.03], { shadow: true })
  }
  k.box(wood, [s - 0.02, 0.08, 0.03], [0, 0.85, -d / 2 + 0.03])
  for (const x of [-0.1, 0, 0.1]) k.box(wood, [0.04, 0.3, 0.02], [x, 0.63, -d / 2 + 0.03])
  k.box(wood, [s - 0.08, 0.025, 0.025], [0, 0.14, d / 2 - 0.01])
  k.box(wood, [s - 0.08, 0.025, 0.025], [0, 0.14, -d / 2 + 0.03])
  return k.root
}

/** A moulded plastic chair with arms. 0.56 × 0.8 × 0.56. */
export const chairPlastic: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const pl = k.m('plastic', str(p, 'colour', '#efeae0'))
  k.box(pl, [0.46, 0.035, 0.44], [0, 0.43, 0.02], { bevel: 0.015, shadow: true })
  k.box(pl, [0.46, 0.38, 0.03], [0, 0.63, -0.2], { rot: [-0.18, 0, 0], bevel: 0.012, shadow: true })
  // Back slots, a moulded-chair detail visible from a distance.
  const vc = k.m('vc')
  for (const x of [-0.12, -0.04, 0.04, 0.12]) k.box(vc, [0.022, 0.16, 0.034], [x, 0.66, -0.203], { rot: [-0.18, 0, 0], vc: '#6d6a64', bevel: 0 })
  for (const sx of [-1, 1]) {
    k.box(pl, [0.05, 0.035, 0.44], [sx * 0.255, 0.63, -0.0], { bevel: 0.012 })
    k.box(pl, [0.045, 0.2, 0.045], [sx * 0.255, 0.53, 0.19])
    for (const sz of [-1, 1]) {
      k.rod(pl, [sx * 0.2, 0.42, sz * 0.18], [sx * 0.25, 0, sz * 0.24], 0.022, { shadow: true })
    }
  }
  return k.root
}

/** A low wooden stool (a floor seat). 0.36 × 0.22 × 0.36. */
export const stoolLow: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  k.slab(wood, [0.36, 0.04, 0.36], [0, 0.18, 0], { shadow: true })
  legs(k, wood, 0.34, 0.34, 0.18, 0.05, 0.0)
  k.box(wood, [0.28, 0.04, 0.02], [0, 0.15, 0.15])
  k.box(wood, [0.28, 0.04, 0.02], [0, 0.15, -0.15])
  return k.root
}

function table(k: Kit, woodName: 'wood' | 'woodDark' | 'woodLight', W: number, H: number, D: number, legT: number, shelf = 0): void {
  const wood = k.m(woodName)
  k.slab(wood, [W, 0.035, D], [0, H - 0.035, 0], { shadow: true })
  legs(k, wood, W - 0.04, D - 0.04, H - 0.035, legT, 0.02)
  const apron = 0.07
  k.box(wood, [W - 0.12, apron, 0.02], [0, H - 0.035 - apron / 2, D / 2 - 0.05])
  k.box(wood, [W - 0.12, apron, 0.02], [0, H - 0.035 - apron / 2, -D / 2 + 0.05])
  k.box(wood, [0.02, apron, D - 0.12], [W / 2 - 0.05, H - 0.035 - apron / 2, 0])
  k.box(wood, [0.02, apron, D - 0.12], [-W / 2 + 0.05, H - 0.035 - apron / 2, 0])
  if (shelf > 0) k.slab(wood, [W - 0.1, 0.02, D - 0.1], [0, shelf, 0])
}

export const diningTable: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  table(k, mat(p, 'wood', 'wood') as 'wood', 1.4, 0.75, 0.85, 0.06)
  return k.root
}

export const coffeeTable: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  table(k, mat(p, 'wood', 'woodDark') as 'woodDark', 1.0, 0.42, 0.55, 0.045, 0.1)
  return k.root
}

export const sideTable: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  table(k, mat(p, 'wood', 'wood') as 'wood', 0.45, 0.6, 0.45, 0.04, 0.12)
  k.box(k.m('woodLight'), [0.3, 0.06, 0.012], [0, 0.52, 0.2])
  k.sphere(k.m('brass'), 0.012, [0, 0.52, 0.212], { seg: 8 })
  return k.root
}

/** An open bookshelf with rows of books. 0.9 × 1.8 × 0.32. */
export const bookshelf: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  const W = 0.9, H = 1.8, D = 0.32, t = 0.025
  for (const s of [-1, 1]) k.slab(wood, [t, H, D], [s * (W / 2 - t / 2), 0, 0], { shadow: true })
  k.slab(wood, [W, t, D + 0.01], [0, H - t, 0.005], { shadow: true })
  k.slab(wood, [W - t * 2, 0.07, D - 0.02], [0, 0, 0.0])
  k.slab(k.m('woodDark'), [W - t * 2, H - 0.08, 0.012], [0, 0.06, -D / 2 + 0.006], { bevel: 0 })
  const shelves = [0.07, 0.44, 0.8, 1.16, 1.5]
  for (const y of shelves.slice(1)) k.slab(wood, [W - t * 2, 0.022, D - 0.02], [0, y, 0.0])
  const books = k.m('vc')
  const colours = ['#7b2e2a', '#2f4f6f', '#3e5f3a', '#b28a3c', '#5a3a5f', '#8c5a2b', '#c9b99a', '#2e2e3a', '#9a4b3b', '#4d6b7a']
  let seed = 7
  const rand = (): number => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  shelves.slice(0, 4).forEach((y0, row) => {
    const base = y0 + (row === 0 ? 0.07 : 0.022)
    let x = -W / 2 + t + 0.02
    const end = W / 2 - t - (row === 2 ? 0.28 : 0.03)
    while (x < end) {
      const bw = 0.022 + rand() * 0.025, bh = 0.2 + rand() * 0.1, bd = 0.17 + rand() * 0.06
      if (x + bw > end) break
      const lean = rand() < 0.08 ? 0.12 : 0
      k.box(books, [bw, bh, bd], [x + bw / 2, base + bh / 2, D / 2 - 0.02 - bd / 2 - 0.02], { vc: colours[Math.floor(rand() * colours.length)], rot: [0, 0, lean], bevel: 0 })
      x += bw + 0.002
    }
    if (row === 2) {
      // A little brass pot where the row ends.
      k.lathe(k.m('brass'), [[0, 0], [0.05, 0], [0.065, 0.05], [0.04, 0.1], [0.045, 0.11]], [W / 2 - 0.14, base, 0.0], { seg: 16 })
    }
  })
  return k.root
}

/** A wall shelf on two brackets, with a few small things on it. 0.9 × 0.26 × 0.22. */
export const wallShelf: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  k.slab(wood, [0.9, 0.03, 0.22], [0, 0.08, 0])
  for (const s of [-1, 1]) {
    k.slab(wood, [0.025, 0.08, 0.02], [s * 0.3, 0, -0.1])
    k.box(wood, [0.025, 0.02, 0.15], [s * 0.3, 0.05, -0.04], { rot: [-0.55, 0, 0] })
  }
  k.lathe(k.m('brass'), [[0, 0], [0.04, 0], [0.06, 0.03], [0.055, 0.06], [0.05, 0.06]], [-0.3, 0.11, 0.0], { seg: 16 })
  k.lathe(k.m('clay'), [[0, 0], [0.035, 0], [0.05, 0.05], [0.03, 0.1], [0.035, 0.12]], [0.3, 0.11, 0.0], { seg: 16 })
  const vc = k.m('vc')
  k.box(vc, [0.03, 0.14, 0.14], [0.02, 0.18, 0.0], { vc: '#2f4f6f', bevel: 0 })
  k.box(vc, [0.028, 0.13, 0.13], [0.052, 0.175, 0.0], { vc: '#7b2e2a', bevel: 0 })
  k.box(vc, [0.03, 0.12, 0.13], [0.085, 0.17, 0.0], { vc: '#b28a3c', rot: [0, 0, -0.18], bevel: 0 })
  return k.root
}

/** A plank bench for a veranda. 1.6 × 0.45 × 0.4. */
export const benchVeranda: Builder = (p, ctx) => {
  const k = new Kit(ctx)
  const wood = k.m(mat(p, 'wood', 'wood'))
  k.slab(wood, [1.6, 0.05, 0.4], [0, 0.4, 0], { shadow: true })
  for (const s of [-1, 1]) {
    k.slab(wood, [0.05, 0.4, 0.34], [s * 0.64, 0, 0], { shadow: true })
  }
  k.box(wood, [1.28, 0.06, 0.03], [0, 0.18, 0])
  return k.root
}
