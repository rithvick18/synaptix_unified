/**
 * SignalProcessor: turns plain FaceFrames into ObservationBody messages.
 *
 * Pure and deterministic — all time comes from FaceFrame.t or the `t` arguments. The
 * pipeline per frame is:
 *   1. face lock (never silently switch players),
 *   2. tracking quality + status (with a recovery window after any invalid period),
 *   3. guided calibration of the neutral head pose and open-eye EAR,
 *   4. head orientation relative to calibration, with time-based hysteresis,
 *   5. eye openness / closure / blinks, and nod / head-shake gestures.
 * Anything that cannot be measured honestly is reported as null + reason, never 0.
 */

import type {
  AngleMeasurement,
  BoolMeasurement,
  CalibrationStatus,
  DurationMeasurement,
  Gesture,
  HeadOrientation,
  Measurement,
  ObservationBody,
  OrientationMeasurement,
  PerfInfo,
  RatioMeasurement,
  TrackingStatus,
  UnitMeasurement,
  VisionMeasurements
} from '../protocol/types.ts'
import type { FaceData, FaceFrame, ProcessorStatus, SignalConfig, SignalProcessorApi } from './contracts.ts'
import { DEFAULT_SIGNAL_CONFIG } from './contracts.ts'
import { clamp, mean, roundTo, stdDev, TimeEma } from './filters.ts'
import {
  boxCentre,
  boxIoU,
  boxWidth,
  eulerFromMatrix,
  relativeEar,
  relativeRotation,
  rotationFromEuler,
  rotationFromFaceMatrix,
  type Box,
  type EulerDeg,
  type Mat3
} from './geometry.ts'
import { HeadGestureDetector } from './gestures.ts'

/** Tolerance for elapsed-time comparisons (frame times like k*1000/30 are inexact). */
const TIME_EPS = 1e-6
const MAX_DURATION_MS = 86_400_000
const MAX_FACE_COUNT = 16
const MAX_GESTURES = 16
/** Calibrated EAR at or below this is not an open eye (MediaPipe open eyes are ~0.25–0.35). */
const MIN_OPEN_EAR = 0.12

export interface SignalProcessorOptions {
  /** Gesture id generator. Default crypto.randomUUID(). */
  idFactory?: () => string
  /** Sets ObservationBody.simulated. Default false — only the demo simulation sets it. */
  simulated?: boolean
}

interface CalSample {
  yaw: number
  pitch: number
  roll: number
  earL: number | null
  earR: number | null
}

interface CalibrationState {
  status: CalibrationStatus
  reason: string | null
  phase: 'idle' | 'settle' | 'collect'
  startT: number | null
  /** Status (and its reason) to restore on cancel. */
  prev: CalibrationStatus
  prevReason: string | null
  samples: CalSample[]
  rCal: Mat3 | null
  earL: number | null
  earR: number | null
}

interface State {
  /**
   * box: last matched box. anchor: last box seen fully in frame; a face that drifted to the
   * edge (shrinking, partial box) and came back is matched against it, so it re-locks.
   */
  lock: { box: Box; anchor: Box; lastSeen: number } | null
  /** Set once the locked face has been gone beyond relockGraceMs (until a new lock). */
  lost: boolean
  lockedIndex: number | null
  prevCentre: { c: [number, number]; t: number } | null
  trackingStatus: TrackingStatus
  /** True after any invalid period: the next valid frame starts a recovery window. */
  needsRecovery: boolean
  recoveryStart: number | null
  lastT: number | null

  cal: CalibrationState

  orientActive: boolean
  emaYaw: TimeEma
  emaPitch: TimeEma
  emaRoll: TimeEma
  orientation: HeadOrientation
  lastDecided: 'toward' | 'away' | null
  belowSince: number | null
  aboveSince: number | null
  awayStart: number | null
  awayEpisode: number | null

  eyesClosed: boolean
  closedStart: number | null

