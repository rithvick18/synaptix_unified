import { describe, expect, it } from 'vitest'
import type { Gesture, ObservationBody, PerfInfo } from '../src/protocol/types.ts'
import type { FaceData, SignalConfig } from '../src/vision/contracts.ts'
import { faceMatrixFromRotation, rotationFromEuler } from '../src/vision/geometry.ts'
import { SignalProcessor } from '../src/vision/signals.ts'

// --- synthetic frames ----------------------------------------------------------------

const OPEN_EAR = 0.3
type Box = FaceData['box']
const BOX: Box = { x0: 0.35, y0: 0.25, x1: 0.6, y1: 0.7 } // width 0.25 -> full size quality
const FAR_BOX: Box = { x0: 0.02, y0: 0.3, x1: 0.22, y1: 0.65 }

interface Pose {
  yaw?: number
  pitch?: number
  roll?: number
  ear?: number | null
  earL?: number | null
  earR?: number | null
  blink?: number | null
  box?: Box
  matrix?: null
  inFrame?: number
}

function face(p: Pose = {}): FaceData {
  const ear = p.ear === undefined ? OPEN_EAR : p.ear
  return {
    box: { ...(p.box ?? BOX) },
    inFrameFraction: p.inFrame ?? 1,
    earLeft: p.earL === undefined ? ear : p.earL,
    earRight: p.earR === undefined ? ear : p.earR,
    blinkLeft: p.blink === undefined ? 0.05 : p.blink,
    blinkRight: p.blink === undefined ? 0.05 : p.blink,
    // Scale + translation like MediaPipe's; the processor must strip the scale.
    matrix:
      p.matrix === null
        ? null
        : faceMatrixFromRotation(rotationFromEuler(p.yaw ?? 0, p.pitch ?? 0, p.roll ?? 0), 1.3, [0, 0, -45])
  }
}

const PERF: PerfInfo = { backend: 'worker', delegate: 'GPU', inference_ms: 12, processed_fps: 15, dropped_frames: 0 }

// --- body invariants (mirrors service/app/schemas.py) ---------------------------------

const REASON = /^[a-z0-9_]{1,64}$/
const ID = /^[A-Za-z0-9_.:-]{1,128}$/
type Kind = 'angle' | 'unit' | 'ratio' | 'duration' | 'bool' | 'orientation'
const FIELDS: Record<string, Kind> = {
  head_yaw_deg: 'angle',
  head_pitch_deg: 'angle',
  head_roll_deg: 'angle',
  head_facing_score: 'unit',
  head_orientation: 'orientation',
  head_away_ms: 'duration',
  eye_openness_left: 'ratio',
  eye_openness_right: 'ratio',
  eye_blink_coefficient_left: 'unit',
  eye_blink_coefficient_right: 'unit',
  eyes_closed: 'bool',
  eyes_closed_ms: 'duration'
}

function assertFinite(x: unknown, path: string): void {
  if (typeof x === 'number') {
    if (!Number.isFinite(x)) throw new Error(`non-finite number at ${path}`)
  } else if (Array.isArray(x)) {
    x.forEach((v, i) => assertFinite(v, `${path}[${i}]`))
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) assertFinite(v, `${path}.${k}`)
  }
}

function assertMeasurement(m: { value: unknown; reason: unknown }, kind: Kind, path: string): void {
  expect(Object.keys(m).sort(), path).toEqual(['reason', 'value'])
  expect((m.value === null) !== (m.reason === null), `${path}: exactly one of value/reason`).toBe(true)
  if (m.reason !== null) expect(m.reason, path).toMatch(REASON)
  if (m.value === null) return
  const v = m.value
  switch (kind) {
    case 'angle':
      expect(v as number, path).toBeGreaterThanOrEqual(-180)
      expect(v as number, path).toBeLessThanOrEqual(180)
      break
    case 'unit':
      expect(v as number, path).toBeGreaterThanOrEqual(0)
      expect(v as number, path).toBeLessThanOrEqual(1)
      break
    case 'ratio':
      expect(v as number, path).toBeGreaterThanOrEqual(0)
      expect(v as number, path).toBeLessThanOrEqual(5)
      break
    case 'duration':
      expect(v as number, path).toBeGreaterThanOrEqual(0)
      expect(v as number, path).toBeLessThanOrEqual(86_400_000)
      break
    case 'bool':
      expect(typeof v, path).toBe('boolean')
      break
    case 'orientation':
      expect(['toward', 'away', 'uncertain'], path).toContain(v)
      break
  }
}

