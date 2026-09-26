#!/usr/bin/env node
/**
 * Synthesizes the everyday-home pack's sounds in pure Node, then encodes them to MP3.
 *
 *   node tools/suite/content/make-sounds.mjs            # all sounds
 *   node tools/suite/content/make-sounds.mjs snd-train  # one sound
 *
 * Every sound is a gentle, recognisable approximation made from oscillators, filtered
 * noise and simple physical models. Nothing is recorded, downloaded or produced by a
 * text-to-speech voice, so the files are the project's own work (CC0-1.0).
 *
 * Output: public/suite/packs/everyday-home/sounds/<id>.mp3 — mono, 24 kHz, 48 kbit/s CBR,
 * 4–15 s, normalised to about -18 LUFS with sample peaks at or below -3 dBFS, with soft
 * fades so nothing starts or stops abruptly. Afterwards run build-content.mjs, which reads
 * each file's duration into the packs' content.json.
 *
 * Needs `ffmpeg` (loudness measurement) and `lame` (encoding), e.g. from Homebrew.
 * The random generator is seeded, so the output is repeatable.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PACK_DIR = path.join(ROOT, 'public', 'suite', 'packs', 'everyday-home')
const OUT_DIR = path.join(PACK_DIR, 'sounds')
const SR = 24000
const TARGET_LUFS = -18
const PEAK_CEILING_DB = -3
const MAX_GAIN_DB = 20
const TOOL_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']

function tool(name) {
  for (const dir of TOOL_DIRS) {
    const p = path.join(dir, name)
    if (existsSync(p)) return p
  }
  return name
}
const FFMPEG = tool('ffmpeg')
const LAME = tool('lame')

// ---------------------------------------------------------------------------------------
// DSP primitives
// ---------------------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TAU = Math.PI * 2
const buf = (seconds) => new Float32Array(Math.round(seconds * SR))
const S = (seconds) => Math.round(seconds * SR)

function white(n, rnd) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = rnd() * 2 - 1
  return out
}

/** Paul Kellet's economy pink-noise filter. */
function pink(n, rnd) {
  const out = new Float32Array(n)
  let b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < n; i++) {
    const w = rnd() * 2 - 1
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
  }
  return out
}

/** Brown noise with the sub-audible drift removed (high-passed at 40 Hz). */
function brown(n, rnd) {
  const out = new Float32Array(n)
  let v = 0
  for (let i = 0; i < n; i++) {
    v = (v + (rnd() * 2 - 1) * 0.02) * 0.998
    out[i] = v * 3
  }
  return filter(out, 'highpass', 40, 0.7)
}

/** RBJ biquad coefficients. */
function biquad(type, freq, q) {
  const w = TAU * Math.min(freq, SR * 0.49) / SR
  const cos = Math.cos(w)
  const alpha = Math.sin(w) / (2 * q)
  let b0, b1, b2
  const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha
  if (type === 'lowpass') { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2 }
  else if (type === 'highpass') { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2 }
  else { b0 = alpha; b1 = 0; b2 = -alpha } // bandpass, 0 dB peak
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0]
}

/** Filters in place. `freq` may be a number or a function of the sample index. */
function filter(x, type, freq, q = 0.707) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  let c = typeof freq === 'number' ? biquad(type, freq, q) : null
  for (let i = 0; i < x.length; i++) {
    if (!c || (typeof freq === 'function' && i % 32 === 0)) {
      c = biquad(type, freq(i), typeof q === 'function' ? q(i) : q)
    }
    const y = c[0] * x[i] + c[1] * x1 + c[2] * x2 - c[3] * y1 - c[4] * y2
    x2 = x1; x1 = x[i]; y2 = y1; y1 = y
    x[i] = y
  }
  return x
}

function mixInto(dest, src, at = 0, gain = 1) {
  const start = Math.round(at)
  for (let i = 0; i < src.length; i++) {
    const j = start + i
    if (j >= 0 && j < dest.length) dest[j] += src[i] * gain
  }
  return dest
}

function scale(x, g) {
  for (let i = 0; i < x.length; i++) x[i] *= typeof g === 'function' ? g(i) : g
  return x
}

