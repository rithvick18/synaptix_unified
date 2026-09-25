/**
 * Small numeric filters. Everything is driven by caller-supplied timestamps (never a clock)
 * so behaviour is identical at 10, 30 or 60 fps and fully deterministic in tests.
 */

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/**
 * Time-based EMA coefficient: alpha = 1 - exp(-dt / tau). Frame-rate independent — two
 * half-steps compound to the same result as one full step. dt <= 0 means "no time passed"
 * (alpha 0); tau <= 0 disables smoothing (alpha 1).
 */
export function emaAlpha(dtMs: number, tauMs: number): number {
  if (!(dtMs > 0)) return 0
  if (!(tauMs > 0)) return 1
  return 1 - Math.exp(-dtMs / tauMs)
}

/** Exponential moving average over irregularly sampled values; seeds with the first value. */
export class TimeEma {
  private readonly tauMs: number
  private v: number | null = null
  private lastT: number | null = null

  constructor(tauMs: number) {
    this.tauMs = tauMs
  }

  get value(): number | null {
    return this.v
  }

  update(x: number, t: number): number {
    if (this.v === null || this.lastT === null || !Number.isFinite(this.v)) {
      this.v = x
    } else {
      this.v += emaAlpha(t - this.lastT, this.tauMs) * (x - this.v)
    }
    this.lastT = t
    return this.v
  }

  reset(): void {
    this.v = null
    this.lastT = null
  }
}

export function mean(xs: readonly number[]): number | null {
  if (xs.length === 0) return null
  let s = 0
  for (const x of xs) s += x
  return s / xs.length
}

/** Population standard deviation; null for an empty list. */
export function stdDev(xs: readonly number[]): number | null {
  const m = mean(xs)
  if (m === null) return null
  let s = 0
  for (const x of xs) s += (x - m) * (x - m)
  return Math.sqrt(s / xs.length)
}

/** Round to a fixed number of decimals (keeps the wire compact; not a precision claim). */
export function roundTo(x: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round(x * f) / f
}
