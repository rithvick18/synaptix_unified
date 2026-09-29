/**
 * Turns a photo plus a relative depth map into a shallow 3D relief the viewer can look
 * around a little. Geometry only: nothing here recognises or invents anything in the
 * photo. Depth from the model is *relative* (bigger = nearer), so it is normalised to a
 * small, fixed thickness rather than treated as real distance.
 */
import * as THREE from 'three'

export interface DepthMap {
  width: number
  height: number
  /** 0 (far) … 1 (near), row-major, top row first. */
  data: Float32Array
}

export interface DepthMeshOptions {
  /** Vertices across the longer side. */
  resolution?: number
  /** How far the nearest point stands in front of the farthest, in world units. */
  relief?: number
  /** Triangles spanning a depth jump larger than this (0–1) are dropped, not stretched. */
  edgeCut?: number
  /** Fraction of each side cropped away, where depth estimates are least reliable. */
  borderTrim?: number
  /** Pieces smaller than this fraction of the largest connected piece are removed. */
  islandFraction?: number
}

/** Rescales to 0–1 using the 2nd and 98th percentiles so a stray pixel can't flatten the scene. */
export function normaliseDepth(map: DepthMap): DepthMap {
  const sorted = Float32Array.from(map.data).sort()
  const lo = sorted[Math.floor(sorted.length * 0.02)]
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))]
  const span = hi - lo
  const out = new Float32Array(map.data.length)
  for (let i = 0; i < out.length; i++) out[i] = span > 1e-6 ? Math.min(1, Math.max(0, (map.data[i] - lo) / span)) : 0.5
  return { width: map.width, height: map.height, data: out }
}

function sample(map: DepthMap, u: number, v: number): number {
  const x = Math.min(map.width - 1, Math.max(0, u * (map.width - 1)))
  const y = Math.min(map.height - 1, Math.max(0, v * (map.height - 1)))
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(map.width - 1, x0 + 1), y1 = Math.min(map.height - 1, y0 + 1)
  const fx = x - x0, fy = y - y0
  const d = map.data, w = map.width
  const top = d[y0 * w + x0] * (1 - fx) + d[y0 * w + x1] * fx
  const bot = d[y1 * w + x0] * (1 - fx) + d[y1 * w + x1] * fx
  return top * (1 - fy) + bot * fy
}

/**
 * A plane of `aspect` (w/h) with height 1, centred on the origin, facing +z. The nearest
 * surface sits at z = 0 and the farthest at z = -relief.
 */
export function buildDepthGeometry(depth: DepthMap, aspect: number, opts: DepthMeshOptions = {}): THREE.BufferGeometry {
  const resolution = opts.resolution ?? 192
  const relief = opts.relief ?? 0.35
  const edgeCut = opts.edgeCut ?? 0.2
  const cols = aspect >= 1 ? resolution : Math.max(2, Math.round(resolution * aspect))
  const rows = aspect >= 1 ? Math.max(2, Math.round(resolution / aspect)) : resolution
  const norm = normaliseDepth(depth)
  // Depth models are unreliable at the very border of the frame (a pale strip sticks out), so crop it.
  const m = opts.borderTrim ?? 0.025

  const positions = new Float32Array(cols * rows * 3)
  const uvs = new Float32Array(cols * rows * 2)
  const values = new Float32Array(cols * rows)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const u = m + (i / (cols - 1)) * (1 - 2 * m), v = m + (j / (rows - 1)) * (1 - 2 * m)
      const d = sample(norm, u, v)
      const k = j * cols + i
      values[k] = d
      positions.set([(u - 0.5) * aspect, (0.5 - v), -(1 - d) * relief], k * 3)
      uvs.set([u, v], k * 2) // ImageBitmap textures are not flipped on upload: the image top is v = 0
    }
  }
  // Which cells of the grid to keep: drop any that span a large depth jump.
  const qc = cols - 1, qr = rows - 1
  const keep = new Uint8Array(qc * qr)
  for (let j = 0; j < qr; j++) {
    for (let i = 0; i < qc; i++) {
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1
      const lo = Math.min(values[a], values[b], values[c], values[d]), hi = Math.max(values[a], values[b], values[c], values[d])
      keep[j * qc + i] = hi - lo > edgeCut ? 0 : 1
    }
  }
  dropSmallIslands(keep, qc, qr, opts.islandFraction ?? 0.02)

  // Fade the surface out where it was cut (or reaches the frame), so the edge blends into
  // the surround instead of ending in a hard, jagged line.
  const colors = new Float32Array(cols * rows * 4).fill(1)
  const kept = (i: number, j: number): boolean => i >= 0 && j >= 0 && i < qc && j < qr && keep[j * qc + i] === 1
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const solid = kept(i - 1, j - 1) && kept(i, j - 1) && kept(i - 1, j) && kept(i, j)
      colors[(j * cols + i) * 4 + 3] = solid ? 1 : 0
    }
  }

  const indices: number[] = []
  for (let j = 0; j < qr; j++) {
    for (let i = 0; i < qc; i++) {
      if (!keep[j * qc + i]) continue
      const a = j * cols + i, b = a + 1, c = a + cols, d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Clears kept cells that form small disconnected pieces (4-connected), e.g. a stray sliver of wall. */
export function dropSmallIslands(keep: Uint8Array, qc: number, qr: number, fraction: number): void {
  const label = new Int32Array(keep.length)
  const sizes: number[] = [0]
  const stack: number[] = []
  for (let start = 0; start < keep.length; start++) {
    if (!keep[start] || label[start]) continue
    const id = sizes.length
    let size = 0
    stack.push(start); label[start] = id
    while (stack.length) {
      const cell = stack.pop()!
      size++
      const x = cell % qc, y = (cell - x) / qc
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= qc || ny >= qr) continue
        const n = ny * qc + nx
        if (keep[n] && !label[n]) { label[n] = id; stack.push(n) }
      }
    }
    sizes.push(size)
  }
  const largest = Math.max(0, ...sizes)
  for (let cell = 0; cell < keep.length; cell++) {
    if (keep[cell] && sizes[label[cell]] < largest * fraction) keep[cell] = 0
  }
}
