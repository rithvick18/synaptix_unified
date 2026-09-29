/**
 * The stored form of a depth map, and reading it back. Pure: no DOM, no worker, so the
 * profile resolver and node checks can import it.
 *
 * Stored form: `width × height` bytes, row-major, top row first, 0 = farthest and
 * 255 = nearest, at most STORE_EDGE px on the longer side. That is far less than the
 * photo itself and plenty for a relief the viewer only looks around a little.
 */
import type { PhotoDepth } from '../contracts'
import { normaliseDepth, type DepthMap } from './depthMesh'

/** Longest side of the stored depth map. */
export const STORE_EDGE = 512

/** Box-filter resample so the stored map stays small. */
function resample(map: DepthMap, edge: number): DepthMap {
  const scale = Math.min(1, edge / Math.max(map.width, map.height))
  if (scale >= 1) return map
  const w = Math.max(2, Math.round(map.width * scale)), h = Math.max(2, Math.round(map.height * scale))
  const data = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y * map.height) / h), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * map.height) / h))
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * map.width) / w), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * map.width) / w))
      let sum = 0, n = 0
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { sum += map.data[yy * map.width + xx]; n++ }
      data[y * w + x] = sum / n
    }
  }
  return { width: w, height: h, data }
}

/** Packs a depth map into the stored form. */
export function packDepth(map: DepthMap): PhotoDepth {
  const small = normaliseDepth(resample(map, STORE_EDGE))
  const bytes = new Uint8Array(small.data.length)
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(small.data[i] * 255)
  return { data: new Blob([bytes], { type: 'application/octet-stream' }), width: small.width, height: small.height }
}

/** Reads a stored depth map back. Null if the blob does not match its declared size. */
export async function unpackDepth(depth: PhotoDepth): Promise<DepthMap | null> {
  const bytes = new Uint8Array(await depth.data.arrayBuffer())
  if (bytes.length !== depth.width * depth.height) return null
  const data = new Float32Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) data[i] = bytes[i] / 255
  return { width: depth.width, height: depth.height, data }
}
