/**
 * Reminiscence Therapy Suite — shared contracts.
 *
 * "Reminiscence Therapy Suite" is product branding for an activity space: exploring
 * familiar places, objects, sounds and personal memories, with a caregiver. It is not a
 * medical treatment, it diagnoses nothing, and nothing here claims an outcome.
 *
 * Every module under src/suite/ builds against these types. They are owned by the
 * integration layer: a module that needs a change here asks for it rather than editing
 * this file, so five parallel pieces of work cannot drift apart.
 *
 *   assets/        asset library: manifest loading, procedural builders, textures, glTF
 *   environments/  starter environment shells and the scene builder
 *   content/       content-pack loading and validation, prompts
 *   activities/    activity definitions, the activity session, the factual summary
 *   i18n/          language registry, string loading, fonts
 *   profile/       caregiver configuration, personal media, the caregiver editor
 *   app/           suite navigation, screens, controls, audio, accessibility, vision status
 *
 * Hard rules every module keeps:
 *
 * 1. Nothing is scored. Reminiscence items have no correct answer, no outcome, no
 *    timer and no tally. The only scored tasks are the existing guided tasks
 *    (MissionRunner), which stay separate and are labelled as having known answers.
 * 2. Nothing is invented about a person. Names, relationships, captions, dates and
 *    places come only from what a caregiver typed. Generic prompts are open questions
 *    ("Would you like to tell us about this?") and never assume a region, religion,
 *    language, household or history.
 * 3. Demo content is always visibly labelled as demo content; personal content is only
 *    ever what a caregiver supplied.
 * 4. Familiarity is never inferred from a state, name, language or appearance. Regional
 *    packs are chosen explicitly and are never a default.
 * 5. Camera observations only ever affect presentation timing (holding a new prompt's
 *    speech, one gentle re-offer). A neutral face, looking away, silence or lost
 *    tracking is never read as failed recall or a clinical state.
 */
import type * as THREE from 'three'
import type { AdaptationRecord } from '../camera/AdaptationPolicy'
import type { AdaptableRunner, CameraSnapshot } from '../camera/types'
import type { LocalProfile, Photo } from '../LocalProfile'

// ===========================================================================================
// Localization
// ===========================================================================================

/** BCP-47 primary language subtag: 'en', 'hi', 'as', 'bn', 'ta', … */
export type LanguageCode = string

/**
 * Text that may exist in several languages. A plain string is language-neutral — for
 * example a caregiver's own words, shown exactly as typed. Resolution order is the active
 * language, then English, then the first entry present.
 */
export type LocalizedText = string | Partial<Record<LanguageCode, string>>

export type TranslationStatus =
  /** The language the strings were written in. */
  | 'source'
  /** Checked by a fluent human reviewer. */
  | 'human-reviewed'
  /** Written or generated without fluent human review. Shown as such in the UI. */
  | 'machine-generated-needs-review'

/** One entry in public/suite/locales/index.json. */
export interface LanguageInfo {
  code: LanguageCode
  /** English name, e.g. "Hindi". */
  name: string
  /** Name in its own script, e.g. "हिन्दी". */
  nativeName: string
  /** ISO 15924 script code: 'Latn', 'Deva', 'Beng', 'Taml', … */
  script: string
  dir: 'ltr' | 'rtl'
  /** Speech-synthesis language tag, e.g. 'hi-IN'. Speech is optional everywhere. */
  speechLang: string
  /** CSS font-family stack that covers the script. */
  fontFamily: string
  /** Font files to load before switching (paths relative to public/suite/). */
  fontFiles?: { family: string; path: string; weight?: string; style?: string }[]
  translation: TranslationStatus
  /** Fraction of UI keys present, per namespace, computed by the checks and recorded here. */
  coverage?: Record<string, number>
}

/** public/suite/locales/index.json */
export interface LocaleIndex {
  schema: 1
  /** The language every key exists in. Always 'en'. */
  fallback: LanguageCode
  /** String files per language: public/suite/locales/<code>/<namespace>.json */
  namespaces: string[]
  languages: LanguageInfo[]
}

export interface I18n {
  readonly language: LanguageCode
  readonly languages: readonly LanguageInfo[]
  /**
   * Looks up `namespace.key.path` (the first segment names the namespace file).
   * `{name}` placeholders are filled from `vars`. With a numeric `vars.count`, the keys
   * `<key>.one` / `<key>.other` are chosen with Intl.PluralRules when present.
   * Missing in the active language → English → the key itself (and a console warning).
   */
  t(key: string, vars?: Record<string, string | number>): string
  /** Resolves a LocalizedText in the active language (see LocalizedText). */
  text(value: LocalizedText | undefined, fallback?: string): string
  /** The language a resolved LocalizedText actually came from (for speech and `lang=`). */
  textLanguage(value: LocalizedText | undefined): LanguageCode
  info(code?: LanguageCode): LanguageInfo
  /** Loads the language's strings and fonts, then notifies listeners. */
  setLanguage(code: LanguageCode): Promise<void>
  onChange(listener: (code: LanguageCode) => void): () => void
}

