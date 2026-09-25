/**
 * Landmark overlay for the camera preview. The canvas backing store is sized to the
 * video's intrinsic resolution and drawn in raw (unmirrored) image coordinates; mirroring
 * is purely a CSS transform applied to video and canvas together.
 */

import type { TrackingStatus } from '../protocol/types.ts'
import type { FaceFrame } from './contracts.ts'

const STATUS_COLOURS: Record<TrackingStatus, string> = {
  tracking: '#22c55e',
  recovering: '#f59e0b',
  low_quality: '#f59e0b',
  multiple_faces: '#ef4444',
  no_face: '#ef4444',
  lost: '#ef4444',
  not_started: '#94a3b8',
  suspended: '#94a3b8',
  error: '#ef4444'
}
const OTHER_FACE_COLOUR = '#94a3b8'

export function statusColour(status: TrackingStatus): string {
  return STATUS_COLOURS[status] ?? OTHER_FACE_COLOUR
}

/** Resize the canvas backing store to the video's intrinsic size (no-op if unchanged). */
export function sizeOverlay(canvas: HTMLCanvasElement, width: number, height: number): void {
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width
    canvas.height = height
  }
}

export function clearOverlay(canvas: HTMLCanvasElement | null | undefined): void {
  if (!canvas) return
  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
}

/**
 * Draw landmark points and bounding box for each face. The locked face (if any) is
 * coloured by tracking status; other faces are grey.
 */
export function drawOverlay(
  canvas: HTMLCanvasElement,
  frame: FaceFrame,
  tracking: TrackingStatus,
  lockedFaceIndex: number | null
): void {
  sizeOverlay(canvas, frame.width, frame.height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  const r = Math.max(1, Math.round(Math.min(w, h) / 320))
  frame.faces.forEach((face, i) => {
    const locked = lockedFaceIndex === null ? frame.faces.length === 1 : i === lockedFaceIndex
    const colour = locked ? statusColour(tracking) : OTHER_FACE_COLOUR
    ctx.fillStyle = colour
    ctx.strokeStyle = colour
    const lm = face.landmarks
    if (lm) {
      for (let k = 0; k + 1 < lm.length; k += 3) ctx.fillRect(lm[k] * w - r / 2, lm[k + 1] * h - r / 2, r, r)
    }
    ctx.lineWidth = Math.max(1, r)
    const b = face.box
    ctx.strokeRect(b.x0 * w, b.y0 * h, (b.x1 - b.x0) * w, (b.y1 - b.y0) * h)
  })
}
