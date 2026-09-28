/**
 * Photo rooms: the room is a real 360° photograph. Objects can be part of that
 * photograph (interactive hotspots) or placed 3D assets. A photo shell is data
 * (the photograph, where it was taken from, its slots) handed to
 * `photoShell`, which returns an ordinary ShellDef, so slots, placements, validation and
 * tools/suite/assets/write-environments.py treat it like any modelled room.
 *
 * How it is drawn:
 * - The photograph (an already tone-mapped equirectangular WebP) is a GroundedSkybox: a
 *   sphere whose lower half is flattened onto the floor plane y = 0, with the lens at
 *   (0, cameraHeight, 0). Seen from exactly there, every direction shows exactly the
 *   photograph; moved a little, the floor stays put under the objects standing on it.
 * - Objects are lit by the same place's 1k HDR (SceneEnvironment, prefiltered by the host)
 *   and, on the standard tier, by a key light standing in for the photograph's main light,
 *   which casts their shadows onto an invisible shadow-catching plane on the photo's floor.
 * - A photograph is right only from where it was taken, so the seat is the lens, walking
 *   stays within `parallax` metres of it, and every object is looked at from the seat.
 *
 * See docs/suite/assets.md, "Add a photo room".
 */
import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js'
import type { LocalizedText, SceneEnvironment, ShellId } from '../../contracts'
import { createCanvas } from '../../assets/runtimeText'
import { suiteUrl } from '../../paths'
import type { ShellBuild, ShellDef, SlotDef } from './types'

export interface PanoramaConfig {
  /** Path under public/suite/: the backdrop, an equirectangular WebP as photographed
   *  (tone-mapped already). Vendored by tools/suite/assets/fetch-panoramas.mjs. */
  display: string
  /** Path under public/suite/: a 1k Radiance .hdr of the same place: the objects' light. */
  lighting: string
  /** Metres from the floor to the lens when the photograph was taken. */
  cameraHeight: number
  /**
   * Radians: turns the photograph so the room's front (what the seat looks at) faces −z.
   * `yaw = 2π(u − 0.5)` puts the image column at fraction `u` across the image straight
   * ahead; larger turns the view to the right.
   */
  yaw: number
  /** Multiplies the HDR's light on objects so a white object looks as bright as white
   *  things in the photograph. Default 1. */
  exposure?: number
  /**
   * The photograph's main light (a window, a lamp), as a directional light that casts
   * shadows on the standard tier. Where it comes from: `azimuth` radians from straight
   * ahead of the seat toward the right, `elevation` radians above the horizon. For a light
   * at image column u and row v (fractions of the image), azimuth = 2π(u − 0.5) − yaw and
   * elevation = π(0.5 − v). `softness` is the shadow blur radius (default 4).
   */
  key?: { azimuth: number; elevation: number; intensity: number; softness?: number }
  /** Radius (m) of the sphere the walls are projected on. The floor is flat out to about
   *  cameraHeight / tan(asin(1.5 · cameraHeight / radius)); default 7 m. */
  radius?: number
}

export interface PhotoShellConfig {
  id: ShellId
  name: LocalizedText
  /** Metres, as for any shell, measured against the photograph: floor slots on its clear
   *  floor, wall slots on its measured wall planes. */
  slots: SlotDef[]
  panorama: PanoramaConfig
  /** How far (m) the eye may move from the lens before the photograph visibly breaks:
   *  photographed things 1 m away shift about 10° for every 0.2 m. Default 0.25. */
  parallax?: number
  /** The photograph's clear floor, [minX, minZ, maxX, maxZ] (m): where shadows may fall.
   *  A shadow drawn over a wall or a photographed sofa would give the trick away. */
  floor: [number, number, number, number]
  /** Where the seat looks; default ahead and a little down. */
  target?: [number, number, number]
}

/** The walker's radius (navigator.ts WALK_RADIUS): walkable is the parallax box grown by
 *  it, so the eye itself never leaves the parallax radius. */
const WALKER = 0.25
/** Shown until the photograph arrives, and under node: a warm neutral, never black. */
const NEUTRAL = 0xd8d0c2
const TIMEOUT_MS = 15000

/** The photograph's column `u` and row `v` (fractions, v from the top) as a world direction. */
export function panoramaDirection(u: number, v: number, yaw: number): THREE.Vector3 {
  const azimuth = 2 * Math.PI * (u - 0.5) - yaw
  const elevation = Math.PI * (0.5 - v)
  return new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation))
}

