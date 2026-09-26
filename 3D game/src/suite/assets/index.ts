/**
 * The suite's asset library: public/suite/assets/manifest.json plus any pack-local
 * assets.json. See docs/suite/assets.md.
 */
import type { AssetDef, AssetLibrary, AssetManifest, ContentProblem, JsonLoader, LoadAssetLibrary } from '../contracts'
import { fetchJson, resolveUnder, suiteUrl } from '../paths'
import { validateAssets } from './validate'

export { BUILDERS, hasBuilder } from './builders'
export { validateAssets, isLocalPath } from './validate'

export const MANIFEST_PATH = 'assets/manifest.json'

class Library implements AssetLibrary {
  private defs = new Map<string, AssetDef>()
  private bases = new Map<string, string>()
  problems: ContentProblem[] = []

  constructor(private base: string) {}

  get(id: string): AssetDef | undefined {
    return this.defs.get(id)
  }

  all(): readonly AssetDef[] {
    return [...this.defs.values()]
  }

  /** The directory URL an asset's relative paths resolve against. */
  baseOf(id: string): string {
    return this.bases.get(id) ?? this.base
  }

  url(path: string, base?: string): string {
    return resolveUnder(base ?? this.base, path)
  }

  add(defs: readonly AssetDef[], base: string, file: string): ContentProblem[] {
    const problems = validateAssets(defs, file, this.defs)
    for (const def of defs) {
      if (!def || typeof def.id !== 'string') continue
      // A duplicate id never replaces an asset already in the library.
      if (this.defs.has(def.id)) continue
      this.defs.set(def.id, def)
      this.bases.set(def.id, base)
    }
    this.problems.push(...problems)
    return problems
  }

  addPackAssets(defs: AssetDef[], base: string): ContentProblem[] {
    const file = resolveUnder(base, 'assets.json').replace(/^.*\/suite\//, '')
    return this.add(Array.isArray(defs) ? defs : [], base.endsWith('/') ? base : base + '/', file)
  }
}

/** Builds a library from an already-parsed manifest (checks and tools use this). */
export function createAssetLibrary(manifest: AssetManifest, base = suiteUrl('assets/')): AssetLibrary & { baseOf(id: string): string } {
  const library = new Library(base)
  if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.assets)) {
    library.problems.push({ severity: 'error', where: MANIFEST_PATH, message: 'manifest must be { schema: 1, assets: [...] }' })
    return library
  }
  library.add(manifest.assets, base, MANIFEST_PATH)
  return library
}

export const loadAssetLibrary: LoadAssetLibrary = async (load: JsonLoader = fetchJson) => {
  let manifest: AssetManifest
  try {
    manifest = (await load(MANIFEST_PATH)) as AssetManifest
  } catch (error) {
    const library = new Library(suiteUrl('assets/'))
    library.problems.push({ severity: 'error', where: MANIFEST_PATH, message: `could not load: ${String(error)}` })
    return library
  }
  return createAssetLibrary(manifest)
}
