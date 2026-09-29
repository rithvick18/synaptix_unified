/**
 * Suite camera navigation: seated views with gentle tweens, limited look-around, and an
 * optional slow walk. No pointer lock, no auto-rotation.
 *
 * The pure helpers at the top are what the node check exercises; the `Navigator` class
 * only needs a THREE camera (no DOM).
 */
import * as THREE from 'three'

export const DEG = Math.PI / 180
/** Look-around limits from the rest view. */
export const LOOK_LIMITS = { yaw: 70 * DEG, pitch: 35 * DEG } as const
/** A camera move never takes longer than this. */
export const MAX_TWEEN_S = 1.2
export const WALK_SPEED = 1.4
export const WALK_RADIUS = 0.25
/** Standing eye height above the walkable floor in walk mode. */
export const WALK_EYE = 1.6
/** Radians of look per pixel dragged. */
export const DRAG_SENSITIVITY = 0.0045
/** A pointer that moved less than this (px) and was down less than TAP_MS is a tap. */
export const TAP_SLOP_PX = 8
export const TAP_MS = 650

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Clamps look offsets (radians, relative to the rest view). */
export function clampLook(yaw: number, pitch: number, limits = LOOK_LIMITS): { yaw: number; pitch: number } {
  return { yaw: clamp(yaw, -limits.yaw, limits.yaw), pitch: clamp(pitch, -limits.pitch, limits.pitch) }
}

/** Seconds for a move of `distance` metres and `angle` radians. 0 = an instant cut. */
export function tweenDuration(distance: number, angle: number, reducedMotion: boolean): number {
  if (reducedMotion) return 0
  if (distance < 0.01 && angle < 0.01) return 0
  return clamp(0.18 + 0.12 * distance + 0.1 * angle, 0.18, 0.45)
}

/** Cubic ease-in-out on [0, 1]. */
export function easeInOut(t: number): number {
  const x = clamp(t, 0, 1)
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
}

/** Shortest signed difference b − a between two angles. */
export function angleDelta(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/** Yaw/pitch (YXZ, camera looks down −Z at yaw 0) that looks from `from` toward `to`. */
export function lookAngles(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): { yaw: number; pitch: number } {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const dz = to.z - from.z
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }
}

/** Exponential damping factor for a frame: fraction of the gap to close. */
export function dampFactor(dt: number, rate = 10): number {
  return 1 - Math.exp(-rate * Math.max(0, dt))
}

export function classifyGesture(movedPx: number, durationMs: number): 'tap' | 'drag' | 'hold' {
  if (movedPx >= TAP_SLOP_PX) return 'drag'
  return durationMs <= TAP_MS ? 'tap' : 'hold'
}

interface BoxLike {
  min: { x: number; y: number; z: number }
  max: { x: number; y: number; z: number }
}

/** True when a circle at (x, z) with `radius` overlaps a blocker that stands in the way. */
export function collides(x: number, z: number, blockers: readonly BoxLike[], floorY: number, radius = WALK_RADIUS): boolean {
  for (const b of blockers) {
    // Rugs and low mats can be walked over; things overhead do not block.
    if (b.max.y < floorY + 0.25 || b.min.y > floorY + 1.8) continue
    const cx = clamp(x, b.min.x, b.max.x)
    const cz = clamp(z, b.min.z, b.max.z)
    if ((x - cx) ** 2 + (z - cz) ** 2 < radius * radius) return true
  }
  return false
}

/**
 * One walk step on the floor plane. Axis-separated so a wall slides rather than stops.
 * The result stays inside `walkable` (shrunk by `radius`).
 */
export function walkStep(
  pos: { x: number; z: number },
  delta: { x: number; z: number },
  blockers: readonly BoxLike[],
  walkable: BoxLike,
  radius = WALK_RADIUS
): { x: number; z: number } {
  const floorY = walkable.min.y
  const stuck = collides(pos.x, pos.z, blockers, floorY, radius)
  let x = pos.x
  let z = pos.z
  const nx = x + delta.x
  if (stuck || !collides(nx, z, blockers, floorY, radius)) x = nx
  const nz = z + delta.z
  if (stuck || !collides(x, nz, blockers, floorY, radius)) z = nz
  const loX = walkable.min.x + radius
  const hiX = walkable.max.x - radius
  const loZ = walkable.min.z + radius
  const hiZ = walkable.max.z - radius
  x = loX <= hiX ? clamp(x, loX, hiX) : (walkable.min.x + walkable.max.x) / 2
  z = loZ <= hiZ ? clamp(z, loZ, hiZ) : (walkable.min.z + walkable.max.z) / 2
  return { x, z }
}

