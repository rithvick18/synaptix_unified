/**
 * Caregiver configuration and personal media for the suite.
 *
 *   suiteOf / defaultSuiteProfile  the profile's `suite` field, normalised (model.ts, pure)
 *   validateAudioFile / SUITE_LIMITS  media limits (model.ts, pure)
 *   resolveSuiteProfile            display photos, sounds and prompts for a session (resolve.ts)
 *   openCaregiverSetup             the caregiver editor (editor.ts, DOM)
 *
 * Nothing here infers an identity, relationship, date, place or language: every name,
 * caption and prompt is exactly what a caregiver typed, and empty stays empty.
 */
export {
  audioMime, defaultSuiteProfile, envKey, normaliseSuite, normaliseTopics, objectPromptKey,
  SUITE_LIMITS, suiteOf, validateAudioFile, validatePhotoFile
} from './model'
export type { MediaCheck, MediaProblem } from './model'
export { fitWithin, resolveSuiteProfile, SuiteMedia, TEXTURE_EDGE, textureFromBlob } from './resolve'
export { openCaregiverSetup } from './editor'