// ===========================================================================================
// Provenance
// ===========================================================================================

/** Where an asset, sound, image, font or text came from, and on what terms. */
export interface Provenance {
  /** 'procedural' (built in code here), 'project-generated' (made by a script here),
   *  or the external source's name, e.g. 'Poly Haven'. */
  source: string
  author: string
  /** SPDX identifier: 'CC0-1.0', 'OFL-1.1', 'CC-BY-4.0', … Never 'unknown'. */
  license: string
  url?: string
  /** Exact attribution text where the license asks for one. */
  attribution?: string
  /** ISO date the external file was retrieved. */
  retrieved?: string
  /** What was changed from the original (resized, re-encoded, recoloured…). */
  modified?: string
}

// ===========================================================================================
// Loading
// ===========================================================================================

/** Loads JSON from a path relative to public/suite/ (e.g. 'packs/index.json'). The default
 *  (src/suite/paths.ts `fetchJson`) fetches; node checks inject one that reads the disk. */
export type JsonLoader = (pathFromSuiteRoot: string) => Promise<unknown>

/** The conversation-topic vocabulary for prompts, objects and caregiver include/avoid lists. */
export const TOPICS = [
  'family', 'home', 'food', 'childhood', 'school', 'work', 'travel', 'music', 'games',
  'nature', 'weather', 'community', 'festivals', 'faith'
] as const
export type Topic = (typeof TOPICS)[number]

// ===========================================================================================
// Activities (kinds are needed by assets and packs, so they are declared first)
// ===========================================================================================

export type ActivityKind = 'photo' | 'object' | 'sound' | 'space' | 'sequence'

export const ACTIVITY_KINDS: readonly ActivityKind[] = ['photo', 'object', 'sound', 'space', 'sequence']

// ===========================================================================================
// Asset library — public/suite/assets/manifest.json (+ optional pack-local assets.json)
// ===========================================================================================

export type AssetCategory =
  | 'photos-keepsakes'  // frames, albums, letters, postcards, calendars, clocks
  | 'furniture'         // seating, tables, beds, shelves
  | 'storage'           // cupboards, trunks, almirahs, boxes
  | 'textiles'          // mats, rugs, cushions, cloths
  | 'kitchen-food'      // utensils, vessels, containers, food-related objects
  | 'plants-outdoor'    // courtyard, veranda, garden, household plants
  | 'music-media'       // radios, instruments, players
  | 'school-work'       // books, slates, tools, sewing machine
  | 'travel'            // luggage, bicycles, tickets
  | 'hobbies-games'     // games, crafts, sport
  | 'community'         // newspapers, notices, shared-life objects
  | 'lighting'
  | 'decor'

/** How an asset sits in a room; each shell slot accepts one kind. */
export type MountKind = 'floor' | 'wall' | 'surface'

export type AssetSource =
  /** An object already present in a captured room; its shell supplies an interaction hotspot. */
  | { kind: 'photograph' }
  /** `builder` is a key in the procedural builder registry (src/suite/assets/). */
  | { kind: 'procedural'; builder: string; params?: Record<string, number | string | boolean> }
  /** A packaged .glb, path relative to the manifest's directory. `scale` is uniform, or
   *  per axis to meet a host height exactly (at most a few percent off uniform). */
  | { kind: 'gltf'; path: string; scale?: number | [number, number, number]; yaw?: number }

export interface AssetDef {
  id: string
  category: AssetCategory
  mount: MountKind
  source: AssetSource
  /** Relative to the manifest's directory. Small (≤ 256 px, ≤ 40 KB), PNG or WebP. */
  thumbnail: string
  label: LocalizedText
  /** Neutral and factual: what the object is and is used for. No assumed memories. */
  description: LocalizedText
  tags?: {
    /** e.g. 'northeast', 'assam'. Non-empty only with `descriptionSources`. */
    regions?: string[]
    languages?: LanguageCode[]
    /** e.g. 'kitchen', 'courtyard', 'school', 'work', 'travel', 'music'. */
    contexts?: string[]
    /** Conversation topics this object may touch; used by caregiver avoid-lists. */
    topics?: string[]
  }
  /** Required when `tags.regions` is non-empty: where the description was checked. */
  descriptionSources?: string[]
  /** Built size in metres [width x, height y, depth z], origin at the base centre. */
  size: [number, number, number]
  /** Adds a collision box of `size` (floor assets normally do; small surface items don't). */
  collision: boolean
  /** Local point to look at when viewing it; defaults to the bounding-box centre. */
  focus?: [number, number, number]
  /** Comfortable viewing distance in metres; defaults from `size`. */
  viewDistance?: number
  /** Which activities can use it. */
  activities: ActivityKind[]
  /** Frames, albums, postcards: the area a photograph or picture is shown on. */
  photoSurface?: {
    /** Display area in metres. */
    width: number
    height: number
    /** Centre of the display area in the asset's local space. */
    at: [number, number, number]
    /** Local axis the picture faces. */
    facing: '+x' | '-x' | '+z' | '-z' | '+y'
  }
  /** Shared sound (content pack `SoundDef.id`) naturally associated with the object. */
  soundId?: string
  /** Text drawn at runtime in the active language (calendar month, book spine…), never
   *  baked into a texture. Keys are i18n keys or LocalizedText literals. */
  runtimeText?: { slot: string; text: LocalizedText }[]
  provenance: Provenance
  /** Asset id used when this one fails to load or build. Must itself be procedural. */
  fallback?: string
  budget: { triangles: number; textureKB: number }
  /** 'lazy' assets are built only when their environment is built (the default). */
  load?: 'eager' | 'lazy'
}

