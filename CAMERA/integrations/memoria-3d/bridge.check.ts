/**
 * Headless check for VisionBridge — no framework, no network, no camera.
 *
 *   node integrations/memoria-3d/bridge.check.ts
 *
 * Node >= 23.6 strips the type annotations; everything here is erasable syntax and the
 * bridge's own imports are type-only, so nothing outside this folder is loaded.
 */

import {
  CAMERA_ASSIST_STORAGE_KEY,
  InstructionHold,
  VisionBridge,
  readCameraAssist,
  taskIdFor,
  writeCameraAssist,
  type DelayInstructionSuggestion,
  type StorageLike,
  type Suggestion
} from './VisionBridge.ts'
import type { Event } from '../Telemetry.ts'
import type { AdapterState, GameAdapterApi } from './vendor/transport/contracts.ts'
import type { GameEventInput, SuggestedActionMessage } from './vendor/protocol/types.ts'

let passed = 0
let failed = 0
function ok(condition: boolean, label: string, detail?: unknown): void {
  if (condition) {
    passed++
    console.log(`  ok   ${label}`)
  } else {
    failed++
    console.log(`  FAIL ${label}`, detail === undefined ? '' : JSON.stringify(detail))
  }
}
function eq(actual: unknown, expected: unknown, label: string): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  ok(a === e, label, a === e ? undefined : { actual, expected })
}

// --- Fake adapter ----------------------------------------------------------------------

interface FakeAdapter extends GameAdapterApi {
  sent: GameEventInput[]
  visionCalls: boolean[]
  subscribers: number
  emit(a: Partial<SuggestedActionMessage> & Pick<SuggestedActionMessage, 'action' | 'source'>): void
}

function fakeAdapter(): FakeAdapter {
  const actionCbs = new Set<(a: SuggestedActionMessage) => void>()
  let seq = 0
  const state: AdapterState = {
    connection: 'open',
    stale: false,
    state: null,
    stateSeq: null,
    receivedAt: null,
    visionAdaptationEnabled: false
  }
  const fake: FakeAdapter = {
    sent: [],
    visionCalls: [],
    get subscribers() {
      return actionCbs.size
    },
    connect: async () => {},
    disconnect: () => {},
    getLatestState: () => state,
    sendGameEvent(event) {
      fake.sent.push(event)
      return `e${fake.sent.length}`
    },
    onState: () => () => {},
    onGesture: () => () => {},
    onSuggestedAction(cb) {
      actionCbs.add(cb)
      return () => actionCbs.delete(cb)
    },
    onConnectionStatus: () => () => {},
    setVisionAdaptationEnabled(enabled) {
      fake.visionCalls.push(enabled)
    },
    emit(partial) {
      seq++
      const message: SuggestedActionMessage = {
        type: 'suggested_action',
        schema_version: '1.0',
        session_id: 's',
        event_seq: seq,
        action_id: `a${seq}`,
        task_id: null,
        reason: 'r',
        evidence: {},
        server_ts_ms: 0,
        expires_in_ms: 1000,
        ...partial
      }
      for (const cb of actionCbs) cb(message)
    }
  }
  return fake
}

function setup(visionAdaptationEnabled = false) {
  const adapter = fakeAdapter()
  const calls: { kind: string; s: Suggestion }[] = []
  let now = 0
  const bridge = new VisionBridge({
    adapter,
    clock: () => now,
    visionAdaptationEnabled,
    callbacks: {
      onDelayInstruction: (s: DelayInstructionSuggestion) => calls.push({ kind: 'delay', s }),
      onGentleCue: (s) => calls.push({ kind: 'cue', s }),
      onOfferHint: (s) => calls.push({ kind: 'hint', s })
    }
  })
  return { adapter, bridge, calls, setNow: (t: number) => { now = t } }
}

const types = (sent: GameEventInput[]) => sent.map((e) => e.event_type)

// --- 1. Event mapping ------------------------------------------------------------------

