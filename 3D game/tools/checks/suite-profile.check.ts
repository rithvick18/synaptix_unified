/**
 * Suite personalization and localization checks, under node (no DOM).
 *
 *   node tools/suite/run-check.mjs tools/checks/suite-profile.check.ts
 *
 * Covers: suiteOf defaults and normalisation, media limits, a structuredClone round trip
 * with blobs, every locale file of every namespace present (keys, empties, placeholders,
 * JSON), t() fallback / interpolation / plurals with an injected loader, text()
 * resolution order, the vendored fonts, resolveSuiteProfile under node, and a report of
 * the longest Hindi strings.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { TOPICS } from '../../src/suite/contracts'
import type { LocaleIndex, SuiteProfile } from '../../src/suite/contracts'
import { flattenEntries, loadI18n, placeholders, resolveText } from '../../src/suite/i18n'
import { defaultSuiteProfile, resolveSuiteProfile, SUITE_LIMITS, suiteOf, validateAudioFile, validatePhotoFile } from '../../src/suite/profile'
import { newProfile, type LocalProfile, type Photo } from '../../src/LocalProfile'

const ROOT = process.env.MEMORIA_ROOT ?? process.cwd()
const SUITE = path.join(ROOT, 'public', 'suite')
let passed = 0
const failures: string[] = []
function ok(condition: unknown, label: string): void {
  if (condition) passed++
  else { failures.push(label); console.error(`  FAIL ${label}`) }
}
const section = (title: string) => console.log(`\n# ${title}`)

// Warnings are expected in places (missing keys, dropped entries); capture them.
const warnings: string[] = []
const realWarn = console.warn
function captureWarnings<T>(work: () => Promise<T>): Promise<T> {
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')) }
  return work().finally(() => { console.warn = realWarn })
}

const blob = (bytes: number, type: string) => new Blob([new Uint8Array(bytes)], { type })
const file = (bytes: number, type: string, name: string) => new File([new Uint8Array(bytes)], name, { type })
const fakePhoto = (id: string, w = 1600, h = 1200): Photo => ({
  id, original: blob(10, 'image/jpeg'), runtime: blob(8, 'image/jpeg'), thumbnail: blob(4, 'image/jpeg'), width: w, height: h, crop: { x: .5, y: .5, zoom: 1 }
})

async function main(): Promise<void> {
  // ---------------------------------------------------------------------------------------
  section('suiteOf: defaults and migration')
  const legacy = newProfile()
  legacy.name = 'Legacy'
  const before = JSON.stringify(Object.keys(legacy))
  const d = suiteOf(legacy)
  ok(JSON.stringify(d) === JSON.stringify(defaultSuiteProfile()), 'a profile saved before the suite gets the defaults')
  ok(d.version === 1 && d.language === 'en' && d.mode === 'open' && d.packId === null && d.environmentId === null, 'defaults: version 1, English, open mode, no place')
  ok(d.caregiverAssist === true && d.photos.length === 0 && d.sounds.length === 0 && d.sequence.length === 0, 'defaults: caregiver assist on, no media, empty sequence')
  ok(!('suite' in legacy) && JSON.stringify(Object.keys(legacy)) === before, 'suiteOf never mutates the profile')
  ok(JSON.stringify(suiteOf(undefined)) === JSON.stringify(defaultSuiteProfile()), 'suiteOf(undefined) gives the defaults')
  const a = suiteOf(legacy); a.topics.avoid.push('faith')
  ok(suiteOf(legacy).topics.avoid.length === 0, 'each suiteOf call returns a fresh copy')

  section('suiteOf: normalisation of bad input')
  const good = fakePhoto('p-1')
  const audio = { blob: blob(100, 'audio/mpeg'), mime: 'audio/mpeg', durationMs: 4000 }
  const messy = {
    ...newProfile(),
    suite: {
      version: 7, language: 'Klingon!!', packId: 'everyday-home', environmentId: 'living-room',
      mode: 'freestyle', caregiverAssist: 'yes',
      topics: { include: ['music', 'music', 'astrology', 'faith', 3], avoid: ['faith', 'nope'] },
      photos: [
        { id: 'a', photo: good, caption: '  Wedding  ', people: [{ name: 'Asha', relationship: 'sister' }, { name: '', relationship: '' }, 'x'], topics: ['family', 'bogus'], surface: 'frame-1' },
        { id: 'a', photo: good, caption: 'duplicate id' },
        { id: 'b', photo: { id: 'broken' }, caption: 'no blobs' },
        { id: 'c', caption: 'no photo' },
        'not an object'
      ],
      sounds: [
        { id: 's1', title: 'Rain', kind: 'thunder', audio },
        { id: 's1', title: 'dupe', kind: 'voice-message', audio },
        { id: 's2', title: 'no audio', kind: 'voice-message' },
        { id: 's3', title: '', kind: 'voice-message', audio, prompt: { text: '   ', lang: 'hi' } }
      ],
      objects: { 'everyday-home/living-room': { clock: { label: 'Grandfather clock', hidden: true, extra: 1 }, empty: { label: '' }, bad: 5 } },
      objectPrompts: { 'everyday-home/living-room/clock': { text: 'Who wound this clock?', lang: 'en' }, 'x/y/z': { text: '' } },
      sequence: [{ kind: 'photo', id: 'a' }, { kind: 'photo', id: 'a' }, { kind: 'photo', id: 'gone' }, { kind: 'sound', id: 's1' },
        { kind: 'object', id: 'living-room/clock' }, { kind: 'object', id: 'no-slash' }, { kind: 'video', id: 'v' }]
    }
  } as unknown as LocalProfile
  const n = await captureWarnings(async () => suiteOf(messy))
  ok(n.version === 1, 'version forced to 1')
  ok(n.language === 'en', 'an invalid language code falls back to English (never inferred)')
  ok(n.mode === 'open', 'an unknown mode becomes open')
  ok(n.caregiverAssist === true, 'a non-boolean caregiverAssist gets the default')
  ok(JSON.stringify(n.topics) === JSON.stringify({ include: ['music'], avoid: ['faith'] }), 'topics: unknown and duplicate dropped; a topic in both lists is avoided')
  ok(n.photos.length === 1 && n.photos[0].id === 'a', 'photos: duplicate ids and entries without usable blobs dropped')
  ok(n.photos[0].caption === '  Wedding  ', 'caption kept exactly as typed')
  ok(n.photos[0].people.length === 1 && n.photos[0].people[0].name === 'Asha', 'people: blank rows and non-objects dropped, typed rows kept')
  ok(JSON.stringify(n.photos[0].topics) === '["family"]' && n.photos[0].surface === 'frame-1', 'photo topics filtered to TOPICS; surface kept')
  ok(n.photos[0].photo.original === good.original, 'photo blobs are the same Blob objects (not copied, not re-encoded)')
  ok(n.sounds.length === 2 && n.sounds[0].kind === 'familiar-sound' && n.sounds[1].id === 's3', 'sounds: unknown kind → familiar-sound, duplicates and no-audio dropped')
  ok(n.sounds[1].title === '' && n.sounds[1].prompt === undefined, 'empty title stays empty; a whitespace-only prompt with no audio is dropped')
  ok(JSON.stringify(n.objects) === JSON.stringify({ 'everyday-home/living-room': { clock: { label: 'Grandfather clock', hidden: true } } }), 'object overrides: unknown fields and empty entries dropped')
  ok(Object.keys(n.objectPrompts).length === 1 && n.objectPrompts['everyday-home/living-room/clock'].text === 'Who wound this clock?', 'object prompts: empty prompts dropped')
  ok(JSON.stringify(n.sequence) === JSON.stringify([{ kind: 'photo', id: 'a' }, { kind: 'sound', id: 's1' }, { kind: 'object', id: 'living-room/clock' }]), 'sequence: duplicates, dangling refs, malformed object ids and unknown kinds dropped')
  ok(warnings.some(w => w.includes('photos')) && warnings.some(w => w.includes('sounds')), 'dropped media is reported with a warning, not silently')
  ok(suiteOf({ ...newProfile(), suite: { packId: null, environmentId: 'living-room' } } as unknown as LocalProfile).environmentId === null, 'an environment without a pack is cleared')
  const many = { ...newProfile(), suite: { photos: Array.from({ length: 70 }, (_, i) => ({ id: `p${i}`, photo: fakePhoto(`x${i}`), caption: '' })) } } as unknown as LocalProfile
  ok(await captureWarnings(async () => suiteOf(many).photos.length) === SUITE_LIMITS.maxPhotos, `at most ${SUITE_LIMITS.maxPhotos} photos are kept`)
  ok(TOPICS.length === 14, 'TOPICS vocabulary is the contract one')

  // ---------------------------------------------------------------------------------------
  section('media limits')
  ok(SUITE_LIMITS.maxPhotos === 60 && SUITE_LIMITS.maxSounds === 30, 'limits: 60 photos, 30 sounds')
  ok(SUITE_LIMITS.photoBytes === 25 * 1024 * 1024 && SUITE_LIMITS.audioBytes === 15 * 1024 * 1024 && SUITE_LIMITS.audioMs === 600000, 'limits: 25 MB photos, 15 MB / 10 min sounds')
  for (const [name, type] of [['a.mp3', 'audio/mpeg'], ['a.mp3', 'audio/mp3'], ['a.m4a', 'audio/x-m4a'], ['a.m4a', 'audio/mp4'], ['a.mp4', 'video/mp4'],
    ['a.wav', 'audio/wav'], ['a.wav', 'audio/x-wav'], ['a.ogg', 'audio/ogg'], ['a.webm', 'audio/webm;codecs=opus'], ['a.mp3', ''], ['a.m4a', ''], ['a.ogg', 'application/octet-stream']] as const) {
    ok(validateAudioFile(file(1000, type, name)).ok, `audio accepted: ${name} (${type || 'no type'})`)
  }
  const mimeOf = (f: File) => { const r = validateAudioFile(f); return r.ok ? r.mime : null }
  ok(mimeOf(file(10, 'audio/x-m4a', 'a.m4a')) === 'audio/mp4' && mimeOf(file(10, '', 'a.mp3')) === 'audio/mpeg', 'audio type is canonicalised')
  for (const [name, type] of [['a.flac', 'audio/flac'], ['a.txt', 'text/plain'], ['a.mid', 'audio/midi'], ['a.flac', ''], ['a.mp3', 'image/png']] as const) {
    const r = validateAudioFile(file(1000, type, name))
    ok(!r.ok && r.reason === 'unsupported-type' && r.key === 'common.media.audioType', `audio rejected: ${name} (${type || 'no type'})`)
  }
  const bigAudio = validateAudioFile(file(SUITE_LIMITS.audioBytes + 1, 'audio/mpeg', 'big.mp3'))
  ok(!bigAudio.ok && bigAudio.reason === 'too-large' && bigAudio.vars.max === 15, 'audio over 15 MB rejected')
  ok(validateAudioFile(file(SUITE_LIMITS.audioBytes, 'audio/mpeg', 'edge.mp3')).ok, 'audio of exactly 15 MB accepted')
  const long = validateAudioFile(file(100, 'audio/mpeg', 'a.mp3'), 600001)
  ok(!long.ok && long.reason === 'too-long' && long.vars.max === 10, 'audio over 10 minutes rejected')
  ok(validateAudioFile(file(100, 'audio/mpeg', 'a.mp3'), 600000).ok, 'audio of exactly 10 minutes accepted')
  const emptyAudio = validateAudioFile(file(0, 'audio/mpeg', 'a.mp3'))
  ok(!emptyAudio.ok && emptyAudio.reason === 'empty', 'empty audio rejected')
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) ok(validatePhotoFile(file(1000, type, 'p')).ok, `photo accepted: ${type}`)
  for (const type of ['image/gif', 'image/heic', 'image/svg+xml', '']) ok(!validatePhotoFile(file(1000, type, 'p')).ok, `photo rejected: ${type || 'no type'}`)
  const bigPhoto = validatePhotoFile(file(SUITE_LIMITS.photoBytes + 1, 'image/jpeg', 'p.jpg'))
  ok(!bigPhoto.ok && bigPhoto.reason === 'too-large' && bigPhoto.vars.max === 25, 'photo over 25 MB rejected')
  ok(validatePhotoFile(file(SUITE_LIMITS.photoBytes, 'image/jpeg', 'p.jpg')).ok, 'photo of exactly 25 MB accepted')

  // ---------------------------------------------------------------------------------------
  section('structuredClone round trip (as IndexedDB stores it)')
  const withSuite: LocalProfile = { ...newProfile(), name: 'Round trip', suite: n }
  const cloned = structuredClone(withSuite)
  const cs = cloned.suite as SuiteProfile
  ok(cs.photos[0].photo.original instanceof Blob && cs.photos[0].photo.original.size === 10 && cs.photos[0].photo.original.type === 'image/jpeg', 'photo original blob survives')
  ok(cs.photos[0].photo.runtime.size === 8 && cs.photos[0].photo.thumbnail.size === 4, 'runtime and thumbnail blobs survive')
  ok(cs.sounds[0].audio.blob instanceof Blob && cs.sounds[0].audio.blob.size === 100 && cs.sounds[0].audio.durationMs === 4000, 'sound blob and duration survive')
  ok(JSON.stringify(suiteOf(cloned).sequence) === JSON.stringify(n.sequence) && JSON.stringify(suiteOf(cloned).objects) === JSON.stringify(n.objects), 'a cloned suite normalises to the same settings')
  ok(new Uint8Array(await cs.sounds[0].audio.blob.arrayBuffer()).length === 100, 'cloned blob bytes are readable')

  // ---------------------------------------------------------------------------------------
  section('locale files')
  const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(SUITE, rel), 'utf8'))
  let index: LocaleIndex | undefined
  try { index = readJson('locales/index.json') as LocaleIndex; ok(true, 'locales/index.json is valid JSON') }
  catch (e) { ok(false, `locales/index.json is valid JSON (${e})`) }
  if (!index) throw new Error('no index')
  ok(index.schema === 1 && index.fallback === 'en', 'index: schema 1, fallback en')
  const en = index.languages.find(l => l.code === 'en'), hi = index.languages.find(l => l.code === 'hi')
  ok(en?.translation === 'source', 'en is the source language')
  ok(hi?.translation === 'machine-generated-needs-review', 'hi is marked machine-generated-needs-review (never "reviewed")')
  ok(hi?.speechLang === 'hi-IN' && hi.script === 'Deva' && /Devanagari/.test(hi.fontFamily), 'hi: speech tag hi-IN, Devanagari script and font stack')
  ok(index.languages.every(l => l.code === 'en' || l.code === 'hi'), 'no languages beyond en and hi are registered')
  for (const ns of ['common', 'setup', 'app', 'activities']) ok(index.namespaces.includes(ns), `namespace listed: ${ns}`)

  const forbidden = /\b(wrong|correct|incorrect|try again|you forgot|score|scored|fail|failed|well done|dementia|patient|symptom|cognitive)\b|remember\?/i
  const coverage: Record<string, string> = {}
  const pairs: { key: string; en: string; hi: string }[] = []
  for (const ns of index.namespaces) {
    const enPath = `locales/en/${ns}.json`
    if (!fs.existsSync(path.join(SUITE, enPath))) { console.log(`  (namespace ${ns}: no English file yet, skipped)`); coverage[ns] = 'absent'; continue }
    let enTree: unknown
    try { enTree = readJson(enPath); ok(true, `${enPath} is valid JSON`) } catch (e) { ok(false, `${enPath} is valid JSON (${e})`); continue }
    const enEntries = flattenEntries(enTree)
    ok(enEntries.length > 0, `${enPath} has strings`)
    ok(enEntries.every(([, v]) => typeof v === 'string'), `${enPath}: every leaf is a string`)
    ok(enEntries.every(([, v]) => typeof v === 'string' && v.trim() !== ''), `${enPath}: no empty strings`)
    if (ns === 'common' || ns === 'setup') {
      const bad = enEntries.filter(([k, v]) => typeof v === 'string' && forbidden.test(v) && k !== 'brand.name')
      ok(bad.length === 0, `${enPath}: no test-like or clinical wording${bad.length ? ` (${bad.map(b => b[0]).join(', ')})` : ''}`)
    }
    for (const lang of index.languages.filter(l => l.code !== 'en')) {
      const rel = `locales/${lang.code}/${ns}.json`
      if (!fs.existsSync(path.join(SUITE, rel))) { ok(false, `${rel} exists`); coverage[`${ns}/${lang.code}`] = '0%'; continue }
      let tree: unknown
      try { tree = readJson(rel); ok(true, `${rel} is valid JSON`) } catch (e) { ok(false, `${rel} is valid JSON (${e})`); continue }
      const entries = new Map(flattenEntries(tree))
      const missing = enEntries.filter(([k]) => !entries.has(k)).map(([k]) => k)
      const extra = [...entries.keys()].filter(k => !enEntries.some(([ek]) => ek === k))
      const present = enEntries.length - missing.length
      coverage[`${ns}/${lang.code}`] = `${present}/${enEntries.length} (${(100 * present / enEntries.length).toFixed(1)}%)`
      ok(missing.length === 0, `${rel}: every en key present${missing.length ? ` (missing ${missing.length}: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''})` : ''}`)
      ok(extra.length === 0, `${rel}: no keys that en lacks${extra.length ? ` (${extra.slice(0, 8).join(', ')})` : ''}`)
      const empties = [...entries].filter(([, v]) => typeof v !== 'string' || v.trim() === '').map(([k]) => k)
      ok(empties.length === 0, `${rel}: no empty strings${empties.length ? ` (${empties.slice(0, 8).join(', ')})` : ''}`)
      const mismatched: string[] = []
      for (const [k, v] of enEntries) {
        const other = entries.get(k)
        if (typeof v !== 'string' || typeof other !== 'string') continue
        if (placeholders(v).join() !== placeholders(other).join()) mismatched.push(k)
        if (lang.code === 'hi') pairs.push({ key: `${ns}.${k}`, en: v, hi: other })
      }
      ok(mismatched.length === 0, `${rel}: {placeholders} match en${mismatched.length ? ` (${mismatched.slice(0, 8).join(', ')})` : ''}`)
      const recorded = lang.coverage?.[ns]
      if (recorded !== undefined) ok(Math.abs(recorded - present / enEntries.length) < 1e-9, `${lang.code}: coverage recorded in index.json for ${ns} matches (${recorded})`)
    }
  }
  const untranslated = pairs.filter(p => p.en === p.hi && /[A-Za-z]{3}/.test(p.en.replace(/\{[^}]+\}/g, '')))
  console.log(`\n  coverage (hi vs en keys): ${Object.entries(coverage).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
  console.log(`  hi strings identical to en (may be fine for codes like "OK" or format strings): ${untranslated.length}${untranslated.length ? ` (${untranslated.slice(0, 10).map(p => p.key).join(', ')})` : ''}`)

  // ---------------------------------------------------------------------------------------
  section('t(): fallback, interpolation, plurals (injected loader)')
  const fake: Record<string, unknown> = {
    'locales/index.json': { schema: 1, fallback: 'en', namespaces: ['common', 'app', 'gone'], languages: [
      { code: 'en', name: 'English', nativeName: 'English', script: 'Latn', dir: 'ltr', speechLang: 'en-IN', fontFamily: 'sans-serif', translation: 'source' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Deva', dir: 'ltr', speechLang: 'hi-IN', fontFamily: 'sans-serif', translation: 'machine-generated-needs-review',
        fontFiles: [{ family: 'X', path: 'fonts/none.woff2' }] }
    ] },
    'locales/en/common.json': { hello: 'Hello, {name}', only: 'English only', photos: { one: '{count} photo', other: '{count} photos' }, keep: 'Hi {name} {missing}' },
    'locales/hi/common.json': { hello: 'नमस्ते, {name}', photos: { one: '{count} तस्वीर', other: '{count} तस्वीरें' } },
    'locales/en/app.json': { home: { title: 'Home' } },
    'locales/hi/app.json': { home: { title: 'घर' } }
  }
  const loader = async (p: string) => { if (!(p in fake)) throw new Error(`404 ${p}`); return structuredClone(fake[p]) }
  warnings.length = 0
  const i18n = await captureWarnings(() => loadI18n({ load: loader }))
  ok(i18n.language === 'en', 'no initial option → English (nothing inferred)')
  ok(warnings.filter(w => w.includes('gone.json')).length === 1, 'a missing namespace file is one warning, not a crash')
  ok(i18n.t('common.hello', { name: 'Asha' }) === 'Hello, Asha', 'interpolation')
  ok(i18n.t('common.keep', { name: 'A' }) === 'Hi A {missing}', 'an unfilled placeholder stays visible')
  ok(i18n.t('app.home.title') === 'Home', 'nested keys: namespace + path')
  ok(i18n.t('common.photos', { count: 1 }) === '1 photo' && i18n.t('common.photos', { count: 3 }) === '3 photos' && i18n.t('common.photos', { count: 0 }) === '0 photos', 'English plurals (Intl.PluralRules)')
  ok(i18n.t('common.photos', { count: 1200 }) === '1,200 photos', 'numbers are formatted for the language')
  ok(i18n.t('common.photos') === '{count} photos', 'a plural key without a count uses "other"')
  const changes: string[] = []
  const off = i18n.onChange(code => changes.push(code))
  warnings.length = 0
  await captureWarnings(() => i18n.setLanguage('hi'))
  ok(i18n.language === 'hi' && changes.join() === 'hi', 'setLanguage switches and notifies once')
  ok(i18n.info().speechLang === 'hi-IN' && i18n.info('en').code === 'en', 'info() for active and named language')
  ok(!warnings.some(w => /font/i.test(w)), 'font loading is skipped under node without a warning')
  ok(warnings.filter(w => w.includes('hi/gone.json')).length === 1, 'the missing hi namespace is one warning')
  ok(i18n.t('common.hello', { name: 'Asha' }) === 'नमस्ते, Asha', 'Hindi string with interpolation')
  ok(i18n.t('common.photos', { count: 0 }) === '0 तस्वीर' && i18n.t('common.photos', { count: 1 }) === '1 तस्वीर' && i18n.t('common.photos', { count: 5 }) === '5 तस्वीरें', 'Hindi plurals follow hi rules (0 and 1 are "one")')
  warnings.length = 0
  const fb = await captureWarnings(async () => [i18n.t('common.only'), i18n.t('common.only'), i18n.t('common.nothing.here'), i18n.t('common.nothing.here')])
  ok(fb[0] === 'English only' && fb[1] === 'English only', 'missing in hi → English')
  ok(fb[2] === 'common.nothing.here', 'missing everywhere → the key itself')
  ok(warnings.length === 2, `one console.warn per missing key (got ${warnings.length})`)
  warnings.length = 0
  await captureWarnings(() => i18n.setLanguage('xx'))
  ok(i18n.language === 'hi' && warnings.length === 1 && changes.length === 1, 'an unknown language is refused with a warning; no change event')
  off()
  await captureWarnings(() => i18n.setLanguage('en'))
  ok(changes.length === 1, 'onChange unsubscribe works')
  const i18nHi = await captureWarnings(() => loadI18n({ load: loader, initial: 'hi' }))
  ok(i18nHi.language === 'hi' && i18nHi.t('app.home.title') === 'घर', 'initial option selects the language')
  const broken = await captureWarnings(() => loadI18n({ load: async () => { throw new Error('offline') } }))
  const brokenKey = await captureWarnings(async () => broken.t('common.x'))
  ok(broken.language === 'en' && brokenKey === 'common.x' && broken.languages.length === 1, 'an unreadable index still gives a working (key-only) English i18n')

  section('text() and textLanguage() resolution order')
  const t2 = await captureWarnings(() => loadI18n({ load: loader, initial: 'hi' }))
  ok(t2.text({ en: 'Clock', hi: 'घड़ी' }) === 'घड़ी' && t2.textLanguage({ en: 'Clock', hi: 'घड़ी' }) === 'hi', 'active language first')
  ok(t2.text({ en: 'Clock' }) === 'Clock' && t2.textLanguage({ en: 'Clock' }) === 'en', 'then English')
  ok(t2.text({ en: '', hi: '' , as: 'ঘড়ী' }) === 'ঘড়ী' && t2.textLanguage({ as: 'ঘড়ী' }) === 'as', 'then the first non-empty entry (empty strings count as absent)')
  ok(t2.text('Asha’s words') === 'Asha’s words' && t2.textLanguage('Asha’s words') === 'hi', 'a plain string is returned as typed, tagged with the active language')
  ok(t2.text(undefined, 'fallback') === 'fallback' && t2.text({}, 'fb') === 'fb' && t2.text(undefined) === '', 'undefined/empty → the given fallback, else empty')
  ok(resolveText({ hi: 'x' }, 'en', 'en')?.lang === 'hi', 'resolveText helper agrees')

  section('real locale files through loadI18n')
  const diskLoader = async (p: string) => JSON.parse(fs.readFileSync(path.join(SUITE, p), 'utf8'))
  const real = await captureWarnings(() => loadI18n({ load: diskLoader, initial: 'hi' }))
  ok(real.t('common.disclaimer').includes('चिकित्सा उपचार नहीं'), 'Hindi disclaimer loads from disk')
  ok(real.t('setup.objects.count', { count: 3 }).includes('3'), 'a real plural key resolves')
  const enReal = await captureWarnings(() => loadI18n({ load: diskLoader }))
  const disclaimer = enReal.t('common.disclaimer')
  ok(/not a medical treatment/.test(disclaimer) && /does not assess memory or health/.test(disclaimer), 'English disclaimer says it is not a treatment and assesses nothing')

  // ---------------------------------------------------------------------------------------
  section('fonts')
  const fontFiles = index.languages.flatMap(l => l.fontFiles ?? [])
  ok(fontFiles.length >= 1, 'the index references at least one font file')
  let fontBytes = 0
  for (const f of fontFiles) {
    const p = path.join(SUITE, f.path)
    const exists = fs.existsSync(p)
    ok(exists, `font exists: ${f.path}`)
    if (!exists) continue
    const bytes = fs.readFileSync(p)
    fontBytes += bytes.length
    ok(bytes.subarray(0, 4).toString('latin1') === 'wOF2', `font is woff2 (magic wOF2): ${f.path}`)
  }
  ok(fontBytes > 0 && fontBytes <= 400 * 1024, `fonts total ${(fontBytes / 1024).toFixed(0)} KB (≤ 400 KB)`)
  const vendored = fs.readdirSync(path.join(SUITE, 'fonts')).filter(f => f.endsWith('.woff2'))
  ok(vendored.every(f => fontFiles.some(ff => ff.path === `fonts/${f}`)), 'every vendored woff2 is referenced by the index')
  ok(fs.existsSync(path.join(SUITE, 'fonts', 'OFL.txt')) && /Open Font License/.test(fs.readFileSync(path.join(SUITE, 'fonts', 'OFL.txt'), 'utf8')), 'OFL.txt is present')
  const attribution = fs.existsSync(path.join(SUITE, 'fonts', 'ATTRIBUTION.md')) ? fs.readFileSync(path.join(SUITE, 'fonts', 'ATTRIBUTION.md'), 'utf8') : ''
  ok(/OFL-1\.1/.test(attribution) && /Retrieved \| \d{4}-\d{2}-\d{2}/.test(attribution) && /https:\/\//.test(attribution), 'ATTRIBUTION.md gives licence, source URL and retrieval date')

  // ---------------------------------------------------------------------------------------
  section('resolveSuiteProfile under node')
  const home: LocalProfile = { ...newProfile(), name: 'Home test', caption: 'Diwali 1998, typed by caregiver',
    wall: fakePhoto('wall'), event: fakePhoto('event', 800, 1200),
    people: [{ id: 'per1', name: 'Ravi', relationship: 'son', photo: fakePhoto('portrait', 600, 600) }, { id: 'per2', name: 'No photo', relationship: 'friend' }],
    suite: { ...defaultSuiteProfile(), language: 'hi', photos: [{ id: 'sp', photo: fakePhoto('suite-photo'), caption: '', people: [], prompt: { text: 'Tell us?', lang: 'en', audio } }],
      sounds: [{ id: 'snd', title: 'Rain', kind: 'familiar-sound', audio }],
      objectPrompts: { 'everyday-home/living-room/clock': { text: '', lang: 'en', audio } },
      objects: { 'everyday-home/living-room': { clock: { hidden: true } } } }
  }
  const { resolved, media } = await resolveSuiteProfile(home, real, 4096)
  ok(resolved.photos.length === 4, 'suite photo + portrait + wall + event (a person without a photo adds nothing)')
  const [sp, portrait, wall, event] = resolved.photos
  ok(sp.caption === '' && sp.people.length === 0, 'an empty caption stays empty; no people invented')
  ok(sp.prompt?.source === 'caregiver' && sp.prompt.text === 'Tell us?' && sp.prompt.lang === 'en' && /^blob:/.test(sp.prompt.audioUrl ?? ''), 'caregiver prompt with its own language and an audio object URL')
  ok(portrait.people.length === 1 && portrait.people[0].name === 'Ravi' && portrait.people[0].relationship === 'son' && portrait.caption === '', 'portrait: typed name and relationship only')
  ok(wall.caption === '' && wall.people.length === 0 && event.caption === 'Diwali 1998, typed by caregiver', 'wall: nothing added; event: the typed caption')
  ok(event.width === 800 && event.height === 1200, 'true dimensions (aspect kept)')
  ok(resolved.photos.every(p => p.personal && /^blob:/.test(p.url) && /^blob:/.test(p.thumbUrl) && /^blob:/.test(p.originalUrl ?? '')), 'object URLs for runtime, thumbnail and original')
  ok(resolved.sounds.length === 1 && resolved.sounds[0].durationMs === 4000 && !resolved.sounds[0].synthesized && /^blob:/.test(resolved.sounds[0].url), 'sounds with object URLs')
  ok(resolved.objectOverrides('everyday-home', 'living-room').clock?.hidden === true && Object.keys(resolved.objectOverrides('x', 'y')).length === 0, 'objectOverrides')
  const op = resolved.objectPrompt('everyday-home', 'living-room', 'clock')
  ok(op?.text === '' && /^blob:/.test(op.audioUrl ?? '') && resolved.objectPrompt('everyday-home', 'living-room', 'none') === null, 'objectPrompt: audio-only prompt kept, empty text not filled in')
  ok(resolved.language === 'hi' && resolved.name === 'Home test', 'language and name from the profile')
  const tex = await sp.texture()
  ok(tex === null, 'texture() resolves null (never throws) where decoding is unavailable')
  const urls = [...resolved.photos.flatMap(p => [p.url, p.thumbUrl, p.originalUrl!]), resolved.sounds[0].url]
  ok((await (await fetch(urls[0])).arrayBuffer()).byteLength === 8, 'object URLs are live before dispose()')
  media.dispose()
  const revoked = await Promise.all(urls.map(async u => { try { await fetch(u); return false } catch { return true } }))
  ok(revoked.every(Boolean), 'dispose() revokes every object URL')

  // ---------------------------------------------------------------------------------------
  section('long-text report (hi vs en)')
  const withRatio = pairs.map(p => ({ ...p, ratio: p.hi.length / Math.max(1, p.en.length) }))
  const longest = [...withRatio].sort((x, y) => y.hi.length - x.hi.length).slice(0, 5)
  const widest = [...withRatio].filter(p => p.en.length >= 12).sort((x, y) => y.ratio - x.ratio).slice(0, 5)
  console.log('  longest hi strings (chars hi / en):')
  for (const p of longest) console.log(`    ${p.hi.length} / ${p.en.length}  ${p.key}`)
  console.log('  largest hi/en length ratios (en ≥ 12 chars):')
  for (const p of widest) console.log(`    ×${p.ratio.toFixed(2)}  ${p.key}  (${p.hi.length} / ${p.en.length})`)
  const avg = withRatio.reduce((s, p) => s + p.ratio, 0) / Math.max(1, withRatio.length)
  console.log(`  mean ratio over ${withRatio.length} strings: ×${avg.toFixed(2)}`)

  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { console.error(`\nFailures:\n${failures.map(f => `  - ${f}`).join('\n')}`); process.exitCode = 1 }
}

main().catch(error => { console.error(error); process.exitCode = 1 })
