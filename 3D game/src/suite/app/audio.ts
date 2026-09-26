/**
 * SuiteAudio: prompt voice and sounds on independent channels, a master level and mute.
 *
 * Recorded audio first; speech synthesis only when enabled and a voice exists for the
 * language; otherwise nothing is spoken (the text is always on screen). Nothing here
 * throws to the caller: a failed load or play resolves 'text-only' / false.
 *
 * Elements go through WebAudio gain nodes when the shared context is running (this also
 * works where `HTMLMediaElement.volume` is read-only), and fall back to `volume`.
 * The pure decision helpers at the top need no DOM.
 */
import type { AudioChannel, DisplaySound, LanguageCode, ResolvedPrompt, SuiteAudioApi } from '../contracts'

export type PromptRoute = 'audio' | 'speech' | 'text-only'

export interface VoiceLike {
  lang: string
  name?: string
  localService?: boolean
  default?: boolean
}

const norm = (tag: string): string => tag.replace(/_/g, '-').toLowerCase()

/** The best voice for `speechLang`: exact tag, else the same primary subtag. */
export function findVoice<V extends VoiceLike>(voices: readonly V[], speechLang: string): V | null {
  if (!speechLang) return null
  const want = norm(speechLang)
  const primary = want.split('-')[0]
  const rank = (v: V): number => (v.localService ? 2 : 0) + (v.default ? 1 : 0)
  const exact = voices.filter((v) => norm(v.lang) === want).sort((a, b) => rank(b) - rank(a))
  if (exact.length) return exact[0]
  const loose = voices.filter((v) => norm(v.lang).split('-')[0] === primary).sort((a, b) => rank(b) - rank(a))
  return loose[0] ?? null
}

/** Which way a prompt would be presented, before trying it. */
export function choosePromptRoute(
  prompt: Pick<ResolvedPrompt, 'audioUrl' | 'lang'>,
  opts: { muted: boolean; speechEnabled: boolean; speechSupported: boolean; hasVoice: (lang: LanguageCode) => boolean }
): PromptRoute {
  if (opts.muted) return 'text-only'
  if (prompt.audioUrl) return 'audio'
  if (opts.speechEnabled && opts.speechSupported && opts.hasVoice(prompt.lang)) return 'speech'
  return 'text-only'
}

/** Effective 0–1 level for a channel. */
export function channelLevel(master: number, channel: number, muted: boolean): number {
  if (muted) return 0
  return Math.min(1, Math.max(0, master)) * Math.min(1, Math.max(0, channel))
}

// ---------------------------------------------------------------------------------------

interface Playing {
  el: HTMLAudioElement
  source: MediaElementAudioSourceNode | null
  channel: AudioChannel
  finish: () => void
}

export interface SuiteAudioOptions {
  /** The shared AudioContext (host.listener.context). Optional. */
  context?: AudioContext | null
  /** The speech-synthesis tag for a language code (from i18n.info(code).speechLang). */
  speechLangFor: (lang: LanguageCode) => string
  /** Injected for tests; defaults to window.speechSynthesis. */
  speech?: SpeechSynthesis | null
  /** How long to wait for a recording to start before presenting text only. */
  startTimeoutMs?: number
}

export class SuiteAudio implements SuiteAudioApi {
  private readonly ctx: AudioContext | null
  private readonly speech: SpeechSynthesis | null
  private readonly speechLangFor: (lang: LanguageCode) => string
  private readonly startTimeoutMs: number
  private gains: Record<'master' | AudioChannel, GainNode> | null = null
  private levels = { master: 0.8, voice: 1, sounds: 0.8 }
  private muted = false
  private speechEnabled = true
  private voices: SpeechSynthesisVoice[] = []
  private readonly active = new Set<Playing>()
  private utterance: SpeechSynthesisUtterance | null = null
  private readonly listeners = new Set<() => void>()
  private readonly state: Record<AudioChannel, boolean> = { voice: false, sounds: false }
  private disposed = false
  private readonly onVoices = (): void => this.refreshVoices()
  private token = 0