  gEmaPitch: TimeEma
  gEmaYaw: TimeEma
  detector: HeadGestureDetector
  gestures: Gesture[]
}

function freshCalibration(): CalibrationState {
  return {
    status: 'uncalibrated',
    reason: null,
    phase: 'idle',
    startT: null,
    prev: 'uncalibrated',
    prevReason: null,
    samples: [],
    rCal: null,
    earL: null,
    earR: null
  }
}

// --- measurement builders (clamp, round, and never emit NaN/Infinity) --------------------

function num(value: number | null, reason: string, lo: number, hi: number, decimals: number): Measurement<number> {
  if (value === null) return { value: null, reason }
  if (!Number.isFinite(value)) return { value: null, reason: 'non_finite_value' }
  return { value: clamp(roundTo(value, decimals), lo, hi), reason: null }
}
const angleM = (v: number | null, r: string): AngleMeasurement => num(v, r, -180, 180, 2)
const unitM = (v: number | null, r: string): UnitMeasurement => num(v, r, 0, 1, 4)
const ratioM = (v: number | null, r: string): RatioMeasurement => num(v, r, 0, 5, 4)
const durationM = (v: number | null, r: string): DurationMeasurement => num(v, r, 0, MAX_DURATION_MS, 0)

function allUnavailable(reason: string): VisionMeasurements {
  const u = { value: null, reason }
  return {
    head_yaw_deg: { ...u },
    head_pitch_deg: { ...u },
    head_roll_deg: { ...u },
    head_facing_score: { ...u },
    head_orientation: { ...u },
    head_away_ms: { ...u },
    head_away_episode: null,
    eye_openness_left: { ...u },
    eye_openness_right: { ...u },
    eye_blink_coefficient_left: { ...u },
    eye_blink_coefficient_right: { ...u },
    eyes_closed: { ...u },
    eyes_closed_ms: { ...u }
  }
}

function defaultIdFactory(): string {
  return crypto.randomUUID()
}

export class SignalProcessor implements SignalProcessorApi {
  private readonly cfg: SignalConfig
  private readonly idFactory: () => string
  private readonly simulated: boolean
  private s: State

  constructor(config?: Partial<SignalConfig>, options?: SignalProcessorOptions) {
    this.cfg = { ...DEFAULT_SIGNAL_CONFIG, ...(config ?? {}) }
    this.idFactory = options?.idFactory ?? defaultIdFactory
    this.simulated = options?.simulated ?? false
    this.s = this.freshState()
  }

  private freshState(): State {
    const c = this.cfg
    return {
      lock: null,
      lost: false,
      lockedIndex: null,
      prevCentre: null,
      trackingStatus: 'not_started',
      needsRecovery: true,
      recoveryStart: null,
      lastT: null,
      cal: freshCalibration(),
      orientActive: false,
      emaYaw: new TimeEma(c.angleTauMs),
      emaPitch: new TimeEma(c.angleTauMs),
      emaRoll: new TimeEma(c.angleTauMs),
      orientation: 'uncertain',
      lastDecided: null,
      belowSince: null,
      aboveSince: null,
      awayStart: null,
      awayEpisode: null,
      eyesClosed: false,
      closedStart: null,
      gEmaPitch: new TimeEma(c.gestureTauMs),
      gEmaYaw: new TimeEma(c.gestureTauMs),
      detector: new HeadGestureDetector(c),
      gestures: []
    }
  }

  // --- public API ----------------------------------------------------------------------

