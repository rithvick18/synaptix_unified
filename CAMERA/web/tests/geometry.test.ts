import { describe, expect, it } from 'vitest'
import { emaAlpha, TimeEma, stdDev } from '../src/vision/filters.ts'
import {
  boxIoU,
  eulerFromFaceMatrix,
  eulerFromMatrix,
  eyeAspectRatioFromPoints,
  faceMatrixFromRotation,
  mat3Multiply,
  mat3Transpose,
  relativeRotation,
  rotationFromEuler,
  rotationFromFaceMatrix,
  type Mat3
} from '../src/vision/geometry.ts'

/** R applied to a column vector. */
function apply(R: Mat3, v: [number, number, number]): [number, number, number] {
  return [0, 1, 2].map((r) => R[r * 3] * v[0] + R[r * 3 + 1] * v[1] + R[r * 3 + 2] * v[2]) as [number, number, number]
}

describe('euler <-> rotation', () => {
  it('identity is a frontal face', () => {
    const e = eulerFromMatrix([1, 0, 0, 0, 1, 0, 0, 0, 1])
    expect(e.yaw).toBeCloseTo(0, 9)
    expect(e.pitch).toBeCloseTo(0, 9)
    expect(e.roll).toBeCloseTo(0, 9)
  })

  it('round-trips a grid of angles', () => {
    for (const yaw of [-70, -30, -5, 0, 12, 45, 80]) {
      for (const pitch of [-60, -20, 0, 7, 35, 60]) {
        for (const roll of [-40, 0, 15, 90]) {
          const e = eulerFromMatrix(rotationFromEuler(yaw, pitch, roll))
          expect(e.yaw).toBeCloseTo(yaw, 6)
          expect(e.pitch).toBeCloseTo(pitch, 6)
          expect(e.roll).toBeCloseTo(roll, 6)
        }
      }
    }
  })

  it('produces orthonormal rotations', () => {
    const R = rotationFromEuler(23, -17, 8)
    const I = mat3Multiply(R, mat3Transpose(R))
    I.forEach((v, i) => expect(v).toBeCloseTo(i % 4 === 0 ? 1 : 0, 12))
  })

  it('sign conventions are from the player perspective', () => {
    // Canonical face: +Z out of the face (toward camera), +Y up, +X = player's left.
    // Camera: +X = image right (unmirrored) = player's LEFT side as seen by the camera.
    const forward: [number, number, number] = [0, 0, 1]
    const up: [number, number, number] = [0, 1, 0]

    // yaw > 0 = head turned to the player's right: nose moves toward camera -X.
    expect(apply(rotationFromEuler(20, 0, 0), forward)[0]).toBeLessThan(0)
    // pitch > 0 = chin up: nose moves toward camera +Y.
    expect(apply(rotationFromEuler(0, 20, 0), forward)[1]).toBeGreaterThan(0)
    // roll > 0 = tilt toward the player's right shoulder: top of head moves to camera -X.
    expect(apply(rotationFromEuler(0, 0, 20), up)[0]).toBeLessThan(0)

    // And the decomposition reads the same signs from hand-built elementary rotations.
    const a = (20 * Math.PI) / 180
    const [c, s] = [Math.cos(a), Math.sin(a)]
    // Rotation about +Y by -20° (θ = -20°) -> yaw +20.
    expect(eulerFromMatrix([c, 0, -s, 0, 1, 0, s, 0, c]).yaw).toBeCloseTo(20, 9)
    // Rotation about +X by -20° (φ = -20°) -> pitch +20.
    expect(eulerFromMatrix([1, 0, 0, 0, c, s, 0, -s, c]).pitch).toBeCloseTo(20, 9)
    // Rotation about +Z by +20° (ψ = +20°) -> roll +20.
    expect(eulerFromMatrix([c, -s, 0, s, c, 0, 0, 0, 1]).roll).toBeCloseTo(20, 9)
  })
})

