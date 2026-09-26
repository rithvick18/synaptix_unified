/**
 * The module entry points the app consumes. index.ts passes the real modules; the dev
 * harness (src/suite/app/dev/) passes fakes built from the same contract types.
 */
import type {
  ActivityRegistry,
  AssignPhotos,
  BuildSuiteScene,
  CreateActivitySession,
  LoadAssetLibrary,
  LoadContentPacks,
  LoadI18n,
  OpenCaregiverSetup,
  PackDisplayMedia,
  ResolveSuiteProfile,
  SuiteOf
} from '../contracts'

export interface SuiteDeps {
  loadI18n: LoadI18n
  loadAssetLibrary: LoadAssetLibrary
  loadContentPacks: LoadContentPacks
  packDisplayMedia: PackDisplayMedia
  buildSuiteScene: BuildSuiteScene
  ACTIVITIES: ActivityRegistry
  createActivitySession: CreateActivitySession
  assignPhotos: AssignPhotos
  resolveSuiteProfile: ResolveSuiteProfile
  suiteOf: SuiteOf
  openCaregiverSetup: OpenCaregiverSetup
}
