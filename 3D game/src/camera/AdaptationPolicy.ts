/**
 * The game's adaptation policy — the authority on whether a service suggestion changes
 * anything in Memoria.
 *
 * The observation service *suggests* (with its own thresholds, hysteresis and cooldowns,
 * see CAMERA/service/app/engine.py); it never changes the game. This class decides, using
 * only game-side facts plus the latest camera snapshot, and then calls one of three
 * narrow game hooks. Nothing is applied twice: the service only suggests, the game only
 * applies, and each suggestion id is considered once.
 *
 * Rules, in the order they are checked (first failure wins and is recorded):
 *
 *   duplicate id · expired · adaptation switched off · vision gate (for vision-sourced
 *   suggestions: service open and fresh, vision fresh, calibrated, tracking valid, service
 *   vision gate active, not simulated) · hints and difficulty need gameplay evidence ·
 *   no difficulty mechanism · game not in active play · wrong/no task · game-side cooldown ·
 *   per-step limit · safe point (else defer) · the hook itself.
 *
 * Deferred suggestions wait for a safe point (bounded by their own expiry and
 * `maxDeferMs`) and have their evidence re-checked when they get there. At most one is
 * pending per action; a newer one supersedes it.
 *
 * Head direction, eye closure and face loss never lower difficulty and never trigger a
 * hint on their own: vision can only delay speech or add one gentle cue.
 */

import type { CameraSnapshot, CameraSuggestion, SuggestionAction } from './types'

export interface AdaptationConfig {
  /** Game-side cooldown per action (performance.now ms), on top of the service's own. */
  cooldownMs: Record<SuggestionAction, number>
  /** At most this many applications per step (per attempt). */
  maxPerStep: { gentle_cue: number; offer_hint: number }
  /** Not in the first moments of a step (game clock, paused time excluded). */
  minStepAgeMs: { gentle_cue: number; offer_hint: number }
  /** A hint waits this long after the player's last answer, so choices never change under a click. */
  answerSettleMs: number
  /** A deferred suggestion is dropped after this long, or at its own expiry if sooner. */
  maxDeferMs: number
  /** Upper bound on any instruction hold, whatever the service asks. */
  maxInstructionHoldMs: number
  /** TEST ONLY: accept vision from injected (simulated) observations. */
  allowSimulatedVision: boolean
}

/** Initial, tunable defaults. See INTEGRATION.md → "Adaptation rules". */
export const DEFAULT_ADAPTATION_CONFIG: AdaptationConfig = {
  cooldownMs: {
    delay_instruction: 5_000,
    gentle_cue: 60_000,
    offer_hint: 30_000,
    increase_difficulty: 180_000
  },
  maxPerStep: { gentle_cue: 1, offer_hint: 1 },
  minStepAgeMs: { gentle_cue: 5_000, offer_hint: 3_000 },
  answerSettleMs: 1_200,
  maxDeferMs: 10_000,
  maxInstructionHoldMs: 10_000,
  allowSimulatedVision: false
}

/** What the game says about itself at the moment of deciding. */
export interface GameContext {
  /** performance.now() */
  now: number
  /** State.current — 'exploring' | 'answering' | 'paused' | 'completed'. */
  gameState: string
  attemptId: string
  taskId: string | null
  stepIndex: number | null
  /** Game-clock ms since the step began, or null. */
  stepAgeMs: number | null
  /** Game-clock ms since the last answer in this step, or null if none. */
  msSinceAnswer: number | null
  hintLevel: number
}

/** The three things the policy can ask the game to do. Each returns whether it happened. */
export interface AdaptationEffects {
  holdInstruction(maxMs: number): void
  gentleCue(): boolean
  requestHint(): boolean
}

export interface AdaptationRecord {
  seq: number
  sessionId: string | null
  suggestionId: string
  action: SuggestionAction
  source: CameraSuggestion['source']
  /** The service's plain-language trigger, and the numbers behind it. */
  trigger: string
  evidence: CameraSuggestion['evidence']
  decision: 'applied' | 'rejected'
  /** Reason code when rejected; null when applied. */
  reason: string | null
  receivedAt: number
  decidedAt: number
  /** How long it waited for a safe point. */
  deferredMs: number
  /** The vision gate at decision time. */
  vision: {
    usable: boolean
    blockedReason: string | null
    attention: string | null
    headAwayMs: number | null
    simulated: boolean
  }
  /** Remaining game-side cooldown per action after this decision, ms. */
  cooldownRemainingMs: Record<SuggestionAction, number>
  game: { state: string; attemptId: string; taskId: string | null; stepIndex: number | null; hintLevel: number }
}

