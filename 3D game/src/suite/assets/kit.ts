/**
 * The small modelling kit the procedural builders use, and `bake`, which turns a builder's
 * many little meshes into one merged mesh per material.
 *
 * Builders create fresh geometry through the kit; `bake` merges every static part by
 * material (box-projecting UVs at true scale when the material is textured) and keeps
 * only parts marked `keep` — clock hands, the fan rotor, runtime-text planes — as separate
 * meshes. The baked result is the asset's shared prototype (see prototypes.ts).
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { MaterialLease, MatName, MatOptions } from './materials'

export type V3 = [number, number, number]

export interface PartOptions {
  /** Euler rotation in radians (XYZ). */
  rot?: V3
  scale?: V3
  /** Bevel radius for boxes; 0 = square; 'soft' = upholstery. Default a small bevel. */
  bevel?: number | 'soft'
  /** Vertex colour (only with the 'vc' materials). */
  vc?: string
  /** Casts a shadow when the tier has shadows. Default false for small parts. */
  shadow?: boolean
  name?: string
  /** Kept as its own mesh (animated, runtime text, photo). */
  keep?: boolean
  parent?: THREE.Object3D
}

/** Everything a builder may use. */
export interface BuilderContext {
  mats: MaterialLease
  quality: 'low' | 'standard'
}

export type Builder = (params: Record<string, number | string | boolean>, ctx: BuilderContext) => THREE.Object3D

export class Kit {
  readonly root = new THREE.Group()
  constructor(readonly ctx: BuilderContext) {}

  m(name: MatName, colour?: string, opts?: MatOptions): THREE.Material {
    return this.ctx.mats.get(name, colour, opts)
  }

