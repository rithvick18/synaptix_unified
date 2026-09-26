/**
 * Content-pack validation: pure functions, no DOM and no three.js, so the node checks can
 * import them directly. Every problem is reported rather than thrown; a pack with errors
 * is still returned by the loader so a caregiver can see why it is not offered.
 */
import { ACTIVITY_KINDS, TOPICS } from '../contracts'
import type {
  ActivityKind,
  AssetCategory,
  AssetDef,
  ContentPackIndex,
  ContentPackMeta,
  ContentProblem,
  DecorativeImageDef,
  EnvironmentPreset,
  LocalizedText,
  MountKind,
  PackContent,
  PackEnvironments,
  PromptDef,
  Provenance,
  ShellId,
  SoundDef
} from '../contracts'

export const ASSET_CATEGORIES: readonly AssetCategory[] = [
  'photos-keepsakes', 'furniture', 'storage', 'textiles', 'kitchen-food', 'plants-outdoor', 'music-media',
  'school-work', 'travel', 'hobbies-games', 'community', 'lighting', 'decor'
]

export const SHELL_IDS: readonly ShellId[] = ['livingRoom', 'kitchenDining', 'courtyardVeranda']

/**
 * SPDX licence identifiers accepted for packaged content (https://spdx.org/licenses/).
 * Deliberately a short list of licences that allow redistribution in this project;
 * anything else needs a review before it is added here.
 */
export const SPDX_LICENSES: ReadonlySet<string> = new Set([
  'CC0-1.0', 'CC-PDDC', 'CC-BY-4.0', 'CC-BY-3.0', 'CC-BY-2.0', 'CC-BY-SA-4.0', 'CC-BY-SA-3.0',
  'OFL-1.1', 'MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC', 'Zlib', 'Unlicense',
  'Ubuntu-font-1.0'
])

/** Slot facts the loader can check placements against (from the environment module's SHELLS). */
export type KnownShells = Partial<Record<ShellId, readonly { id: string; mount: MountKind }[]>>

type Report = (severity: ContentProblem['severity'], where: string, message: string) => void

export function reporter(into: ContentProblem[]): Report {
  return (severity, where, message) => into.push({ severity, where, message })
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0

/** Pack text must be a language map with English present and every entry non-empty. */
export function checkText(v: unknown, where: string, report: Report, field: string, required = true): v is LocalizedText {
  if (v === undefined) {
    if (required) report('error', where, `${field} is missing`)
    return false
  }
  if (typeof v === 'string') {
    report('error', where, `${field} must be a language map such as {"en": "…"} (a plain string is only for a caregiver's own words)`)
    return false
  }
  if (!isObject(v)) {
    report('error', where, `${field} must be a language map`)
    return false
  }
  if (!isNonEmptyString(v.en)) report('error', where, `${field} has no English ("en") text`)
  for (const [lang, text] of Object.entries(v)) {
    if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(lang)) report('error', where, `${field} has an invalid language code "${lang}"`)
    if (!isNonEmptyString(text)) report('error', where, `${field}.${lang} is empty`)
  }
  return true
}

