/** The calm comfort-settings dialog, reachable from Home and from the Explore pause menu. */
import type { SuiteController } from './app'
import { h } from './dom'
import { TEXT_SCALES, type SuiteSettings } from './settings'

export function renderSettingsDialog(c: SuiteController, close: () => void): HTMLElement {
  const s = c.settings
  const t = (k: string, v?: Record<string, string | number>): string => c.t(k, v)
  const set = (patch: Partial<SuiteSettings>, rerender = false): void => {
    c.updateSettings(patch)
    if (rerender) c.refreshSettingsDialog()
  }

  const toggle = (key: string, label: string, checked: boolean, onChange: (v: boolean) => void, hint?: string): HTMLElement =>
    h('div', {},
      h('label', { class: 's-switch' },
        h('span', {}, label),
        h('input', { type: 'checkbox', 'data-k': key, checked, onchange: (e: Event) => onChange((e.target as HTMLInputElement).checked) })),
      hint ? h('p', { class: 's-muted s-small', text: hint }) : null)

  const range = (key: 'master' | 'voice' | 'sounds', label: string): HTMLElement => {
    const value = Math.round(s.volume[key] * 100)
    const out = h('output', { text: `${value}%` })
    return h('label', { class: 's-range' },
      h('span', { class: 's-row' }, h('span', {}, label), out),
      h('input', {
        type: 'range', min: 0, max: 100, step: 5, value, 'data-k': `vol-${key}`, 'aria-valuetext': `${value}%`,
        oninput: (e: Event) => {
          const input = e.target as HTMLInputElement
          const v = Number(input.value)
          out.textContent = `${v}%`
          input.setAttribute('aria-valuetext', `${v}%`)
          set({ volume: { ...c.settings.volume, [key]: v / 100 } })
        }
      }))
  }

  const scaleNames: Record<number, string> = { 1: t('app.settings.textSizes.standard'), 1.25: t('app.settings.textSizes.larger'), 1.5: t('app.settings.textSizes.largest') }
  const speechLang = c.i18n?.language ?? 'en'
  const speechMissing = s.speech && c.run ? !c.run.audio.speechAvailable(speechLang) : false

  return h('div', { class: 's-card s-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 's-settings-title' },
    h('h2', { id: 's-settings-title', text: t('app.settings.title') }),
    h('fieldset', {},
      h('legend', { text: t('app.settings.textSize') }),
      h('div', { class: 's-row' },
        TEXT_SCALES.map((scale) =>
          h('button', { type: 'button', 'aria-pressed': String(s.textScale === scale), 'data-k': `scale-${scale}`,
            onclick: () => set({ textScale: scale }, true) }, scaleNames[scale])))),
    toggle('hc', t('app.settings.highContrast'), s.highContrast, (v) => set({ highContrast: v })),
    toggle('rm', t('app.settings.reducedMotion'), s.reducedMotion, (v) => set({ reducedMotion: v })),
    h('fieldset', {},
      h('legend', { text: t('app.settings.navigation') }),
      h('div', { class: 's-row' },
        h('button', { type: 'button', 'aria-pressed': String(s.navigation === 'seated'), 'data-k': 'nav-seated',
          onclick: () => set({ navigation: 'seated' }, true) }, t('app.settings.seated')),
        h('button', { type: 'button', 'aria-pressed': String(s.navigation === 'walk'), 'data-k': 'nav-walk',
          onclick: () => set({ navigation: 'walk' }, true) }, t('app.settings.walk'))),
      h('p', { class: 's-muted s-small', text: s.navigation === 'walk' ? t('app.settings.walkHint') : t('app.settings.seatedHint') })),
    toggle('subs', t('app.settings.subtitles'), s.subtitles, (v) => set({ subtitles: v })),
    toggle('speech', t('app.settings.speech'), s.speech, (v) => set({ speech: v }, true), speechMissing ? t('app.settings.speechMissing') : undefined),
    h('fieldset', {},
      h('legend', { text: t('app.settings.volume') }),
      range('master', t('app.settings.master')),
      range('voice', t('app.settings.voice')),
      range('sounds', t('app.settings.sounds'))),
    toggle('mute', t('app.settings.muted'), s.muted, (v) => set({ muted: v })),
    toggle('assist', t('app.settings.caregiverAssist'), c.run ? c.run.assist : s.caregiverAssist, (v) => set({ caregiverAssist: v }),
      t('app.settings.caregiverAssistHint')),
    c.settingsSaved ? null : h('p', { class: 's-notice', role: 'status', text: t('app.settings.notSaved') }),
    h('div', { class: 's-row' },
      h('button', { type: 'button', class: 's-primary', 'data-k': 'settings-done', onclick: () => close() }, t('app.settings.done'))))
}
