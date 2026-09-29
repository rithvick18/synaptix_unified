/**
 * Colour tokens for #suite, and the WCAG contrast arithmetic the check uses to prove them.
 * Pure: no DOM.
 */

export interface Palette {
  bg: string
  surface: string
  surface2: string
  text: string
  muted: string
  border: string
  accent: string
  onAccent: string
  accentSoft: string
  onAccentSoft: string
  focus: string
  personalBg: string
  personalText: string
  demoBg: string
  demoText: string
  cue: string
  notice: string
  noticeBg: string
}

/** Default: the game's own look — charcoal surfaces, warm off-white text, amber accent (see ui.ts STYLE). */
export const PALETTE: Palette = {
  bg: '#0e0f11',
  surface: '#14161a',
  surface2: '#23262c',
  text: '#f2efe9',
  muted: '#b5b0a6',
  border: '#7a766e',
  accent: '#ffd98a',
  onAccent: '#14161a',
  accentSoft: '#33302a',
  onAccentSoft: '#ffe7b4',
  focus: '#8ec5f2',
  personalBg: '#1f3324',
  personalText: '#c3e6c8',
  demoBg: '#2b2540',
  demoText: '#d9cef2',
  cue: '#ffe7b4',
  notice: '#ffe7b4',
  noticeBg: '#2e2818'
}

/** High contrast: 7:1 or better for all text. */
export const PALETTE_HC: Palette = {
  bg: '#ffffff',
  surface: '#ffffff',
  surface2: '#f2f2f2',
  text: '#000000',
  muted: '#1f1f1f',
  border: '#000000',
  accent: '#4a2400',
  onAccent: '#ffffff',
  accentSoft: '#ffe9c7',
  onAccentSoft: '#2a1400',
  focus: '#003f8f',
  personalBg: '#e3f5dd',
  personalText: '#0b2a10',
  demoBg: '#ece6f5',
  demoText: '#1f1233',
  cue: '#2e1d00',
  notice: '#2e1d00',
  noticeBg: '#fff1d6'
}

/** Text/background pairs that appear in the UI: [foreground, background]. */
export const TEXT_PAIRS: ReadonlyArray<[keyof Palette, keyof Palette]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface2'],
  ['onAccent', 'accent'],
  ['onAccentSoft', 'accentSoft'],
  ['personalText', 'personalBg'],
  ['demoText', 'demoBg'],
  ['cue', 'surface'],
  ['notice', 'noticeBg'],
  ['accent', 'surface']
]

/** Non-text UI pairs (focus ring, control borders): WCAG 1.4.11 asks 3:1. */
export const UI_PAIRS: ReadonlyArray<[keyof Palette, keyof Palette]> = [
  ['focus', 'bg'],
  ['focus', 'surface'],
  ['border', 'surface'],
  ['border', 'bg']
]

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

export function parseHex(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim())
  if (!m) throw new Error(`not a hex colour: ${hex}`)
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG 2.x contrast ratio, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

const cssName = (key: string): string => '--s-' + key.replace(/[A-Z0-9]/g, (c) => '-' + c.toLowerCase())

/** `--s-bg: #…; --s-surface: #…; …` for a palette. */
export function paletteCss(p: Palette): string {
  return (Object.keys(p) as (keyof Palette)[]).map((k) => `${cssName(k)}: ${p[k]};`).join(' ')
}
