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

/** Warm neutral default. */
export const PALETTE: Palette = {
  bg: '#f4eee3',
  surface: '#fffaf2',
  surface2: '#efe6d6',
  text: '#2b2620',
  muted: '#574d42',
  border: '#8c7a64',
  accent: '#7a4520',
  onAccent: '#fffaf2',
  accentSoft: '#f1dfc7',
  onAccentSoft: '#4a2a12',
  focus: '#1d5a85',
  personalBg: '#dcebd6',
  personalText: '#1f4526',
  demoBg: '#e6e0ee',
  demoText: '#3f2f59',
  cue: '#5a3d16',
  notice: '#4f3a14',
  noticeBg: '#f7ead0'
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
