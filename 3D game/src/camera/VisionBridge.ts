/**
 * Gameplay telemetry → observation-service game events.
 *
 * Derived from the camera project's Memoria patch (CAMERA/integrations/memoria-3d/), and
 * deliberately pure: type-only imports, no game objects touched, never throws into the
 * telemetry seam. It is fed every §4.4 event through `handleEvent` and keeps the game's
 * own definitions intact:
 *
 *  - **Task granularity** is the step: `task_id = <missionId>:<stepIndex>`.
 *  - **Response time** is measured from `question_shown` (§4.4's answerLatency), or from
 *    the previous answer, on State.elapsed() — paused time is already excluded.
 *  - **Outcome** is §4.3's, mapped one-to-one (independent→success, cued→success_with_help,
 *    revealed→revealed, skipped→task_skipped).
 *  - **Clock**: `client_ts_ms` is State.elapsed(), offset so it stays monotonic across
 *    `resetTimers()` on every attempt.
 *
 * Idempotence: each call to `send` produces one event with a fresh event_id; the camera
 * app's GameAdapter resends that same id after a reconnect until acked, and the service
 * deduplicates on it. The bridge itself is fed once per telemetry event, so re-renders,
 * reconnects and scene changes cannot duplicate an event.
 */

import type { Event, Outcome } from '../Telemetry'
import type { GameEventInput, TaskOutcome } from './app'

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

export interface GameEventSink {
  sendGameEvent(event: GameEventInput): string | null
}

export interface VisionBridgeOptions {
  sink: GameEventSink
  /** The game's paused-aware clock — `() => state.elapsed()`. */
  clock: () => number
  /** `object_dwell` and input activity are forwarded at most this often (game clock). Default 2000. */
  activityMinIntervalMs?: number
  log?: (message: string, detail?: unknown) => void
}

export interface OpenTask {
  id: string
  step: number
  type: string
  startedAt: number
  /** Response times are measured from here: question_shown, or the previous answer. */
  mark: number
  maxHint: number
  /** Game clock of the most recent answer_selected in this task, or null. */
  lastAnswerAt: number | null
}

export class VisionBridge {
  private readonly sink: GameEventSink
  private readonly clock: () => number
  private readonly activityMinIntervalMs: number
  private readonly log: (message: string, detail?: unknown) => void

  private missionId: string | null = null
  private task: OpenTask | null = null
  private lastActivityAt = Number.NEGATIVE_INFINITY
  private lastRaw = Number.NEGATIVE_INFINITY
  private offset = 0
  private idle = false
  private disposed = false
  /** Events sent, by type — diagnostics and checks. */
  readonly sent: Record<string, number> = {}

  constructor(options: VisionBridgeOptions) {
    this.sink = options.sink
    this.clock = options.clock
    this.activityMinIntervalMs = options.activityMinIntervalMs ?? 2000
    this.log = options.log ?? (() => {})
  }

  get currentTask(): Readonly<OpenTask> | null {
    return this.task
  }

  get currentTaskId(): string | null {
    return this.task?.id ?? null
  }

  /** Chain from `telemetry.onEvent`. Never throws. */
  handleEvent(event: Event): void {
    if (this.disposed) return
    try {
      this.map(event)
    } catch (error) {
      this.log('event mapping failed', error)
    }
  }

  /** Meaningful player input (walking, looking, clicking), throttled. Only inside a task. */
  activity(code: string): void {
    if (this.disposed || !this.task) return
    const t = this.clock()
    if (t - this.lastActivityAt < this.activityMinIntervalMs) return
    this.lastActivityAt = t
    this.send({ event_type: 'player_activity', task_id: this.task.id, data: { activity: code } }, t)
  }

  /**
   * An expected wait that is not the player being inactive — the tab hidden, for one.
   * The service freezes its inactivity clock between start and end. Idempotent.
   */
  expectedIdle(on: boolean): void {
    if (this.disposed || on === this.idle) return
    this.idle = on
    this.send({ event_type: on ? 'expected_idle_start' : 'expected_idle_end', data: {} }, this.clock())
  }

  /** Closes the open task as skipped — for the level list, which resets the runner silently. */
  endOpenTask(): void {
    if (this.disposed || !this.task) return
    const id = this.task.id
    this.task = null
    this.send({ event_type: 'task_skipped', task_id: id, data: {} }, this.clock())
  }

