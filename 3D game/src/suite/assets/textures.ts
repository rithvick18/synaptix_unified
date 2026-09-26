/**
 * The suite's vendored texture sets (public/suite/assets/textures/, CC0 from Poly Haven;
 * see ATTRIBUTION.md and textures/sources.json). Nothing is fetched from another origin.
 *
 * Sets are loaded only on the 'standard' tier with `loadTextures` on. A set that fails to
 * load (missing file, decode error, timeout, no DOM) resolves to null and every material
 * that would have used it stays a flat tinted colour — a failed texture never throws.
 */
import * as THREE from 'three'
import { suiteUrl } from '../paths'

export type TextureSetName =
  | 'wood' | 'floor-wood' | 'plaster' | 'terrazzo' | 'tile' | 'stone' | 'cement' | 'clay' | 'fabric' | 'bamboo'

export interface TextureSetDef {
  name: TextureSetName
  /** Poly Haven asset id. */
  source: string
  diffPx: number
  norPx: number
  /** Real-world size of one repeat in metres (Poly Haven's published dimensions). */
  tile: number
  /** Measured mean colour of the diffuse map (linear average, as sRGB hex). */
  mean: string
}

export const TEXTURE_SETS: Record<TextureSetName, TextureSetDef> = {
  wood: { name: 'wood', source: 'oak_veneer_01', diffPx: 1024, norPx: 512, tile: 1.83, mean: '#a17f57' },
  'floor-wood': { name: 'floor-wood', source: 'laminate_floor_02', diffPx: 1024, norPx: 512, tile: 1.7, mean: '#9b8163' },
  plaster: { name: 'plaster', source: 'painted_plaster_wall', diffPx: 1024, norPx: 512, tile: 2.0, mean: '#aba3a0' },
  terrazzo: { name: 'terrazzo', source: 'mixed_stone_tiles', diffPx: 1024, norPx: 512, tile: 1.8, mean: '#87765c' },
  tile: { name: 'tile', source: 'floor_tiles_06', diffPx: 1024, norPx: 512, tile: 3.0, mean: '#7c726d' },
  stone: { name: 'stone', source: 'granite_tile', diffPx: 1024, norPx: 512, tile: 2.3, mean: '#4e4f4e' },
  cement: { name: 'cement', source: 'concrete_floor_worn_001', diffPx: 1024, norPx: 512, tile: 3.0, mean: '#565754' },
  clay: { name: 'clay', source: 'clay_floor_001', diffPx: 512, norPx: 512, tile: 2.0, mean: '#7a603e' },
  fabric: { name: 'fabric', source: 'cotton_jersey', diffPx: 512, norPx: 512, tile: 0.26, mean: '#c1ab9d' },
  bamboo: { name: 'bamboo', source: 'bamboo_veneer', diffPx: 512, norPx: 512, tile: 1.0, mean: '#d2ae80' }
}

export const TEXTURE_SET_NAMES = Object.keys(TEXTURE_SETS) as TextureSetName[]

export interface LoadedSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  /** Approximate GPU memory with mipmaps, in KB. */
  kb: number
}

const TIMEOUT_MS = 8000

/** RGBA8 with a full mip chain. */
export function textureKB(width: number, height: number): number {
  return (width * height * 4 * 4) / 3 / 1024
}

function loadOne(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout ${url}`)), TIMEOUT_MS)
    try {
      new THREE.TextureLoader().load(
        url,
        (texture) => { clearTimeout(timer); resolve(texture) },
        undefined,
        () => { clearTimeout(timer); reject(new Error(`failed ${url}`)) }
      )
    } catch (error) {
      clearTimeout(timer)
      reject(error)
    }
  })
}

/**
 * Loaded sets, kept for the session so a rebuilt environment never refetches. The GPU copy
 * is released (texture.dispose()) when the last scene using a set is disposed; three
 * re-uploads it from the kept image if a later scene uses it again.
 */
class TextureStore {
  private sets = new Map<TextureSetName, { promise: Promise<LoadedSet | null>; refs: number; value?: LoadedSet | null }>()

  acquire(name: TextureSetName, anisotropy: number): Promise<LoadedSet | null> {
    let entry = this.sets.get(name)
    if (!entry) {
      const def = TEXTURE_SETS[name]
      const created: { promise: Promise<LoadedSet | null>; refs: number; value?: LoadedSet | null } = {
        refs: 0,
        promise: Promise.resolve(null)
      }
      created.promise = (async (): Promise<LoadedSet | null> => {
        try {
          if (typeof document === 'undefined') return null
          const [map, normalMap] = await Promise.all([
            loadOne(suiteUrl(`assets/textures/${name}_diff.webp`)),
            loadOne(suiteUrl(`assets/textures/${name}_nor.webp`))
          ])
          map.colorSpace = THREE.SRGBColorSpace
          for (const t of [map, normalMap]) {
            t.wrapS = t.wrapT = THREE.RepeatWrapping
            t.anisotropy = anisotropy
          }
          return { map, normalMap, kb: textureKB(def.diffPx, def.diffPx) + textureKB(def.norPx, def.norPx) }
        } catch (error) {
          console.warn(`[suite] texture set ${name} unavailable; flat colour used`, error)
          return null
        }
      })()
      created.promise.then((value) => { created.value = value })
      entry = created
      this.sets.set(name, entry)
    }
    entry.refs++
    return entry.promise
  }

  release(name: TextureSetName): void {
    const entry = this.sets.get(name)
    if (!entry) return
    entry.refs = Math.max(0, entry.refs - 1)
    if (entry.refs === 0 && entry.value) {
      entry.value.map.dispose()
      entry.value.normalMap.dispose()
    }
    // A failed set is forgotten so a later build may try again.
    if (entry.refs === 0 && entry.value === null) this.sets.delete(name)
  }
}

export const textureStore = new TextureStore()