export interface AssetManifest {
  schema: 1
  assets: AssetDef[]
}

export interface ContentProblem {
  severity: 'error' | 'warning'
  /** e.g. 'assets/manifest.json#clock-wall' or 'packs/everyday-home/environments.json#living-room/clock'. */
  where: string
  message: string
}

export interface AssetLibrary {
  get(id: string): AssetDef | undefined
  all(): readonly AssetDef[]
  /** Absolute URL for a path relative to the library (or to `base`, for pack-local assets). */
  url(path: string, base?: string): string
  /** Pack-local assets are added with their pack's base URL. */
  addPackAssets(defs: AssetDef[], base: string): ContentProblem[]
  readonly problems: readonly ContentProblem[]
}

// ===========================================================================================
// Content packs — public/suite/packs/index.json and public/suite/packs/<id>/
//
//   pack.json          metadata and file list          (integration layer)
//   environments.json  environment presets / dressing  (environment and assets)
//   content.json       prompts, sounds, images         (activities and content)
//   assets.json        optional pack-local AssetDefs   (environment and assets)
// ===========================================================================================

export interface ContentPackIndex {
  schema: 1
  /** Paths relative to public/suite/packs/. The first non-regional pack is the default. */
  packs: { id: string; path: string }[]
}

export interface ContentPackMeta {
  schema: 1
  id: string
  name: LocalizedText
  description: LocalizedText
  /** 'starter': complete and checked. 'preview': incomplete; shown with a notice. */
  status: 'starter' | 'preview'
  /** True for region-specific packs. Never selected automatically. */
  regional: boolean
  /** An honest statement of what the pack covers and what it does not. */
  coverageNote: LocalizedText
  tags?: { regions?: string[]; languages?: LanguageCode[]; contexts?: string[] }
  files: { environments: string; content: string; assets?: string }
  authors: Provenance[]
}

export type ShellId = 'livingRoom' | 'kitchenDining' | 'courtyardVeranda' | 'photoLivingDemo' | 'photoCombination' | 'photoKiara' | 'photoChineseGarden' | 'photoGreenPointPark' | 'photoMondelloBeach'

export type FloorFinish = 'wood' | 'tile' | 'stone' | 'terrazzo' | 'red-oxide' | 'mud-plaster' | 'cement'

export interface ShellMaterials {
  /** CSS hex colours. */
  wall?: string
  trim?: string
  floor?: FloorFinish
  floorColour?: string
  accent?: string
  /** Interior light colour temperature. */
  light?: 'warm' | 'neutral' | 'cool'
}

/** A named place in a shell where one asset can stand, hang or sit. */
export interface ShellSlot {
  id: string
  mount: MountKind
  /** Base centre (floor/surface) or picture centre (wall), world metres. */
  position: [number, number, number]
  /** Radians about +Y; 0 faces +Z (toward the default viewer). */
  yaw: number
  /** Largest asset `size` that fits [w, h, d]. */
  maxSize: [number, number, number]
}

export interface ShellInfo {
  id: ShellId
  name: LocalizedText
  slots: readonly ShellSlot[]
}

export interface Placement {
  /** Instance id, unique within its environment. Becomes `SceneObject.id`. */
  id: string
  asset: string
  slot: string
  label?: LocalizedText
  description?: LocalizedText
  yaw?: number
  /** A DecorativeImageDef id shown on the asset's photo surface (demo/decor only). */
  image?: string
  /** Highlighted by default in space exploration. */
  highlight?: boolean
  /** Narrows the asset's own activity list. */
  activities?: ActivityKind[]
}

export interface EnvironmentPreset {
  id: string
  shell: ShellId
  name: LocalizedText
  description: LocalizedText
  /** Relative to the pack directory. */
  thumbnail?: string
  materials?: ShellMaterials
  placements: Placement[]
}

