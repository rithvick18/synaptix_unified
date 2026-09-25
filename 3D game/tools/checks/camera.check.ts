/**
 * Headless checks for optional camera support (src/camera/).
 *
 * Everything here runs under node with FAKE camera-app classes and SYNTHETIC inputs:
 * it checks schema translation, the game's adaptation policy, the telemetry mapping and
 * the adapter's lifecycle (one capture, no leaked listeners, clean teardown). It says
 * nothing about camera or vision accuracy — see tools/camera-e2e.mjs and INTEGRATION.md.
 */

import { AdaptationPolicy, DEFAULT_ADAPTATION_CONFIG, type GameContext } from '../../src/camera/AdaptationPolicy'
import type {
  AdapterState,
  DerivedState,
  GameEventInput,
  ObservationBody,
  ObserverStatus,
  ProcessorStatus,
  SuggestedActionMessage
} from '../../src/camera/app'
import { CameraAdapter } from '../../src/camera/CameraAdapter'
import { buildSnapshot, type SnapshotInputs } from '../../src/camera/snapshot'
import type { CameraSnapshot, CameraSuggestion } from '../../src/camera/types'
import { InstructionHold, VisionBridge, taskIdFor } from '../../src/camera/VisionBridge'
import type { Event } from '../../src/Telemetry'

let checks = 0
const failures: string[] = []
function ok(condition: boolean, label: string): void {
  checks++
  if (!condition) failures.push(label)
}
function eq<T>(actual: T, expected: T, label: string): void {
  checks++
  if (actual !== expected) failures.push(`${label}\n     expected ${String(expected)}, got ${String(actual)}`)
}
const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------------------
// Synthetic service state (labelled: these are NOT camera outputs)
// ---------------------------------------------------------------------------

const m = <T>(value: T | null, reason: string | null = null) => ({ value, reason: value === null ? (reason ?? 'unavailable') : null })

function derived(over: {
  attention?: DerivedState['attention_state']
  fresh?: boolean
  valid?: boolean
  calibration?: DerivedState['vision']['calibration_status']
  awayMs?: number | null
  visionAdaptation?: DerivedState['policy']['vision_adaptation']
  hold?: boolean
  simulated?: boolean
} = {}): DerivedState {
  const valid = over.valid ?? true
  return {
    attention_state: over.attention ?? 'HEAD_TOWARD_SCREEN',
    attention_reason: 'synthetic',
    vision: {
      fresh: over.fresh ?? true,
      simulated: over.simulated ?? false,
      observation_age_ms: 40,
      producer_id: 'p',
      tracking_status: valid ? 'tracking' : 'no_face',
      tracking_valid: valid,
      tracking_quality: m(valid ? 0.9 : null, 'no_face'),
      calibration_status: over.calibration ?? 'calibrated',
      head_yaw_deg: m(valid ? 3 : null, 'no_face'),
      head_pitch_deg: m(valid ? -2 : null, 'no_face'),
      head_roll_deg: m(null, 'transformation_matrix_unavailable'),
      head_facing_score: m(valid ? 0.8 : null, 'no_face'),
      head_away_ms: m(over.awayMs === undefined ? 0 : over.awayMs, 'no_face'),
      eye_openness_left: m(1),
      eye_openness_right: m(1),
      eyes_closed: m(false),
      eyes_closed_ms: m(0),
      processed_fps: 15,
      inference_ms: 12
    },
    gameplay: {
      paused: false,
      expected_idle: false,
      current_task_id: null,
      inactivity_ms: m(0),
      tasks_completed: 0,
      answers_total: 0,
      recent_accuracy: m(null, 'no_answers'),
      recent_response_ms_median: m(null, 'no_response_times')
    },
    task_engagement_score: { value: null, reason: 'insufficient_gameplay_history', components: {} },
    policy: {
      vision_adaptation: over.visionAdaptation ?? 'active',
      vision_hold_reason: null,
      hold_new_instructions: over.hold ?? false,
      hold_reason: null
    }
  }
}

const adapterState = (state: DerivedState | null, over: Partial<AdapterState> = {}): AdapterState => ({
  connection: 'open',
  stale: false,
  state,
  stateSeq: 1,
  receivedAt: 0,
  visionAdaptationEnabled: true,
  ...over
})

const processor = (tracking: ProcessorStatus['tracking'] = 'tracking', calibration: ProcessorStatus['calibration'] = 'calibrated'): ProcessorStatus => ({
  tracking,
  calibration,
  calibrationPhase: 'idle',
  calibrationProgress: null,
  calibrationReason: null,
  lockedFaceIndex: 0
})