console.log('\n── event mapping')
{
  const { adapter, bridge } = setup()
  const events: Event[] = [
    { t: 0, kind: 'mission_start', id: 'water' },
    { t: 1, kind: 'step_start', step: 0, type: 'navigate', },
    { t: 500, kind: 'room_enter', room: 'kitchen' },
    { t: 501, kind: 'step_end', step: 0, type: 'navigate', outcome: 'independent' },
    { t: 502, kind: 'step_start', step: 1, type: 'find' },
    { t: 900, kind: 'object_dwell', id: 'jug', ms: 300 },
    { t: 1000, kind: 'object_dwell', id: 'radio', ms: 300 }, // rate-limited
    { t: 1500, kind: 'object_interact', id: 'door', correct: false },
    { t: 20600, kind: 'hint_shown', level: 1, step: 1 },
    { t: 21000, kind: 'object_interact', id: 'jug', correct: true },
    { t: 21000, kind: 'step_end', step: 1, type: 'find', outcome: 'cued' },
    { t: 21001, kind: 'step_start', step: 2, type: 'recall' },
    { t: 21001, kind: 'question_shown', step: 2 },
    { t: 23001, kind: 'answer_selected', choice: 'bina', correct: false },
    { t: 23500, kind: 'pause' },
    { t: 23500, kind: 'resume' },
    { t: 24001, kind: 'answer_selected', choice: 'ananya', correct: true },
    { t: 24001, kind: 'step_end', step: 2, type: 'recall', outcome: 'independent' },
    { t: 24002, kind: 'mission_complete', id: 'water' }
  ]
  for (const e of events) bridge.handleEvent(e)
  eq(types(adapter.sent), [
    'task_started', 'player_activity', 'task_completed',
    'task_started', 'player_activity', 'player_activity', 'hint_shown', 'player_activity', 'task_completed',
    'task_started', 'answer_submitted', 'paused', 'resumed', 'answer_submitted', 'task_completed'
  ], 'event types in order (mission_start/question_shown/mission_complete send nothing, second dwell rate-limited)')
  eq(adapter.sent[0].task_id, 'water:0', 'task_id is missionId:step')
  eq(adapter.sent[2].data, { outcome: 'success' }, 'independent → task_completed success')
  eq(adapter.sent[8].data, { outcome: 'success_with_help' }, 'cued → success_with_help')
  eq(adapter.sent[6], { event_type: 'hint_shown', task_id: 'water:1', data: { hint_level: 1 }, client_ts_ms: 20600 }, 'hint_shown carries hint_level and task')
  eq(adapter.sent[1].data, { activity: 'room_enter' }, 'room_enter → player_activity')
  eq(adapter.sent[7].data, { activity: 'object_interact' }, 'object_interact → player_activity (no answer event)')
  eq(adapter.sent[10].data, { correct: false, response_ms: 2000 }, 'answer_submitted: correct flag, response from question_shown')
  eq(adapter.sent[13].data, { correct: true, response_ms: 1000 }, 'second answer: response from previous answer')
  eq(adapter.sent[11].task_id ?? null, null, 'paused carries no task')
  const ts = adapter.sent.map((e) => e.client_ts_ms ?? -1)
  ok(ts.every((t, i) => i === 0 || t >= ts[i - 1]), 'client_ts_ms monotonic', ts)
  eq(bridge.currentTaskId, null, 'no open task after the last step_end')
}

{
  const { adapter, bridge } = setup()
  bridge.handleEvent({ t: 0, kind: 'mission_start', id: 'familiar memories!' })
  bridge.handleEvent({ t: 1, kind: 'step_start', step: 2, type: 'recall' })
  bridge.handleEvent({ t: 80000, kind: 'hint_shown', level: 3, step: 2 })
  bridge.handleEvent({ t: 81000, kind: 'answer_selected', choice: 'x', correct: true })
  bridge.handleEvent({ t: 81000, kind: 'step_end', step: 2, type: 'recall', outcome: 'revealed' })
  bridge.handleEvent({ t: 81001, kind: 'step_start', step: 3, type: 'recall' })
  bridge.handleEvent({ t: 81002, kind: 'step_end', step: 3, type: 'recall', outcome: 'skipped' })
  eq(adapter.sent[0].task_id, 'familiar_memories_:2', 'unsafe mission id characters sanitised')
  eq(adapter.sent[2], { event_type: 'player_activity', task_id: 'familiar_memories_:2', data: { activity: 'answer_after_reveal' }, client_ts_ms: 81000 }, 'answer after a reveal is not an answer_submitted')
  eq(adapter.sent[3].data, { outcome: 'revealed' }, 'revealed → task_completed revealed')
  eq([adapter.sent[5].event_type, adapter.sent[5].task_id], ['task_skipped', 'familiar_memories_:3'], 'skipped → task_skipped')
  eq(taskIdFor('water', 0), 'water:0', 'taskIdFor')
}

// --- 2. Restart handling and the monotonic clock ---------------------------------------

