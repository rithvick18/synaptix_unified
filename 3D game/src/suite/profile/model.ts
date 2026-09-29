/**
 * The caregiver's suite settings, stored as the optional `suite` field of the existing
 * LocalProfile (IndexedDB). Pure logic: no DOM, importable by node checks.
 *
 * Normalisation only removes what cannot be used (wrong types, duplicate ids, unknown
 * modes and topics, entries with no media at all). It never rewrites caregiver text,
 * never fills in a missing name or caption, and never infers anything: empty stays empty.
 * A blob that exists but may not decode is kept, so the editor can say so.
 */
import { TOPICS } from '../contracts'
import type { CaregiverAudio, CaregiverPrompt, PhotoDepth, LanguageCode, ObjectOverrides, SequenceRef, SuiteOf, SuitePhoto, SuiteProfile, SuiteSound } from '../contracts'
import type { LocalProfile, Photo } from '../../LocalProfile'

export const SUITE_LIMITS = {
  maxPhotos: 60,
  maxSounds: 30,
  photoBytes: 25 * 1024 * 1024,
  photoTypes: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
  audioBytes: 15 * 1024 * 1024,
  audioMs: 10 * 60 * 1000,
  /** Canonical audio types accepted (mp3, m4a/mp4, wav, ogg, webm). */
  audioTypes: ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm'] as readonly string[],
  /** Input length caps in the editor (maxlength); stored text is never truncated. */
  text: { name: 80, caption: 500, prompt: 1000, title: 120, person: 80, label: 120, description: 1000 }
} as const

/** Aliases browsers and operating systems report, mapped to the canonical type. */
const AUDIO_ALIASES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg', 'audio/mp3': 'audio/mpeg', 'audio/mpeg3': 'audio/mpeg', 'audio/x-mpeg': 'audio/mpeg', 'audio/x-mp3': 'audio/mpeg',
  'audio/mp4': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'audio/aac': 'audio/mp4', 'video/mp4': 'audio/mp4',
  'audio/wav': 'audio/wav', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
  'audio/ogg': 'audio/ogg', 'application/ogg': 'audio/ogg', 'audio/x-ogg': 'audio/ogg', 'audio/opus': 'audio/ogg',
  'audio/webm': 'audio/webm', 'video/webm': 'audio/webm'
}
const AUDIO_EXTENSIONS: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/mp4', wav: 'audio/wav', wave: 'audio/wav',
  ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm'
}

/** A problem with a chosen file. `key` is an i18n key (namespace `common`). */
export interface MediaProblem { ok: false; reason: 'unsupported-type' | 'too-large' | 'too-long' | 'empty'; key: string; vars: Record<string, string | number> }
export type MediaCheck = { ok: true; mime: string } | MediaProblem

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024))

/** The canonical audio type of a file from its reported type, then its extension; null if not accepted. */
export function audioMime(file: Blob & { name?: string }): string | null {
  const reported = (file.type || '').split(';')[0].trim().toLowerCase()
  if (reported && AUDIO_ALIASES[reported]) return AUDIO_ALIASES[reported]
  const ext = typeof file.name === 'string' ? file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] : undefined
  if ((!reported || reported === 'application/octet-stream') && ext && AUDIO_EXTENSIONS[ext]) return AUDIO_EXTENSIONS[ext]
  return null
}

/**
 * Checks an audio file's type and size, and its duration when known (measure it by
 * decoding first, in the browser). Never decodes anything itself.
 */
export function validateAudioFile(file: Blob & { name?: string }, durationMs?: number): MediaCheck {
  const mime = audioMime(file)
  if (!mime) return { ok: false, reason: 'unsupported-type', key: 'common.media.audioType', vars: {} }
  if (file.size === 0) return { ok: false, reason: 'empty', key: 'common.media.empty', vars: {} }
  if (file.size > SUITE_LIMITS.audioBytes) return { ok: false, reason: 'too-large', key: 'common.media.audioTooLarge', vars: { max: mb(SUITE_LIMITS.audioBytes) } }
  if (durationMs !== undefined && durationMs > SUITE_LIMITS.audioMs) {
    return { ok: false, reason: 'too-long', key: 'common.media.audioTooLong', vars: { max: Math.round(SUITE_LIMITS.audioMs / 60000) } }
  }
  return { ok: true, mime }
}

