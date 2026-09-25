/**
 * Nod / head-shake detection as zig-zag ("swing") patterns on one angle axis each:
 * nod on relative pitch, shake on relative yaw. Inputs are gesture-smoothed relative
 * angles (degrees) with caller timestamps; the detector keeps no clock of its own.
 *
 * A swing is a monotone move of at least `minSwingDeg` between two turning points
 * (pivots). Pivots are confirmed with hysteresis: a running extreme becomes a pivot only
 * once the signal has retreated from it by `minSwingDeg`, so jitter smaller than the
 * minimum swing can never create pivots.
 */

import type { SignalConfig } from './contracts.ts'

export interface SwingPoint {
  t: number
  v: number
}

export interface SwingParams {
  minSwingDeg: number
  /** Number of swings (segments) that make up the gesture. */
  minSwings: number
  maxDurationMs: number
  minSwingMs: number
  returnToleranceRatio: number
}

export interface SwingMatch {
  start: SwingPoint
  end: SwingPoint
  /** Largest |v - start.v| over the matched points, degrees. */
  excursion: number
  swings: number
}

/** Keep at most this many confirmed pivots; older ones can never be part of a match. */
const MAX_PIVOTS = 12

/** Pivot tracker for a single axis. */
export class SwingTracker {
  private readonly p: SwingParams
  /** Confirmed pivots; pivots[0] is the baseline the first swing started from. */
  private pivots: SwingPoint[] = []
  /** 0 = idle (no swing in progress), ±1 = direction of the current swing. */
  private dir: -1 | 0 | 1 = 0
  /** Running extreme of the current swing (candidate pivot). */
  private extreme: SwingPoint | null = null
  /** Idle-mode samples within maxDurationMs, used to find a baseline for the first swing. */
  private idle: SwingPoint[] = []

  constructor(params: SwingParams) {
    this.p = params
  }

  reset(): void {
    this.pivots = []
    this.dir = 0
    this.extreme = null
    this.idle = []
  }

  push(t: number, v: number): void {
    const cur = { t, v }
    const h = this.p.minSwingDeg
    if (this.dir === 0) {
      // Idle: slide the baseline window so slow drift never accumulates into a "swing".
      this.idle.push(cur)
      while (this.idle.length > 1 && t - this.idle[0].t > this.p.maxDurationMs) this.idle.shift()
      // Ties resolve to the most recent sample so a swing starts where the motion began,
      // not at the oldest sample of a long rest.
      let lo = this.idle[0]
      let hi = this.idle[0]
      for (const s of this.idle) {
        if (s.v <= lo.v) lo = s
        if (s.v >= hi.v) hi = s
      }
      const up = v - lo.v
      const down = hi.v - v
      if (up >= h && up >= down) this.begin(lo, 1, cur)
      else if (down >= h) this.begin(hi, -1, cur)
      return
    }
    const ext = this.extreme as SwingPoint
    if (this.dir === 1 ? v > ext.v : v < ext.v) {
      this.extreme = cur
    } else if (Math.abs(ext.v - v) >= h) {
      this.pivots.push(ext)
      if (this.pivots.length > MAX_PIVOTS) this.pivots.shift()
      this.dir = this.dir === 1 ? -1 : 1
      this.extreme = cur
    } else if (t - ext.t > this.p.maxDurationMs) {
      // Head parked at an extreme for longer than any gesture lasts: start over.
      this.reset()
      this.idle.push(cur)
    }
  }

  private begin(baseline: SwingPoint, dir: 1 | -1, cur: SwingPoint): void {
    this.pivots = [baseline]
    this.dir = dir
    this.extreme = cur
    this.idle = []
  }

  /**
   * Check the last `minSwings + 1` points of [...pivots, current] against the gesture
   * rules: every segment ≥ minSwingDeg and ≥ minSwingMs, alternating direction, total span
   * ≤ maxDurationMs, and the end back within returnToleranceRatio × excursion of the start.
   */
  match(current: SwingPoint): SwingMatch | null {
    const k = Math.max(1, Math.floor(this.p.minSwings))
    const pts = [...this.pivots, current]
    if (pts.length < k + 1) return null
    const seq = pts.slice(pts.length - (k + 1))
    let prevSign = 0
    for (let i = 1; i < seq.length; i++) {
      const dv = seq[i].v - seq[i - 1].v
      const dt = seq[i].t - seq[i - 1].t
      if (Math.abs(dv) < this.p.minSwingDeg || dt < this.p.minSwingMs) return null
      const sign = Math.sign(dv)
      if (sign === prevSign) return null
      prevSign = sign
    }
    const start = seq[0]
    const end = seq[seq.length - 1]
    if (end.t - start.t > this.p.maxDurationMs) return null
    let excursion = 0
    for (const s of seq) excursion = Math.max(excursion, Math.abs(s.v - start.v))
    if (Math.abs(end.v - start.v) > this.p.returnToleranceRatio * excursion) return null
    return { start, end, excursion, swings: k }
  }
}