  process(frame: FaceFrame, perf: PerfInfo | null): ObservationBody {
    const s = this.s
    const cfg = this.cfg
    const t = Number.isFinite(frame.t) ? frame.t : (s.lastT ?? 0)
    s.lastT = t
    s.gestures = []
    const faces = Array.isArray(frame.faces) ? frame.faces : []
    const multi = faces.length > 1

    // 1. Face lock.
    const sel = this.selectFace(faces, t)
    s.lockedIndex = sel.face ? sel.index : null

    // 2. Rotation, quality, tracking status.
    const face = sel.face
    const R = face ? rotationFromFaceMatrix(face.matrix) : null
    const raw = R ? eulerFromMatrix(R) : null
    let quality: number | null = null
    let status: TrackingStatus
    let reason: string | null
    let validLock = false
    if (face) {
      const pose = this.relativeAngles(R) ?? raw
      quality = this.quality(face, t, frame.inferenceMs, multi, pose, R === null)
      if (quality < cfg.minQuality) {
        status = 'low_quality'
        reason = 'low_quality'
      } else {
        validLock = true
        if (s.needsRecovery) {
          s.recoveryStart = t
          s.needsRecovery = false
        }
        if (s.recoveryStart !== null && t - s.recoveryStart < cfg.recoveryMs - TIME_EPS) {
          status = 'recovering'
          reason = 'recovering'
        } else {
          s.recoveryStart = null
          status = 'tracking'
          reason = null
        }
      }
    } else {
      status = sel.status
      reason = sel.reason
    }
    if (!validLock) {
      s.needsRecovery = true
      s.recoveryStart = null
    }
    s.trackingStatus = status

    // 3. Calibration (may complete or fail on this frame).
    this.updateCalibration(t, multi, validLock && face && raw ? { face, raw } : null)

    // 4-5. Orientation, eyes, gestures.
    const rel = this.relativeAngles(R)
    const measurements = this.measure(t, status, face, rel)

    const quality_m: UnitMeasurement = face
      ? unitM(quality, 'low_quality')
      : { value: null, reason: 'no_locked_face' }
    const valid = status === 'tracking' && quality_m.value !== null
    return {
      capture_ts_ms: Math.max(0, t),
      tracking: {
        status,
        valid,
        reason,
        face_count: Math.min(faces.length, MAX_FACE_COUNT),
        multiple_faces_visible: multi,
        quality: quality_m
      },
      calibration: this.calibrationInfo(t),
      measurements,
      gestures: s.gestures.slice(0, MAX_GESTURES),
      perf: perf ? { ...perf } : null,
      simulated: this.simulated
    }
  }

  startCalibration(t: number): void {
    const cal = this.s.cal
    if (cal.status !== 'calibrating') {
      cal.prev = cal.status
      cal.prevReason = cal.reason
    }
    cal.status = 'calibrating'
    cal.reason = null
    cal.phase = 'settle'
    cal.startT = t
    cal.samples = []
    this.resetDerived()
  }

  cancelCalibration(_t: number): void {
    const cal = this.s.cal
    if (cal.status !== 'calibrating') return
    cal.status = cal.prev === 'calibrating' ? 'uncalibrated' : cal.prev
    cal.reason = cal.prevReason
    // A restored 'calibrated' status needs the stored neutral pose; without it, say so.
    if (cal.status === 'calibrated' && cal.rCal === null) {
      cal.status = 'uncalibrated'
      cal.reason = null
    }
    cal.phase = 'idle'
    cal.startT = null
    cal.samples = []
    this.resetDerived()
  }

  suspend(t: number, perf: PerfInfo | null): ObservationBody {
    const s = this.s
    s.needsRecovery = true
    s.recoveryStart = null
    s.trackingStatus = 'suspended'
    s.lockedIndex = null
    s.prevCentre = null
    s.gestures = []
    if (s.cal.status === 'calibrating') this.failCalibration('suspended')
    this.resetDerived()
    const ts = Number.isFinite(t) ? t : (s.lastT ?? 0)
    return {
      capture_ts_ms: Math.max(0, ts),
      tracking: {
        status: 'suspended',
        valid: false,
        reason: 'suspended',
        face_count: 0,
        multiple_faces_visible: false,
        quality: { value: null, reason: 'suspended' }
      },
      calibration: this.calibrationInfo(ts),
      measurements: allUnavailable('suspended'),
      gestures: [],
      perf: perf ? { ...perf } : null,
      simulated: this.simulated
    }
  }

