/**
 * The suite's controller: screens, the prepared scene, the running session, input,
 * audio, settings and cleanup. Screens render through screens.ts / explore.ts.
 *
 * Lifecycle of GPU and media resources ("prepared"): built when the Activity screen needs
 * availability (scene + resolved profile + pack media), reused by Explore, and disposed
 * on every transition away (summary, a changed place, profile or language, guided tasks).
 */
import type {
  ActivityContext,
  ActivityItem,
  ActivityKind,
  ActivitySessionApi,
  AssetLibrary,
  ContentProblem,
  DisplayPhoto,
  I18n,
  LoadedContentPack,
  ResolvedSuiteProfile,
  SceneObject,
  SessionSummary,
  SuiteAppApi,
  SuiteHost,
  SuiteMediaApi,
  SuiteScene
} from '../contracts'
import { ACTIVITY_KINDS } from '../contracts'
import type { LocalProfile } from '../../LocalProfile'
import { SuiteAudio } from './audio'
import type { SuiteDeps } from './deps'
import { clear, focusFirst, h, isControl, isTyping, trapFocus } from './dom'
import { ExploreView } from './explore'
import { Highlighter, pickObject } from './highlight'
import { keyAction, keysBlocked, type KeyContext } from './keyboard'
import { Navigator, classifyGesture, walkVector } from './navigator'
import { renderHome, renderSummary } from './screens'
import { browserStorage, loadSettings, prefersReducedMotion, saveSettings, type SuiteSettings } from './settings'
import { renderSettingsDialog } from './settingsPanel'
import { SUITE_CSS } from './styles'
import { summaryFromLog } from './summary'
import { VisionSampler, computeVisionNote } from './vision'

export type Screen = 'home' | 'explore' | 'summary' | 'hidden'

export interface ContentState {
  library: AssetLibrary
  packs: LoadedContentPack[]
  /** Error-free packs: the only ones offered. */
  ok: LoadedContentPack[]
  /** Packs not offered because of errors. */
  failed: LoadedContentPack[]
  problems: ContentProblem[]
}

export interface Prepared {
  key: string
  pack: LoadedContentPack
  environmentId: string
  scene: SuiteScene
  resolved: ResolvedSuiteProfile | null
  media: SuiteMediaApi | null
  packMedia: { demoPhotos: DisplayPhoto[]; packSounds: import('../contracts').DisplaySound[]; dispose(): void }
  ctx: ActivityContext
  attached: boolean
  /** Object id → the photo it shows (after assignPhotos). */
  photoOnObject: Map<string, DisplayPhoto>
}

export interface Run {
  kind: ActivityKind
  session: ActivitySessionApi
  audio: SuiteAudio
  sampler: VisionSampler
  startedAt: number
  unsubs: (() => void)[]
  lastItemId: string | null | undefined
  gentleCues: number
  cueFor: string | null
  selected: SceneObject | null
  objectCloseup: SceneObject | null
  ending: boolean
  assist: boolean
  noteDraft: string
}

type Overlay = 'pause' | 'exit' | 'settings' | 'progress' | null

const STYLE_ID = 'suite-style'

export class SuiteController {
  readonly root: HTMLElement
  private readonly backdrop: HTMLElement
  readonly stage: HTMLElement
  readonly screenEl: HTMLElement
  private readonly layer: HTMLElement
  readonly modalHost: HTMLElement
  i18n: I18n | null = null
  private i18nError = false
  settings: SuiteSettings
  settingsSaved = true
  savedProfile: LocalProfile | undefined
  profileMode: 'saved' | 'demo'
  private profileVersion = 0
  screen: Screen = 'hidden'
  active = false
  content: ContentState | null = null
  contentError = false
  private contentPromise: Promise<ContentState> | null = null
  choice: { packId: string; environmentId: string } | null = null
  /** The place picker's own memory per group, so General and Regional each keep their card
   * highlighted while the other is being browsed — only one can be prepared at a time
   * (that's `choice`, whichever was picked most recently), but the picker itself doesn't
   * forget the other group's pick just because it isn't the active one. */
  lastGeneralChoice: { packId: string; environmentId: string } | null = null
  lastRegionalChoice: { packId: string; environmentId: string } | null = null
  prepared: Prepared | null = null
  prepareError = false
  prepareProgress: { done: number; total: number } | null = null
  private preparing: { key: string; promise: Promise<Prepared> } | null = null
  private gen = 0
  run: Run | null = null
  summary: SessionSummary | null = null
  flash: string | null = null
  readonly nav: Navigator
  private readonly highlighter = new Highlighter()
  private hovered: SceneObject | null = null
  focusedObject: SceneObject | null = null
  private explore: ExploreView | null = null
  private overlay: Overlay = null
  private overlayStack: { kind: Overlay; el: HTMLElement; untrap: () => void; returnFocus: HTMLElement | null }[] = []
  private readonly pressed = new Set<string>()
  private cameraLineAcc = 0
  private lastCameraLine = ''
  private pointer: { id: number; x: number; y: number; startX: number; startY: number; at: number; moved: number } | null = null
  private hoverAt: { x: number; y: number } | null = null
  private readonly disposers: (() => void)[] = []
  private lastError: string | null = null

  constructor(
    readonly host: SuiteHost,
    readonly deps: SuiteDeps
  ) {
    this.settings = loadSettings(browserStorage(), prefersReducedMotion())
    this.savedProfile = host.profile.saved
    this.profileMode = this.savedProfile ? 'saved' : 'demo'
    this.nav = new Navigator(host.three.camera)

    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = SUITE_CSS
      document.head.appendChild(style)
    }
    this.root = h('div', { id: 'suite', hidden: true })
    this.backdrop = h('div', { class: 's-backdrop', 'aria-hidden': 'true' })
    this.stage = h('div', { class: 's-stage', hidden: true, 'aria-hidden': 'true' })
    this.screenEl = h('div', { class: 's-screen' })
    this.layer = h('div', { class: 's-overlays' })
    this.modalHost = h('div', { class: 's-modal-host' })
    this.root.append(this.backdrop, this.stage, this.screenEl, this.layer, this.modalHost)
    host.root.appendChild(this.root)