console.log('\n── restart')
{
  const { adapter, bridge, setNow } = setup()
  bridge.handleEvent({ t: 0, kind: 'mission_start', id: 'water' })
  bridge.handleEvent({ t: 5, kind: 'step_start', step: 0, type: 'navigate' })
  bridge.handleEvent({ t: 9000, kind: 'restart' })
  eq([adapter.sent[1].event_type, adapter.sent[1].task_id, adapter.sent[1].client_ts_ms], ['task_skipped', 'water:0', 9000], 'restart ends the open task as skipped')
  eq(bridge.currentTaskId, null, 'no open task after restart')
  bridge.handleEvent({ t: 9001, kind: 'restart' })
  eq(adapter.sent.length, 2, 'restart with nothing open sends nothing')
  // State.resetTimers(): the game clock starts from zero again.
  bridge.handleEvent({ t: 0, kind: 'mission_start', id: 'morning-walk' })
  bridge.handleEvent({ t: 3, kind: 'step_start', step: 0, type: 'navigate' })
  eq(adapter.sent[2].task_id, 'morning-walk:0', 'new attempt uses the new mission id')
  ok((adapter.sent[2].client_ts_ms ?? 0) > 9000, 'client_ts_ms stays monotonic across resetTimers()', adapter.sent[2].client_ts_ms)
  // Level list: the runner is reset without an event.
  setNow(50)
  bridge.endOpenTask()
  eq([adapter.sent[3].event_type, adapter.sent[3].task_id], ['task_skipped', 'morning-walk:0'], 'endOpenTask closes as skipped')
  bridge.endOpenTask()
  eq(adapter.sent.length, 4, 'endOpenTask is idempotent')
}
{
  // Turned on mid-step: the step in progress becomes the open task.
  const { adapter, bridge, setNow } = setup()
  setNow(4000)
  bridge.adoptTask('water', 1, 'find')
  eq([adapter.sent[0].event_type, adapter.sent[0].task_id, adapter.sent[0].client_ts_ms], ['task_started', 'water:1', 4000], 'adoptTask opens the current step')
  bridge.adoptTask('water', 2, 'recall')
  eq(adapter.sent.length, 1, 'adoptTask does nothing while a task is open')
  bridge.handleEvent({ t: 4500, kind: 'hint_shown', level: 1, step: 1 })
  bridge.handleEvent({ t: 5000, kind: 'step_end', step: 1, type: 'find', outcome: 'cued' })
  eq(types(adapter.sent), ['task_started', 'hint_shown', 'task_completed'], 'adopted task closes normally')
}

// --- 3. Suggested actions → callbacks ----------------------------------------------------

console.log('\n── suggestions')
{
  const { adapter, bridge, calls } = setup(true)
  bridge.handleEvent({ t: 0, kind: 'mission_start', id: 'water' })
  bridge.handleEvent({ t: 1, kind: 'step_start', step: 1, type: 'find' })

  adapter.emit({ action: 'offer_hint', source: 'gameplay', task_id: 'water:1' })
  adapter.emit({ action: 'gentle_cue', source: 'vision+gameplay', task_id: 'water:1' })
  adapter.emit({ action: 'delay_instruction', source: 'vision', task_id: null, evidence: { max_delay_ms: 6000 } })
  adapter.emit({ action: 'delay_instruction', source: 'vision', task_id: null, evidence: {} })
  eq(calls.map((c) => c.kind), ['hint', 'cue', 'delay', 'delay'], 'each action reaches its callback')
  eq((calls[2].s as DelayInstructionSuggestion).maxDelayMs, 6000, 'delay uses evidence.max_delay_ms')
  eq((calls[3].s as DelayInstructionSuggestion).maxDelayMs, 8000, 'delay without evidence falls back to 8000')

  adapter.emit({ action: 'offer_hint', source: 'gameplay', task_id: 'water:0' })
  adapter.emit({ action: 'gentle_cue', source: 'vision+gameplay', task_id: 'other:1' })
  eq(calls.length, 4, 'stale task_id ignored')
  eq(bridge.suggestions.slice(-2).map((s) => s.fate), ['stale_task', 'stale_task'], 'stale suggestions recorded as stale_task')

  adapter.emit({ action: 'increase_difficulty', source: 'gameplay', task_id: null })
  eq(calls.length, 4, 'increase_difficulty calls nothing by default')
  eq(bridge.suggestions.at(-1)?.fate, 'recorded_only', 'increase_difficulty recorded only')

  bridge.handleEvent({ t: 2, kind: 'step_end', step: 1, type: 'find', outcome: 'independent' })
  adapter.emit({ action: 'offer_hint', source: 'gameplay', task_id: null })
  eq(calls.length, 4, 'offer_hint with no open task ignored')
  eq(bridge.suggestions.at(-1)?.fate, 'no_task', 'recorded as no_task')
}
{
  const adapter = fakeAdapter()
  const bridge = new VisionBridge({
    adapter,
    clock: () => 0,
    visionAdaptationEnabled: true,
    callbacks: {
      onDelayInstruction: () => { throw new Error('boom') },
      onGentleCue: () => {},
      onOfferHint: () => {}
    }
  })
  let threw = false
  try {
    adapter.emit({ action: 'delay_instruction', source: 'vision', task_id: null })
  } catch {
    threw = true
  }
  ok(!threw, 'a throwing callback never reaches the adapter')
  eq(bridge.suggestions.at(-1)?.fate, 'callback_failed', 'recorded as callback_failed')
}