  /**
   * Camera turned on part-way through a step: open that step as a task so the answers
   * and hints that follow have something to belong to. No-op if a task is already open.
   */
  adoptTask(missionId: string, step: number, type: string): void {
    if (this.disposed || this.task) return
    this.missionId = missionId
    const t = this.clock()
    const id = taskIdFor(missionId, step)
    this.task = { id, step, type, startedAt: t, mark: t, maxHint: 0, lastAnswerAt: null }
    this.send({ event_type: 'task_started', task_id: id, data: {} }, t)
  }

  /** Stops sending. Closes nothing: call `endOpenTask()` first if the task should close. */
  dispose(): void {
    this.disposed = true
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
        if (this.task) this.send({ event_type: 'task_skipped', task_id: this.task.id, data: {} }, event.t)
        const id = taskIdFor(this.missionId ?? 'mission', event.step)
        this.task = { id, step: event.step, type: event.type, startedAt: event.t, mark: event.t, maxHint: 0, lastAnswerAt: null }
        this.send({ event_type: 'task_started', task_id: id, data: {} }, event.t)
        return
      }

      case 'step_end': {
        const id = taskIdFor(this.missionId ?? 'mission', event.step)
        if (this.task?.id === id) this.task = null
        const outcome = event.outcome ?? 'skipped'
        if (outcome === 'skipped') {
          this.send({ event_type: 'task_skipped', task_id: id, data: {} }, event.t)
        } else {
          this.send({ event_type: 'task_completed', task_id: id, data: { outcome: OUTCOME_MAP[outcome] } }, event.t)
        }
        return
      }

      case 'question_shown':
        if (this.task) this.task.mark = event.t
        return

      case 'answer_selected': {
        const task = this.task
        if (!task) return
        task.lastAnswerAt = event.t
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
        if (this.task?.id === id && event.level > this.task.maxHint) this.task.maxHint = event.level
        this.send({ event_type: 'hint_shown', task_id: id, data: { hint_level: event.level } }, event.t)
        return
      }

      case 'object_interact':
        // Pressing E is activity, not an answer: doors are interactables too. A correct
        // find is reported by the step_end that immediately follows.
        this.sendActivity('object_interact', event.t, true)
        return

      case 'room_enter':
        this.sendActivity('room_enter', event.t, true)
        return

      case 'object_dwell':
        this.sendActivity('object_dwell', event.t, false)
        return

      case 'pause':
        this.send({ event_type: 'paused', data: {} }, event.t)
        return

      case 'resume':
        this.send({ event_type: 'resumed', data: {} }, event.t)
        return

      case 'restart':
        if (this.task) {
          const id = this.task.id
          this.task = null
          this.send({ event_type: 'task_skipped', task_id: id, data: {} }, event.t)
        }
        this.lastActivityAt = Number.NEGATIVE_INFINITY
        return
    }
  }

  private sendActivity(code: string, t: number, always: boolean): void {
    if (!always && t - this.lastActivityAt < this.activityMinIntervalMs) return
    this.lastActivityAt = t
    this.send({ event_type: 'player_activity', task_id: this.task?.id ?? null, data: { activity: code } }, t)
  }

  /**
   * `client_ts_ms` is the game clock (State.elapsed(): paused time already removed). That
   * clock restarts from zero on every attempt, so a running offset keeps what the service
   * sees monotonic across attempts.
   */
  private stamp(raw: number): number {
    if (raw < this.lastRaw) this.offset += this.lastRaw - raw + 1
    this.lastRaw = raw
    return Math.round(raw + this.offset)
  }

  private send(input: GameEventInput, t: number): void {
    try {
      this.sink.sendGameEvent({ ...input, client_ts_ms: this.stamp(t) })
      this.sent[input.event_type] = (this.sent[input.event_type] ?? 0) + 1
    } catch (error) {
      this.log('sendGameEvent failed', error)
    }
  }
}

// ---------------------------------------------------------------------------
// Instruction hold — the game side of `delay_instruction`.
// ---------------------------------------------------------------------------

export interface InstructionHoldOptions {
  /** Upper bound on any hold, whatever the service says. Default 10 000 ms. */
  capMs?: number
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
}

/**
 * Holds the *spoken* part of a new instruction while the player's head is turned away,
 * until they turn back or the hold runs out — whichever comes first. The text is always
 * shown at once; only `speak()` waits, and it always runs or is dropped in bounded time.
 * The safe point is the step boundary: a hold only ever affects the *next* new instruction.
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

  /** The player turned back (or the service stopped holding): speak anything held, now. */
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
