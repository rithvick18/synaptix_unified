/**
 * The suite's strings, languages and fonts.
 *
 *   public/suite/locales/index.json              LocaleIndex: languages, namespaces, fonts
 *   public/suite/locales/<code>/<namespace>.json  nested string objects
 *
 * The active language is only ever the `initial` option or what someone chose; it is
 * never inferred from a name, a region, the browser or anything else about a person.
 * A missing string falls back to English, then to the key itself, with one console
 * warning per key. A missing namespace file is a warning, never a crash.
 */
import type { I18n, JsonLoader, LanguageCode, LanguageInfo, LoadI18n, LocaleIndex, LocalizedText } from '../contracts'
import { fetchJson, suiteUrl } from '../paths'
import { interpolate, isTree, lookup, pluralCategory, splitKey, type StringTree } from './core'

export { flattenEntries, flattenKeys, interpolate, lookup, placeholders, pluralCategory, splitKey } from './core'
export type { StringTree } from './core'

export const DEFAULT_NAMESPACES = ['common', 'setup', 'app', 'activities'] as const

const ENGLISH: LanguageInfo = {
  code: 'en', name: 'English', nativeName: 'English', script: 'Latn', dir: 'ltr', speechLang: 'en-IN',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif', translation: 'source'
}

/** Keeps only well-formed language entries; guarantees the fallback language exists. */
export function normaliseIndex(raw: unknown): LocaleIndex {
  const r: Partial<LocaleIndex> = isTree(raw) ? raw as unknown as Partial<LocaleIndex> : {}
  const namespaces = Array.isArray(r.namespaces) && r.namespaces.every(n => typeof n === 'string') && r.namespaces.length
    ? [...new Set(r.namespaces)] : [...DEFAULT_NAMESPACES]
  const statuses = ['source', 'human-reviewed', 'machine-generated-needs-review']
  const languages: LanguageInfo[] = []
  for (const l of Array.isArray(r.languages) ? r.languages : []) {
    if (!l || typeof l.code !== 'string' || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(l.code)) continue
    if (languages.some(x => x.code === l.code)) continue
    languages.push({
      ...l,
      name: typeof l.name === 'string' ? l.name : l.code,
      nativeName: typeof l.nativeName === 'string' ? l.nativeName : l.name ?? l.code,
      dir: l.dir === 'rtl' ? 'rtl' : 'ltr',
      speechLang: typeof l.speechLang === 'string' ? l.speechLang : l.code,
      fontFamily: typeof l.fontFamily === 'string' ? l.fontFamily : ENGLISH.fontFamily,
      translation: statuses.includes(l.translation) ? l.translation : 'machine-generated-needs-review'
    })
  }
  const fallback = typeof r.fallback === 'string' ? r.fallback : 'en'
  if (!languages.some(l => l.code === fallback)) languages.unshift({ ...ENGLISH, code: fallback })
  return { schema: 1, fallback, namespaces, languages }
}

