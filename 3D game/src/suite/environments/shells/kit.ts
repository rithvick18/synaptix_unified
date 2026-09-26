/**
 * Building blocks for the shells: walls with real openings, windows, doors, skirting,
 * floors, ceilings and lights. All static geometry is collected per material and merged in
 * `finish()`, so a whole room costs a handful of draw calls.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { projectUV } from '../../assets/kit'
import type { MatName } from '../../assets/materials'
import type { ShellBuildContext } from './types'

export type V3 = [number, number, number]

export interface Opening {
  from: number
  to: number
  bottom: number
  top: number
  kind: 'window' | 'door' | 'gate' | 'open'
}

export interface WallRun {
  /** 'x': the wall runs along x at z = at. 'z': along z at x = at. */
  axis: 'x' | 'z'
  at: number
  from: number
  to: number
  height: number
  thickness: number
  /** Which way is outside: +1 or −1 along the wall's normal axis. */
  outward: 1 | -1
  openings?: Opening[]
  /** Paint colour override for this wall (outer compound walls, for example). */
  material?: THREE.Material
  skirting?: boolean
  blocks?: boolean
}

const LIGHT_COLOUR = { warm: 0xffe1b8, neutral: 0xfff2e2, cool: 0xe9f0ff }

export class ShellKit {
  readonly group = new THREE.Group()
  readonly blockers: THREE.Box3[] = []
  readonly lights: THREE.Light[] = []
  private parts = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; cast: boolean }>()

  constructor(readonly ctx: ShellBuildContext) {}

  m(name: MatName, colour?: string): THREE.Material {
    return this.ctx.mats.get(name, colour)
  }

  get wall(): THREE.Material { return this.m('wall', this.ctx.materials.wall) }
  get trim(): THREE.Material { return this.m('trim', this.ctx.materials.trim) }
  get ceiling(): THREE.Material { return this.m('ceiling') }

  floorMaterial(): THREE.Material {
    const finish = this.ctx.materials.floor
    const name: MatName = ({
      wood: 'floorWood', tile: 'floorTile', stone: 'floorStone', terrazzo: 'floorTerrazzo',
      'red-oxide': 'floorRedOxide', 'mud-plaster': 'floorMud', cement: 'floorCement'
    } as const)[finish]
    return this.m(name, this.ctx.materials.floorColour)
  }

  /** Adds already world-placed geometry to the merge. */
  add(material: THREE.Material, geo: THREE.BufferGeometry, cast = false): void {
    const entry = this.parts.get(material) ?? { geos: [], cast: false }
    entry.geos.push(geo)
    entry.cast ||= cast
    this.parts.set(material, entry)
  }

  box(material: THREE.Material, min: V3, max: V3, o: { block?: boolean; cast?: boolean; bevel?: number } = {}): void {
    const sx = max[0] - min[0], sy = max[1] - min[1], sz = max[2] - min[2]
    if (sx < 1e-4 || sy < 1e-4 || sz < 1e-4) return
    const least = Math.min(sx, sy, sz)
    const geo = o.bevel && least > 0.02
      ? new RoundedBoxGeometry(sx, sy, sz, 1, Math.min(o.bevel, least * 0.3))
      : new THREE.BoxGeometry(sx, sy, sz)
    geo.translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2)
    this.add(material, geo, o.cast)
    if (o.block) this.blockers.push(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)))
  }

  /** A box given in wall coordinates: `u` along the run, `n` into the wall from its face. */
  private runBox(run: WallRun, material: THREE.Material, u0: number, u1: number, y0: number, y1: number, n0: number, n1: number, o: { cast?: boolean; bevel?: number } = {}): void {
    const a = run.at + run.outward * n0, b = run.at + run.outward * n1
    const lo = Math.min(a, b), hi = Math.max(a, b)
    if (run.axis === 'x') this.box(material, [u0, y0, lo], [u1, y1, hi], o)
    else this.box(material, [lo, y0, u0], [hi, y1, u1], o)
  }

  wallRun(run: WallRun): void {
    const material = run.material ?? this.wall
    const openings = [...(run.openings ?? [])].sort((p, q) => p.from - q.from)
    let cursor = run.from
    for (const op of openings) {
      this.runBox(run, material, cursor, op.from, 0, run.height, 0, run.thickness)
      if (op.bottom > 0) this.runBox(run, material, op.from, op.to, 0, op.bottom, 0, run.thickness)
      this.runBox(run, material, op.from, op.to, op.top, run.height, 0, run.thickness)
      cursor = op.to
      if (op.kind === 'window') this.window(run, op)
      else if (op.kind === 'door') this.door(run, op)
      else if (op.kind === 'gate') this.gate(run, op)
    }
    this.runBox(run, material, cursor, run.to, 0, run.height, 0, run.thickness)
    if (run.blocks !== false) {
      const a = run.at, b = run.at + run.outward * run.thickness
      const lo = Math.min(a, b), hi = Math.max(a, b)
      this.blockers.push(run.axis === 'x'
        ? new THREE.Box3(new THREE.Vector3(run.from, 0, lo), new THREE.Vector3(run.to, run.height, hi))
        : new THREE.Box3(new THREE.Vector3(lo, 0, run.from), new THREE.Vector3(hi, run.height, run.to)))
    }
    if (run.skirting !== false) {
      let c = run.from
      const doors = openings.filter((o) => o.bottom <= 0.01)
      for (const d of doors) { this.runBox(run, this.trim, c, d.from, 0, 0.1, -0.014, 0); c = d.to }
      this.runBox(run, this.trim, c, run.to, 0, 0.1, -0.014, 0)
    }
  }

  private window(run: WallRun, op: Opening): void {
    const t = run.thickness
    const w = op.to - op.from, h = op.top - op.bottom
    const mid = t * 0.55
    // Outside: sky above a band of distant foliage, unlit so the window reads as daylight.
    const sky = this.m('sky', '#e3edf2'), trees = this.m('sky', '#a9c393')
    this.runBox(run, sky, op.from, op.to, op.bottom + h * 0.38, op.top, t - 0.01, t)
    this.runBox(run, trees, op.from, op.to, op.bottom, op.bottom + h * 0.38, t - 0.01, t)
    const frame = this.m('trim', this.ctx.materials.trim)
    const f = 0.06
    // Frame on the inner face.
    this.runBox(run, frame, op.from - f, op.to + f, op.top, op.top + f, -0.025, 0.02, { bevel: 0.008 })
    this.runBox(run, frame, op.from - f, op.from, op.bottom, op.top, -0.025, 0.02, { bevel: 0.008 })
    this.runBox(run, frame, op.to, op.to + f, op.bottom, op.top, -0.025, 0.02, { bevel: 0.008 })
    this.runBox(run, frame, op.from - f - 0.03, op.to + f + 0.03, op.bottom - 0.04, op.bottom, -0.07, t * 0.5, { bevel: 0.008 })
    // Shutters' frame, glazing bars and the iron grill in the opening.
    this.runBox(run, frame, op.from, op.to, op.bottom + h / 2 - 0.02, op.bottom + h / 2 + 0.02, mid - 0.02, mid + 0.02)
    this.runBox(run, frame, (op.from + op.to) / 2 - 0.025, (op.from + op.to) / 2 + 0.025, op.bottom, op.top, mid - 0.02, mid + 0.02)
    const iron = this.m('iron', '#3b3b3e')
    const bars = Math.max(3, Math.round(w / 0.14))
    for (let i = 1; i < bars; i++) {
      const u = op.from + (i / bars) * w
      this.runBox(run, iron, u - 0.008, u + 0.008, op.bottom, op.top, mid - 0.06, mid - 0.044)
    }
    // Curtains either side on a brass rod.
    const cloth = this.m('fabric', this.ctx.materials.accent)
    const rodY = op.top + 0.14
    this.runBox(run, this.m('brass'), op.from - 0.3, op.to + 0.3, rodY - 0.012, rodY + 0.012, -0.07, -0.05)
    for (const [u0, u1] of [[op.from - 0.28, op.from + 0.08], [op.to - 0.08, op.to + 0.28]]) {
      const folds = 4
      for (let i = 0; i < folds; i++) {
        const a = u0 + (i / folds) * (u1 - u0), b = u0 + ((i + 1) / folds) * (u1 - u0)
        const depth = i % 2 ? -0.1 : -0.075
        this.runBox(run, cloth, a, b, op.bottom - 0.12, rodY, depth, depth + 0.02)
      }
    }
  }

  private door(run: WallRun, op: Opening): void {
    const t = run.thickness
    const dark = this.m('woodDark')
    const frame = this.m('trim', this.ctx.materials.trim)
    const f = 0.07
    this.runBox(run, frame, op.from - f, op.from, 0, op.top + f, -0.02, t + 0.02, { bevel: 0.008 })
    this.runBox(run, frame, op.to, op.to + f, 0, op.top + f, -0.02, t + 0.02, { bevel: 0.008 })
    this.runBox(run, frame, op.from - f, op.to + f, op.top, op.top + f, -0.02, t + 0.02, { bevel: 0.008 })
    // Two closed leaves with raised panels.
    const mid = (op.from + op.to) / 2
    for (const [u0, u1] of [[op.from, mid], [mid, op.to]]) {
      this.runBox(run, dark, u0 + 0.004, u1 - 0.004, 0.005, op.top - 0.005, t * 0.3, t * 0.3 + 0.045, { bevel: 0.006 })
      const pw = u1 - u0 - 0.16
      for (const [y0, y1] of [[0.14, op.top * 0.45], [op.top * 0.45 + 0.1, op.top - 0.14]]) {
        this.runBox(run, dark, u0 + 0.08, u0 + 0.08 + pw, y0, y1, t * 0.3 - 0.012, t * 0.3, { bevel: 0.004 })
      }
    }
    const brass = this.m('brass')
    this.runBox(run, brass, mid - 0.06, mid - 0.03, 1.0, 1.12, t * 0.3 - 0.04, t * 0.3)
    this.runBox(run, brass, mid + 0.03, mid + 0.06, 1.0, 1.12, t * 0.3 - 0.04, t * 0.3)
  }

  private gate(run: WallRun, op: Opening): void {
    const t = run.thickness
    const iron = this.m('iron', '#2f3a3a')
    const w = op.to - op.from
    for (const y of [0.1, op.top / 2, op.top - 0.05]) this.runBox(run, iron, op.from, op.to, y - 0.025, y + 0.025, t * 0.4, t * 0.6)
    const bars = Math.round(w / 0.1)
    for (let i = 0; i <= bars; i++) {
      const u = op.from + (i / bars) * w
      this.runBox(run, iron, u - 0.012, u + 0.012, 0.02, op.top, t * 0.44, t * 0.56)
    }
    // A glimpse of the lane beyond.
    this.runBox(run, this.m('sky', '#d9e4e6'), op.from, op.to, 0.8, op.top + 0.6, t + 0.6, t + 0.62)
    this.runBox(run, this.m('sky', '#a9c393'), op.from, op.to, 0, 0.8, t + 0.6, t + 0.62)
  }

  floor(x0: number, z0: number, x1: number, z1: number, material = this.floorMaterial()): void {
    this.box(material, [x0, -0.06, z0], [x1, 0, z1])
  }

  ceilingSlab(x0: number, z0: number, x1: number, z1: number, height: number): void {
    this.box(this.ceiling, [x0, height, z0], [x1, height + 0.1, z1])
  }

  /** A batten tube light on a wall: a recognisable fixture, emissive, no extra light. */
  tubeLight(at: V3, along: 'x' | 'z'): void {
    const [x, y, z] = at
    const len = 1.2
    const body = this.m('enamel', '#f2f0ea'), tube = this.m('emissive', '#f7fbff')
    if (along === 'x') {
      this.box(body, [x - len / 2, y - 0.025, z - 0.03], [x + len / 2, y + 0.025, z + 0.03])
      this.box(tube, [x - len / 2 + 0.03, y - 0.05, z - 0.018], [x + len / 2 - 0.03, y - 0.022, z + 0.018])
    } else {
      this.box(body, [x - 0.03, y - 0.025, z - len / 2], [x + 0.03, y + 0.025, z + len / 2])
      this.box(tube, [x - 0.018, y - 0.05, z - len / 2 + 0.03], [x + 0.018, y - 0.022, z + len / 2 - 0.03])
    }
  }

  /**
   * An interior's lighting: a soft hemisphere fill, a warm ceiling point light, and one
   * shadow-casting directional light standing in for daylight (standard tier only).
   */
  interiorLights(centre: THREE.Vector3, half: { x: number; z: number }, height: number, from: V3): void {
    const colour = LIGHT_COLOUR[this.ctx.materials.light]
    const hemi = new THREE.HemisphereLight(0xfff6ea, 0x8a7458, 1.15)
    hemi.name = 'suite:fill'
    const lamp = new THREE.PointLight(colour, 14, 11, 1.6)
    lamp.position.set(centre.x, height - 0.35, centre.z)
    lamp.name = 'suite:lamp'
    const day = new THREE.DirectionalLight(0xfff4e6, 1.25)
    day.name = 'suite:daylight'
    day.position.set(centre.x + from[0], from[1], centre.z + from[2])
    day.target.position.copy(centre)
    this.shadow(day, Math.max(half.x, half.z) + 0.8)
    this.group.add(hemi, lamp, day, day.target)
    this.lights.push(hemi, lamp, day)
  }

  outdoorLights(centre: THREE.Vector3, half: number): void {
    const hemi = new THREE.HemisphereLight(0xe8f1ff, 0x9a8466, 1.3)
    hemi.name = 'suite:sky'
    const sun = new THREE.DirectionalLight(0xfff0d8, 2.4)
    sun.name = 'suite:sun'
    sun.position.set(centre.x + 5, 9, centre.z + 6)
    sun.target.position.copy(centre)
    this.shadow(sun, half + 1)
    const fill = new THREE.PointLight(LIGHT_COLOUR[this.ctx.materials.light], 5, 7, 1.6)
    fill.position.set(centre.x, 2.4, centre.z - 2.4)
    fill.name = 'suite:veranda-lamp'
    this.group.add(hemi, sun, sun.target, fill)
    this.lights.push(hemi, sun, fill)
  }

  private shadow(light: THREE.DirectionalLight, extent: number): void {
    if (this.ctx.quality !== 'standard') return
    light.castShadow = true
    light.shadow.mapSize.set(1024, 1024)
    const cam = light.shadow.camera
    cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent
    cam.near = 0.5; cam.far = 25
    light.shadow.bias = -0.0005
    light.shadow.normalBias = 0.02
  }

  finish(): THREE.BufferGeometry[] {
    const geometries: THREE.BufferGeometry[] = []
    for (const [material, { geos, cast }] of this.parts) {
      const prepared = geos.map((g) => {
        const n = g.index ? g.toNonIndexed() : g
        if (n !== g) g.dispose()
        for (const name of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(name)) n.deleteAttribute(name)
        return n
      })
      let merged = prepared.length === 1 ? prepared[0] : mergeGeometries(prepared, false)
      if (prepared.length > 1) for (const g of prepared) g.dispose()
      const tile = material.userData.tile as number | undefined
      if (tile && (material as THREE.MeshStandardMaterial).map) merged = projectUV(merged, tile)
      merged.computeBoundingBox()
      merged.computeBoundingSphere()
      const mesh = new THREE.Mesh(merged, material)
      mesh.name = `shell:${material.name}`
      mesh.receiveShadow = this.ctx.quality === 'standard'
      mesh.castShadow = cast && this.ctx.quality === 'standard'
      this.group.add(mesh)
      geometries.push(merged)
    }
    this.parts.clear()
    return geometries
  }
}