/** A damped sinusoid with a short attack ramp (no clicks). */
function mode(freq, tau, seconds, amp = 1, attack = 0.001, phase = 0) {
  const out = buf(seconds)
  const a = Math.max(1, S(attack))
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    const env = Math.exp(-t / tau) * Math.min(1, i / a)
    out[i] = Math.sin(TAU * freq * t + phase) * env * amp
  }
  return out
}

/** A short noise burst, band-limited, with an exponential decay. */
function burst(rnd, seconds, tau, type, freq, q, amp = 1, attack = 0.001) {
  const out = white(S(seconds), rnd)
  filter(out, type, freq, q)
  const a = Math.max(1, S(attack))
  for (let i = 0; i < out.length; i++) out[i] *= Math.exp(-i / SR / tau) * Math.min(1, i / a) * amp
  return out
}

/** An oscillator following a frequency curve f(t) (Hz), with an amplitude curve. */
function sweep(seconds, freqAt, ampAt, harmonics = [1]) {
  const out = buf(seconds)
  let phase = 0
  for (let i = 0; i < out.length; i++) {
    const t = i / SR
    phase += TAU * freqAt(t) / SR
    let v = 0
    for (let h = 0; h < harmonics.length; h++) v += Math.sin(phase * (h + 1)) * harmonics[h]
    out[i] = v * ampAt(t)
  }
  return out
}

/** Small Schroeder reverb: parallel combs into series all-passes. Returns a new buffer. */
function reverb(x, wet = 0.2, size = 1, damp = 0.4) {
  const combs = [1557, 1617, 1491, 1422].map((d) => Math.round(d * size * SR / 44100))
  const allpasses = [225, 556].map((d) => Math.round(d * SR / 44100))
  const out = new Float32Array(x.length)
  for (const d of combs) {
    const line = new Float32Array(d)
    let idx = 0, lp = 0
    for (let i = 0; i < x.length; i++) {
      const y = line[idx]
      lp = y * (1 - damp) + lp * damp
      line[idx] = x[i] + lp * 0.8
      idx = (idx + 1) % d
      out[i] += y * 0.25
    }
  }
  for (const d of allpasses) {
    const line = new Float32Array(d)
    let idx = 0
    for (let i = 0; i < out.length; i++) {
      const b = line[idx]
      const y = -out[i] + b
      line[idx] = out[i] + b * 0.5
      idx = (idx + 1) % d
      out[i] = y
    }
  }
  const mixed = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) mixed[i] = x[i] * (1 - wet) + out[i] * wet
  return mixed
}

function fades(x, fadeIn = 0.25, fadeOut = 0.5) {
  const a = S(fadeIn), b = S(fadeOut)
  for (let i = 0; i < a && i < x.length; i++) x[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / a)
  for (let i = 0; i < b && i < x.length; i++) x[x.length - 1 - i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / b)
  return x
}

/** Makes a buffer loop seamlessly by crossfading its tail into its head. */
function loopable(x, seconds) {
  const n = S(seconds)
  const xf = x.length - n
  const out = x.slice(0, n)
  for (let i = 0; i < xf; i++) {
    const g = i / xf
    out[i] = x[n + i] * (1 - g) + x[i] * g
  }
  return out
}

/** Smoothed random control signal in [-1, 1] changing about `rate` times a second. */
function wander(n, rnd, rate) {
  const out = new Float32Array(n)
  const step = Math.max(1, Math.round(SR / rate))
  let a = rnd() * 2 - 1, b = rnd() * 2 - 1
  for (let i = 0; i < n; i++) {
    if (i % step === 0) { a = b; b = rnd() * 2 - 1 }
    const f = (i % step) / step
    out[i] = a + (b - a) * (0.5 - 0.5 * Math.cos(Math.PI * f))
  }
  return out
}

/**
 * Look-ahead peak limiter: gain drops smoothly just before a peak and recovers over
 * `release` seconds, so short transients (clock ticks, clacks) are softened rather than
 * clipped. Keeps every sample at or below `ceiling`.
 */