describe('MediaPipe 4x4 handling', () => {
  it('reads column-major matrices and strips uniform scale', () => {
    const m = faceMatrixFromRotation(rotationFromEuler(15, -10, 5), 3.7, [1, 2, -60])
    // Column-major: translation lives in elements 12..14.
    expect(m.slice(12, 15)).toEqual([1, 2, -60])
    const e = eulerFromFaceMatrix(m)
    expect(e).not.toBeNull()
    expect(e!.yaw).toBeCloseTo(15, 6)
    expect(e!.pitch).toBeCloseTo(-10, 6)
    expect(e!.roll).toBeCloseTo(5, 6)
  })

  it('rejects missing, short, non-finite or degenerate matrices', () => {
    expect(rotationFromFaceMatrix(null)).toBeNull()
    expect(rotationFromFaceMatrix([1, 0, 0])).toBeNull()
    const bad = faceMatrixFromRotation(rotationFromEuler(0, 0, 0))
    bad[1] = Number.NaN
    expect(rotationFromFaceMatrix(bad)).toBeNull()
    expect(rotationFromFaceMatrix(new Array(16).fill(0))).toBeNull()
  })
})

describe('relativeRotation', () => {
  it('is identity at the calibrated pose', () => {
    const cal = rotationFromEuler(12, -8, 3)
    const e = eulerFromMatrix(relativeRotation(cal, cal))
    expect(e.yaw).toBeCloseTo(0, 9)
    expect(e.pitch).toBeCloseTo(0, 9)
    expect(e.roll).toBeCloseTo(0, 9)
  })

  it('measures yaw relative to an off-axis neutral pose', () => {
    const cal = rotationFromEuler(10, -5, 0)
    const e = eulerFromMatrix(relativeRotation(rotationFromEuler(30, -5, 0), cal))
    expect(e.yaw).toBeCloseTo(20, 6)
    expect(e.pitch).toBeCloseTo(0, 6)
    expect(e.roll).toBeCloseTo(0, 6)
  })

  it('matches a composed rotation', () => {
    const cal = rotationFromEuler(-7, 9, 2)
    const delta = rotationFromEuler(25, 0, 0)
    const e = eulerFromMatrix(relativeRotation(mat3Multiply(delta, cal), cal))
    expect(e.yaw).toBeCloseTo(25, 6)
    expect(e.pitch).toBeCloseTo(0, 6)
  })
})

describe('misc helpers', () => {
  it('computes box IoU', () => {
    const a = { x0: 0, y0: 0, x1: 1, y1: 1 }
    expect(boxIoU(a, a)).toBeCloseTo(1)
    expect(boxIoU(a, { x0: 2, y0: 2, x1: 3, y1: 3 })).toBe(0)
    expect(boxIoU(a, { x0: 0.5, y0: 0, x1: 1.5, y1: 1 })).toBeCloseTo(1 / 3)
    expect(boxIoU(a, { x0: 0, y0: 0, x1: 0, y1: 0 })).toBe(0)
  })

  it('computes EAR from six points', () => {
    const ear = eyeAspectRatioFromPoints([
      [0, 0],
      [1, 1],
      [2, 1],
      [3, 0],
      [2, -1],
      [1, -1]
    ])
    expect(ear).toBeCloseTo(2 / 3)
    expect(eyeAspectRatioFromPoints([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]])).toBeNull()
  })

  it('time-based EMA is frame-rate independent', () => {
    // Two half steps compound exactly to one full step.
    expect(1 - (1 - emaAlpha(50, 120)) ** 2).toBeCloseTo(emaAlpha(100, 120), 12)
    const a = new TimeEma(120)
    const b = new TimeEma(120)
    a.update(0, 0)
    b.update(0, 0)
    for (let t = 10; t <= 300; t += 10) a.update(1, t)
    for (let t = 50; t <= 300; t += 50) b.update(1, t)
    expect(a.value!).toBeCloseTo(b.value!, 9)
    expect(emaAlpha(0, 120)).toBe(0)
    expect(emaAlpha(10, 0)).toBe(1)
  })

  it('stdDev is the population standard deviation', () => {
    expect(stdDev([1, 3])).toBeCloseTo(1)
    expect(stdDev([])).toBeNull()
  })
})
