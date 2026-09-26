/**
 * One run of an activity. There are no timers, countdowns or tallies: time comes only from
 * the injected clock (paused time excluded) and is used for the factual log.
 *
 * Moving on is never gated. A prompt is shown as text and offered as audio; if the audio
 * fails, is refused, or is held by the camera timing support, nothing waits for it.
 * Silence, looking away, skipping or ending early are recorded as plain events and never
 * interpreted.
 *
 * Camera timing (see docs/suite/activities.md): `adaptable` is the narrow surface the
 * camera layer drives. It can hold a new prompt's speech (`instructionGate`) and offer
 * one gentle re-offer per item (`gentleCue`); `requestHint()` always refuses, because
 * reminiscence has no hints or answers. Telemetry steps end as 'skipped' only because the
 * service has no neutral outcome; nothing reads that as a result.
 */
import type { AdaptableRunner } from '../../camera/types'
import type {
  ActivityItem,
  ActivitySessionApi,
  ActivitySessionOptions,
  CreateActivitySession,
  DisplaySound,
  ResolvedPrompt,
  SessionEvent,
  SessionSummary
} from '../contracts'
import { objectItem, pickerFor } from './definitions'
import { buildSummary } from './summary'

type EventInput = SessionEvent extends infer E ? (E extends { t: number } ? Omit<E, 't'> : never) : never