function limit(x, ceiling, lookahead = 0.003, release = 0.06) {
  const L = Math.max(1, S(lookahead))
  const need = new Float32Array(x.length)
  for (let i = 0; i < x.length; i++) need[i] = Math.min(1, ceiling / Math.max(1e-9, Math.abs(x[i])))
  // Minimum of the required gain over the look-ahead window.
  const win = new Float32Array(x.length)
  const dq = []
  for (let i = x.length - 1; i >= 0; i--) {
    while (dq.length && need[dq[dq.length - 1]] >= need[i]) dq.pop()
    dq.push(i)
    while (dq[0] > i + L) dq.shift()
    win[i] = need[dq[0]]
  }
  const rel = Math.exp(-1 / (release * SR))
  const att = Math.exp(-1 / (lookahead * SR / 3))
  let g = 1
  for (let i = 0; i < x.length; i++) {
    const target = win[i]
    g = target < g ? target + (g - target) * att : target + (g - target) * rel
    x[i] *= Math.min(g, need[i])
  }
  return x
}

const note = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name)
  const semis = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0)
  const midi = 12 * (Number(m[3]) + 1) + semis
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// ---------------------------------------------------------------------------------------
// The sounds
// ---------------------------------------------------------------------------------------

const SOUNDS = {
  /** A wall clock's tick-tock in a quiet room. */
  'snd-wall-clock'() {
    const rnd = mulberry32(11)
    const out = buf(10)
    for (let k = 0; k < 10; k++) {
      const pitch = k % 2 === 0 ? 1 : 0.86
      const t = S(0.45 + k * 1.0 + (rnd() - 0.5) * 0.004)
      const tick = burst(rnd, 0.06, 0.004, 'bandpass', 3100 * pitch, 2, 0.35, 0.0006)
      mixInto(tick, mode(1650 * pitch, 0.012, 0.08, 0.5, 0.0006))
      mixInto(tick, mode(2900 * pitch, 0.007, 0.06, 0.3, 0.0006))
      mixInto(tick, mode(430 * pitch, 0.03, 0.12, 0.35, 0.001))
      mixInto(out, tick, t, 1)
    }
    const room = reverb(out, 0.18, 0.6, 0.5)
    filter(room, 'lowpass', 6500, 0.7)
    return fades(room, 0.05, 0.4)
  },

  /** A pressure cooker simmering, then two whistles. */
  'snd-pressure-cooker'() {
    const rnd = mulberry32(22)
    const n = S(12)
    const out = new Float32Array(n)
    const simmer = filter(brown(n, rnd), 'lowpass', 700, 0.7)
    mixInto(out, simmer, 0, 0.35)
    for (let t = 0.1; t < 11.8; t += 0.04 + rnd() * 0.12) {
      mixInto(out, mode(180 + rnd() * 420, 0.012 + rnd() * 0.02, 0.1, 0.05 + rnd() * 0.06, 0.004), S(t))
    }
    const steam = filter(filter(white(n, rnd), 'highpass', 1800, 0.7), 'lowpass', 5000, 0.7)
    mixInto(out, steam, 0, 0.02)
    const whistle = (start, length) => {
      const len = length + 1.2
      const rise = 1.1, fall = 0.9
      const fAt = (t) => {
        const base = t < rise ? 900 + (1850 - 900) * Math.pow(t / rise, 0.7) : t < length ? 1850 + 40 * Math.sin(TAU * 5.5 * t) : 1850 - 350 * Math.min(1, (t - length) / fall)
        return base
      }
      const envAt = (t) => t < rise ? Math.pow(t / rise, 2) : t < length ? 1 : Math.max(0, 1 - (t - length) / fall)
      const tone = sweep(len, fAt, (t) => envAt(t) * envAt(t) * 0.22, [1, 0.25, 0.08])
      const hiss = white(S(len), rnd)
      filter(hiss, 'bandpass', (i) => fAt(i / SR), (i) => 2 + 14 * Math.min(1, i / SR / rise))
      scale(hiss, (i) => envAt(i / SR) * 0.9)
      mixInto(tone, hiss)
      filter(tone, 'lowpass', 4200, 0.7)
      mixInto(out, tone, S(start), 1)
    }
    whistle(2.4, 3.4)
    whistle(7.9, 2.6)
    return fades(reverb(out, 0.12, 0.7, 0.5), 0.6, 0.8)
  },

  /** Steady rain on a roof, with a few heavier drops on a sheet. Loops. */
  'snd-rain-roof'() {
    const rnd = mulberry32(33)
    const total = 12.6
    const n = S(total)
    const bed = pink(n, rnd)
    filter(bed, 'lowpass', 4500, 0.7)
    filter(bed, 'highpass', 180, 0.7)
    const swell = wander(n, rnd, 0.4)
    scale(bed, (i) => 0.55 * (1 + 0.12 * swell[i]))
    const out = bed
    for (let t = 0; t < total - 0.1; t += rnd() * 0.035) {
      const f = 1500 + rnd() * 3500
      mixInto(out, mode(f, 0.002 + rnd() * 0.005, 0.03, 0.015 + rnd() * 0.05, 0.0008), S(t))
    }
    for (let t = 0; t < total - 0.3; t += 0.1 + rnd() * 0.5) {
      const f = 520 + rnd() * 600
      const drop = mode(f, 0.03, 0.2, 0.08 + rnd() * 0.06, 0.0015)
      mixInto(drop, mode(f * 2.71, 0.012, 0.1, 0.03, 0.0015))
      mixInto(out, drop, S(t))
    }
    return fades(loopable(filter(out, 'lowpass', 7000, 0.7), 12), 0.4, 0.4)
  },

  /** Morning birdsong: chirps, a whistled phrase and a distant trill. */
  'snd-birds-morning'() {
    const rnd = mulberry32(44)
    const n = S(12)
    const out = filter(pink(n, rnd), 'lowpass', 1200, 0.7)
    scale(out, 0.05)
    const chirp = (at, f1, f2, len, amp) => {
      const s = sweep(len, (t) => f1 + (f2 - f1) * (t / len) + 120 * Math.sin(TAU * 55 * t), (t) => Math.pow(Math.sin(Math.PI * t / len), 1.5) * amp, [1, 0.12])
      mixInto(out, s, S(at))
    }
    // Small chirping bird, in groups.
    for (let g = 0.4; g < 11; g += 1.6 + rnd() * 1.4) {
      const count = 3 + Math.floor(rnd() * 3)
      for (let k = 0; k < count; k++) chirp(g + k * (0.11 + rnd() * 0.04), 4300 + rnd() * 400, 3100 + rnd() * 300, 0.06 + rnd() * 0.03, 0.14)
    }
    // A whistled four-note phrase, farther away.
    const phrase = [[1850, 2550], [2500, 2150], [2150, 2750], [2700, 2300]]
    for (const start of [1.3, 5.2, 9.0]) {
      phrase.forEach(([a, b], k) => chirp(start + k * 0.26, a, b, 0.2, 0.09))
    }
    // A distant trill.
    for (const start of [3.4, 7.6]) {
      const len = 0.7
      const s = sweep(len, () => 3150, (t) => (0.5 + 0.5 * Math.sin(TAU * 22 * t)) * Math.sin(Math.PI * t / len) * 0.05)
      mixInto(out, s, S(start))
    }
    filter(out, 'lowpass', 7000, 0.7)
    return fades(reverb(out, 0.2, 1.1, 0.35), 0.8, 1.0)
  },

  /** A rotary bicycle bell: two "tring-tring" rings. */
  'snd-bicycle-bell'() {
    const rnd = mulberry32(55)
    const out = buf(6)
    const partials = [[1, 1, 1.1], [1.47, 0.5, 0.8], [2.09, 0.35, 0.6], [2.56, 0.2, 0.4], [3.9, 0.08, 0.25]]
    const strike = (at, amp) => {
      for (const [r, a, d] of partials) mixInto(out, mode(2050 * r, d * 0.5, 1.6, a * amp, 0.0015, rnd() * TAU), S(at))
      mixInto(out, burst(rnd, 0.02, 0.002, 'bandpass', 5000, 1.5, 0.15 * amp, 0.0008), S(at))
    }
    for (const start of [0.35, 0.95, 3.1, 3.7]) {
      for (let k = 0; k < 6; k++) strike(start + k / 20, 0.5 - k * 0.05)
    }
    filter(out, 'lowpass', 6500, 0.7)
    return fades(reverb(out, 0.1, 0.5, 0.5), 0.05, 0.8)
  },

  /** A brass hand-bell rung by swinging, heard across a yard. */
  'snd-school-bell'() {
    const rnd = mulberry32(66)
    const out = buf(8)
    const partials = [[0.5, 0.2, 2.0], [1, 1, 1.6], [1.19, 0.45, 1.2], [1.5, 0.35, 1.0], [2.0, 0.45, 0.8], [2.52, 0.18, 0.5], [2.98, 0.1, 0.35]]
    let t = 0.3
    let k = 0
    while (t < 4.6) {
      const amp = (k % 2 === 0 ? 1 : 0.8) * (0.85 + rnd() * 0.15)
      for (const [r, a, d] of partials) mixInto(out, mode(1180 * r, d * 0.55, 3, a * amp * 0.25, 0.002, rnd() * TAU), S(t))
      t += 0.34 + rnd() * 0.04
      k++
    }
    scale(out, (i) => 0.82 + 0.18 * Math.cos(TAU * 1.45 * i / SR))
    filter(out, 'lowpass', 5000, 0.7)
    return fades(reverb(out, 0.28, 1.2, 0.45), 0.05, 1.2)
  },

  /** A radio being tuned through static, settling on a soft melody. */
  'snd-radio-tuning'() {
    const rnd = mulberry32(77)
    const n = S(10)
    const out = new Float32Array(n)
    const staticNoise = white(n, rnd)
    filter(staticNoise, 'highpass', 300, 0.7)
    filter(staticNoise, 'lowpass', 3400, 0.7)
    const crackle = wander(n, rnd, 18)
    scale(staticNoise, (i) => {
      const t = i / SR
      const level = t < 3.6 ? 0.22 : t < 4.4 ? 0.22 - 0.18 * (t - 3.6) / 0.8 : 0.04
      return level * (0.8 + 0.2 * crackle[i])
    })
    mixInto(out, staticNoise)
    // Heterodyne whistles as the dial passes stations.
    const pass = (at, len, top) => {
      const s = sweep(len, (t) => 60 + top * Math.abs(1 - 2 * t / len), (t) => Math.sin(Math.PI * t / len) * 0.05)
      mixInto(out, s, S(at))
      const garble = white(S(len), rnd)
      filter(garble, 'bandpass', 900, 1.2)
      scale(garble, (i) => Math.sin(Math.PI * i / S(len)) * (0.5 + 0.5 * Math.sin(TAU * 4.5 * i / SR)) * 0.12)
      mixInto(out, garble, S(at))
    }
    pass(0.6, 0.9, 2600)
    pass(2.0, 0.8, 2200)
    // Settling on the station.
    mixInto(out, sweep(1.0, (t) => 40 + 2000 * (1 - t), (t) => (1 - t) * 0.04), S(3.4))
    // A soft, original pentatonic tune, plucked, through a small speaker.
    const tune = new Float32Array(n)
    const melody = ['E4', 'G4', 'A4', 'G4', 'E4', 'D4', 'C4', 'D4', 'E4', 'G4', 'E4', 'D4', 'C4']
    melody.forEach((name, k) => {
      const f = note(name)
      const period = SR / f
      const len = S(1.2)
      const pluck = new Float32Array(len)
      const line = new Float32Array(Math.round(period))
      for (let i = 0; i < line.length; i++) line[i] = rnd() * 2 - 1
      let idx = 0
      for (let i = 0; i < len; i++) {
        const next = (idx + 1) % line.length
        const v = line[idx]
        line[idx] = 0.497 * (v + line[next])
        idx = next
        pluck[i] = v * Math.min(1, i / S(0.004))
      }
      mixInto(tune, pluck, S(4.3 + k * 0.38), 0.3)
    })
    const drone = sweep(5.6, (t) => note('C3') * (1 + 0.002 * Math.sin(TAU * 0.3 * t)), (t) => Math.min(1, t / 0.6) * Math.min(1, (5.6 - t) / 0.8) * 0.05, [1, 0.5, 0.3])
    mixInto(tune, drone, S(4.1))
    filter(tune, 'highpass', 260, 0.7)
    filter(tune, 'lowpass', 3000, 0.7)
    for (let i = 0; i < tune.length; i++) tune[i] = Math.tanh(tune[i] * 1.6) / 1.6
    mixInto(out, tune)
    return fades(out, 0.3, 0.9)
  },

  /** A ceiling fan turning: mains hum, soft air and a faint tick. Loops. */
  'snd-ceiling-fan'() {
    const rnd = mulberry32(88)
    const total = 12.5
    const n = S(total)
    const air = pink(n, rnd)
    filter(air, 'lowpass', 850, 0.7)
    filter(air, 'highpass', 60, 0.7)
    const slow = wander(n, rnd, 0.3)
    scale(air, (i) => 0.7 * (1 + 0.2 * Math.sin(TAU * 4.5 * i / SR)) * (1 + 0.08 * slow[i]))
    const out = air
    const hum = sweep(total, () => 100, () => 0.025, [1, 0.4, 0.15])
    mixInto(out, hum)
    for (let t = 0.2; t < total - 0.1; t += 1 / 1.5) {
      mixInto(out, burst(rnd, 0.03, 0.003, 'bandpass', 2200, 3, 0.03, 0.0008), S(t))
    }
    return fades(loopable(out, 12), 0.5, 0.5)
  },

  /** A harmonium: a drone and a short, simple phrase ending on a chord. */
  'snd-harmonium'() {
    const n = S(12)
    const out = new Float32Array(n)
    const reed = (f, start, len, amp) => {
      const count = Math.max(1, Math.floor(4200 / f))
      const harmonics = Array.from({ length: count }, (_, k) => 1 / Math.pow(k + 1, 1.05))
      const envAt = (t) => Math.min(1, t / 0.07) * Math.min(1, Math.max(0, (len - t) / 0.14)) * amp
      const a = sweep(len, () => f, envAt, harmonics)
      const b = sweep(len, () => f + 0.9, envAt, harmonics)
      mixInto(out, a, S(start), 0.5)
      mixInto(out, b, S(start), 0.5)
    }
    reed(note('C3'), 0.2, 11.2, 0.22)
    reed(note('G3'), 0.2, 11.2, 0.14)
    const phrase = [['C4', 1.0], ['D4', 0.5], ['E4', 1.0], ['G4', 1.0], ['E4', 0.5], ['D4', 0.5], ['C4', 1.4]]
    let t = 1.0
    for (const [name, len] of phrase) {
      reed(note(name), t, len + 0.05, 0.3)
      t += len
    }
    for (const name of ['C4', 'E4', 'G4']) reed(note(name), t + 0.1, 3.0, 0.2)
    scale(out, (i) => 1 + 0.07 * Math.sin(TAU * 0.35 * i / SR))
    filter(out, 'lowpass', 3200, 0.7)
    return fades(reverb(out, 0.18, 0.9, 0.4), 0.3, 1.0)
  },

  /** A train running over rail joints, with a distant horn. */
  'snd-train'() {
    const rnd = mulberry32(99)
    const n = S(14)
    const out = filter(brown(n, rnd), 'lowpass', 260, 0.7)
    scale(out, 0.45)
    const whine = filter(filter(white(n, rnd), 'highpass', 420, 0.7), 'lowpass', 1400, 0.7)
    mixInto(out, whine, 0, 0.04)
    const clack = (at, amp) => {
      const c = mode(78 + rnd() * 10, 0.045, 0.25, 0.55 * amp, 0.003)
      mixInto(c, burst(rnd, 0.06, 0.008, 'bandpass', 1500, 1.2, 0.28 * amp, 0.002))
      mixInto(c, mode(1150 + rnd() * 100, 0.02, 0.1, 0.06 * amp, 0.002))
      mixInto(out, c, S(at))
    }
    for (let t0 = 0.3; t0 < 13.5; t0 += 1.6) {
      for (const [dt, amp] of [[0, 1], [0.13, 0.85], [0.55, 0.95], [0.68, 0.8]]) clack(t0 + dt + (rnd() - 0.5) * 0.01, amp)
    }
    // A distant two-tone horn.
    const horn = new Float32Array(S(2.4))
    for (const f of [277, 349]) {
      const h = sweep(2.0, (t) => f * (1 - 0.015 * t / 2), (t) => Math.min(1, t / 0.18) * Math.min(1, Math.max(0, (1.75 - t) / 0.4)) * 0.12, [1, 0.6, 0.4, 0.25, 0.15, 0.1])
      mixInto(horn, h)
    }
    filter(horn, 'lowpass', 1400, 0.7)
    mixInto(out, reverb(horn, 0.5, 1.4, 0.3), S(8.2))
    return fades(reverb(out, 0.1, 0.8, 0.5), 1.2, 1.6)
  },

  /** A sewing machine stitching in two runs. */
  'snd-sewing-machine'() {
    const rnd = mulberry32(111)
    const n = S(10)
    const out = new Float32Array(n)
    const runs = [[0.4, 3.6, 8.5], [4.6, 8.9, 10]]
    const rateAt = (t) => {
      for (const [a, b, r] of runs) {
        if (t >= a && t <= b) return r * Math.min(1, 0.45 + (t - a) / 0.5 * 0.55) * Math.min(1, 0.45 + (b - t) / 0.4 * 0.55)
      }
      return 0
    }
    let phase = 0
    let half = false
    const whir = filter(white(n, rnd), 'bandpass', 700, 0.8)
    for (let i = 0; i < n; i++) {
      const t = i / SR
      const r = rateAt(t)
      whir[i] *= r > 0 ? 0.05 * (r / 9) * (0.7 + 0.3 * Math.sin(phase * TAU)) : 0
      phase += r / SR
      if (!half && phase >= 0.5) {
        half = true
        mixInto(out, burst(rnd, 0.03, 0.004, 'bandpass', 2300, 2.5, 0.12, 0.0008), i)
      }
      if (phase >= 1) {
        phase -= 1
        half = false
        const stitch = burst(rnd, 0.04, 0.004, 'bandpass', 3500, 3, 0.22, 0.0008)
        mixInto(stitch, mode(180, 0.015, 0.08, 0.35, 0.002))
        mixInto(out, stitch, i)
      }
    }
    mixInto(out, whir)
    filter(out, 'lowpass', 7000, 0.7)
    return fades(reverb(out, 0.12, 0.5, 0.5), 0.2, 0.6)
  },

  /** Water poured into a vessel that fills, then a few drips. */
  'snd-water-pouring'() {
    const rnd = mulberry32(122)
    const n = S(8)
    const pourStart = 0.5, pourEnd = 6.3
    const fill = (t) => Math.min(1, Math.max(0, (t - pourStart) / (pourEnd - pourStart)))
    const stream = white(n, rnd)
    filter(stream, 'bandpass', (i) => 380 + 950 * Math.pow(fill(i / SR), 1.3), 4)
    const turb = wander(n, rnd, 14)
    const envAt = (t) => t < pourStart ? 0 : t < pourStart + 0.15 ? (t - pourStart) / 0.15 : t < pourEnd ? 1 : Math.max(0, 1 - (t - pourEnd) / 0.35)
    scale(stream, (i) => envAt(i / SR) * 0.6 * (1 + 0.25 * turb[i]))
    const splash = white(n, rnd)
    filter(splash, 'highpass', 500, 0.7)
    filter(splash, 'lowpass', 3200, 0.7)
    scale(splash, (i) => envAt(i / SR) * 0.1 * (1 + 0.4 * turb[i]))
    const out = stream
    mixInto(out, splash)
    const bubble = (at, f0, amp) => {
      const tau = 0.012 + rnd() * 0.014
      const s = sweep(tau * 5, (t) => f0 * (1 + 0.6 * t / (tau * 5)), (t) => Math.exp(-t / tau) * Math.min(1, t / 0.002) * amp)
      mixInto(out, s, S(at))
    }
    for (let t = pourStart; t < pourEnd; t += rnd() * 0.07) bubble(t, 450 + 1100 * fill(t) + rnd() * 300, 0.04 + rnd() * 0.08)
    for (const t of [6.9, 7.35, 7.6]) bubble(t, 1300 + rnd() * 400, 0.08)
    return fades(reverb(out, 0.15, 0.6, 0.5), 0.3, 0.3)
  }
}