function assertBodyValid(b: ObservationBody): void {
  assertFinite(b, 'body')
  expect(b.capture_ts_ms).toBeGreaterThanOrEqual(0)
  const tr = b.tracking
  if (tr.valid) {
    expect(tr.status).toBe('tracking')
    expect(tr.quality.value).not.toBeNull()
  }
  expect(Number.isInteger(tr.face_count) && tr.face_count >= 0 && tr.face_count <= 16).toBe(true)
  if (tr.reason !== null) expect(tr.reason).toMatch(REASON)
  assertMeasurement(tr.quality, 'unit', 'tracking.quality')
  if (b.calibration.reason !== null) expect(b.calibration.reason).toMatch(REASON)
  if (b.calibration.progress !== null) {
    expect(b.calibration.progress).toBeGreaterThanOrEqual(0)
    expect(b.calibration.progress).toBeLessThanOrEqual(1)
  }
  const ms = b.measurements as unknown as Record<string, unknown>
  expect(Object.keys(ms).sort()).toEqual([...Object.keys(FIELDS), 'head_away_episode'].sort())
  for (const [k, kind] of Object.entries(FIELDS)) {
    assertMeasurement(ms[k] as { value: unknown; reason: unknown }, kind, k)
  }
  const ep = b.measurements.head_away_episode
  if (ep !== null) expect(Number.isInteger(ep) && ep >= 0).toBe(true)
  expect(b.gestures.length).toBeLessThanOrEqual(16)
  for (const g of b.gestures) {
    expect(g.gesture_id).toMatch(ID)
    expect(['blink', 'nod', 'head_shake']).toContain(g.type)
    expect(g.start_ts_ms).toBeGreaterThanOrEqual(0)
    expect(g.end_ts_ms).toBeGreaterThanOrEqual(g.start_ts_ms)
    if (g.amplitude_deg !== null) {
      expect(g.amplitude_deg).toBeGreaterThanOrEqual(0)
      expect(g.amplitude_deg).toBeLessThanOrEqual(180)
    }
    if (g.swings !== null) expect(Number.isInteger(g.swings) && g.swings >= 0 && g.swings <= 20).toBe(true)
  }
  expect(typeof b.simulated).toBe('boolean')
}

// --- driver ---------------------------------------------------------------------------

type Scene = (t: number) => FaceData[]
const frontal: Scene = () => [face()]
const none: Scene = () => []

class Driver {
  readonly proc: SignalProcessor
  readonly fps: number
  private k = 0
  readonly bodies: ObservationBody[] = []
  private n = 0

  constructor(fps = 30, config?: Partial<SignalConfig>, idFactory?: () => string) {
    this.fps = fps
    this.proc = new SignalProcessor(config, {
      idFactory: idFactory ?? (() => `g-${++this.n}`)
    })
  }

  get dt(): number {
    return 1000 / this.fps
  }

  /** Time of the next frame (frames sit exactly on the k·1000/fps grid). */
  get t(): number {
    return (this.k * 1000) / this.fps
  }

  step(faces: FaceData[], inferenceMs = 10): ObservationBody {
    const t = this.t
    this.k++
    const body = this.proc.process({ t, width: 640, height: 480, faces, inferenceMs }, PERF)
    assertBodyValid(body)
    this.bodies.push(body)
    return body
  }

  /** Run frames while t < until (absolute ms). */
  runUntil(until: number, scene: Scene): ObservationBody[] {
    const out: ObservationBody[] = []
    while (this.t < until - 1e-9) out.push(this.step(scene(this.t)))
    return out
  }

  runFor(ms: number, scene: Scene): ObservationBody[] {
    return this.runUntil(this.t + ms, scene)
  }

  /** Track, calibrate on a frontal (or given) neutral pose, and settle into 'toward'. */
  calibrate(scene: Scene = frontal): void {
    this.runFor(200, scene)
    this.proc.startCalibration(this.t)
    this.runFor(2800 + 2 * this.dt, scene)
    expect(this.proc.status().calibration).toBe('calibrated')
    this.runFor(400, scene)
    expect(this.last().measurements.head_orientation.value).toBe('toward')
  }

  last(): ObservationBody {
    return this.bodies[this.bodies.length - 1]
  }

  gestures(from = 0): Gesture[] {
    return this.bodies.slice(from).flatMap((b) => b.gestures)
  }
}

/** A nod: pitch dips by `amp` and returns over `dur` ms. */
const nod =
  (start: number, amp = 15, dur = 400): Scene =>
  (t) => {
    const e = t - start
    return [face({ pitch: e >= 0 && e <= dur ? -amp * Math.sin((Math.PI * e) / dur) : 0 })]
  }

/** A head shake: one yaw cycle (right, left, back) over `dur` ms. */
const shake =
  (start: number, amp = 18, dur = 700): Scene =>
  (t) => {
    const e = t - start
    return [face({ yaw: e >= 0 && e <= dur ? amp * Math.sin((2 * Math.PI * e) / dur) : 0 })]
  }

