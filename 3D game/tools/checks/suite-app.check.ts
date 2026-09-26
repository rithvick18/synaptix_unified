/**
 * Headless checks for the suite app's pure logic (src/suite/app/): settings, navigation
 * maths, the keyboard map, the audio fallback decision, the vision note, colour contrast,
 * highlighting and picking, the summary fallback, and the app's strings.
 *
 *   node tools/suite/run-check.mjs tools/checks/suite-app.check.ts
 *
 * No DOM. Nothing here measures real audio, speech or rendering.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import type { ResolvedPrompt, SceneObject, SessionEvent } from '../../src/suite/contracts'
import { SuiteAudio, channelLevel, choosePromptRoute, findVoice } from '../../src/suite/app/audio'
import { Highlighter, pickObject } from '../../src/suite/app/highlight'
import { BLOCKING_SELECTORS, keyAction, keysBlocked, type KeyContext } from '../../src/suite/app/keyboard'
import {
  LOOK_LIMITS, MAX_TWEEN_S, Navigator, WALK_RADIUS, WALK_SPEED, angleDelta, clampLook, classifyGesture, collides,
  easeInOut, lookAngles, moveToWorld, tweenDuration, walkStep, walkVector
} from '../../src/suite/app/navigator'
import { SETTINGS_KEY, defaultSettings, loadSettings, normaliseSettings, saveSettings } from '../../src/suite/app/settings'
import { SUITE_CSS, SUITE_Z } from '../../src/suite/app/styles'
import { summaryFromLog, splitDuration } from '../../src/suite/app/summary'
import { PALETTE, PALETTE_HC, TEXT_PAIRS, UI_PAIRS, contrastRatio } from '../../src/suite/app/theme'
import { VisionSampler, computeVisionNote } from '../../src/suite/app/vision'

let checks = 0
const failures: string[] = []
function ok(condition: boolean, label: string): void {
  checks++
  if (!condition) failures.push(label)
}
const near = (a: number, b: number, eps = 1e-6): boolean => Math.abs(a - b) <= eps
const ROOT = process.env.MEMORIA_ROOT ?? process.cwd()

// ------------------------------------------------------------------------------ settings
{
  const d = defaultSettings()
  ok(d.textScale === 1 && d.navigation === 'seated' && d.subtitles && !d.highContrast, 'settings: calm defaults (seated, subtitles on)')
  ok(defaultSettings(true).reducedMotion && !defaultSettings(false).reducedMotion, 'settings: reduced motion defaults to prefers-reduced-motion')
  const n = normaliseSettings({ textScale: 3, navigation: 'fly', volume: { master: 7, voice: -1, sounds: 'x' }, muted: 'yes', speech: false })
  ok(n.textScale === 1, 'settings: invalid text scale falls back')
  ok(n.navigation === 'seated', 'settings: invalid navigation falls back')
  ok(n.volume.master === 1 && n.volume.voice === 0 && n.volume.sounds === d.volume.sounds, 'settings: volumes clamped to 0–1, garbage → default')
  ok(n.muted === false && n.speech === false, 'settings: non-boolean ignored, valid boolean kept')
  ok(normaliseSettings({ textScale: 1.5 }).textScale === 1.5 && normaliseSettings({ textScale: 1.25 }).textScale === 1.25, 'settings: 1.25 and 1.5 kept')
  for (const bad of [null, 42, 'x', [1, 2]]) ok(JSON.stringify(normaliseSettings(bad)) === JSON.stringify(d), `settings: ${JSON.stringify(bad)} → defaults`)

  const store = new Map<string, string>()
  const mem = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
  ok(loadSettings(mem).textScale === 1, 'settings: empty storage → defaults')
  store.set(SETTINGS_KEY, '{not json')
  ok(JSON.stringify(loadSettings(mem)) === JSON.stringify(d), 'settings: bad stored JSON → defaults')
  ok(saveSettings(mem, { ...d, highContrast: true, textScale: 1.5 }) && loadSettings(mem).highContrast && loadSettings(mem).textScale === 1.5, 'settings: round trip')
  ok(SETTINGS_KEY === 'memoria-suite-settings-v1', 'settings: storage key')
  const throwing = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('quota') } }
  ok(loadSettings(throwing).subtitles === true, 'settings: throwing storage read → defaults')
  ok(saveSettings(throwing, d) === false, 'settings: throwing storage write → false, no throw')
  ok(loadSettings(null, true).reducedMotion === true, 'settings: no storage → defaults')
}

// ------------------------------------------------------------------------------ navigator
{
  const c = clampLook(Math.PI, -Math.PI)
  ok(near(c.yaw, LOOK_LIMITS.yaw) && near(c.pitch, -LOOK_LIMITS.pitch), 'nav: look clamped to limits')
  ok(near(LOOK_LIMITS.yaw, (70 * Math.PI) / 180) && near(LOOK_LIMITS.pitch, (35 * Math.PI) / 180), 'nav: limits are ±70° yaw, ±35° pitch')
  const inside = clampLook(0.2, -0.1)
  ok(near(inside.yaw, 0.2) && near(inside.pitch, -0.1), 'nav: look inside limits unchanged')

  let maxD = 0
  for (const dist of [0.5, 2, 5, 20, 200]) for (const ang of [0, 1, 3]) maxD = Math.max(maxD, tweenDuration(dist, ang, false))
  ok(maxD <= MAX_TWEEN_S && MAX_TWEEN_S <= 1.2, 'nav: tween never longer than 1.2 s')
  ok(tweenDuration(5, 2, true) === 0, 'nav: reduced motion → instant cut')
  ok(tweenDuration(1, 0.5, false) > 0, 'nav: normal motion tweens')
  ok(near(easeInOut(0), 0) && near(easeInOut(1), 1) && near(easeInOut(0.5), 0.5) && easeInOut(0.25) < 0.25, 'nav: ease-in-out')
  ok(near(angleDelta(3, -3), 2 * Math.PI - 6), 'nav: shortest angle')
  const la = lookAngles({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -1 })
  ok(near(la.yaw, 0) && near(la.pitch, 0), 'nav: looking down −Z is yaw 0')
  ok(classifyGesture(3, 200) === 'tap' && classifyGesture(20, 100) === 'drag' && classifyGesture(2, 2000) === 'hold', 'nav: tap vs drag vs hold')

  const walkable = { min: { x: -2, y: 0, z: -2 }, max: { x: 2, y: 3, z: 2 } }
  const box = { min: { x: 0.5, y: 0, z: -0.5 }, max: { x: 1.5, y: 0.8, z: 0.5 } }
  const rug = { min: { x: -1.5, y: 0, z: -1.5 }, max: { x: -0.5, y: 0.02, z: -0.5 } }
  ok(collides(0.3, 0, [box], 0) && !collides(0.2, 0, [box], 0), 'nav: collision radius 0.25')
  ok(!collides(-1, -1, [rug], 0), 'nav: low rugs do not block')
  const blocked = walkStep({ x: 0, z: 0 }, { x: 1, z: 0 }, [box], walkable)
  ok(blocked.x < box.min.x - WALK_RADIUS + 1e-9 + 0.26 && !collides(blocked.x, blocked.z, [box], 0), 'nav: walking into a blocker stops before it')
  const slide = walkStep({ x: 0, z: 0.9 }, { x: 1, z: 0.1 }, [box], walkable)
  ok(slide.z > 0.9 && !collides(slide.x, slide.z, [box], 0), 'nav: wall contact slides along the free axis')
  const out = walkStep({ x: 1.7, z: 1.7 }, { x: 5, z: 5 }, [], walkable)
  ok(near(out.x, 2 - WALK_RADIUS) && near(out.z, 2 - WALK_RADIUS), 'nav: clamped to walkable')
  const v = walkVector(new Set(['KeyW', 'KeyD']))
  ok(near(Math.hypot(v.x, v.z), 1) && v.x > 0 && v.z > 0, 'nav: diagonal walk normalised')
  ok(walkVector(new Set(['ArrowUp'])).z === 1, 'nav: arrow keys walk')
  const w = moveToWorld({ x: 0, z: 1 }, 0, WALK_SPEED)
  ok(near(w.x, 0) && near(w.z, -1.4), 'nav: forward at yaw 0 is −Z at 1.4 m/s')

  // The Navigator class with a real THREE camera.
  const cam = new THREE.PerspectiveCamera()
  const nav = new Navigator(cam)
  const scene = {
    seat: { position: new THREE.Vector3(0, 1.2, 2), target: new THREE.Vector3(0, 1, 0) },
    spawn: { position: new THREE.Vector3(0, 0, 1), yaw: 0 },
    blockers: [new THREE.Box3(new THREE.Vector3(0.5, 0, -0.5), new THREE.Vector3(1.5, 0.8, 0.5))],
    walkable: new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 3, 2))
  }
  nav.setScene(scene)
  ok(cam.position.distanceTo(scene.seat.position) < 1e-6, 'nav: starts at the seat')
  nav.goTo({ position: new THREE.Vector3(1, 1.2, 1.5), target: new THREE.Vector3(1, 0.8, 0) })
  ok(nav.moving, 'nav: goTo tweens')
  let t = 0
  while (nav.moving && t < 5) { nav.update(1 / 60); t += 1 / 60 }
  ok(t <= MAX_TWEEN_S + 1 / 30 && cam.position.distanceTo(new THREE.Vector3(1, 1.2, 1.5)) < 1e-6, 'nav: tween arrives within 1.2 s')
  nav.reducedMotion = true
  nav.goTo(scene.seat)
  ok(!nav.moving && cam.position.distanceTo(scene.seat.position) < 1e-6, 'nav: reduced motion cuts instantly')
  nav.lookBy(10000, -10000)
  for (let i = 0; i < 30; i++) nav.update(1 / 60)
  ok(near(Math.abs(nav.look.yaw), LOOK_LIMITS.yaw) && near(Math.abs(nav.look.pitch), LOOK_LIMITS.pitch), 'nav: drag clamps to the look limits')
  const rot0 = cam.rotation.y
  for (let i = 0; i < 120; i++) nav.update(1 / 60)
  ok(near(cam.rotation.y, rot0), 'nav: no auto-rotation when idle')
  nav.setMode('walk')
  ok(near(cam.position.y, 1.6), 'nav: walk mode at standing eye height')
  nav.setMove({ x: 1, z: 0 })
  for (let i = 0; i < 300; i++) nav.update(1 / 60)
  ok(!collides(cam.position.x, cam.position.z, scene.blockers, 0) && cam.position.x <= 2 - WALK_RADIUS + 1e-9, 'nav: walking stays clear of blockers and inside walkable')
}

// ------------------------------------------------------------------------------ keyboard
{
  const base: KeyContext = { screen: 'explore', typing: false, onControl: false, inObjectList: false, walkMode: false, closeupOpen: false, modalOpen: false, blocked: false }
  const k = (code: string, ctx: Partial<KeyContext> = {}, key = ''): string | null => keyAction({ code, key }, { ...base, ...ctx })
  ok(k('Space') === 'replay', 'keys: Space replays')
  ok(k('Space', { onControl: true }) === null, 'keys: Space on a button is the button')
  ok(k('KeyP') === 'pause-toggle', 'keys: P pauses')
  ok(k('Escape') === 'escape' && k('Escape', { typing: true }) === 'escape', 'keys: Esc always escapes')
  ok(k('Enter') === 'select-focused' && k('Enter', { onControl: true }) === null, 'keys: Enter selects (native on buttons)')
  ok(k('ArrowRight') === 'focus-next-object' && k('ArrowLeft') === 'focus-prev-object', 'keys: arrows move through objects (seated)')
  ok(k('ArrowUp', { walkMode: true }) === 'walk' && k('KeyW', { walkMode: true }) === 'walk', 'keys: walk mode walks')
  ok(k('ArrowDown', { walkMode: true, inObjectList: true }) === 'focus-next-object', 'keys: arrows in the object list move the list even in walk mode')
  ok(k('KeyW') === null, 'keys: W does nothing when seated')
  ok(k('Tab') === null, 'keys: Tab left to the browser')
  ok(k('KeyP', { typing: true }) === null && k('Space', { typing: true }) === null, 'keys: typing a note is never intercepted')
  for (const code of ['KeyP', 'Space', 'Escape', 'ArrowRight', 'Enter']) ok(k(code, { blocked: true }) === null, `keys: ${code} inert while an editor is open`)
  ok(k('KeyP', { screen: 'home' }) === null && k('Escape', { screen: 'hidden' }) === null, 'keys: explore-only keys, nothing when hidden')
  ok(k('KeyP', { modalOpen: true }) === null && k('Escape', { modalOpen: true }) === 'escape', 'keys: modal open → only Esc')
  ok(keyAction({ code: '', key: '+' }, { ...base, closeupOpen: true }) === 'zoom-in' && keyAction({ code: '', key: '-' }, { ...base, closeupOpen: true }) === 'zoom-out', 'keys: +/- zoom in the close-up')
  ok(keyAction({ code: 'KeyP', key: 'p', ctrlKey: true }, base) === null, 'keys: modified keys ignored')
  const doc = (sel: string | null, open = true) => ({ querySelector: (s: string) => (s === sel ? ({ open } as unknown as Element) : null) })
  ok(keysBlocked(doc('#profile-editor')) && keysBlocked(doc('#suite-setup')) && keysBlocked(doc('#camera-setup:not([hidden])')), 'keys: profile editor, caregiver setup and camera sheet block')
  ok(!keysBlocked(doc(null)) && !keysBlocked(doc('#profile-editor', false)), 'keys: nothing open → not blocked')
  ok(keysBlocked(doc(null), { childElementCount: 1 } as Element), 'keys: caregiver setup host with content blocks')
  ok(BLOCKING_SELECTORS.includes('#profile-editor'), 'keys: #profile-editor listed')
}

// ------------------------------------------------------------------------------ audio
{
  const p = (audioUrl?: string): Pick<ResolvedPrompt, 'audioUrl' | 'lang'> => ({ audioUrl, lang: 'hi' })
  const yes = () => true
  const no = () => false
  const o = { muted: false, speechEnabled: true, speechSupported: true, hasVoice: yes }
  ok(choosePromptRoute(p('a.mp3'), o) === 'audio', 'audio: recording first')
  ok(choosePromptRoute(p(), o) === 'speech', 'audio: speech when a voice exists')
  ok(choosePromptRoute(p(), { ...o, hasVoice: no }) === 'text-only', 'audio: no voice → text only')
  ok(choosePromptRoute(p(), { ...o, speechEnabled: false }) === 'text-only', 'audio: speech off → text only')
  ok(choosePromptRoute(p(), { ...o, speechSupported: false }) === 'text-only', 'audio: no speech engine → text only')
  ok(choosePromptRoute(p('a.mp3'), { ...o, muted: true }) === 'text-only', 'audio: muted → text only')
  const voices = [{ lang: 'en-US' }, { lang: 'hi_IN', name: 'x' }, { lang: 'hi', name: 'y', localService: true }]
  ok(findVoice(voices, 'hi-IN')?.name === 'x', 'audio: exact tag (underscore normalised)')
  ok(findVoice([{ lang: 'hi' }], 'hi-IN') !== null, 'audio: primary subtag match')
  ok(findVoice(voices, 'ta-IN') === null && findVoice(voices, '') === null, 'audio: no match → null')
  ok(near(channelLevel(0.5, 0.5, false), 0.25) && channelLevel(1, 1, true) === 0, 'audio: gain × gain, mute → 0')

  const prompt: ResolvedPrompt = { text: 'Would you like to tell us about this?', lang: 'hi', source: 'generic' }
  const noSpeech = new SuiteAudio({ speech: null, speechLangFor: () => 'hi-IN' })
  ok((await noSpeech.playPrompt(prompt)) === 'text-only', 'audio: SuiteAudio without speech → text-only')

  // Fake speech engine (labelled fake): voices arrive late, via voiceschanged.
  let voicesReady = false
  let spoken: { text: string; volume: number; lang: string } | null = null
  const listeners: Record<string, () => void> = {}
  const fakeSpeech = {
    getVoices: () => (voicesReady ? [{ lang: 'hi-IN', name: 'fake' }] : []),
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn },
    removeEventListener: () => undefined,
    speak: (u: { text: string; volume: number; lang: string; onstart?: () => void }) => { spoken = { text: u.text, volume: u.volume, lang: u.lang }; setTimeout(() => u.onstart?.(), 5) },
    cancel: () => undefined, pause: () => undefined, resume: () => undefined, speaking: true, pending: false
  }
  ;(globalThis as Record<string, unknown>).SpeechSynthesisUtterance = class { text: string; volume = 1; lang = ''; rate = 1; voice: unknown = null; onstart?: () => void; onend?: () => void; onerror?: () => void; constructor(t: string) { this.text = t } }
  const withSpeech = new SuiteAudio({ speech: fakeSpeech as unknown as SpeechSynthesis, speechLangFor: (c) => (c === 'hi' ? 'hi-IN' : 'en-IN') })
  ok(!withSpeech.speechAvailable('hi'), 'audio: before voiceschanged, no voice')
  voicesReady = true
  listeners.voiceschanged?.()
  ok(withSpeech.speechAvailable('hi'), 'audio: voiceschanged picks up voices')
  withSpeech.setVolume('master', 0.5)
  withSpeech.setVolume('voice', 0.8)
  ok((await withSpeech.playPrompt(prompt)) === 'speech', 'audio: speech route with a fake voice')
  const said = spoken as { text: string; volume: number; lang: string } | null
  ok(!!said && near(said.volume, 0.4) && said.lang === 'hi-IN', 'audio: utterance volume from voice × master gains')
  withSpeech.setSpeechEnabled(false)
  ok((await withSpeech.playPrompt(prompt)) === 'text-only', 'audio: speech disabled → text-only')

  // Fake <audio> whose play() rejects: a load/play error resolves 'text-only', never throws.
  ;(globalThis as Record<string, unknown>).Audio = class {
    preload = ''; volume = 1; src = ''
    addEventListener(): void {}
    removeAttribute(): void {}
    load(): void {}
    pause(): void {}
    play(): Promise<void> { return Promise.reject(new Error('NotSupportedError')) }
  }
  const failing = new SuiteAudio({ speech: null, speechLangFor: () => 'hi-IN' })
  ok((await failing.playPrompt({ ...prompt, audioUrl: 'missing.mp3' })) === 'text-only', 'audio: failed recording → text-only')
  ok((await failing.playSound({ id: 's', url: 'x.ogg', title: 's', personal: false, synthesized: true, kind: 'familiar-sound', prompt: null, topics: [] })) === false, 'audio: failed sound → false')
  ok(!failing.playing.voice && !failing.playing.sounds, 'audio: nothing left playing after failures')
  ;(globalThis as Record<string, unknown>).Audio = class {
    preload = ''; volume = 1; src = ''
    addEventListener(): void {}
    removeAttribute(): void {}
    load(): void {}
    pause(): void {}
    play(): Promise<void> { return Promise.resolve() }
  }
  const playing = new SuiteAudio({ speech: null, speechLangFor: () => 'hi-IN' })
  let changes = 0
  playing.onChange(() => changes++)
  ok((await playing.playPrompt({ ...prompt, audioUrl: 'ok.mp3' })) === 'audio', 'audio: recording plays → audio')
  ok(playing.playing.voice && changes > 0, 'audio: voice channel reported playing')
  playing.stop('voice')
  ok(!playing.playing.voice, 'audio: stop(voice)')
  playing.dispose()
  ok((await playing.playPrompt({ ...prompt, audioUrl: 'ok.mp3' })) === 'text-only', 'audio: disposed → text-only')
  noSpeech.dispose(); withSpeech.dispose(); failing.dispose()
}

// ------------------------------------------------------------------------------ vision note
{
  const log: SessionEvent[] = [
    { t: 0, kind: 'session_start', activity: 'photo', packId: 'p', environmentId: 'e', profile: 'demo', language: 'en' },
    { t: 10, kind: 'gentle_cue', itemId: 'a' },
    { t: 20, kind: 'gentle_cue', itemId: 'b' }
  ]
  const records = [
    { action: 'delay_instruction', decision: 'applied' as const, decidedAt: 1500 },
    { action: 'delay_instruction', decision: 'rejected' as const, decidedAt: 1600 },
    { action: 'gentle_cue', decision: 'applied' as const, decidedAt: 1700 },
    { action: 'delay_instruction', decision: 'applied' as const, decidedAt: 500 },
    { action: 'delay_instruction', decision: 'applied' as const, decidedAt: 9999 }
  ]
  const samples = [{ on: true, usable: true }, { on: true, usable: false }, { on: true, usable: true }, { on: false, usable: false }]
  const note = computeVisionNote({ samples, records, window: { start: 1000, end: 5000 }, log, label: 'L' })
  ok(!!note && note.samples === 3 && near(note.trackingAvailableShare!, 2 / 3), 'vision: share of on-samples with visionUsable')
  ok(!!note && note.promptSpeechHeld === 1, 'vision: only applied delay_instruction inside the window')
  ok(!!note && note.gentleCuesShown === 2 && note.label === 'L', 'vision: gentle cues from the session log; label carried')
  ok(computeVisionNote({ samples: [{ on: false, usable: false }], records, window: { start: 0, end: 1e9 }, log, label: 'L' }) === null, 'vision: camera never on → null')
  ok(computeVisionNote({ samples: [], records, window: { start: 0, end: 1 }, log, label: 'L' }) === null, 'vision: no samples → null')
  const sampler = new VisionSampler(1)
  let reads = 0
  for (let i = 0; i < 600; i++) sampler.tick(1 / 60, () => { reads++; return { on: true, usable: true } })
  ok(reads === 10 && sampler.samples.length === 10, 'vision: about one sample per second')
}

// ------------------------------------------------------------------------------ contrast
{
  for (const [name, pal, min] of [['default', PALETTE, 4.5], ['high contrast', PALETTE_HC, 7]] as const) {
    let worst = 99
    for (const [fg, bg] of TEXT_PAIRS) {
      const r = contrastRatio(pal[fg], pal[bg])
      worst = Math.min(worst, r)
      ok(r >= min, `contrast (${name}): ${fg} on ${bg} = ${r.toFixed(2)} ≥ ${min}`)
    }
    for (const [fg, bg] of UI_PAIRS) {
      const r = contrastRatio(pal[fg], pal[bg])
      ok(r >= 3, `contrast (${name}): UI ${fg} on ${bg} = ${r.toFixed(2)} ≥ 3`)
    }
    console.log(`  contrast ${name}: worst text pair ${worst.toFixed(2)}:1`)
  }
  ok(near(contrastRatio('#000000', '#ffffff'), 21) && near(contrastRatio('#777', '#777'), 1), 'contrast: formula sanity')
  ok(SUITE_CSS.includes(`--s-text: ${PALETTE.text}`) && SUITE_CSS.includes(`--s-text: ${PALETTE_HC.text}`), 'css: tokens come from the checked palettes')
  ok(/font-size: calc\(18px \* var\(--s-scale\)\)/.test(SUITE_CSS), 'css: 18 px base scaled by text size')
  ok(/min-height: 48px; min-width: 48px/.test(SUITE_CSS), 'css: 48 px targets')
  ok(SUITE_CSS.includes(':focus-visible { outline: 3px solid'), 'css: visible focus ring')
  ok(SUITE_Z < 40 && SUITE_Z > 5, 'css: #suite above the house UI, below the camera sheet and dock')
  ok(!/@keyframes|animation:/.test(SUITE_CSS), 'css: no animations (nothing flashes)')
  ok(/@media \(min-width: 768px\)/.test(SUITE_CSS) && /@media \(max-width: 767\.98px\)/.test(SUITE_CSS), 'css: side panel ≥768 px, bottom sheet below')
}

// ------------------------------------------------------------------------------ highlight and picking
{
  const mat = new THREE.MeshStandardMaterial({ color: 0x886644 })
  const basic = new THREE.MeshBasicMaterial({ color: 0x224466 })
  const group = new THREE.Group()
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [basic, mat, basic, mat, basic, mat])
  group.add(a, b)
  group.position.set(0, 0, -3)
  group.updateMatrixWorld(true)
  const obj = { id: 'box', object: group } as unknown as SceneObject
  let disposed = 0
  const hl = new Highlighter()
  hl.set(obj)
  ok(a.material !== mat && (a.material as THREE.MeshStandardMaterial).emissive.getHex() !== 0, 'highlight: cloned material with a warm emissive tint')
  ok(mat.emissive.getHex() === 0, 'highlight: original material untouched')
  ;(a.material as THREE.Material).addEventListener('dispose', () => disposed++)
  hl.set(null)
  ok(a.material === mat && Array.isArray(b.material) && b.material[0] === basic && b.material[1] === mat, 'highlight: originals restored')
  ok(disposed === 1, 'highlight: clones disposed on unfocus')

  const cam = new THREE.PerspectiveCamera(60, 1, 0.05, 50)
  cam.updateMatrixWorld()
  ok(pickObject({ x: 0, y: 0 }, cam, [obj])?.id === 'box', 'pick: centre ray hits the object tree')
  ok(pickObject({ x: 0.95, y: 0.95 }, cam, [obj]) === null, 'pick: miss → null')
  group.visible = false
  ok(pickObject({ x: 0, y: 0 }, cam, [obj]) === null, 'pick: hidden objects ignored')
}

// ------------------------------------------------------------------------------ summary fallback
{
  const log: SessionEvent[] = [
    { t: 0, kind: 'session_start', activity: 'object', packId: 'p', environmentId: 'e', profile: 'demo', language: 'en' },
    { t: 5, kind: 'item_shown', itemId: 'i1', itemKind: 'object', objectId: 'radio' },
    { t: 6, kind: 'prompt_played', itemId: 'i1', via: 'text-only' },
    { t: 7, kind: 'prompt_replayed', itemId: 'i1' },
    { t: 8, kind: 'paused' },
    { t: 8, kind: 'resumed' },
    { t: 9, kind: 'item_skipped', itemId: 'i1' },
    { t: 10, kind: 'object_selected', objectId: 'clock' },
    { t: 11, kind: 'caregiver_note', text: 'Talked about the radio' },
    { t: 70500, kind: 'session_end', reason: 'exited' }
  ]
  const s = summaryFromLog({ log, items: [{ id: 'i1', kind: 'object', objectId: 'radio', title: 'Radio', prompt: null, personal: false }],
    objects: [{ id: 'radio', label: 'Radio' }, { id: 'clock', label: 'Clock' }], activity: 'object', packId: 'p', environmentId: 'e',
    profile: 'demo', language: 'en', startedAt: new Date(0).toISOString(), endedBy: 'exited' })
  ok(s.itemsShown.length === 1 && s.objectsVisited.map((o) => o.label).join() === 'Radio,Clock', 'summary: items and objects from the log')
  ok(s.promptsPlayed === 1 && s.promptsReplayed === 1 && s.skips === 1 && s.caregiverNotes.length === 1, 'summary: counts')
  ok(s.vision === null && s.endedBy === 'exited', 'summary: vision kept separate (null here)')
  const d = splitDuration(s.durationMs)
  ok(d.minutes === 1 && d.seconds === 11, 'summary: duration split')
}

// ------------------------------------------------------------------------------ strings
{
  const read = (lang: string): Record<string, unknown> => JSON.parse(readFileSync(path.join(ROOT, 'public/suite/locales', lang, 'app.json'), 'utf8'))
  const flat = (o: unknown, p = ''): Record<string, string> =>
    Object.entries(o as Record<string, unknown>).reduce<Record<string, string>>((acc, [k, v]) =>
      typeof v === 'string' ? { ...acc, [p + k]: v } : { ...acc, ...flat(v, p + k + '.') }, {})
  const en = flat(read('en'))
  const hi = flat(read('hi'))
  const enKeys = Object.keys(en).sort()
  ok(enKeys.join() === Object.keys(hi).sort().join(), 'strings: en and hi have the same keys')
  ok(enKeys.every((k) => en[k].trim() && hi[k].trim()), 'strings: none empty')
  for (const k of enKeys) {
    const ph = (s: string) => (s.match(/\{[a-z]+\}/gi) ?? []).sort().join()
    ok(ph(en[k]) === ph(hi[k]), `strings: placeholders match for app.${k}`)
  }
  const banned = /\b(correct|incorrect|try again|remember\?|you forgot|score(d)?|fail(ed|ure)?|well done|dementia|patient|symptom|cognitive)\b/i
  for (const k of enKeys) {
    // "No scores, no timers, no right or wrong answers" is the one required statement.
    if (k === 'activity.note' || k === 'summary.intro') continue
    ok(!banned.test(en[k]) && !/\bwrong\b/i.test(en[k]), `strings: tone of app.${k}`)
  }
  const used = new Set<string>()
  for (const f of ['app.ts', 'screens.ts', 'explore.ts', 'settingsPanel.ts']) {
    const src = readFileSync(path.join(ROOT, 'src/suite/app', f), 'utf8')
    for (const m of src.matchAll(/'app\.([a-zA-Z0-9_.]+)'/g)) used.add(m[1])
  }
  for (const k of ['badge.personal', 'badge.demo', 'badge.general']) used.add(k)
  const missing = [...used].filter((k) => !(k in en) && !enKeys.some((e) => e.startsWith(k + '.')))
  ok(missing.length === 0, `strings: every key the UI uses exists (${missing.join(', ')})`)
}

if (failures.length === 0) {
  console.log(`ALL CHECKS PASSED (${checks})`)
} else {
  console.log(`${failures.length} of ${checks} checks FAILED:\n`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exitCode = 1
}