function snap(over: Partial<SnapshotInputs> = {}): CameraSnapshot {
  return buildSnapshot({
    at: 0,
    sessionId: 's1',
    adapter: adapterState(derived()),
    serviceReason: null,
    observer: { kind: 'running', backend: 'worker', delegate: 'GPU' },
    processor: processor(),
    perf: { backend: 'worker', delegate: 'GPU', inference_ms: 12, processed_fps: 15, dropped_frames: 0 },
    adaptationEnabled: true,
    pending: null,
    error: null,
    ...over
  })
}

// ---------------------------------------------------------------------------
// 1. Schema translation and the vision gate
// ---------------------------------------------------------------------------

{
  const s = snap()
  ok(s.visionUsable, 'snapshot: open + fresh + calibrated + tracking + service active → vision usable')
  eq(s.phase, 'ready', 'snapshot: calibrated running camera → phase ready')
  eq(s.vision?.headRollDeg.value, null, 'snapshot: an unavailable measurement stays null …')
  eq(s.vision?.headRollDeg.reason, 'transformation_matrix_unavailable', 'snapshot: … with its reason intact')
  eq(s.vision?.headFacingScore.value, 0.8, 'snapshot: head-facing score copied verbatim (not rescaled)')
  eq(s.engagement?.value, null, 'snapshot: engagement stays null with its reason until there is history')

  const stale = snap({ adapter: adapterState(derived(), { stale: true, state: null }) })
  eq(stale.vision, null, 'snapshot: stale link → vision null, never a remembered favourable value')
  eq(stale.visionBlockedReason, 'state_stale', 'snapshot: stale link blocks vision adaptation')

  eq(snap({ adaptationEnabled: false }).visionBlockedReason, 'adaptation_disabled', 'gate: switch off wins first')
  eq(snap({ adapter: adapterState(derived(), { connection: 'reconnecting' }) }).visionBlockedReason, 'service_reconnecting', 'gate: service reconnecting holds')
  eq(snap({ adapter: adapterState(derived({ fresh: false })) }).visionBlockedReason, 'vision_stale', 'gate: stale observations hold')
  eq(snap({ adapter: adapterState(derived({ calibration: 'required' })) }).visionBlockedReason, 'not_calibrated', 'gate: calibration required holds')
  eq(snap({ processor: processor('tracking', 'uncalibrated') }).visionBlockedReason, 'not_calibrated', 'gate: local calibration must agree')
  eq(snap({ adapter: adapterState(derived({ valid: false })) }).visionBlockedReason, 'tracking_no_face', 'gate: face lost holds')
  ok(snap({ adapter: adapterState(derived({ visionAdaptation: 'held' })) }).visionBlockedReason?.startsWith('service_vision_held') ?? false, 'gate: service hold respected')
  eq(snap({ observer: { kind: 'suspended', reason: 'tab_hidden' } }).visionBlockedReason, 'camera_suspended', 'gate: hidden tab holds')
  eq(snap({ observer: null, processor: null }).visionBlockedReason, 'camera_off', 'gate: camera off holds')
  eq(snap({ error: { code: 'permission_denied', message: 'x' } }).phase, 'error', 'snapshot: camera error → phase error')
  eq(snap({ processor: processor('tracking', 'uncalibrated') }).phase, 'needs_calibration', 'snapshot: uncalibrated → needs_calibration')
  eq(snap({ adapter: adapterState(derived({ simulated: true })) }).vision?.simulated, true, 'snapshot: simulated flag carried through')
}

// ---------------------------------------------------------------------------
// 2. Adaptation policy — the game is the authority
// ---------------------------------------------------------------------------

function policyRig(config: Partial<typeof DEFAULT_ADAPTATION_CONFIG> = {}) {
  const calls = { hold: [] as number[], cue: 0, hint: 0 }
  let cueResult = true
  let hintResult = true
  const policy = new AdaptationPolicy(
    {
      holdInstruction: (ms) => calls.hold.push(ms),
      gentleCue: () => (calls.cue++, cueResult),
      requestHint: () => (calls.hint++, hintResult)
    },
    { config, sessionId: () => 's1' }
  )
  const ctx = (over: Partial<GameContext> = {}): GameContext => ({
    now: 10_000,
    gameState: 'exploring',
    attemptId: 'mira-water-a1',
    taskId: 'water:1',
    stepIndex: 1,
    stepAgeMs: 20_000,
    msSinceAnswer: null,
    hintLevel: 0,
    ...over
  })
  let n = 0
  const sug = (over: Partial<CameraSuggestion> = {}): CameraSuggestion => ({
    id: `a${++n}`,
    action: 'delay_instruction',
    source: 'vision',
    taskId: null,
    reason: 'synthetic',
    evidence: { max_delay_ms: 8000 },
    receivedAt: 10_000,
    expiresInMs: 15_000,
    ...over
  })
  return {
    policy, calls, ctx, sug,
    setCue: (v: boolean) => { cueResult = v },
    setHint: (v: boolean) => { hintResult = v }
  }
}