  constructor(options: SuiteAudioOptions) {
    this.ctx = options.context ?? null
    this.speechLangFor = options.speechLangFor
    this.startTimeoutMs = options.startTimeoutMs ?? 8000
    let speech: SpeechSynthesis | null = null
    try {
      speech = options.speech !== undefined ? options.speech : typeof speechSynthesis !== 'undefined' ? speechSynthesis : null
    } catch {
      speech = null
    }
    this.speech = speech
    if (this.speech) {
      this.refreshVoices()
      try {
        this.speech.addEventListener('voiceschanged', this.onVoices)
      } catch {
        /* older engines: getVoices() polling in waitForVoices covers it */
      }
    }
  }

  get playing(): Readonly<Record<AudioChannel, boolean>> {
    return { ...this.state }
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  setVolume(channel: 'master' | AudioChannel, value: number): void {
    this.levels[channel] = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
    this.applyLevels()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.applyLevels()
    if (muted && this.utterance) this.stopSpeech()
  }

  setSpeechEnabled(enabled: boolean): void {
    this.speechEnabled = enabled
    if (!enabled) this.stopSpeech()
  }

  speechAvailable(lang: LanguageCode): boolean {
    return !!this.speech && !!findVoice(this.voices, this.speechLangFor(lang))
  }

  async playPrompt(prompt: ResolvedPrompt): Promise<PromptRoute> {
    if (this.disposed) return 'text-only'
    this.stop('voice')
    const token = ++this.token
    if (!prompt.audioUrl && this.speechEnabled && this.speech && this.voices.length === 0) await this.waitForVoices(800)
    if (token !== this.token) return 'text-only'
    const route = choosePromptRoute(prompt, {
      muted: this.muted,
      speechEnabled: this.speechEnabled,
      speechSupported: !!this.speech,
      hasVoice: (lang) => this.speechAvailable(lang)
    })
    if (route === 'audio') return (await this.playElement(prompt.audioUrl!, 'voice')) ? 'audio' : 'text-only'
    if (route === 'speech') return this.speak(prompt)
    return 'text-only'
  }

  async playSound(sound: DisplaySound): Promise<boolean> {
    if (this.disposed) return false
    this.stop('sounds')
    return this.playElement(sound.url, 'sounds')
  }

  stop(channel?: AudioChannel): void {
    for (const p of [...this.active]) {
      if (channel && p.channel !== channel) continue
      try {
        p.el.pause()
      } catch {
        /* ignore */
      }
      p.finish()
    }
    if (!channel || channel === 'voice') {
      this.token++
      this.stopSpeech()
    }
  }

  pause(): void {
    for (const p of this.active) {
      try {
        p.el.pause()
      } catch {
        /* ignore */
      }
    }
    try {
      if (this.utterance) this.speech?.pause()
    } catch {
      /* ignore */
    }
  }

  resume(): void {
    for (const p of this.active) p.el.play().catch(() => p.finish())
    try {
      if (this.utterance) this.speech?.resume()
    } catch {
      /* ignore */
    }
  }

  /** Resumes the shared context; call from a user gesture. */
  unlock(): void {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => undefined)
  }

  dispose(): void {
    if (this.disposed) return
    this.stop()
    this.disposed = true
    try {
      this.speech?.removeEventListener('voiceschanged', this.onVoices)
    } catch {
      /* ignore */
    }
    if (this.gains) {
      for (const g of Object.values(this.gains)) {
        try {
          g.disconnect()
        } catch {
          /* ignore */
        }
      }
      this.gains = null
    }
    this.listeners.clear()
  }

  // -------------------------------------------------------------------------------------

  private emit(): void {
    const voice = [...this.active].some((p) => p.channel === 'voice') || !!this.utterance
    const sounds = [...this.active].some((p) => p.channel === 'sounds')
    if (voice === this.state.voice && sounds === this.state.sounds) return
    this.state.voice = voice
    this.state.sounds = sounds
    for (const l of [...this.listeners]) {
      try {
        l()
      } catch (err) {
        console.warn('[suite audio] listener failed', err)
      }
    }
  }

  private refreshVoices(): void {
    try {
      this.voices = this.speech?.getVoices() ?? []
    } catch {
      this.voices = []
    }
  }