// ---------------------------------------------------------------------------------------
// Levels, WAV and MP3
// ---------------------------------------------------------------------------------------

function writeWav(file, x) {
  const data = Buffer.alloc(x.length * 2)
  for (let i = 0; i < x.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), i * 2)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(SR, 24)
  header.writeUInt32LE(SR * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  writeFileSync(file, Buffer.concat([header, data]))
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' })
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`)
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed:\n${r.stderr}`)
  return r.stderr + r.stdout
}

function measure(file) {
  const log = run(FFMPEG, ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=framelog=quiet,volumedetect', '-f', 'null', '-'])
  const lufs = Number(/I:\s+(-?[\d.]+) LUFS/.exec(log)?.[1] ?? NaN)
  const mean = Number(/mean_volume:\s+(-?[\d.]+) dB/.exec(log)?.[1] ?? NaN)
  const max = Number(/max_volume:\s+(-?[\d.]+) dB/.exec(log)?.[1] ?? NaN)
  return { lufs, mean, max }
}

function durationMs(file) {
  const out = spawnSync(tool('ffprobe'), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' })
  return Math.round(Number(out.stdout.trim()) * 1000)
}

function main() {
  const only = process.argv.slice(2)
  const ids = only.length ? only : Object.keys(SOUNDS)
  mkdirSync(OUT_DIR, { recursive: true })
  const work = mkdtempSync(path.join(tmpdir(), 'memoria-sounds-'))
  const report = []
  try {
    for (const id of ids) {
      const make = SOUNDS[id]
      if (!make) throw new Error(`unknown sound id ${id}`)
      let x = make()
      // Peak-normalise to a safe level before measuring.
      let peak = 0
      for (const v of x) peak = Math.max(peak, Math.abs(v))
      scale(x, 0.5 / (peak || 1))
      const raw = path.join(work, `${id}.raw.wav`)
      writeWav(raw, x)
      const before = measure(raw)
      // Gain toward the loudness target, then a soft look-ahead limiter keeps the sample
      // peaks under the ceiling (with 0.5 dB spare for the MP3 encoder). Limiting lowers
      // the loudness of very peaky sounds (a clock's ticks), so this repeats a few times;
      // the total gain is capped so quiet sounds are never pumped up unnaturally.
      const x0 = x
      const ceiling = Math.pow(10, (PEAK_CEILING_DB - 0.5) / 20)
      const wav = path.join(work, `${id}.wav`)
      let gainDb = Math.min(TARGET_LUFS - before.lufs, MAX_GAIN_DB)
      for (let pass = 0; pass < 5; pass++) {
        x = limit(scale(x0.slice(), Math.pow(10, gainDb / 20)), ceiling)
        writeWav(wav, x)
        const diff = TARGET_LUFS - measure(wav).lufs
        if (Math.abs(diff) < 0.4 || gainDb >= MAX_GAIN_DB) break
        gainDb = Math.min(gainDb + diff, MAX_GAIN_DB)
      }
      const mp3 = path.join(OUT_DIR, `${id}.mp3`)
      run(LAME, ['--quiet', '-m', 'm', '--cbr', '-b', '48', '--resample', '24', '--noreplaygain', wav, mp3])
      const after = measure(mp3)
      const entry = { id, durationMs: durationMs(mp3), bytes: statSync(mp3).size, lufs: after.lufs, meanDb: after.mean, maxDb: after.max }
      report.push(entry)
      console.log(`${id.padEnd(22)} ${(entry.durationMs / 1000).toFixed(2)} s  ${(entry.bytes / 1024).toFixed(1)} KB  ${after.lufs} LUFS  mean ${after.mean} dB  max ${after.max} dB`)
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  console.log('Now run tools/suite/content/build-content.mjs so each content.json has the new durations.')
}

main()