// --- 4. Toggle ---------------------------------------------------------------------------

console.log('\n── toggle')
{
  const { adapter, bridge, calls } = setup()
  eq(bridge.visionAdaptationEnabled, false, 'vision adaptation defaults off')
  bridge.handleEvent({ t: 0, kind: 'mission_start', id: 'water' })
  bridge.handleEvent({ t: 1, kind: 'step_start', step: 0, type: 'navigate' })
  adapter.emit({ action: 'gentle_cue', source: 'vision+gameplay', task_id: 'water:0' })
  adapter.emit({ action: 'delay_instruction', source: 'vision', task_id: null })
  adapter.emit({ action: 'offer_hint', source: 'gameplay', task_id: 'water:0' })
  eq(calls.map((c) => c.kind), ['hint'], 'while off, only gameplay-sourced suggestions pass')
  bridge.setVisionAdaptationEnabled(true)
  eq(adapter.visionCalls, [true], 'setVisionAdaptationEnabled forwards to the adapter')
  adapter.emit({ action: 'delay_instruction', source: 'vision', task_id: null })
  eq(calls.length, 2, 'while on, vision suggestions pass')
  bridge.setVisionAdaptationEnabled(false)
  eq(adapter.visionCalls, [true, false], 'turning off forwards too')

  bridge.dispose()
  eq(adapter.subscribers, 0, 'dispose unsubscribes')
  const before = adapter.sent.length
  bridge.handleEvent({ t: 5, kind: 'room_enter', room: 'kitchen' })
  eq(adapter.sent.length, before, 'nothing is sent after dispose')
}
{
  const store = new Map<string, string>()
  const storage: StorageLike = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, v) }
  }
  eq(readCameraAssist(storage), false, 'preference defaults off')
  writeCameraAssist(true, storage)
  eq([store.get(CAMERA_ASSIST_STORAGE_KEY), readCameraAssist(storage)], ['1', true], 'preference persists on')
  writeCameraAssist(false, storage)
  eq(readCameraAssist(storage), false, 'preference persists off')
  const broken: StorageLike = { getItem: () => { throw new Error('denied') }, setItem: () => { throw new Error('denied') } }
  eq(readCameraAssist(broken), false, 'unreadable storage means off')
  writeCameraAssist(true, broken)
  eq(readCameraAssist(null), false, 'no storage means off')
  eq(CAMERA_ASSIST_STORAGE_KEY, 'memoria-camera-assist-v1', 'storage key follows memoria-*-v1 naming')
}

// --- 5. Instruction hold ------------------------------------------------------------------

console.log('\n── instruction hold')
{
  let now = 0
  const timers: { fn: () => void; at: number; id: number }[] = []
  let nextId = 1
  const hold = new InstructionHold({
    now: () => now,
    setTimer: (fn, ms) => { const id = nextId++; timers.push({ fn, at: now + ms, id }); return id },
    clearTimer: (h) => { const i = timers.findIndex((t) => t.id === h); if (i >= 0) timers.splice(i, 1) }
  })
  const advance = (to: number): void => {
    now = to
    for (const t of [...timers].sort((a, b) => a.at - b.at)) {
      if (t.at <= now && timers.includes(t)) {
        timers.splice(timers.indexOf(t), 1)
        t.fn()
      }
    }
  }
  const spoken: string[] = []

  hold.gate(() => spoken.push('a'))
  eq(spoken, ['a'], 'no hold: speaks immediately')

  hold.open(6000)
  hold.gate(() => spoken.push('b'))
  eq(spoken, ['a'], 'during a hold: speech waits')
  advance(3000)
  hold.release()
  eq(spoken, ['a', 'b'], 'head back: held speech runs')
  eq(timers.length, 0, 'release clears the timer')

  hold.open(6000)
  hold.gate(() => spoken.push('c'))
  hold.gate(() => spoken.push('d'))
  advance(8999)
  eq(spoken, ['a', 'b'], 'still held before max delay')
  advance(9000)
  eq(spoken, ['a', 'b', 'd'], 'max delay: newest held instruction runs, older one dropped')
  eq(hold.holding, false, 'hold window closed after max delay')

  hold.open(60_000)
  hold.gate(() => spoken.push('e'))
  advance(19_000)
  eq(spoken.at(-1), 'e', 'hold is capped (10 s) whatever the service asks')

  hold.open(5000)
  hold.gate(() => spoken.push('f'))
  hold.cancel()
  advance(30_000)
  eq(spoken.includes('f'), false, 'cancel drops held speech')
  eq(hold.holding, false, 'cancel closes the window')
  let escaped = false
  try {
    hold.gate(() => { throw new Error('speech failed') })
  } catch {
    escaped = true
  }
  ok(!escaped, 'a throwing speakNow never escapes gate()')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
