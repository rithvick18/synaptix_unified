/**
 * MediaPipe FaceLandmarker setup + pure result extraction. Shared by the module worker
 * (vision.worker.ts) and the main-thread fallback in FaceObserver.ts.
 *
 * The tasks-vision runtime is imported lazily so that `extractFaces` (pure) can be
 * unit-tested in Node without loading the WASM bundle.
 */

import type { FaceLandmarker, FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { FaceData } from './contracts.ts'

export type Delegate = 'GPU' | 'CPU'

export interface CreateLandmarkerOptions {
  /** Absolute URL (no trailing slash needed) of the directory holding the WASM files. */
  wasmBaseUrl: string
  /** Absolute URL of face_landmarker.task. */
  modelUrl: string
  /** Preferred delegate. 'GPU' falls back to 'CPU'; 'CPU' is tried alone. */
  delegate: Delegate
  /** Canvas for the WebGL context (required for GPU; an OffscreenCanvas inside a worker). */
  canvas?: HTMLCanvasElement | OffscreenCanvas
  /**
   * Load the ES-module WASM loader via dynamic import (required in module workers, where
   * importScripts is unavailable). Defaults to true when there is no `document`.
   */
  useModule?: boolean
  numFaces?: number
}

export interface CreatedLandmarker {
  landmarker: FaceLandmarker
  delegate: Delegate
  /** Time spent in the warm-up inference (GPU shader compilation etc.), ms. */
  warmupMs: number
  /** Messages from delegates that failed before the one that succeeded. */
  warnings: string[]
}

export const NUM_FACES_DEFAULT = 2

function errMsg(e: unknown): string {
  // MediaPipe appends a long "=== Source Location Trace: ===" block; keep the first part.
  if (e instanceof Error) return (e.message || e.name).split('\n=== Source Location Trace')[0].trim()
  if (typeof e === 'object' && e && 'type' in e) return `event:${String((e as { type: unknown }).type)}`
  return String(e)
}

/**
 * Create a VIDEO-mode FaceLandmarker, trying GPU then CPU (or CPU only).
 * Throws with a combined message if every delegate fails.
 */
export async function createLandmarker(opts: CreateLandmarkerOptions): Promise<CreatedLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision')
  const useModule = opts.useModule ?? typeof document === 'undefined'
  const base = opts.wasmBaseUrl.replace(/\/+$/, '')
  const fileset = await FilesetResolver.forVisionTasks(base, useModule)

  const order: Delegate[] = opts.delegate === 'GPU' ? ['GPU', 'CPU'] : ['CPU']
  const warnings: string[] = []
  for (const delegate of order) {
    let created: FaceLandmarker | null = null
    try {
      if (useModule) {
        // tasks-vision clears globalThis.ModuleFactory after each instantiation, and a
        // repeated dynamic import() of the (cached) loader does not re-run it — so a second
        // attempt (GPU -> CPU) would fail with "ModuleFactory not set". Re-seed it from the
        // module's default export before every attempt.
        const mod = (await import(/* @vite-ignore */ fileset.wasmLoaderPath)) as { default?: unknown }
        if (typeof mod.default === 'function') {
          ;(globalThis as { ModuleFactory?: unknown }).ModuleFactory = mod.default
        }
      }
      const landmarker = (created = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: opts.modelUrl, delegate },
        runningMode: 'VIDEO',
        numFaces: opts.numFaces ?? NUM_FACES_DEFAULT,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        canvas: opts.canvas
      }))
      const warmupMs = warmUp(landmarker)
      return { landmarker, delegate, warnings, warmupMs }
    } catch (e) {
      warnings.push(`${delegate}: ${errMsg(e)}`)
      try {
        created?.close()
      } catch {
        // ignore
      }
    }
  }
  throw new Error(`FaceLandmarker init failed (${warnings.join('; ')})`)
}

/**
 * Timestamp used for the warm-up inference. Real frames use performance.now() values,
 * which are far larger, so VIDEO-mode timestamps stay strictly increasing.
 */
export const WARMUP_TIMESTAMP_MS = 1

/**
 * Run one inference on a blank frame so first-use costs (WebGL shader compilation, XNNPACK
 * setup) are paid during init instead of on the first camera frame. Throws if it fails,
 * so a delegate that cannot actually run is rejected and the next one is tried.
 */