export type HeadGestureType = 'nod' | 'head_shake'

export interface DetectedHeadGesture {
  type: HeadGestureType
  start_ts_ms: number
  end_ts_ms: number
  amplitude_deg: number
  swings: number
}

export type HeadGestureConfig = Pick<
  SignalConfig,
  | 'nodMinSwingDeg'
  | 'nodMinSwings'
  | 'nodMaxDurationMs'
  | 'shakeMinSwingDeg'
  | 'shakeMinSwings'
  | 'shakeMaxDurationMs'
  | 'minSwingMs'
  | 'crossAxisRatio'
  | 'returnToleranceRatio'
  | 'gestureCooldownMs'
>

interface Sample {
  t: number
  pitch: number
  yaw: number
}

/**
 * Nod + head-shake detector over (pitch, yaw). A candidate on one axis is rejected when
 * the other axis moved too much over the same interval (crossAxisRatio), so a diagonal
 * look-around is neither. After any detection both axes restart, and each type has its
 * own cooldown so one physical gesture is never reported twice.
 */
export class HeadGestureDetector {
  private readonly cfg: HeadGestureConfig
  private readonly nod: SwingTracker
  private readonly shake: SwingTracker
  private history: Sample[] = []
  private lastEmit: Record<HeadGestureType, number | null> = { nod: null, head_shake: null }

  constructor(cfg: HeadGestureConfig) {
    this.cfg = cfg
    this.nod = new SwingTracker({
      minSwingDeg: cfg.nodMinSwingDeg,
      minSwings: cfg.nodMinSwings,
      maxDurationMs: cfg.nodMaxDurationMs,
      minSwingMs: cfg.minSwingMs,
      returnToleranceRatio: cfg.returnToleranceRatio
    })
    this.shake = new SwingTracker({
      minSwingDeg: cfg.shakeMinSwingDeg,
      minSwings: cfg.shakeMinSwings,
      maxDurationMs: cfg.shakeMaxDurationMs,
      minSwingMs: cfg.minSwingMs,
      returnToleranceRatio: cfg.returnToleranceRatio
    })
  }

  /** Forget all motion history (cooldowns are kept: they debounce across interruptions). */
  reset(): void {
    this.nod.reset()
    this.shake.reset()
    this.history = []
  }

  /** Full reset including cooldowns. */
  clear(): void {
    this.reset()
    this.lastEmit = { nod: null, head_shake: null }
  }

  /** Feed one sample; returns at most one detected gesture. */
  push(t: number, pitch: number, yaw: number): DetectedHeadGesture[] {
    this.history.push({ t, pitch, yaw })
    const keep = Math.max(this.cfg.nodMaxDurationMs, this.cfg.shakeMaxDurationMs) + 100
    while (this.history.length > 1 && t - this.history[0].t > keep) this.history.shift()
    this.nod.push(t, pitch)
    this.shake.push(t, yaw)

    const nod = this.qualify(this.nod.match({ t, v: pitch }), 'yaw', this.cfg.nodMinSwingDeg)
    const shake = this.qualify(this.shake.match({ t, v: yaw }), 'pitch', this.cfg.shakeMinSwingDeg)
    if (!nod && !shake) return []

    // Both at once is unusual (diagonal wobble passing both cross-axis checks); keep the
    // one that exceeded its own threshold by more.
    let type: HeadGestureType
    let m: SwingMatch
    if (nod && (!shake || nod.score >= shake.score)) {
      type = 'nod'
      m = nod.m
    } else {
      type = 'head_shake'
      m = (shake as { m: SwingMatch }).m
    }
    this.nod.reset()
    this.shake.reset()

    const last = this.lastEmit[type]
    if (last !== null && t - last < this.cfg.gestureCooldownMs) return []
    this.lastEmit[type] = t
    return [
      {
        type,
        start_ts_ms: m.start.t,
        end_ts_ms: m.end.t,
        amplitude_deg: m.excursion,
        swings: m.swings
      }
    ]
  }

  private qualify(
    m: SwingMatch | null,
    otherAxis: 'pitch' | 'yaw',
    minSwingDeg: number
  ): { m: SwingMatch; score: number } | null {
    if (!m) return null
    let lo = Infinity
    let hi = -Infinity
    for (const s of this.history) {
      if (s.t < m.start.t || s.t > m.end.t) continue
      lo = Math.min(lo, s[otherAxis])
      hi = Math.max(hi, s[otherAxis])
    }
    const range = hi >= lo ? hi - lo : 0
    if (range > this.cfg.crossAxisRatio * m.excursion) return null
    return { m, score: m.excursion / Math.max(minSwingDeg, 1e-6) }
  }
}