const ramp = (x: number): number => Math.max(0, Math.min(1, x))

// --- tests ----------------------------------------------------------------------------

describe('startup, tracking and recovery', () => {
  it('goes recovering -> tracking after recoveryMs, measured in time', () => {
    const d = new Driver(30)
    const first = d.step([face()])
    expect(first.tracking.status).toBe('recovering')
    expect(first.tracking.valid).toBe(false)
    expect(first.perf).toEqual(PERF)
    expect(first.simulated).toBe(false)
    d.runFor(1000, frontal)
    const firstTracking = d.bodies.find((b) => b.tracking.status === 'tracking')!
    expect(firstTracking.capture_ts_ms).toBeGreaterThanOrEqual(500 - 1e-6)
    expect(firstTracking.capture_ts_ms).toBeLessThan(500 + d.dt)
    expect(firstTracking.tracking.valid).toBe(true)
    expect(firstTracking.tracking.quality.value).toBeCloseTo(1)
  })

  it('reports no_face -> recovering -> tracking after a brief loss', () => {
    const d = new Driver(30)
    d.calibrate()
    const lost = d.runFor(1000, none)
    expect(lost.every((b) => b.tracking.status === 'no_face' && !b.tracking.valid)).toBe(true)
    expect(lost[0].tracking.quality).toEqual({ value: null, reason: 'no_locked_face' })
    expect(lost[0].measurements.head_yaw_deg).toEqual({ value: null, reason: 'no_face' })
    expect(lost[0].calibration.status).toBe('calibrated')

    const back = d.runFor(1000, frontal)
    expect(back[0].tracking.status).toBe('recovering')
    expect(back[0].measurements.head_yaw_deg).toEqual({ value: null, reason: 'recovering' })
    const idx = back.findIndex((b) => b.tracking.status === 'tracking')
    const recoveredAt = back[idx].capture_ts_ms - back[0].capture_ts_ms
    expect(recoveredAt).toBeGreaterThanOrEqual(500 - 1e-6)
    expect(recoveredAt).toBeLessThan(500 + d.dt)
    // Orientation restarts 'uncertain' after recovery, then decides again.
    expect(back[idx].measurements.head_orientation.value).toBe('uncertain')
    expect(d.last().measurements.head_orientation.value).toBe('toward')
    expect(d.last().calibration.status).toBe('calibrated')
  })

  it('declares the face lost beyond relockGraceMs and requires recalibration', () => {
    const d = new Driver(15)
    d.calibrate()
    const bodies = d.runFor(6000, none)
    const lostIdx = bodies.findIndex((b) => b.tracking.status === 'lost')
    expect(lostIdx).toBeGreaterThan(0)
    expect(bodies.slice(0, lostIdx).every((b) => b.tracking.status === 'no_face')).toBe(true)
    const lost = bodies[lostIdx]
    expect(lost.tracking.reason).toBe('face_lost_recalibrate')
    expect(lost.calibration).toEqual({ status: 'required', reason: 'face_lost', progress: null })
    expect(d.last().tracking.status).toBe('lost')

    // A face re-acquired after 'lost' is locked again, but calibration stays required.
    const back = d.runFor(1500, frontal)
    expect(back[0].tracking.status).toBe('recovering')
    expect(d.last().tracking.status).toBe('tracking')
    expect(d.last().calibration.status).toBe('required')
    expect(d.last().measurements.head_yaw_deg).toEqual({ value: null, reason: 'calibration_required' })
    expect(d.last().measurements.eye_blink_coefficient_left.value).toBeCloseTo(0.05)
  })

  it('does not silently switch to a different lone face', () => {
    const d = new Driver(30)
    d.calibrate()
    // Someone else appears on the far side of the image while the player is gone.
    const other = d.runFor(1000, () => [face({ box: FAR_BOX })])
    expect(other.every((b) => b.tracking.status === 'no_face' && !b.tracking.valid)).toBe(true)
    expect(other[0].tracking.reason).toBe('locked_face_not_found')
  })

  it('re-locks a face that drifted out at the edge and came back to its usual place', () => {
    // Regression (found with a face video in headless Chrome): the lock box was last
    // updated on a small partial face at the image edge, so the returning full face failed
    // both the IoU and distance tests and was reported missing until declared lost.
    const d = new Driver(30)
    d.calibrate()
    // Drift gradually to the left edge over 1 s, the box shrinking as the face leaves.
    const edge: Box = { x0: 0.0, y0: 0.3, x1: 0.07, y1: 0.55 }
    const start = d.t
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k
    d.runFor(1000, (t) => {
      const k = Math.min(1, (t - start) / 1000)
      const box: Box = {
        x0: lerp(BOX.x0, edge.x0, k),
        y0: lerp(BOX.y0, edge.y0, k),
        x1: lerp(BOX.x1, edge.x1, k),
        y1: lerp(BOX.y1, edge.y1, k)
      }
      return [face({ box, inFrame: 1 - 0.5 * k })]
    })
    d.runFor(1000, none)
    const back = d.runFor(1000, frontal)
    expect(back.some((b) => b.tracking.status === 'lost')).toBe(false)
    expect(back[0].tracking.status).toBe('recovering')
    expect(d.last().tracking.status).toBe('tracking')
    expect(d.last().calibration.status).toBe('calibrated')
  })

  it('flags low quality for tiny faces and halves quality without a matrix', () => {
    const d = new Driver(30)
    d.runFor(800, () => [face({ box: { x0: 0.4, y0: 0.4, x1: 0.47, y1: 0.5 } })])
    expect(d.last().tracking.status).toBe('low_quality')
    expect(d.last().tracking.valid).toBe(false)
    expect(d.last().tracking.quality.value).toBeLessThan(0.4)

    const d2 = new Driver(30)
    d2.calibrate()
    d2.runFor(1000, () => [face({ matrix: null })])
    const b = d2.last()
    expect(b.tracking.status).toBe('tracking')
    expect(b.tracking.quality.value).toBeCloseTo(0.5)
    expect(b.measurements.head_yaw_deg).toEqual({ value: null, reason: 'transformation_matrix_unavailable' })
    expect(b.measurements.eye_openness_left.reason).toBe('transformation_matrix_unavailable')
  })

  it('suspend returns an all-null suspended body and resume forces recovery', () => {
    const d = new Driver(30)
    d.calibrate()
    const s = d.proc.suspend(d.t, PERF)
    assertBodyValid(s)
    expect(s.tracking).toEqual({
      status: 'suspended',
      valid: false,
      reason: 'suspended',
      face_count: 0,
      multiple_faces_visible: false,
      quality: { value: null, reason: 'suspended' }
    })
    for (const k of Object.keys(FIELDS)) {
      expect((s.measurements as unknown as Record<string, unknown>)[k]).toEqual({ value: null, reason: 'suspended' })
    }
    expect(s.gestures).toEqual([])
    expect(d.proc.status().tracking).toBe('suspended')
    d.proc.resume(d.t + 5000)
    d.runFor(5000, none) // time passes while suspended (no frames)
    const b = d.step([face()])
    expect(b.tracking.status).toBe('recovering')
  })

  it('copies perf and honours the simulated flag', () => {
    const p = new SignalProcessor(undefined, { simulated: true })
    const b = p.process({ t: 0, width: 640, height: 480, faces: [], inferenceMs: 5 }, null)
    assertBodyValid(b)
    expect(b.simulated).toBe(true)
    expect(b.perf).toBeNull()
    expect(b.tracking.status).toBe('no_face')
  })
})

