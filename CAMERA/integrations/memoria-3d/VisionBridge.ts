/**
 * Optional camera assistance — the mapping layer between Memoria's telemetry seam and the
 * local player-observation service.
 *
 * Lives at `src/observation/VisionBridge.ts` in the game. It is deliberately pure:
 *
 *  - It depends only on the observation *contracts* (type-only imports, erased at build
 *    time), never on an implementation class, so it can be exercised with a fake adapter.
 *  - It never touches a game object. Telemetry events go out as service game events;
 *    suggested actions come back in as calls to callbacks the game supplies. What a
 *    callback does to the mission is the game's business (see observation.ts).
 *  - It never throws into its callers: the telemetry seam and the adapter both keep
 *    running whatever a callback does.
 *
 * Nothing here runs unless the caregiver turns camera assistance on. With it off, no
 * bridge exists and the telemetry seam is exactly what it was.
 */

import type { Event, Outcome } from '../Telemetry.ts'
import type { GameAdapterApi, Unsubscribe } from './vendor/transport/contracts.ts'
import type { GameEventInput, SuggestedActionMessage, TaskOutcome } from './vendor/protocol/types.ts'

// ---------------------------------------------------------------------------
// The on/off preference — off unless somebody turned it on in this browser.
// ---------------------------------------------------------------------------

