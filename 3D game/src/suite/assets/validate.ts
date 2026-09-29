/**
 * Manifest validation. Pure: no DOM, no three.js rendering; checks import it directly.
 */
import type { AssetCategory, AssetDef, ContentProblem, MountKind } from '../contracts'
import { TOPICS } from '../contracts'
import { hasBuilder } from './builders'

export const CATEGORIES: readonly AssetCategory[] = [
  'photos-keepsakes', 'furniture', 'storage', 'textiles', 'kitchen-food', 'plants-outdoor',
  'music-media', 'school-work', 'travel', 'hobbies-games', 'community', 'lighting', 'decor'
]
export const MOUNTS: readonly MountKind[] = ['floor', 'wall', 'surface']

/** SPDX identifiers accepted for asset files. Anything else must be added deliberately. */
export const ACCEPTED_LICENSES = new Set(['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'OFL-1.1', 'MIT', 'Apache-2.0'])

const hasEn = (value: unknown): boolean =>
  typeof value === 'string' ? value.trim().length > 0 : !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).en === 'string' && ((value as Record<string, string>).en).trim().length > 0

/** A path that stays inside the library: relative, no scheme, no parent traversal. */
export function isLocalPath(path: string): boolean {
  if (!path || /^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//') || path.startsWith('/')) return false
  return !path.split(/[\\/]/).includes('..')
}

/**
 * Validates asset definitions. `known` holds ids already in the library (for duplicate
 * and fallback checks across the manifest and pack-local files).
 */
export function validateAssets(defs: readonly AssetDef[], file: string, known: ReadonlyMap<string, AssetDef> = new Map()): ContentProblem[] {
  const problems: ContentProblem[] = []
  const seen = new Map<string, AssetDef>(known)
  const all = new Map<string, AssetDef>(known)
  for (const def of defs) if (def && typeof def.id === 'string' && !all.has(def.id)) all.set(def.id, def)
  const error = (id: string, message: string): void => { problems.push({ severity: 'error', where: `${file}#${id}`, message }) }
  const warn = (id: string, message: string): void => { problems.push({ severity: 'warning', where: `${file}#${id}`, message }) }

  defs.forEach((def, index) => {
    const id = typeof def?.id === 'string' && def.id ? def.id : `[${index}]`
    if (!def || typeof def !== 'object') return error(id, 'not an object')
    if (typeof def.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(def.id)) error(id, 'id must be lower-case letters, digits and hyphens')
    if (seen.has(def.id) && seen.get(def.id) !== def) error(id, 'duplicate id')
    seen.set(def.id, def)
    if (!CATEGORIES.includes(def.category)) error(id, `unknown category "${String(def.category)}"`)
    if (!MOUNTS.includes(def.mount)) error(id, `unknown mount "${String(def.mount)}"`)
    const source = def.source
    if (!source || (source.kind !== 'photograph' && source.kind !== 'procedural' && source.kind !== 'gltf')) error(id, 'source.kind must be "photograph", "procedural" or "gltf"')
    else if (source.kind === 'procedural') {
      if (!hasBuilder(source.builder)) error(id, `no procedural builder "${source.builder}" in the registry`)
    } else if (source.kind === 'gltf') {
      if (!isLocalPath(source.path) || !/\.(glb|gltf)$/i.test(source.path)) error(id, `glTF path "${source.path}" must be a local .glb/.gltf`)
      const scale = source.scale ?? 1
      const axes = typeof scale === 'number' ? [scale] : Array.isArray(scale) && scale.length === 3 ? scale : []
      if (axes.length === 0 || axes.some((v) => !(typeof v === 'number' && v > 0))) error(id, 'glTF scale must be a positive number or three positive numbers')
      if (!def.fallback) error(id, 'a glTF asset needs a procedural fallback')
    }
    if (typeof def.thumbnail !== 'string' || !def.thumbnail) error(id, 'thumbnail path is required')
    else if (!isLocalPath(def.thumbnail)) error(id, 'thumbnail must be a local path')
    if (!hasEn(def.label)) error(id, 'label needs English (en)')
    if (!hasEn(def.description)) error(id, 'description needs English (en)')
    const p = def.provenance
    if (!p || typeof p !== 'object') error(id, 'provenance is required')
    else {
      if (!p.source) error(id, 'provenance.source is required')
      if (!p.author) error(id, 'provenance.author is required')
      if (!p.license || /unknown/i.test(p.license)) error(id, 'provenance.license must be a real SPDX identifier, never "unknown"')
      else if (!ACCEPTED_LICENSES.has(p.license)) error(id, `provenance.license "${p.license}" is not an accepted SPDX identifier`)
      if (p.source !== 'procedural' && p.source !== 'project-generated' && !p.retrieved) warn(id, 'external provenance should record a retrieval date')
    }
    const regions = def.tags?.regions ?? []
    if (regions.length > 0 && !(def.descriptionSources && def.descriptionSources.length > 0)) error(id, 'tags.regions requires descriptionSources')
    for (const url of def.descriptionSources ?? []) if (!/^https:\/\//.test(url)) error(id, `description source "${url}" must be an https URL`)
    for (const topic of def.tags?.topics ?? []) if (!(TOPICS as readonly string[]).includes(topic)) error(id, `unknown topic "${topic}"`)
    if (def.fallback !== undefined) {
      const fallback = all.get(def.fallback)
      if (!fallback) error(id, `fallback "${def.fallback}" does not exist`)
      else if (fallback.source?.kind !== 'procedural') error(id, `fallback "${def.fallback}" must be procedural`)
      else if (fallback.id === def.id) error(id, 'an asset cannot be its own fallback')
    }
    if (!def.budget || !(def.budget.triangles > 0) || !(def.budget.textureKB >= 0)) error(id, 'budget { triangles, textureKB } is required')
    if (!Array.isArray(def.size) || def.size.length !== 3 || def.size.some((v) => !(v > 0))) error(id, 'size must be three positive numbers')
    if (typeof def.collision !== 'boolean') error(id, 'collision must be true or false')
    if (!Array.isArray(def.activities) || def.activities.length === 0) error(id, 'activities must list at least one activity')
    if (def.photoSurface) {
      const ps = def.photoSurface
      if (!(ps.width > 0 && ps.height > 0)) error(id, 'photoSurface needs a positive width and height')
      if (!['+x', '-x', '+z', '-z', '+y'].includes(ps.facing)) error(id, 'photoSurface.facing is invalid')
    }
  })
  return problems
}
