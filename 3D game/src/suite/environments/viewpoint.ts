/**
 * Finds a comfortable place to look at an object from: inside the walkable area, at least
 * 0.25 m clear of every blocker, with a clear line of sight to the focus point, at seated
 * eye height (1.25 m), 0.8–2.0 m away (or the asset's viewDistance). Candidates start
 * straight in front of the object and fan out to either side.
 */
import * as THREE from 'three'

export const EYE_HEIGHT = 1.25
export const CLEARANCE = 0.25
export const MIN_DISTANCE = 0.8
export const MAX_DISTANCE = 2.0

/** Horizontal distance from a point to a box's footprint (0 when inside). */
export function footprintDistance(box: THREE.Box3, x: number, z: number): number {
  const dx = Math.max(box.min.x - x, 0, x - box.max.x)
  const dz = Math.max(box.min.z - z, 0, z - box.max.z)
  return Math.hypot(dx, dz)
}

/** Blockers a standing or seated person could bump into (anything below head height). */
const relevant = (box: THREE.Box3): boolean => box.min.y < 1.8

export function clearOfBlockers(blockers: readonly THREE.Box3[], x: number, z: number, clearance = CLEARANCE): boolean {
  for (const b of blockers) if (relevant(b) && footprintDistance(b, x, z) < clearance - 1e-6) return false
  return true
}

export function insideWalkable(walkable: THREE.Box3, x: number, z: number): boolean {
  return x >= walkable.min.x && x <= walkable.max.x && z >= walkable.min.z && z <= walkable.max.z
}

const ray = new THREE.Ray()
const hit = new THREE.Vector3()

/** True when the segment from `from` to `to` passes through no blocker except `ignore`. */
export function lineOfSight(from: THREE.Vector3, to: THREE.Vector3, blockers: readonly THREE.Box3[], ignore: ReadonlySet<THREE.Box3>): boolean {
  const length = from.distanceTo(to)
  ray.origin.copy(from)
  ray.direction.subVectors(to, from).normalize()
  for (const b of blockers) {
    if (ignore.has(b)) continue
    if (b.containsPoint(to)) continue
    if (ray.intersectBox(b, hit) && from.distanceTo(hit) < length - 0.02) return false
  }
  return true
}

export interface ViewRequest {
  focus: THREE.Vector3
  /** Unit vector (xz) the object faces. */
  front: THREE.Vector3
  distance: number
  blockers: readonly THREE.Box3[]
  /** The object's own blockers and those of the furniture it stands on. */
  ignore: ReadonlySet<THREE.Box3>
  walkable: THREE.Box3
  /** Largest allowed distance; defaults to MAX_DISTANCE or the preferred distance + 0.6. */
  maxDistance?: number
}

export function findViewpoint(req: ViewRequest): { position: THREE.Vector3; target: THREE.Vector3 } | null {
  const preferred = req.distance
  const maxD = req.maxDistance ?? Math.max(MAX_DISTANCE, preferred + 0.6)
  const distances: number[] = []
  for (const step of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, 0.8, 1.0]) {
    const d = preferred + step
    if (d >= MIN_DISTANCE - 1e-6 && d <= maxD + 1e-6 && !distances.includes(d)) distances.push(d)
  }
  const angles = [0]
  for (let a = 0.2; a <= 1.45; a += 0.2) angles.push(a, -a)
  const base = Math.atan2(req.front.x, req.front.z)
  const eye = new THREE.Vector3()
  for (const angle of angles) {
    for (const d of distances) {
      const heading = base + angle
      // Horizontal distance chosen so the straight-line distance to the focus is `d`.
      const dy = EYE_HEIGHT - req.focus.y
      const horizontal = Math.sqrt(Math.max(d * d - dy * dy, 0.36))
      eye.set(req.focus.x + Math.sin(heading) * horizontal, EYE_HEIGHT, req.focus.z + Math.cos(heading) * horizontal)
      if (!insideWalkable(req.walkable, eye.x, eye.z)) continue
      if (!clearOfBlockers(req.blockers, eye.x, eye.z)) continue
      if (!lineOfSight(eye, req.focus, req.blockers, req.ignore)) continue
      return { position: eye.clone(), target: req.focus.clone() }
    }
  }
  return null
}
