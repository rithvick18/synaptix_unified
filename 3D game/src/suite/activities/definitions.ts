/**
 * The five reminiscence activities. Every one is open-ended: nothing is graded, nothing
 * is timed, and a prompt is always optional text — no answer, microphone or recall is
 * needed to move on.
 *
 * Personal and demo content never mix: a saved profile's photo and sequence activities
 * use only the caregiver's photographs; demo pictures appear only in the generic demo.
 */
import type {
  ActivityContext,
  ActivityDefinition,
  ActivityItem,
  ActivityKind,
  ActivityRegistry,
  AssignPhotos,
  DisplayPhoto,
  DisplaySound,
  SceneObject
} from '../contracts'
import { PromptPicker, touchesAvoided } from '../content/prompts'

type Availability = { ok: true } | { ok: false; reasonKey: string }
const OK: Availability = { ok: true }
const no = (key: string): Availability => ({ ok: false, reasonKey: `activities.unavailable.${key}` })

/** How many highlighted objects the demo's default guided sequence visits. */
export const DEMO_SEQUENCE_OBJECTS = 3
/** Objects in the room tour when nothing is highlighted. */
export const SPACE_TOUR_FALLBACK = 6

export const avoidOf = (ctx: ActivityContext): readonly string[] => ctx.profile?.topics.avoid ?? []
export const pickerFor = (ctx: ActivityContext): PromptPicker =>
  new PromptPicker(ctx.pack, ctx.i18n, avoidOf(ctx), ctx.profile?.topics.include ?? [])

// ---------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------

export function objectItem(ctx: ActivityContext, obj: SceneObject, activity: ActivityKind, picker: PromptPicker): ActivityItem {
  const caregiver = ctx.profile?.objectPrompt(ctx.pack.meta.id, ctx.scene.environmentId, obj.id) ?? null
  return {
    id: `object:${obj.id}`,
    kind: 'object',
    objectId: obj.id,
    title: obj.label,
    personal: obj.personal,
    prompt: caregiver ?? picker.pick({ activity, itemKind: 'object', assetIds: [obj.assetId], category: obj.category })
  }
}

export function photoItem(ctx: ActivityContext, photo: DisplayPhoto, activity: ActivityKind, picker: PromptPicker, objectId?: string): ActivityItem {
  const fallbackTitle = ctx.i18n.t(photo.personal ? 'activities.kinds.personalPhoto' : 'activities.kinds.demoPhoto')
  return {
    id: `photo:${photo.id}`,
    kind: 'photo',
    photo,
    objectId,
    title: photo.caption.trim() || fallbackTitle,
    personal: photo.personal,
    prompt: photo.prompt ?? picker.pick({ activity, itemKind: 'photo', topics: photo.topics })
  }
}

export function soundItem(ctx: ActivityContext, sound: DisplaySound, activity: ActivityKind, picker: PromptPicker): ActivityItem {
  // A pack sound may belong to an object in the room (a clock's tick): its asset prompts apply.
  const linked = sound.personal ? [] : ctx.scene.objects.filter((o) => o.soundId === sound.id)
  return {
    id: `sound:${sound.personal ? 'personal' : 'pack'}:${sound.id}`,
    kind: 'sound',
    sound,
    objectId: linked[0]?.id,
    title: sound.title,
    personal: sound.personal,
    prompt:
      sound.prompt ??
      picker.pick({
        activity,
        itemKind: 'sound',
        assetIds: linked.map((o) => o.assetId),
        topics: sound.topics,
        voiceMessage: sound.kind === 'voice-message'
      })
  }
}

export function spaceItem(ctx: ActivityContext, picker: PromptPicker): ActivityItem {
  return {
    id: 'space:overview',
    kind: 'space',
    title: ctx.i18n.t('activities.space.overviewTitle'),
    personal: false,
    prompt: picker.pick({ activity: 'space', itemKind: 'space' })
  }
}

/** Makes item ids unique when a sequence lists the same thing twice. */
function uniqueIds(items: ActivityItem[]): ActivityItem[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    const n = (seen.get(item.id) ?? 0) + 1
    seen.set(item.id, n)
    return n === 1 ? item : { ...item, id: `${item.id}#${n}` }
  })
}

// ---------------------------------------------------------------------------------------
// What each activity may use
// ---------------------------------------------------------------------------------------

