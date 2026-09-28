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

export interface SeatViewRequest {
  seat: THREE.Vector3
  focus: THREE.Vector3
  /** At most this far (m) from the seat: a photo room's parallax radius. */
  radius: number
  /** The object's largest dimension (m), which the view is zoomed to frame. */
  size: number
  blockers: readonly THREE.Box3[]
  walkable: THREE.Box3
}

/** The narrowest and widest zoom a photo room's viewpoint uses (vertical degrees). Below
 *  about 28° the photograph, seen at one texel per pixel at 70°, turns visibly soft. */
export const SEAT_FOV = { min: 28, max: 60 } as const

/**
 * A viewpoint for a photo room, where the photograph is right only from where it was
 * taken: the seat, moved toward the object by at most `radius` (and never closer than
 * MIN_DISTANCE to it), at the seat's own height, looking at the focus. Steps back toward
 * the seat until the eye is clear of every blocker; the seat itself is the last resort.
 * Instead of walking up to the object, the view narrows (`fov`) until the object fills
 * about half its height, within SEAT_FOV.
 */
export function seatViewpoint(req: SeatViewRequest): { position: THREE.Vector3; target: THREE.Vector3; fov: number } {
  const framed = (eye: THREE.Vector3): { position: THREE.Vector3; target: THREE.Vector3; fov: number } => {
    const distance = Math.max(0.3, eye.distanceTo(req.focus))
    const fov = 2 * Math.atan(req.size / 0.5 / 2 / distance) * (180 / Math.PI)
    return { position: eye, target: req.focus.clone(), fov: Math.round(Math.min(SEAT_FOV.max, Math.max(SEAT_FOV.min, fov))) }
  }
  const toward = new THREE.Vector3(req.focus.x - req.seat.x, 0, req.focus.z - req.seat.z)
  const across = toward.length()
  const reach = Math.max(0, Math.min(req.radius, across - MIN_DISTANCE))
  if (across > 1e-6) toward.divideScalar(across)
  for (const f of [1, 0.75, 0.5, 0.25]) {
    const eye = req.seat.clone().addScaledVector(toward, reach * f)
    if (reach * f < 0.01) break
    if (insideWalkable(req.walkable, eye.x, eye.z) && clearOfBlockers(req.blockers, eye.x, eye.z)) return framed(eye)
  }
  return framed(req.seat.clone())
}