/** Where the floor is at the photograph's (u, v), or null above the horizon. */
export function panoramaFloorPoint(u: number, v: number, yaw: number, cameraHeight: number): THREE.Vector3 | null {
  const d = panoramaDirection(u, v, yaw)
  if (d.y >= -1e-3) return null
  return new THREE.Vector3(0, cameraHeight, 0).addScaledVector(d, cameraHeight / -d.y)
}

/**
 * ACES (three's ACESFilmicToneMapping) undone, for the full tier: there the scene is drawn
 * into a linear target and OutputPass tone-maps everything at the end, so `toneMapped =
 * false` alone would tone-map the photograph a second time. The backdrop then writes the
 * radiance that ACES maps back to the photograph's own colour. Exact for 99% of a
 * photograph's pixels; the rest (colours more saturated than ACES can produce) come back
 * slightly less saturated, which is not visible in practice.
 */
const ACES_IN = new THREE.Matrix3().set(0.59719, 0.35458, 0.04823, 0.07600, 0.90834, 0.01566, 0.02840, 0.13383, 0.83777)
const ACES_OUT = new THREE.Matrix3().set(1.60475, -0.53108, -0.07367, -0.10208, 1.10813, -0.00605, -0.00327, -0.07276, 1.07602)
const INVERSE_GLSL = /* glsl */`
uniform float photoInverse;
uniform float photoExposure;
uniform mat3 photoInInv;
uniform mat3 photoOutInv;
vec3 photoUntoneMap( vec3 c ) {
  vec3 y = clamp( photoOutInv * clamp( c, 0.0, 1.0 ), 0.0, 0.99 );
  vec3 a = 1.0 - 0.983729 * y;
  vec3 b = 0.0245786 - 0.4329510 * y;
  vec3 k = -( 0.000090537 + 0.238081 * y );
  vec3 v = ( -b + sqrt( max( b * b - 4.0 * a * k, 0.0 ) ) ) / ( 2.0 * a );
  return max( photoInInv * v, 0.0 ) * 0.6 / photoExposure;
}
`

function backdropMaterial(material: THREE.MeshBasicMaterial): void {
  material.toneMapped = false
  material.fog = false
  material.color.set(NEUTRAL)
  const uniforms = {
    photoInverse: { value: 0 },
    photoExposure: { value: 1 },
    photoInInv: { value: ACES_IN.clone().invert() },
    photoOutInv: { value: ACES_OUT.clone().invert() }
  }
  material.userData.photoUniforms = uniforms
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    // The photograph is looked up by the direction from the lens (the mesh's own origin)
    // to each fragment, not by the sphere's interpolated UVs: those are exact only at the
    // vertices and bent every straight edge in the photograph into a zigzag. Seen from the
    // seat this is exact whatever the tessellation; the geometry then only decides how the
    // photograph shifts when the eye moves.
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPhotoDir;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvPhotoDir = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vPhotoDir;\n${INVERSE_GLSL}`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
\tvec3 photoDir = normalize( vPhotoDir );
\t// SphereGeometry's own layout, mirrored in z by GroundedSkybox: u = 0.5 faces +x.
\tvec2 photoUv = vec2( fract( atan( -photoDir.z, -photoDir.x ) * RECIPROCAL_PI2 ), 0.5 + asin( clamp( photoDir.y, -1.0, 1.0 ) ) * RECIPROCAL_PI );
\tdiffuseColor *= texture2D( map, photoUv );
#endif`)
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n\tif ( photoInverse > 0.5 ) gl_FragColor.rgb = photoUntoneMap( gl_FragColor.rgb );')
  }
  material.customProgramCacheKey = () => 'suite-photo-backdrop'
}

/** Redraws an image into a canvas no larger than `max` px wide (the low tier, small GPUs). */
function fitTexture(texture: THREE.Texture, max: number): THREE.Texture {
  const img = texture.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img?.width || img.width <= max) return texture
  const canvas = createCanvas(max, Math.round((max * img.height) / img.width))
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return texture
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  texture.dispose()
  return new THREE.CanvasTexture(canvas)
}

function withTimeout<T>(start: (done: (value: T | null, why?: string) => void) => void): Promise<{ value: T | null; why?: string }> {
  return new Promise((resolve) => {
    let settled = false
    const done = (value: T | null, why?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ value, why })
    }
    const timer = setTimeout(() => done(null, 'timeout'), TIMEOUT_MS)
    try { start(done) } catch (error) { done(null, String(error)) }
  })
}