/** Same naming style as `memoria-agent-config-v1`. Stores exactly '1' or '0'. */
export const CAMERA_ASSIST_STORAGE_KEY = 'memoria-camera-assist-v1'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Default OFF: absent, unreadable or anything other than '1' all mean off. */
export function readCameraAssist(storage: StorageLike | null = defaultStorage()): boolean {
  try {
    return storage?.getItem(CAMERA_ASSIST_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeCameraAssist(on: boolean, storage: StorageLike | null = defaultStorage()): void {
  try {
    storage?.setItem(CAMERA_ASSIST_STORAGE_KEY, on ? '1' : '0')
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

/** §4.3 outcome → service outcome. `skipped` is not an outcome there; it is its own event. */
export const OUTCOME_MAP: Record<Exclude<Outcome, 'skipped'>, TaskOutcome> = {
  independent: 'success',
  cued: 'success_with_help',
  revealed: 'revealed'
}

/** Service ids match /^[A-Za-z0-9_.:-]{1,128}$/; mission ids are pack data, so sanitise. */
export function taskIdFor(missionId: string, step: number): string {
  const safe = missionId.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 100) || 'mission'
  return `${safe}:${step}`
}

// ---------------------------------------------------------------------------
// Suggestions → callbacks
// ---------------------------------------------------------------------------

export interface Suggestion {
  actionId: string
  action: SuggestedActionMessage['action']
  source: SuggestedActionMessage['source']
  /** The task the service meant, or null when the suggestion is not about one task. */
  taskId: string | null
  reason: string
  evidence: SuggestedActionMessage['evidence']
}

export interface DelayInstructionSuggestion extends Suggestion {
  /** How long a new instruction may be held at most (evidence.max_delay_ms). */
  maxDelayMs: number
}

/**
 * What the game does with each suggestion. The bridge only decides *whether* a
 * suggestion reaches the game; these decide what, if anything, it changes.
 */
export interface VisionBridgeCallbacks {
  onDelayInstruction(s: DelayInstructionSuggestion): void
  onGentleCue(s: Suggestion): void
  onOfferHint(s: Suggestion): void
  /**
   * Memoria has no difficulty setting, so the default only records the suggestion in
   * `bridge.suggestions`. Supplying a callback does not change that: it is informational.
   */
  onIncreaseDifficulty?(s: Suggestion): void
}

export type SuggestionFate =
  | 'delivered'
  | 'recorded_only'
  | 'stale_task'
  | 'no_task'
  | 'vision_off'
  | 'callback_failed'

export interface RecordedSuggestion extends Suggestion {
  fate: SuggestionFate
  /** Game clock (paused-aware) when it arrived. */
  at: number
}

export interface VisionBridgeOptions {
  adapter: GameAdapterApi
  callbacks: VisionBridgeCallbacks
  /** The game's paused-aware clock — `() => state.elapsed()`. */
  clock: () => number
  /** Initial vision-adaptation setting. Default false. */
  visionAdaptationEnabled?: boolean
  /** `object_dwell` activity is forwarded at most this often (game clock). Default 5000. */
  dwellMinIntervalMs?: number
  /** Diagnostics sink. Default: nothing. */
  log?: (message: string, detail?: unknown) => void
}

const SUGGESTION_HISTORY = 50
const DEFAULT_MAX_DELAY_MS = 8000

/**
 * One bridge per enabled period. Feed it every telemetry event via `handleEvent`, and
 * `dispose()` it when camera assistance is turned off.
 */
export class VisionBridge {
  private readonly adapter: GameAdapterApi
  private readonly callbacks: VisionBridgeCallbacks
  private readonly clock: () => number
  private readonly dwellMinIntervalMs: number
  private readonly log: (message: string, detail?: unknown) => void
  private readonly unsubscribe: Unsubscribe

  private missionId: string | null = null
  private openTask: { id: string; type: string; startedAt: number; mark: number; maxHint: number } | null = null
  private visionOn: boolean
  private lastDwellAt = Number.NEGATIVE_INFINITY
  private lastRaw = Number.NEGATIVE_INFINITY
  private offset = 0
  private disposed = false

  /** Most recent suggestions and what became of them, newest last. */
  readonly suggestions: RecordedSuggestion[] = []

  constructor(options: VisionBridgeOptions) {
    this.adapter = options.adapter
    this.callbacks = options.callbacks
    this.clock = options.clock
    this.dwellMinIntervalMs = options.dwellMinIntervalMs ?? 5000
    this.log = options.log ?? (() => {})
    this.visionOn = options.visionAdaptationEnabled ?? false
    this.unsubscribe = this.adapter.onSuggestedAction((a) => this.route(a))
  }

  get currentTaskId(): string | null {
    return this.openTask?.id ?? null
  }

  get visionAdaptationEnabled(): boolean {
    return this.visionOn
  }

  /** Forwards to the adapter (which tells the service) and gates vision suggestions here too. */
  setVisionAdaptationEnabled(enabled: boolean): void {
    this.visionOn = enabled
    if (this.disposed) return
    try {
      this.adapter.setVisionAdaptationEnabled(enabled)
    } catch (error) {
      this.log('setVisionAdaptationEnabled failed', error)
    }
  }

  // --- Telemetry → game events -------------------------------------------------------

  /** Chain from `telemetry.onEvent`. Never throws. */
  handleEvent(event: Event): void {
    if (this.disposed) return
    try {
      this.map(event)
    } catch (error) {
      this.log('event mapping failed', error)
    }
  }

  /**
   * Closes the open task as skipped without a telemetry event — for the level list, which
   * resets the runner silently. No-op when nothing is open.
   */
  endOpenTask(): void {
    if (this.disposed || !this.openTask) return
    const id = this.openTask.id
    this.openTask = null
    this.send({ event_type: 'task_skipped', task_id: id, data: {} }, this.clock())
  }

  /**
   * Turned on part-way through a step: open that step as a task so answers and hints that
   * follow have something to belong to. No-op if a task is already open.
   */
  adoptTask(missionId: string, step: number, type: string): void {
    if (this.disposed || this.openTask) return
    this.missionId = missionId
    const t = this.clock()
    const id = taskIdFor(missionId, step)
    this.openTask = { id, type, startedAt: t, mark: t, maxHint: 0 }
    this.send({ event_type: 'task_started', task_id: id, data: {} }, t)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    this.unsubscribe()
  }

  private map(event: Event): void {
    switch (event.kind) {
      case 'mission_start':
        this.missionId = event.id
        return

      case 'mission_complete':
        return // the last step_end already closed the task

      case 'step_start': {
        // Defensive, like summarise(): a step that never ended is closed first.
        if (this.openTask) this.send({ event_type: 'task_skipped', task_id: this.openTask.id, data: {} }, event.t)
        const id = taskIdFor(this.missionId ?? 'mission', event.step)
        this.openTask = { id, type: event.type, startedAt: event.t, mark: event.t, maxHint: 0 }
        this.send({ event_type: 'task_started', task_id: id, data: {} }, event.t)
        return
      }

      case 'step_end': {
        const id = taskIdFor(this.missionId ?? 'mission', event.step)
        if (this.openTask?.id === id) this.openTask = null
        const outcome = event.outcome ?? 'skipped'
        if (outcome === 'skipped') {
          this.send({ event_type: 'task_skipped', task_id: id, data: {} }, event.t)
        } else {
          this.send({ event_type: 'task_completed', task_id: id, data: { outcome: OUTCOME_MAP[outcome] } }, event.t)
        }
        return
      }

      case 'question_shown':
        // Response time is measured from the question, as §4.4's answerLatency is.
        if (this.openTask) this.openTask.mark = event.t
        return

      case 'answer_selected': {
        const task = this.openTask
        if (!task) return
        if (task.type === 'recall' && task.maxHint >= 3) {
          // The answer was already revealed: picking it is not the player answering.
          this.send({ event_type: 'player_activity', task_id: task.id, data: { activity: 'answer_after_reveal' } }, event.t)
          return
        }
        const responseMs = Math.max(0, event.t - task.mark)
        task.mark = event.t
        this.send(
          { event_type: 'answer_submitted', task_id: task.id, data: { correct: event.correct, response_ms: responseMs } },
          event.t
        )
        return
      }

      case 'hint_shown': {
        const id = taskIdFor(this.missionId ?? 'mission', event.step)
        if (this.openTask?.id === id && event.level > this.openTask.maxHint) this.openTask.maxHint = event.level
        this.send({ event_type: 'hint_shown', task_id: id, data: { hint_level: event.level } }, event.t)
        return
      }

      case 'object_interact':
        // Pressing E is activity, not an answer: doors are interactables too. A correct
        // find is reported by the step_end that immediately follows.
        this.activity('object_interact', event.t)
        return

      case 'room_enter':
        this.activity('room_enter', event.t)
        return

      case 'object_dwell':
        if (event.t - this.lastDwellAt < this.dwellMinIntervalMs) return
        this.lastDwellAt = event.t
        this.activity('object_dwell', event.t)
        return

      case 'pause':
        this.send({ event_type: 'paused', data: {} }, event.t)
        return

      case 'resume':
        this.send({ event_type: 'resumed', data: {} }, event.t)
        return

      case 'restart':
        if (this.openTask) {
          const id = this.openTask.id
          this.openTask = null
          this.send({ event_type: 'task_skipped', task_id: id, data: {} }, event.t)
        }
        this.lastDwellAt = Number.NEGATIVE_INFINITY
        return
    }
  }

  private activity(code: string, t: number): void {
    this.send({ event_type: 'player_activity', task_id: this.openTask?.id ?? null, data: { activity: code } }, t)
  }

  /**
   * `client_ts_ms` is the game clock (State.elapsed(): paused time already removed). That
   * clock restarts from zero on every attempt (`state.resetTimers()`), so a running offset
   * keeps what the service sees monotonic across attempts.
   */
  private stamp(raw: number): number {
    if (raw < this.lastRaw) this.offset += this.lastRaw - raw + 1
    this.lastRaw = raw
    return Math.round(raw + this.offset)
  }

  private send(input: GameEventInput, t: number): void {
    try {
      this.adapter.sendGameEvent({ ...input, client_ts_ms: this.stamp(t) })
    } catch (error) {
      this.log('sendGameEvent failed', error)
    }
  }

  // --- Suggested actions → callbacks ---------------------------------------------------

  private route(a: SuggestedActionMessage): void {
    if (this.disposed) return
    const base: Suggestion = {
      actionId: a.action_id,
      action: a.action,
      source: a.source,
      taskId: a.task_id,
      reason: a.reason,
      evidence: a.evidence
    }
    const record = (fate: SuggestionFate): void => {
      this.suggestions.push({ ...base, fate, at: this.clock() })
      if (this.suggestions.length > SUGGESTION_HISTORY) this.suggestions.shift()
      this.log(`suggestion ${a.action}: ${fate}`, a)
    }

    // Belt and braces: the adapter already suppresses these while disabled.
    if (a.source !== 'gameplay' && !this.visionOn) return record('vision_off')
    if (a.task_id !== null && a.task_id !== this.currentTaskId) return record('stale_task')

    const deliver = (fn: () => void): void => {
      try {
        fn()
        record('delivered')
      } catch (error) {
        this.log('suggestion callback failed', error)
        record('callback_failed')
      }
    }

    switch (a.action) {
      case 'delay_instruction': {
        const raw = a.evidence.max_delay_ms
        const maxDelayMs = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_MAX_DELAY_MS
        deliver(() => this.callbacks.onDelayInstruction({ ...base, maxDelayMs }))
        return
      }
      case 'gentle_cue':
        if (!this.openTask) return record('no_task')
        deliver(() => this.callbacks.onGentleCue(base))
        return
      case 'offer_hint':
        if (!this.openTask) return record('no_task')
        deliver(() => this.callbacks.onOfferHint(base))
        return
      case 'increase_difficulty':
        // No difficulty setting exists in Memoria: record it, change nothing.
        if (this.callbacks.onIncreaseDifficulty) {
          try {
            this.callbacks.onIncreaseDifficulty(base)
          } catch (error) {
            this.log('suggestion callback failed', error)
          }
        }
        record('recorded_only')
        return
    }
  }
}

// ---------------------------------------------------------------------------
// Instruction hold — the game side of `delay_instruction`, kept here so it is testable.
// ---------------------------------------------------------------------------

export interface InstructionHoldOptions {
  /** Upper bound on any hold, whatever the service says. Default 10 000 ms. */
  capMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Holds the *spoken* part of a new instruction while the player is looking away, until
 * they look back or the hold runs out — whichever comes first. The text is always shown
 * at once; only `speak()` waits, and it always runs or is dropped in bounded time.
 *
 *  - `open(ms)` on a delay_instruction suggestion starts a hold window.
 *  - `release()` when the service says the hold is over (the player looked back).
 *  - `gate(speakNow)` is what the mission runner calls in place of speaking directly.
 */
export class InstructionHold {
  private readonly capMs: number
  private readonly now: () => number
  private readonly setTimer: (fn: () => void, ms: number) => unknown
  private readonly clearTimer: (handle: unknown) => void
  private until = Number.NEGATIVE_INFINITY
  private pending: (() => void) | null = null
  private timer: unknown = null

  constructor(options: InstructionHoldOptions = {}) {
    this.capMs = options.capMs ?? 10_000
    this.now = options.now ?? (() => performance.now())
    this.setTimer = options.setTimer ?? ((fn, ms) => setTimeout(fn, ms))
    this.clearTimer = options.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>))
  }

  get holding(): boolean {
    return this.now() < this.until
  }

  get hasPending(): boolean {
    return this.pending !== null
  }

  open(maxDelayMs: number): void {
    const ms = Math.min(Math.max(0, maxDelayMs), this.capMs)
    this.until = Math.max(this.until, this.now() + ms)
    if (this.pending) this.arm()
  }

  /** The player is back (or the service stopped holding): speak anything held, now. */
  release(): void {
    this.until = Number.NEGATIVE_INFINITY
    this.flush()
  }

  /** Speak now, or hold `speakNow` until release/timeout. A newer instruction replaces an older one. */
  gate(speakNow: () => void): void {
    if (!this.holding) {
      try {
        speakNow()
      } catch {
        /* speech is best-effort */
      }
      return
    }
    this.pending = speakNow
    this.arm()
  }

  /** Drops anything held without speaking it (turning the feature off, leaving a level). */
  cancel(): void {
    this.pending = null
    this.until = Number.NEGATIVE_INFINITY
    this.disarm()
  }

  private arm(): void {
    this.disarm()
    const wait = Math.max(0, this.until - this.now())
    this.timer = this.setTimer(() => {
      this.timer = null
      this.flush()
    }, wait)
  }

  private disarm(): void {
    if (this.timer !== null) this.clearTimer(this.timer)
    this.timer = null
  }

  private flush(): void {
    this.disarm()
    const fn = this.pending
    this.pending = null
    if (!fn) return
    try {
      fn()
    } catch {
      /* speech is best-effort */
    }
  }
}