export const createActivitySession: CreateActivitySession = (options: ActivitySessionOptions): ActivitySessionApi => {
  const { definition, context, audio, telemetry } = options
  const now = options.now ?? (() => performance.now())
  const activity = definition.kind
  const missionId = `suite-${activity}`
  const items: readonly ActivityItem[] = definition.items(context)
  const freeItems = new Map<string, ActivityItem>()
  const picker = pickerFor(context)
  const log: SessionEvent[] = []
  const listeners = new Set<() => void>()

  let started = false
  let paused = false
  let ended = false
  let startClock = 0
  let pausedTotal = 0
  let pauseAt = 0
  let endT = 0
  let startedAt = ''
  let summary: SessionSummary | null = null
  let endedBy: 'finished' | 'exited' = 'finished'

  /** List position; -1 before start, after the end, and during free exploration. */
  let index = -1
  /** The item a person chose themselves, outside the list. */
  let free: ActivityItem | null = null
  /** The last list position shown, so next/previous continue from there after free exploration. */
  let lastListIndex = -1
  /** The telemetry step currently open (list index, or items.length + n for free items). */
  let openStep = -1
  let freeSeq = 0
  let stepStartT = 0
  /** Changes whenever the shown item changes; a held prompt checks it before speaking. */
  let token = 0
  let cuedToken = -1
  let soundPlaying = false

  const current = (): ActivityItem | null => free ?? (index >= 0 ? items[index] : null)
  const stepType = (item: ActivityItem): string => `reminisce-${item.kind}`

  /** Session time in ms, pauses excluded. */
  const t = (): number => {
    if (!started) return 0
    if (ended) return endT
    const pausedNow = paused ? now() - pauseAt : 0
    return Math.max(0, now() - startClock - pausedTotal - pausedNow)
  }

  const record = (event: EventInput): void => {
    log.push({ t: Math.round(t()), ...event } as SessionEvent)
  }

  const emit = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch (e) {
        console.warn('[suite] session listener failed', e)
      }
    }
  }

  /** Plays a prompt without ever throwing or blocking; resolves to how it was offered. */
  const offer = (prompt: ResolvedPrompt): Promise<'audio' | 'speech' | 'text-only'> => {
    try {
      return Promise.resolve(audio.playPrompt(prompt)).then(
        (via) => via ?? 'text-only',
        () => 'text-only' as const
      )
    } catch {
      return Promise.resolve('text-only' as const)
    }
  }

  const playShownPrompt = (item: ActivityItem, at: number): void => {
    const prompt = item.prompt
    if (!prompt) return
    const speakNow = (): void => {
      // A held prompt is dropped if the item changed, the session paused or ended.
      if (ended || paused || at !== token) return
      void offer(prompt).then((via) => {
        if (!ended) record({ kind: 'prompt_played', itemId: item.id, via })
        emit()
      })
    }
    const gate = adaptable.instructionGate
    if (!gate) return speakNow()
    try {
      gate(speakNow)
    } catch {
      speakNow()
    }
  }

  const leaveCurrent = (): void => {
    const cur = current()
    if (!cur || openStep < 0) return
    try {
      audio.stop()
    } catch {
      /* audio is optional */
    }
    if (soundPlaying) record({ kind: 'sound_stopped', itemId: cur.id })
    soundPlaying = false
    telemetry.stepEnd(openStep, stepType(cur), 'skipped')
    openStep = -1
  }

  const enter = (item: ActivityItem, listIndex: number, step: number): void => {
    leaveCurrent()
    index = listIndex
    free = listIndex < 0 ? item : null
    if (listIndex >= 0) lastListIndex = listIndex
    openStep = step
    stepStartT = t()
    token++
    record({ kind: 'item_shown', itemId: item.id, itemKind: item.kind, objectId: item.objectId })
    telemetry.stepStart(step, stepType(item))
    playShownPrompt(item, token)
    emit()
  }

  const showList = (i: number): void => enter(items[i], i, i)

  const canAct = (): boolean => started && !ended && !paused

  const end = (reason: 'finished' | 'exited'): SessionSummary => {
    if (summary) return summary
    if (paused) {
      pausedTotal += now() - pauseAt
      paused = false
      if (started) telemetry.resume()
    }
    endT = t()
    leaveCurrent()
    try {
      audio.stop()
    } catch {
      /* audio is optional */
    }
    endedBy = reason
    record({ kind: 'session_end', reason })
    if (started) telemetry.missionComplete(missionId)
    ended = true
    index = -1
    free = null
    token++
    summary = makeSummary()
    emit()
    return summary
  }

  const makeSummary = (): SessionSummary =>
    buildSummary({
      log,
      activity,
      packId: context.pack.meta.id,
      environmentId: context.scene.environmentId,
      profile: context.profile ? 'saved' : 'demo',
      language: context.i18n.language,
      startedAt: startedAt || new Date().toISOString(),
      durationMs: endT,
      pausedMs: pausedTotal,
      endedBy,
      itemById: (id) => items.find((i) => i.id === id) ?? freeItems.get(id),
      objects: context.scene.objects
    })

  const soundFor = (item: ActivityItem): DisplaySound | undefined => {
    if (item.kind === 'sound') return item.sound
    const obj = item.objectId ? context.scene.objects.find((o) => o.id === item.objectId) : undefined
    return obj?.soundId ? context.packSounds.find((s) => s.id === obj.soundId) : undefined
  }

  const adaptable: AdaptableRunner = {
    get active() {
      return started && !ended
    },
    get current() {
      const cur = current()
      return cur ? { type: stepType(cur) } : null
    },
    get stepIndex() {
      return openStep
    },
    get stepAgeMs() {
      return current() && !ended ? Math.max(0, t() - stepStartT) : null
    },
    get level() {
      return 0
    },
    instructionGate: null,
    requestHint() {
      return false // reminiscence has no hints and no answers
    },
    gentleCue() {
      const cur = current()
      if (!cur || !started || ended || paused || cuedToken === token) return false
      cuedToken = token
      record({ kind: 'gentle_cue', itemId: cur.id })
      emit() // the UI shows activities.gentleCue ("Take your time — there's no hurry.")
      if (cur.prompt) void offer(cur.prompt)
      return true
    }
  }

  const api: ActivitySessionApi = {
    activity,
    items,
    get index() {
      return index
    },
    get current() {
      return current()
    },
    get started() {
      return started
    },
    get paused() {
      return paused
    },
    get ended() {
      return ended
    },
    get log() {
      return log
    },
    adaptable,

    start() {
      if (started || ended) return
      started = true
      startClock = now()
      startedAt = new Date().toISOString()
      record({
        kind: 'session_start',
        activity,
        packId: context.pack.meta.id,
        environmentId: context.scene.environmentId,
        profile: context.profile ? 'saved' : 'demo',
        language: context.i18n.language
      })
      telemetry.missionStart(missionId)
      if (items.length > 0) showList(0)
      else emit()
    },

    next() {
      if (!canAct()) return
      const target = free ? lastListIndex + 1 : index + 1
      if (target < items.length) showList(target)
      else end('finished')
    },

    previous() {
      if (!canAct()) return
      if (free) {
        if (items.length > 0) showList(Math.max(0, lastListIndex))
        return
      }
      if (index > 0) showList(index - 1)
    },

    skip() {
      if (!canAct()) return
      const cur = current()
      if (cur) record({ kind: 'item_skipped', itemId: cur.id })
      api.next()
    },

    goTo(itemId) {
      if (!canAct()) return
      const i = items.findIndex((item) => item.id === itemId)
      if (i >= 0 && !(i === index && !free)) showList(i)
    },

    replayPrompt() {
      if (!canAct()) return
      const cur = current()
      if (!cur?.prompt) return
      record({ kind: 'prompt_replayed', itemId: cur.id })
      try {
        audio.stop('voice')
      } catch {
        /* audio is optional */
      }
      void offer(cur.prompt)
      emit()
    },

    playSound() {
      if (!canAct()) return
      const cur = current()
      const sound = cur ? soundFor(cur) : undefined
      if (!cur || !sound) return
      const at = token
      let result: Promise<boolean>
      try {
        result = Promise.resolve(audio.playSound(sound)).catch(() => false)
      } catch {
        result = Promise.resolve(false)
      }
      void result.then((ok) => {
        if (!ok || ended) return
        record({ kind: 'sound_played', itemId: cur.id })
        if (at === token) soundPlaying = true
        emit()
      })
    },

    stopSound() {
      if (!started || ended) return
      try {
        audio.stop('sounds')
      } catch {
        /* audio is optional */
      }
      const cur = current()
      if (soundPlaying && cur) record({ kind: 'sound_stopped', itemId: cur.id })
      soundPlaying = false
      emit()
    },

    pause() {
      if (!started || ended || paused) return
      record({ kind: 'paused' })
      paused = true
      pauseAt = now()
      try {
        audio.pause()
      } catch {
        /* audio is optional */
      }
      telemetry.pause()
      emit()
    },

    resume() {
      if (!started || ended || !paused) return
      pausedTotal += now() - pauseAt
      paused = false
      try {
        audio.resume()
      } catch {
        /* audio is optional */
      }
      telemetry.resume()
      record({ kind: 'resumed' })
      emit()
    },

    selectObject(objectId) {
      if (!canAct()) return
      const obj = context.scene.objects.find((o) => o.id === objectId)
      if (!obj) return
      record({ kind: 'object_selected', objectId })
      const cur = current()
      if (cur?.objectId === objectId) {
        emit()
        return
      }
      const i = items.findIndex((item) => item.objectId === objectId)
      if (i >= 0) {
        showList(i)
        return
      }
      const item = freeItems.get(`object:${objectId}`) ?? objectItem(context, obj, activity, picker)
      freeItems.set(item.id, item)
      enter(item, -1, items.length + freeSeq++)
    },

    noteCloseup(open) {
      if (!started || ended) return
      const cur = current()
      if (!cur) return
      record({ kind: open ? 'closeup_opened' : 'closeup_closed', itemId: cur.id })
      emit()
    },

    addNote(text, itemId) {
      const trimmed = text.trim()
      if (!trimmed) return
      record({ kind: 'caregiver_note', itemId: itemId ?? current()?.id, text: trimmed })
      if (summary) summary = makeSummary() // a note added on the summary screen is kept
      emit()
    },

    exit() {
      return end('exited')
    },

    finish() {
      return end('finished')
    },

    onChange(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
  return api
}

/** True while the soft "Take your time" line should show: a gentle cue for the current item. */
export function gentleCueShown(session: ActivitySessionApi): boolean {
  const cur = session.current
  if (!cur) return false
  for (let i = session.log.length - 1; i >= 0; i--) {
    const e = session.log[i]
    if (e.kind === 'item_shown') return false
    if (e.kind === 'gentle_cue') return e.itemId === cur.id
  }
  return false
}