export function checkProvenance(v: unknown, where: string, report: Report): v is Provenance {
  if (!isObject(v)) {
    report('error', where, 'provenance is missing')
    return false
  }
  if (!isNonEmptyString(v.source)) report('error', where, 'provenance.source is missing')
  if (!isNonEmptyString(v.author)) report('error', where, 'provenance.author is missing')
  if (!isNonEmptyString(v.license)) report('error', where, 'provenance.license is missing')
  else if (!SPDX_LICENSES.has(v.license)) report('error', where, `provenance.license "${v.license}" is not an accepted SPDX identifier`)
  if (v.url !== undefined && (typeof v.url !== 'string' || !/^https:\/\//.test(v.url))) report('error', where, 'provenance.url must be an https URL (it is a record, never fetched)')
  return true
}

/**
 * True when `path` is a packaged, same-origin file under public/suite/packs/: no scheme,
 * no leading slash, and it does not climb out of the packs directory.
 */
export function isLocalPackPath(path: unknown, packDir: string): path is string {
  if (!isNonEmptyString(path)) return false
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('/') || path.startsWith('\\') || path.includes('\\')) return false
  try {
    const base = new URL(`http://pack.invalid/suite/packs/${packDir.replace(/\/?$/, '/')}`)
    const url = new URL(path, base)
    return url.origin === base.origin && url.pathname.startsWith('/suite/packs/') && !url.search && !url.hash
  } catch {
    return false
  }
}

function uniqueIds(list: { id?: unknown }[], where: string, report: Report, what: string): void {
  const seen = new Set<string>()
  for (const item of list) {
    if (!isNonEmptyString(item.id)) {
      report('error', where, `a ${what} has no id`)
      continue
    }
    if (seen.has(item.id)) report('error', `${where}#${item.id}`, `duplicate ${what} id "${item.id}"`)
    seen.add(item.id)
  }
}

function checkTopics(v: unknown, where: string, report: Report): void {
  if (v === undefined) return
  if (!Array.isArray(v)) {
    report('error', where, 'topics must be a list')
    return
  }
  for (const t of v) {
    if (!(TOPICS as readonly string[]).includes(t)) report('warning', where, `topic "${String(t)}" is not in the shared topic list, so avoid-lists cannot remove it`)
  }
}

function checkActivities(v: unknown, where: string, report: Report, field = 'activities'): void {
  if (v === undefined) return
  if (!Array.isArray(v) || v.length === 0) {
    report('error', where, `${field} must be a non-empty list`)
    return
  }
  for (const a of v) if (!(ACTIVITY_KINDS as readonly string[]).includes(a)) report('error', where, `unknown activity "${String(a)}"`)
}

// ---------------------------------------------------------------------------------------

export function validateIndex(v: unknown, report: Report): v is ContentPackIndex {
  const where = 'packs/index.json'
  if (!isObject(v) || v.schema !== 1 || !Array.isArray(v.packs)) {
    report('error', where, 'expected { "schema": 1, "packs": [...] }')
    return false
  }
  uniqueIds(v.packs as { id?: unknown }[], where, report, 'pack')
  for (const entry of v.packs as unknown[]) {
    if (!isObject(entry) || !isNonEmptyString(entry.path) || !isLocalPackPath(entry.path, '')) {
      report('error', where, `pack entry ${JSON.stringify(entry)} needs a local "path"`)
    }
  }
  return true
}

export function validateMeta(v: unknown, expectedId: string, where: string, report: Report): v is ContentPackMeta {
  if (!isObject(v)) {
    report('error', where, 'pack.json is not an object')
    return false
  }
  if (v.schema !== 1) report('error', where, 'schema must be 1')
  if (v.id !== expectedId) report('error', where, `id "${String(v.id)}" does not match the index entry "${expectedId}"`)
  checkText(v.name, where, report, 'name')
  checkText(v.description, where, report, 'description')
  checkText(v.coverageNote, where, report, 'coverageNote')
  if (v.status !== 'starter' && v.status !== 'preview') report('error', where, 'status must be "starter" or "preview"')
  if (typeof v.regional !== 'boolean') report('error', where, 'regional must be true or false')
  const tags = isObject(v.tags) ? v.tags : undefined
  const regions = tags && Array.isArray(tags.regions) ? tags.regions : []
  if (v.regional === true && regions.length === 0) report('error', where, 'a regional pack needs tags.regions')
  if (v.regional === false && regions.length > 0) report('error', where, 'a pack with region tags must be marked regional: true')
  if (!isObject(v.files) || !isNonEmptyString(v.files.environments) || !isNonEmptyString(v.files.content)) {
    report('error', where, 'files.environments and files.content are required')
  } else {
    for (const key of ['environments', 'content', 'assets'] as const) {
      const f = v.files[key]
      if (f !== undefined && !isLocalPackPath(f, expectedId)) report('error', where, `files.${key} must be a local path`)
    }
  }
  if (!Array.isArray(v.authors) || v.authors.length === 0) report('error', where, 'authors (provenance) is required')
  else v.authors.forEach((a, i) => checkProvenance(a, `${where}#authors/${i}`, report))
  return true
}

/** Looks an asset up in the shared library or among the pack's own assets. */
export type AssetLookup = (id: string) => AssetDef | undefined

export function validateContent(v: unknown, packId: string, where: string, report: Report, lookup: AssetLookup): v is PackContent {
  if (!isObject(v)) {
    report('error', where, 'content.json is not an object')
    return false
  }
  if (v.schema !== 1) report('error', where, 'schema must be 1')
  for (const key of ['prompts', 'sounds', 'images'] as const) {
    if (!Array.isArray(v[key])) {
      report('error', where, `${key} must be a list`)
      return false
    }
  }
  const prompts = v.prompts as Record<string, unknown>[]
  const sounds = v.sounds as Record<string, unknown>[]
  const images = v.images as Record<string, unknown>[]
  uniqueIds(prompts, `${where}#prompts`, report, 'prompt')
  uniqueIds(sounds, `${where}#sounds`, report, 'sound')
  uniqueIds(images, `${where}#images`, report, 'image')

  for (const pr of prompts) {
    const at = `${where}#prompts/${String(pr.id)}`
    if (!isObject(pr)) {
      report('error', at, 'prompt is not an object')
      continue
    }
    checkText(pr.text, at, report, 'text')
    checkTopics(pr.topics, at, report)
    const applies = pr.appliesTo
    if (!isObject(applies)) {
      report('error', at, 'appliesTo is required')
      continue
    }
    const { assets, categories, activities } = applies
    if (assets === undefined && categories === undefined && activities === undefined) report('error', at, 'appliesTo names no assets, categories or activities')
    if (assets !== undefined) {
      if (!Array.isArray(assets) || assets.length === 0) report('error', at, 'appliesTo.assets must be a non-empty list')
      else for (const id of assets) if (typeof id !== 'string' || !lookup(id)) report('warning', at, `appliesTo.assets names "${String(id)}", which is not in the asset library; the prompt will not be used for it`)
    }
    if (categories !== undefined) {
      if (!Array.isArray(categories) || categories.length === 0) report('error', at, 'appliesTo.categories must be a non-empty list')
      else for (const c of categories) if (!(ASSET_CATEGORIES as readonly string[]).includes(c)) report('error', at, `unknown category "${String(c)}"`)
    }
    checkActivities(activities, at, report, 'appliesTo.activities')
    if (pr.audio !== undefined) {
      if (!Array.isArray(pr.audio)) report('error', at, 'audio must be a list')
      else
        for (const a of pr.audio as unknown[]) {
          if (!isObject(a) || !isNonEmptyString(a.lang)) report('error', at, 'each audio entry needs a lang')
          else {
            if (!isLocalPackPath(a.path, packId)) report('error', at, `audio path ${JSON.stringify(a.path)} must be a local file in the pack`)
            checkProvenance(a.provenance, at, report)
          }
        }
    }
  }

  for (const s of sounds) {
    const at = `${where}#sounds/${String(s.id)}`
    checkText(s.label, at, report, 'label')
    checkText(s.description, at, report, 'description')
    if (!isLocalPackPath(s.path, packId)) report('error', at, `path ${JSON.stringify(s.path)} must be a local file (never a remote URL)`)
    if (typeof s.mime !== 'string' || !s.mime.startsWith('audio/')) report('error', at, 'mime must be an audio/* type')
    if (typeof s.durationMs !== 'number' || !(s.durationMs > 0)) report('error', at, 'durationMs must be a positive number')
    if (typeof s.synthesized !== 'boolean') report('error', at, 'synthesized must be true or false')
    if (s.loop !== undefined && typeof s.loop !== 'boolean') report('error', at, 'loop must be true or false')
    checkTopics(s.topics, at, report)
    checkProvenance(s.provenance, at, report)
  }

  for (const im of images) {
    const at = `${where}#images/${String(im.id)}`
    if (!isLocalPackPath(im.path, packId)) report('error', at, `path ${JSON.stringify(im.path)} must be a local file (never a remote URL)`)
    for (const k of ['width', 'height'] as const) {
      if (typeof im[k] !== 'number' || !Number.isInteger(im[k]) || (im[k] as number) <= 0) report('error', at, `${k} must be a positive whole number`)
    }
    checkText(im.alt, at, report, 'alt')
    checkText(im.notice, at, report, 'notice')
    if (im.kind !== 'decorative-generated' && im.kind !== 'decorative-licensed') report('error', at, 'kind must be "decorative-generated" or "decorative-licensed"')
    checkProvenance(im.provenance, at, report)
  }
  return true
}

export function validateEnvironments(
  v: unknown,
  where: string,
  report: Report,
  lookup: AssetLookup,
  imageIds: ReadonlySet<string>,
  shells: KnownShells | undefined
): v is PackEnvironments {
  if (!isObject(v) || v.schema !== 1 || !Array.isArray(v.environments)) {
    report('error', where, 'expected { "schema": 1, "environments": [...] }')
    return false
  }
  const envs = v.environments as Record<string, unknown>[]
  uniqueIds(envs, where, report, 'environment')
  if (!shells) report('warning', where, 'shell slots were not available to the loader, so placement slots were not checked here (the scene builder still reports unknown slots)')
  for (const env of envs) {
    const at = `${where}#${String(env.id)}`
    if (!(SHELL_IDS as readonly string[]).includes(env.shell as string)) report('error', at, `unknown shell "${String(env.shell)}"`)
    checkText(env.name, at, report, 'name')
    checkText(env.description, at, report, 'description')
    if (env.thumbnail !== undefined && !isLocalPackPath(env.thumbnail, '')) report('error', at, 'thumbnail must be a local path')
    if (!Array.isArray(env.placements)) {
      report('error', at, 'placements must be a list')
      continue
    }
    const placements = env.placements as Record<string, unknown>[]
    uniqueIds(placements, at, report, 'placement')
    const slots = shells?.[env.shell as ShellId]
    const usedSlots = new Map<string, string>()
    for (const pl of placements) {
      const pat = `${at}/${String(pl.id)}`
      const asset = typeof pl.asset === 'string' ? lookup(pl.asset) : undefined
      if (!asset) report('error', pat, `unknown asset "${String(pl.asset)}"`)
      if (!isNonEmptyString(pl.slot)) report('error', pat, 'slot is required')
      else {
        const prev = usedSlots.get(pl.slot)
        if (prev) report('warning', pat, `slot "${pl.slot}" is also used by "${prev}"`)
        usedSlots.set(pl.slot, String(pl.id))
        if (slots) {
          const slot = slots.find((s) => s.id === pl.slot)
          if (!slot) report('error', pat, `unknown slot "${pl.slot}" in shell ${String(env.shell)}`)
          else if (asset && asset.mount !== slot.mount) report('error', pat, `asset mount "${asset.mount}" does not fit a "${slot.mount}" slot`)
        }
      }
      if (pl.image !== undefined) {
        if (typeof pl.image !== 'string' || !imageIds.has(pl.image)) report('error', pat, `image "${String(pl.image)}" is not a decorative image of this pack`)
        else if (asset && !asset.photoSurface) report('warning', pat, `asset "${asset.id}" has no photo surface to show image "${pl.image}"`)
      }
      if (pl.label !== undefined) checkText(pl.label, pat, report, 'label')
      if (pl.description !== undefined) checkText(pl.description, pat, report, 'description')
      checkActivities(pl.activities, pat, report)
      if (pl.highlight !== undefined && typeof pl.highlight !== 'boolean') report('error', pat, 'highlight must be true or false')
    }
  }
  return true
}

// Re-exported for the activities module and the checks.
export type { ActivityKind, DecorativeImageDef, EnvironmentPreset, PromptDef, SoundDef }