describe('multiple faces', () => {
  it('refuses to lock when several faces are visible at start', () => {
    const d = new Driver(30)
    const bodies = d.runFor(1000, () => [face(), face({ box: FAR_BOX })])
    for (const b of bodies) {
      expect(b.tracking.status).toBe('multiple_faces')
      expect(b.tracking.reason).toBe('multiple_faces_ambiguous')
      expect(b.tracking.valid).toBe(false)
      expect(b.tracking.multiple_faces_visible).toBe(true)
      expect(b.tracking.face_count).toBe(2)
    }
    expect(d.proc.status().lockedFaceIndex).toBeNull()
  })

  it('keeps tracking one clearly locked face with a bystander', () => {
    const d = new Driver(30)
    d.calibrate()
    // Bystander listed first: the lock must follow the player's box, not the index.
    const bodies = d.runFor(1000, () => [face({ box: FAR_BOX, yaw: 40 }), face()])
    const b = bodies[bodies.length - 1]
    expect(b.tracking.status).toBe('tracking')
    expect(b.tracking.valid).toBe(true)
    expect(b.tracking.multiple_faces_visible).toBe(true)
    expect(b.tracking.quality.value).toBeCloseTo(0.8)
    expect(d.proc.status().lockedFaceIndex).toBe(1)
    expect(b.measurements.head_orientation.value).toBe('toward')
  })

  it('is ambiguous when a second face overlaps the locked one', () => {
    const d = new Driver(30)
    d.calibrate()
    const near = { x0: 0.4, y0: 0.25, x1: 0.65, y1: 0.7 }
    const bodies = d.runFor(500, () => [face(), face({ box: near })])
    for (const b of bodies) {
      expect(b.tracking.status).toBe('multiple_faces')
      expect(b.tracking.valid).toBe(false)
      expect(b.measurements.head_yaw_deg.reason).toBe('multiple_faces')
    }
    // When the overlap ends the player's face is re-acquired via recovery.
    const after = d.runFor(1000, frontal)
    expect(after[0].tracking.status).toBe('recovering')
    expect(d.last().tracking.status).toBe('tracking')
  })
})