/** environments.json */
export interface PackEnvironments {
  schema: 1
  environments: EnvironmentPreset[]
}

/** Prerecorded prompt audio for one language. */
export interface AudioRef {
  lang: LanguageCode
  path: string
  transcript?: string
  provenance: Provenance
}

/** An open-ended conversation prompt. There is never an expected answer. */
export interface PromptDef {
  id: string
  appliesTo: { assets?: string[]; categories?: AssetCategory[]; activities?: ActivityKind[] }
  text: LocalizedText
  audio?: AudioRef[]
  /** Topics the prompt touches (e.g. 'food', 'school', 'work', 'travel', 'music',
   *  'family', 'faith', 'festivals'); a caregiver's avoid-list removes it. */
  topics?: string[]
}

export interface SoundDef {
  id: string
  label: LocalizedText
  description: LocalizedText
  /** Relative to the pack directory. */
  path: string
  mime: string
  durationMs: number
  loop?: boolean
  topics?: string[]
  /** True when made by a synthesis script rather than recorded. Shown to the caregiver. */
  synthesized: boolean
  provenance: Provenance
}

/** A picture used for decoration or the generic demo. Never a photograph of a real person
 *  or event, never presented as historical or as anyone's memory. */
export interface DecorativeImageDef {
  id: string
  /** Relative to the pack directory. */
  path: string
  width: number
  height: number
  alt: LocalizedText
  kind: 'decorative-generated' | 'decorative-licensed'
  /** Shown with the image, e.g. "Demo picture — an illustration, not a real memory". */
  notice: LocalizedText
  provenance: Provenance
}

/** content.json */
export interface PackContent {
  schema: 1
  prompts: PromptDef[]
  sounds: SoundDef[]
  images: DecorativeImageDef[]
}

export interface LoadedContentPack {
  meta: ContentPackMeta
  /** Absolute URL of the pack directory, ending in '/'. */
  baseUrl: string
  environments: EnvironmentPreset[]
  prompts: PromptDef[]
  sounds: SoundDef[]
  images: DecorativeImageDef[]
  assets: AssetDef[]
  problems: ContentProblem[]
}

// ===========================================================================================
// Built scenes
// ===========================================================================================

export interface PhotoSurface {
  readonly width: number
  readonly height: number
  /** Shows `texture` letterboxed inside the display area: never cropped, never stretched.
   *  The surface does not own `texture`; whoever made it disposes it. */
  show(texture: THREE.Texture, aspect: number): void
  /** A plain mat: used for frames with no personal photograph in a personal session, so a
   *  demo picture is never mistaken for a personal one. */
  blank(): void
  /** Back to the placement's own default: its decorative image, or a plain mat. */
  reset(): void
}

export interface SceneObject {
  /** The placement id. */
  id: string
  assetId: string
  category: AssetCategory
  /** Resolved in the active language, caregiver overrides applied. */
  label: string
  description: string
  object: THREE.Object3D
  /** World-space point to look at. */
  focus: THREE.Vector3
  /** A reachable, unobstructed place to view it from (eye height ~1.2 m seated, 1.6 m standing).
   *  `fov` (vertical degrees) is set in a photo room, which cannot be walked into: a closer
   *  look there is a narrower view from near the seat. Absent, the camera's own is used. */
  viewpoint: { position: THREE.Vector3; target: THREE.Vector3; fov?: number }
  activities: ActivityKind[]
  photoSurface: PhotoSurface | null
  /** The DecorativeImageDef id the placement shows by default, if any. */
  imageId?: string
  /** True while it shows caregiver-supplied content. */
  personal: boolean
  soundId?: string
  highlight: boolean
  topics: string[]
}

export interface SceneReport {
  packId: string
  environmentId: string
  objectCount: number
  missingAssets: string[]
  fallbacksUsed: { placement: string; asset: string; fallback: string }[]
  unknownSlots: string[]
  /** Placements dropped because the asset does not fit its slot. */
  rejectedPlacements: { placement: string; reason: string }[]
  triangles: number
  meshes: number
  textureKB: number
  buildMs: number
}

export interface SuiteScene {
  readonly packId: string
  readonly environmentId: string
  readonly shell: ShellId
  root: THREE.Group
  blockers: THREE.Box3[]
  /** Floor area the walking mode may use. */
  walkable: THREE.Box3
  spawn: { position: THREE.Vector3; yaw: number }
  /** Seated overview: a restful default view. */
  seat: { position: THREE.Vector3; target: THREE.Vector3; fov?: number }
  /** Original 360° room photograph for visual conversation in photographed environments. */
  roomContextImageUrl?: string
  objects: SceneObject[]
  /** Where non-positional audio would come from if spatialised (the radio, if any). */
  audioAnchor: THREE.Object3D
  /**
   * The light a photo room's objects are lit by: its own photograph in linear radiance.
   * Absent for the modelled rooms, whose reflections are captured from the room instead.
   */
  environment?: SceneEnvironment
  report: SceneReport
  /** Re-resolves labels and runtime text after a language change. */
  relabel(i18n: I18n, overrides?: ObjectOverrides): void
  /** Per-frame animation, e.g. a clock's hands. Optional and cheap. */
  update?(dt: number): void
  /** Frees every GPU resource this scene created. Shared cached resources are released
   *  by reference count, so building the same environment again does not refetch. */
  dispose(): void
}

