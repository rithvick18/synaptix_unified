/**
 * Environment shells and the scene builder. See docs/suite/assets.md.
 *
 *   SHELLS           the three shells and their slots (ShellInfo)
 *   buildSuiteScene  builds one environment preset of a pack into a SuiteScene
 */
import * as THREE from 'three'
import type {
  AssetDef, BuildSuiteScene, ContentProblem, I18n, LoadedContentPack, ObjectOverrides, Placement,
  SceneObject, SceneReport, ShellId, ShellInfo, ShellMaterials, SuiteScene
} from '../contracts'
import { acquireGltf, releaseGltf } from '../assets/gltf'
import { MaterialLease, type MaterialEnv } from '../assets/materials'
import { acquireProcedural, releasePrototype } from '../assets/prototypes'
import { createCanvas, RuntimeTextSurface, type RuntimeTextSpec } from '../assets/runtimeText'
import { TEXTURE_SET_NAMES, textureKB, textureStore, type LoadedSet, type TextureSetName } from '../assets/textures'
import { resolveUnder, suiteUrl } from '../paths'
import { ScenePhotoSurface } from './photoSurface'
import { SHELL_DEFS, panoramaDirection, type SlotDef } from './shells'
import type { ResolvedMaterials } from './shells/types'
import { findViewpoint, seatViewpoint, MIN_DISTANCE, MAX_DISTANCE } from './viewpoint'

export { SHELL_DEFS, photoShell, panoramaDirection, panoramaFloorPoint } from './shells'
export { ScenePhotoSurface, fitInside, MAT_MARGIN } from './photoSurface'
export { findViewpoint, seatViewpoint, clearOfBlockers, insideWalkable, lineOfSight, footprintDistance, EYE_HEIGHT, CLEARANCE } from './viewpoint'

export const SHELLS: Readonly<Record<ShellId, ShellInfo>> = SHELL_DEFS

/** The report, plus warnings that do not stop a scene from building (missing pictures…). */
export type SuiteSceneReport = SceneReport & { warnings: ContentProblem[] }

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function resolveMaterials(defaults: ResolvedMaterials, given: ShellMaterials | undefined): ResolvedMaterials {
  const out: ResolvedMaterials = { ...defaults }
  if (given) {
    for (const [key, value] of Object.entries(given)) if (value !== undefined) (out as unknown as Record<string, unknown>)[key] = value
  }
  return out
}

function isHanging(def: AssetDef): boolean {
  return def.tags?.contexts?.includes('hanging') ?? false
}

/** Size in slot coordinates after the placement's own turn. */
function turnedSize(def: AssetDef, yaw: number): [number, number, number] {
  const [w, h, d] = def.size
  return Math.abs(Math.sin(yaw)) > 0.7 ? [d, h, w] : [w, h, d]
}

const FLOOR_SETS: Record<string, TextureSetName> = {
  wood: 'floor-wood', tile: 'tile', stone: 'stone', terrazzo: 'terrazzo', 'red-oxide': 'cement', 'mud-plaster': 'clay', cement: 'cement'
}

/** Redraws a large picture into a canvas no larger than `max` px on its long edge. */
function downscale(texture: THREE.Texture, max: number): THREE.Texture {
  const img = texture.image as (CanvasImageSource & { width: number; height: number }) | undefined
  if (!img?.width || !img?.height || Math.max(img.width, img.height) <= max) return texture
  const scale = max / Math.max(img.width, img.height)
  const canvas = createCanvas(Math.max(1, Math.round(img.width * scale)), Math.max(1, Math.round(img.height * scale)))
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return texture
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  texture.dispose()
  return new THREE.CanvasTexture(canvas)
}

/**
 * The contact shadow's look: black, fading from 45% at the centre to nothing at the edge
 * of its quad. Without a canvas (node checks) it is a flat, faint patch.
 */
function contactShadowMaterial(): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: 0x1a120a, transparent: true, opacity: 0.45, depthWrite: false })
  material.name = 'contact-shadow'
  const canvas = createCanvas(64, 64)
  const ctx = canvas?.getContext('2d')
  if (canvas && ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, '#fff')
    g.addColorStop(0.45, '#bbb')
    g.addColorStop(1, '#000')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    material.alphaMap = new THREE.CanvasTexture(canvas)
  } else material.opacity = 0.2
  return material
}