type Outcome = { decision: 'applied' } | { decision: 'rejected'; reason: string } | { decision: 'deferred'; reason: string }

const HISTORY = 200
const SEEN = 1000

export class AdaptationPolicy {
  config: AdaptationConfig
  private readonly effects: AdaptationEffects
  private readonly sessionId: () => string | null
  private readonly lastApplied = new Map<SuggestionAction, number>()
  private readonly perStep = new Map<string, number>()
  private readonly seen: string[] = []
  private readonly seenSet = new Set<string>()
  private readonly pending = new Map<SuggestionAction, CameraSuggestion>()
  private readonly listeners = new Set<(r: AdaptationRecord) => void>()
  private seq = 0

  /** Every decision, newest last. Separate from the §4.4 telemetry log on purpose. */
  readonly records: AdaptationRecord[] = []

  constructor(effects: AdaptationEffects, options: { config?: Partial<AdaptationConfig>; sessionId?: () => string | null } = {}) {
    this.effects = effects
    this.config = { ...DEFAULT_ADAPTATION_CONFIG, ...options.config }
    this.sessionId = options.sessionId ?? (() => null)
  }

  get pendingCount(): number {
    return this.pending.size
  }

  onRecord(cb: (r: AdaptationRecord) => void): () => void {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  /** A new suggestion from the service. */
  consider(s: CameraSuggestion, ctx: GameContext, snap: CameraSnapshot): 'applied' | 'rejected' | 'deferred' {
    if (this.seenSet.has(s.id)) {
      this.record(s, ctx, snap, { decision: 'rejected', reason: 'duplicate' })
      return 'rejected'
    }
    this.remember(s.id)
    const outcome = this.evaluate(s, ctx, snap, false)
    if (outcome.decision === 'deferred') {
      const older = this.pending.get(s.action)
      if (older) this.record(older, ctx, snap, { decision: 'rejected', reason: 'superseded' })
      this.pending.set(s.action, s)
      return 'deferred'
    }
    this.record(s, ctx, snap, outcome)
    return outcome.decision
  }

  /** Re-checks deferred suggestions. Call a few times a second while `pendingCount > 0`. */
  tick(ctx: GameContext, snap: CameraSnapshot): void {
    for (const [action, s] of [...this.pending]) {
      const outcome = this.evaluate(s, ctx, snap, true)
      if (outcome.decision === 'deferred') continue
      this.pending.delete(action)
      this.record(s, ctx, snap, outcome)
    }
  }

  /** Drops every deferred suggestion — leaving gameplay, changing level, stopping the camera. */
  clearPending(reason: string, ctx: GameContext, snap: CameraSnapshot): void {
    for (const s of this.pending.values()) this.record(s, ctx, snap, { decision: 'rejected', reason })
    this.pending.clear()
  }

  cooldownRemaining(now: number): Record<SuggestionAction, number> {
    const out = {} as Record<SuggestionAction, number>
    for (const action of Object.keys(this.config.cooldownMs) as SuggestionAction[]) {
      const last = this.lastApplied.get(action)
      out[action] = last === undefined ? 0 : Math.max(0, Math.round(last + this.config.cooldownMs[action] - now))
    }
    return out
  }

  // --- The rules ------------------------------------------------------------------------

  private evaluate(s: CameraSuggestion, ctx: GameContext, snap: CameraSnapshot, retry: boolean): Outcome {
    const cfg = this.config
    const reject = (reason: string): Outcome => ({ decision: 'rejected', reason })
    const age = ctx.now - s.receivedAt

    if (age > Math.min(s.expiresInMs, cfg.maxDeferMs)) return reject('expired')
    if (!snap.adaptationEnabled) return reject('adaptation_disabled')

    const visionSourced = s.source !== 'gameplay'
    if (visionSourced) {
      if (!snap.visionUsable) return reject(`vision_unusable:${snap.visionBlockedReason ?? 'unknown'}`)
      if (snap.vision?.simulated && !cfg.allowSimulatedVision) return reject('simulated_vision')
    }
    // Hints and difficulty follow performance only — never head direction, eyes or face loss.
    if ((s.action === 'offer_hint' || s.action === 'increase_difficulty') && s.source !== 'gameplay') {
      return reject('requires_gameplay_evidence')
    }
    if (s.action === 'increase_difficulty') return reject('no_difficulty_mechanism')

    if (ctx.gameState === 'paused') {
      // Wait for resume (bounded by expiry); evidence is re-checked then.
      return { decision: 'deferred', reason: 'game_paused' }
    }
    if (ctx.gameState !== 'exploring' && ctx.gameState !== 'answering') return reject('no_active_gameplay')

    if (s.action !== 'delay_instruction') {
      if (!ctx.taskId) return reject('no_task')
    }
    if (s.taskId !== null && s.taskId !== ctx.taskId) return reject('stale_task')

    const last = this.lastApplied.get(s.action)
    if (last !== undefined && ctx.now - last < cfg.cooldownMs[s.action]) return reject('cooldown')

    const stepKey = `${ctx.attemptId}|${ctx.taskId}|${s.action}`
    if (s.action === 'gentle_cue' || s.action === 'offer_hint') {
      if ((this.perStep.get(stepKey) ?? 0) >= cfg.maxPerStep[s.action]) return reject('step_limit')
      // Safe point: not in the first moments of a step…
      if ((ctx.stepAgeMs ?? 0) < cfg.minStepAgeMs[s.action]) return { decision: 'deferred', reason: 'step_just_started' }
    }
    // …and a hint never lands while an answer is being given.
    if (s.action === 'offer_hint' && ctx.msSinceAnswer !== null && ctx.msSinceAnswer < cfg.answerSettleMs) {
      return { decision: 'deferred', reason: 'answer_settling' }
    }

    // A deferred vision suggestion must still be true when its safe point arrives.
    if (retry && s.action === 'gentle_cue' && snap.vision?.attention !== 'HEAD_AWAY') return reject('evidence_no_longer_holds')
    if (retry && s.action === 'delay_instruction' && !snap.policy?.holdNewInstructions) return reject('evidence_no_longer_holds')

    // Apply through the game's own hooks.
    let ok = true
    switch (s.action) {
      case 'delay_instruction': {
        const raw = s.evidence.max_delay_ms
        const ms = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : cfg.maxInstructionHoldMs
        this.effects.holdInstruction(Math.min(ms, cfg.maxInstructionHoldMs))
        break
      }
      case 'gentle_cue':
        ok = this.effects.gentleCue()
        if (!ok) return reject('cue_not_applicable')
        break
      case 'offer_hint':
        ok = this.effects.requestHint()
        if (!ok) return reject('hint_ladder_exhausted')
        break
    }
    this.lastApplied.set(s.action, ctx.now)
    this.perStep.set(stepKey, (this.perStep.get(stepKey) ?? 0) + 1)
    return { decision: 'applied' }
  }

  // --- Bookkeeping ------------------------------------------------------------------------

  private remember(id: string): void {
    this.seen.push(id)
    this.seenSet.add(id)
    if (this.seen.length > SEEN) this.seenSet.delete(this.seen.shift()!)
  }

  private record(s: CameraSuggestion, ctx: GameContext, snap: CameraSnapshot, outcome: Outcome): void {
    const r: AdaptationRecord = {
      seq: ++this.seq,
      sessionId: this.sessionId(),
      suggestionId: s.id,
      action: s.action,
      source: s.source,
      trigger: s.reason,
      evidence: s.evidence,
      decision: outcome.decision === 'applied' ? 'applied' : 'rejected',
      reason: outcome.decision === 'applied' ? null : outcome.reason,
      receivedAt: Math.round(s.receivedAt),
      decidedAt: Math.round(ctx.now),
      deferredMs: Math.max(0, Math.round(ctx.now - s.receivedAt)),
      vision: {
        usable: snap.visionUsable,
        blockedReason: snap.visionBlockedReason,
        attention: snap.vision?.attention ?? null,
        headAwayMs: snap.vision?.headAwayMs.value ?? null,
        simulated: snap.vision?.simulated ?? false
      },
      cooldownRemainingMs: this.cooldownRemaining(ctx.now),
      game: { state: ctx.gameState, attemptId: ctx.attemptId, taskId: ctx.taskId, stepIndex: ctx.stepIndex, hintLevel: ctx.hintLevel }
    }
    this.records.push(r)
    if (this.records.length > HISTORY) this.records.shift()
    for (const cb of [...this.listeners]) {
      try {
        cb(r)
      } catch {
        /* a listener must not break the policy */
      }
    }
  }
}