describe('calibration', () => {
  it('gates orientation and gestures before and during calibration', () => {
    const d = new Driver(30)
    const pre = d.runFor(1000, frontal)
    const b = pre[pre.length - 1]
    expect(b.tracking.status).toBe('tracking')
    expect(b.calibration).toEqual({ status: 'uncalibrated', reason: null, progress: null })
    expect(b.measurements.head_yaw_deg).toEqual({ value: null, reason: 'uncalibrated' })
    expect(b.measurements.head_orientation).toEqual({ value: null, reason: 'uncalibrated' })
    expect(b.measurements.head_away_ms).toEqual({ value: null, reason: 'uncalibrated' })
    expect(b.measurements.eye_openness_left).toEqual({ value: null, reason: 'uncalibrated' })
    // Raw blendshapes are available whenever tracking is valid.
    expect(b.measurements.eye_blink_coefficient_left.value).toBeCloseTo(0.05)

    // Nods before calibration: nothing.
    const start = d.t
    d.runFor(1500, nod(start + 100))
    expect(d.gestures()).toEqual([])

    d.proc.startCalibration(d.t)
    expect(d.proc.status().calibrationPhase).toBe('settle')
    // Nod during the settle phase: suppressed, and it does not spoil the samples.
    const calStart = d.t
    const during = d.runFor(700, nod(calStart + 100))
    expect(during.every((x) => x.gestures.length === 0)).toBe(true)
    expect(during.every((x) => x.measurements.head_pitch_deg.reason === 'calibrating')).toBe(true)
    expect(during.every((x) => x.calibration.status === 'calibrating')).toBe(true)
    const progress = during.map((x) => x.calibration.progress as number)
    expect(progress[0]).toBeGreaterThanOrEqual(0)
    expect(progress.every((p, i) => i === 0 || p >= progress[i - 1])).toBe(true)
    d.runFor(300, frontal)
    expect(d.proc.status().calibrationPhase).toBe('collect')
    d.runFor(2000, frontal)
    expect(d.last().calibration).toEqual({ status: 'calibrated', reason: null, progress: 1 })
    expect(d.gestures()).toEqual([])
    d.runFor(400, frontal)
    expect(d.last().measurements.head_yaw_deg.value).toBeCloseTo(0, 1)
    expect(d.last().measurements.head_facing_score.value).toBeCloseTo(1, 2)
    expect(d.last().measurements.eye_openness_left.value).toBeCloseTo(1, 3)
  })

  it('measures angles relative to an off-axis neutral pose', () => {
    const d = new Driver(30)
    d.calibrate(() => [face({ yaw: 10, pitch: -5 })])
    d.runFor(1000, () => [face({ yaw: 30, pitch: -5 })])
    expect(d.last().measurements.head_yaw_deg.value).toBeCloseTo(20, 1)
    expect(d.last().measurements.head_pitch_deg.value).toBeCloseTo(0, 1)
    d.runFor(1000, () => [face({ yaw: 10, pitch: 5 })])
    // Composed rotations couple slightly (R·R_calᵀ is not a per-angle difference).
    expect(Math.abs(d.last().measurements.head_yaw_deg.value!)).toBeLessThan(1.5)
    expect(Math.abs(d.last().measurements.head_pitch_deg.value! - 10)).toBeLessThan(1)
    d.runFor(1000, () => [face({ yaw: 10, pitch: -5, roll: 8 })])
    expect(d.last().measurements.head_roll_deg.value).toBeCloseTo(8, 0)
  })

  const failures: Array<[string, Scene, string]> = [
    ['unstable pose', (t) => [face({ yaw: 10 * Math.sin((2 * Math.PI * t) / 500) })], 'unstable_pose'],
    ['no face (insufficient samples)', none, 'insufficient_samples'],
    ['not frontal', () => [face({ yaw: 35 })], 'face_not_frontal'],
    ['eyes closed', () => [face({ ear: 0.1 })], 'eyes_not_open'],
    ['multiple faces', (t) => (t > 1500 ? [face(), face({ box: FAR_BOX })] : [face()]), 'multiple_faces']
  ]
  for (const [name, scene, reason] of failures) {
    it(`fails with ${reason} for ${name}`, () => {
      const d = new Driver(30)
      d.runFor(600, frontal)
      d.proc.startCalibration(d.t)
      d.runFor(3000, scene)
      const b = d.last()
      expect(b.calibration.status).toBe('failed')
      expect(b.calibration.reason).toBe(reason)
      expect(d.proc.status().calibrationReason).toBe(reason)
      expect(b.measurements.head_yaw_deg.reason).toBe('uncalibrated')
    })
  }

  it('cancel restores the previous status; reset forgets calibration', () => {
    const d = new Driver(30)
    d.calibrate()
    d.proc.startCalibration(d.t)
    d.runFor(500, frontal)
    d.proc.cancelCalibration(d.t)
    expect(d.proc.status().calibration).toBe('calibrated')
    d.runFor(500, frontal)
    expect(d.last().measurements.head_yaw_deg.value).not.toBeNull()

    d.proc.reset()
    expect(d.proc.status().calibration).toBe('uncalibrated')
    const b = d.step([face()])
    expect(b.tracking.status).toBe('recovering')
    expect(b.measurements.head_yaw_deg.reason).toBe('uncalibrated')

    const fresh = new SignalProcessor()
    fresh.startCalibration(0)
    fresh.cancelCalibration(10)
    expect(fresh.status().calibration).toBe('uncalibrated')
  })
})