/** Checks a photograph's type and size before it is decoded by importPhoto. */
export function validatePhotoFile(file: Blob & { name?: string }): MediaCheck {
  const mime = (file.type || '').toLowerCase()
  if (!SUITE_LIMITS.photoTypes.includes(mime)) return { ok: false, reason: 'unsupported-type', key: 'common.media.photoType', vars: {} }
  if (file.size === 0) return { ok: false, reason: 'empty', key: 'common.media.empty', vars: {} }
  if (file.size > SUITE_LIMITS.photoBytes) return { ok: false, reason: 'too-large', key: 'common.media.photoTooLarge', vars: { max: mb(SUITE_LIMITS.photoBytes) } }
  return { ok: true, mime }
}

export function defaultSuiteProfile(): SuiteProfile {
  return {
    version: 1,
    language: 'en',
    packId: null,
    environmentId: null,
    objects: {},
    objectPrompts: {},
    photos: [],
    sounds: [],
    topics: { include: [], avoid: [] },
    mode: 'open',
    sequence: [],
    caregiverAssist: true
  }
}

// -------------------------------------------------------------------------------------------
// Normalisation
// -------------------------------------------------------------------------------------------

type Loose = Record<string, unknown>
const isObject = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown): string | undefined => typeof v === 'string' ? v : undefined
const isBlob = (v: unknown): v is Blob => typeof Blob !== 'undefined' && v instanceof Blob
const TOPIC_SET = new Set<string>(TOPICS)
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

export function normaliseTopics(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((t): t is string => typeof t === 'string' && TOPIC_SET.has(t)))] : []
}

function language(v: unknown, fallback: LanguageCode): LanguageCode {
  return typeof v === 'string' && LANGUAGE.test(v) ? v : fallback
}

function audio(v: unknown): CaregiverAudio | undefined {
  if (!isObject(v) || !isBlob(v.blob)) return undefined
  const durationMs = typeof v.durationMs === 'number' && Number.isFinite(v.durationMs) && v.durationMs >= 0 ? v.durationMs : 0
  return { blob: v.blob, mime: str(v.mime) || v.blob.type || 'application/octet-stream', durationMs }
}

function prompt(v: unknown, fallbackLang: LanguageCode): CaregiverPrompt | undefined {
  if (!isObject(v)) return undefined
  const text = str(v.text) ?? ''
  const recorded = audio(v.audio)
  if (!text.trim() && !recorded) return undefined
  return { text, lang: language(v.lang, fallbackLang), ...(recorded ? { audio: recorded } : {}) }
}

function photo(v: unknown): Photo | undefined {
  if (!isObject(v) || typeof v.id !== 'string' || !isBlob(v.original) || !isBlob(v.runtime) || !isBlob(v.thumbnail)) return undefined
  const dim = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0
  const crop = isObject(v.crop) ? v.crop : {}
  const num = (n: unknown, d: number) => typeof n === 'number' && Number.isFinite(n) ? n : d
  return { id: v.id, original: v.original, runtime: v.runtime, thumbnail: v.thumbnail, width: dim(v.width), height: dim(v.height),
    crop: { x: num(crop.x, .5), y: num(crop.y, .5), zoom: num(crop.zoom, 1) } }
}

/** A stored depth map, kept only if its blob has exactly one byte per cell. */
function depth(v: unknown): PhotoDepth | undefined {
  if (!isObject(v) || !isBlob(v.data)) return undefined
  const { width, height } = v
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 2 && n <= 2048
  if (!ok(width) || !ok(height) || v.data.size !== width * height) return undefined
  return { data: v.data, width, height }
}

function people(v: unknown): { name: string; relationship: string }[] {
  if (!Array.isArray(v)) return []
  return v.filter(isObject)
    .map(p => ({ name: str(p.name) ?? '', relationship: str(p.relationship) ?? '' }))
    .filter(p => p.name.trim() || p.relationship.trim())
}

function overrides(v: unknown): ObjectOverrides {
  const out: ObjectOverrides = {}
  if (!isObject(v)) return out
  for (const [placement, o] of Object.entries(v)) {
    if (!isObject(o)) continue
    const entry: ObjectOverrides[string] = {}
    if (typeof o.label === 'string' && o.label.trim()) entry.label = o.label
    if (typeof o.description === 'string' && o.description.trim()) entry.description = o.description
    if (o.hidden === true) entry.hidden = true
    if (Object.keys(entry).length) out[placement] = entry
  }
  return out
}

const warnDropped = (what: string, count: number) => {
  if (count > 0) console.warn(`[suite profile] ${count} ${what} could not be used and were left out.`)
}

