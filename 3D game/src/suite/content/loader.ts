/**
 * Loads every content pack listed in public/suite/packs/index.json: pack.json,
 * environments.json, content.json and the optional pack-local assets.json. Nothing here
 * throws for bad content — a missing or malformed file becomes a ContentProblem and the
 * pack is still returned, so a caregiver can see why it is not offered.
 */
import type {
  AssetDef,
  AssetLibrary,
  ContentPackMeta,
  ContentProblem,
  DecorativeImageDef,
  EnvironmentPreset,
  JsonLoader,
  LoadedContentPack,
  PromptDef,
  SoundDef
} from '../contracts'
import { fetchJson, suiteUrl } from '../paths'
import {
  isLocalPackPath,
  reporter,
  validateContent,
  validateEnvironments,
  validateIndex,
  validateMeta,
  type KnownShells
} from './validate'

export interface LoadContentOptions {
  /** Shell slots (the environment module's SHELLS). Without them, slots are not checked
   *  here and one warning per pack says so. */
  shells?: KnownShells
}

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

export async function loadContentPacks(
  library: AssetLibrary,
  load: JsonLoader = fetchJson,
  options: LoadContentOptions = {}
): Promise<{ packs: LoadedContentPack[]; problems: ContentProblem[] }> {
  const problems: ContentProblem[] = []
  const report = reporter(problems)
  let index: unknown
  try {
    index = await load('packs/index.json')
  } catch (e) {
    report('error', 'packs/index.json', `could not be loaded: ${message(e)}`)
    return { packs: [], problems }
  }
  if (!validateIndex(index, report)) return { packs: [], problems }

  const packs: LoadedContentPack[] = []
  for (const entry of index.packs) {
    if (typeof entry?.id !== 'string' || typeof entry.path !== 'string' || !isLocalPackPath(entry.path, '')) continue
    packs.push(await loadOne(entry.id, entry.path, library, load, options))
  }
  const firstPlain = packs.find((p) => p.meta && !p.meta.regional)
  if (packs.length > 0 && packs[0].meta.regional) {
    report('warning', 'packs/index.json', `the first pack "${packs[0].meta.id}" is regional; the default is the first non-regional pack${firstPlain ? ` ("${firstPlain.meta.id}")` : ''}`)
  }
  for (const pack of packs) problems.push(...pack.problems)
  return { packs, problems }
}

async function loadOne(
  id: string,
  metaPath: string,
  library: AssetLibrary,
  load: JsonLoader,
  options: LoadContentOptions
): Promise<LoadedContentPack> {
  const problems: ContentProblem[] = []
  const report = reporter(problems)
  const dir = metaPath.includes('/') ? metaPath.slice(0, metaPath.lastIndexOf('/') + 1) : ''
  const packRoot = `packs/${dir}`
  const baseUrl = suiteUrl(packRoot).replace(/\/?$/, '/')
  const fallbackMeta: ContentPackMeta = {
    schema: 1,
    id,
    name: { en: id },
    description: { en: '' },
    status: 'preview',
    regional: false,
    coverageNote: { en: '' },
    files: { environments: 'environments.json', content: 'content.json' },
    authors: []
  }
  const pack: LoadedContentPack = { meta: fallbackMeta, baseUrl, environments: [], prompts: [], sounds: [], images: [], assets: [], problems }

  const tryLoad = async (file: string, required: boolean): Promise<unknown> => {
    try {
      return await load(packRoot + file)
    } catch (e) {
      report(required ? 'error' : 'warning', packRoot + file, `could not be loaded: ${message(e)}`)
      return undefined
    }
  }

  const meta = await tryLoad(metaPath.slice(dir.length), true)
  if (meta === undefined) return pack
  if (!validateMeta(meta, id, `packs/${metaPath}`, report)) return pack
  pack.meta = meta
  const files = meta.files ?? fallbackMeta.files

  // Pack-local assets first, so environments and prompts can refer to them.
  if (typeof files.assets === 'string') {
    const manifest = await tryLoad(files.assets, true)
    if (manifest && typeof manifest === 'object' && Array.isArray((manifest as { assets?: unknown }).assets)) {
      const defs = (manifest as { assets: AssetDef[] }).assets
      pack.assets = defs
      problems.push(...library.addPackAssets(defs, baseUrl))
    } else if (manifest !== undefined) {
      report('error', packRoot + files.assets, 'expected { "schema": 1, "assets": [...] }')
    }
  }
  const lookup = (assetId: string): AssetDef | undefined => library.get(assetId) ?? pack.assets.find((a) => a.id === assetId)

  const content = typeof files.content === 'string' ? await tryLoad(files.content, true) : undefined
  if (content !== undefined && validateContent(content, dir, packRoot + files.content, report, lookup)) {
    pack.prompts = content.prompts as PromptDef[]
    pack.sounds = content.sounds as SoundDef[]
    pack.images = content.images as DecorativeImageDef[]
  }

  const envs = typeof files.environments === 'string' ? await tryLoad(files.environments, true) : undefined
  if (envs !== undefined) {
    const imageIds = new Set(pack.images.map((i) => i.id))
    if (validateEnvironments(envs, packRoot + files.environments, report, lookup, imageIds, options.shells)) {
      pack.environments = envs.environments as EnvironmentPreset[]
    }
  }
  if (pack.environments.length === 0 && !problems.some((p) => p.severity === 'error')) {
    report('error', packRoot + files.environments, 'the pack has no environments')
  }
  return pack
}