describe('head orientation', () => {
  /** Time of the first 'away' after a 40° yaw turn over 300 ms starting at `turnAt`. */
  function awayTransition(fps: number): { turnAt: number; awayAt: number } {
    const d = new Driver(fps)
    d.calibrate()
    const turnAt = 4000
    d.runUntil(turnAt, frontal)
    const bodies = d.runFor(2000, (t) => [face({ yaw: 40 * ramp((t - turnAt) / 300) })])
    const b = bodies.find((x) => x.measurements.head_orientation.value === 'away')!
    expect(b).toBeDefined()
    return { turnAt, awayAt: b.capture_ts_ms }
  }

  it('uses elapsed time, not frames: 10/30/60 fps agree within one frame interval', () => {
    const r60 = awayTransition(60)
    const r30 = awayTransition(30)
    const r10 = awayTransition(10)
    // awayMinMs (300) must elapse after the score crosses the threshold.
    expect(r60.awayAt - r60.turnAt).toBeGreaterThan(300)
    expect(Math.abs(r30.awayAt - r60.awayAt)).toBeLessThanOrEqual(1000 / 30 + 1e-6)
    expect(Math.abs(r10.awayAt - r60.awayAt)).toBeLessThanOrEqual(1000 / 10 + 1e-6)
  })

  it('does not flip while the score hovers between the thresholds', () => {
    const d = new Driver(30)
    d.calibrate()
    // yaw 20..24° -> score 0.4..0.5, between awayEnter (0.35) and towardEnter (0.55).
    const hover = d.runFor(3000, (t) => [face({ yaw: 22 + 2 * Math.sin(t / 100) })])
    expect(hover.every((b) => b.measurements.head_orientation.value === 'toward')).toBe(true)
    expect(hover.every((b) => b.measurements.head_away_ms.value === 0)).toBe(true)
    // Now go away, then hover again: stays away.
    d.runFor(1000, () => [face({ yaw: 40 })])
    expect(d.last().measurements.head_orientation.value).toBe('away')
    const hover2 = d.runFor(2000, (t) => [face({ yaw: 22 + 2 * Math.sin(t / 100) })])
    expect(hover2.every((b) => b.measurements.head_orientation.value === 'away')).toBe(true)
  })

  it('ignores dips shorter than awayMinMs', () => {
    const d = new Driver(30)
    d.calibrate()
    const start = d.t
    // 200 ms glances to 40° every second (score ~0 while there).
    const bodies = d.runFor(5000, (t) => [face({ yaw: (t - start) % 1000 < 200 ? 40 : 0 })])
    expect(bodies.some((b) => (b.measurements.head_facing_score.value as number) < 0.35)).toBe(true)
    expect(bodies.every((b) => b.measurements.head_orientation.value === 'toward')).toBe(true)
    expect(d.last().measurements.head_away_episode).toBeNull()
  })

  it('grows head_away_ms and counts episodes', () => {
    const d = new Driver(30)
    d.calibrate()
    expect(d.last().measurements.head_away_episode).toBeNull()
    expect(d.last().measurements.head_away_ms.value).toBe(0)

    const away1 = d.runFor(2000, () => [face({ yaw: 45 })])
    const awayBodies = away1.filter((b) => b.measurements.head_orientation.value === 'away')
    expect(awayBodies.length).toBeGreaterThan(10)
    const ms = awayBodies.map((b) => b.measurements.head_away_ms.value as number)
    expect(ms[0]).toBeGreaterThanOrEqual(300)
    // Durations are whole ms on the wire.
    for (let i = 1; i < ms.length; i++) expect(Math.abs(ms[i] - ms[i - 1] - d.dt)).toBeLessThanOrEqual(1)
    expect(awayBodies[0].measurements.head_away_episode).toBe(1)

    d.runFor(1000, frontal)
    expect(d.last().measurements.head_orientation.value).toBe('toward')
    expect(d.last().measurements.head_away_ms.value).toBe(0)
    expect(d.last().measurements.head_away_episode).toBe(1)

    d.runFor(1000, () => [face({ pitch: -40 })])
    expect(d.last().measurements.head_orientation.value).toBe('away')
    expect(d.last().measurements.head_away_episode).toBe(2)
  })

  it('starts uncertain after recovery and reports null away time while uncertain after away', () => {
    const d = new Driver(30)
    d.calibrate()
    d.runFor(1500, () => [face({ yaw: 45 })])
    d.runFor(300, none)
    const back = d.runFor(700, () => [face({ yaw: 45 })])
    const first = back.find((b) => b.tracking.status === 'tracking')!
    expect(first.measurements.head_orientation.value).toBe('uncertain')
    expect(first.measurements.head_away_ms).toEqual({ value: null, reason: 'orientation_uncertain' })
  })
})