/** An equirectangular HDR image that lights a scene (see SuiteHost.three.useEnvironment). */
export interface SceneEnvironment {
  /** Linear radiance, EquirectangularReflectionMapping. Owned by the scene; the host
   *  prefilters it and must not keep it. */
  map: THREE.Texture
  /** scene.environmentIntensity while the scene is on screen. */
  intensity: number
  /** Radians about +Y, the same turn as the photograph on screen. */
  rotation: number
}

/** Caregiver edits to one environment's objects, keyed by placement id. */
export type ObjectOverrides = Record<string, { label?: string; description?: string; hidden?: boolean }>

export interface BuildSceneOptions {
  pack: LoadedContentPack
  environmentId: string
  library: AssetLibrary
  i18n: I18n
  overrides?: ObjectOverrides
  /** Topics to leave out: objects tagged with any of them are not placed. */
  avoidTopics?: string[]
  anisotropy: number
  maxTextureSize: number
  /** 'low' on software rasterisers and small devices: no shadows, smaller textures. */
  quality: 'low' | 'standard'
  /** False under node checks: no texture or glTF downloads, flat materials, procedural
   *  fallbacks for glTF assets. Default true. */
  loadTextures?: boolean
  onProgress?: (done: number, total: number) => void
}

/** Implemented by src/suite/environments/index.ts. */
export type BuildSuiteScene = (options: BuildSceneOptions) => Promise<SuiteScene>

// ===========================================================================================
// Caregiver configuration — stored inside the existing LocalProfile (IndexedDB),
// as the optional `suite` field. Profiles saved before the suite existed have none.
// ===========================================================================================

export interface CaregiverAudio {
  blob: Blob
  mime: string
  durationMs: number
}

/** A prompt a caregiver wrote (and optionally recorded) for a photo, object or sound. */
export interface CaregiverPrompt {
  text: string
  /** The language the caregiver wrote it in. */
  lang: LanguageCode
  audio?: CaregiverAudio
}

export interface SuitePhoto {
  id: string
  /** The existing photo record: original kept, display derivatives generated. */
  photo: Photo
  caption: string
  /** Only names and relationships the caregiver typed. Never inferred. */
  people: { name: string; relationship: string }[]
  prompt?: CaregiverPrompt
  /** Preferred placement id to show it on, if any. */
  surface?: string
  topics?: string[]
}

export interface SuiteSound {
  id: string
  title: string
  kind: 'familiar-sound' | 'voice-message'
  audio: CaregiverAudio
  prompt?: CaregiverPrompt
  topics?: string[]
}

export type SequenceRef = { kind: 'photo' | 'object' | 'sound'; id: string }

export interface SuiteProfile {
  version: 1
  language: LanguageCode
  packId: string | null
  environmentId: string | null
  /** Keyed by `${packId}/${environmentId}`. */
  objects: Record<string, ObjectOverrides>
  /** Caregiver prompts for pack objects, keyed by `${packId}/${environmentId}/${placementId}`. */
  objectPrompts: Record<string, CaregiverPrompt>
  photos: SuitePhoto[]
  sounds: SuiteSound[]
  topics: { include: string[]; avoid: string[] }
  /** 'open': free exploration first; 'guided': the caregiver's sequence first. */
  mode: 'open' | 'guided'
  /** For the guided sequence activity. Photo ids, `${envId}/${placementId}`, sound ids. */
  sequence: SequenceRef[]
  /** Show the caregiver panel (notes, prompt list) by default. */
  caregiverAssist: boolean
}

// ===========================================================================================
// Resolved content for a session
// ===========================================================================================

export interface ResolvedPrompt {
  text: string
  lang: LanguageCode
  /** Prerecorded audio (caregiver recording or pack file), playable without speech synthesis. */
  audioUrl?: string
  source: 'caregiver' | 'pack' | 'generic'
}

export interface DisplayPhoto {
  id: string
  /** The display derivative (≤ 2048/4096 px) for the close-up view. Aspect preserved. */
  url: string
  thumbUrl: string
  /** The untouched original, when kept and viewable. */
  originalUrl?: string
  width: number
  height: number
  caption: string
  /** Caregiver-typed only. Empty for demo pictures. */
  people: { name: string; relationship: string }[]
  personal: boolean
  /** For demo/decorative pictures: the visible notice. */
  notice?: string
  prompt: ResolvedPrompt | null
  preferredSurface?: string
  topics: string[]
  /** An in-scene texture (≤ 1024 px long edge), cached; aspect = width / height. */
  texture(): Promise<THREE.Texture | null>
}

