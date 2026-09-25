/**
 * Rotation and face-box geometry for the signal processor. Pure math, no MediaPipe types.
 *
 * Conventions (see contracts.ts FaceData.matrix):
 * - MediaPipe's facial transformation matrix is 4x4 column-major (element (r,c) = m[c*4+r])
 *   and maps the canonical face into camera space. Camera: right-handed, looks down -Z,
 *   +Y up, +X = image right (raw, unmirrored image). Canonical face: +X = player's left,
 *   +Z out of the face toward the camera, so identity ≈ a frontal face.
 * - We decompose R = Ry(θ)·Rx(φ)·Rz(ψ) and report angles from the PLAYER's perspective,
 *   independent of any preview mirroring:
 *     yaw   = -θ  (> 0: head turned to the player's right; the nose moves to camera -X)
 *     pitch = -φ  (> 0: chin up; the nose moves to camera +Y)
 *     roll  = +ψ  (> 0: head tilted toward the player's right shoulder)
 */

/** Row-major 3x3 matrix: element (r,c) = R[r*3+c]. */
export type Mat3 = number[]

/** Player-perspective head angles in degrees. */
export interface EulerDeg {
  yaw: number
  pitch: number
  roll: number
}

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export function mat3Multiply(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
    }
  }
  return out
}

export function mat3Transpose(a: Mat3): Mat3 {
  return [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]
}

/**
 * Upper-left 3x3 of a column-major 4x4 transform with each column normalised, which strips
 * the (uniform) scale MediaPipe bakes into the matrix. null if the input is missing,
 * too short, non-finite or degenerate — callers treat that as "matrix unavailable".
 */
export function rotationFromFaceMatrix(m: ArrayLike<number> | null | undefined): Mat3 | null {
  if (!m || m.length < 16) return null
  const out = new Array<number>(9)
  for (let c = 0; c < 3; c++) {
    const x = m[c * 4]
    const y = m[c * 4 + 1]
    const z = m[c * 4 + 2]
    const n = Math.hypot(x, y, z)
    if (!Number.isFinite(n) || n < 1e-9) return null
    out[c] = x / n
    out[3 + c] = y / n
    out[6 + c] = z / n
  }
  return out
}

/** Decompose a rotation (R = Ry(θ)·Rx(φ)·Rz(ψ)) into player-perspective degrees. */
export function eulerFromMatrix(R: Mat3): EulerDeg {
  // asin argument clamped: normalised columns can overshoot 1 by rounding error.
  const phi = Math.asin(Math.max(-1, Math.min(1, -R[5])))
  const theta = Math.atan2(R[2], R[8])
  const psi = Math.atan2(R[3], R[4])
  return { yaw: -theta * DEG, pitch: -phi * DEG, roll: psi * DEG }
}

/** Inverse of eulerFromMatrix: builds R = Ry(-yaw)·Rx(-pitch)·Rz(roll). */
export function rotationFromEuler(yawDeg: number, pitchDeg: number, rollDeg: number): Mat3 {
  const t = -yawDeg * RAD
  const p = -pitchDeg * RAD
  const s = rollDeg * RAD
  const cy = Math.cos(t)
  const sy = Math.sin(t)
  const cx = Math.cos(p)
  const sx = Math.sin(p)
  const cz = Math.cos(s)
  const sz = Math.sin(s)
  return [
    cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx,
    cx * sz, cx * cz, -sx,
    -sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx
  ]
}

/**
 * Rotation relative to the calibrated neutral pose: R_rel = R · R_calᵀ, so a head exactly
 * at the calibrated pose gives identity (all angles 0) regardless of camera placement.
 */
export function relativeRotation(R: Mat3, Rcal: Mat3): Mat3 {
  return mat3Multiply(R, mat3Transpose(Rcal))
}

/** Convenience: player-perspective angles straight from a MediaPipe 4x4, or null. */
export function eulerFromFaceMatrix(m: ArrayLike<number> | null | undefined): EulerDeg | null {
  const R = rotationFromFaceMatrix(m)
  return R ? eulerFromMatrix(R) : null
}

/**
 * Build a column-major 4x4 like MediaPipe's (rotation × uniform scale + translation).
 * Used by tests and simulations to synthesise frames.
 */
export function faceMatrixFromRotation(
  R: Mat3,
  scale = 1,
  translation: readonly [number, number, number] = [0, 0, -50]
): number[] {
  const m = new Array<number>(16).fill(0)
  for (let c = 0; c < 3; c++) {
    for (let r = 0; r < 3; r++) m[c * 4 + r] = R[r * 3 + c] * scale
  }
  m[12] = translation[0]
  m[13] = translation[1]
  m[14] = translation[2]
  m[15] = 1
  return m
}

// --- Eyes ------------------------------------------------------------------------------

/**
 * Eye aspect ratio from six pixel-space points p1..p6 (p1/p4 = eye corners):
 * EAR = (|p2-p6| + |p3-p5|) / (2|p1-p4|). null if degenerate or non-finite.
 */
export function eyeAspectRatioFromPoints(points: ReadonlyArray<readonly [number, number]>): number | null {
  if (points.length < 6) return null
  const d = (a: readonly [number, number], b: readonly [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1])
  const width = d(points[0], points[3])
  if (!Number.isFinite(width) || width < 1e-9) return null
  const ear = (d(points[1], points[5]) + d(points[2], points[4])) / (2 * width)
  return Number.isFinite(ear) ? ear : null
}

/** EAR relative to the calibrated open-eye EAR (1 ≈ as open as during calibration). */
export function relativeEar(ear: number | null, calibratedEar: number | null): number | null {
  if (ear === null || calibratedEar === null || !Number.isFinite(ear) || !(calibratedEar > 0)) return null
  const r = ear / calibratedEar
  return Number.isFinite(r) ? r : null
}

// --- Boxes -----------------------------------------------------------------------------

export function boxWidth(b: Box): number {
  return Math.max(0, b.x1 - b.x0)
}

export function boxCentre(b: Box): [number, number] {
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]
}

/** Intersection-over-union of two axis-aligned boxes, in [0,1]; 0 for degenerate boxes. */
export function boxIoU(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0))
  const iy = Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))
  const inter = ix * iy
  const areaA = Math.max(0, a.x1 - a.x0) * Math.max(0, a.y1 - a.y0)
  const areaB = Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0)
  const union = areaA + areaB - inter
  if (!(union > 0)) return 0
  const iou = inter / union
  return Number.isFinite(iou) ? iou : 0
}
