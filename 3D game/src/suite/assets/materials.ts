/**
 * The suite's material palette: PBR MeshStandardMaterials in the warm, calm look of the
 * house (src/proceduralHouse.ts). Every material is shared through a reference-counted
 * cache keyed by name, colour and texture state.
 *
 * With a texture set loaded, a material is tinted so the textured surface averages to the
 * same colour as its flat fallback — the palette looks the same on every tier.
 */
import * as THREE from 'three'
import { RefCache } from './cache'
import { TEXTURE_SETS, type LoadedSet, type TextureSetName } from './textures'

export type MatName =
  | 'wood' | 'woodDark' | 'woodLight' | 'woodPainted' | 'bamboo' | 'cane' | 'jute'
  | 'steel' | 'steelPainted' | 'brass' | 'bellMetal' | 'copper' | 'iron' | 'aluminium' | 'tin' | 'chrome'
  | 'clay' | 'stone' | 'ceramic' | 'enamel' | 'glass' | 'mirror'
  | 'fabric' | 'leather' | 'paper' | 'plastic' | 'rubber' | 'black' | 'slate'
  | 'leaf' | 'leafDark' | 'emissive' | 'screen'
  /** Vertex-coloured: many small differently coloured parts in one draw call. */
  | 'vc' | 'vcGloss' | 'vcMetal'
  /** Shell surfaces. */
  | 'wall' | 'ceiling' | 'floor' | 'trim' | 'sky'
  | 'floorWood' | 'floorTile' | 'floorStone' | 'floorTerrazzo' | 'floorRedOxide' | 'floorMud' | 'floorCement'

interface MatSpec {
  colour: string
  rough: number
  metal?: number
  set?: TextureSetName
  /** UV tile size in metres when a set or pattern is applied (box projection). */
  tile?: number
  pattern?: 'weave'
  opacity?: number
  emissive?: string
  vc?: boolean
  side?: THREE.Side
  basic?: boolean
}

export const PALETTE: Record<MatName, MatSpec> = {
  wood: { colour: '#8a5a36', rough: 0.58, set: 'wood', tile: 0.9 },
  woodDark: { colour: '#5b3a25', rough: 0.52, set: 'wood', tile: 0.9 },
  woodLight: { colour: '#c29a68', rough: 0.62, set: 'wood', tile: 0.9 },
  woodPainted: { colour: '#6f8f7a', rough: 0.6 },
  bamboo: { colour: '#c9a46a', rough: 0.6, set: 'bamboo', tile: 0.45 },
  cane: { colour: '#c9a063', rough: 0.75, pattern: 'weave', tile: 0.05 },
  jute: { colour: '#b89a64', rough: 0.95, pattern: 'weave', tile: 0.08 },
  steel: { colour: '#d3d7db', rough: 0.26, metal: 0.55 },
  steelPainted: { colour: '#8c9c96', rough: 0.42, metal: 0.25 },
  brass: { colour: '#d0a54c', rough: 0.3, metal: 0.55 },
  bellMetal: { colour: '#c29a5c', rough: 0.32, metal: 0.55 },
  copper: { colour: '#bd7a4f', rough: 0.35, metal: 0.55 },
  iron: { colour: '#3d3d40', rough: 0.55, metal: 0.4 },
  aluminium: { colour: '#bfc3c7', rough: 0.38, metal: 0.45 },
  tin: { colour: '#4f6f8f', rough: 0.45, metal: 0.3 },
  chrome: { colour: '#e2e5e8', rough: 0.18, metal: 0.6 },
  clay: { colour: '#b4673f', rough: 0.9, set: 'clay', tile: 0.5 },
  stone: { colour: '#77736c', rough: 0.85, set: 'stone', tile: 0.6 },
  ceramic: { colour: '#ece5d6', rough: 0.3 },
  enamel: { colour: '#f1ede4', rough: 0.35 },
  glass: { colour: '#d6e8ee', rough: 0.08, opacity: 0.4 },
  mirror: { colour: '#c9d7df', rough: 0.12, metal: 0.25, emissive: '#39454d' },
  fabric: { colour: '#9b4a3a', rough: 0.95, set: 'fabric', tile: 0.26 },
  leather: { colour: '#6a3f28', rough: 0.55 },
  paper: { colour: '#f1ead9', rough: 0.9 },
  plastic: { colour: '#3f7fb5', rough: 0.42 },
  rubber: { colour: '#2b2b2b', rough: 0.85 },
  black: { colour: '#26262a', rough: 0.5 },
  slate: { colour: '#2f3a36', rough: 0.8 },
  leaf: { colour: '#4f7d3a', rough: 0.75, side: THREE.DoubleSide },
  leafDark: { colour: '#2f5b2c', rough: 0.75, side: THREE.DoubleSide },
  emissive: { colour: '#fff1d6', rough: 1, emissive: '#fff1d6' },
  screen: { colour: '#2c3a3c', rough: 0.15, metal: 0.1 },
  vc: { colour: '#ffffff', rough: 0.72, vc: true },
  vcGloss: { colour: '#ffffff', rough: 0.35, vc: true },
  vcMetal: { colour: '#ffffff', rough: 0.3, metal: 0.5, vc: true },
  wall: { colour: '#efe6d6', rough: 0.95, set: 'plaster', tile: 2.0 },
  ceiling: { colour: '#f6f2ea', rough: 0.95 },
  floor: { colour: '#b9a58a', rough: 0.7 },
  trim: { colour: '#6b4a32', rough: 0.55, set: 'wood', tile: 1.2 },
  sky: { colour: '#e4eef4', rough: 1, basic: true },
  floorWood: { colour: '#9b7a55', rough: 0.6, set: 'floor-wood', tile: 1.7 },
  floorTile: { colour: '#c9c1b4', rough: 0.4, set: 'tile', tile: 2.4 },
  floorStone: { colour: '#8d8a84', rough: 0.55, set: 'stone', tile: 2.3 },
  floorTerrazzo: { colour: '#c8bba5', rough: 0.35, set: 'terrazzo', tile: 1.8 },
  floorRedOxide: { colour: '#8e3b2e', rough: 0.3, set: 'cement', tile: 3.0 },
  floorMud: { colour: '#a8845a', rough: 0.95, set: 'clay', tile: 2.0 },
  floorCement: { colour: '#a9a59c', rough: 0.75, set: 'cement', tile: 3.0 }
}