describe('gestures', () => {
  for (const fps of [15, 30]) {
    it(`detects a nod at ${fps} fps`, () => {
      const d = new Driver(fps)
      d.calibrate()
      const from = d.bodies.length
      const start = d.t + 100
      d.runFor(1500, nod(start))
      const g = d.gestures(from)
      expect(g.map((x) => x.type)).toEqual(['nod'])
      expect(g[0].swings).toBe(2)
      expect(g[0].start_ts_ms).toBeGreaterThanOrEqual(start - 1000 / fps - 1e-6)
      expect(g[0].end_ts_ms).toBeLessThanOrEqual(start + 900)
      expect(g[0].amplitude_deg).toBeGreaterThan(7)
      expect(d.proc.lastGestures()).toEqual([])
    })

    it(`detects a head shake at ${fps} fps`, () => {
      const d = new Driver(fps)
      d.calibrate()
      const from = d.bodies.length
      d.runFor(2000, shake(d.t + 100))
      const g = d.gestures(from)
      expect(g.map((x) => x.type)).toEqual(['head_shake'])
      expect(g[0].swings).toBe(3)
    })
  }

  it('reports lastGestures for the frame that emitted them', () => {
    const d = new Driver(30)
    d.calibrate()
    const start = d.t + 100
    while (d.t < start + 1500) {
      const b = d.step(nod(start)(d.t))
      expect(d.proc.lastGestures()).toEqual(b.gestures)
      if (b.gestures.length) return
    }
    throw new Error('no nod detected')
  })

  it('pure yaw motion never produces a nod', () => {
    const d = new Driver(30)
    d.calibrate()
    const from = d.bodies.length
    const t0 = d.t
    d.runFor(4000, (t) => [face({ yaw: 20 * Math.sin((2 * Math.PI * (t - t0)) / 600) })])
    expect(d.gestures(from).some((g) => g.type === 'nod')).toBe(false)
  })

  it('a single slow look-away-and-back is not a gesture', () => {
    const d = new Driver(30)
    d.calibrate()
    const from = d.bodies.length
    const t0 = d.t
    d.runFor(4000, (t) => {
      const u = ramp((t - t0 - 200) / 600) - ramp((t - t0 - 2200) / 600)
      return [face({ yaw: 35 * u })]
    })
    d.runFor(4000, (t) => {
      const u = ramp((t - t0 - 4200) / 700) - ramp((t - t0 - 6200) / 700)
      return [face({ pitch: -30 * u })]
    })
    expect(d.gestures(from)).toEqual([])
  })

  it('debounces: two nods within the cooldown produce one event', () => {
    const d = new Driver(30)
    d.calibrate()
    const from = d.bodies.length
    const a = d.t + 100
    const b = a + 450
    d.runFor(1500, (t) => (t < b ? nod(a)(t) : nod(b)(t)))
    expect(d.gestures(from).map((g) => g.type)).toEqual(['nod'])
  })

  it('is suppressed during recovery', () => {
    const d = new Driver(30)
    d.calibrate()
    d.runFor(200, none)
    const from = d.bodies.length
    const back = d.t
    const bodies = d.runFor(450, nod(back))
    expect(bodies.every((x) => x.tracking.status === 'recovering')).toBe(true)
    d.runFor(1000, frontal)
    expect(d.gestures(from)).toEqual([])
  })

  it('emits unique ids (default crypto.randomUUID)', () => {
    const p = new SignalProcessor()
    let k = 0
    const step = (faces: FaceData[]): ObservationBody => {
      const b = p.process({ t: (k++ * 1000) / 30, width: 640, height: 480, faces, inferenceMs: 10 }, null)
      assertBodyValid(b)
      return b
    }
    const t = (): number => (k * 1000) / 30
    while (t() < 200) step([face()])
    p.startCalibration(t())
    while (t() < 3200) step([face()])
    expect(p.status().calibration).toBe('calibrated')
    const ids: string[] = []
    for (let i = 0; i < 5; i++) {
      const start = t() + 100
      while (t() < start + 1200) {
        const e = t() - start
        const blinkNow = e > 700 && e < 800
        const pitch = e >= 0 && e <= 400 ? -15 * Math.sin((Math.PI * e) / 400) : 0
        ids.push(...step([face({ pitch, ear: blinkNow ? 0.05 : OPEN_EAR })]).gestures.map((g) => g.gesture_id))
      }
    }
    expect(ids.length).toBe(10) // 5 nods + 5 blinks
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(ID)
  })
})

