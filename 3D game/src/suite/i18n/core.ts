/**
 * Pure string helpers for the suite's i18n: no DOM, no fetch, importable by node checks.
 *
 * String files are nested JSON objects. `t('app.home.title')` reads namespace `app`
 * (public/suite/locales/<code>/app.json) at the path `home.title`.
 */

/** A namespace file: nested objects whose leaves are strings. */
export interface StringTree { [key: string]: string | StringTree }

export function isTree(value: unknown): value is StringTree {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Splits `ns.path.to.key` into the namespace and the path inside it. */
export function splitKey(key: string): { ns: string; path: string } {
  const dot = key.indexOf('.')
  return dot < 0 ? { ns: key, path: '' } : { ns: key.slice(0, dot), path: key.slice(dot + 1) }
}

/** Walks `path` (dot separated) through a tree. Returns the string or subtree found. */
export function lookup(tree: StringTree | undefined, path: string): string | StringTree | undefined {
  let node: string | StringTree | undefined = tree
  if (!path) return node
  for (const part of path.split('.')) {
    if (!isTree(node)) return undefined
    node = node[part]
  }
  return node
}

/** Every leaf key of a tree, dot separated, sorted. Non-string leaves are reported too. */
export function flattenKeys(tree: unknown, prefix = ''): string[] {
  if (!isTree(tree)) return prefix ? [prefix] : []
  const keys: string[] = []
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (isTree(v)) keys.push(...flattenKeys(v, path))
    else keys.push(path)
  }
  return keys.sort()
}

/** Every leaf as [key, value]. */
export function flattenEntries(tree: unknown, prefix = ''): [string, unknown][] {
  if (!isTree(tree)) return []
  const out: [string, unknown][] = []
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (isTree(v)) out.push(...flattenEntries(v, path))
    else out.push([path, v])
  }
  return out
}

const PLACEHOLDER = /\{([A-Za-z0-9_]+)\}/g

/** The distinct `{name}` placeholders in a string, sorted. */
export function placeholders(text: string): string[] {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(m => m[1]))].sort()
}

/** Fills `{name}` from `vars`. Unknown placeholders are left as written, so a missing
 *  variable is visible rather than silently blank. */
export function interpolate(text: string, vars: Record<string, string | number> | undefined, locale: string): string {
  if (!vars) return text
  return text.replace(PLACEHOLDER, (whole, name: string) => {
    if (!Object.hasOwn(vars, name)) return whole
    const value = vars[name]
    return typeof value === 'number' ? formatNumber(value, locale) : value
  })
}

function formatNumber(value: number, locale: string): string {
  try { return new Intl.NumberFormat(locale).format(value) } catch { return String(value) }
}

/** The plural category Intl.PluralRules gives `count` in `locale` ('one', 'other', …). */
export function pluralCategory(count: number, locale: string): string {
  try { return new Intl.PluralRules(locale).select(count) } catch { return count === 1 ? 'one' : 'other' }
}