const away = snap({ adapter: adapterState(derived({ attention: 'HEAD_AWAY', awayMs: 7000, hold: true })) })
const toward = snap()

{
  const { policy, calls, ctx, sug } = policyRig()
  eq(policy.consider(sug(), ctx(), away), 'applied', 'policy: delay_instruction applied with usable vision')
  eq(calls.hold[0], 8000, 'policy: hold length from evidence.max_delay_ms')
  const first = policy.records[0]
  eq(first.decision, 'applied', 'policy: applied decisions are recorded')
  ok(first.evidence.max_delay_ms === 8000 && first.vision.usable && first.cooldownRemainingMs.delay_instruction === 5000,
    'policy: the record carries evidence, the vision gate and cooldown state')

  eq(policy.consider(sug(), ctx({ now: 11_000 }), away), 'rejected', 'policy: second delay inside the cooldown …')
  eq(policy.records[1].reason, 'cooldown', 'policy: … is rejected as cooldown')
  eq(policy.consider(sug({ receivedAt: 16_000 }), ctx({ now: 16_000 }), away), 'applied', 'policy: after the cooldown it applies again')

  const dup = sug({ receivedAt: 30_000 })
  policy.consider(dup, ctx({ now: 30_000 }), away)
  const before = calls.hold.length
  eq(policy.consider(dup, ctx({ now: 30_100 }), away), 'rejected', 'policy: the same suggestion id twice …')
  eq(calls.hold.length, before, 'policy: … never applies twice')
  eq(policy.records[policy.records.length - 1].reason, 'duplicate', 'policy: … and is recorded as duplicate')

  eq(policy.consider(sug({ evidence: { max_delay_ms: 60_000 }, receivedAt: 50_000 }), ctx({ now: 50_000 }), away), 'applied', 'policy: long hold request applied …')
  eq(calls.hold[calls.hold.length - 1], 10_000, 'policy: … but capped at maxInstructionHoldMs')
}