/** Held movement keys → a local move vector (x right, z forward), length ≤ 1. */
export function walkVector(pressed: ReadonlySet<string>): { x: number; z: number } {
  let x = 0
  let z = 0
  if (pressed.has('KeyW') || pressed.has('ArrowUp')) z += 1
  if (pressed.has('KeyS') || pressed.has('ArrowDown')) z -= 1
  if (pressed.has('KeyD') || pressed.has('ArrowRight')) x += 1
  if (pressed.has('KeyA') || pressed.has('ArrowLeft')) x -= 1
  const len = Math.hypot(x, z)
  return len > 1 ? { x: x / len, z: z / len } : { x, z }
}

/** Local move (x right, z forward) at `yaw` → world XZ displacement. */
export function moveToWorld(move: { x: number; z: number }, yaw: number, distance: number): { x: number; z: number } {
  const fx = -Math.sin(yaw)
  const fz = -Math.cos(yaw)
  const rx = Math.cos(yaw)
  const rz = -Math.sin(yaw)
  return { x: (fx * move.z + rx * move.x) * distance, z: (fz * move.z + rz * move.x) * distance }
}

// ---------------------------------------------------------------------------------------

export interface View {
  position: THREE.Vector3
  target: THREE.Vector3
  /** Vertical field of view (degrees); absent, the camera's own. A photo room zooms rather
   *  than moves, because its photograph is right only from where it was taken. */
  fov?: number
}

export interface NavScene {
  seat: View
  spawn: { position: THREE.Vector3; yaw: number }
  blockers: THREE.Box3[]
  walkable: THREE.Box3
}

interface Tween {
  from: THREE.Vector3
  to: THREE.Vector3
  yaw0: number
  yaw1: number
  pitch0: number
  pitch1: number
  fov0: number
  fov1: number
  t: number
  duration: number
  done?: () => void
}

export class Navigator {
  private scene: NavScene | null = null
  private readonly pos = new THREE.Vector3()
  /** The rest view's angles; look offsets are added on top. */
  private restYaw = 0
  private restPitch = 0
  private lookYaw = 0
  private lookPitch = 0
  private wantYaw = 0
  private wantPitch = 0
  private tween: Tween | null = null
  private move = { x: 0, z: 0 }
  mode: 'seated' | 'walk' = 'seated'
  reducedMotion = false
  /** The camera's own field of view, which every view without `fov` returns to. */
  private readonly baseFov: number
  private fov: number

  constructor(private readonly camera: THREE.PerspectiveCamera) {
    this.baseFov = camera.fov
    this.fov = camera.fov
  }

  get moving(): boolean {
    return this.tween !== null
  }

  /** The current look offsets (radians), after damping. */
  get look(): { yaw: number; pitch: number } {
    return { yaw: this.lookYaw, pitch: this.lookPitch }
  }

  get position(): THREE.Vector3 {
    return this.pos.clone()
  }

  setScene(scene: NavScene | null): void {
    this.scene = scene
    this.tween = null
    this.move = { x: 0, z: 0 }
    if (!scene) {
      // Leaves the camera as the house expects it.
      this.fov = this.baseFov
      this.applyFov()
      return
    }
    if (this.mode === 'walk') this.toSpawn()
    else this.cut(scene.seat)
  }

  setMode(mode: 'seated' | 'walk'): void {
    if (mode === this.mode) return
    this.mode = mode
    this.move = { x: 0, z: 0 }
    if (!this.scene) return
    if (mode === 'walk') this.toSpawn()
    else this.goTo(this.scene.seat)
  }

  /** Moves to a view: a tween of at most MAX_TWEEN_S, or an instant cut with reduced motion. */
  goTo(view: View, done?: () => void): void {
    const { yaw, pitch } = lookAngles(view.position, view.target)
    const yaw0 = this.restYaw + this.lookYaw
    const pitch0 = this.restPitch + this.lookPitch
    const dist = this.pos.distanceTo(view.position)
    // A zoom counts as movement: halving the field of view is like walking halfway there.
    const angle = Math.abs(angleDelta(yaw0, yaw)) + Math.abs(pitch - pitch0) + Math.abs((view.fov ?? this.baseFov) - this.fov) * DEG
    const duration = tweenDuration(dist, angle, this.reducedMotion)
    this.lookYaw = this.lookPitch = this.wantYaw = this.wantPitch = 0
    if (duration === 0) {
      this.tween = null
      this.cut(view)
      done?.()
      return
    }
    this.restYaw = yaw0
    this.restPitch = pitch0
    this.tween = {
      from: this.pos.clone(), to: view.position.clone(), yaw0, yaw1: yaw0 + angleDelta(yaw0, yaw), pitch0, pitch1: pitch,
      fov0: this.fov, fov1: view.fov ?? this.baseFov, t: 0, duration, done
    }
    this.apply()
  }