  private waitForVoices(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const started = Date.now()
      const poll = (): void => {
        this.refreshVoices()
        if (this.voices.length > 0 || Date.now() - started >= ms) resolve()
        else setTimeout(poll, 100)
      }
      poll()
    })
  }

  private graph(): Record<'master' | AudioChannel, GainNode> | null {
    if (!this.ctx || this.ctx.state !== 'running') return null
    if (!this.gains) {
      try {
        const master = this.ctx.createGain()
        const voice = this.ctx.createGain()
        const sounds = this.ctx.createGain()
        voice.connect(master)
        sounds.connect(master)
        master.connect(this.ctx.destination)
        this.gains = { master, voice, sounds }
        this.applyLevels()
      } catch {
        this.gains = null
      }
    }
    return this.gains
  }

  private applyLevels(): void {
    if (this.gains) {
      this.gains.master.gain.value = this.muted ? 0 : this.levels.master
      this.gains.voice.gain.value = this.levels.voice
      this.gains.sounds.gain.value = this.levels.sounds
    }
    for (const p of this.active) {
      if (!p.source) p.el.volume = channelLevel(this.levels.master, this.levels[p.channel], this.muted)
    }
  }

  private playElement(url: string, channel: AudioChannel): Promise<boolean> {
    return new Promise((resolve) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined
      const settle = (value: boolean): void => {
        if (settled) return
        settled = true
        if (timer !== undefined) clearTimeout(timer)
        resolve(value)
      }
      let el: HTMLAudioElement
      try {
        el = new Audio()
      } catch {
        settle(false)
        return
      }
      el.preload = 'auto'
      let source: MediaElementAudioSourceNode | null = null
      const gains = this.graph()
      if (gains) {
        try {
          source = this.ctx!.createMediaElementSource(el)
          source.connect(gains[channel])
        } catch {
          source = null
        }
      }
      if (!source) el.volume = channelLevel(this.levels.master, this.levels[channel], this.muted)
      const entry: Playing = {
        el,
        source,
        channel,
        finish: () => {
          if (!this.active.delete(entry)) return
          el.removeAttribute('src')
          try {
            el.load()
          } catch {
            /* ignore */
          }
          try {
            source?.disconnect()
          } catch {
            /* ignore */
          }
          settle(false)
          this.emit()
        }
      }
      timer = setTimeout(() => {
        if (!settled) entry.finish()
      }, this.startTimeoutMs)
      el.addEventListener('ended', () => entry.finish())
      el.addEventListener('error', () => entry.finish())
      this.active.add(entry)
      el.src = url
      this.emit()
      el.play().then(
        () => settle(true),
        () => entry.finish()
      )
    })
  }

  private speak(prompt: ResolvedPrompt): Promise<PromptRoute> {
    const speech = this.speech
    const voice = speech ? findVoice(this.voices, this.speechLangFor(prompt.lang)) : null
    if (!speech || !voice) return Promise.resolve('text-only')
    return new Promise((resolve) => {
      let settled = false
      const settle = (route: PromptRoute): void => {
        if (!settled) {
          settled = true
          resolve(route)
        }
      }
      try {
        const u = new SpeechSynthesisUtterance(prompt.text)
        u.voice = voice
        u.lang = voice.lang
        u.rate = 0.9
        u.volume = channelLevel(this.levels.master, this.levels.voice, this.muted)
        const end = (): void => {
          if (this.utterance === u) {
            this.utterance = null
            this.emit()
          }
        }
        u.onstart = () => settle('speech')
        u.onend = end
        u.onerror = () => {
          end()
          settle('text-only')
        }
        this.utterance = u
        speech.cancel()
        speech.speak(u)
        this.emit()
        // Some engines never fire `start`; if it is queued and speaking, it counts.
        setTimeout(() => settle(speech.speaking || speech.pending ? 'speech' : 'text-only'), 1500)
      } catch {
        this.utterance = null
        this.emit()
        settle('text-only')
      }
    })
  }

  private stopSpeech(): void {
    if (!this.utterance) return
    this.utterance = null
    try {
      this.speech?.cancel()
    } catch {
      /* ignore */
    }
    this.emit()
  }
}
