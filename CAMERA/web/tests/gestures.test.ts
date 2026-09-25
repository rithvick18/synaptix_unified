import { describe, expect, it } from 'vitest'
import { DEFAULT_SIGNAL_CONFIG } from '../src/vision/contracts.ts'
import { HeadGestureDetector, SwingTracker, type DetectedHeadGesture, type SwingMatch } from '../src/vision/gestures.ts'

type Traj = (t: number) => { pitch: number; yaw: number }

function run(det: HeadGestureDetector, traj: Traj, t0: number, t1: number, fps: number): DetectedHeadGesture[] {
  const out: DetectedHeadGesture[] = []
  const dt = 1000 / fps
  for (let k = 0; t0 + k * dt <= t1; k++) {
    const t = t0 + k * dt
    const { pitch, yaw } = traj(t)
    out.push(...det.push(t, pitch, yaw))
  }
  return out
}

/** Nod: pitch dips by `amp` and returns over `dur` ms starting at `start`. */
const nodAt =
  (start: number, amp = 15, dur = 400): Traj =>
  (t) => {
    const e = t - start
    return { pitch: e >= 0 && e <= dur ? -amp * Math.sin((Math.PI * e) / dur) : 0, yaw: 0 }
  }

/** Shake: one full yaw cycle (right, left, back) of `amp` over `dur` ms. */
const shakeAt =
  (start: number, amp = 18, dur = 700): Traj =>
  (t) => {
    const e = t - start
    return { pitch: 0, yaw: e >= 0 && e <= dur ? amp * Math.sin((2 * Math.PI * e) / dur) : 0 }
  }

describe('SwingTracker', () => {
  const params = { minSwingDeg: 7, minSwings: 2, maxDurationMs: 1200, minSwingMs: 60, returnToleranceRatio: 0.5 }

  it('ignores jitter smaller than the minimum swing', () => {
    const s = new SwingTracker(params)
    for (let t = 0; t < 3000; t += 33) {
      const v = 3 * Math.sin(t / 40)
      s.push(t, v)
      expect(s.match({ t, v })).toBeNull()
    }
  })

  it('matches a down-up swing and reports its excursion', () => {
    const s = new SwingTracker(params)
    const seq = [0, 0, -6, -12, -14, -10, -4, -1]
    let m: SwingMatch | null = null
    seq.forEach((v, i) => {
      s.push(i * 66, v)
      m = s.match({ t: i * 66, v }) ?? m
    })
    expect(m).not.toBeNull()
    expect(m!.swings).toBe(2)
    expect(m!.excursion).toBeCloseTo(14)
  })

  it('does not accumulate slow drift into a swing', () => {
    const s = new SwingTracker(params)
    // 30° of drift over 20 s, then back: never faster than the sliding baseline window.
    for (let t = 0; t <= 40_000; t += 33) {
      const v = t <= 20_000 ? (30 * t) / 20_000 : 30 - (30 * (t - 20_000)) / 20_000
      s.push(t, v)
      expect(s.match({ t, v })).toBeNull()
    }
  })
})

describe('HeadGestureDetector', () => {
  const cfg = DEFAULT_SIGNAL_CONFIG

  for (const fps of [15, 30]) {
    it(`detects a nod at ${fps} fps`, () => {
      const det = new HeadGestureDetector(cfg)
      const g = run(det, nodAt(500), 0, 1500, fps)
      expect(g).toHaveLength(1)
      expect(g[0].type).toBe('nod')
      expect(g[0].swings).toBe(2)
      expect(g[0].end_ts_ms).toBeGreaterThanOrEqual(g[0].start_ts_ms)
      expect(g[0].amplitude_deg).toBeGreaterThan(7)
    })

    it(`detects a head shake at ${fps} fps`, () => {
      const det = new HeadGestureDetector(cfg)
      const g = run(det, shakeAt(500), 0, 1800, fps)
      expect(g).toHaveLength(1)
      expect(g[0].type).toBe('head_shake')
      expect(g[0].swings).toBe(3)
    })
  }

  it('rejects a diagonal wobble via the cross-axis check', () => {
    const det = new HeadGestureDetector(cfg)
    const g = run(
      det,
      (t) => {
        const n = nodAt(500)(t).pitch
        return { pitch: n, yaw: n } // equal yaw motion: range > 0.6 × excursion
      },
      0,
      1500,
      30
    )
    expect(g).toHaveLength(0)
  })

  it('does not report a slow look-away and back', () => {
    const det = new HeadGestureDetector(cfg)
    const g = run(
      det,
      (t) => {
        const ramp = (x: number): number => Math.max(0, Math.min(1, x))
        const yaw = 35 * (ramp((t - 500) / 600) - ramp((t - 2600) / 600))
        return { pitch: 0, yaw }
      },
      0,
      4000,
      30
    )
    expect(g).toHaveLength(0)
  })

  it('applies a per-type cooldown and resets both axes after a detection', () => {
    const det = new HeadGestureDetector(cfg)
    const both: Traj = (t) => (t < 950 ? nodAt(500)(t) : nodAt(950)(t))
    const g = run(det, both, 0, 2000, 30)
    expect(g.map((x) => x.type)).toEqual(['nod'])
    // Beyond the cooldown a third nod is reported again.
    const g2 = run(det, nodAt(2500), 2000 + 1000 / 30, 3500, 30)
    expect(g2.map((x) => x.type)).toEqual(['nod'])
  })
})