  goToSeat(done?: () => void): void {
    if (this.scene) this.goTo(this.scene.seat, done)
  }

  /** Drag look, in pixels. Seated: clamped around the rest view. Walk: yaw turns freely. */
  lookBy(dxPx: number, dyPx: number): void {
    // Pointer input always takes priority over an automatic object transition.
    this.tween = null
    const dyaw = -dxPx * DRAG_SENSITIVITY
    const dpitch = -dyPx * DRAG_SENSITIVITY
    if (this.mode === 'walk') {
      this.restYaw += dyaw
      this.wantPitch = clamp(this.wantPitch + dpitch, -LOOK_LIMITS.pitch, LOOK_LIMITS.pitch)
    } else {
      const c = clampLook(this.wantYaw + dyaw, this.wantPitch + dpitch)
      this.wantYaw = c.yaw
      this.wantPitch = c.pitch
    }
  }

  setMove(move: { x: number; z: number }): void {
    if ((move.x !== 0 || move.z !== 0) && this.tween) this.tween = null
    this.move = move
  }

  update(dt: number): void {
    if (this.tween) {
      const tw = this.tween
      tw.t = Math.min(tw.duration, tw.t + dt)
      const k = easeInOut(tw.t / tw.duration)
      this.pos.lerpVectors(tw.from, tw.to, k)
      this.restYaw = tw.yaw0 + (tw.yaw1 - tw.yaw0) * k
      this.restPitch = tw.pitch0 + (tw.pitch1 - tw.pitch0) * k
      this.fov = tw.fov0 + (tw.fov1 - tw.fov0) * k
      if (tw.t >= tw.duration) {
        this.tween = null
        tw.done?.()
      }
    } else {
      if (this.reducedMotion) {
        this.lookYaw = this.wantYaw
        this.lookPitch = this.wantPitch
      } else {
        const f = dampFactor(dt)
        this.lookYaw += (this.wantYaw - this.lookYaw) * f
        this.lookPitch += (this.wantPitch - this.lookPitch) * f
      }
      if (this.mode === 'walk' && this.scene && (this.move.x !== 0 || this.move.z !== 0)) {
        const d = moveToWorld(this.move, this.restYaw, WALK_SPEED * Math.min(dt, 0.1))
        const next = walkStep({ x: this.pos.x, z: this.pos.z }, d, this.scene.blockers, this.scene.walkable)
        this.pos.x = next.x
        this.pos.z = next.z
      }
    }
    this.apply()
  }

  private cut(view: View): void {
    const { yaw, pitch } = lookAngles(view.position, view.target)
    this.pos.copy(view.position)
    this.restYaw = yaw
    this.restPitch = pitch
    this.fov = view.fov ?? this.baseFov
    this.lookYaw = this.lookPitch = this.wantYaw = this.wantPitch = 0
    this.apply()
  }

  private toSpawn(): void {
    if (!this.scene) return
    const { spawn, walkable } = this.scene
    const floor = walkable.min.y
    const y = spawn.position.y < floor + 0.5 ? floor + WALK_EYE : spawn.position.y
    const p = walkStep({ x: spawn.position.x, z: spawn.position.z }, { x: 0, z: 0 }, [], walkable)
    const at = new THREE.Vector3(p.x, y, p.z)
    const ahead = at.clone().add(new THREE.Vector3(-Math.sin(spawn.yaw), -0.15, -Math.cos(spawn.yaw)))
    this.goTo({ position: at, target: ahead })
  }

  private apply(): void {
    this.camera.position.copy(this.pos)
    this.camera.rotation.set(this.restPitch + this.lookPitch, this.restYaw + this.lookYaw, 0, 'YXZ')
    this.camera.updateMatrixWorld()
    this.applyFov()
  }

  private applyFov(): void {
    if (Math.abs(this.camera.fov - this.fov) < 1e-4) return
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()
  }
}