  resume(_t: number): void {
    this.s.needsRecovery = true
    this.s.recoveryStart = null
    this.s.prevCentre = null
    this.resetDerived()
  }

  reset(): void {
    this.s = this.freshState()
  }

  status(): ProcessorStatus {
    const cal = this.s.cal
    return {
      tracking: this.s.trackingStatus,
      calibration: cal.status,
      calibrationPhase: cal.status === 'calibrating' ? cal.phase : 'idle',
      calibrationProgress: this.progress(this.s.lastT),
      calibrationReason: cal.reason,
      lockedFaceIndex: this.s.lockedIndex
    }
  }

  lastGestures(): Gesture[] {
    return this.s.gestures.map((g) => ({ ...g }))
  }

  // --- face lock -----------------------------------------------------------------------

  private selectFace(
    faces: FaceData[],
    t: number
  ): { face: FaceData; index: number } | { face: null; index: null; status: TrackingStatus; reason: string } {
    const s = this.s
    const cfg = this.cfg
    const lock = s.lock

    if (!lock) {
      if (faces.length === 1) {
        s.lock = { box: { ...faces[0].box }, anchor: { ...faces[0].box }, lastSeen: t }
        s.lost = false
        s.prevCentre = null
        return { face: faces[0], index: 0 }
      }
      if (faces.length > 1) return { face: null, index: null, status: 'multiple_faces', reason: 'multiple_faces_ambiguous' }
      return s.lost
        ? { face: null, index: null, status: 'lost', reason: 'face_lost_recalibrate' }
        : { face: null, index: null, status: 'no_face', reason: 'no_face' }
    }

    // Locked: best IoU against the last locked box; a second overlapping face is ambiguous.
    let best = -1
    let bestIoU = -1
    let secondIoU = -1
    faces.forEach((f, i) => {
      const iou = boxIoU(lock.box, f.box)
      if (iou > bestIoU) {
        secondIoU = bestIoU
        bestIoU = iou
        best = i
      } else if (iou > secondIoU) {
        secondIoU = iou
      }
    })
    if (faces.length > 1 && secondIoU >= cfg.multiFaceIouMin) {
      // The player is plausibly present but we cannot tell which face is theirs.
      lock.lastSeen = t
      return { face: null, index: null, status: 'multiple_faces', reason: 'multiple_faces_ambiguous' }
    }
    let accept = best >= 0 && bestIoU >= cfg.multiFaceIouMin
    if (!accept && faces.length === 1) {
      // Fast motion can drop IoU below the threshold for a single frame, and a face that
      // left partially leaves a shrunken box behind: accept a lone face that is close to
      // and of similar size to either the last box or the last fully-in-frame box.
      accept = nearAndSimilar(lock.box, faces[0].box) || nearAndSimilar(lock.anchor, faces[0].box)
      if (accept) best = 0
    }
    if (accept) {
      const f = faces[best]
      lock.box = { ...f.box }
      if (f.inFrameFraction >= FULL_IN_FRAME) lock.anchor = { ...f.box }
      lock.lastSeen = t
      return { face: f, index: best }
    }

    // Locked face not found.
    if (t - lock.lastSeen > cfg.relockGraceMs + TIME_EPS) {
      s.lock = null
      s.lost = true
      s.prevCentre = null
      const cal = s.cal
      if (cal.status === 'calibrated') {
        cal.status = 'required'
        cal.reason = 'face_lost'
      } else if (cal.status === 'calibrating') {
        this.failCalibration('face_lost')
      }
      return { face: null, index: null, status: 'lost', reason: 'face_lost_recalibrate' }
    }
    if (faces.length > 1) return { face: null, index: null, status: 'multiple_faces', reason: 'locked_face_not_found' }
    return { face: null, index: null, status: 'no_face', reason: faces.length ? 'locked_face_not_found' : 'no_face' }
  }

