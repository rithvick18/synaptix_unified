/**
 * The factual session summary. Counts come only from the session log; durations come
 * from the session clock (pauses excluded). Nothing here is a score, a rate or a
 * judgement: an item skipped, a quiet moment or an early exit is simply recorded.
 */
import type { ActivityItem, ActivityKind, LanguageCode, SceneObject, SessionEvent, SessionSummary } from '../contracts'

export interface SummaryInput {
  log: readonly SessionEvent[]
  activity: ActivityKind
  packId: string
  environmentId: string
  profile: 'saved' | 'demo'
  language: LanguageCode
  startedAt: string
  durationMs: number
  pausedMs: number
  endedBy: 'finished' | 'exited'
  /** Every item that could appear in the log, including free-exploration items. */
  itemById: (id: string) => ActivityItem | undefined
  objects: readonly SceneObject[]
}

export function buildSummary(input: SummaryInput): SessionSummary {
  const { log } = input
  const start = log.find((e): e is Extract<SessionEvent, { kind: 'session_start' }> => e.kind === 'session_start')
  const itemsShown: SessionSummary['itemsShown'] = []
  const seenItems = new Set<string>()
  const objectsVisited: SessionSummary['objectsVisited'] = []
  const seenObjects = new Set<string>()
  const visit = (objectId: string | undefined): void => {
    if (!objectId || seenObjects.has(objectId)) return
    seenObjects.add(objectId)
    const obj = input.objects.find((o) => o.id === objectId)
    objectsVisited.push({ id: objectId, label: obj?.label ?? objectId })
  }
  const count = (kind: SessionEvent['kind']): number => log.filter((e) => e.kind === kind).length

  for (const e of log) {
    if (e.kind === 'item_shown') {
      if (!seenItems.has(e.itemId)) {
        seenItems.add(e.itemId)
        const item = input.itemById(e.itemId)
        itemsShown.push({ id: e.itemId, title: item?.title ?? e.itemId, kind: e.itemKind, personal: item?.personal ?? false })
      }
      if (e.itemKind === 'object') visit(e.objectId)
    } else if (e.kind === 'object_selected') {
      visit(e.objectId)
    }
  }

  return {
    activity: start?.activity ?? input.activity,
    packId: start?.packId ?? input.packId,
    environmentId: start?.environmentId ?? input.environmentId,
    profile: start?.profile ?? input.profile,
    language: start?.language ?? input.language,
    startedAt: input.startedAt,
    durationMs: Math.max(0, Math.round(input.durationMs)),
    pausedMs: Math.max(0, Math.round(input.pausedMs)),
    endedBy: input.endedBy,
    itemsShown,
    objectsVisited,
    promptsPlayed: count('prompt_played'),
    promptsReplayed: count('prompt_replayed'),
    soundsPlayed: count('sound_played'),
    skips: count('item_skipped'),
    closeups: count('closeup_opened'),
    caregiverNotes: log.flatMap((e) => (e.kind === 'caregiver_note' ? [{ t: e.t, itemId: e.itemId, text: e.text }] : [])),
    vision: null
  }
}
