/**
 * The picture area of a frame or album. A plain mat fills the display area; the picture
 * sits just in front of it, scaled to fit inside with a small margin — letterboxed, never
 * cropped, never stretched. The picture's size is set by the mesh scale on a shared unit
 * plane, so its world width/height ratio is exactly the texture's aspect.
 */
import * as THREE from 'three'
import type { AssetDef, PhotoSurface } from '../contracts'

/** Fraction of the display area the picture may use; the rest is visible mat. */
export const MAT_MARGIN = 0.92

const FACING: Record<NonNullable<AssetDef['photoSurface']>['facing'], THREE.Euler> = {
  '+z': new THREE.Euler(0, 0, 0),
  '-z': new THREE.Euler(0, Math.PI, 0),
  '+x': new THREE.Euler(0, Math.PI / 2, 0),
  '-x': new THREE.Euler(0, -Math.PI / 2, 0),
  // Lying face up; the picture's top points away from a viewer standing at +z.
  '+y': new THREE.Euler(-Math.PI / 2, 0, 0)
}

/** The letterboxed size of a picture with `aspect` (w/h) inside a w × h area. */
export function fitInside(width: number, height: number, aspect: number): { w: number; h: number } {
  const aw = width * MAT_MARGIN, ah = height * MAT_MARGIN
  if (!(aspect > 0) || !Number.isFinite(aspect)) return { w: aw, h: ah }
  return aspect >= aw / ah ? { w: aw, h: aw / aspect } : { w: ah * aspect, h: ah }
}

export type DecorativeLoader = () => Promise<{ texture: THREE.Texture; aspect: number } | null>

export class ScenePhotoSurface implements PhotoSurface {
  readonly width: number
  readonly height: number
  readonly holder = new THREE.Group()
  readonly mat: THREE.Mesh
  readonly picture: THREE.Mesh
  private pictureMaterial: THREE.MeshBasicMaterial
  private matMaterial: THREE.MeshStandardMaterial
  private generation = 0
  /** True while showing something other than the plain mat. */
  showing: 'blank' | 'decorative' | 'personal' = 'blank'

  constructor(
    parent: THREE.Object3D,
    def: NonNullable<AssetDef['photoSurface']>,
    unitPlane: THREE.PlaneGeometry,
    private decorative: DecorativeLoader | null
  ) {
    this.width = def.width
    this.height = def.height
    this.holder.name = 'photo-surface'
    this.holder.position.set(...def.at)
    this.holder.rotation.copy(FACING[def.facing])
    this.matMaterial = new THREE.MeshStandardMaterial({ color: 0xece4d2, roughness: 0.92 })
    this.matMaterial.name = 'suite:photo-mat'
    this.mat = new THREE.Mesh(unitPlane, this.matMaterial)
    this.mat.name = 'photo-mat'
    this.mat.scale.set(def.width, def.height, 1)
    this.mat.receiveShadow = true
    this.pictureMaterial = new THREE.MeshBasicMaterial({ toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    this.pictureMaterial.name = 'suite:photo-picture'
    this.picture = new THREE.Mesh(unitPlane, this.pictureMaterial)
    this.picture.name = 'photo-picture'
    this.picture.position.z = 0.0015
    this.picture.visible = false
    this.holder.add(this.mat, this.picture)
    parent.add(this.holder)
  }

  private display(texture: THREE.Texture, aspect: number): void {
    const { w, h } = fitInside(this.width, this.height, aspect)
    this.picture.scale.set(w, h, 1)
    this.pictureMaterial.map = texture
    this.pictureMaterial.needsUpdate = true
    this.picture.visible = true
  }

  show(texture: THREE.Texture, aspect: number): void {
    this.generation++
    this.display(texture, aspect)
    this.showing = 'personal'
  }

  blank(): void {
    this.generation++
    this.picture.visible = false
    this.pictureMaterial.map = null
    this.pictureMaterial.needsUpdate = true
    this.showing = 'blank'
  }

  reset(): void {
    this.blank()
    if (!this.decorative) return
    const generation = this.generation
    this.decorative().then((result) => {
      // A later show()/blank() wins over a slow decorative load.
      if (!result || generation !== this.generation) return
      this.display(result.texture, result.aspect)
      this.showing = 'decorative'
    }, () => { /* reported by the loader; the mat stays */ })
  }

  /** The picture's current size in world units (for checks). */
  pictureWorldSize(): { w: number; h: number } {
    this.picture.updateWorldMatrix(true, false)
    const e = this.picture.matrixWorld.elements
    const w = Math.hypot(e[0], e[1], e[2]), h = Math.hypot(e[4], e[5], e[6])
    return { w, h }
  }

  dispose(): void {
    this.generation++
    this.matMaterial.dispose()
    this.pictureMaterial.dispose()
  }
}