  /**
   * tracking_quality heuristic (MediaPipe exposes no per-face confidence here, so none is
   * invented). Product of factors, clamped to [0,1]:
   *   size    clamp((w - 0.06) / (0.15 - 0.06), 0, 1)        w = normalised box width
   *   inFrame clamp((inFrameFraction - 0.85) / 0.15, 0, 1)
   *   pose    max(0.5, clamp(1 - max(0, e - 1) / 0.5, 0, 1)) e = max(|yaw|/45, |pitch|/35),
   *                                                          relative if calibrated else raw
   *   motion  clamp(1 - (v - 2) / 4, 0.3, 1)                 v = centre shift / w / seconds
   *   × 0.8 if more than one face is visible
   *   × 0.5 if the transformation matrix is missing
   *   × 0.8 if inference took > 150 ms (stale frame)
   */
  private quality(
    face: FaceData,
    t: number,
    inferenceMs: number,
    multi: boolean,
    pose: EulerDeg | null,
    matrixMissing: boolean
  ): number {
    const s = this.s
    const w = boxWidth(face.box)
    const qSize = clamp((w - 0.06) / (0.15 - 0.06), 0, 1)
    const qFrame = clamp((face.inFrameFraction - 0.85) / 0.15, 0, 1)
    let qPose = 1
    if (pose) {
      const e = Math.max(Math.abs(pose.yaw) / 45, Math.abs(pose.pitch) / 35)
      qPose = Math.max(0.5, clamp(1 - Math.max(0, e - 1) / 0.5, 0, 1))
    }
    const centre = boxCentre(face.box)
    let qMotion = 1
    if (s.prevCentre && w > 0) {
      const dtS = (t - s.prevCentre.t) / 1000
      if (dtS > 0) {
        const v = Math.hypot(centre[0] - s.prevCentre.c[0], centre[1] - s.prevCentre.c[1]) / w / dtS
        qMotion = clamp(1 - (v - 2) / 4, 0.3, 1)
      }
    }
    s.prevCentre = { c: centre, t }
    let q = qSize * qFrame * qPose * qMotion
    if (multi) q *= 0.8
    if (matrixMissing) q *= 0.5
    if (inferenceMs > 150) q *= 0.8
    return Number.isFinite(q) ? clamp(q, 0, 1) : 0
  }

  // --- calibration ---------------------------------------------------------------------

  private relativeAngles(R: Mat3 | null): EulerDeg | null {
    const cal = this.s.cal
    if (!R || cal.status !== 'calibrated' || !cal.rCal) return null
    return eulerFromMatrix(relativeRotation(R, cal.rCal))
  }

  private progress(t: number | null): number | null {
    const cal = this.s.cal
    if (cal.status === 'calibrated') return 1
    if (cal.status !== 'calibrating' || cal.startT === null || t === null) return null
    const total = this.cfg.calibrationSettleMs + this.cfg.calibrationDurationMs
    const p = total > 0 ? (t - cal.startT) / total : 1
    return Number.isFinite(p) ? clamp(p, 0, 1) : 0
  }

  private calibrationInfo(t: number): ObservationBody['calibration'] {
    const cal = this.s.cal
    const p = this.progress(t)
    return { status: cal.status, reason: cal.reason, progress: p === null ? null : roundTo(p, 4) }
  }

  private failCalibration(reason: string): void {
    const cal = this.s.cal
    cal.status = 'failed'
    cal.reason = reason
    cal.phase = 'idle'
    cal.startT = null
    cal.samples = []
    cal.rCal = null
    cal.earL = null
    cal.earR = null
  }

  private updateCalibration(t: number, multi: boolean, sample: { face: FaceData; raw: EulerDeg } | null): void {
    const cal = this.s.cal
    const cfg = this.cfg
    if (cal.status !== 'calibrating' || cal.startT === null) return
    if (multi) {
      this.failCalibration('multiple_faces')
      return
    }
    const elapsed = t - cal.startT
    if (elapsed < cfg.calibrationSettleMs) {
      cal.phase = 'settle'
      return
    }
    if (elapsed < cfg.calibrationSettleMs + cfg.calibrationDurationMs) {
      cal.phase = 'collect'
      if (sample) {
        cal.samples.push({
          yaw: sample.raw.yaw,
          pitch: sample.raw.pitch,
          roll: sample.raw.roll,
          earL: sample.face.earLeft,
          earR: sample.face.earRight
        })
      }
      return
    }
    this.finishCalibration()
  }

