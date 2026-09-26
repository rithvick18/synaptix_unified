/**
 * Reminiscence Therapy Suite — the app entry point (`createSuiteApp`).
 *
 * Wires the real suite modules into the controller. See app.ts for the lifecycle and
 * docs/suite/accessibility.md for controls, settings and layouts.
 */
import type { CreateSuiteApp } from '../contracts'
import { ACTIVITIES, assignPhotos, createActivitySession } from '../activities'
import { loadAssetLibrary } from '../assets'
import { loadContentPacks, packDisplayMedia } from '../content'
import { buildSuiteScene } from '../environments'
import { loadI18n } from '../i18n'
import { openCaregiverSetup, resolveSuiteProfile, suiteOf } from '../profile'
import { createSuiteAppWith } from './app'

export const createSuiteApp: CreateSuiteApp = (host) =>
  createSuiteAppWith(host, {
    loadI18n,
    loadAssetLibrary,
    loadContentPacks,
    packDisplayMedia,
    buildSuiteScene,
    ACTIVITIES,
    createActivitySession,
    assignPhotos,
    resolveSuiteProfile,
    suiteOf,
    openCaregiverSetup
  })

export { SuiteAudio } from './audio'