export function photoShell(config: PhotoShellConfig): ShellDef {
  const pano = config.panorama
  const h = pano.cameraHeight
  const parallax = config.parallax ?? 0.25
  const exposure = pano.exposure ?? 1
  // The image's centre column faces +x on the sphere; a quarter turn brings it to −z.
  const turn = Math.PI / 2 + pano.yaw
  return {
    id: config.id,
    name: config.name,
    slots: config.slots,
    photo: config,
    // Nothing is painted in a photo room; these only satisfy the shared material setup.
    defaults: { wall: '#e9e1d3', trim: '#7a5c40', floor: 'wood', light: 'warm', accent: '#b0563a' },
    build(ctx): ShellBuild {
      const group = new THREE.Group()
      group.name = 'photo-room'
      const lights: THREE.Light[] = []
      const problems: string[] = []
      const owned: { dispose(): void }[] = []
      let disposed = false

      // ---- the photograph
      const radius = pano.radius ?? 7
      const sky = new GroundedSkybox(null as unknown as THREE.Texture, h, radius, 64)
      sky.name = 'photo:backdrop'
      sky.position.y = h
      sky.rotation.y = turn
      sky.renderOrder = -1
      sky.frustumCulled = false
      const material = sky.material as THREE.MeshBasicMaterial
      backdropMaterial(material)
      const uniforms = material.userData.photoUniforms as { photoInverse: { value: number }; photoExposure: { value: number } }
      const keep = new THREE.Matrix4()
      sky.onBeforeRender = (renderer, _scene, _camera, _geometry, drawnWith) => {
        if (drawnWith !== material) {
          // Drawn with another material (GTAO's normal and depth pass): the backdrop is not
          // there. To ambient occlusion the inside of a sphere is one deep crease, and it
          // darkened the whole photograph. The shadow catcher stands in for the floor, so
          // objects still darken the floor where they touch it. The world matrix is
          // collapsed for this one draw (the model-view matrix is made from it next).
          keep.copy(sky.matrixWorld)
          sky.matrixWorld.makeScale(0, 0, 0)
          return
        }
        // Drawn into a target (the full tier's composer), the photograph is tone-mapped
        // afterwards by OutputPass: undo it here. Drawn to the canvas it is shown as is.
        const later = renderer.getRenderTarget() !== null && renderer.toneMapping === THREE.ACESFilmicToneMapping
        uniforms.photoInverse.value = later ? 1 : 0
        uniforms.photoExposure.value = renderer.toneMappingExposure || 1
      }
      sky.onAfterRender = (_renderer, _scene, _camera, _geometry, drawnWith) => {
        if (drawnWith !== material) sky.matrixWorld.copy(keep)
      }
      group.add(sky)
      owned.push(sky.geometry, material)

      // ---- the photograph's floor: an invisible plane that shows only shadows
      const shadows = ctx.quality === 'standard'
      const [fx0, fz0, fx1, fz1] = config.floor
      if (shadows) {
        const catcherGeo = new THREE.PlaneGeometry(fx1 - fx0, fz1 - fz0)
        catcherGeo.rotateX(-Math.PI / 2)
        catcherGeo.translate((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2)
        // A warm dark rather than black: a shadow on a carpet or a floor is the floor, dimmer.
        const catcherMat = new THREE.ShadowMaterial({ color: 0x2a1c10, opacity: 0.5, depthWrite: false })
        const catcher = new THREE.Mesh(catcherGeo, catcherMat)
        catcher.name = 'photo:shadow-catcher'
        catcher.receiveShadow = true
        group.add(catcher)
        owned.push(catcherGeo, catcherMat)
      }

      // ---- the photograph's main light, for direct light and shadows
      if (pano.key) {
        const { azimuth, elevation, intensity, softness = 4 } = pano.key
        const centre = new THREE.Vector3((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2)
        const key = new THREE.DirectionalLight(0xfff4e6, intensity)
        key.name = 'photo:key'
        const dir = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), -Math.cos(azimuth) * Math.cos(elevation))
        key.position.copy(centre).addScaledVector(dir, 8)
        key.target.position.copy(centre)
        if (shadows) {
          key.castShadow = true
          key.shadow.mapSize.set(2048, 2048)
          const extent = Math.hypot(fx1 - fx0, fz1 - fz0) / 2 + 1
          const cam = key.shadow.camera
          cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent
          cam.near = 1; cam.far = 20
          key.shadow.bias = -0.0005
          key.shadow.normalBias = 0.02
          // Light through a window on an overcast day has a wide, soft edge.
          key.shadow.radius = softness
        }
        group.add(key, key.target)
        lights.push(key)
      }
      // ---- background loads: the backdrop and the lighting (never under node)
      const build: ShellBuild = {
        group,
        geometries: [],
        lights,
        blockers: [],
        walkable: new THREE.Box3(
          new THREE.Vector3(-parallax - WALKER, 0, -parallax - WALKER),
          new THREE.Vector3(parallax + WALKER, 3, parallax + WALKER)
        ),
        seat: {
          position: new THREE.Vector3(0, h, 0),
          target: config.target ? new THREE.Vector3(...config.target) : new THREE.Vector3(0, h - 0.45, -2.2),
          fov: 95
        },
        spawn: { position: new THREE.Vector3(0, h, 0), yaw: 0 },
        centre: new THREE.Vector3((fx0 + fx1) / 2, 0, (fz0 + fz1) / 2),
        fixedViewpoint: { radius: parallax },
        contactShadows: true,
        environment: null,
        problems,
        extraTextureKB: () => (build.environment ? pmremKB(build.environment.map) : 0),
        dispose() {
          disposed = true
          for (const o of owned) o.dispose()
          for (const light of lights) (light as THREE.Light & { dispose?: () => void }).dispose?.()
          build.environment?.map.dispose()
        }
      }

      if (ctx.loadTextures && typeof document !== 'undefined') {
        const displayMax = Math.min(ctx.quality === 'standard' ? 4096 : 1920, ctx.maxTextureSize)
        const display = withTimeout<THREE.Texture>((done) => {
          new THREE.TextureLoader().load(suiteUrl(pano.display), (t) => done(t), undefined, () => done(null, 'load error'))
        }).then(({ value, why }) => {
          if (!value) { problems.push(`panorama "${pano.display}" could not be loaded (${why}); a plain backdrop is shown`); return }
          if (disposed) { value.dispose(); return }
          const texture = fitTexture(value, displayMax)
          texture.colorSpace = THREE.SRGBColorSpace
          // Seen at about one texel per pixel, a mip chain would add a third to the
          // memory for no visible gain: no mipmaps, linear filtering.
          texture.generateMipmaps = false
          texture.minFilter = THREE.LinearFilter
          texture.magFilter = THREE.LinearFilter
          texture.wrapS = THREE.RepeatWrapping
          material.map = texture
          material.color.set(0xffffff)
          material.needsUpdate = true
          owned.push(texture)
        })
        const lighting = withTimeout<THREE.DataTexture>((done) => {
          new HDRLoader().setDataType(THREE.FloatType).load(suiteUrl(pano.lighting), (t) => done(t as THREE.DataTexture), undefined, () => done(null, 'load error'))
        }).then(({ value, why }) => {
          if (!value) { problems.push(`panorama lighting "${pano.lighting}" could not be loaded (${why}); the room's reflections are captured instead`); return }
          if (disposed) { value.dispose(); return }
          const map = halve(value)
          map.mapping = THREE.EquirectangularReflectionMapping
          const environment: SceneEnvironment = { map, intensity: exposure, rotation: turn }
          build.environment = environment
        })
        build.ready = Promise.all([display, lighting]).then(() => undefined)
      }
      return build
    }
  }
}