describe('eyes', () => {
  it('detects a 100 ms blink', () => {
    const d = new Driver(30)
    d.calibrate()
    const from = d.bodies.length
    const start = d.t
    const bodies = d.runFor(600, (t) => [face({ ear: t >= start + 100 && t < start + 200 ? 0.08 : OPEN_EAR, blink: 0.1 })])
    const closedFrames = bodies.filter((b) => b.measurements.eyes_closed.value === true)
    expect(closedFrames.length).toBeGreaterThan(0)
    const g = d.gestures(from)
    expect(g.map((x) => x.type)).toEqual(['blink'])
    expect(g[0].end_ts_ms - g[0].start_ts_ms).toBeCloseTo(100, 0)
    expect(g[0].amplitude_deg).toBeNull()
    expect(g[0].swings).toBeNull()
    expect(bodies[0].measurements.eye_blink_coefficient_left.value).toBeCloseTo(0.1)
  })

  it('a 1.5 s closure is not a blink; eyes_closed_ms grows', () => {
    const d = new Driver(30)
    d.calibrate()
    const from = d.bodies.length
    const start = d.t
    const bodies = d.runFor(2500, (t) => [face({ ear: t >= start + 100 && t < start + 1600 ? 0.08 : OPEN_EAR })])
    const closed = bodies.filter((b) => b.measurements.eyes_closed.value === true)
    const ms = closed.map((b) => b.measurements.eyes_closed_ms.value as number)
    expect(ms[0]).toBe(0)
    expect(ms[ms.length - 1]).toBeGreaterThan(1400)
    for (let i = 1; i < ms.length; i++) expect(ms[i]).toBeGreaterThan(ms[i - 1])
    expect(d.last().measurements.eyes_closed).toEqual({ value: false, reason: null })
    expect(d.last().measurements.eyes_closed_ms).toEqual({ value: 0, reason: null })
    expect(d.gestures(from)).toEqual([])
  })

  it('reports null eye measurements at extreme pose', () => {
    const d = new Driver(30)
    d.calibrate()
    d.runFor(1000, () => [face({ yaw: 35 })])
    const m = d.last().measurements
    expect(m.eye_openness_left).toEqual({ value: null, reason: 'head_pose_out_of_range' })
    expect(m.eye_openness_right).toEqual({ value: null, reason: 'head_pose_out_of_range' })
    expect(m.eyes_closed).toEqual({ value: null, reason: 'head_pose_out_of_range' })
    expect(m.eyes_closed_ms).toEqual({ value: null, reason: 'head_pose_out_of_range' })
    expect(m.head_yaw_deg.value).toBeCloseTo(35, 0)
    // Blendshape coefficients are raw model outputs and stay available.
    expect(m.eye_blink_coefficient_left.value).toBeCloseTo(0.05)
  })

  it('reports per-eye unavailability', () => {
    const d = new Driver(30)
    d.calibrate()
    d.runFor(300, () => [face({ earL: null, blink: null })])
    const m = d.last().measurements
    expect(m.eye_openness_left).toEqual({ value: null, reason: 'ear_unavailable' })
    expect(m.eye_openness_right.value).toBeCloseTo(1, 3)
    expect(m.eyes_closed.value).toBe(false)
    expect(m.eye_blink_coefficient_left).toEqual({ value: null, reason: 'blendshapes_unavailable' })
  })
})

describe('robustness', () => {
  it('never emits NaN/Infinity for garbage inputs', () => {
    const d = new Driver(30)
    d.calibrate()
    const bad = face()
    bad.matrix![0] = Number.NaN
    d.step([bad])
    d.step([{ ...face(), earLeft: Number.NaN, earRight: Number.POSITIVE_INFINITY, blinkLeft: 7 }])
    d.step([{ ...face(), inFrameFraction: Number.NaN }])
    d.step([face({ yaw: 179, pitch: 89 })])
    // assertBodyValid ran on each step; spot-check clamping.
    const b = d.bodies[d.bodies.length - 3]
    expect(b.measurements.eye_blink_coefficient_left.value).toBe(1)
  })
})