/** Normalises any stored value into a complete SuiteProfile. Never mutates `raw`. */
export function normaliseSuite(raw: unknown): SuiteProfile {
  const base = defaultSuiteProfile()
  if (!isObject(raw)) return base
  const lang = language(raw.language, base.language)
  const packId = str(raw.packId) || null
  const environmentId = packId ? str(raw.environmentId) || null : null

  const objects: SuiteProfile['objects'] = {}
  if (isObject(raw.objects)) for (const [key, value] of Object.entries(raw.objects)) {
    const o = overrides(value)
    if (Object.keys(o).length) objects[key] = o
  }
  const objectPrompts: SuiteProfile['objectPrompts'] = {}
  if (isObject(raw.objectPrompts)) for (const [key, value] of Object.entries(raw.objectPrompts)) {
    const p = prompt(value, lang)
    if (p) objectPrompts[key] = p
  }

  const photos: SuitePhoto[] = []
  const photoIds = new Set<string>()
  let dropped = 0
  for (const entry of Array.isArray(raw.photos) ? raw.photos : []) {
    const media = isObject(entry) ? photo(entry.photo) : undefined
    const id = isObject(entry) ? str(entry.id) : undefined
    if (!media || !id || photoIds.has(id) || photos.length >= SUITE_LIMITS.maxPhotos) { dropped++; continue }
    photoIds.add(id)
    const e = entry as Loose
    const p = prompt(e.prompt, lang)
    const topics = normaliseTopics(e.topics)
    const relief = depth(e.depth)
    photos.push({ id, photo: media, caption: str(e.caption) ?? '', people: people(e.people),
      ...(relief ? { depth: relief } : {}), ...(p ? { prompt: p } : {}), ...(str(e.surface) ? { surface: e.surface as string } : {}), ...(topics.length ? { topics } : {}) })
  }
  warnDropped('photos', dropped)

  const sounds: SuiteSound[] = []
  const soundIds = new Set<string>()
  dropped = 0
  for (const entry of Array.isArray(raw.sounds) ? raw.sounds : []) {
    const media = isObject(entry) ? audio(entry.audio) : undefined
    const id = isObject(entry) ? str(entry.id) : undefined
    if (!media || !id || soundIds.has(id) || sounds.length >= SUITE_LIMITS.maxSounds) { dropped++; continue }
    soundIds.add(id)
    const e = entry as Loose
    const p = prompt(e.prompt, lang)
    const topics = normaliseTopics(e.topics)
    sounds.push({ id, title: str(e.title) ?? '', kind: e.kind === 'voice-message' ? 'voice-message' : 'familiar-sound', audio: media,
      ...(p ? { prompt: p } : {}), ...(topics.length ? { topics } : {}) })
  }
  warnDropped('sounds', dropped)

  const topicsRaw = isObject(raw.topics) ? raw.topics : {}
  const avoid = normaliseTopics(topicsRaw.avoid)
  // A topic on both lists is avoided: leaving something out is the careful choice.
  const include = normaliseTopics(topicsRaw.include).filter(t => !avoid.includes(t))

  const sequence: SequenceRef[] = []
  const seen = new Set<string>()
  for (const ref of Array.isArray(raw.sequence) ? raw.sequence : []) {
    if (!isObject(ref) || typeof ref.id !== 'string' || !ref.id) continue
    const kind = ref.kind
    if (kind !== 'photo' && kind !== 'object' && kind !== 'sound') continue
    if (kind === 'photo' && !photoIds.has(ref.id)) continue
    if (kind === 'sound' && !soundIds.has(ref.id)) continue
    if (kind === 'object' && !/^[^/]+\/[^/]+$/.test(ref.id)) continue
    const key = `${kind}:${ref.id}`
    if (seen.has(key)) continue
    seen.add(key); sequence.push({ kind, id: ref.id })
  }

  return {
    version: 1,
    language: lang,
    packId,
    environmentId,
    objects,
    objectPrompts,
    photos,
    sounds,
    topics: { include, avoid },
    mode: raw.mode === 'guided' ? 'guided' : 'open',
    sequence,
    caregiverAssist: typeof raw.caregiverAssist === 'boolean' ? raw.caregiverAssist : base.caregiverAssist
  }
}

/** The profile's suite settings, normalised; defaults for a profile saved before the suite existed. */
export const suiteOf: SuiteOf = (profile: LocalProfile | undefined) => normaliseSuite(profile?.suite)

/** Keys used inside SuiteProfile maps. */
export const envKey = (packId: string, environmentId: string) => `${packId}/${environmentId}`
export const objectPromptKey = (packId: string, environmentId: string, placementId: string) => `${packId}/${environmentId}/${placementId}`