  /** Low tier: fewer segments on round things. */
  seg(n: number): number {
    return this.ctx.quality === 'low' ? Math.max(6, Math.round(n * 0.6)) : n
  }

  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, at: V3, o: PartOptions = {}): THREE.Mesh {
    if ((mat as THREE.MeshStandardMaterial).vertexColors) paint(geo, o.vc ?? '#ffffff')
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(at[0], at[1], at[2])
    if (o.rot) mesh.rotation.set(o.rot[0], o.rot[1], o.rot[2])
    if (o.scale) mesh.scale.set(o.scale[0], o.scale[1], o.scale[2])
    mesh.castShadow = o.shadow ?? false
    mesh.receiveShadow = true
    if (o.name) mesh.name = o.name
    if (o.keep) mesh.userData.keep = true
    ;(o.parent ?? this.root).add(mesh)
    return mesh
  }

  /** Box centred at `at`. */
  box(mat: THREE.Material, size: V3, at: V3, o: PartOptions = {}): THREE.Mesh {
    const [w, h, d] = size
    const least = Math.min(w, h, d)
    const bevel = o.bevel ?? 0.006
    let geo: THREE.BufferGeometry
    if (bevel === 'soft') geo = new RoundedBoxGeometry(w, h, d, 3, Math.min(0.05, least * 0.45))
    else if (bevel <= 0 || least < 0.012) geo = new THREE.BoxGeometry(w, h, d)
    else geo = new RoundedBoxGeometry(w, h, d, 1, Math.min(bevel, least * 0.3))
    return this.mesh(geo, mat, at, o)
  }

  /** Box whose base sits at `at` (y is the bottom). */
  slab(mat: THREE.Material, size: V3, at: V3, o: PartOptions = {}): THREE.Mesh {
    return this.box(mat, size, [at[0], at[1] + size[1] / 2, at[2]], o)
  }

  /** Cylinder centred at `at`, axis +Y unless rotated. */
  cyl(mat: THREE.Material, rTop: number, rBottom: number, h: number, at: V3, o: PartOptions & { seg?: number; open?: boolean; thetaStart?: number; thetaLength?: number } = {}): THREE.Mesh {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, h, this.seg(o.seg ?? 18), 1, o.open ?? false, o.thetaStart ?? 0, o.thetaLength ?? Math.PI * 2)
    return this.mesh(geo, mat, at, o)
  }

  /** Lathe from [radius, y] pairs, base at `at`. */
  lathe(mat: THREE.Material, profile: [number, number][], at: V3, o: PartOptions & { seg?: number } = {}): THREE.Mesh {
    const geo = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y)), this.seg(o.seg ?? 20))
    return this.mesh(geo, mat, at, o)
  }

  sphere(mat: THREE.Material, r: number, at: V3, o: PartOptions & { seg?: number; phiLength?: number; thetaLength?: number } = {}): THREE.Mesh {
    const s = this.seg(o.seg ?? 14)
    const geo = new THREE.SphereGeometry(r, s, Math.max(4, Math.round(s * 0.7)), 0, o.phiLength ?? Math.PI * 2, 0, o.thetaLength ?? Math.PI)
    return this.mesh(geo, mat, at, o)
  }

  torus(mat: THREE.Material, R: number, r: number, at: V3, o: PartOptions & { arc?: number; seg?: number; tube?: number } = {}): THREE.Mesh {
    const geo = new THREE.TorusGeometry(R, r, o.tube ?? 6, this.seg(o.seg ?? 24), o.arc ?? Math.PI * 2)
    return this.mesh(geo, mat, at, o)
  }

  plane(mat: THREE.Material, w: number, h: number, at: V3, o: PartOptions = {}): THREE.Mesh {
    return this.mesh(new THREE.PlaneGeometry(w, h), mat, at, o)
  }

  circle(mat: THREE.Material, r: number, at: V3, o: PartOptions & { seg?: number } = {}): THREE.Mesh {
    return this.mesh(new THREE.CircleGeometry(r, this.seg(o.seg ?? 20)), mat, at, o)
  }

  /** A round rod through the given points. */
  tube(mat: THREE.Material, points: V3[], r: number, o: PartOptions & { seg?: number; closed?: boolean } = {}): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), o.closed ?? false)
    const geo = new THREE.TubeGeometry(curve, this.seg(o.seg ?? Math.max(8, points.length * 6)), r, 6, o.closed ?? false)
    return this.mesh(geo, mat, [0, 0, 0], o)
  }

  /** A straight rod between two points. */
  rod(mat: THREE.Material, a: V3, b: V3, r: number, o: PartOptions & { seg?: number } = {}): THREE.Mesh {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b)
    const len = va.distanceTo(vb)
    const geo = new THREE.CylinderGeometry(r, r, len, this.seg(o.seg ?? 8), 1, false)
    const mesh = this.mesh(geo, mat, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], { ...o, rot: undefined })
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.sub(va).normalize())
    return mesh
  }

  /** An extruded 2D shape (in the XY plane), extruded along +Z by `depth`, centred on z. */
  extrude(mat: THREE.Material, shape: THREE.Shape, depth: number, at: V3, o: PartOptions & { bevel?: number } = {}): THREE.Mesh {
    const bev = typeof o.bevel === 'number' ? o.bevel : 0
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bev > 0, bevelSize: bev, bevelThickness: bev, bevelSegments: 1, curveSegments: this.seg(12)
    })
    geo.translate(0, 0, -depth / 2)
    return this.mesh(geo, mat, at, { ...o, bevel: undefined })
  }

  group(at: V3 = [0, 0, 0], o: { rot?: V3; name?: string; keep?: boolean; parent?: THREE.Object3D } = {}): THREE.Group {
    const g = new THREE.Group()
    g.position.set(...at)
    if (o.rot) g.rotation.set(...o.rot)
    if (o.name) g.name = o.name
    if (o.keep) g.userData.keep = true
    ;(o.parent ?? this.root).add(g)
    return g
  }
}

