/**
 * Headless checks for the suite's content packs and activities (no DOM, no browser).
 *
 *   node tools/suite/run-check.mjs tools/checks/suite-activities.check.ts
 *
 * Covers: both packs' content.json, the sound and picture files, English and Hindi text,
 * a banned-word scan, activity availability, prompt selection and avoid-lists, the
 * activity session's lifecycle, its camera surface, telemetry, photo assignment and
 * failing audio. Reads files from process.env.MEMORIA_ROOT.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as THREE from 'three'
import { ACTIVITY_KINDS } from '../../src/suite/contracts'
import type {
  ActivityContext,
  AssetCategory,
  AssetDef,
  AssetLibrary,
  ContentProblem,
  DisplayPhoto,
  DisplaySound,
  I18n,
  JsonLoader,
  LoadedContentPack,
  MountKind,
  PackContent,
  ResolvedPrompt,
  ResolvedSuiteProfile,
  SceneObject,
  SuiteAudioApi,
  SuiteScene,
  SuiteTelemetryPort
} from '../../src/suite/contracts'
import { ASSET_CATEGORIES, loadContentPacks, packDisplayMedia, validateContent } from '../../src/suite/content'
import { ACTIVITIES, assignPhotos, createActivitySession, gentleCueShown } from '../../src/suite/activities'

const ROOT = process.env.MEMORIA_ROOT ?? process.cwd()
const SUITE = path.join(ROOT, 'public', 'suite')

let checks = 0
const failures: string[] = []
function ok(condition: unknown, label: string): void {
  checks++
  if (!condition) failures.push(label)
}
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const readJson = (rel: string): unknown => JSON.parse(fs.readFileSync(path.join(SUITE, rel), 'utf8'))
const diskLoader: JsonLoader = async (rel) => readJson(rel)

// ---------------------------------------------------------------------------------------
// Fakes
// ---------------------------------------------------------------------------------------

/** The PLAN.md asset table (used when the real manifest is not there yet). */
const PLAN_ASSETS: Record<AssetCategory, string[]> = {
  'photos-keepsakes': ['frame-wall-large', 'frame-wall-small', 'frame-table', 'photo-album', 'letters-bundle', 'calendar-wall', 'clock-wall', 'clock-table'],
  furniture: ['sofa-wood', 'armchair-cane', 'chair-wood', 'chair-plastic', 'stool-low', 'dining-table', 'coffee-table', 'side-table', 'bookshelf', 'wall-shelf', 'bench-veranda'],
  storage: ['almirah-steel', 'cupboard-wood', 'trunk-tin', 'kitchen-rack', 'bamboo-basket'],
  textiles: ['rug-durrie', 'floor-mat-woven', 'cushion-set', 'table-cloth', 'gamosa'],
  'kitchen-food': ['pressure-cooker', 'steel-tumbler-set', 'steel-plate', 'tiffin-carrier', 'spice-box', 'rolling-board-pin', 'kadai', 'tawa', 'clay-water-pot', 'brass-vessel', 'kettle', 'jar-pickle', 'gas-stove', 'mortar-pestle', 'xorai'],
  'plants-outdoor': ['potted-plant-large', 'potted-plant-small', 'hanging-plant', 'flower-pots-row', 'bucket-mug', 'clothesline'],
  'music-media': ['radio-transistor', 'radio-valve', 'cassette-player', 'harmonium', 'television-crt'],
  'school-work': ['books-stack', 'school-slate', 'school-bag', 'sewing-machine', 'typewriter', 'ledger-pen'],
  travel: ['suitcase-old', 'bicycle', 'umbrella'],
  'hobbies-games': ['carrom-board', 'chess-set', 'cricket-bat-ball', 'kite-spool', 'knitting-basket'],
  community: ['newspaper-folded'],
  lighting: ['ceiling-fan', 'table-lamp', 'hurricane-lantern'],
  decor: ['wall-mirror', 'vase-flowers', 'jaapi']
}

function planAsset(id: string, category: AssetCategory): AssetDef {
  const wall = /^(frame-wall|calendar|clock-wall|wall-|ceiling)/.test(id)
  const mount: MountKind = wall ? 'wall' : 'floor'
  return {
    id,
    category,
    mount,
    source: { kind: 'procedural', builder: id },
    thumbnail: `thumbs/${id}.webp`,
    label: { en: id },
    description: { en: id },
    size: [0.5, 0.5, 0.5],
    collision: false,
    activities: ['object', 'space', 'sequence'],
    provenance: { source: 'procedural', author: 'check', license: 'CC0-1.0' },
    budget: { triangles: 100, textureKB: 0 }
  }
}

function fakeLibrary(): AssetLibrary {
  const defs = new Map<string, AssetDef>()
  const manifest = path.join(SUITE, 'assets', 'manifest.json')
  if (fs.existsSync(manifest)) {
    for (const a of (JSON.parse(fs.readFileSync(manifest, 'utf8')) as { assets: AssetDef[] }).assets) defs.set(a.id, a)
  }
  if (defs.size === 0) for (const [cat, ids] of Object.entries(PLAN_ASSETS)) for (const id of ids) defs.set(id, planAsset(id, cat as AssetCategory))
  return {
    get: (id) => defs.get(id),
    all: () => [...defs.values()],
    url: (p, base) => new URL(p, base ?? 'http://localhost/suite/assets/').href,
    addPackAssets(list) {
      for (const a of list) defs.set(a.id, a)
      return []
    },
    problems: []
  }
}

type Strings = Record<string, unknown>
function makeI18n(language: 'en' | 'hi' = 'en'): I18n {
  const strings: Record<string, Strings> = { activities: readJson(`locales/${language}/activities.json`) as Strings }
  const english: Record<string, Strings> = { activities: readJson('locales/en/activities.json') as Strings }
  const find = (table: Record<string, Strings>, key: string): string | undefined => {
    const [ns, ...rest] = key.split('.')
    let v: unknown = table[ns]
    for (const r of rest) v = (v as Strings | undefined)?.[r]
    return typeof v === 'string' ? v : undefined
  }
  return {
    language,
    languages: [],
    t: (key, vars) => (find(strings, key) ?? find(english, key) ?? key).replace(/\{(\w+)\}/g, (m, k) => String(vars?.[k] ?? m)),
    text: (v, fallback = '') => (v === undefined ? fallback : typeof v === 'string' ? v : v[language] ?? v.en ?? Object.values(v)[0] ?? fallback),
    textLanguage: (v) => (v && typeof v === 'object' && v[language] ? language : 'en'),
    info: () => ({ code: language, name: language, nativeName: language, script: 'Latn', dir: 'ltr', speechLang: language, fontFamily: 'sans-serif', translation: 'source' }),
    setLanguage: async () => {},
    onChange: () => () => {}
  }
}