    // The house's document-level click handler asks for pointer lock; nothing inside the
    // suite should reach it.
    for (const type of ['click', 'mousedown', 'pointerdown', 'wheel', 'contextmenu'] as const) {
      this.root.addEventListener(type, (e) => e.stopPropagation())
    }
    this.bindStage()
    this.bindKeys()
    this.bindUnlock()
    this.applySettings()

    let initial = 'en'
    try {
      const lang = deps.suiteOf(this.savedProfile).language
      if (this.savedProfile && lang) initial = lang
    } catch {
      initial = 'en'
    }
    deps
      .loadI18n({ initial })
      .then((i18n) => {
        this.i18n = i18n
        this.disposers.push(i18n.onChange(() => this.onLanguageChanged()))
        this.applyLanguage()
        this.render()
      })
      .catch((err) => {
        console.error('[suite] strings could not be loaded', err)
        this.i18nError = true
        this.render()
      })
  }

  // ------------------------------------------------------------------ strings / settings

  t(key: string, vars?: Record<string, string | number>): string {
    return this.i18n ? this.i18n.t(key, vars) : ''
  }

  /** A key from another namespace, falling back to one of ours when it is missing. */
  tOr(key: string, fallbackKey: string, vars?: Record<string, string | number>): string {
    const s = this.t(key, vars)
    return !s || s === key ? this.t(fallbackKey, vars) : s
  }

  updateSettings(patch: Partial<SuiteSettings>): void {
    this.settings = { ...this.settings, ...patch, volume: { ...this.settings.volume, ...(patch.volume ?? {}) } }
    this.settingsSaved = saveSettings(browserStorage(), this.settings)
    if (this.run && patch.caregiverAssist !== undefined) this.run.assist = patch.caregiverAssist
    this.applySettings()
  }

  private applySettings(): void {
    const s = this.settings
    this.root.style.setProperty('--s-scale', String(s.textScale))
    this.root.classList.toggle('s-hc', s.highContrast)
    this.root.classList.toggle('s-rm', s.reducedMotion)
    this.nav.reducedMotion = s.reducedMotion
    if (this.run) {
      this.applyAudioSettings(this.run.audio)
      if (this.nav.mode !== s.navigation) this.nav.setMode(s.navigation)
      this.pressed.clear()
      this.nav.setMove({ x: 0, z: 0 })
    } else {
      this.nav.mode = s.navigation
    }
    this.explore?.update()
  }

  private applyAudioSettings(audio: SuiteAudio): void {
    const s = this.settings
    audio.setVolume('master', s.volume.master)
    audio.setVolume('voice', s.volume.voice)
    audio.setVolume('sounds', s.volume.sounds)
    audio.setMuted(s.muted)
    audio.setSpeechEnabled(s.speech)
  }

  private applyLanguage(): void {
    if (!this.i18n) return
    const info = this.i18n.info()
    this.root.lang = info.code
    this.root.dir = info.dir
    this.root.style.fontFamily = info.fontFamily
  }

  async setLanguage(code: string): Promise<void> {
    if (!this.i18n || code === this.i18n.language) return
    try {
      await this.i18n.setLanguage(code)
    } catch (err) {
      console.warn('[suite] language change failed', err)
    }
  }

  private onLanguageChanged(): void {
    this.applyLanguage()
    if (this.run && this.prepared) {
      const ov = this.prepared.resolved?.objectOverrides(this.prepared.pack.meta.id, this.prepared.environmentId)
      this.prepared.scene.relabel(this.i18n!, ov)
      this.explore?.rebuild()
    } else {
      // Resolved prompts and labels are per language: rebuild on the next use.
      this.disposePrepared()
    }
    this.render()
  }

  // ------------------------------------------------------------------ screens

  showHome(): void {
    if (this.run) this.endRun('exit', false)
    this.closeAllOverlays()
    this.active = true
    this.root.hidden = false
    this.host.setActive(true)
    this.go('home')
  }

  go(screen: Screen): void {
    if (screen !== 'explore' && this.run) this.endRun('exit', false)
    if (screen === 'home') this.summary = null
    this.screen = screen
    this.render()
  }

  render(): void {
    const explore = this.screen === 'explore'
    this.backdrop.hidden = explore
    this.stage.hidden = !explore
    this.screenEl.classList.toggle('s-explore', explore)
    if (this.screen !== 'explore') {
      this.explore?.destroy()
      this.explore = null
    }
    if (this.i18nError) {
      clear(this.screenEl)
      // Last resort: the strings themselves failed to load.
      this.screenEl.append(
        h('div', { class: 's-page' }, h('div', { class: 's-card', role: 'alert' },
          h('p', { lang: 'en' }, 'The activity space could not load its text. Please reload the page.')))
      )
      return
    }
    if (!this.i18n) {
      clear(this.screenEl)
      this.screenEl.append(h('div', { class: 's-page', 'aria-busy': 'true' }))
      return
    }
    if (explore) {
      if (!this.explore && this.run && this.prepared) {
        clear(this.screenEl)
        this.explore = new ExploreView(this, this.run, this.prepared)
        this.screenEl.append(this.explore.el)
        this.explore.focusTitle()
      }
      return
    }
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.k
    const scroll = this.screenEl.scrollTop
    const sameScreen = this.screenEl.dataset.screen === this.screen
    clear(this.screenEl)
    this.screenEl.dataset.screen = this.screen
    const page =
      this.screen === 'home' ? renderHome(this)
      : this.screen === 'summary' ? renderSummary(this)
      : null
    if (page) this.screenEl.append(page)
    if (sameScreen) {
      this.screenEl.scrollTop = scroll
      const again = focusKey ? this.screenEl.querySelector<HTMLElement>(`[data-k="${CSS.escape(focusKey)}"]`) : null
      again?.focus({ preventScroll: true })
    } else {
      this.screenEl.scrollTop = 0
      this.screenEl.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
    }
  }

  // ------------------------------------------------------------------ home actions

  setProfileMode(mode: 'saved' | 'demo'): void {
    if (mode === 'saved' && !this.savedProfile) return
    if (mode === this.profileMode) return
    this.profileMode = mode
    this.disposePrepared()
    this.choice = null
    this.render()
  }

  openCamera(): void {
    try {
      this.host.camera.openSetup()
    } catch (err) {
      console.warn('[suite] camera setup failed to open', err)
    }
  }

  cameraLine(): string {
    let s: { on: boolean; status: string | null }
    try {
      s = this.host.camera.summary()
    } catch {
      return this.t('app.camera.off')
    }
    if (!s.on) return this.t('app.camera.off')
    return s.status ? this.t('app.camera.status', { status: s.status }) : this.t('app.camera.on')
  }

  cameraOn(): boolean {
    try {
      return this.host.camera.summary().on
    } catch {
      return false
    }
  }

  openGuidedTasks(): void {
    this.leave()
    this.host.openGuidedTasks()
  }

  openHomePersonalisation(): void {
    try {
      this.host.openHomePersonalisation()
    } catch (err) {
      console.warn('[suite] home personalisation failed to open', err)
    }
  }

  async openCaregiverSetup(): Promise<void> {
    if (!this.i18n) return
    this.flash = this.t('app.home.caregiver.loading')
    this.render()
    let content: ContentState
    try {
      content = await this.ensureContent()
    } catch {
      this.flash = this.t('app.home.caregiver.failed')
      this.render()
      return
    }
    this.flash = null
    this.render()
    const returnTo = this.screenEl.querySelector<HTMLElement>('[data-k="caregiver-setup"]')
    try {
      this.deps.openCaregiverSetup({
        root: this.modalHost,
        i18n: this.i18n,
        profile: this.savedProfile,
        packs: content.ok,
        library: content.library,
        maxTextureSize: this.host.quality.maxTextureSize,
        onSaved: (profile) => {
          this.savedProfile = profile
          this.profileMode = 'saved'
          this.profileVersion++
          this.disposePrepared()
          this.choice = null
          this.flash = this.t('app.home.caregiver.saved')
          this.render()
        },
        onClose: () => {
          this.render()
          ;(this.screenEl.querySelector<HTMLElement>('[data-k="caregiver-setup"]') ?? returnTo)?.focus()
        }
      })
    } catch (err) {
      console.error('[suite] caregiver setup failed to open', err)
      this.flash = this.t('app.home.caregiver.failed')
      this.render()
    }
  }

  /** Hands the screen back to the house (guided tasks). */
  private leave(): void {
    if (this.run) this.endRun('exit', false)
    this.closeAllOverlays()
    this.disposePrepared()
    this.screen = 'hidden'
    this.root.hidden = true
    this.active = false
    // host.openGuidedTasks() (the only caller) hands the screen back via setActive(false).
  }

  // ------------------------------------------------------------------ content and place

  ensureContent(): Promise<ContentState> {
    if (!this.contentPromise) {
      this.contentError = false
      const promise = (async () => {
        const library = await this.deps.loadAssetLibrary()
        const { packs, problems } = await this.deps.loadContentPacks(library)
        const ok: LoadedContentPack[] = []
        const failed: LoadedContentPack[] = []
        for (const p of packs) {
          if (p.problems.some((e) => e.severity === 'error')) {
            failed.push(p)
            console.warn(`[suite] content pack "${p.meta.id}" is not offered because it has errors:`, p.problems)
          } else {
            ok.push(p)
            if (p.problems.length) console.info(`[suite] content pack "${p.meta.id}" warnings:`, p.problems)
          }
        }
        if (problems.length) console.warn('[suite] content problems:', problems)
        if (library.problems.length) console.info('[suite] asset library problems:', library.problems)
        const state: ContentState = { library, packs, ok, failed, problems }
        this.content = state
        return state
      })()
      promise.catch((err) => {
        console.error('[suite] content could not be loaded', err)
        this.contentError = true
        this.contentPromise = null
      })
      this.contentPromise = promise
    }
    return this.contentPromise
  }

  /** The default place: the saved profile's, else the first environment of the first general pack. */
  defaultChoice(content: ContentState): { packId: string; environmentId: string } | null {
    if (this.profileMode === 'saved' && this.savedProfile) {
      try {
        const sp = this.deps.suiteOf(this.savedProfile)
        const pack = content.ok.find((p) => p.meta.id === sp.packId)
        if (pack) {
          const env = pack.environments.find((e) => e.id === sp.environmentId) ?? pack.environments[0]
          if (env) return { packId: pack.meta.id, environmentId: env.id }
        }
      } catch {
        /* fall through to the general default */
      }
    }
    const general = content.ok.find((p) => !p.meta.regional && p.environments.length > 0)
    return general ? { packId: general.meta.id, environmentId: general.environments[0].id } : null
  }

  choose(packId: string, environmentId: string): void {
    if (this.choice?.packId === packId && this.choice.environmentId === environmentId) return
    this.choice = { packId, environmentId }
    this.rememberChoice(this.choice)
    this.disposePrepared()
    this.render()
  }

  /** Records a choice under its own group (general/regional) so the picker can show each
   * group's own last pick without disturbing the other's. */
  rememberChoice(choice: { packId: string; environmentId: string } | null): void {
    if (!choice || !this.content) return
    const pack = this.content.ok.find((p) => p.meta.id === choice.packId)
    if (!pack) return
    if (pack.meta.regional) this.lastRegionalChoice = choice
    else this.lastGeneralChoice = choice
  }

  // ------------------------------------------------------------------ prepare

  private prepareKey(): string | null {
    if (!this.choice || !this.i18n) return null
    return [this.profileMode, this.profileVersion, this.choice.packId, this.choice.environmentId, this.i18n.language].join('|')
  }

  prepare(): Promise<Prepared> {
    const key = this.prepareKey()
    if (!key || !this.i18n || !this.choice) return Promise.reject(new Error('nothing chosen'))
    if (this.prepared?.key === key) return Promise.resolve(this.prepared)
    if (this.preparing?.key === key) return this.preparing.promise
    this.disposePrepared()
    const gen = ++this.gen
    const i18n = this.i18n
    const choice = this.choice
    const profile = this.profileMode === 'saved' ? this.savedProfile : undefined
    this.prepareError = false
    this.prepareProgress = { done: 0, total: 1 }
    const promise = (async (): Promise<Prepared> => {
      const content = await this.ensureContent()
      const pack = content.ok.find((p) => p.meta.id === choice.packId)
      if (!pack || !pack.environments.some((e) => e.id === choice.environmentId)) throw new Error('place not available')
      let resolved: ResolvedSuiteProfile | null = null
      let media: SuiteMediaApi | null = null
      let packMedia: Prepared['packMedia'] | null = null
      let scene: SuiteScene | null = null
      const cleanup = (): void => {
        try { scene?.dispose() } catch { /* ignore */ }
        try { packMedia?.dispose() } catch { /* ignore */ }
        try { media?.dispose() } catch { /* ignore */ }
      }
      try {
        if (profile) {
          const r = await this.deps.resolveSuiteProfile(profile, i18n, this.host.quality.maxTextureSize)
          resolved = r.resolved
          media = r.media
        }
        packMedia = this.deps.packDisplayMedia(pack, i18n)
        scene = await this.deps.buildSuiteScene({
          pack,
          environmentId: choice.environmentId,
          library: content.library,
          i18n,
          overrides: resolved?.objectOverrides(pack.meta.id, choice.environmentId),
          avoidTopics: resolved?.topics.avoid ?? [],
          anisotropy: this.host.quality.anisotropy,
          maxTextureSize: this.host.quality.maxTextureSize,
          quality: this.host.quality.tier === 'software' ? 'low' : 'standard',
          onProgress: (done, total) => {
            if (gen !== this.gen) return
            this.prepareProgress = { done, total }
            this.onProgress()
          }
        })
      } catch (err) {
        cleanup()
        throw err
      }
      if (gen !== this.gen) {
        cleanup()
        throw new Error('superseded')
      }
      const ctx: ActivityContext = {
        scene,
        pack,
        profile: resolved,
        demoPhotos: packMedia.demoPhotos,
        packSounds: packMedia.packSounds,
        i18n
      }
      const prepared: Prepared = {
        key, pack, environmentId: choice.environmentId, scene, resolved, media, packMedia, ctx,
        attached: false, photoOnObject: new Map()
      }
      return prepared
    })()
    this.preparing = { key, promise }
    promise.then(
      (p) => {
        if (this.preparing?.promise !== promise) return
        this.preparing = null
        this.prepared = p
        this.prepareProgress = null
        if (p.scene.report.missingAssets.length || p.scene.report.rejectedPlacements.length) {
          console.info('[suite] scene report', p.scene.report)
        }
        if (this.screen === 'home') this.render()
      },
      (err) => {
        if (this.preparing?.promise !== promise) return
        this.preparing = null
        this.prepareProgress = null
        this.prepareError = true
        console.error('[suite] the room could not be prepared', err)
        if (this.screen === 'home') this.render()
      }
    )
    return promise
  }

  private onProgress(): void {
    const bar = this.root.querySelector<HTMLElement>('[data-progress]')
    const p = this.prepareProgress
    if (!bar || !p) return
    const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0
    bar.setAttribute('aria-valuenow', String(pct))
    const fill = bar.firstElementChild as HTMLElement | null
    if (fill) fill.style.width = `${pct}%`
  }

  disposePrepared(): void {
    this.gen++
    this.preparing = null
    this.prepareProgress = null
    const p = this.prepared
    this.prepared = null
    if (!p) return
    if (this.run) this.endRun('exit', false)
    this.highlighter.clear()
    this.hovered = null
    this.focusedObject = null
    if (p.attached) {
      p.scene.root.removeFromParent()
      p.attached = false
    }
    for (const o of p.scene.objects) {
      try { o.photoSurface?.reset() } catch { /* ignore */ }
    }
    try { p.scene.dispose() } catch (err) { console.warn('[suite] scene dispose failed', err) }
    try { p.packMedia.dispose() } catch (err) { console.warn('[suite] pack media dispose failed', err) }
    try { p.media?.dispose() } catch (err) { console.warn('[suite] profile media dispose failed', err) }
    this.nav.setScene(null)
  }

  /** Activities in display order: the caregiver's sequence first in guided mode. */
  activityOrder(): ActivityKind[] {
    const kinds: ActivityKind[] = ACTIVITY_KINDS.filter((k) => !!this.deps.ACTIVITIES[k])
    const guided = this.profileMode === 'saved' && this.prepared?.resolved?.mode === 'guided'
    if (guided && kinds.includes('sequence')) return ['sequence', ...kinds.filter((k) => k !== 'sequence')]
    return kinds
  }

  availability(kind: ActivityKind): { ok: true } | { ok: false; reasonKey: string } | null {
    if (!this.prepared) return null
    try {
      return this.deps.ACTIVITIES[kind].available(this.prepared.ctx)
    } catch (err) {
      console.warn(`[suite] availability of "${kind}" failed`, err)
      return { ok: false, reasonKey: 'app.activity.unavailable' }
    }
  }

  // ------------------------------------------------------------------ explore

  async startActivity(kind: ActivityKind): Promise<void> {
    if (this.run) this.endRun('exit', false)
    this.showProgress()
    let prep: Prepared
    try {
      prep = await this.prepare()
    } catch (err) {
      this.closeOverlay('progress')
      this.prepareError = true
      this.lastError = String(err)
      this.go('home')
      return
    }
    const avail = this.availability(kind)
    if (!avail || !avail.ok) {
      this.closeOverlay('progress')
      this.go('home')
      return
    }
    const { scene } = prep
    if (!prep.attached) {
      this.host.three.scene.add(scene.root)
      prep.attached = true
    }
    this.host.setActive(true)
    this.nav.reducedMotion = this.settings.reducedMotion
    this.nav.mode = this.settings.navigation
    this.nav.setScene(scene)
    this.host.three.refreshShadows()
    try {
      await this.applyPhotos(prep)
    } catch (err) {
      console.warn('[suite] photos could not be shown', err)
    }
    if (this.prepared !== prep) return

    const i18n = this.i18n!
    const audio = new SuiteAudio({
      context: this.host.listener.context,
      speechLangFor: (code) => {
        try {
          return i18n.info(code).speechLang
        } catch {
          return code
        }
      }
    })
    this.applyAudioSettings(audio)
    let session: ActivitySessionApi
    try {
      session = this.deps.createActivitySession({
        definition: this.deps.ACTIVITIES[kind],
        context: prep.ctx,
        audio,
        telemetry: this.host.telemetry
      })
    } catch (err) {
      console.error('[suite] the activity could not start', err)
      audio.dispose()
      this.closeOverlay('progress')
      this.lastError = String(err)
      this.go('home')
      return
    }
    const assist = this.profileMode === 'saved' && prep.resolved ? prep.resolved.caregiverAssist : this.settings.caregiverAssist
    const run: Run = {
      kind, session, audio, sampler: new VisionSampler(1), startedAt: performance.now(), unsubs: [],
      lastItemId: undefined, gentleCues: 0, cueFor: null, selected: null, objectCloseup: null, ending: false,
      assist, noteDraft: ''
    }
    this.run = run
    this.summary = null
    run.unsubs.push(session.onChange(() => this.onSessionChange()))
    run.unsubs.push(audio.onChange(() => this.explore?.update()))

    this.closeOverlay('progress')
    this.screen = 'explore'
    this.render()

    this.host.state.resetTimers()
    this.host.state.set('exploring')
    this.host.camera.attach(session.adaptable)
    session.start()
    this.onSessionChange()
  }

  private async applyPhotos(prep: Prepared): Promise<void> {
    const personal = prep.resolved !== null
    const photos = personal ? prep.resolved!.photos : prep.packMedia.demoPhotos
    const map = this.deps.assignPhotos(prep.scene, photos)
    prep.photoOnObject = new Map()
    for (const obj of prep.scene.objects) {
      const surface = obj.photoSurface
      if (!surface) continue
      const photo = map.get(obj.id)
      if (photo && (!personal || photo.personal)) {
        const texture = await photo.texture()
        if (this.prepared !== prep) return
        if (texture) {
          surface.show(texture, photo.width / Math.max(1, photo.height))
          // A frame is personal only when it shows a caregiver's photograph; a demo picture
          // shown the same way stays demo content.
          obj.personal = photo.personal
          prep.photoOnObject.set(obj.id, photo)
          continue
        }
      }
      // In a personal session a frame without a personal photograph shows a plain mat, so
      // a demo picture is never mistaken for a personal one. The demo keeps its pictures.
      obj.personal = false
      if (personal) surface.blank()
      else surface.reset()
    }
    this.host.three.refreshShadows()
  }

  objectById(id: string | undefined | null): SceneObject | null {
    if (!id || !this.prepared) return null
    return this.prepared.scene.objects.find((o) => o.id === id) ?? null
  }

  /** The scene object an item is about: its own objectId, or the frame showing its photo. */
  objectForItem(item: ActivityItem | null): SceneObject | null {
    if (!item || !this.prepared) return null
    const direct = this.objectById(item.objectId)
    if (direct) return direct
    if (item.kind === 'photo') {
      for (const [objectId, photo] of this.prepared.photoOnObject) if (photo.id === item.photo.id) return this.objectById(objectId)
    }
    return null
  }

  private onSessionChange(): void {
    const run = this.run
    if (!run || run.ending) return
    const { session } = run
    const current = session.current
    if (current?.id !== run.lastItemId) {
      run.lastItemId = current?.id ?? null
      run.cueFor = null
      this.closeLightbox(true)
      if (run.objectCloseup) {
        run.objectCloseup = null
        session.noteCloseup(false)
      }
      if (current) {
        const obj = this.objectForItem(current)
        // A person's own choice (selectObject) has already started the move.
        if (obj && obj !== run.selected) this.nav.goTo(obj.viewpoint)
        else if (!obj && current.kind === 'space') this.nav.goToSeat()
        if (obj !== run.selected) run.selected = null
      }
    }
    const cues = session.log.filter((e) => e.kind === 'gentle_cue')
    if (cues.length > run.gentleCues) {
      run.gentleCues = cues.length
      const last = cues[cues.length - 1]
      if (last.kind === 'gentle_cue') run.cueFor = last.itemId
    }
    if (session.ended) {
      this.endRun('finished-by-session')
      return
    }
    if (session.paused && this.overlay !== 'pause' && !this.overlayStack.some((o) => o.kind === 'pause')) this.showPause()
    if (!session.paused && this.overlayStack.some((o) => o.kind === 'pause')) this.closeOverlay('pause')
    this.explore?.update()
  }

  // Panel actions ---------------------------------------------------------------------

  replay(): void {
    this.run?.session.replayPrompt()
  }

  isLastItem(): boolean {
    const s = this.run?.session
    return !!s && s.items.length > 0 && s.index >= s.items.length - 1
  }

  next(): void {
    const run = this.run
    if (!run) return
    if (this.isLastItem()) this.endRun('finish')
    else run.session.next()
  }

  previous(): void {
    this.run?.session.previous()
  }

  skip(): void {
    const run = this.run
    if (!run) return
    const last = this.isLastItem()
    run.session.skip()
    if (last && this.run === run && !run.ending) this.endRun('finish')
  }

  togglePause(): void {
    const run = this.run
    if (!run) return
    if (run.session.paused) {
      run.session.resume()
      this.host.state.resume()
      run.audio.resume()
      this.closeOverlay('pause')
    } else {
      run.session.pause()
      this.host.state.pause()
      run.audio.pause()
      this.pressed.clear()
      this.nav.setMove({ x: 0, z: 0 })
      this.showPause()
    }
    this.explore?.update()
  }

  toggleSound(): void {
    const run = this.run
    if (!run) return
    if (run.audio.playing.sounds) run.session.stopSound()
    else run.session.playSound()
  }

  canCloseup(): boolean {
    const run = this.run
    if (!run) return false
    const cur = run.session.current
    if (cur?.kind === 'photo') return true
    return !!(this.objectForItem(cur) ?? run.selected)
  }

  openCloseup(): void {
    const run = this.run
    if (!run) return
    const cur = run.session.current
    if (cur?.kind === 'photo') {
      this.explore?.openLightbox(cur.photo, cur)
      run.session.noteCloseup(true)
      return
    }
    const obj = this.objectForItem(cur) ?? run.selected
    if (!obj) return
    run.objectCloseup = obj
    const vp = obj.viewpoint
    const closer = vp.position.clone().lerp(vp.target, 0.3)
    this.nav.goTo({ position: closer, target: vp.target.clone() })
    run.session.noteCloseup(true)
    this.explore?.update()
    this.explore?.focusCloseup()
  }

  closeObjectCloseup(): void {
    const run = this.run
    if (!run || !run.objectCloseup) return
    const obj = run.objectCloseup
    run.objectCloseup = null
    this.nav.goTo(obj.viewpoint)
    run.session.noteCloseup(false)
    this.explore?.update()
    this.explore?.focusAction('closeup')
  }

  /** Closes the photo lightbox (if open), logging it unless the item already changed. */
  closeLightbox(silent = false): void {
    if (!this.explore?.lightboxOpen) return
    this.explore.closeLightbox(!silent)
    if (this.run) this.run.session.noteCloseup(false)
  }

  backToRoom(): void {
    if (this.run?.objectCloseup) {
      this.run.objectCloseup = null
      this.run.session.noteCloseup(false)
    }
    if (this.run) this.run.selected = null
    this.nav.goToSeat()
    this.explore?.update()
  }

  selectObject(id: string): void {
    const run = this.run
    const obj = this.objectById(id)
    if (!run || !obj) return
    if (run.objectCloseup) {
      run.objectCloseup = null
      run.session.noteCloseup(false)
    }
    run.selected = obj
    this.nav.goTo(obj.viewpoint)
    run.session.selectObject(id)
    this.explore?.update()
  }

  goToItem(itemId: string): void {
    this.run?.session.goTo(itemId)
  }

  addNote(text: string): boolean {
    const run = this.run
    const note = text.trim()
    if (!run || !note) return false
    run.session.addNote(note, run.session.current?.id)
    run.noteDraft = ''
    return true
  }

  askExit(): void {
    if (!this.run) return
    this.openOverlay('exit', (close) => {
      const dialog = h('div', { class: 's-card s-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's-exit-title' },
        h('h2', { id: 's-exit-title', text: this.t('app.exit.title') }),
        h('p', { class: 's-muted', text: this.t('app.exit.body') }),
        h('div', { class: 's-row' },
          h('button', { type: 'button', class: 's-primary', 'data-autofocus': true, onclick: () => close() }, this.t('app.exit.stay')),
          h('button', { type: 'button', onclick: () => { close(); this.endRun('exit') } }, this.t('app.exit.confirm'))))
      return dialog
    })
  }

  private showPause(): void {
    if (this.overlayStack.some((o) => o.kind === 'pause')) return
    this.openOverlay('pause', () =>
      h('div', { class: 's-card s-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's-pause-title' },
        h('h2', { id: 's-pause-title', text: this.t('app.pause.title') }),
        h('p', { text: this.t('app.pause.body') }),
        h('div', { class: 's-row' },
          h('button', { type: 'button', class: 's-primary', 'data-autofocus': true, onclick: () => this.togglePause() }, this.t('app.pause.resume')),
          h('button', { type: 'button', onclick: () => this.openSettings() }, this.t('app.pause.settings')),
          h('button', { type: 'button', onclick: () => this.askExit() }, this.t('app.pause.end'))))
    )
  }

  openSettings(): void {
    const returnTo = document.activeElement as HTMLElement | null
    this.openOverlay('settings', (close) => renderSettingsDialog(this, close))
    this.overlayStack[this.overlayStack.length - 1].returnFocus = returnTo
  }

  /** Re-renders an open settings dialog in place (after a change that affects its text). */
  refreshSettingsDialog(): void {
    const entry = this.overlayStack.find((o) => o.kind === 'settings')
    if (!entry) return
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.k
    const close = (): void => this.closeOverlay('settings')
    const next = renderSettingsDialog(this, close)
    clear(entry.el)
    entry.el.append(next)
    if (focusKey) entry.el.querySelector<HTMLElement>(`[data-k="${CSS.escape(focusKey)}"]`)?.focus()
  }

  private showProgress(): void {
    if (this.prepared && this.prepareKey() === this.prepared.key) return
    this.openOverlay('progress', () =>
      h('div', { class: 's-card s-dialog s-progress', role: 'status', 'aria-live': 'polite' },
        h('p', { text: this.t('app.explore.building') }),
        h('div', { class: 's-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, 'data-progress': true,
          'aria-label': this.t('app.explore.building') }, h('span'))))
    this.onProgress()
  }

  private openOverlay(kind: Overlay, build: (close: () => void) => HTMLElement): void {
    this.closeOverlay(kind)
    const wrap = h('div', { class: 's-layer' })
    const close = (): void => this.closeOverlay(kind)
    wrap.append(build(close))
    this.layer.append(wrap)
    const returnFocus = document.activeElement as HTMLElement | null
    const untrap = trapFocus(wrap)
    this.overlayStack.push({ kind, el: wrap, untrap, returnFocus })
    this.overlay = kind
    focusFirst(wrap)
  }

  closeOverlay(kind: Overlay): void {
    const i = this.overlayStack.findIndex((o) => o.kind === kind)
    if (i < 0) return
    const [entry] = this.overlayStack.splice(i, 1)
    entry.untrap()
    entry.el.remove()
    this.overlay = this.overlayStack.length ? this.overlayStack[this.overlayStack.length - 1].kind : null
    if (entry.returnFocus && entry.returnFocus.isConnected) entry.returnFocus.focus({ preventScroll: true })
    else if (this.overlayStack.length) focusFirst(this.overlayStack[this.overlayStack.length - 1].el)
  }

  private closeAllOverlays(): void {
    while (this.overlayStack.length) {
      const entry = this.overlayStack.pop()!
      entry.untrap()
      entry.el.remove()
    }
    this.overlay = null
  }

  /**
   * Ends the running session. 'finish' / 'exit' ask the session for its summary; the
   * session ending itself is handled the same way. `show` false tears down silently.
   */
  endRun(how: 'finish' | 'exit' | 'finished-by-session', show = true): void {
    const run = this.run
    if (!run || run.ending) return
    run.ending = true
    const end = performance.now()
    if (this.explore?.lightboxOpen) {
      this.explore.closeLightbox(false)
      try { run.session.noteCloseup(false) } catch { /* ignore */ }
    } else if (run.objectCloseup) {
      try { run.session.noteCloseup(false) } catch { /* ignore */ }
    }
    run.objectCloseup = null
    let summary: SessionSummary
    try {
      summary = how === 'exit' ? run.session.exit() : run.session.finish()
    } catch (err) {
      console.warn('[suite] the session did not return a summary; building one from its log', err)
      const prep = this.prepared
      summary = summaryFromLog({
        log: run.session.log,
        items: run.session.items,
        objects: prep?.scene.objects ?? [],
        activity: run.kind,
        packId: prep?.pack.meta.id ?? '',
        environmentId: prep?.environmentId ?? '',
        profile: this.profileMode,
        language: this.i18n?.language ?? 'en',
        startedAt: new Date(Date.now() - (end - run.startedAt)).toISOString(),
        endedBy: how === 'exit' ? 'exited' : 'finished'
      })
    }
    let records: readonly import('../../camera/AdaptationPolicy').AdaptationRecord[] = []
    try {
      records = this.host.camera.adaptations()
    } catch {
      records = []
    }
    summary = {
      ...summary,
      vision: computeVisionNote({
        samples: run.sampler.samples,
        records,
        window: { start: run.startedAt, end },
        log: run.session.log,
        label: this.t('app.summary.vision.label')
      })
    }
    for (const u of run.unsubs) {
      try { u() } catch { /* ignore */ }
    }
    run.audio.dispose()
    try { this.host.camera.attach(null) } catch { /* ignore */ }
    try { this.host.state.set('completed') } catch { /* ignore */ }
    this.run = null
    this.pressed.clear()
    this.nav.setMove({ x: 0, z: 0 })
    this.highlighter.clear()
    this.hovered = null
    this.focusedObject = null
    this.closeAllOverlays()
    this.summary = summary
    this.disposePrepared()
    if (show) {
      this.screen = 'summary'
      this.render()
    }
  }

  downloadSummary(): void {
    if (!this.summary) return
    const payload = {
      kind: 'memoria-suite-session-summary',
      version: 1,
      note: this.t('app.summary.exportNote'),
      summary: this.summary
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = h('a', { href: url, download: `memoria-suite-summary-${this.summary.startedAt.replace(/[:.]/g, '-')}.json` })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }

  // ------------------------------------------------------------------ input

  setFocusedObject(obj: SceneObject | null): void {
    this.focusedObject = obj
    this.syncHighlight()
  }

  private syncHighlight(): void {
    this.highlighter.set(this.focusedObject ?? this.hovered)
  }

  private ndc(x: number, y: number): { x: number; y: number } {
    const rect = this.host.three.renderer.domElement.getBoundingClientRect()
    return { x: ((x - rect.left) / Math.max(1, rect.width)) * 2 - 1, y: -((y - rect.top) / Math.max(1, rect.height)) * 2 + 1 }
  }

  private pick(x: number, y: number): SceneObject | null {
    if (!this.prepared) return null
    return pickObject(this.ndc(x, y), this.host.three.camera, this.prepared.scene.objects)
  }

  private bindStage(): void {
    const st = this.stage
    st.addEventListener('pointerdown', (e) => {
      if (!this.run || this.run.session.paused) return
      if (this.pointer) return
      st.setPointerCapture?.(e.pointerId)
      this.pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, at: performance.now(), moved: 0 }
    })
    st.addEventListener('pointermove', (e) => {
      const p = this.pointer
      if (p && p.id === e.pointerId) {
        const dx = e.clientX - p.x
        const dy = e.clientY - p.y
        p.x = e.clientX
        p.y = e.clientY
        p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.startX, e.clientY - p.startY))
        if (classifyGesture(p.moved, 0) === 'drag') {
          st.classList.add('s-dragging')
          this.nav.lookBy(dx, dy)
        }
        return
      }
      if (e.pointerType === 'mouse') this.hoverAt = { x: e.clientX, y: e.clientY }
    })
    const up = (e: PointerEvent, cancelled: boolean): void => {
      const p = this.pointer
      if (!p || p.id !== e.pointerId) return
      this.pointer = null
      st.classList.remove('s-dragging')
      if (cancelled) return
      if (classifyGesture(p.moved, performance.now() - p.at) === 'tap') {
        const obj = this.pick(e.clientX, e.clientY)
        if (obj) this.selectObject(obj.id)
      }
    }
    st.addEventListener('pointerup', (e) => up(e, false))
    st.addEventListener('pointercancel', (e) => up(e, true))
    st.addEventListener('pointerleave', () => {
      this.hoverAt = null
      if (this.hovered) {
        this.hovered = null
        st.classList.remove('s-over')
        this.syncHighlight()
      }
    })
  }

  private keyContext(): KeyContext {
    const activeEl = document.activeElement
    const inList = !!activeEl?.closest?.('[data-object-list]')
    return {
      screen: this.active ? this.screen : 'hidden',
      typing: isTyping(activeEl),
      onControl: isControl(activeEl),
      inObjectList: inList,
      walkMode: this.nav.mode === 'walk',
      closeupOpen: !!this.explore?.lightboxOpen,
      modalOpen: this.overlayStack.length > 0,
      blocked: keysBlocked(document, this.modalHost)
    }
  }

  private bindKeys(): void {
    const onDown = (e: KeyboardEvent): void => {
      if (!this.active) return
      const ctx = this.keyContext()
      const action = keyAction(e, ctx)
      if (!action) return
      switch (action) {
        case 'escape':
          e.preventDefault()
          this.escape()
          break
        case 'zoom-in':
          e.preventDefault()
          this.explore?.zoomBy(1.25)
          break
        case 'zoom-out':
          e.preventDefault()
          this.explore?.zoomBy(1 / 1.25)
          break
        case 'replay':
          e.preventDefault()
          this.replay()
          break
        case 'pause-toggle':
          e.preventDefault()
          this.togglePause()
          break
        case 'select-focused': {
          const obj = this.focusedObject ?? this.hovered
          if (obj) {
            e.preventDefault()
            this.selectObject(obj.id)
          }
          break
        }
        case 'focus-next-object':
        case 'focus-prev-object':
          e.preventDefault()
          this.explore?.moveObjectFocus(action === 'focus-next-object' ? 1 : -1)
          break
        case 'walk':
          e.preventDefault()
          if (this.run && !this.run.session.paused) {
            this.pressed.add(e.code)
            this.nav.setMove(walkVector(this.pressed))
          }
          break
      }
    }
    const onUp = (e: KeyboardEvent): void => {
      if (this.pressed.delete(e.code)) this.nav.setMove(walkVector(this.pressed))
    }
    const onBlur = (): void => {
      this.pressed.clear()
      this.nav.setMove({ x: 0, z: 0 })
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', onBlur)
    this.disposers.push(() => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', onBlur)
    })
  }

  private escape(): void {
    if (this.explore?.lightboxOpen) {
      this.closeLightbox()
      return
    }
    const top = this.overlayStack[this.overlayStack.length - 1]
    if (top) {
      if (top.kind === 'pause') this.togglePause()
      else if (top.kind !== 'progress') this.closeOverlay(top.kind)
      return
    }
    if (this.run?.objectCloseup) {
      this.closeObjectCloseup()
      return
    }
    if (this.screen === 'explore') this.askExit()
  }

  private bindUnlock(): void {
    const unlock = (): void => {
      const ctx = this.host.listener.context
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => undefined)
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    }
    window.addEventListener('pointerdown', unlock, true)
    window.addEventListener('keydown', unlock, true)
    this.disposers.push(() => {
      window.removeEventListener('pointerdown', unlock, true)
      window.removeEventListener('keydown', unlock, true)
    })
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    if (!this.active) return
    const run = this.run
    if (run && this.prepared) {
      this.nav.update(dt)
      this.prepared.scene.update?.(dt)
      if (!run.session.paused && !run.session.ended) {
        run.sampler.tick(dt, () => {
          const s = this.host.camera.summary()
          if (!s.on) return { on: false, usable: false }
          return { on: true, usable: this.host.camera.snapshot().visionUsable === true }
        })
      }
      if (this.hoverAt && !this.pointer && !this.nav.moving) {
        const obj = this.pick(this.hoverAt.x, this.hoverAt.y)
        this.hoverAt = null
        if (obj !== this.hovered) {
          this.hovered = obj
          this.stage.classList.toggle('s-over', !!obj)
          this.syncHighlight()
        }
      }
    }
    this.cameraLineAcc += dt
    if (this.cameraLineAcc >= 1) {
      this.cameraLineAcc = 0
      const line = this.i18n ? this.cameraLine() + (this.cameraOn() ? '1' : '0') : ''
      if (line !== this.lastCameraLine) {
        this.lastCameraLine = line
        this.refreshCameraLines()
      }
    }
  }

  private refreshCameraLines(): void {
    const on = this.cameraOn()
    const text = this.cameraLine()
    for (const el of this.root.querySelectorAll<HTMLElement>('[data-camera-line]')) {
      el.textContent = text
      if (el.dataset.cameraLine === 'hide-off') el.hidden = !on
    }
  }

  // ------------------------------------------------------------------ public API

  readonly debug: Record<string, unknown> = this.makeDebug()

  private makeDebug(): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return {
      get screen() { return self.screen },
      get active() { return self.active },
      get language() { return self.i18n?.language ?? null },
      get sceneReport() { return self.prepared?.scene.report ?? null },
      get settings() { return { ...self.settings, volume: { ...self.settings.volume } } },
      get summary() { return self.summary },
      get profileMode() { return self.profileMode },
      get choice() { return self.choice },
      get lastError() { return self.lastError },
      get content() {
        const c = self.content
        return c ? { ok: c.ok.map((p) => p.meta.id), failed: c.failed.map((p) => p.meta.id), problems: c.problems.length } : null
      },
      get session() {
        const run = self.run
        if (!run) return null
        const s = run.session
        return {
          activity: s.activity,
          index: s.index,
          current: s.current ? { id: s.current.id, kind: s.current.kind, title: s.current.title, objectId: s.current.objectId ?? null } : null,
          items: s.items.map((i) => ({ id: i.id, kind: i.kind, personal: i.personal })),
          paused: s.paused,
          ended: s.ended,
          assist: run.assist,
          closeup: run.objectCloseup?.id ?? (self.explore?.lightboxOpen ? 'photo' : null),
          visionSamples: run.sampler.samples.length,
          log: [...s.log]
        }
      },
      get camera() {
        const c = self.host.three.camera
        return { position: c.position.toArray(), rotation: [c.rotation.x, c.rotation.y, c.rotation.z], moving: self.nav.moving, mode: self.nav.mode }
      },
      showHome: () => self.showHome(),
      start: async (packId: string, environmentId: string, activity: ActivityKind, profile: 'demo' | 'saved' = 'demo') => {
        if (!self.i18n) throw new Error('strings are not loaded yet')
        if (profile === 'saved' && !self.savedProfile) throw new Error('no saved profile')
        self.active = true
        self.root.hidden = false
        self.host.setActive(true)
        if (self.profileMode !== profile) {
          self.profileMode = profile
          self.disposePrepared()
        }
        const content = await self.ensureContent()
        if (!content.ok.some((p) => p.meta.id === packId)) throw new Error(`pack not offered: ${packId}`)
        self.choice = { packId, environmentId }
        self.screen = 'home'
        await self.startActivity(activity)
        if (!self.run) throw new Error(self.lastError ?? `activity "${activity}" could not start`)
        return self.debug.session
      },
      select: (objectId: string) => self.selectObject(objectId),
      goTo: (itemId: string) => self.goToItem(itemId),
      next: () => self.next(),
      previous: () => self.previous(),
      skip: () => self.skip(),
      replay: () => self.replay(),
      pause: () => { if (self.run && !self.run.session.paused) self.togglePause() },
      resume: () => { if (self.run?.session.paused) self.togglePause() },
      closeup: () => self.openCloseup(),
      closeCloseup: () => { self.closeLightbox(); self.closeObjectCloseup() },
      note: (text: string) => self.addNote(text),
      exit: () => { self.endRun('exit'); return self.summary },
      finish: () => { self.endRun('finish'); return self.summary },
      setLanguage: (code: string) => self.setLanguage(code),
      setSettings: (patch: Partial<SuiteSettings>) => self.updateSettings(patch),
      go: (screen: Screen) => self.go(screen),
      openSettings: () => self.openSettings(),
      pick: (x: number, y: number) => self.pick(x, y)?.id ?? null
    }
  }

  api(): SuiteAppApi {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this
    return {
      get active() { return self.active },
      showHome: () => self.showHome(),
      update: (dt: number) => self.update(dt),
      debug: this.debug
    }
  }
}

export function createSuiteAppWith(host: SuiteHost, deps: SuiteDeps): SuiteAppApi {
  return new SuiteController(host, deps).api()
}
