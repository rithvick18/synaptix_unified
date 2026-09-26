/**
 * Text drawn at runtime, in the active language, onto a CanvasTexture: the calendar's
 * month and day grid, and book spine titles. No text is ever baked into an image file.
 *
 * Needs a DOM canvas; under node (checks) `createCanvas` returns null and the prototype's
 * plain paper stays in place.
 */
import * as THREE from 'three'
import { textureKB } from './textures'

export interface RuntimeTextSpec {
  kind: 'calendar' | 'spines' | string
  px: [number, number]
  spines?: { y0: number; y1: number; colour: string }[]
}

export interface RuntimeTextInput {
  /** Resolved texts keyed by the manifest's runtimeText slot. */
  texts: Record<string, string>
  lang: string
  fontFamily: string
  now?: Date
}

export function createCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    return canvas.getContext('2d') ? canvas : null
  } catch {
    return null
  }
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, family: string, weight: string, max: number, width: number): number {
  let size = max
  for (; size > 8; size -= 1) {
    ctx.font = `${weight} ${size}px ${family}`
    if (ctx.measureText(text).width <= width) break
  }
  return size
}

function drawCalendar(ctx: CanvasRenderingContext2D, w: number, h: number, input: RuntimeTextInput): void {
  const now = input.now ?? new Date()
  ctx.fillStyle = '#f4eee0'
  ctx.fillRect(0, 0, w, h)
  // An illustration: sky, sun and two hills. No text, no people.
  const top = Math.round(h * 0.4)
  const sky = ctx.createLinearGradient(0, 0, 0, top)
  sky.addColorStop(0, '#9cc3dc')
  sky.addColorStop(1, '#e9dcc0')
  ctx.fillStyle = sky
  ctx.fillRect(8, 8, w - 16, top - 8)
  ctx.fillStyle = '#f2b347'
  ctx.beginPath(); ctx.arc(w * 0.72, top * 0.42, top * 0.14, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#6f9a5a'
  ctx.beginPath(); ctx.moveTo(8, top); ctx.quadraticCurveTo(w * 0.3, top * 0.35, w * 0.62, top); ctx.fill()
  ctx.fillStyle = '#4f7d45'
  ctx.beginPath(); ctx.moveTo(w * 0.35, top); ctx.quadraticCurveTo(w * 0.72, top * 0.5, w - 8, top); ctx.lineTo(w - 8, top); ctx.fill()
  // Month name in the active language.
  const monthText = input.texts.month && input.texts.month !== '@month'
    ? input.texts.month
    : safeFormat(() => new Intl.DateTimeFormat(input.lang, { month: 'long' }).format(now), String(now.getMonth() + 1))
  ctx.fillStyle = '#7a2420'
  const size = fitFont(ctx, monthText, input.fontFamily, '700', 34, w - 24)
  ctx.font = `700 ${size}px ${input.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(monthText, w / 2, top + 26)
  // The day grid for this month, numerals in the language's own format.
  const year = now.getFullYear(), month = now.getMonth()
  const first = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const nf = safeFormat(() => new Intl.NumberFormat(input.lang), null)
  const gridTop = top + 52, cellW = (w - 20) / 7, rows = Math.ceil((first + days) / 7), cellH = (h - gridTop - 8) / rows
  ctx.font = `600 ${Math.min(18, Math.floor(cellH * 0.6))}px ${input.fontFamily}`
  for (let d = 1; d <= days; d++) {
    const i = first + d - 1
    const col = i % 7, row = Math.floor(i / 7)
    ctx.fillStyle = col === 0 ? '#a8322a' : '#2d2a26'
    ctx.fillText(nf ? nf.format(d) : String(d), 10 + cellW * (col + 0.5), gridTop + cellH * (row + 0.5))
  }
}

function safeFormat<T>(fn: () => T, fallback: T): T {
  try { return fn() } catch { return fallback }
}

function drawSpines(ctx: CanvasRenderingContext2D, w: number, h: number, spec: RuntimeTextSpec, input: RuntimeTextInput): void {
  const spines = spec.spines ?? []
  spines.forEach((spine, i) => {
    // Canvas y runs downwards; spine fractions run up from the bottom.
    const y0 = Math.round((1 - spine.y1) * h), y1 = Math.round((1 - spine.y0) * h)
    ctx.fillStyle = spine.colour
    ctx.fillRect(0, y0, w, y1 - y0)
    ctx.fillStyle = 'rgba(230, 196, 120, 0.9)'
    ctx.fillRect(10, y0 + 2, 4, y1 - y0 - 4)
    ctx.fillRect(w - 14, y0 + 2, 4, y1 - y0 - 4)
    const text = input.texts[`spine-${i}`] ?? ''
    if (!text) return
    ctx.fillStyle = '#f3ead6'
    const size = fitFont(ctx, text, input.fontFamily, '600', Math.floor((y1 - y0) * 0.62), w - 40)
    ctx.font = `600 ${size}px ${input.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, (y0 + y1) / 2 + 1)
  })
}

export function drawRuntimeText(canvas: HTMLCanvasElement, spec: RuntimeTextSpec, input: RuntimeTextInput): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width, h = canvas.height
  ctx.clearRect(0, 0, w, h)
  if (spec.kind === 'calendar') drawCalendar(ctx, w, h, input)
  else if (spec.kind === 'spines') drawSpines(ctx, w, h, spec, input)
}

/** A runtime-text surface owned by one scene object: its canvas, texture and material. */
export class RuntimeTextSurface {
  readonly texture: THREE.CanvasTexture
  readonly material: THREE.MeshStandardMaterial
  constructor(readonly canvas: HTMLCanvasElement, readonly spec: RuntimeTextSpec, anisotropy: number) {
    this.texture = new THREE.CanvasTexture(canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = anisotropy
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.85 })
    this.material.name = `suite:runtime-text:${spec.kind}`
  }

  draw(input: RuntimeTextInput): void {
    drawRuntimeText(this.canvas, this.spec, input)
    this.texture.needsUpdate = true
  }

  get kb(): number {
    return textureKB(this.canvas.width, this.canvas.height)
  }

  dispose(): void {
    this.texture.dispose()
    this.material.dispose()
  }
}