const surface = { width: 0.4, height: 0.3, show() {}, blank() {}, reset() {} }
function obj(id: string, assetId: string, category: AssetCategory, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id,
    assetId,
    category,
    label: `Label ${id}`,
    description: '',
    object: new THREE.Object3D(),
    focus: new THREE.Vector3(),
    viewpoint: { position: new THREE.Vector3(), target: new THREE.Vector3() },
    activities: ['object', 'space', 'sequence'],
    photoSurface: null,
    personal: false,
    highlight: false,
    topics: [],
    ...extra
  }
}

function fakeScene(): SuiteScene {
  const objects: SceneObject[] = [
    obj('clock', 'clock-wall', 'photos-keepsakes', { highlight: true, soundId: 'snd-wall-clock', topics: ['home'] }),
    obj('album', 'photo-album', 'photos-keepsakes', { photoSurface: surface, activities: ['photo', 'object'] }),
    obj('frame-a', 'frame-wall-large', 'photos-keepsakes', { photoSurface: surface, imageId: 'pic-river-dusk', highlight: true, activities: ['photo', 'object', 'space'] }),
    obj('cooker', 'pressure-cooker', 'kitchen-food', { highlight: true, soundId: 'snd-pressure-cooker', topics: ['food'] }),
    obj('frame-b', 'frame-table', 'photos-keepsakes', { photoSurface: surface, activities: ['photo', 'object'] }),
    obj('radio', 'radio-transistor', 'music-media', { topics: ['music'] }),
    obj('carrom', 'carrom-board', 'hobbies-games', { highlight: true, topics: ['games'] }),
    obj('kite', 'kite-spool', 'hobbies-games', { topics: ['games', 'festivals'] }),
    obj('stool', 'stool-low', 'furniture', { activities: ['space'] })
  ]
  return {
    packId: 'everyday-home',
    environmentId: 'living-room',
    shell: 'livingRoom',
    root: new THREE.Group(),
    blockers: [],
    walkable: new THREE.Box3(),
    spawn: { position: new THREE.Vector3(), yaw: 0 },
    seat: { position: new THREE.Vector3(), target: new THREE.Vector3() },
    objects,
    audioAnchor: new THREE.Object3D(),
    report: { packId: 'everyday-home', environmentId: 'living-room', objectCount: objects.length, missingAssets: [], fallbacksUsed: [], unknownSlots: [], rejectedPlacements: [], triangles: 0, meshes: 0, textureKB: 0, buildMs: 0 },
    relabel() {},
    dispose() {}
  }
}

type AudioMode = 'speech' | 'text-only' | 'reject' | 'throw'
function fakeAudio() {
  const calls: string[] = []
  const prompts: ResolvedPrompt[] = []
  const state = { mode: 'speech' as AudioMode }
  const audio: SuiteAudioApi = {
    playPrompt(p) {
      calls.push('playPrompt')
      prompts.push(p)
      if (state.mode === 'throw') throw new Error('no audio')
      if (state.mode === 'reject') return Promise.reject(new Error('blocked'))
      return Promise.resolve(state.mode === 'text-only' ? 'text-only' : 'speech')
    },
    playSound: async () => {
      calls.push('playSound')
      return true
    },
    stop: (c) => void calls.push(`stop:${c ?? 'all'}`),
    pause: () => void calls.push('pause'),
    resume: () => void calls.push('resume'),
    playing: { voice: false, sounds: false },
    setVolume() {},
    setMuted() {},
    setSpeechEnabled() {},
    speechAvailable: () => true,
    onChange: () => () => {},
    dispose() {}
  }
  return { audio, calls, prompts, state }
}

function fakeTelemetry() {
  const calls: string[] = []
  const telemetry: SuiteTelemetryPort = {
    missionStart: (id) => void calls.push(`missionStart:${id}`),
    missionComplete: (id) => void calls.push(`missionComplete:${id}`),
    stepStart: (s, type) => void calls.push(`stepStart:${s}:${type}`),
    stepEnd: (s, type, outcome) => void calls.push(`stepEnd:${s}:${type}:${outcome}`),
    pause: () => void calls.push('pause'),
    resume: () => void calls.push('resume')
  }
  return { telemetry, calls }
}

function personalPhoto(id: string, extra: Partial<DisplayPhoto> = {}): DisplayPhoto {
  return {
    id,
    url: `blob:${id}`,
    thumbUrl: `blob:${id}-t`,
    width: 800,
    height: 600,
    caption: `Caption ${id}`,
    people: [],
    personal: true,
    prompt: null,
    topics: [],
    texture: async () => null,
    ...extra
  }
}

function profile(extra: Partial<ResolvedSuiteProfile> = {}): ResolvedSuiteProfile {
  return {
    id: 'p1',
    name: 'Test',
    language: 'en',
    mode: 'open',
    packId: 'everyday-home',
    environmentId: 'living-room',
    topics: { include: [], avoid: [] },
    sequence: [],
    caregiverAssist: true,
    photos: [],
    sounds: [],
    objectOverrides: () => ({}),
    objectPrompt: () => null,
    ...extra
  }
}

// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const library = fakeLibrary()
  const { packs, problems } = await loadContentPacks(library, diskLoader)
  ok(packs.length === 2, 'loader: both packs are loaded')
  const byId = (id: string): LoadedContentPack => packs.find((p) => p.meta.id === id) as LoadedContentPack
  const everyday = byId('everyday-home')
  const northeast = byId('northeast-home')
  ok(everyday && northeast, 'loader: pack ids')

  // --- content.json validation
  for (const pack of packs) {
    const contentProblems = problems.filter((p) => p.where.includes(`${pack.meta.id}/content.json`))
    ok(!contentProblems.some((p) => p.severity === 'error'), `${pack.meta.id}: content.json has no errors ${JSON.stringify(contentProblems.filter((p) => p.severity === 'error').slice(0, 3))}`)
    const direct: ContentProblem[] = []
    const raw = readJson(`packs/${pack.meta.id}/content.json`) as PackContent
    validateContent(raw, `${pack.meta.id}/`, 'content.json', (severity, where, message) => direct.push({ severity, where, message }), (id) => library.get(id))
    ok(direct.length === 0, `${pack.meta.id}: content.json validates with no errors or warnings ${JSON.stringify(direct.slice(0, 3))}`)
    ok(pack.prompts.length > 0 && pack.images.length > 0 && pack.sounds.length > 0, `${pack.meta.id}: prompts, images and sounds loaded`)
    ok(!problems.some((p) => p.where.includes(`packs/${pack.meta.id}/pack.json`) && p.severity === 'error'), `${pack.meta.id}: pack.json has no errors`)
  }
  const envProblems = problems.filter((p) => p.where.includes('environments.json'))
  console.log(`  (environments.json problems, owned by the environment module: ${envProblems.length}${envProblems[0] ? `; first: ${envProblems[0].where}: ${envProblems[0].message}` : ''})`)

  // Validation catches the rules it should.
  {
    const bad: ContentProblem[] = []
    validateContent(
      {
        schema: 1,
        prompts: [
          { id: 'x', appliesTo: { categories: ['nope'] }, text: { hi: 'केवल' } },
          { id: 'x', appliesTo: {}, text: 'plain' }
        ],
        sounds: [{ id: 's', label: { en: 'a' }, description: { en: 'b' }, path: 'https://example.com/a.mp3', mime: 'audio/mpeg', durationMs: 1, synthesized: true, provenance: { source: 'x', author: 'y', license: 'unknown' } }],
        images: [{ id: 'i', path: '/abs.webp', width: 1, height: 1, alt: { en: 'a' }, notice: { en: 'n' }, kind: 'decorative-generated', provenance: { source: 'x', author: 'y', license: 'CC0-1.0' } }]
      },
      'bad/',
      'bad/content.json',
      (severity, where, message) => bad.push({ severity, where, message }),
      () => undefined
    )
    const has = (re: RegExp): boolean => bad.some((p) => p.severity === 'error' && re.test(p.message))
    ok(has(/duplicate prompt id/), 'validate: duplicate ids are errors')
    ok(has(/no English/), 'validate: missing English is an error')
    ok(has(/unknown category/), 'validate: unknown categories are errors')
    ok(has(/names no assets, categories or activities/), 'validate: empty appliesTo is an error')
    ok(has(/SPDX/), 'validate: a non-SPDX licence is an error')
    ok(bad.filter((p) => /never a remote URL/.test(p.message)).length === 2, 'validate: remote and absolute media paths are errors')
  }

  // --- files: sounds and pictures
  for (const pack of packs) {
    const dir = path.join(SUITE, 'packs', pack.meta.id)
    for (const s of pack.sounds) {
      const file = path.resolve(dir, s.path)
      ok(fs.existsSync(file), `${pack.meta.id}: sound ${s.id} exists`)
      if (!fs.existsSync(file)) continue
      const size = fs.statSync(file).size
      ok(size <= 150 * 1024, `${pack.meta.id}: sound ${s.id} is 150 KB or less (${size})`)
      const mp3 = parseMp3(fs.readFileSync(file))
      ok(mp3.frames > 0, `${pack.meta.id}: ${s.id} is an MP3`)
      ok(mp3.mono, `${pack.meta.id}: ${s.id} is mono`)
      ok(mp3.sampleRate >= 22050 && mp3.sampleRate <= 32000, `${pack.meta.id}: ${s.id} sample rate 22.05–32 kHz (${mp3.sampleRate})`)
      ok(mp3.durationMs >= 4000 && mp3.durationMs <= 15000, `${pack.meta.id}: ${s.id} lasts 4–15 s (${mp3.durationMs})`)
      ok(Math.abs(mp3.durationMs - s.durationMs) <= 150, `${pack.meta.id}: ${s.id} durationMs matches the file (${s.durationMs} vs ${mp3.durationMs})`)
      ok(s.synthesized === true && s.provenance.license === 'CC0-1.0' && s.provenance.source === 'project-generated', `${pack.meta.id}: ${s.id} is marked synthesized, project-generated, CC0`)
      ok(s.mime === 'audio/mpeg', `${pack.meta.id}: ${s.id} mime`)
    }
    for (const im of pack.images) {
      const file = path.resolve(dir, im.path)
      ok(fs.existsSync(file), `${pack.meta.id}: image ${im.id} exists`)
      if (!fs.existsSync(file)) continue
      const buf = fs.readFileSync(file)
      ok(buf.length <= 120 * 1024, `${pack.meta.id}: image ${im.id} is 120 KB or less`)
      const size = webpSize(buf)
      ok(size !== null, `${pack.meta.id}: image ${im.id} is WebP`)
      ok(size?.width === im.width && size?.height === im.height, `${pack.meta.id}: image ${im.id} size matches content.json`)
      const long = Math.max(im.width, im.height)
      ok(long >= 1000 && long <= 1300, `${pack.meta.id}: image ${im.id} is about 1200 px on the long edge`)
      ok(im.kind === 'decorative-generated' && /illustration/i.test(im.notice && typeof im.notice === 'object' ? im.notice.en ?? '' : ''), `${pack.meta.id}: image ${im.id} is labelled as an illustration`)
    }
  }
  const aspects = new Set(packs.flatMap((p) => p.images.map((i) => (i.width / i.height).toFixed(2))))
  ok(aspects.has('0.75') && aspects.has('1.00') && (aspects.has('1.78') || aspects.has('1.33')), 'images: portrait, square and landscape aspects are all present')
  const soundIds = ['snd-wall-clock', 'snd-pressure-cooker', 'snd-rain-roof', 'snd-birds-morning', 'snd-bicycle-bell', 'snd-school-bell', 'snd-radio-tuning', 'snd-ceiling-fan', 'snd-harmonium', 'snd-train', 'snd-sewing-machine', 'snd-water-pouring']
  ok(soundIds.every((id) => everyday.sounds.some((s) => s.id === id)), 'everyday-home: every PLAN sound id is present')
  ok(['pic-river-dusk', 'pic-hills-morning', 'pic-seaside', 'pic-flowers', 'pic-fruit-bowl', 'pic-train-window'].every((id) => everyday.images.some((i) => i.id === id)), 'everyday-home: every PLAN image id is present')
  ok(['pic-hills-mist', 'pic-bamboo-grove', 'pic-paddy-fields'].every((id) => northeast.images.some((i) => i.id === id)), 'northeast-home: every PLAN image id is present')

  // --- English and Hindi, coverage
  const hasBoth = (v: unknown): boolean => !!v && typeof v === 'object' && !!(v as Record<string, string>).en?.trim() && !!(v as Record<string, string>).hi?.trim()
  for (const pack of packs) {
    ok(pack.prompts.every((p) => hasBoth(p.text)), `${pack.meta.id}: every prompt has English and Hindi`)
    ok(pack.sounds.every((s) => hasBoth(s.label) && hasBoth(s.description)), `${pack.meta.id}: every sound label and description has English and Hindi`)
    ok(pack.images.every((i) => hasBoth(i.alt) && hasBoth(i.notice)), `${pack.meta.id}: every image alt and notice has English and Hindi`)
    for (const cat of ASSET_CATEGORIES) {
      const n = pack.prompts.filter((p) => p.appliesTo.categories?.includes(cat)).length
      ok(n >= 3, `${pack.meta.id}: category ${cat} has several prompts (${n})`)
    }
    for (const kind of ACTIVITY_KINDS) ok(pack.prompts.some((p) => p.appliesTo.activities?.includes(kind)), `${pack.meta.id}: activity ${kind} has prompts`)
    ok(pack.prompts.filter((p) => p.topics?.some((t) => t === 'faith' || t === 'festivals')).length >= 2, `${pack.meta.id}: faith and festival prompts carry those topics`)
  }
  const regional = northeast.prompts.filter((p) => p.id.startsWith('ne-'))
  ok(regional.length >= 4, 'northeast-home: has regional prompts')
  ok(regional.every((p) => !/\byour (family|home|mother|father|grandmother|grandfather|people|community)\b/i.test((p.text as Record<string, string>).en)), 'northeast-home: regional prompts never universalise ("your family…")')
  ok(regional.filter((p) => /gamosa|jaapi|xorai/.test((p.text as Record<string, string>).en) && /some (homes|places)|in some places/i.test((p.text as Record<string, string>).en)).length >= 3, 'northeast-home: regional prompts say "some homes"')
  ok(regional.some((p) => p.appliesTo.assets?.includes('xorai') && p.topics?.includes('faith')), 'northeast-home: the xorai prompt carries the faith topic')

  // --- Banned words
  const BANNED = [/\bwrong\b/i, /\bcorrect\b/i, /\bincorrect\b/i, /\btry again\b/i, /remember\?/i, /\bdo you remember\b/i, /\bforg[oe]t/i, /\bfail/i, /\bscor(e|es|ed|ing)\b/i, /\bpoints?\b/i, /\bwell done\b/i, /dementia/i, /\bpatients?\b/i, /symptom/i, /diagnos/i, /cognitive/i, /\btreatment/i, /\bcure[sd]?\b/i]
  const englishTexts: { where: string; text: string }[] = []
  for (const pack of packs) {
    for (const p of pack.prompts) englishTexts.push({ where: `${pack.meta.id}#${p.id}`, text: (p.text as Record<string, string>).en })
    for (const s of pack.sounds) englishTexts.push({ where: `${pack.meta.id}#${s.id}`, text: `${(s.label as Record<string, string>).en} ${(s.description as Record<string, string>).en}` })
    for (const i of pack.images) englishTexts.push({ where: `${pack.meta.id}#${i.id}`, text: `${(i.alt as Record<string, string>).en} ${(i.notice as Record<string, string>).en}` })
  }
  const walk = (v: unknown, at: string): void => {
    if (typeof v === 'string') englishTexts.push({ where: at, text: v })
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`)
  }
  walk(readJson('locales/en/activities.json'), 'activities')
  const hits = englishTexts.flatMap(({ where, text }) => BANNED.filter((re) => re.test(text)).map((re) => `${where}: ${re}`))
  ok(hits.length === 0, `banned words: none in English prompts or activities.json ${JSON.stringify(hits.slice(0, 5))}`)
  ok(!englishTexts.some(({ text }) => /\b(what year|who is this|which (year|city|town))\b/i.test(text)), 'prompts: no factual questions')

  // --- activities.json keys, English and Hindi
  const keysOf = (v: unknown, prefix = ''): string[] =>
    v && typeof v === 'object' ? Object.entries(v).flatMap(([k, x]) => keysOf(x, prefix ? `${prefix}.${k}` : k)) : [prefix]
  const enKeys = keysOf(readJson('locales/en/activities.json')).sort()
  const hiKeys = keysOf(readJson('locales/hi/activities.json')).sort()
  ok(JSON.stringify(enKeys) === JSON.stringify(hiKeys), 'activities.json: Hindi has exactly the English keys')
  const i18n = makeI18n('en')
  const needed = [
    ...ACTIVITY_KINDS.flatMap((k) => [ACTIVITIES[k].nameKey, ACTIVITIES[k].descriptionKey]),
    ...['noPhotos', 'noDemoPictures', 'photosAvoided', 'noObjects', 'noSounds', 'noSequence', 'sequenceUnresolved'].map((k) => `activities.unavailable.${k}`),
    'activities.gentleCue', 'activities.kinds.personalPhoto', 'activities.kinds.demoPhoto', 'activities.kinds.packSound', 'activities.kinds.caregiverRecording', 'activities.space.overviewTitle',
    ...['itemsLookedAt', 'promptsReplayed', 'skipped', 'timeSpent', 'caregiverNotes', 'endedEarly'].map((k) => `activities.summary.${k}`)
  ]
  ok(needed.every((k) => i18n.t(k) !== k), `activities.json: every key the code uses exists ${JSON.stringify(needed.filter((k) => i18n.t(k) === k))}`)
  ok(ACTIVITY_KINDS.every((k) => ACTIVITIES[k].answerMode === 'open-ended' && ACTIVITIES[k].kind === k), 'registry: every activity is open-ended')

  // --- Display media
  const media = packDisplayMedia(everyday, i18n)
  ok(media.demoPhotos.length === 6 && media.demoPhotos.every((p) => !p.personal && p.people.length === 0 && /illustration/i.test(p.notice ?? '')), 'media: demo pictures are non-personal and carry the notice')
  ok(media.packSounds.length === 12 && media.packSounds.every((s) => !s.personal && s.synthesized && s.url.includes('/suite/packs/everyday-home/sounds/')), 'media: pack sounds are local, non-personal and synthesized')
  ok((await media.demoPhotos[0].texture()) === null, 'media: texture() resolves to null without a DOM instead of throwing')
  const neMedia = packDisplayMedia(northeast, i18n)
  ok(neMedia.packSounds.every((s) => s.url.includes('/suite/packs/everyday-home/sounds/')), 'media: northeast sounds resolve to the shared everyday-home files')
  const hiMedia = packDisplayMedia(everyday, makeI18n('hi'))
  ok(/चित्र/.test(hiMedia.demoPhotos[0].notice ?? ''), 'media: the notice resolves in the active language')

  const context = (extra: Partial<ActivityContext> = {}): ActivityContext => ({
    scene: fakeScene(),
    pack: everyday,
    profile: null,
    demoPhotos: media.demoPhotos,
    packSounds: media.packSounds,
    i18n,
    ...extra
  })

  // --- Availability
  {
    const demo = context()
    ok(ACTIVITY_KINDS.every((k) => ACTIVITIES[k].available(demo).ok), 'availability: every activity is available in the demo')
    const empty = context({ profile: profile() })
    const photo = ACTIVITIES.photo.available(empty)
    ok(!photo.ok && photo.reasonKey === 'activities.unavailable.noPhotos', 'availability: a saved profile without photos has no photo activity (points to caregiver setup)')
    const seq = ACTIVITIES.sequence.available(empty)
    ok(!seq.ok && seq.reasonKey === 'activities.unavailable.noSequence', 'availability: a saved profile without a sequence has no guided sequence')
    ok(ACTIVITIES.object.available(empty).ok && ACTIVITIES.space.available(empty).ok && ACTIVITIES.sound.available(empty).ok, 'availability: objects, space and pack sounds stay available')
    const withPhotos = context({ profile: profile({ photos: [personalPhoto('p1'), personalPhoto('p2')] }) })
    ok(ACTIVITIES.photo.available(withPhotos).ok, 'availability: a saved profile with photos has the photo activity')
    const items = ACTIVITIES.photo.items(withPhotos)
    ok(items.length === 2 && items.every((i) => i.kind === 'photo' && i.personal && i.photo.personal), 'photo: a personal session shows only personal photos, never demo pictures')
    const allAvoided = context({ profile: profile({ photos: [personalPhoto('p1', { topics: ['faith'] })], topics: { include: [], avoid: ['faith'] } }) })
    const r = ACTIVITIES.photo.available(allAvoided)
    ok(!r.ok && r.reasonKey === 'activities.unavailable.photosAvoided', 'availability: photos all removed by avoid-topics say so')
    const noScene = context({ scene: { ...fakeScene(), objects: [] }, packSounds: [], demoPhotos: [] })
    ok(!ACTIVITIES.object.available(noScene).ok && !ACTIVITIES.sound.available(noScene).ok && ACTIVITIES.space.available(noScene).ok, 'availability: empty room — objects and sounds unavailable, the room overview still offered')
  }

  // --- Items and prompts
  {
    const demo = context()
    const photos = ACTIVITIES.photo.items(demo)
    ok(photos.length === 6 && photos.every((i) => !i.personal), 'photo (demo): six demo pictures')
    ok(photos.find((i) => i.id === 'photo:pic-river-dusk')?.objectId === 'frame-a', 'photo (demo): a picture placed on a frame points at that frame')
    ok(photos.every((i) => i.prompt?.source === 'pack'), 'photo: pack picture prompts are used')
    ok(new Set(photos.map((i) => i.prompt?.text)).size >= 5, 'photo: prompts vary from item to item')

    const objects = ACTIVITIES.object.items(demo)
    ok(objects.length === 8 && !objects.some((i) => i.objectId === 'stool'), 'object: objects whose activities include "object"')
    const clock = objects.find((i) => i.objectId === 'clock')
    ok(clock?.prompt?.source === 'pack' && /clock/i.test(clock.prompt.text), 'prompt order: an asset prompt comes before a category prompt')
    const radio = objects.find((i) => i.objectId === 'radio')
    ok(/radio/i.test(radio?.prompt?.text ?? ''), 'prompt order: radio gets its asset prompt')

    const withCaregiver = context({
      profile: profile({ objectPrompt: (_p, _e, id) => (id === 'cooker' ? { text: 'Tell me about Amma’s cooker, if you like.', lang: 'en', source: 'caregiver' } : null) })
    })
    const cooker = ACTIVITIES.object.items(withCaregiver).find((i) => i.objectId === 'cooker')
    ok(cooker?.prompt?.source === 'caregiver', 'prompt order: the caregiver prompt comes first')

    const unknown = context({ scene: { ...fakeScene(), objects: [obj('thing', 'no-such-asset', 'decor')] } })
    const cat = ACTIVITIES.object.items(unknown)[0]
    ok(cat.prompt?.source === 'pack' && everyday.prompts.some((p) => p.appliesTo.categories?.includes('decor') && (p.text as Record<string, string>).en === cat.prompt?.text), 'prompt order: category prompt when no asset prompt exists')
    const bare = context({ pack: { ...everyday, prompts: [] } })
    const generic = ACTIVITIES.object.items(bare)[0]
    ok(generic.prompt?.source === 'generic' && generic.prompt.text === i18n.t('activities.generic.object.1'), 'prompt order: the generic prompt from activities.json comes last')

    const sounds = ACTIVITIES.sound.items(demo)
    ok(sounds.length === 12 && sounds.every((s) => s.kind === 'sound' && !s.personal), 'sound (demo): the pack sounds')
    const clockSound = sounds.find((s) => s.id === 'sound:pack:snd-wall-clock')
    ok(/ticking/i.test(clockSound?.prompt?.text ?? '') && clockSound?.objectId === 'clock', 'sound: a sound linked to an object uses its sound prompt')
    const rain = sounds.find((s) => s.id === 'sound:pack:snd-rain-roof')
    const rainDef = everyday.prompts.find((p) => (p.text as Record<string, string>).en === rain?.prompt?.text)
    ok(!!rainDef && (!rainDef.topics?.length || rainDef.topics.some((t) => ['weather', 'nature', 'home'].includes(t))), 'sound: topic-specific sound prompts only go with a sound sharing the topic')

    const voice: DisplaySound = { id: 'v1', url: 'blob:v1', title: 'Message', personal: true, synthesized: false, kind: 'voice-message', prompt: null, topics: [] }
    const personalSounds = ACTIVITIES.sound.items(context({ profile: profile({ sounds: [voice] }) }))
    ok(personalSounds[0].id === 'sound:personal:v1' && personalSounds[0].personal && personalSounds.length === 13, 'sound: personal sounds first, then pack sounds')
    ok(personalSounds[0].prompt?.source === 'generic' && personalSounds[0].prompt.text === i18n.t('activities.generic.voiceMessage.1'), 'sound: a voice message gets a voice-message prompt')

    const space = ACTIVITIES.space.items(demo)
    ok(space[0].kind === 'space' && space[0].id === 'space:overview' && space[0].title === i18n.t('activities.space.overviewTitle'), 'space: the overview item comes first')
    ok(space.slice(1).map((i) => i.objectId).join() === 'clock,frame-a,cooker,carrom', 'space: then the highlighted objects')

    const seq = ACTIVITIES.sequence.items(demo)
    ok(seq.length === 5 && seq.filter((i) => i.kind === 'object').length === 3 && seq.filter((i) => i.kind === 'photo').length === 1 && seq.filter((i) => i.kind === 'sound').length === 1, 'sequence (demo): three objects, one demo picture, one pack sound')

    const saved = context({
      profile: profile({
        photos: [personalPhoto('p1')],
        sounds: [voice],
        sequence: [
          { kind: 'photo', id: 'p1' },
          { kind: 'object', id: 'living-room/clock' },
          { kind: 'object', id: 'kitchen-dining/cooker' },
          { kind: 'sound', id: 'v1' },
          { kind: 'photo', id: 'p1' }
        ]
      })
    })
    const savedSeq = ACTIVITIES.sequence.items(saved)
    ok(savedSeq.map((i) => i.kind).join() === 'photo,object,sound,photo', 'sequence (saved): follows the caregiver order; objects from other rooms are left out')
    ok(new Set(savedSeq.map((i) => i.id)).size === savedSeq.length, 'sequence: item ids are unique even when repeated')
    ok(savedSeq.every((i) => i.kind !== 'photo' || i.personal), 'sequence (saved): no demo pictures')
    const unresolved = context({ profile: profile({ sequence: [{ kind: 'object', id: 'kitchen-dining/cooker' }] }) })
    const u = ACTIVITIES.sequence.available(unresolved)
    ok(!u.ok && u.reasonKey === 'activities.unavailable.sequenceUnresolved', 'sequence: a sequence for another room says so')

    // Hindi resolution
    const hiItems = ACTIVITIES.photo.items(context({ i18n: makeI18n('hi') }))
    ok(hiItems[0].prompt?.lang === 'hi' && /[ऀ-ॿ]/.test(hiItems[0].prompt.text), 'prompts resolve in Hindi when Hindi is active')
  }

  // --- Avoid topics
  {
    const avoid = ['festivals', 'food', 'music']
    const ctx = context({ profile: profile({ photos: [personalPhoto('p1'), personalPhoto('p2', { topics: ['festivals'] })], topics: { include: [], avoid } }) })
    const all = ACTIVITY_KINDS.flatMap((k) => (ACTIVITIES[k].available(ctx).ok ? ACTIVITIES[k].items(ctx) : []))
    ok(!all.some((i) => i.objectId === 'cooker' || i.objectId === 'kite' || i.objectId === 'radio'), 'avoid: objects with avoided topics are left out')
    ok(!all.some((i) => i.kind === 'photo' && i.photo.id === 'p2'), 'avoid: photos with avoided topics are left out')
    ok(!all.some((i) => i.kind === 'sound' && i.sound.topics.some((t) => avoid.includes(t))), 'avoid: sounds with avoided topics are left out')
    const promptTopics = all.flatMap((i) => everyday.prompts.filter((p) => (p.text as Record<string, string>).en === i.prompt?.text && i.prompt?.source === 'pack'))
    // Several prompts share generic wording; at least one matching definition must be clean.
    const dirty = all.filter((i) => i.prompt?.source === 'pack' && !everyday.prompts.some((p) => (p.text as Record<string, string>).en === i.prompt?.text && !p.topics?.some((t) => avoid.includes(t))))
    ok(promptTopics.length > 0 && dirty.length === 0, `avoid: no chosen prompt touches an avoided topic ${JSON.stringify(dirty.map((d) => d.prompt?.text).slice(0, 2))}`)
  }

  // --- Session lifecycle
  {
    let clock = 1000
    const now = (): number => clock
    const a = fakeAudio()
    const tel = fakeTelemetry()
    const ctx = context()
    const s = createActivitySession({ definition: ACTIVITIES.object, context: ctx, audio: a.audio, telemetry: tel.telemetry, now })
    ok(!s.started && s.index === -1 && s.current === null && !s.adaptable.active, 'session: idle before start')
    ok(s.adaptable.requestHint() === false, 'adaptable: requestHint() is false before start')
    s.start()
    await flush()
    ok(s.started && s.index === 0 && s.current?.id === s.items[0].id, 'session: start shows item 0')
    ok(s.log[0].kind === 'session_start' && s.log[1].kind === 'item_shown', 'session: session_start then item_shown')
    const played = s.log.find((e) => e.kind === 'prompt_played')
    ok(played?.kind === 'prompt_played' && played.via === 'speech' && played.itemId === s.items[0].id, 'session: prompt_played logged with via')
    ok(s.adaptable.active && s.adaptable.current?.type === 'reminisce-object' && s.adaptable.stepIndex === 0 && s.adaptable.level === 0, 'adaptable: active, current type, stepIndex, level 0')
    clock += 2000
    ok(s.adaptable.stepAgeMs === 2000, 'adaptable: stepAgeMs follows the clock')
    s.replayPrompt()
    ok(s.log.some((e) => e.kind === 'prompt_replayed'), 'session: replay logs prompt_replayed')
    s.next()
    ok(s.index === 1 && !s.log.some((e) => e.kind === 'item_skipped'), 'session: next moves on without a skip')
    clock += 1000
    s.skip()
    ok(s.index === 2 && s.log.filter((e) => e.kind === 'item_skipped').length === 1, 'session: skip logs item_skipped and moves on')
    s.previous()
    ok(s.index === 1 && s.log.filter((e) => e.kind === 'item_skipped').length === 1, 'session: previous goes back without a skip')
    clock += 1000
    const beforePause = s.adaptable.stepAgeMs ?? -1
    s.pause()
    ok(s.paused && a.calls.includes('pause') && tel.calls.includes('pause'), 'session: pause pauses audio and telemetry')
    ok(s.adaptable.gentleCue() === false, 'adaptable: no gentle cue while paused')
    clock += 60_000
    s.next()
    ok(s.index === 1, 'session: navigation waits while paused')
    ok(s.adaptable.stepAgeMs === beforePause, 'adaptable: stepAgeMs excludes paused time')
    s.resume()
    ok(!s.paused && a.calls.includes('resume') && tel.calls.includes('resume'), 'session: resume resumes audio and telemetry')
    clock += 500
    const promptsBefore = a.calls.filter((c) => c === 'playPrompt').length
    ok(s.adaptable.gentleCue() === true, 'adaptable: a gentle cue is offered')
    ok(gentleCueShown(s), 'session: the UI can see the gentle cue for this item')
    ok(a.calls.filter((c) => c === 'playPrompt').length === promptsBefore + 1, 'adaptable: the gentle cue replays the prompt once')
    ok(s.adaptable.gentleCue() === false, 'adaptable: at most one gentle cue per item')
    ok(s.log.filter((e) => e.kind === 'gentle_cue').length === 1, 'session: gentle_cue logged once')
    s.next()
    ok(!gentleCueShown(s) && s.adaptable.gentleCue() === true, 'adaptable: a new item may have its own gentle cue')
    s.addNote('Smiled at the clock', 'object:clock')
    s.noteCloseup(true)
    s.noteCloseup(false)
    s.playSound() // object with no sound: nothing happens
    while (!s.ended) {
      s.next()
      await flush()
    }
    ok(s.ended && !s.adaptable.active && s.current === null, 'session: moving past the last item finishes')
    ok(s.adaptable.requestHint() === false, 'adaptable: requestHint() is always false')
    const sum = s.finish()
    ok(sum.endedBy === 'finished', 'summary: endedBy finished')
    ok(sum.durationMs === 4500, `summary: durationMs excludes the paused minute (${sum.durationMs})`)
    ok(sum.pausedMs === 60_000, 'summary: pausedMs')
    ok(sum.skips === 1 && sum.promptsReplayed === 1 && sum.closeups === 1, 'summary: skips, replays and close-ups from the log')
    ok(sum.promptsPlayed === s.log.filter((e) => e.kind === 'prompt_played').length && sum.promptsPlayed >= s.items.length, 'summary: prompts played')
    ok(sum.itemsShown.length === s.items.length && sum.objectsVisited.length === s.items.length, 'summary: every item and object visited')
    ok(sum.caregiverNotes.length === 1 && sum.caregiverNotes[0].text === 'Smiled at the clock' && sum.caregiverNotes[0].itemId === 'object:clock', 'summary: caregiver notes are recorded')
    ok(sum.vision === null && sum.profile === 'demo' && sum.activity === 'object' && sum.packId === 'everyday-home' && sum.environmentId === 'living-room', 'summary: vision null, context fields')
    ok(!/score|correct|accura|point/i.test(JSON.stringify(Object.keys(sum))), 'summary: no score-like fields')
    s.addNote('Added on the summary screen')
    ok(s.finish().caregiverNotes.length === 2, 'summary: a note added after the end is kept')
    ok(s.exit().endedBy === 'finished', 'summary: exit after finish keeps the first outcome')

    // Telemetry sequence
    const n = s.items.length
    const expected = [
      'missionStart:suite-object',
      'stepStart:0:reminisce-object', 'stepEnd:0:reminisce-object:skipped',
      'stepStart:1:reminisce-object', 'stepEnd:1:reminisce-object:skipped',
      'stepStart:2:reminisce-object', 'stepEnd:2:reminisce-object:skipped',
      'stepStart:1:reminisce-object', 'pause', 'resume', 'stepEnd:1:reminisce-object:skipped'
    ]
    for (let i = 2; i < n; i++) expected.push(`stepStart:${i}:reminisce-object`, `stepEnd:${i}:reminisce-object:skipped`)
    expected.push('missionComplete:suite-object')
    ok(JSON.stringify(tel.calls) === JSON.stringify(expected), `telemetry: call sequence\n    got      ${tel.calls.join(' ')}\n    expected ${expected.join(' ')}`)
  }

  // --- Exit mid-way
  {
    let clock = 0
    const a = fakeAudio()
    const tel = fakeTelemetry()
    const s = createActivitySession({ definition: ACTIVITIES.space, context: context(), audio: a.audio, telemetry: tel.telemetry, now: () => clock })
    s.start()
    clock += 1000
    s.next()
    clock += 1000
    s.pause()
    clock += 5000
    const sum = s.exit()
    ok(sum.endedBy === 'exited' && s.ended, 'exit: endedBy exited')
    ok(sum.skips === 0 && sum.itemsShown.length === 2 && sum.durationMs === 2000, 'exit: neutral facts only, paused time excluded')
    ok(tel.calls[tel.calls.length - 1] === 'missionComplete:suite-space' && tel.calls.includes('resume'), 'exit: telemetry closes the step and the mission')
    ok(s.exit() === sum, 'exit: idempotent')
  }

  // --- Free exploration
  {
    const a = fakeAudio()
    const tel = fakeTelemetry()
    const s = createActivitySession({ definition: ACTIVITIES.space, context: context(), audio: a.audio, telemetry: tel.telemetry, now: () => 0 })
    s.start()
    s.selectObject('radio')
    ok(s.index === -1 && s.current?.objectId === 'radio' && s.adaptable.stepIndex === s.items.length, 'free: selecting any object shows it (index -1, a fresh step)')
    ok(s.log.some((e) => e.kind === 'object_selected' && e.objectId === 'radio'), 'free: object_selected logged')
    s.selectObject('cooker')
    ok(s.current?.objectId === 'cooker' && s.index >= 0, 'free: an object in the tour goes to its item')
    s.selectObject('radio')
    s.next()
    ok(s.index === s.items.findIndex((i) => i.objectId === 'cooker') + 1, 'free: next continues the tour after free exploration')
    ok(s.exit().objectsVisited.some((o) => o.id === 'radio' && o.label === 'Label radio'), 'free: the summary lists freely chosen objects')
  }

  // --- Instruction gate
  {
    const a = fakeAudio()
    const s = createActivitySession({ definition: ACTIVITIES.object, context: context(), audio: a.audio, telemetry: fakeTelemetry().telemetry, now: () => 0 })
    const held: (() => void)[] = []
    s.adaptable.instructionGate = (speak) => void held.push(speak)
    s.start()
    ok(held.length === 1 && !a.calls.includes('playPrompt'), 'gate: a new prompt waits for the gate')
    held[0]()
    await flush()
    ok(a.calls.filter((c) => c === 'playPrompt').length === 1 && s.log.some((e) => e.kind === 'prompt_played'), 'gate: the prompt plays when the gate calls back')
    s.next()
    s.next()
    held[1]() // for item 1, which is no longer current
    await flush()
    ok(a.calls.filter((c) => c === 'playPrompt').length === 1, 'gate: a held prompt is dropped when the item changed')
    s.pause()
    held[2]()
    ok(a.calls.filter((c) => c === 'playPrompt').length === 1, 'gate: a held prompt is dropped while paused')
    s.resume()
    s.adaptable.instructionGate = () => {
      throw new Error('gate failed')
    }
    s.next()
    ok(a.calls.filter((c) => c === 'playPrompt').length === 2, 'gate: a failing gate speaks at once')
    s.exit()
  }

  // --- Failing audio never blocks
  for (const mode of ['reject', 'text-only', 'throw'] as const) {
    const a = fakeAudio()
    a.state.mode = mode
    const s = createActivitySession({ definition: ACTIVITIES.sound, context: context(), audio: a.audio, telemetry: fakeTelemetry().telemetry, now: () => 0 })
    s.start()
    await flush()
    const e = s.log.find((x) => x.kind === 'prompt_played')
    ok(e?.kind === 'prompt_played' && e.via === 'text-only', `audio ${mode}: prompt_played via text-only`)
    s.replayPrompt()
    s.playSound()
    s.next()
    await flush()
    ok(s.index === 1 && !s.ended, `audio ${mode}: progress continues`)
    ok(s.log.some((x) => x.kind === 'sound_played'), `audio ${mode}: sounds still play`)
    s.exit()
  }

  // --- assignPhotos
  {
    const scene = fakeScene()
    const p1 = personalPhoto('p1', { preferredSurface: 'album' })
    const p2 = personalPhoto('p2')
    const p3 = personalPhoto('p3')
    const p4 = personalPhoto('p4', { preferredSurface: 'no-such-object' })
    const map = assignPhotos(scene, [p1, p2, p2, p3, p4])
    ok(map.get('album') === p1, 'assignPhotos: preferredSurface is honoured')
    ok(map.get('frame-a') === p2 && map.get('frame-b') === p3, 'assignPhotos: frames are filled first, in placement order')
    ok(map.size === 3, 'assignPhotos: only photo-surface objects are used')
    const values = [...map.values()].map((p) => p.id)
    ok(new Set(values).size === values.length, 'assignPhotos: no photo appears twice')
    const two = assignPhotos(scene, [personalPhoto('a'), personalPhoto('b'), personalPhoto('c')])
    ok([...two.keys()].join() === 'frame-a,frame-b,album', 'assignPhotos: frames, then albums')
    const clash = assignPhotos(scene, [personalPhoto('x', { preferredSurface: 'frame-a' }), personalPhoto('y', { preferredSurface: 'frame-a' })])
    ok(clash.get('frame-a')?.id === 'x' && clash.get('frame-b')?.id === 'y', 'assignPhotos: a taken preferred surface falls back to the next free one')
    ok(assignPhotos(scene, []).size === 0, 'assignPhotos: no photos, no assignments')
  }

  media.dispose()
  neMedia.dispose()
  hiMedia.dispose()

  if (failures.length === 0) {
    console.log(`ALL CHECKS PASSED (${checks})`)
  } else {
    console.log(`${failures.length} of ${checks} checks FAILED:\n`)
    for (const f of failures) console.log(`  ✗ ${f}`)
    process.exitCode = 1
  }
}

// ---------------------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------------------

function parseMp3(buf: Buffer): { frames: number; sampleRate: number; mono: boolean; durationMs: number } {
  let i = 0
  if (buf.toString('ascii', 0, 3) === 'ID3') {
    const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    i = 10 + size
  }
  const RATES: Record<number, number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] }
  const BR1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  const BR2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  let frames = 0
  let samples = 0
  let sampleRate = 0
  let mono = true
  while (i + 4 <= buf.length) {
    const h = buf.readUInt32BE(i)
    if ((h >>> 21) !== 0x7ff) break
    const version = (h >>> 19) & 3
    const layer = (h >>> 17) & 3
    const brIndex = (h >>> 12) & 15
    const srIndex = (h >>> 10) & 3
    const pad = (h >>> 9) & 1
    const channelMode = (h >>> 6) & 3
    if (layer !== 1 || version === 1 || srIndex === 3 || brIndex === 0 || brIndex === 15) break
    const sr = RATES[version][srIndex]
    const br = (version === 3 ? BR1 : BR2)[brIndex] * 1000
    const len = Math.floor(((version === 3 ? 144 : 72) * br) / sr) + pad
    sampleRate = sr
    if (channelMode !== 3) mono = false
    samples += version === 3 ? 1152 : 576
    frames++
    i += len
  }
  return { frames, sampleRate, mono, durationMs: sampleRate ? Math.round((samples / sampleRate) * 1000) : 0 }
}

function webpSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null
  const chunk = buf.toString('ascii', 12, 16)
  if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21)
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
  }
  if (chunk === 'VP8X') return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 }
  return null
}

main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
