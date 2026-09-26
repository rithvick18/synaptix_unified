/**
 * Content packs: loading and validation, the packs' demo pictures and sounds, and prompt
 * selection. See docs/suite/content-packs.md.
 */
import type { LoadContentPacks, PackDisplayMedia } from '../contracts'
import { loadContentPacks as load } from './loader'
import { packDisplayMedia as media } from './media'

export const loadContentPacks: LoadContentPacks = load
export const packDisplayMedia: PackDisplayMedia = media

/** Same as loadContentPacks, with shell slots so placements can be checked here too. */
export { load as loadContentPacksWithShells }
export type { LoadContentOptions } from './loader'
export { PromptPicker, promptLevels, resolvePackPrompt, touchesAvoided, GENERIC_PROMPT_COUNTS } from './prompts'
export type { ItemKind, PromptQuery } from './prompts'
export { ASSET_CATEGORIES, SHELL_IDS, SPDX_LICENSES, isLocalPackPath, validateContent, validateEnvironments, validateMeta, validateIndex } from './validate'
export type { KnownShells } from './validate'