export interface DisplaySound {
  id: string
  url: string
  title: string
  description?: string
  durationMs?: number
  personal: boolean
  synthesized: boolean
  kind: 'familiar-sound' | 'voice-message'
  prompt: ResolvedPrompt | null
  topics: string[]
}

export interface ResolvedSuiteProfile {
  /** The LocalProfile id. */
  id: string
  name: string
  language: LanguageCode
  mode: 'open' | 'guided'
  packId: string | null
  environmentId: string | null
  topics: { include: string[]; avoid: string[] }
  sequence: SequenceRef[]
  caregiverAssist: boolean
  /** Suite photos plus the Personalise Home photos (portraits, wall and event photos). */
  photos: DisplayPhoto[]
  sounds: DisplaySound[]
  objectOverrides(packId: string, environmentId: string): ObjectOverrides
  objectPrompt(packId: string, environmentId: string, placementId: string): ResolvedPrompt | null
}

/** Owns every object URL and texture made for one resolved profile. */
export interface SuiteMediaApi {
  dispose(): void
}

// ===========================================================================================
// Audio — independent channels, no dependency on speech synthesis
// ===========================================================================================

export type AudioChannel = 'voice' | 'sounds'

export interface SuiteAudioApi {
  /** Recorded audio when present; otherwise speech synthesis when enabled and a voice
   *  exists for the language; otherwise nothing is spoken (the text is always shown). */
  playPrompt(prompt: ResolvedPrompt): Promise<'audio' | 'speech' | 'text-only'>
  playSound(sound: DisplaySound): Promise<boolean>
  stop(channel?: AudioChannel): void
  pause(): void
  resume(): void
  readonly playing: Readonly<Record<AudioChannel, boolean>>
  /** 0–1. */
  setVolume(channel: 'master' | AudioChannel, value: number): void
  setMuted(muted: boolean): void
  setSpeechEnabled(enabled: boolean): void
  speechAvailable(lang: LanguageCode): boolean
  onChange(listener: () => void): () => void
  dispose(): void
}

// ===========================================================================================
// Activities and sessions
// ===========================================================================================

interface ItemBase {
  /** Unique within the session. */
  id: string
  title: string
  prompt: ResolvedPrompt | null
  personal: boolean
  /** Scene object to bring into view / highlight, if any. */
  objectId?: string
}

export type ActivityItem =
  | (ItemBase & { kind: 'photo'; photo: DisplayPhoto })
  | (ItemBase & { kind: 'object'; objectId: string })
  | (ItemBase & { kind: 'sound'; sound: DisplaySound })
  | (ItemBase & { kind: 'space' })

export interface ActivityContext {
  scene: SuiteScene
  pack: LoadedContentPack
  /** Null for the generic demo. */
  profile: ResolvedSuiteProfile | null
  /** The pack's demo pictures: used only in the generic demo (`profile` null), never to
   *  fill a personal session. */
  demoPhotos: DisplayPhoto[]
  /** The pack's sounds: offered in every session, labelled as pack sounds (synthesized). */
  packSounds: DisplaySound[]
  i18n: I18n
}

export interface ActivityDefinition {
  kind: ActivityKind
  /** i18n keys. */
  nameKey: string
  descriptionKey: string
  /** Reminiscence is always open-ended: nothing is graded. */
  answerMode: 'open-ended'
  available(ctx: ActivityContext): { ok: true } | { ok: false; reasonKey: string }
  items(ctx: ActivityContext): ActivityItem[]
}

/** Every entry of the factual session log. `t` is ms since start, pauses excluded. */
export type SessionEvent =
  | { t: number; kind: 'session_start'; activity: ActivityKind; packId: string; environmentId: string; profile: 'saved' | 'demo'; language: LanguageCode }
  | { t: number; kind: 'item_shown'; itemId: string; itemKind: ActivityItem['kind']; objectId?: string }
  | { t: number; kind: 'prompt_played'; itemId: string; via: 'audio' | 'speech' | 'text-only' }
  | { t: number; kind: 'prompt_replayed'; itemId: string }
  | { t: number; kind: 'sound_played' | 'sound_stopped'; itemId: string }
  | { t: number; kind: 'item_skipped'; itemId: string }
  | { t: number; kind: 'object_selected'; objectId: string }
  | { t: number; kind: 'closeup_opened' | 'closeup_closed'; itemId: string }
  | { t: number; kind: 'paused' | 'resumed' }
  | { t: number; kind: 'caregiver_note'; itemId?: string; text: string }
  /** A gentle re-offer the camera timing support asked for and the session showed. */
  | { t: number; kind: 'gentle_cue'; itemId: string }
  | { t: number; kind: 'session_end'; reason: 'finished' | 'exited' }

