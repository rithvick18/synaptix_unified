/**
 * Choosing an open-ended prompt for an item. The order is always:
 *
 *   1. the caregiver's own prompt (handled by the caller, which has the profile);
 *   2. a pack prompt for this asset;
 *   3. a pack prompt for the asset's category (and the running activity);
 *   4. a pack prompt for the item's kind (pictures, sounds, the room);
 *   5. a generic prompt from activities.json.
 *
 * Prompts touching an avoided topic are never chosen. Within a level, prompts sharing a
 * topic the caregiver asked to include come first, then the least-used one, so a session
 * does not repeat the same words from item to item.
 */
import type { ActivityKind, AssetCategory, I18n, LoadedContentPack, PromptDef, ResolvedPrompt } from '../contracts'
import { resolveUnder } from '../paths'

export type ItemKind = 'photo' | 'object' | 'sound' | 'space'

export interface PromptQuery {
  /** The activity running the session. */
  activity: ActivityKind
  /** The item's own kind; activity-level prompts are matched on it. */
  itemKind: ItemKind
  assetIds?: readonly string[]
  category?: AssetCategory
  /** The item's topics (a sound's, a photo's). Topic-specific kind prompts need an overlap. */
  topics?: readonly string[]
  /** 'voiceMessage' uses its own generic prompts and skips pack sound prompts. */
  voiceMessage?: boolean
}

/** Generic prompts in activities.json: `activities.generic.<group>.<n>`, n = 1..count. */
export const GENERIC_PROMPT_COUNTS: Readonly<Record<ItemKind | 'voiceMessage', number>> = {
  object: 4,
  photo: 4,
  sound: 4,
  space: 3,
  voiceMessage: 2
}

export function touchesAvoided(topics: readonly string[] | undefined, avoid: readonly string[]): boolean {
  return !!topics && topics.some((t) => avoid.includes(t))
}

const allows = (def: PromptDef, activity: ActivityKind): boolean => !def.appliesTo.activities || def.appliesTo.activities.includes(activity)

/** The pack prompts that fit a query, level by level (asset, category, kind). */
export function promptLevels(prompts: readonly PromptDef[], q: PromptQuery, avoid: readonly string[]): PromptDef[][] {
  const usable = prompts.filter((p) => !touchesAvoided(p.topics, avoid))
  const assets = q.assetIds ?? []
  // A sound item takes only asset prompts written for its sound ("…the ticking of a clock…").
  const assetFits = (p: PromptDef): boolean => (q.itemKind === 'sound' ? (p.appliesTo.activities ?? []).includes('sound') : allows(p, q.activity))
  const byAsset = assets.length ? usable.filter((p) => p.appliesTo.assets?.some((a) => assets.includes(a)) && assetFits(p)) : []
  const byCategory = q.category
    ? usable.filter((p) => !p.appliesTo.assets && p.appliesTo.categories?.includes(q.category as AssetCategory) && allows(p, q.activity))
    : []
  let byKind = q.voiceMessage
    ? []
    : usable.filter((p) => !p.appliesTo.assets && !p.appliesTo.categories && (p.appliesTo.activities ?? []).includes(q.itemKind))
  if (q.topics && q.topics.length > 0) {
    const itemTopics = q.topics
    const overlap = (p: PromptDef): boolean => !!p.topics?.some((t) => itemTopics.includes(t))
    // A topic-specific kind prompt ("…the weather…") only fits an item sharing that topic.
    const specific = byKind.filter((p) => p.topics && p.topics.length > 0 && overlap(p))
    const general = byKind.filter((p) => !p.topics || p.topics.length === 0)
    byKind = [...specific, ...general]
  } else if (q.itemKind === 'sound') {
    byKind = byKind.filter((p) => !p.topics || p.topics.length === 0)
  }
  return [byAsset, byCategory, byKind]
}

export function resolvePackPrompt(pack: LoadedContentPack, def: PromptDef, i18n: I18n): ResolvedPrompt {
  const lang = i18n.textLanguage(def.text)
  const audio = def.audio?.find((a) => a.lang === lang)
  return {
    text: i18n.text(def.text),
    lang,
    audioUrl: audio ? resolveUnder(pack.baseUrl, audio.path) : undefined,
    source: 'pack'
  }
}

/** Picks prompts for one session, spreading them so consecutive items vary. */
export class PromptPicker {
  private readonly uses = new Map<string, number>()

  constructor(
    private readonly pack: LoadedContentPack,
    private readonly i18n: I18n,
    private readonly avoid: readonly string[],
    private readonly include: readonly string[] = []
  ) {}

  /** A pack prompt (levels 2–4), or the generic prompt (level 5). Never null. */
  pick(q: PromptQuery): ResolvedPrompt {
    for (const level of promptLevels(this.pack.prompts, q, this.avoid)) {
      if (level.length === 0) continue
      const chosen = this.leastUsed(level, (p) => `pack:${p.id}`, (p) => (p.topics?.some((t) => this.include.includes(t)) ? 1 : 0))
      return resolvePackPrompt(this.pack, chosen, this.i18n)
    }
    return this.generic(q.voiceMessage ? 'voiceMessage' : q.itemKind)
  }

  generic(group: ItemKind | 'voiceMessage'): ResolvedPrompt {
    const keys = Array.from({ length: GENERIC_PROMPT_COUNTS[group] }, (_, i) => `activities.generic.${group}.${i + 1}`)
    const key = this.leastUsed(keys, (k) => `generic:${k}`, () => 0)
    return { text: this.i18n.t(key), lang: this.i18n.language, source: 'generic' }
  }

  private leastUsed<T>(list: readonly T[], id: (v: T) => string, preference: (v: T) => number): T {
    let best = list[0]
    let bestScore = Infinity
    for (const v of list) {
      // Preferred topics win ties of use count; earlier entries win the rest.
      const score = (this.uses.get(id(v)) ?? 0) * 10 - preference(v)
      if (score < bestScore) {
        best = v
        bestScore = score
      }
    }
    this.uses.set(id(best), (this.uses.get(id(best)) ?? 0) + 1)
    return best
  }
}
