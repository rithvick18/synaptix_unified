/**
 * Summary helpers. Pure.
 *
 * `summaryFromLog` is a fallback only: the activity session's own `finish()` / `exit()`
 * is the source of truth. It is used if the session cannot produce one (for example if
 * it already ended itself), so a caregiver never loses the record.
 */
import type { ActivityItem, ActivityKind, LanguageCode, SessionEvent, SessionSummary } from '../contracts'

export function summaryFromLog(input: {
  log: readonly SessionEvent[]
  items: readonly ActivityItem[]
  objects: readonly { id: string; label: string }[]
  activity: ActivityKind
  packId: string
  environmentId: string
  profile: 'saved' | 'demo'
  language: LanguageCode
  startedAt: string
  endedBy: 'finished' | 'exited'
}): SessionSummary {
  const { log } = input
  const count = (kind: SessionEvent['kind']): number => log.filter((e) => e.kind === kind).length
  const shownIds: string[] = []
  const visited: string[] = []
  let pausedMs = 0
  let pausedAt: number | null = null
  for (const e of log) {
    if (e.kind === 'item_shown' && !shownIds.includes(e.itemId)) shownIds.push(e.itemId)
    if (e.kind === 'item_shown' && e.objectId && !visited.includes(e.objectId)) visited.push(e.objectId)
    if (e.kind === 'object_selected' && !visited.includes(e.objectId)) visited.push(e.objectId)
    if (e.kind === 'paused') pausedAt = e.t
    if (e.kind === 'resumed' && pausedAt !== null) {
      pausedMs += Math.max(0, e.t - pausedAt)
      pausedAt = null
    }
  }
  const last = log.length ? log[log.length - 1].t : 0
  return {
    activity: input.activity,
    packId: input.packId,
    environmentId: input.environmentId,
    profile: input.profile,
    language: input.language,
    startedAt: input.startedAt,
    durationMs: Math.max(0, last),
    pausedMs,
    endedBy: input.endedBy,
    itemsShown: shownIds.map((id) => {
      const item = input.items.find((i) => i.id === id)
      return { id, title: item?.title ?? id, kind: item?.kind ?? 'space', personal: item?.personal ?? false }
    }),
    objectsVisited: visited.map((id) => ({ id, label: input.objects.find((o) => o.id === id)?.label ?? id })),
    promptsPlayed: count('prompt_played'),
    promptsReplayed: count('prompt_replayed'),
    soundsPlayed: count('sound_played'),
    skips: count('item_skipped'),
    closeups: count('closeup_opened'),
    caregiverNotes: log.flatMap((e) => (e.kind === 'caregiver_note' ? [{ t: e.t, itemId: e.itemId, text: e.text }] : [])),
    vision: null
  }
}

/** Duration as whole minutes and seconds, for i18n plural keys. */
export function splitDuration(ms: number): { minutes: number; seconds: number } {
  const total = Math.max(0, Math.round(ms / 1000))
  return { minutes: Math.floor(total / 60), seconds: total % 60 }
}
