/**
 * Turns a stored profile into what a session shows: DisplayPhotos, DisplaySounds and
 * caregiver prompts with object URLs, plus lazily built in-scene textures.
 *
 * Only caregiver-typed text is used. Portraits carry the name and relationship the
 * caregiver typed on Personalise Home, the event photo carries its typed caption, and
 * nothing else is filled in: an empty caption stays empty.
 */
import * as THREE from 'three'
import type { CaregiverPrompt, PhotoDepth, DisplayPhoto, DisplaySound, ResolvedPrompt, ResolvedSuiteProfile, ResolveSuiteProfile, SuiteMediaApi } from '../contracts'
import type { Photo } from '../../LocalProfile'
import { unpackDepth } from '../memoryRoom/depthStore'
import { envKey, objectPromptKey, suiteOf } from './model'

/** The in-scene texture cap (long edge), before the renderer's own limit. */
export const TEXTURE_EDGE = 1024

/** Owns every object URL and texture made for one resolved profile. */
export class SuiteMedia implements SuiteMediaApi {
  private urls = new Set<string>()
  private textures = new Set<THREE.Texture>()
  private bitmaps = new Set<{ close(): void }>()
  private disposed = false

  url(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    if (this.disposed) { URL.revokeObjectURL(url); return '' }
    this.urls.add(url)
    return url
  }

  get isDisposed(): boolean { return this.disposed }
  get urlCount(): number { return this.urls.size }

  keepTexture(texture: THREE.Texture, bitmap?: { close(): void }): THREE.Texture | null {
    if (this.disposed) { texture.dispose(); bitmap?.close(); return null }
    this.textures.add(texture)
    if (bitmap) this.bitmaps.add(bitmap)
    return texture
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const url of this.urls) URL.revokeObjectURL(url)
    for (const texture of this.textures) texture.dispose()
    for (const bitmap of this.bitmaps) { try { bitmap.close() } catch { /* already closed */ } }
    this.urls.clear(); this.textures.clear(); this.bitmaps.clear()
  }
}

/** Width and height at most `cap` on the long edge, aspect kept. */
export function fitWithin(width: number, height: number, cap: number): [number, number] {
  const scale = Math.min(1, cap / Math.max(width, height, 1))
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))]
}

/**
 * Builds a ≤ `cap` px sRGB texture from a stored derivative. Resolves null on any decode
 * failure (or where createImageBitmap does not exist, as under node); never throws.
 */
