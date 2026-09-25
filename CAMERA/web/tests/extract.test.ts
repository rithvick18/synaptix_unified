import { describe, expect, it } from 'vitest'
import type { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import { extractFaces, eyeAspectRatio, LEFT_EYE_EAR_IDX, RIGHT_EYE_EAR_IDX } from '../src/vision/landmarker.ts'

const W = 640
const H = 480

function lmAt(x: number, y: number): NormalizedLandmark {
  return { x, y, z: 0, visibility: 0 }
}

/**
 * 478 landmarks all at the face centre, then the 12 EAR landmarks placed to form eyes of
 * known pixel geometry. Eye width `wPx`, lid gaps `h1Px` (p2-p6) and `h2Px` (p3-p5).
 */
function buildFace(opts: {
  cx?: number
  cy?: number
  left?: { wPx: number; h1Px: number; h2Px: number }
  right?: { wPx: number; h1Px: number; h2Px: number }
}): NormalizedLandmark[] {
  const cx = opts.cx ?? 0.5
  const cy = opts.cy ?? 0.5
  const lm = Array.from({ length: 478 }, () => lmAt(cx, cy))
  const place = (
    idx: readonly number[],
    eyeCxPx: number,
    g: { wPx: number; h1Px: number; h2Px: number }
  ) => {
    const [p1, p2, p3, p4, p5, p6] = idx
    const ey = cy * H
    // p1 and p4 horizontal corners; p2/p6 and p3/p5 vertical pairs.
    lm[p1] = lmAt((eyeCxPx + g.wPx / 2) / W, ey / H)
    lm[p4] = lmAt((eyeCxPx - g.wPx / 2) / W, ey / H)
    lm[p2] = lmAt((eyeCxPx + g.wPx / 6) / W, (ey - g.h1Px / 2) / H)
    lm[p6] = lmAt((eyeCxPx + g.wPx / 6) / W, (ey + g.h1Px / 2) / H)
    lm[p3] = lmAt((eyeCxPx - g.wPx / 6) / W, (ey - g.h2Px / 2) / H)
    lm[p5] = lmAt((eyeCxPx - g.wPx / 6) / W, (ey + g.h2Px / 2) / H)
  }
  // Unmirrored camera: player's LEFT eye appears on the image RIGHT.
  if (opts.left) place(LEFT_EYE_EAR_IDX, cx * W + 40, opts.left)
  if (opts.right) place(RIGHT_EYE_EAR_IDX, cx * W - 40, opts.right)
  return lm
}

function result(faces: NormalizedLandmark[][], extra: Partial<FaceLandmarkerResult> = {}): FaceLandmarkerResult {
  return { faceLandmarks: faces, faceBlendshapes: [], facialTransformationMatrixes: [], ...extra }
}

describe('extractFaces', () => {
  it('returns [] for no faces', () => {
    expect(extractFaces(result([]), W, H, false)).toEqual([])
  })

  it('computes EAR per eye in pixel space with correct player-side mapping', () => {
    const lm = buildFace({
      left: { wPx: 40, h1Px: 12, h2Px: 8 }, // EAR = (12+8)/(2*40) = 0.25
      right: { wPx: 30, h1Px: 3, h2Px: 3 } // EAR = 6/60 = 0.1
    })
    const [f] = extractFaces(result([lm]), W, H, false)
    expect(f.earLeft).toBeCloseTo(0.25, 6)
    expect(f.earRight).toBeCloseTo(0.1, 6)
  })

  it('EAR uses pixel space, not normalized space (non-square image)', () => {
    const lm = buildFace({ left: { wPx: 40, h1Px: 10, h2Px: 10 }, right: { wPx: 40, h1Px: 10, h2Px: 10 } })
    const [f] = extractFaces(result([lm]), W, H, false)
    expect(f.earLeft).toBeCloseTo(0.25, 6)
    // In normalized coords the ratio would be (10/480)/(40/640) = 0.333…, not 0.25.
    expect(Math.abs((f.earLeft ?? 0) - 1 / 3)).toBeGreaterThan(0.05)
  })

  it('EAR is null when the eye corners coincide', () => {
    const lm = buildFace({})
    const [f] = extractFaces(result([lm]), W, H, false)
    expect(f.earLeft).toBeNull()
    expect(f.earRight).toBeNull()
    expect(eyeAspectRatio([], LEFT_EYE_EAR_IDX, W, H)).toBeNull()
  })

  it('computes the bounding box and inFrameFraction; box clamped to [0,1]', () => {
    const lm = buildFace({ cx: 0.5, cy: 0.5 })
    lm[0] = lmAt(0.2, 0.3)
    lm[1] = lmAt(0.7, 0.9)
    let f = extractFaces(result([lm]), W, H, false)[0]
    expect(f.box).toEqual({ x0: 0.2, y0: 0.3, x1: 0.7, y1: 0.9 })
    expect(f.inFrameFraction).toBe(1)

    // Push 100 landmarks outside the image (left and bottom).
    for (let i = 10; i < 60; i++) lm[i] = lmAt(-0.1, 0.5)
    for (let i = 60; i < 110; i++) lm[i] = lmAt(0.5, 1.2)
    f = extractFaces(result([lm]), W, H, false)[0]
    expect(f.inFrameFraction).toBeCloseTo(378 / 478, 9)
    expect(f.box.x0).toBe(0)
    expect(f.box.y1).toBe(1)
  })

  it('reads blendshapes by categoryName and the matrix data', () => {
    const lm = buildFace({})
    const matrix = Array.from({ length: 16 }, (_, i) => (i % 5 === 0 ? 1 : 0))
    const r = result([lm], {
      faceBlendshapes: [
        {
          headIndex: 0,
          headName: '',
          categories: [
            { categoryName: '_neutral', score: 0.01, index: 0, displayName: '' },
            { categoryName: 'eyeBlinkRight', score: 0.7, index: 10, displayName: '' },
            { categoryName: 'eyeBlinkLeft', score: 0.2, index: 9, displayName: '' }
          ]
        }
      ],
      facialTransformationMatrixes: [{ rows: 4, columns: 4, data: matrix }]
    })
    const [f] = extractFaces(r, W, H, false)
    expect(f.blinkLeft).toBe(0.2)
    expect(f.blinkRight).toBe(0.7)
    expect(f.matrix).toEqual(matrix)
    expect(f.matrix).not.toBe(matrix) // copied
  })

  it('missing blendshapes / matrix -> null (never 0)', () => {
    const lm = buildFace({})
    const [f] = extractFaces(result([lm]), W, H, false)
    expect(f.blinkLeft).toBeNull()
    expect(f.blinkRight).toBeNull()
    expect(f.matrix).toBeNull()

    const r = result([lm], {
      faceBlendshapes: [{ headIndex: 0, headName: '', categories: [] }],
      facialTransformationMatrixes: [{ rows: 2, columns: 2, data: [1, 0, 0, 1] }]
    })
    const [g] = extractFaces(r, W, H, false)
    expect(g.blinkLeft).toBeNull()
    expect(g.matrix).toBeNull()
  })

  it('includes landmarks as Float32Array only when requested', () => {
    const lm = buildFace({})
    lm[5] = { x: 0.1, y: 0.2, z: -0.03, visibility: 0 }
    const [a] = extractFaces(result([lm]), W, H, false)
    expect(a.landmarks).toBeUndefined()
    const [b] = extractFaces(result([lm]), W, H, true)
    expect(b.landmarks).toBeInstanceOf(Float32Array)
    expect(b.landmarks!.length).toBe(478 * 3)
    expect(b.landmarks![15]).toBeCloseTo(0.1)
    expect(b.landmarks![16]).toBeCloseTo(0.2)
    expect(b.landmarks![17]).toBeCloseTo(-0.03)
  })

  it('keeps per-face alignment of blendshapes and matrices for multiple faces', () => {
    const a = buildFace({ cx: 0.3 })
    const b = buildFace({ cx: 0.7 })
    const bs = (v: number) => ({
      headIndex: 0,
      headName: '',
      categories: [{ categoryName: 'eyeBlinkLeft', score: v, index: 9, displayName: '' }]
    })
    const r = result([a, b], { faceBlendshapes: [bs(0.1), bs(0.9)] })
    const faces = extractFaces(r, W, H, false)
    expect(faces).toHaveLength(2)
    expect(faces[0].blinkLeft).toBe(0.1)
    expect(faces[1].blinkLeft).toBe(0.9)
    expect(faces[0].box.x0).toBeCloseTo(0.3)
    expect(faces[1].box.x0).toBeCloseTo(0.7)
    expect(faces[1].matrix).toBeNull()
  })
})