/**
 * A 1k HDR at half size. PMREMGenerator sizes its output from the input's width: from 1024
 * px it makes a 6 MB target, from 512 a 1.5 MB one, the same size as the modelled rooms'
 * captured reflections. The objects' light and blurred reflections look the same either way.
 */
function halve(texture: THREE.DataTexture): THREE.DataTexture {
  const { width, height, data } = texture.image as { width: number; height: number; data: Float32Array }
  if (!(data instanceof Float32Array) || width <= 512) return texture
  const w = width >> 1, h = height >> 1
  const out = new Float32Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const i = ((2 * y + dy) * width + 2 * x + dx) * 4
        out[o] += data[i] / 4; out[o + 1] += data[i + 1] / 4; out[o + 2] += data[i + 2] / 4
      }
      out[o + 3] = 1
    }
  }
  texture.dispose()
  const half = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.FloatType)
  half.colorSpace = THREE.LinearSRGBColorSpace
  half.minFilter = THREE.LinearFilter
  half.magFilter = THREE.LinearFilter
  half.generateMipmaps = false
  half.needsUpdate = true
  return half
}

/** GPU memory of the PMREM the host makes from an equirectangular map (PMREMGenerator:
 *  a 3·s × 4·s half-float target, s = the largest power of two ≤ width / 4). */
function pmremKB(map: THREE.Texture): number {
  const width = (map.image as { width?: number } | undefined)?.width ?? 1024
  const s = Math.pow(2, Math.floor(Math.log2(Math.max(16, width / 4))))
  return (3 * Math.max(s, 16 * 7) * 4 * s * 8) / 1024
}
