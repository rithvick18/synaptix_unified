/**
 * A pack's demo pictures and sounds as the display objects the activities use.
 * Demo pictures are never personal: `personal: false`, no people, and the pack's visible
 * notice ("Demo picture — an illustration, …") resolved in the active language.
 */
import * as THREE from 'three'
import type { DecorativeImageDef, DisplayPhoto, DisplaySound, I18n, LoadedContentPack, SoundDef } from '../contracts'
import { resolveUnder } from '../paths'

/** Longest edge of an in-scene texture. */
export const DEMO_TEXTURE_MAX = 1024

/** Loads `url` with THREE.TextureLoader, downscaled to at most `max` px, sRGB. */
async function loadTexture(url: string, max: number, made: Set<THREE.Texture>): Promise<THREE.Texture | null> {
  if (typeof document === 'undefined') return null // node checks: no image decoding
  try {
    const loaded = await new THREE.TextureLoader().loadAsync(url)
    let texture: THREE.Texture = loaded
    const image = loaded.image as { width: number; height: number } | undefined
    if (image && Math.max(image.width, image.height) > max) {
      const scale = max / Math.max(image.width, image.height)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(image.width * scale))
      canvas.height = Math.max(1, Math.round(image.height * scale))
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(loaded.image as CanvasImageSource, 0, 0, canvas.width, canvas.height)
        loaded.dispose()
        texture = new THREE.CanvasTexture(canvas)
      }
    }
    texture.colorSpace = THREE.SRGBColorSpace
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
    made.add(texture)
    return texture
  } catch {
    return null
  }
}

export function demoPhoto(
  pack: LoadedContentPack,
  def: DecorativeImageDef,
  i18n: I18n,
  made: Set<THREE.Texture>,
  cache: Map<string, Promise<THREE.Texture | null>>,
  isDisposed: () => boolean = () => false
): DisplayPhoto {
  const url = resolveUnder(pack.baseUrl, def.path)
  return {
    id: def.id,
    url,
    thumbUrl: url,
    width: def.width,
    height: def.height,
    // Resolved on read, so a language change shows up without rebuilding.
    get caption() {
      return i18n.text(def.alt)
    },
    get notice() {
      return i18n.text(def.notice)
    },
    people: [],
    personal: false,
    prompt: null,
    topics: [],
    texture() {
      let p = cache.get(def.id)
      if (!p) {
        // A texture that arrives after dispose() is freed at once, never leaked.
        p = loadTexture(url, DEMO_TEXTURE_MAX, made).then((t) => {
          if (t && isDisposed()) {
            t.dispose()
            made.delete(t)
            return null
          }
          return t
        })
        cache.set(def.id, p)
      }
      return p
    }
  }
}

export function packSound(pack: LoadedContentPack, def: SoundDef, i18n: I18n): DisplaySound {
  return {
    id: def.id,
    url: resolveUnder(pack.baseUrl, def.path),
    get title() {
      return i18n.text(def.label)
    },
    get description() {
      return i18n.text(def.description)
    },
    durationMs: def.durationMs,
    personal: false,
    synthesized: def.synthesized,
    kind: 'familiar-sound',
    prompt: null,
    topics: [...(def.topics ?? [])]
  }
}

export function packDisplayMedia(pack: LoadedContentPack, i18n: I18n): { demoPhotos: DisplayPhoto[]; packSounds: DisplaySound[]; dispose(): void } {
  const made = new Set<THREE.Texture>()
  const cache = new Map<string, Promise<THREE.Texture | null>>()
  let disposed = false
  return {
    demoPhotos: pack.images.map((def) => demoPhoto(pack, def, i18n, made, cache, () => disposed)),
    packSounds: pack.sounds.map((def) => packSound(pack, def, i18n)),
    dispose() {
      if (disposed) return
      disposed = true
      for (const t of made) t.dispose()
      made.clear()
      cache.clear()
    }
  }
}