{
  const { policy, calls, ctx, sug } = policyRig()
  const blocked = snap({ adapter: adapterState(derived({ valid: false })) })
  eq(policy.consider(sug(), ctx(), blocked), 'rejected', 'policy: vision suggestion with face lost is rejected')
  eq(policy.records[0].reason, 'vision_unusable:tracking_no_face', 'policy: the reason names the gate')
  const uncal = snap({ adapter: adapterState(derived({ calibration: 'uncalibrated' })) })
  policy.consider(sug(), ctx(), uncal)
  eq(policy.records[1].reason, 'vision_unusable:not_calibrated', 'policy: uncalibrated vision is rejected')
  const stale = snap({ adapter: adapterState(null, { stale: true }) })
  policy.consider(sug(), ctx(), stale)
  eq(policy.records[2].reason, 'vision_unusable:state_stale', 'policy: stale/disconnected input cannot adapt')
  const sim = snap({ adapter: adapterState(derived({ simulated: true, hold: true, attention: 'HEAD_AWAY' })) })
  policy.consider(sug(), ctx(), sim)
  eq(policy.records[3].reason, 'simulated_vision', 'policy: simulated vision is refused by default')
  eq(calls.hold.length, 0, 'policy: none of those changed the game')
  const off = snap({ adaptationEnabled: false })
  policy.consider(sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1' }), ctx(), off)
  eq(policy.records[4].reason, 'adaptation_disabled', 'policy: switch off rejects gameplay suggestions too')

  const { policy: p2, calls: c2, ctx: x2, sug: s2 } = policyRig({ allowSimulatedVision: true })
  eq(p2.consider(s2(), x2(), sim), 'applied', 'policy: tests may opt in to simulated vision explicitly')
  ok(p2.records[0].vision.simulated && c2.hold.length === 1, 'policy: … and the record says it was simulated')
}

{
  const { policy, calls, ctx, sug } = policyRig()
  policy.consider(sug({ action: 'offer_hint', source: 'vision', taskId: 'water:1' }), ctx(), away)
  eq(policy.records[0].reason, 'requires_gameplay_evidence', 'policy: a hint never comes from head direction alone')
  policy.consider(sug({ action: 'increase_difficulty', source: 'gameplay' }), ctx(), toward)
  eq(policy.records[1].reason, 'no_difficulty_mechanism', 'policy: Memoria has no difficulty setting — recorded, nothing changed')
  policy.consider(sug({ action: 'increase_difficulty', source: 'vision' }), ctx(), away)
  eq(policy.records[2].reason, 'requires_gameplay_evidence', 'policy: difficulty never follows vision')
  policy.consider(sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:0' }), ctx(), toward)
  eq(policy.records[3].reason, 'stale_task', 'policy: a suggestion for another task is stale')
  policy.consider(sug({ action: 'gentle_cue', source: 'vision+gameplay', taskId: 'water:1' }), ctx({ gameState: 'completed', taskId: null }), away)
  eq(policy.records[4].reason, 'no_active_gameplay', 'policy: nothing applies on the level list / summary')
  eq(calls.hint + calls.cue, 0, 'policy: none of those touched the runner')
}

{
  // Safe points: a hint waits for the answer to settle; a cue waits for the step to settle.
  const { policy, calls, ctx, sug } = policyRig()
  const hint = sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1' })
  eq(policy.consider(hint, ctx({ gameState: 'answering', msSinceAnswer: 80 }), toward), 'deferred', 'policy: hint right after an answer is deferred')
  eq(calls.hint, 0, 'policy: … nothing changed under the click')
  policy.tick(ctx({ gameState: 'answering', msSinceAnswer: 600, now: 10_520 }), toward)
  eq(calls.hint, 0, 'policy: still settling at 600 ms')
  policy.tick(ctx({ gameState: 'answering', msSinceAnswer: 1300, now: 11_220 }), toward)
  eq(calls.hint, 1, 'policy: applied at the safe point')
  eq(policy.records[0].decision, 'applied', 'policy: the deferred hint is recorded as applied …')
  ok(policy.records[0].deferredMs >= 1200, 'policy: … with how long it waited')
  eq(policy.pendingCount, 0, 'policy: nothing left pending')

  const hint2 = sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1', receivedAt: 50_000 })
  policy.consider(hint2, ctx({ now: 50_000 }), toward)
  eq(policy.records[1].reason, 'step_limit', 'policy: one hint offer per step')

  const cue = sug({ action: 'gentle_cue', source: 'vision+gameplay', taskId: 'water:1' })
  eq(policy.consider(cue, ctx({ stepAgeMs: 1000 }), away), 'deferred', 'policy: cue in the first seconds of a step is deferred')
  policy.tick(ctx({ stepAgeMs: 6000, now: 11_000 }), toward)
  eq(policy.records[2].reason, 'evidence_no_longer_holds', 'policy: head back by the safe point → cue dropped')
  eq(calls.cue, 0, 'policy: no cue was given')

  const cue2 = sug({ action: 'gentle_cue', source: 'vision+gameplay', taskId: 'water:1', receivedAt: 12_000 })
  policy.consider(cue2, ctx({ now: 12_000 }), away)
  eq(calls.cue, 1, 'policy: a cue with usable vision in a settled step applies')
}

{
  // Pause defers (never counts as inactivity); expiry and level changes clear.
  const { policy, calls, ctx, sug } = policyRig()
  const cue = sug({ action: 'gentle_cue', source: 'vision+gameplay', taskId: 'water:1' })
  eq(policy.consider(cue, ctx({ gameState: 'paused' }), away), 'deferred', 'policy: paused → deferred, not applied')
  policy.tick(ctx({ gameState: 'exploring', now: 12_000 }), away)
  eq(calls.cue, 1, 'policy: applied after resume if the evidence still holds')

  const hint = sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1' })
  policy.consider(hint, ctx({ gameState: 'paused' }), toward)
  policy.tick(ctx({ gameState: 'paused', now: 10_000 + DEFAULT_ADAPTATION_CONFIG.maxDeferMs + 1 }), toward)
  eq(policy.records[policy.records.length - 1].reason, 'expired', 'policy: a suggestion deferred too long expires')

  const h2 = sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1' })
  policy.consider(h2, ctx({ msSinceAnswer: 10 }), toward)
  policy.clearPending('level_changed', ctx(), toward)
  eq(policy.records[policy.records.length - 1].reason, 'level_changed', 'policy: a level change drops pending suggestions')
  eq(calls.hint, 0, 'policy: … without applying them')
}

{
  const { policy, ctx, sug, setHint, setCue } = policyRig()
  setHint(false)
  policy.consider(sug({ action: 'offer_hint', source: 'gameplay', taskId: 'water:1' }), ctx(), toward)
  eq(policy.records[0].reason, 'hint_ladder_exhausted', 'policy: the runner refusing a hint is recorded')
  setCue(false)
  policy.consider(sug({ action: 'gentle_cue', source: 'vision+gameplay', taskId: 'water:1' }), ctx(), away)
  eq(policy.records[1].reason, 'cue_not_applicable', 'policy: the runner refusing a cue is recorded')
}

// ---------------------------------------------------------------------------
// 3. Telemetry → service game events (VisionBridge)
// ---------------------------------------------------------------------------

{
  const sent: GameEventInput[] = []
  let clock = 0
  const bridge = new VisionBridge({ sink: { sendGameEvent: (e) => (sent.push(e), 'id') }, clock: () => clock })
  const feed = (e: Event): void => bridge.handleEvent(e)
  feed({ t: 0, kind: 'mission_start', id: 'water' })
  feed({ t: 10, kind: 'step_start', step: 0, type: 'navigate' })
  eq(sent[0]?.event_type, 'task_started', 'bridge: step_start → task_started')
  eq(sent[0]?.task_id, 'water:0', 'bridge: task id is <mission>:<step>')
  clock = 500
  bridge.activity('moved')
  bridge.activity('moved')
  eq(sent.filter((e) => e.event_type === 'player_activity').length, 1, 'bridge: input activity is throttled')
  feed({ t: 900, kind: 'step_end', step: 0, type: 'navigate', outcome: 'independent' })
  eq(sent[sent.length - 1].data?.outcome, 'success', 'bridge: independent → success')
  feed({ t: 1000, kind: 'step_start', step: 1, type: 'recall' })
  feed({ t: 1100, kind: 'question_shown', step: 1 })
  feed({ t: 3100, kind: 'answer_selected', choice: 'bina', correct: false })
  const ans = sent[sent.length - 1]
  ok(ans.event_type === 'answer_submitted' && ans.data?.correct === false && ans.data?.response_ms === 2000,
    'bridge: response time measured from question_shown (§4.4 answerLatency)')
  eq(bridge.currentTask?.lastAnswerAt, 3100, 'bridge: last answer time kept for the policy’s safe point')
  feed({ t: 4100, kind: 'hint_shown', level: 1, step: 1 })
  eq(sent[sent.length - 1].data?.hint_level, 1, 'bridge: hint_shown forwarded with its level')
  feed({ t: 4200, kind: 'pause' })
  feed({ t: 4200, kind: 'resume' })
  ok(sent.slice(-2).map((e) => e.event_type).join() === 'paused,resumed', 'bridge: pause/resume forwarded')
  feed({ t: 5000, kind: 'step_end', step: 1, type: 'recall', outcome: 'cued' })
  eq(sent[sent.length - 1].data?.outcome, 'success_with_help', 'bridge: cued → success_with_help')
  feed({ t: 5100, kind: 'step_start', step: 2, type: 'find' })
  feed({ t: 5200, kind: 'restart' })
  eq(sent[sent.length - 1].event_type, 'task_skipped', 'bridge: restart closes the open task as skipped')
  eq(bridge.currentTaskId, null, 'bridge: no task open after restart')
  // New attempt: the game clock restarts from 0, the service clock must not go backwards.
  feed({ t: 0, kind: 'mission_start', id: 'water' })
  feed({ t: 5, kind: 'step_start', step: 0, type: 'navigate' })
  const stamps = sent.map((e) => e.client_ts_ms ?? -1)
  ok(stamps.every((t, i) => i === 0 || t >= stamps[i - 1]), 'bridge: client_ts_ms stays monotonic across attempts')
  bridge.expectedIdle(true)
  bridge.expectedIdle(true)
  bridge.expectedIdle(false)
  eq(sent.filter((e) => e.event_type.startsWith('expected_idle')).length, 2, 'bridge: hidden-tab idle markers sent once each')
  const n = sent.length
  bridge.dispose()
  feed({ t: 10, kind: 'step_end', step: 0, type: 'navigate', outcome: 'skipped' })
  eq(sent.length, n, 'bridge: nothing is sent after dispose')
  eq(taskIdFor('a b/c', 3), 'a_b_c:3', 'bridge: mission ids are sanitised for the service')
}

// ---------------------------------------------------------------------------
// 4. Instruction hold — speech waits in bounded time, never forever
// ---------------------------------------------------------------------------

{
  let now = 0
  const timers: { at: number; fn: () => void }[] = []
  const hold = new InstructionHold({
    now: () => now,
    setTimer: (fn, ms) => { const t = { at: now + ms, fn }; timers.push(t); return t },
    clearTimer: (h) => { const i = timers.indexOf(h as never); if (i >= 0) timers.splice(i, 1) }
  })
  const spoken: string[] = []
  hold.gate(() => spoken.push('a'))
  eq(spoken.join(), 'a', 'hold: not holding → speaks at once')
  hold.open(8000)
  hold.gate(() => spoken.push('b'))
  eq(spoken.join(), 'a', 'hold: holding → speech waits')
  hold.release()
  eq(spoken.join(), 'a,b', 'hold: head back → speaks now')
  hold.open(50_000)
  hold.gate(() => spoken.push('c'))
  eq(timers[0]?.at, 10_000, 'hold: capped at 10 s whatever the service asks')
  now = 10_000
  timers.shift()?.fn()
  eq(spoken.join(), 'a,b,c', 'hold: times out and speaks')
  hold.open(5000)
  hold.gate(() => spoken.push('d'))
  hold.cancel()
  eq(timers.length, 0, 'hold: cancel clears its timer')
  eq(spoken.join(), 'a,b,c', 'hold: cancel drops held speech (level changed)')
}

// ---------------------------------------------------------------------------
// 5. CameraAdapter lifecycle, against fakes of the camera app's classes
// ---------------------------------------------------------------------------

const world = {
  sessionsCreated: 0,
  sessionsDeleted: 0,
  createFails: false,
  observerError: null as null | 'permission_denied' | 'model_load_failed',
  consumers: [] as FakeConsumer[],
  producers: [] as FakeProducer[],
  observers: [] as FakeObserver[]
}

class Listeners<T> {
  set = new Set<(v: T) => void>()
  on(cb: (v: T) => void): () => void {
    this.set.add(cb)
    return () => { this.set.delete(cb) }
  }
  emit(v: T): void {
    for (const cb of [...this.set]) cb(v)
  }
}

class FakeConsumer {
  state = new Listeners<AdapterState>()
  actions = new Listeners<SuggestedActionMessage>()
  gestures = new Listeners<unknown>()
  statusL = new Listeners<{ status: string; reason: string | null; attempt: number }>()
  connected = false
  disconnected = 0
  events: GameEventInput[] = []
  vision: boolean[] = []
  latest: AdapterState = adapterState(derived())
  constructor(public opts: { visionAdaptationEnabled?: boolean }) {
    world.consumers.push(this)
  }
  async connect(): Promise<void> { this.connected = true }
  disconnect(): void { this.disconnected++; this.connected = false }
  getLatestState(): AdapterState { return this.connected ? this.latest : { ...this.latest, connection: 'closed', stale: true, state: null } }
  sendGameEvent(e: GameEventInput): string { this.events.push(e); return `e${this.events.length}` }
  onState(cb: (s: AdapterState) => void) { return this.state.on(cb) }
  onGesture(cb: (g: unknown) => void) { return this.gestures.on(cb) }
  onSuggestedAction(cb: (a: SuggestedActionMessage) => void) { return this.actions.on(cb) }
  onConnectionStatus(cb: (e: { status: string; reason: string | null; attempt: number }) => void) { return this.statusL.on(cb) }
  setVisionAdaptationEnabled(on: boolean): void { this.vision.push(on) }
  get listenerCount(): number { return this.state.set.size + this.actions.set.size + this.gestures.set.size + this.statusL.set.size }
}

class FakeProducer {
  submitted: ObservationBody[] = []
  connected = false
  disconnected = 0
  statusL = new Listeners<unknown>()
  constructor() { world.producers.push(this) }
  async connect(): Promise<void> { this.connected = true }
  disconnect(): void { this.disconnected++; this.connected = false }
  submit(b: ObservationBody): void { this.submitted.push(b) }
  onStatus(cb: (e: unknown) => void) { return this.statusL.on(cb) }
  onError() { return () => {} }
  get status() { return this.connected ? 'open' : 'closed' }
  get stats() { return { sent: this.submitted.length, acked: 0, duplicates: 0, rejected: 0, droppedStale: 0 } }
}

class FakeObserver {
  obs = new Listeners<ObservationBody>()
  statusL = new Listeners<ObserverStatus>()
  proc = new Listeners<ProcessorStatus>()
  status: ObserverStatus = { kind: 'idle' }
  stopped = 0
  calibrations = 0
  constructor() { world.observers.push(this) }
  async start(): Promise<void> {
    this.status = { kind: 'starting' }
    this.statusL.emit(this.status)
    await tick()
    if (world.observerError) {
      this.status = { kind: 'error', code: world.observerError, message: 'fake' }
      this.statusL.emit(this.status)
      throw new Error('fake camera error')
    }
    this.status = { kind: 'running', backend: 'worker', delegate: 'GPU' }
    this.statusL.emit(this.status)
    this.proc.emit(processor('tracking', 'uncalibrated'))
  }
  stop(): void { this.stopped++; this.status = { kind: 'stopped' } }
  startCalibration(): void { this.calibrations++ }
  cancelCalibration(): void {}
  setOverlayEnabled(): void {}
  setMirrorPreview(): void {}
  onObservation(cb: (b: ObservationBody) => void) { return this.obs.on(cb) }
  onStatus(cb: (s: ObserverStatus) => void) { return this.statusL.on(cb) }
  onProcessorStatus(cb: (s: ProcessorStatus) => void) { return this.proc.on(cb) }
  get perf() { return { backend: 'worker' as const, delegate: 'GPU' as const, inference_ms: 10, processed_fps: 15, dropped_frames: 0 } }
  get observerStatus() { return this.status }
  get listenerCount(): number { return this.obs.set.size + this.statusL.set.size + this.proc.set.size }
}

const fakeRuntime = {
  createSession: async () => {
    if (world.createFails) throw new Error('network_error')
    world.sessionsCreated++
    return { session_id: `s${world.sessionsCreated}`, consumer_token: 'c', producer_token: 'p' }
  },
  deleteSession: async () => { world.sessionsDeleted++ },
  GameAdapter: FakeConsumer,
  ProducerConnection: FakeProducer,
  FaceObserver: FakeObserver
}
const loadRuntime = async () => fakeRuntime as never
const video = {} as HTMLVideoElement
const body = { capture_ts_ms: 1 } as unknown as ObservationBody

{
  const a = new CameraAdapter({ baseUrl: 'http://127.0.0.1:1', loadRuntime })
  let threw = false
  try { new CameraAdapter({ baseUrl: 'http://127.0.0.1:1', loadRuntime }) } catch { threw = true }
  ok(threw, 'adapter: a second live adapter is refused (one capture, one pipeline per page)')

  eq(a.getLatestState().phase, 'off', 'adapter: off before connect')
  await a.connect()
  await a.connect()
  eq(world.sessionsCreated, 1, 'adapter: connect twice → one session')
  eq(world.consumers.length, 1, 'adapter: one consumer socket')
  ok(a.getLatestState().service.status === 'open', 'adapter: service link open')

  const suggestions: CameraSuggestion[] = []
  const offS = a.onSuggestion((s) => suggestions.push(s))
  world.consumers[0].actions.emit({
    type: 'suggested_action', schema_version: '1.0', session_id: 's1', event_seq: 1, action_id: 'x1',
    action: 'gentle_cue', source: 'vision+gameplay', task_id: 'water:1', reason: 'r', evidence: { inactivity_ms: 11000 },
    server_ts_ms: 0, expires_in_ms: 15000
  })
  ok(suggestions.length === 1 && suggestions[0].id === 'x1' && suggestions[0].evidence.inactivity_ms === 11000,
    'adapter: a real-shaped suggested_action reaches the game as a CameraSuggestion')
  offS()
  eq(a.sendGameEvent({ event_type: 'paused' }), 'e1', 'adapter: game events go out on the consumer socket')

  await a.startCamera(video)
  await a.startCamera(video)
  eq(world.observers.length, 1, 'adapter: startCamera twice → one FaceObserver')
  eq(world.producers.length, 1, 'adapter: one producer socket')
  eq(a.getLatestState().phase, 'needs_calibration', 'adapter: running but uncalibrated → needs_calibration')
  a.calibrate()
  eq(world.observers[0].calibrations, 1, 'adapter: calibrate() runs the camera app’s own calibration')
  world.observers[0].obs.emit(body)
  eq(world.producers[0].submitted.length, 1, 'adapter: observations flow FaceObserver → ProducerConnection')

  // Restart the camera three times: never two at once, nothing left subscribed.
  for (let i = 0; i < 3; i++) {
    a.stopCamera()
    const o = world.observers[world.observers.length - 1]
    const p = world.producers[world.producers.length - 1]
    ok(o.stopped === 1 && o.listenerCount === 0, `adapter: stop #${i + 1} stops the observer and drops its listeners`)
    ok(!p.connected, `adapter: stop #${i + 1} closes the producer socket`)
    await a.startCamera(video)
    const live = world.observers.filter((x) => x.status.kind === 'running').length
    eq(live, 1, `adapter: restart #${i + 1} → exactly one running capture`)
  }
  eq(world.consumers.length, 1, 'adapter: camera restarts never open another consumer socket')

  a.setAdaptationEnabled(false)
  eq(world.consumers[0].vision[world.consumers[0].vision.length - 1], false, 'adapter: adaptation switch reaches the service')
  eq(a.getLatestState().visionBlockedReason, 'adaptation_disabled', 'adapter: … and closes the vision gate')

  await a.dispose()
  const last = world.observers[world.observers.length - 1]
  ok(last.stopped === 1 && last.listenerCount === 0, 'adapter: dispose stops the camera')
  ok(world.consumers[0].disconnected === 1 && world.consumers[0].listenerCount === 0, 'adapter: dispose closes the consumer and unsubscribes')
  eq(world.sessionsDeleted, 1, 'adapter: dispose deletes the service session')
  eq(a.sendGameEvent({ event_type: 'resumed' }), null, 'adapter: nothing is sent after dispose')
  await a.dispose()
  eq(world.sessionsDeleted, 1, 'adapter: dispose is idempotent')

  const b = new CameraAdapter({ baseUrl: 'http://127.0.0.1:1', loadRuntime })
  ok(true, 'adapter: a new adapter is allowed once the old one is disposed (new session)')
  await b.connect()
  eq(b.sessionId, 's2', 'adapter: a new session gets a new identity')
  let injectRefused = false
  try { await b.injectObservation(body) } catch { injectRefused = true }
  ok(injectRefused, 'adapter: synthetic injection is refused unless explicitly allowed')

  world.observerError = 'permission_denied'
  await b.startCamera(video)
  await tick()
  const s = b.getLatestState()
  eq(s.phase, 'error', 'adapter: permission denied → phase error')
  eq(s.error?.code, 'permission_denied', 'adapter: … with the camera app’s own code')
  const denied = world.observers[world.observers.length - 1]
  ok(denied.stopped >= 1 && denied.listenerCount === 0, 'adapter: … and the camera pipeline is released')
  eq(s.service.status, 'open', 'adapter: the service link (and the game) carry on')
  ok(!s.visionUsable, 'adapter: vision adaptation holds while the camera is in error')
  world.observerError = null
  await b.startCamera(video)
  eq(b.getLatestState().phase, 'needs_calibration', 'adapter: retry after the error starts the camera again')
  await b.dispose()

  world.createFails = true
  const c = new CameraAdapter({ baseUrl: 'http://127.0.0.1:1', loadRuntime })
  let failed = false
  try { await c.connect() } catch { failed = true }
  const cs = c.getLatestState()
  ok(failed && cs.phase === 'error' && cs.error?.code === 'service_unreachable', 'adapter: service not running → service_unreachable')
  eq(cs.service.status, 'offline', 'adapter: … and no consumer is left behind')
  await c.dispose()
  world.createFails = false

  const d = new CameraAdapter({ baseUrl: 'http://127.0.0.1:1', loadRuntime, allowInjection: true })
  await d.connect()
  await d.injectObservation({ ...body, simulated: false, tracking: { status: 'tracking', valid: true, reason: null, face_count: 1, multiple_faces_visible: false, quality: m(0.9) }, calibration: { status: 'calibrated', reason: null, progress: null }, perf: null } as ObservationBody)
  const injected = world.producers[world.producers.length - 1].submitted[0]
  eq(injected.simulated, true, 'adapter: injected observations are always labelled simulated')
  let noTwo = false
  try { await d.startCamera(video) } catch { noTwo = true }
  ok(noTwo || world.observers.filter((o) => o.status.kind === 'running').length === 0, 'adapter: injection and the webcam never run together')
  await d.dispose()
}

// ---------------------------------------------------------------------------

if (failures.length === 0) {
  console.log(`ALL CHECKS PASSED (${checks})`)
} else {
  console.log(`${failures.length} of ${checks} checks FAILED:\n`)
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exitCode = 1
}