interface Built {
  placement: Placement
  def: AssetDef
  slot: SlotDef
  object: THREE.Group
  yaw: number
  blockers: THREE.Box3[]
  hostBlockers: THREE.Box3[]
  focus: THREE.Vector3
  front: THREE.Vector3
  photo: ScenePhotoSurface | null
  texts: RuntimeTextSurface[]
}

export const buildSuiteScene: BuildSuiteScene = async (options) => {
  const started = now()
  const { pack, environmentId, library, overrides = {}, quality } = options
  const preset = pack.environments.find((e) => e.id === environmentId)
  if (!preset) throw new Error(`environment "${environmentId}" is not in pack "${pack.meta.id}"`)
  const shellDef = SHELL_DEFS[preset.shell]
  if (!shellDef) throw new Error(`environment "${environmentId}" names an unknown shell "${preset.shell}"`)
  const where = (id: string): string => `packs/${pack.meta.id}/environments.json#${environmentId}/${id}`

  const warnings: ContentProblem[] = []
  const report: SuiteSceneReport = {
    packId: pack.meta.id, environmentId, objectCount: 0, missingAssets: [], fallbacksUsed: [], unknownSlots: [],
    rejectedPlacements: [], triangles: 0, meshes: 0, textureKB: 0, buildMs: 0, warnings
  }
  const loadTextures = options.loadTextures !== false
  const textured = loadTextures && quality === 'standard'
  const shadows = quality === 'standard'
  const materials = resolveMaterials(shellDef.defaults, preset.materials)

  // ---- texture sets (standard tier only; failures fall back to flat colour)
  const sets = new Map<TextureSetName, LoadedSet | null>()
  const acquiredSets: TextureSetName[] = []
  if (textured) {
    const wanted = new Set<TextureSetName>(['wood', 'plaster', 'fabric', 'clay', 'bamboo', 'stone', FLOOR_SETS[materials.floor] ?? 'terrazzo'])
    if (preset.shell === 'courtyardVeranda') wanted.add('cement')
    const names = TEXTURE_SET_NAMES.filter((n) => wanted.has(n))
    const loaded = await Promise.all(names.map((n) => textureStore.acquire(n, options.anisotropy).catch(() => null)))
    names.forEach((n, i) => { sets.set(n, loaded[i]); acquiredSets.push(n) })
  }
  const env: MaterialEnv = { textured, sets }

  // ---- the shell
  const root = new THREE.Group()
  root.name = `suite:${pack.meta.id}/${environmentId}`
  const shellLease = new MaterialLease(env)
  const shell = shellDef.build({ mats: shellLease, materials, quality, loadTextures, maxTextureSize: options.maxTextureSize })
  shell.group.name = `shell:${preset.shell}`
  root.add(shell.group)
  const blockers: THREE.Box3[] = [...shell.blockers]
  const unitPlane = new THREE.PlaneGeometry(1, 1)
  const contact = shell.contactShadows ? contactShadowMaterial() : null
  const floorQuad = contact ? new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2) : null

  // ---- decorative pictures, loaded once per image id, owned by this scene
  const decorativeTextures = new Map<string, Promise<{ texture: THREE.Texture; aspect: number } | null>>()
  const ownedTextures: THREE.Texture[] = []
  let disposed = false
  const decorativeLoader = (imageId: string, placementId: string): (() => Promise<{ texture: THREE.Texture; aspect: number } | null>) | null => {
    const image = pack.images.find((img) => img.id === imageId)
    if (!image) {
      warnings.push({ severity: 'warning', where: where(placementId), message: `decorative image "${imageId}" is not in the pack; a plain mat is shown` })
      return null
    }
    if (!loadTextures || typeof document === 'undefined') return null
    return () => {
      let promise = decorativeTextures.get(imageId)
      if (!promise) {
        const url = resolveUnder(pack.baseUrl, image.path)
        promise = new Promise((resolve) => {
          const fail = (why: string): void => {
            warnings.push({ severity: 'warning', where: where(placementId), message: `decorative image "${imageId}" could not be loaded (${why}); a plain mat is shown` })
            resolve(null)
          }
          const timer = setTimeout(() => fail('timeout'), 10000)
          try {
            new THREE.TextureLoader().load(url, (texture) => {
              clearTimeout(timer)
              if (disposed) { texture.dispose(); resolve(null); return }
              const img = texture.image as { width?: number; height?: number } | undefined
              const aspect = img?.width && img?.height ? img.width / img.height : image.width / image.height
              // In the room a picture is at most ~0.5 m across: 512 px is plenty, and it
              // keeps each decorative picture near 1 MB of GPU memory.
              const small = downscale(texture, Math.min(512, options.maxTextureSize))
              small.colorSpace = THREE.SRGBColorSpace
              small.anisotropy = options.anisotropy
              ownedTextures.push(small)
              const sw = (small.image as { width?: number })?.width ?? 512, sh = (small.image as { height?: number })?.height ?? 512
              report.textureKB += Math.round(textureKB(sw, sh))
              resolve({ texture: small, aspect })
            }, undefined, () => { clearTimeout(timer); fail('load error') })
          } catch (error) {
            clearTimeout(timer)
            fail(String(error))
          }
        })
        decorativeTextures.set(imageId, promise)
      }
      return promise
    }
  }

  // ---- placements
  const slotById = new Map(shellDef.slots.map((s) => [s.id, s]))
  const avoid = new Set(options.avoidTopics ?? [])
  const bySlot = new Map<string, Built>()
  const built: Built[] = []
  const protoKeys: string[] = []
  const hotspotResources: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
  const gltfKeys: string[] = []
  const textInput = (def: AssetDef, i18n: I18n): { texts: Record<string, string>; lang: string; fontFamily: string } => {
    const texts: Record<string, string> = {}
    for (const entry of def.runtimeText ?? []) texts[entry.slot] = typeof entry.text === 'string' && entry.text.startsWith('@') ? entry.text : i18n.text(entry.text)
    return { texts, lang: i18n.language, fontFamily: (() => { try { return i18n.info().fontFamily || 'sans-serif' } catch { return 'sans-serif' } })() }
  }

  const candidates = preset.placements.filter((p) => {
    if (overrides[p.id]?.hidden) return false
    const def = library.get(p.asset)
    if (def && (def.tags?.topics ?? []).some((t) => avoid.has(t))) return false
    return true
  })
  // Furniture before what stands on it.
  const ordered = [
    ...candidates.filter((p) => slotById.get(p.slot)?.mount !== 'surface'),
    ...candidates.filter((p) => slotById.get(p.slot)?.mount === 'surface')
  ]
  const seenIds = new Set<string>()
  let done = 0
  const total = ordered.length

  const instantiate = async (def: AssetDef, placementId: string): Promise<{ object: THREE.Group; def: AssetDef } | null> => {
    const tryDef = async (d: AssetDef): Promise<THREE.Group> => {
      if (d.source.kind === 'photograph') throw new Error('photographed objects require a photo hotspot')
      if (d.source.kind === 'procedural') {
        const proto = acquireProcedural(d, env, quality)
        protoKeys.push(proto.key)
        return proto.object.clone(true)
      }
      if (!loadTextures) throw new Error('glTF not loaded with loadTextures: false')
      const url = library.url(d.source.path, (library as { baseOf?: (id: string) => string }).baseOf?.(d.id))
      const g = await acquireGltf(url, d.source.scale ?? 1, d.source.yaw ?? 0)
      gltfKeys.push(g.key)
      return g.object.clone(true)
    }
    try {
      return { object: await tryDef(def), def }
    } catch (error) {
      const fallback = def.fallback ? library.get(def.fallback) : undefined
      if (!fallback) {
        warnings.push({ severity: 'error', where: where(placementId), message: `asset "${def.id}" failed to build and has no fallback: ${String(error)}` })
        return null
      }
      try {
        const object = await tryDef(fallback)
        report.fallbacksUsed.push({ placement: placementId, asset: def.id, fallback: fallback.id })
        return { object, def }
      } catch (error2) {
        warnings.push({ severity: 'error', where: where(placementId), message: `asset "${def.id}" and its fallback failed: ${String(error2)}` })
        return null
      }
    }
  }

  for (const placement of ordered) {
    options.onProgress?.(done++, total)
    const reject = (reason: string): void => { report.rejectedPlacements.push({ placement: placement.id, reason }) }
    if (seenIds.has(placement.id)) { reject('duplicate placement id'); continue }
    seenIds.add(placement.id)
    const slot = slotById.get(placement.slot)
    if (!slot) { report.unknownSlots.push(placement.slot); continue }
    const def = library.get(placement.asset)
    if (!def) { report.missingAssets.push(placement.asset); continue }
    if (def.mount !== slot.mount) { reject(`asset mount "${def.mount}" does not match slot "${slot.id}" (${slot.mount})`); continue }
    if (!!slot.hang !== isHanging(def)) { reject(slot.hang ? `slot "${slot.id}" hangs from above; "${def.id}" is not a hanging asset` : `"${def.id}" hangs from a ceiling or beam; slot "${slot.id}" is not a hanging slot`); continue }
    const extraYaw = placement.yaw ?? 0
    const size = turnedSize(def, extraYaw)
    if (size.some((v, i) => v > slot.maxSize[i] + 1e-6)) { reject(`size ${def.size.join('×')} exceeds slot "${slot.id}" max ${slot.maxSize.join('×')}`); continue }
    if (def.source.kind === 'photograph' && (!slot.photoHotspot || !shellDef.photo)) { reject('photographed object requires a photo hotspot'); continue }
    if (bySlot.has(slot.id)) { reject(`slot "${slot.id}" is already used by "${bySlot.get(slot.id)!.placement.id}"`); continue }
    // A captured object is already in the photograph. An invisible plane lets the same
    // scene, prompts, keyboard list and pointer controls address it without drawing a
    // second (usually mismatched) 3D copy over the pixels.
    if (slot.photoHotspot && shellDef.photo) {
      const { u, v, width, height } = slot.photoHotspot
      const seat = shell.seat.position
      const focus = seat.clone().addScaledVector(panoramaDirection(u, v, shellDef.photo.panorama.yaw), 3)
      const geometry = new THREE.PlaneGeometry(width, height)
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
      const target = new THREE.Mesh(geometry, material)
      target.position.copy(focus)
      target.lookAt(seat)
      const holder = new THREE.Group()
      holder.name = `object:${placement.id}`
      holder.userData.suiteObjectId = placement.id
      holder.add(target)
      root.add(holder)
      hotspotResources.push({ geometry, material })
      const builtTarget: Built = { placement, def, slot, object: holder, yaw: 0, blockers: [], hostBlockers: [],
        focus, front: seat.clone().sub(focus).normalize(), photo: null, texts: [] }
      bySlot.set(slot.id, builtTarget)
      built.push(builtTarget)
      continue
    }
    let hostBlockers: THREE.Box3[] = []
    if (slot.host) {
      const host = bySlot.get(slot.host.slot)
      if (!host) { reject(`slot "${slot.id}" sits on furniture in "${slot.host.slot}", which is not placed`); continue }
      if (Math.abs(host.def.size[1] - slot.host.height) > 0.04) { reject(`slot "${slot.id}" needs furniture ${slot.host.height} m high in "${slot.host.slot}"; "${host.def.id}" is ${host.def.size[1]} m`); continue }
      hostBlockers = host.blockers
    }

    const made = await instantiate(def, placement.id)
    if (!made) { report.missingAssets.push(def.id); continue }
    const inner = made.object
    const holder = new THREE.Group()
    holder.name = `object:${placement.id}`
    holder.userData.suiteObjectId = placement.id
    holder.add(inner)

    // Position the asset in its slot.
    const yaw = slot.yaw + extraYaw
    const front = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
    const [w, h, d] = def.size
    const pos = new THREE.Vector3(...slot.position)
    if (slot.hang) pos.y -= h
    else if (slot.mount === 'wall') { pos.y -= h / 2; pos.addScaledVector(front, d / 2 + 0.004) }
    if (slot.align === 'back' && !slot.hang && slot.mount !== 'wall') {
      const depth = Math.abs(Math.sin(extraYaw)) > 0.7 ? w : d
      pos.addScaledVector(new THREE.Vector3(Math.sin(slot.yaw), 0, Math.cos(slot.yaw)), -(slot.maxSize[2] - depth) / 2)
    }
    holder.position.copy(pos)
    holder.rotation.y = yaw
    root.add(holder)
    holder.updateMatrixWorld(true)

    // A soft patch on the floor under the object (photo rooms), just above any rug.
    if (contact && floorQuad && def.mount === 'floor' && def.collision && !slot.hang) {
      const patch = new THREE.Mesh(floorQuad, contact)
      patch.name = 'contact-shadow'
      patch.scale.set(w * 1.35 + 0.12, 1, d * 1.35 + 0.12)
      patch.position.y = 0.015
      patch.renderOrder = 1
      // Part of the look, not of the object: a tap on the floor beside it is not a tap on it.
      patch.raycast = () => undefined
      holder.add(patch)
    }

    // Shadows only where they matter: large floor pieces, and never on the low tier.
    inner.traverse((node) => {
      const mesh = node as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = shadows && mesh.castShadow && def.mount === 'floor' && def.collision
      mesh.receiveShadow = shadows
    })

    // Runtime text, drawn per instance in the active language.
    const texts: RuntimeTextSurface[] = []
    inner.traverse((node) => {
      const mesh = node as THREE.Mesh
      const spec = mesh.userData?.runtimeText as RuntimeTextSpec | undefined
      if (!mesh.isMesh || !spec) return
      const canvas = createCanvas(spec.px[0], spec.px[1])
      if (!canvas) return
      const surface = new RuntimeTextSurface(canvas, spec, options.anisotropy)
      surface.draw(textInput(def, options.i18n))
      mesh.material = surface.material
      texts.push(surface)
    })

    const photo = def.photoSurface
      ? new ScenePhotoSurface(inner, def.photoSurface, unitPlane, placement.image ? decorativeLoader(placement.image, placement.id) : null)
      : null
    photo?.reset()

    const localBox = new THREE.Box3(new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, h, d / 2))
    const own: THREE.Box3[] = []
    if (def.collision) {
      const box = localBox.clone().applyMatrix4(holder.matrixWorld)
      own.push(box)
      blockers.push(box)
    }
    const focusLocal = def.focus ? new THREE.Vector3(...def.focus) : new THREE.Vector3(0, h / 2, 0)
    const focus = focusLocal.applyMatrix4(holder.matrixWorld)
    const b: Built = { placement, def, slot, object: holder, yaw, blockers: own, hostBlockers, focus, front, photo, texts }
    bySlot.set(slot.id, b)
    built.push(b)
  }
  options.onProgress?.(total, total)

  // ---- viewpoints, once every blocker is known
  const objects: SceneObject[] = []
  const seatPos = shell.seat.position
  for (const b of built) {
    const { def } = b
    let front = b.front
    if (b.slot.hang) front = new THREE.Vector3(seatPos.x - b.focus.x, 0, seatPos.z - b.focus.z).normalize()
    const distance = def.viewDistance ?? Math.min(MAX_DISTANCE, Math.max(MIN_DISTANCE, 0.7 + Math.max(def.size[0], def.size[1]) * 0.8))
    const ignore = new Set([...b.blockers, ...b.hostBlockers])
    // A photo room is right only near where it was photographed: look from the seat.
    const view = shell.fixedViewpoint
      ? seatViewpoint({ seat: seatPos, focus: b.focus, radius: shell.fixedViewpoint.radius, size: Math.max(def.size[0], def.size[1]), blockers, walkable: shell.walkable })
      : findViewpoint({ focus: b.focus, front, distance, blockers, ignore, walkable: shell.walkable })
        ?? findViewpoint({ focus: b.focus, front, distance, blockers, ignore, walkable: shell.walkable, maxDistance: 3.0 })
    if (!view) warnings.push({ severity: 'error', where: where(b.placement.id), message: 'no clear viewpoint found; the seat is used instead' })
    const viewpoint = view ?? { position: seatPos.clone(), target: b.focus.clone() }
    const narrowed = b.placement.activities?.filter((a) => def.activities.includes(a))
    const photo = b.photo
    let personalOverride: boolean | null = null
    const obj: SceneObject = {
      id: b.placement.id,
      assetId: def.id,
      category: def.category,
      label: '',
      description: '',
      object: b.object,
      focus: b.focus,
      viewpoint,
      activities: narrowed && narrowed.length ? narrowed : [...def.activities],
      photoSurface: photo,
      imageId: b.placement.image,
      get personal(): boolean { return personalOverride ?? photo?.showing === 'personal' },
      set personal(value: boolean) { personalOverride = value },
      soundId: def.soundId,
      highlight: b.placement.highlight ?? false,
      topics: [...(def.tags?.topics ?? [])]
    }
    objects.push(obj)
  }

  const applyLabels = (i18n: I18n, over: ObjectOverrides = {}): void => {
    objects.forEach((obj, i) => {
      const b = built[i]
      const o = over[obj.id]
      obj.label = o?.label?.trim() ? o.label : i18n.text(b.placement.label ?? b.def.label, b.def.id)
      obj.description = o?.description?.trim() ? o.description : i18n.text(b.placement.description ?? b.def.description, '')
      for (const t of b.texts) t.draw(textInput(b.def, i18n))
    })
  }
  applyLabels(options.i18n, overrides)

  // ---- animation: clock hands follow the time; the fan turns slowly and steadily
  const hands: { hour: THREE.Object3D | null; minute: THREE.Object3D | null }[] = []
  const rotors: { node: THREE.Object3D; spin: number }[] = []
  root.traverse((node) => {
    if (node.name === 'rotor') rotors.push({ node, spin: Number(node.userData.spin) || 0.9 })
  })
  for (const b of built) {
    const hour = b.object.getObjectByName('hand-hour') ?? null
    const minute = b.object.getObjectByName('hand-minute') ?? null
    if (hour || minute) hands.push({ hour, minute })
  }
  const setHands = (): void => {
    const t = new Date()
    const minutes = t.getMinutes() + t.getSeconds() / 60
    const hours = (t.getHours() % 12) + minutes / 60
    for (const h of hands) {
      if (h.hour) h.hour.rotation.z = -(hours / 12) * Math.PI * 2
      if (h.minute) h.minute.rotation.z = -(minutes / 60) * Math.PI * 2
    }
  }
  setHands()

  // ---- where sound would come from
  const radio = objects.find((o) => /^radio-/.test(o.assetId)) ?? objects.find((o) => o.category === 'music-media')
  let audioAnchor: THREE.Object3D
  if (radio) audioAnchor = radio.object
  else {
    audioAnchor = new THREE.Object3D()
    audioAnchor.name = 'audio-anchor'
    audioAnchor.position.set(shell.centre.x, 1.2, shell.centre.z)
    root.add(audioAnchor)
  }

  // ---- whatever the shell loads in the background (a photo room's photograph and light)
  if (shell.ready) await shell.ready
  for (const message of shell.problems ?? []) warnings.push({ severity: 'warning', where: where('shell'), message })

  // ---- numbers
  const usedTextures = new Set<THREE.Texture>()
  let triangles = 0, meshes = 0
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) return
    meshes++
    const g = mesh.geometry
    triangles += g.index ? g.index.count / 3 : g.attributes.position.count / 3
    const m = mesh.material as THREE.MeshStandardMaterial
    for (const t of [m.map, m.normalMap, m.roughnessMap]) if (t) usedTextures.add(t)
  })
  let kb = shell.extraTextureKB?.() ?? 0
  for (const t of usedTextures) {
    const img = t.image as { width?: number; height?: number } | undefined
    // A texture without mipmaps (a photo room's backdrop) is its base level alone.
    if (img?.width && img?.height) kb += t.generateMipmaps === false ? (img.width * img.height * 4) / 1024 : textureKB(img.width, img.height)
  }
  // Sets that ended up unused are released straight away.
  const keptSets: TextureSetName[] = []
  for (const name of acquiredSets) {
    const set = sets.get(name)
    if (set && (usedTextures.has(set.map) || usedTextures.has(set.normalMap))) keptSets.push(name)
    else textureStore.release(name)
  }
  report.objectCount = objects.length
  report.triangles = Math.round(triangles)
  report.meshes = meshes
  report.textureKB = Math.round(kb)
  report.buildMs = Math.round(now() - started)

  const dispose = (): void => {
    if (disposed) return
    disposed = true
    root.removeFromParent()
    for (const key of protoKeys) releasePrototype(key)
    for (const key of gltfKeys) releaseGltf(key)
    for (const b of built) {
      b.photo?.dispose()
      for (const t of b.texts) t.dispose()
    }
    for (const g of shell.geometries) g.dispose()
    for (const { geometry, material } of hotspotResources) { geometry.dispose(); material.dispose() }
    shellLease.releaseAll()
    for (const light of shell.lights) (light as THREE.Light & { dispose?: () => void }).dispose?.()
    shell.dispose?.()
    unitPlane.dispose()
    floorQuad?.dispose()
    contact?.alphaMap?.dispose()
    contact?.dispose()
    for (const t of ownedTextures) t.dispose()
    for (const name of keptSets) textureStore.release(name)
  }

  const scene: SuiteScene = {
    packId: pack.meta.id,
    environmentId,
    shell: preset.shell,
    root,
    blockers,
    walkable: shell.walkable,
    spawn: shell.spawn,
    seat: shell.seat,
    ...(shellDef.photo ? { roomContextImageUrl: suiteUrl(shellDef.photo.panorama.display) } : {}),
    objects,
    audioAnchor,
    ...(shell.environment ? { environment: shell.environment } : {}),
    report,
    relabel: applyLabels,
    update(dt: number) {
      if (hands.length) setHands()
      for (const r of rotors) r.node.rotation.y += r.spin * Math.min(dt, 0.1)
    },
    dispose
  }
  return scene
}

/** Convenience for tools: the pack's environment ids. */
export function environmentIds(pack: LoadedContentPack): string[] {
  return pack.environments.map((e) => e.id)
}