function warmUp(landmarker: FaceLandmarker): number {
  let img: OffscreenCanvas | HTMLCanvasElement
  if (typeof OffscreenCanvas !== 'undefined') img = new OffscreenCanvas(640, 480)
  else {
    img = document.createElement('canvas')
    img.width = 640
    img.height = 480
  }
  const ctx = img.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (ctx) {
    ctx.fillStyle = '#808080'
    ctx.fillRect(0, 0, 640, 480)
  }
  const t0 = performance.now()
  landmarker.detectForVideo(img, WARMUP_TIMESTAMP_MS)
  return performance.now() - t0
}

// --- Pure extraction -----------------------------------------------------------------

/** Player's LEFT eye (image right in an unmirrored camera frame). [p1..p6] */
export const LEFT_EYE_EAR_IDX = [263, 385, 387, 362, 373, 380] as const
/** Player's RIGHT eye (image left in an unmirrored camera frame). [p1..p6] */
export const RIGHT_EYE_EAR_IDX = [33, 160, 158, 133, 153, 144] as const

type Pt = { x: number; y: number }

/** EAR = (|p2-p6| + |p3-p5|) / (2|p1-p4|), in pixel space. null if not computable. */
export function eyeAspectRatio(
  lm: readonly Pt[],
  idx: readonly [number, number, number, number, number, number],
  width: number,
  height: number
): number | null {
  const p: Pt[] = []
  for (const i of idx) {
    const q = lm[i]
    if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return null
    p.push({ x: q.x * width, y: q.y * height })
  }
  const d = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
  const horiz = d(p[0], p[3])
  if (!(horiz > 1e-6)) return null
  const ear = (d(p[1], p[5]) + d(p[2], p[4])) / (2 * horiz)
  return Number.isFinite(ear) ? ear : null
}

function blendshape(result: FaceLandmarkerResult, face: number, name: string): number | null {
  const cats = result.faceBlendshapes?.[face]?.categories
  if (!cats) return null
  const c = cats.find((k) => k.categoryName === name)
  return c && Number.isFinite(c.score) ? c.score : null
}

function matrixData(result: FaceLandmarkerResult, face: number): number[] | null {
  const m = result.facialTransformationMatrixes?.[face]
  if (!m || !m.data || m.data.length !== 16) return null
  const out = Array.from(m.data)
  return out.every(Number.isFinite) ? out : null
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Convert a FaceLandmarkerResult into plain FaceData (one per detected face, in
 * MediaPipe's order). No per-face confidence exists in the result, so none is invented.
 */
export function extractFaces(
  result: FaceLandmarkerResult,
  width: number,
  height: number,
  includeLandmarks: boolean
): FaceData[] {
  const faces: FaceData[] = []
  const all = result.faceLandmarks ?? []
  for (let f = 0; f < all.length; f++) {
    const lm: NormalizedLandmark[] = all[f] ?? []
    if (lm.length === 0) continue
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let inside = 0
    for (const p of lm) {
      if (p.x < x0) x0 = p.x
      if (p.x > x1) x1 = p.x
      if (p.y < y0) y0 = p.y
      if (p.y > y1) y1 = p.y
      if (p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) inside++
    }
    const face: FaceData = {
      box: { x0: clamp01(x0), y0: clamp01(y0), x1: clamp01(x1), y1: clamp01(y1) },
      inFrameFraction: inside / lm.length,
      earLeft: eyeAspectRatio(lm, LEFT_EYE_EAR_IDX, width, height),
      earRight: eyeAspectRatio(lm, RIGHT_EYE_EAR_IDX, width, height),
      blinkLeft: blendshape(result, f, 'eyeBlinkLeft'),
      blinkRight: blendshape(result, f, 'eyeBlinkRight'),
      matrix: matrixData(result, f)
    }
    if (includeLandmarks) {
      const arr = new Float32Array(lm.length * 3)
      for (let i = 0; i < lm.length; i++) {
        arr[i * 3] = lm[i].x
        arr[i * 3 + 1] = lm[i].y
        arr[i * 3 + 2] = lm[i].z
      }
      face.landmarks = arr
    }
    faces.push(face)
  }
  return faces
}

// --- Worker protocol -----------------------------------------------------------------

export type WorkerRequest =
  | { type: 'init'; wasmBaseUrl: string; modelUrl: string; delegate: Delegate; numFaces?: number }
  | { type: 'frame'; id: number; t: number; bitmap: ImageBitmap; includeLandmarks: boolean }
  | { type: 'close' }

export type WorkerResponse =
  | { type: 'ready'; delegate: Delegate; warnings: string[]; warmupMs: number }
  | { type: 'init_error'; message: string }
  | {
      type: 'result'
      id: number
      t: number
      width: number
      height: number
      inferenceMs: number
      faces: FaceData[]
    }
  | { type: 'frame_error'; id: number; message: string }
  | { type: 'closed' }
