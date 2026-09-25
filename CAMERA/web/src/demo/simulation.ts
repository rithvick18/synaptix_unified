/**
 * SIMULATION ONLY. Synthesises FaceFrames from UI controls and runs them through the real
 * SignalProcessor (constructed with simulated: true, so every observation is flagged).
 * The demo starts this only from its own explicit button; it is never a fallback for a
 * camera or model failure.
 */

import type { ObservationBody } from '../protocol/types.ts'
import type { FaceData, FaceFrame, SignalProcessorApi } from '../vision/contracts.ts'

export interface SimulationControls {
  yawDeg: number
  pitchDeg: number
  facePresent: boolean
  eyesClosed: boolean
  secondFace: boolean
}

type Motion = { kind: 'nod' | 'shake' | 'blink'; start: number }

const FRAME_MS = 66
const OPEN_EAR = 0.3

/**
 * Column-major 4x4 for the player-perspective angles, inverting the processor's
 * convention: yaw = -θ (about +Y), pitch = -φ (about +X), roll = +ψ (about +Z),
 * with R = Ry(θ)·Rx(φ)·Rz(ψ).
 */
export function matrixFromPlayerAngles(yawDeg: number, pitchDeg: number, rollDeg: number): number[] {
  const rad = Math.PI / 180
  const t = -yawDeg * rad
  const p = -pitchDeg * rad
  const s = rollDeg * rad
  const [cy, sy, cx, sx, cz, sz] = [Math.cos(t), Math.sin(t), Math.cos(p), Math.sin(p), Math.cos(s), Math.sin(s)]
  const r = [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx]
  ]
  const m = new Array<number>(16).fill(0)
  for (let c = 0; c < 3; c++) for (let row = 0; row < 3; row++) m[c * 4 + row] = r[row][c]
  m[14] = -50 // face ~50 cm in front of the camera
  m[15] = 1
  return m
}

export class SimulatedFaceSource {
  private timer: ReturnType<typeof setInterval> | null = null
  private motion: Motion | null = null
  private lastT = 0
  private readonly processor: SignalProcessorApi
  private readonly controls: () => SimulationControls
  private readonly emit: (body: ObservationBody) => void

  constructor(
    processor: SignalProcessorApi,
    controls: () => SimulationControls,
    emit: (body: ObservationBody) => void
  ) {
    this.processor = processor
    this.controls = controls
    this.emit = emit
  }

  get running(): boolean {
    return this.timer !== null
  }

  start(): void {
    if (this.timer) return
    this.processor.resume(performance.now())
    this.timer = setInterval(() => this.tick(), FRAME_MS)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
    this.emit(this.processor.suspend(this.now(), null))
  }

  calibrate(): void {
    this.processor.startCalibration(this.now())
  }

  play(kind: Motion['kind']): void {
    this.motion = { kind, start: this.now() }
  }

  private now(): number {
    // Strictly increasing, like real capture timestamps.
    this.lastT = Math.max(performance.now(), this.lastT + 1)
    return this.lastT
  }

  private tick(): void {
    const t = this.now()
    const c = this.controls()
    let yaw = c.yawDeg
    let pitch = c.pitchDeg
    let eyesClosed = c.eyesClosed

    if (this.motion) {
      const e = t - this.motion.start
      if (this.motion.kind === 'nod' && e < 700) pitch -= 14 * Math.sin((Math.PI * e) / 700)
      else if (this.motion.kind === 'shake' && e < 1000) yaw += 16 * Math.sin((2 * Math.PI * e) / 700)
      else if (this.motion.kind === 'blink' && e < 150) eyesClosed = true
      else this.motion = null
    }

    const faces: FaceData[] = []
    if (c.facePresent) faces.push(this.face(0.35, yaw, pitch, eyesClosed))
    if (c.secondFace) faces.push(this.face(0.72, 0, 0, false))
    const frame: FaceFrame = { t, width: 640, height: 480, faces, inferenceMs: 0 }
    this.emit(this.processor.process(frame, null))
  }

  private face(cx: number, yaw: number, pitch: number, eyesClosed: boolean): FaceData {
    const ear = eyesClosed ? OPEN_EAR * 0.3 : OPEN_EAR
    return {
      box: { x0: cx - 0.13, y0: 0.25, x1: cx + 0.13, y1: 0.7 },
      inFrameFraction: 1,
      earLeft: ear,
      earRight: ear,
      blinkLeft: eyesClosed ? 0.9 : 0.05,
      blinkRight: eyesClosed ? 0.9 : 0.05,
      matrix: matrixFromPlayerAngles(yaw, pitch, 0)
    }
  }
}