const usableObjects = (ctx: ActivityContext, activity: ActivityKind): SceneObject[] =>
  ctx.scene.objects.filter((o) => o.activities.includes(activity) && !touchesAvoided(o.topics, avoidOf(ctx)))

/** Personal photos for a saved profile; demo pictures only for the generic demo. */
const usablePhotos = (ctx: ActivityContext): DisplayPhoto[] =>
  (ctx.profile ? ctx.profile.photos : ctx.demoPhotos).filter((p) => !touchesAvoided(p.topics, avoidOf(ctx)))

const usableSounds = (ctx: ActivityContext): DisplaySound[] =>
  [...(ctx.profile?.sounds ?? []), ...ctx.packSounds].filter((s) => !touchesAvoided(s.topics, avoidOf(ctx)))

const highlighted = (ctx: ActivityContext): SceneObject[] =>
  ctx.scene.objects.filter((o) => o.highlight && !touchesAvoided(o.topics, avoidOf(ctx)))

/** Where each photo is shown in the room: its demo placement, or the assigned surface. */
function photoSurfaces(ctx: ActivityContext, photos: readonly DisplayPhoto[]): Map<string, string> {
  const byPhoto = new Map<string, string>()
  if (!ctx.profile) {
    for (const p of photos) {
      const obj = ctx.scene.objects.find((o) => o.imageId === p.id)
      if (obj) byPhoto.set(p.id, obj.id)
    }
  }
  const unplaced = photos.filter((p) => !byPhoto.has(p.id))
  const taken = new Set(byPhoto.values())
  for (const [objectId, photo] of assignPhotos({ ...ctx.scene, objects: ctx.scene.objects.filter((o) => !taken.has(o.id)) }, unplaced)) {
    byPhoto.set(photo.id, objectId)
  }
  return byPhoto
}

function spaceTour(ctx: ActivityContext): SceneObject[] {
  const marked = highlighted(ctx)
  return marked.length > 0 ? marked : usableObjects(ctx, 'space').slice(0, SPACE_TOUR_FALLBACK)
}

function demoSequence(ctx: ActivityContext, picker: PromptPicker): ActivityItem[] {
  const objects = highlighted(ctx).filter((o) => o.activities.includes('object') || o.activities.includes('sequence'))
  for (const o of usableObjects(ctx, 'object')) if (!objects.includes(o)) objects.push(o)
  const chosen = objects.slice(0, DEMO_SEQUENCE_OBJECTS)
  const photo = usablePhotos(ctx)[0]
  const sounds = usableSounds(ctx)
  const sound = sounds.find((s) => ctx.scene.objects.some((o) => o.soundId === s.id)) ?? sounds[0]
  const items: ActivityItem[] = chosen.slice(0, 2).map((o) => objectItem(ctx, o, 'sequence', picker))
  if (photo) items.push(photoItem(ctx, photo, 'sequence', picker, photoSurfaces(ctx, [photo]).get(photo.id)))
  for (const o of chosen.slice(2)) items.push(objectItem(ctx, o, 'sequence', picker))
  if (sound) items.push(soundItem(ctx, sound, 'sequence', picker))
  return items
}

function savedSequence(ctx: ActivityContext, picker: PromptPicker): ActivityItem[] {
  const profile = ctx.profile
  if (!profile) return []
  const avoid = avoidOf(ctx)
  const photos = profile.photos.filter((p) => !touchesAvoided(p.topics, avoid))
  const surfaces = photoSurfaces(ctx, photos)
  const items: ActivityItem[] = []
  for (const ref of profile.sequence) {
    if (ref.kind === 'photo') {
      const photo = photos.find((p) => p.id === ref.id)
      if (photo) items.push(photoItem(ctx, photo, 'sequence', picker, surfaces.get(photo.id)))
    } else if (ref.kind === 'object') {
      const slash = ref.id.indexOf('/')
      const envId = slash >= 0 ? ref.id.slice(0, slash) : ctx.scene.environmentId
      const placementId = slash >= 0 ? ref.id.slice(slash + 1) : ref.id
      if (envId !== ctx.scene.environmentId) continue // belongs to another room
      const obj = ctx.scene.objects.find((o) => o.id === placementId)
      if (obj && !touchesAvoided(obj.topics, avoid)) items.push(objectItem(ctx, obj, 'sequence', picker))
    } else {
      const sound = usableSounds(ctx).find((s) => s.id === ref.id && s.personal) ?? usableSounds(ctx).find((s) => s.id === ref.id)
      if (sound) items.push(soundItem(ctx, sound, 'sequence', picker))
    }
  }
  return items
}