export async function textureFromBlob(blob: Blob, width: number, height: number, cap: number, media: SuiteMedia): Promise<THREE.Texture | null> {
  if (typeof createImageBitmap !== 'function') return null
  let bitmap: ImageBitmap | null = null
  try {
    // WebGL ignores UNPACK_FLIP_Y for ImageBitmap, so flip at decode and set flipY false,
    // as three's ImageBitmapLoader documents.
    const options: ImageBitmapOptions = { imageOrientation: 'flipY', premultiplyAlpha: 'none' }
    if (width > 0 && height > 0) {
      const [w, h] = fitWithin(width, height, cap)
      Object.assign(options, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
    }
    bitmap = await createImageBitmap(blob, options)
    if (!(width > 0 && height > 0) && Math.max(bitmap.width, bitmap.height) > cap) {
      // Unknown stored size: decode once more at the capped size.
      const [w, h] = fitWithin(bitmap.width, bitmap.height, cap)
      const full = bitmap
      bitmap = await createImageBitmap(full, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
      full.close()
    }
    const texture = new THREE.Texture(bitmap as unknown as HTMLImageElement)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.flipY = false
    texture.generateMipmaps = true
    texture.minFilter = THREE.LinearMipmapLinearFilter
    texture.magFilter = THREE.LinearFilter
    texture.needsUpdate = true
    return media.keepTexture(texture, bitmap)
  } catch (error) {
    bitmap?.close()
    console.warn('[suite profile] a photograph could not be decoded for the scene', error)
    return null
  }
}

function resolvePrompt(prompt: CaregiverPrompt | undefined, media: SuiteMedia): ResolvedPrompt | null {
  if (!prompt) return null
  const audioUrl = prompt.audio ? media.url(prompt.audio.blob) : undefined
  if (!prompt.text.trim() && !audioUrl) return null
  return { text: prompt.text, lang: prompt.lang, source: 'caregiver', ...(audioUrl ? { audioUrl } : {}) }
}

function displayPhoto(
  id: string, photo: Photo, media: SuiteMedia, cap: number,
  fields: Pick<DisplayPhoto, 'caption' | 'people' | 'prompt' | 'topics'> & { preferredSurface?: string; depth?: PhotoDepth }
): DisplayPhoto {
  let texture: Promise<THREE.Texture | null> | undefined
  const depth = fields.depth
  return {
    id,
    url: media.url(photo.runtime),
    thumbUrl: media.url(photo.thumbnail),
    originalUrl: media.url(photo.original),
    width: photo.width,
    height: photo.height,
    caption: fields.caption,
    people: fields.people,
    personal: true,
    prompt: fields.prompt,
    ...(fields.preferredSurface ? { preferredSurface: fields.preferredSurface } : {}),
    topics: fields.topics,
    ...(depth ? { hasDepth: true, loadDepth: () => unpackDepth(depth) } : {}),
    texture() {
      texture ??= textureFromBlob(photo.runtime, photo.width, photo.height, cap, media)
      return texture
    }
  }
}

export const resolveSuiteProfile: ResolveSuiteProfile = async (profile, i18n, maxTextureSize) => {
  const suite = suiteOf(profile)
  const media = new SuiteMedia()
  const cap = Math.max(1, Math.min(TEXTURE_EDGE, maxTextureSize || TEXTURE_EDGE))

  const photos: DisplayPhoto[] = suite.photos.map(p => displayPhoto(p.id, p.photo, media, cap, {
    caption: p.caption,
    people: p.people.map(v => ({ ...v })),
    prompt: resolvePrompt(p.prompt, media),
    topics: [...(p.topics ?? [])],
    preferredSurface: p.surface,
    ...(p.depth ? { depth: p.depth } : {})
  }))
  // Personalise Home photographs: portraits, the wall photo, the event photo.
  const used = new Set(suite.photos.map(p => p.photo.id))
  const home = (id: string, photo: Photo | undefined, caption: string, people: DisplayPhoto['people']) => {
    if (!photo || used.has(photo.id)) return
    used.add(photo.id)
    photos.push(displayPhoto(id, photo, media, cap, { caption, people, prompt: null, topics: [] }))
  }
  for (const person of profile.people) {
    home(`home-person-${person.id}`, person.photo, '', [{ name: person.name, relationship: person.relationship }])
  }
  home(`home-wall-${profile.wallId}`, profile.wall, '', [])
  home(`home-event-${profile.eventId}`, profile.event, profile.caption ?? '', [])

  const sounds: DisplaySound[] = suite.sounds.map(s => ({
    id: s.id,
    url: media.url(s.audio.blob),
    title: s.title,
    ...(s.audio.durationMs > 0 ? { durationMs: s.audio.durationMs } : {}),
    personal: true,
    synthesized: false,
    kind: s.kind,
    prompt: resolvePrompt(s.prompt, media),
    topics: [...(s.topics ?? [])]
  }))

  const objectPrompts = new Map<string, ResolvedPrompt | null>()
  for (const [key, prompt] of Object.entries(suite.objectPrompts)) objectPrompts.set(key, resolvePrompt(prompt, media))

  const language = i18n.languages.some(l => l.code === suite.language) ? suite.language : 'en'
  const resolved: ResolvedSuiteProfile = {
    id: profile.id,
    name: profile.name,
    language,
    mode: suite.mode,
    packId: suite.packId,
    environmentId: suite.environmentId,
    topics: { include: [...suite.topics.include], avoid: [...suite.topics.avoid] },
    sequence: suite.sequence.map(r => ({ ...r })),
    caregiverAssist: suite.caregiverAssist,
    photos,
    sounds,
    objectOverrides(packId, environmentId) {
      const o = suite.objects[envKey(packId, environmentId)] ?? {}
      return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v }]))
    },
    objectPrompt(packId, environmentId, placementId) {
      return objectPrompts.get(objectPromptKey(packId, environmentId, placementId)) ?? null
    }
  }
  return { resolved, media }
}