  private finishCalibration(): void {
    const cal = this.s.cal
    const cfg = this.cfg
    const xs = cal.samples
    if (xs.length < cfg.calibrationMinSamples) return this.failCalibration('insufficient_samples')
    const yaws = xs.map((x) => x.yaw)
    const pitches = xs.map((x) => x.pitch)
    const sy = stdDev(yaws) ?? Infinity
    const sp = stdDev(pitches) ?? Infinity
    if (sy > cfg.calibrationMaxStdDeg || sp > cfg.calibrationMaxStdDeg) return this.failCalibration('unstable_pose')
    const my = mean(yaws) ?? 0
    const mp = mean(pitches) ?? 0
    const mr = mean(xs.map((x) => x.roll)) ?? 0
    if (Math.abs(my) > cfg.calibrationMaxAbsDeg || Math.abs(mp) > cfg.calibrationMaxAbsDeg) {
      return this.failCalibration('face_not_frontal')
    }
    const finite = (v: number | null): v is number => v !== null && Number.isFinite(v)
    const earL = mean(xs.map((x) => x.earL).filter(finite))
    const earR = mean(xs.map((x) => x.earR).filter(finite))
    if (earL === null || earR === null || earL <= MIN_OPEN_EAR || earR <= MIN_OPEN_EAR) {
      return this.failCalibration('eyes_not_open')
    }
    cal.status = 'calibrated'
    cal.reason = null
    cal.phase = 'idle'
    cal.startT = null
    cal.samples = []
    cal.rCal = rotationFromEuler(my, mp, mr)
    cal.earL = earL
    cal.earR = earR
    this.resetDerived()
    this.s.lastDecided = null
  }

  // --- orientation, eyes, gestures -----------------------------------------------------

  /** Drop all temporal derived state; the next measured frame re-seeds (and starts 'uncertain'). */
  private resetDerived(): void {
    this.deactivateOrientation()
    this.resetEyes()
    this.resetGestures()
  }

  private deactivateOrientation(): void {
    const s = this.s
    s.orientActive = false
    s.emaYaw.reset()
    s.emaPitch.reset()
    s.emaRoll.reset()
    s.orientation = 'uncertain'
    s.belowSince = null
    s.aboveSince = null
    s.awayStart = null
  }

  private resetEyes(): void {
    this.s.eyesClosed = false
    this.s.closedStart = null
  }

  private resetGestures(): void {
    this.s.gEmaPitch.reset()
    this.s.gEmaYaw.reset()
    this.s.detector.reset()
  }

  /** Why relative head measurements are unavailable, or null if they can be computed. */
  private gateReason(status: TrackingStatus, rel: EulerDeg | null): string | null {
    const cal = this.s.cal.status
    if (cal === 'calibrating') return 'calibrating'
    if (cal === 'required') return 'calibration_required'
    if (cal !== 'calibrated') return 'uncalibrated'
    if (status !== 'tracking') return status
    if (!rel) return 'transformation_matrix_unavailable'
    return null
  }

