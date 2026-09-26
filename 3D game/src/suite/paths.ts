import type { JsonLoader } from './contracts'

/**
 * Where the suite's packaged files live: `public/suite/`, served at `<base>suite/`.
 * Everything is same-origin and packaged with the app — no runtime hotlinks.
 */
export const SUITE_ROOT = 'suite/'

/** Absolute URL for a path relative to public/suite/. Works under node (checks) too. */
export function suiteUrl(path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  const base = typeof document === 'undefined' ? 'http://localhost/' : document.baseURI
  return new URL(SUITE_ROOT + path.replace(/^\/+/, ''), base).href
}

/** Resolves `path` against a directory URL (pack or manifest directory). */
export function resolveUnder(baseUrl: string, path: string): string {
  if (/^(https?:|data:|blob:)/i.test(path)) return path
  return new URL(path.replace(/^\/+/, ''), baseUrl).href
}

export const fetchJson: JsonLoader = async (path) => {
  const response = await fetch(suiteUrl(path))
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`)
  return response.json()
}