/** Per-build texture state: whether textures are wanted and which sets loaded. */
export interface MaterialEnv {
  textured: boolean
  sets: ReadonlyMap<TextureSetName, LoadedSet | null>
}

export const FLAT_ENV: MaterialEnv = { textured: false, sets: new Map() }

const cache = new RefCache<THREE.Material>()

function tintFor(target: THREE.Color, mean: string): THREE.Color {
  const m = new THREE.Color(mean)
  const c = (a: number, b: number): number => Math.min(3, a / Math.max(b, 1e-4))
  return new THREE.Color(c(target.r, m.r), c(target.g, m.g), c(target.b, m.b))
}

/** A 64×64 basket-weave pattern, generated in memory (works under node, no download). */
function weaveTexture(): THREE.DataTexture {
  const n = 64
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cell = ((x >> 3) + (y >> 3)) & 1
      const along = cell ? x & 7 : y & 7
      const across = cell ? y & 7 : x & 7
      const edge = across === 0 || across === 7 ? 0.62 : 1
      const shade = (0.8 + 0.2 * Math.sin((along / 8) * Math.PI)) * edge
      const v = Math.round(255 * shade)
      const i = (y * n + x) * 4
      data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(data, n, n)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function signature(spec: MatSpec, env: MaterialEnv): string {
  if (!env.textured) return 'F'
  if (spec.set) return env.sets.get(spec.set) ? 'T' : 'F'
  if (spec.pattern) return 'P'
  return 'F'
}

function create(name: MatName, colour: string, env: MaterialEnv, opts: MatOptions): THREE.Material {
  const spec = PALETTE[name]
  const target = new THREE.Color(colour)
  if (spec.basic) {
    const m = new THREE.MeshBasicMaterial({ color: target, toneMapped: false })
    m.name = `suite:${name}`
    return m
  }
  const m = new THREE.MeshStandardMaterial({
    color: target,
    roughness: opts.rough ?? spec.rough,
    metalness: spec.metal ?? 0,
    vertexColors: spec.vc ?? false,
    side: spec.side ?? THREE.FrontSide
  })
  m.name = `suite:${name}`
  if (spec.opacity !== undefined) {
    m.transparent = true
    m.opacity = spec.opacity
    m.depthWrite = false
  }
  if (spec.emissive) {
    m.emissive = new THREE.Color(name === 'emissive' ? colour : spec.emissive)
    m.emissiveIntensity = name === 'emissive' ? 0.9 : 0.35
  }
  const sig = signature(spec, env)
  if (sig === 'T' && spec.set) {
    const set = env.sets.get(spec.set)!
    m.map = set.map
    m.normalMap = set.normalMap
    m.normalScale.set(0.6, 0.6)
    m.color.copy(tintFor(target, TEXTURE_SETS[spec.set].mean))
    m.userData.tile = opts.tile ?? spec.tile ?? TEXTURE_SETS[spec.set].tile
  } else if (sig === 'P' && spec.pattern) {
    const pattern = weaveTexture()
    m.map = pattern
    // The pattern averages ~0.85; lift the tint so the average matches the flat colour.
    m.color.multiplyScalar(1.15)
    m.userData.tile = spec.tile ?? 0.05
    m.addEventListener('dispose', () => pattern.dispose())
  }
  return m
}

export interface MatOptions {
  /** Overrides the palette roughness. */
  rough?: number
  /** Overrides the UV tile size (metres). */
  tile?: number
}

/**
 * Collects the cached materials one owner (an asset prototype, a shell) acquires, so they
 * can all be released together.
 */
export class MaterialLease {
  private keys: string[] = []
  constructor(readonly env: MaterialEnv) {}

  get(name: MatName, colour?: string, opts: MatOptions = {}): THREE.Material {
    const spec = PALETTE[name]
    const c = (colour ?? spec.colour).toLowerCase()
    const key = `${name}|${c}|${signature(spec, this.env)}|${opts.rough ?? ''}|${opts.tile ?? ''}`
    this.keys.push(key)
    return cache.acquire(key, () => create(name, c, this.env, opts))
  }

  releaseAll(): void {
    for (const key of this.keys) cache.release(key)
    this.keys = []
  }

  get count(): number {
    return this.keys.length
  }
}

/** For checks: how many distinct cached materials are alive. */
export function liveMaterialCount(): number {
  return cache.size
}