/** The events the session sends on to the camera service (via main's Telemetry). */
export interface SuiteTelemetryPort {
  missionStart(id: string): void
  missionComplete(id: string): void
  stepStart(step: number, type: string): void
  /** Reminiscence items always end as 'skipped' at the service boundary: the service has
   *  no neutral "ended" outcome, and nothing reads it as a result. */
  stepEnd(step: number, type: string, outcome: 'skipped'): void
  pause(): void
  resume(): void
}

export interface ActivitySessionOptions {
  definition: ActivityDefinition
  context: ActivityContext
  audio: SuiteAudioApi
  telemetry: SuiteTelemetryPort
  /** Monotonic ms clock; defaults to performance.now. Injected by checks. */
  now?: () => number
}

export interface ActivitySessionApi {
  readonly activity: ActivityKind
  readonly items: readonly ActivityItem[]
  /** -1 before start and during free exploration. */
  readonly index: number
  readonly current: ActivityItem | null
  readonly started: boolean
  readonly paused: boolean
  readonly ended: boolean
  readonly log: readonly SessionEvent[]
  /** Narrow camera surface: gentle cue and prompt hold only; requestHint() always false.
   *  During free exploration `index` is -1 while `adaptable.stepIndex` is
   *  `items.length + n`: the open service task, so task ids stay distinct. */
  readonly adaptable: AdaptableRunner
  start(): void
  /** Moves on without recording a skip (the person is done with this item). */
  next(): void
  previous(): void
  /** Moves on and records a skip. Never penalised, never counted against anyone. */
  skip(): void
  goTo(itemId: string): void
  replayPrompt(): void
  playSound(): void
  stopSound(): void
  pause(): void
  resume(): void
  /** Free exploration: a person chose an object themselves. */
  selectObject(objectId: string): void
  noteCloseup(open: boolean): void
  addNote(text: string, itemId?: string): void
  /** Ends early; the summary says so plainly. */
  exit(): SessionSummary
  /** Ends after the last item. */
  finish(): SessionSummary
  onChange(listener: () => void): () => void
}

/** Observable activity only. No scores, no judgement, no clinical language. */
export interface SessionSummary {
  activity: ActivityKind
  packId: string
  environmentId: string
  profile: 'saved' | 'demo'
  language: LanguageCode
  startedAt: string
  /** Pauses excluded. */
  durationMs: number
  pausedMs: number
  endedBy: 'finished' | 'exited'
  itemsShown: { id: string; title: string; kind: ActivityItem['kind']; personal: boolean }[]
  objectsVisited: { id: string; label: string }[]
  promptsPlayed: number
  promptsReplayed: number
  soundsPlayed: number
  skips: number
  closeups: number
  caregiverNotes: { t: number; itemId?: string; text: string }[]
  /** Kept separate from everything above. Null when the camera was not used. */
  vision: VisionSessionNote | null
}

export interface VisionSessionNote {
  /** Always shown with the numbers: they describe camera tracking, not the person. */
  label: string
  gentleCuesShown: number
  promptSpeechHeld: number
  /** Share of sampled seconds with fresh, calibrated, valid tracking (heuristic). Null if unmeasured. */
  trackingAvailableShare: number | null
  samples: number
}

// ===========================================================================================
// The host — what main.ts gives the suite
// ===========================================================================================

export interface SuiteCameraPort {
  attach(runner: AdaptableRunner | null): void
  openSetup(): void
  summary(): { on: boolean; status: string | null }
  snapshot(): CameraSnapshot
  adaptations(): readonly AdaptationRecord[]
}

/** The subset of State the suite drives. 'exploring' while an activity runs (camera
 *  policy needs active gameplay), 'paused' while paused, 'completed' elsewhere. */
export interface SuiteStatePort {
  readonly current: 'exploring' | 'answering' | 'paused' | 'completed'
  set(next: 'exploring' | 'completed'): void
  pause(): void
  resume(): void
  resetTimers(): void
}