function paint(geo: THREE.BufferGeometry, colour: string): void {
  const c = new THREE.Color(colour)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

/**
 * Box projection at true scale, chosen per triangle so bevels do not smear (the same
 * technique as the house generator).
 */
export function projectUV(source: THREE.BufferGeometry, tile: number): THREE.BufferGeometry {
  const geo = source.index ? source.toNonIndexed() : source
  if (geo !== source) source.dispose()
  const pos = geo.attributes.position as THREE.BufferAttribute
  let uv = geo.attributes.uv as THREE.BufferAttribute | undefined
  if (!uv) {
    uv = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2)
    geo.setAttribute('uv', uv)
  }
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (let i = 0; i + 2 < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2)
    const n = c.sub(b).cross(a.sub(b))
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
    for (let k = i; k < i + 3; k++) {
      const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k)
      if (ax >= ay && ax >= az) uv.setXY(k, z / tile, y / tile)
      else if (ay >= az) uv.setXY(k, x / tile, z / tile)
      else uv.setXY(k, x / tile, y / tile)
    }
  }
  uv.needsUpdate = true
  return geo
}

/** Normalises a geometry for merging: non-indexed, position/normal/uv (+colour). */
function normalise(geo: THREE.BufferGeometry, withColour: boolean): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  for (const name of Object.keys(g.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && !(withColour && name === 'color')) g.deleteAttribute(name)
  }
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  if (withColour && !g.attributes.color) {
    const arr = new Float32Array(g.attributes.position.count * 3).fill(1)
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  }
  g.clearGroups()
  g.morphAttributes = {}
  return g
}

export interface Baked {
  object: THREE.Group
  /** Every geometry the baked object holds (merged and kept). */
  geometries: THREE.BufferGeometry[]
  triangles: number
}

export function triangleCount(geo: THREE.BufferGeometry): number {
  return geo.index ? geo.index.count / 3 : geo.attributes.position.count / 3
}

/** Merges static parts per material; keeps `userData.keep` parts separate. */
export function bake(source: THREE.Object3D, name: string): Baked {
  source.updateMatrixWorld(true)
  const inverse = source.matrixWorld.clone().invert()
  const byMaterial = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>()
  const kept: THREE.Object3D[] = []
  const originals = new Set<THREE.BufferGeometry>()

  const visit = (node: THREE.Object3D): void => {
    if (node !== source && node.userData.keep) {
      kept.push(node)
      return
    }
    const mesh = node as THREE.Mesh
    if (mesh.isMesh) {
      const material = mesh.material as THREE.Material
      const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
      const g = normalise(mesh.geometry, !!(material as THREE.MeshStandardMaterial).vertexColors)
      g.applyMatrix4(matrix)
      originals.add(mesh.geometry)
      const entry = byMaterial.get(material) ?? { geos: [], shadow: false }
      entry.geos.push(g)
      entry.shadow ||= mesh.castShadow
      byMaterial.set(material, entry)
    }
    for (const child of node.children) visit(child)
  }
  visit(source)

  const object = new THREE.Group()
  object.name = name
  const geometries: THREE.BufferGeometry[] = []
  let triangles = 0
  for (const [material, { geos, shadow }] of byMaterial) {
    let merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    if (geos.length > 1) for (const g of geos) g.dispose()
    const tile = material.userData.tile as number | undefined
    if (tile && (material as THREE.MeshStandardMaterial).map) merged = projectUV(merged, tile)
    merged.computeBoundingBox()
    merged.computeBoundingSphere()
    const mesh = new THREE.Mesh(merged, material)
    mesh.castShadow = shadow
    mesh.receiveShadow = true
    mesh.name = `${name}:${material.name}`
    object.add(mesh)
    geometries.push(merged)
    triangles += triangleCount(merged)
  }
  for (const g of originals) g.dispose()

  for (const node of kept) {
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, node.matrixWorld)
    node.removeFromParent()
    matrix.decompose(node.position, node.quaternion, node.scale)
    object.add(node)
    node.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh) return
      const material = mesh.material as THREE.Material
      const tile = material.userData.tile as number | undefined
      if (tile && (material as THREE.MeshStandardMaterial).map) mesh.geometry = projectUV(mesh.geometry, tile)
      geometries.push(mesh.geometry)
      triangles += triangleCount(mesh.geometry)
    })
  }
  return { object, geometries, triangles }
}