export const loadI18n: LoadI18n = async (options = {}) => {
  const load: JsonLoader = options.load ?? fetchJson
  let index: LocaleIndex
  try { index = normaliseIndex(await load('locales/index.json')) }
  catch (error) {
    console.warn('[suite i18n] locales/index.json could not be read; showing keys only.', error)
    index = normaliseIndex(undefined)
  }
  const fallback = index.fallback
  const strings = new Map<LanguageCode, Record<string, StringTree>>()
  const loading = new Map<LanguageCode, Promise<void>>()
  const fonts = new Map<string, Promise<void>>()
  const warned = new Set<string>()
  const listeners = new Set<(code: LanguageCode) => void>()
  let language: LanguageCode = fallback
  let switchToken = 0

  const warnOnce = (id: string, message: string) => {
    if (warned.has(id)) return
    warned.add(id); console.warn(`[suite i18n] ${message}`)
  }
  const known = (code: LanguageCode) => index.languages.some(l => l.code === code)
  const info = (code?: LanguageCode): LanguageInfo =>
    index.languages.find(l => l.code === (code ?? language)) ?? index.languages.find(l => l.code === fallback) ?? ENGLISH

  function loadStrings(code: LanguageCode): Promise<void> {
    let pending = loading.get(code)
    if (!pending) {
      pending = (async () => {
        const files: Record<string, StringTree> = {}
        await Promise.all(index.namespaces.map(async ns => {
          try {
            const data = await load(`locales/${code}/${ns}.json`)
            if (isTree(data)) files[ns] = data
            else warnOnce(`file:${code}/${ns}`, `locales/${code}/${ns}.json is not an object; ignored.`)
          } catch {
            warnOnce(`file:${code}/${ns}`, `locales/${code}/${ns}.json is missing; its keys fall back.`)
          }
        }))
        strings.set(code, files)
      })()
      loading.set(code, pending)
    }
    return pending
  }

  function loadFonts(target: LanguageInfo): Promise<void> {
    if (typeof document === 'undefined' || typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve()
    return Promise.all((target.fontFiles ?? []).map(file => {
      let pending = fonts.get(file.path)
      if (!pending) {
        pending = (async () => {
          const face = new FontFace(file.family, `url("${suiteUrl(file.path)}") format("woff2")`,
            { weight: file.weight ?? 'normal', style: file.style ?? 'normal', display: 'swap' })
          await face.load()
          document.fonts.add(face)
        })().catch(error => {
          fonts.delete(file.path) // a later switch may retry
          console.warn(`[suite i18n] font ${file.path} could not be loaded; the fallback stack is used.`, error)
        })
        fonts.set(file.path, pending)
      }
      return pending
    })).then(() => undefined)
  }

  /** The string for `key` in `code`, choosing a plural form when `count` is given. */
  function resolve(code: LanguageCode, key: string, vars?: Record<string, string | number>): string | undefined {
    const { ns, path } = splitKey(key)
    const node = lookup(strings.get(code)?.[ns], path)
    if (typeof node === 'string') return node
    if (isTree(node)) {
      const count = vars?.count
      const category = typeof count === 'number' ? pluralCategory(count, code) : 'other'
      const form = node[category] ?? node.other
      if (typeof form === 'string') return form
    }
    return undefined
  }

  const i18n: I18n = {
    get language() { return language },
    get languages() { return index.languages },
    t(key, vars) {
      const own = resolve(language, key, vars)
      if (own !== undefined) return interpolate(own, vars, language)
      if (language !== fallback) {
        const english = resolve(fallback, key, vars)
        if (english !== undefined) {
          warnOnce(`${language}:${key}`, `"${key}" is missing in ${language}; showing ${fallback}.`)
          return interpolate(english, vars, fallback)
        }
      }
      warnOnce(`*:${key}`, `"${key}" is missing in every language; showing the key.`)
      return key
    },
    text(value: LocalizedText | undefined, fallbackText?: string) {
      return resolveText(value, language, fallback)?.text ?? fallbackText ?? ''
    },
    textLanguage(value: LocalizedText | undefined) {
      return resolveText(value, language, fallback)?.lang ?? language
    },
    info,
    async setLanguage(code) {
      if (!known(code)) { warnOnce(`lang:${code}`, `language "${code}" is not in locales/index.json; keeping ${language}.`); return }
      const token = ++switchToken
      await Promise.all([loadStrings(code), loadStrings(fallback), loadFonts(info(code))])
      if (token !== switchToken) return // a later choice superseded this one
      const changed = code !== language
      language = code
      if (!changed) return
      for (const listener of [...listeners]) {
        try { listener(code) } catch (error) { console.warn('[suite i18n] a language listener failed', error) }
      }
    },
    onChange(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    }
  }

  await loadStrings(fallback)
  const initial = options.initial
  if (initial && initial !== fallback) {
    if (known(initial)) await i18n.setLanguage(initial)
    else warnOnce(`lang:${initial}`, `initial language "${initial}" is not in locales/index.json; using ${fallback}.`)
  } else {
    await loadFonts(info(fallback))
  }
  return i18n
}

/**
 * LocalizedText resolution: a plain string is language-neutral (a caregiver's own
 * words) and is returned as is, tagged with the active language. Otherwise the active
 * language, then the fallback, then the first non-empty entry. Empty strings count as
 * absent.
 */
export function resolveText(value: LocalizedText | undefined, language: LanguageCode, fallback: LanguageCode): { text: string; lang: LanguageCode } | undefined {
  if (value === undefined || value === null) return undefined
  if (typeof value === 'string') return { text: value, lang: language }
  const pick = (code: LanguageCode) => {
    const text = value[code]
    return typeof text === 'string' && text !== '' ? { text, lang: code } : undefined
  }
  const own = pick(language) ?? pick(fallback)
  if (own) return own
  for (const [code, text] of Object.entries(value)) if (typeof text === 'string' && text !== '') return { text, lang: code }
  return undefined
}