// ---------------------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------------------

const define = (
  kind: ActivityKind,
  available: (ctx: ActivityContext) => Availability,
  items: (ctx: ActivityContext) => ActivityItem[]
): ActivityDefinition => ({
  kind,
  nameKey: `activities.names.${kind}`,
  descriptionKey: `activities.descriptions.${kind}`,
  answerMode: 'open-ended',
  available,
  items: (ctx) => uniqueIds(items(ctx))
})

export const ACTIVITIES: ActivityRegistry = {
  photo: define(
    'photo',
    (ctx) => {
      if (!ctx.profile) return ctx.demoPhotos.length > 0 ? (usablePhotos(ctx).length > 0 ? OK : no('photosAvoided')) : no('noDemoPictures')
      if (ctx.profile.photos.length === 0) return no('noPhotos')
      return usablePhotos(ctx).length > 0 ? OK : no('photosAvoided')
    },
    (ctx) => {
      const picker = pickerFor(ctx)
      const photos = usablePhotos(ctx)
      const surfaces = photoSurfaces(ctx, photos)
      return photos.map((p) => photoItem(ctx, p, 'photo', picker, surfaces.get(p.id)))
    }
  ),
  object: define(
    'object',
    (ctx) => (usableObjects(ctx, 'object').length > 0 ? OK : no('noObjects')),
    (ctx) => {
      const picker = pickerFor(ctx)
      return usableObjects(ctx, 'object').map((o) => objectItem(ctx, o, 'object', picker))
    }
  ),
  sound: define(
    'sound',
    (ctx) => (usableSounds(ctx).length > 0 ? OK : no('noSounds')),
    (ctx) => {
      const picker = pickerFor(ctx)
      return usableSounds(ctx).map((s) => soundItem(ctx, s, 'sound', picker))
    }
  ),
  space: define(
    'space',
    () => OK,
    (ctx) => {
      const picker = pickerFor(ctx)
      return [spaceItem(ctx, picker), ...spaceTour(ctx).map((o) => objectItem(ctx, o, 'space', picker))]
    }
  ),
  sequence: define(
    'sequence',
    (ctx) => {
      if (!ctx.profile) return demoSequence(ctx, pickerFor(ctx)).length > 0 ? OK : no('noObjects')
      if (ctx.profile.sequence.length === 0) return no('noSequence')
      return savedSequence(ctx, pickerFor(ctx)).length > 0 ? OK : no('sequenceUnresolved')
    },
    (ctx) => (ctx.profile ? savedSequence(ctx, pickerFor(ctx)) : demoSequence(ctx, pickerFor(ctx)))
  )
}

// ---------------------------------------------------------------------------------------
// Photo surfaces
// ---------------------------------------------------------------------------------------

const isFrame = (o: SceneObject): boolean => /frame/.test(o.assetId)
const isAlbum = (o: SceneObject): boolean => /album/.test(o.assetId)

/**
 * Which photo each photo-surface object shows. A photo's `preferredSurface` wins when that
 * object exists and is free; the rest fill frames, then albums, then any other photo
 * surface, each in placement order. A photo appears at most once; surfaces left over are
 * not in the map (the app shows them as a plain mat in a personal session).
 */
export const assignPhotos: AssignPhotos = (scene, photos) => {
  const map = new Map<string, DisplayPhoto>()
  const placed = new Set<string>()
  const surfaces = scene.objects.filter((o) => o.photoSurface)
  for (const photo of photos) {
    if (!photo.preferredSurface || placed.has(photo.id)) continue
    const obj = surfaces.find((o) => o.id === photo.preferredSurface)
    if (obj && !map.has(obj.id)) {
      map.set(obj.id, photo)
      placed.add(photo.id)
    }
  }
  const rank = (o: SceneObject): number => (isFrame(o) ? 0 : isAlbum(o) ? 1 : 2)
  const order = surfaces
    .map((o, i) => ({ o, i }))
    .sort((a, b) => rank(a.o) - rank(b.o) || a.i - b.i)
    .map((x) => x.o)
  const queue = photos.filter((p, i) => !placed.has(p.id) && photos.findIndex((q) => q.id === p.id) === i)
  for (const obj of order) {
    if (map.has(obj.id)) continue
    const next = queue.shift()
    if (!next) break
    map.set(obj.id, next)
  }
  return map
}