export interface SuiteHost {
  /** The page root (#app). The suite adds its own layers inside it. */
  root: HTMLElement
  three: {
    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer
    refreshShadows(): void
    /** Lights reflections from the room now on screen, seen from `at` (Renderer.ts).
     *  Optional: without it, reflections come from the house's HDRI. */
    captureEnvironment?(at: THREE.Vector3): void
    /** Lights the scene with `environment` alone while the room is on screen: the house's
     *  own lights step aside, because the photograph already holds all of the room's light.
     *  Optional: without it, a photo room falls back to `captureEnvironment`. */
    useEnvironment?(environment: SceneEnvironment): void
  }
  listener: THREE.AudioListener
  state: SuiteStatePort
  telemetry: SuiteTelemetryPort
  camera: SuiteCameraPort
  quality: { tier: 'software' | 'baseline' | 'full'; anisotropy: number; maxTextureSize: number }
  /** The saved caregiver profile as read at boot, if any. */
  profile: { saved: LocalProfile | undefined; storageWarning: string }
  /** Optional, consent-gated picture conversation supplied by the app shell. */
  answerAboutPicture?(request: { imageUrl: string; question: string; history: readonly { role: 'user' | 'assistant'; text: string }[]; imageContext?: 'room' | 'picture' }): Promise<string>
  /** Local faster-whisper transcription of a recorded question (tools/stt/server.py). */
  transcribeSpeech?(audio: Blob, language?: string): Promise<string>
  openAiSetup?(mode?: 'offline' | 'online'): void
  /** Current caregiver setup mode for the home screen. */
  aiSetupMode?: 'offline' | 'online' | null
  /** Hands the screen to the suite (true) or back to the house and guided tasks (false):
   *  hides/shows the house, stops the house loop's player and interaction. */
  setActive(active: boolean): void
  /** Opens the existing guided tasks (level list: tasks with caregiver-set answers). */
  openGuidedTasks(): void
  /** Opens the existing Personalise Home editor (portraits, layout, recall questions). */
  openHomePersonalisation(): void
}

export interface SuiteAppApi {
  readonly active: boolean
  /** The first screen: profile, language, settings, caregiver setup, guided tasks. */
  showHome(): void
  /** Per frame, from main's loop, only while active. */
  update(dt: number): void
  /** window.__memoria.suite */
  readonly debug: Record<string, unknown>
}

/** Implemented by src/suite/app/index.ts. */
export type CreateSuiteApp = (host: SuiteHost) => SuiteAppApi

// ===========================================================================================
// Module entry points — each module exports exactly these names from its index.ts
// ===========================================================================================

/** src/suite/assets/index.ts → `loadAssetLibrary` */
export type LoadAssetLibrary = (load?: JsonLoader) => Promise<AssetLibrary>

/** src/suite/content/index.ts → `loadContentPacks`. Packs with errors are still returned
 *  (with `problems`) so a caregiver can see why; the app offers only error-free packs. */
export type LoadContentPacks = (
  library: AssetLibrary,
  load?: JsonLoader,
  /** When given, placements are checked against the shells' slot ids and mounts. */
  options?: { shells?: Partial<Record<ShellId, readonly { id: string; mount: MountKind }[]>> }
) => Promise<{ packs: LoadedContentPack[]; problems: ContentProblem[] }>

/** src/suite/content/index.ts → `packDisplayMedia`: the pack's demo pictures and sounds. */
export type PackDisplayMedia = (
  pack: LoadedContentPack,
  i18n: I18n
) => { demoPhotos: DisplayPhoto[]; packSounds: DisplaySound[]; dispose(): void }

/** src/suite/i18n/index.ts → `loadI18n` */
export type LoadI18n = (options?: { initial?: LanguageCode; load?: JsonLoader }) => Promise<I18n>

/** src/suite/activities/index.ts → `ACTIVITIES` */
export type ActivityRegistry = Readonly<Record<ActivityKind, ActivityDefinition>>

/** src/suite/activities/index.ts → `createActivitySession` */
export type CreateActivitySession = (options: ActivitySessionOptions) => ActivitySessionApi

/** src/suite/activities/index.ts → `assignPhotos`: which photo each photo-surface object
 *  shows. Honours `preferredSurface`, then fills frames and albums in placement order. */
export type AssignPhotos = (scene: SuiteScene, photos: readonly DisplayPhoto[]) => Map<string, DisplayPhoto>

/** src/suite/profile/index.ts → `resolveSuiteProfile` */
export type ResolveSuiteProfile = (
  profile: LocalProfile,
  i18n: I18n,
  maxTextureSize: number
) => Promise<{ resolved: ResolvedSuiteProfile; media: SuiteMediaApi }>

/** src/suite/profile/index.ts → `suiteOf`: the profile's suite settings, normalised, with
 *  defaults for a profile saved before the suite existed. Never mutates `profile`. */
export type SuiteOf = (profile: LocalProfile | undefined) => SuiteProfile

export interface CaregiverSetupOptions {
  /** Where to mount the editor (it is a full-screen layer). */
  root: HTMLElement
  i18n: I18n
  profile: LocalProfile | undefined
  packs: readonly LoadedContentPack[]
  library: AssetLibrary
  maxTextureSize: number
  /** After a successful save through the existing profileStore. */
  onSaved(profile: LocalProfile): void
  onClose(): void
}

/** src/suite/profile/index.ts → `openCaregiverSetup` */
export type OpenCaregiverSetup = (options: CaregiverSetupOptions) => void