  private measure(t: number, status: TrackingStatus, face: FaceData | null, rel: EulerDeg | null): VisionMeasurements {
    const s = this.s
    const cfg = this.cfg
    const trackingValid = status === 'tracking' && face !== null

    // Raw blendshapes are meaningful whenever tracking is valid, calibrated or not.
    const blink = (v: number | null | undefined): UnitMeasurement => {
      if (!trackingValid) return { value: null, reason: status }
      if (v === null || v === undefined) return { value: null, reason: 'blendshapes_unavailable' }
      return unitM(v, 'blendshapes_unavailable')
    }
    const blinkL = blink(face?.blinkLeft)
    const blinkR = blink(face?.blinkRight)

    const gate = this.gateReason(status, rel)
    if (gate !== null || !rel || !face) {
      const r = gate ?? 'transformation_matrix_unavailable'
      this.deactivateOrientation()
      this.resetEyes()
      this.resetGestures()
      const u = { value: null, reason: r }
      return {
        head_yaw_deg: { ...u },
        head_pitch_deg: { ...u },
        head_roll_deg: { ...u },
        head_facing_score: { ...u },
        head_orientation: { ...u },
        head_away_ms: { ...u },
        head_away_episode: s.awayEpisode,
        eye_openness_left: { ...u },
        eye_openness_right: { ...u },
        eye_blink_coefficient_left: blinkL,
        eye_blink_coefficient_right: blinkR,
        eyes_closed: { ...u },
        eyes_closed_ms: { ...u }
      }
    }

    // Orientation on angle-smoothed relative yaw/pitch (EMA seeded on the first active frame).
    if (!s.orientActive) {
      s.orientActive = true
      s.orientation = 'uncertain'
      s.belowSince = null
      s.aboveSince = null
      s.awayStart = null
    }
    const yaw = s.emaYaw.update(rel.yaw, t)
    const pitch = s.emaPitch.update(rel.pitch, t)
    const roll = s.emaRoll.update(rel.roll, t)
    const score = clamp(1 - Math.hypot(yaw / cfg.yawLimitDeg, pitch / cfg.pitchLimitDeg), 0, 1)
    const orientation = this.updateOrientation(t, score)

    let awayMs: DurationMeasurement
    if (orientation === 'away' && s.awayStart !== null) awayMs = durationM(t - s.awayStart, 'orientation_uncertain')
    else if (orientation === 'toward') awayMs = durationM(0, 'orientation_uncertain')
    else if (s.lastDecided === 'toward') awayMs = durationM(0, 'orientation_uncertain')
    else awayMs = { value: null, reason: 'orientation_uncertain' }

    // Eyes: openness relative to calibration, only while the head is near-frontal enough
    // for the 2D EAR to mean anything.
    const poseOk = Math.abs(yaw) <= cfg.eyeMaxYawDeg && Math.abs(pitch) <= cfg.eyeMaxPitchDeg
    const openness = (ear: number | null, calEar: number | null): RatioMeasurement => {
      if (!poseOk) return { value: null, reason: 'head_pose_out_of_range' }
      const r = relativeEar(ear, calEar)
      return r === null ? { value: null, reason: 'ear_unavailable' } : ratioM(r, 'ear_unavailable')
    }
    const openL = openness(face.earLeft, s.cal.earL)
    const openR = openness(face.earRight, s.cal.earR)
    const { closed, closedMs } = this.updateEyes(t, openL, openR)

    // Gestures on gesture-smoothed relative angles (separate, faster EMA).
    const gp = s.gEmaPitch.update(rel.pitch, t)
    const gy = s.gEmaYaw.update(rel.yaw, t)
    for (const g of s.detector.push(t, gp, gy)) {
      this.emit(g.type, g.start_ts_ms, g.end_ts_ms, g.amplitude_deg, g.swings)
    }

    return {
      head_yaw_deg: angleM(yaw, 'non_finite_value'),
      head_pitch_deg: angleM(pitch, 'non_finite_value'),
      head_roll_deg: angleM(roll, 'non_finite_value'),
      head_facing_score: unitM(score, 'non_finite_value'),
      head_orientation: { value: orientation, reason: null } as OrientationMeasurement,
      head_away_ms: awayMs,
      head_away_episode: s.awayEpisode,
      eye_openness_left: openL,
      eye_openness_right: openR,
      eye_blink_coefficient_left: blinkL,
      eye_blink_coefficient_right: blinkR,
      eyes_closed: closed,
      eyes_closed_ms: closedMs
    }
  }

