/**
 * Comfort settings for the suite, kept on this device only (localStorage).
 *
 * Pure apart from `browserStorage()` / `prefersReducedMotion()`, which touch the DOM only
 * when called, so node checks can import this file.
 */

export const SETTINGS_KEY = 'memoria-suite-settings-v1'

export const TEXT_SCALES = [1, 1.25, 1.5] as const
export type TextScale = (typeof TEXT_SCALES)[number]

export interface SuiteSettings {
  textScale: TextScale
  highContrast: boolean
  reducedMotion: boolean
  navigation: 'seated' | 'walk'
  /** Prompt text on screen. On by default. */
  subtitles: boolean
  /** Speech synthesis for prompts without a recording. */
  speech: boolean
  /** 0–1 each. */
  volume: { master: number; voice: number; sounds: number }
  muted: boolean
  /** Caregiver panel shown. A saved profile's own default replaces it at session start. */
  caregiverAssist: boolean
}

export function defaultSettings(reducedMotion = false): SuiteSettings {
  return {
    textScale: 1,
    highContrast: false,
    reducedMotion,
    navigation: 'seated',
    subtitles: true,
    speech: true,
    volume: { master: 0.8, voice: 1, sounds: 0.8 },
    muted: false,
    caregiverAssist: true
  }
}

const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)

const unit = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback

/** Any stored value (possibly garbage) → a complete, valid settings object. */
export function normaliseSettings(raw: unknown, defaults: SuiteSettings = defaultSettings()): SuiteSettings {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const vol = src.volume && typeof src.volume === 'object' ? (src.volume as Record<string, unknown>) : {}
  const scale = TEXT_SCALES.find((s) => s === src.textScale) ?? defaults.textScale
  return {
    textScale: scale,
    highContrast: bool(src.highContrast, defaults.highContrast),
    reducedMotion: bool(src.reducedMotion, defaults.reducedMotion),
    navigation: src.navigation === 'walk' || src.navigation === 'seated' ? src.navigation : defaults.navigation,
    subtitles: bool(src.subtitles, defaults.subtitles),
    speech: bool(src.speech, defaults.speech),
    volume: {
      master: unit(vol.master, defaults.volume.master),
      voice: unit(vol.voice, defaults.volume.voice),
      sounds: unit(vol.sounds, defaults.volume.sounds)
    },
    muted: bool(src.muted, defaults.muted),
    caregiverAssist: bool(src.caregiverAssist, defaults.caregiverAssist)
  }
}

export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem'>

/** Reads settings; unreadable storage or bad JSON gives the defaults. Never throws. */
export function loadSettings(storage: SettingsStorage | null, reducedMotion = false): SuiteSettings {
  const defaults = defaultSettings(reducedMotion)
  if (!storage) return defaults
  try {
    const text = storage.getItem(SETTINGS_KEY)
    if (!text) return defaults
    return normaliseSettings(JSON.parse(text), defaults)
  } catch {
    return defaults
  }
}

/** Writes settings; returns false when storage refuses (private mode, quota). Never throws. */
export function saveSettings(storage: SettingsStorage | null, settings: SuiteSettings): boolean {
  if (!storage) return false
  try {
    storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

export function browserStorage(): SettingsStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}