  /**
   * Hysteresis with minimum durations in elapsed time (not frames): 'away' once the score
   * has stayed below awayEnterScore for awayMinMs; 'toward' once above towardEnterScore
   * for towardMinMs. Scores between the thresholds never flip the state.
   */
  private updateOrientation(t: number, score: number): HeadOrientation {
    const s = this.s
    const cfg = this.cfg
    if (score < cfg.awayEnterScore) s.belowSince ??= t
    else s.belowSince = null
    if (score > cfg.towardEnterScore) s.aboveSince ??= t
    else s.aboveSince = null

    if (s.orientation !== 'away' && s.belowSince !== null && t - s.belowSince >= cfg.awayMinMs - TIME_EPS) {
      s.orientation = 'away'
      s.lastDecided = 'away'
      s.awayStart = s.belowSince
      s.awayEpisode = Math.min((s.awayEpisode ?? 0) + 1, 2 ** 31)
    } else if (s.orientation !== 'toward' && s.aboveSince !== null && t - s.aboveSince >= cfg.towardMinMs - TIME_EPS) {
      s.orientation = 'toward'
      s.lastDecided = 'toward'
      s.awayStart = null
    }
    return s.orientation
  }

  /** Eye closure with hysteresis on the mean relative openness; emits blinks on reopening. */
  private updateEyes(
    t: number,
    openL: RatioMeasurement,
    openR: RatioMeasurement
  ): { closed: BoolMeasurement; closedMs: DurationMeasurement } {
    const s = this.s
    const cfg = this.cfg
    const vals = [openL.value, openR.value].filter((v): v is number => v !== null)
    if (vals.length === 0) {
      this.resetEyes()
      const reason = openL.reason ?? openR.reason ?? 'ear_unavailable'
      return { closed: { value: null, reason }, closedMs: { value: null, reason } }
    }
    const m = (mean(vals) as number)
    if (!s.eyesClosed && m < cfg.eyeCloseRatio) {
      s.eyesClosed = true
      s.closedStart = t
    } else if (s.eyesClosed && m > cfg.eyeOpenRatio) {
      const start = s.closedStart ?? t
      const dur = t - start
      s.eyesClosed = false
      s.closedStart = null
      if (dur >= cfg.blinkMinMs - TIME_EPS && dur <= cfg.blinkMaxMs + TIME_EPS) {
        this.emit('blink', start, t, null, null)
      }
    }
    const closedMs = s.eyesClosed && s.closedStart !== null ? t - s.closedStart : 0
    return {
      closed: { value: s.eyesClosed, reason: null },
      closedMs: durationM(closedMs, 'ear_unavailable')
    }
  }

  private emit(
    type: Gesture['type'],
    start: number,
    end: number,
    amplitude: number | null,
    swings: number | null
  ): void {
    const s0 = Math.max(0, Number.isFinite(start) ? start : 0)
    const e0 = Math.max(s0, Number.isFinite(end) ? end : s0)
    this.s.gestures.push({
      gesture_id: this.idFactory(),
      type,
      start_ts_ms: s0,
      end_ts_ms: e0,
      amplitude_deg: amplitude === null || !Number.isFinite(amplitude) ? null : clamp(roundTo(amplitude, 2), 0, 180),
      swings: swings === null ? null : clamp(Math.round(swings), 0, 20)
    })
  }
}

/** Fraction of landmarks inside the image above which a box counts as "fully in frame". */
const FULL_IN_FRAME = 0.95

/** Centre within one reference width, and width ratio within [0.6, 1.6]. */
function nearAndSimilar(ref: Box, box: Box): boolean {
  const refW = boxWidth(ref)
  if (!(refW > 0)) return false
  const [px, py] = boxCentre(ref)
  const [cx, cy] = boxCentre(box)
  const ratio = boxWidth(box) / refW
  return Math.hypot(cx - px, cy - py) <= refW && ratio >= 0.6 && ratio <= 1.6
}
