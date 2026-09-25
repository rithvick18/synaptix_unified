import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSocketLike } from '../src/transport/contracts.ts'
import type {
  Gesture,
  ObservationBody,
  TrackingStatus,
  CalibrationStatus
} from '../src/protocol/types.ts'
import { Backoff, backoffDelay, classifyClose, resolveReconnectOptions } from '../src/transport/backoff.ts'
import {
  parseServerMessage,
  streamUrl,
  toWebSocketUrl,
  validateServerMessage
} from '../src/protocol/validate.ts'
import { createSession, deleteSession, ServiceError } from '../src/transport/session.ts'
import { ProducerConnection } from '../src/transport/ProducerConnection.ts'
import { GameAdapter } from '../src/transport/GameAdapter.ts'

// --------------------------------------------------------------------------------------
// Fakes
// --------------------------------------------------------------------------------------

class FakeSocket implements WebSocketLike {
  readyState = 0
  readonly url: string
  readonly sent: string[] = []
  closedWith: { code?: number; reason?: string } | null = null
  onopen: ((ev: unknown) => void) | null = null
  onmessage: ((ev: { data: unknown }) => void) | null = null
  onclose: ((ev: { code: number; reason: string }) => void) | null = null
  onerror: ((ev: unknown) => void) | null = null

  constructor(url: string) {
    this.url = url
  }
  send(data: string): void {
    if (this.readyState !== 1) throw new Error('not open')
    this.sent.push(data)
  }
  close(code?: number, reason?: string): void {
    this.readyState = 3
    this.closedWith = { code, reason }
  }
  // --- server side ---
  open(): void {
    this.readyState = 1
    this.onopen?.({})
  }
  receive(msg: unknown): void {
    this.onmessage?.({ data: typeof msg === 'string' ? msg : JSON.stringify(msg) })
  }
  serverClose(code: number): void {
    this.readyState = 3
    this.onclose?.({ code, reason: '' })
  }
  messages(): Array<Record<string, unknown>> {
    return this.sent.map((s) => JSON.parse(s) as Record<string, unknown>)
  }
  ofType(type: string): Array<Record<string, unknown>> {
    return this.messages().filter((m) => m.type === type)
  }
}

function socketFactory() {
  const sockets: FakeSocket[] = []
  const factory = (url: string): WebSocketLike => {
    const s = new FakeSocket(url)
    sockets.push(s)
    return s
  }
  return { sockets, factory, last: () => sockets[sockets.length - 1] }
}

const SID = 's_test'
const now = () => Date.now()
const noJitter = () => 0.5 // u = 0 => delay exactly the base

function welcome(role: 'producer' | 'consumer', lastEventSeq = 0) {
  return {
    type: 'welcome',
    schema_version: '1.0',
    session_id: SID,
    role,
    heartbeat_interval_ms: 2000,
    last_event_seq: lastEventSeq
  }
}

const m = (value: unknown, reason: string | null = null) => ({ value, reason })

function derivedState(attention = 'HEAD_TOWARD_SCREEN') {
  return {
    attention_state: attention,
    attention_reason: 'head_within_neutral_range',
    vision: {
      fresh: true,
      simulated: true,
      observation_age_ms: 10,
      producer_id: 'cam',
      tracking_status: 'tracking',
      tracking_valid: true,
      tracking_quality: m(0.9),
      calibration_status: 'calibrated',
      head_yaw_deg: m(0),
      head_pitch_deg: m(0),
      head_roll_deg: m(0),
      head_facing_score: m(0.95),
      head_away_ms: m(0),
      eye_openness_left: m(1),
      eye_openness_right: m(1),
      eyes_closed: m(false),
      eyes_closed_ms: m(0),
      processed_fps: 15,
      inference_ms: 10
    },
    gameplay: {
      paused: false,
      expected_idle: false,
      current_task_id: null,
      inactivity_ms: m(null, 'no_gameplay_events'),
      tasks_completed: 0,
      answers_total: 0,
      recent_accuracy: m(null, 'no_answers'),
      recent_response_ms_median: m(null, 'no_response_times')
    },
    task_engagement_score: { value: null, reason: 'insufficient_gameplay_history', components: {} },
    policy: {
      vision_adaptation: 'active',
      vision_hold_reason: null,
      hold_new_instructions: false,
      hold_reason: null
    }
  }
}

function stateMsg(stateSeq: number, attention = 'HEAD_TOWARD_SCREEN') {
  return {
    type: 'state',
    schema_version: '1.0',
    session_id: SID,
    state_seq: stateSeq,
    server_ts_ms: 1,
    state: derivedState(attention)
  }
}

function gestureMsg(eventSeq: number, gestureId: string) {
  return {
    type: 'gesture',
    schema_version: '1.0',
    session_id: SID,
    event_seq: eventSeq,
    producer_id: 'cam',
    server_receipt_ts_ms: 1,
    gesture: { gesture_id: gestureId, type: 'nod', start_ts_ms: 1, end_ts_ms: 2, amplitude_deg: 10, swings: 2 }
  }
}

function actionMsg(eventSeq: number, actionId: string, source = 'vision', action = 'delay_instruction') {
  return {
    type: 'suggested_action',
    schema_version: '1.0',
    session_id: SID,
    event_seq: eventSeq,
    action_id: actionId,
    action,
    source,
    task_id: null,
    reason: 'test',
    evidence: { head_away_ms: 1600 },
    server_ts_ms: 1,
    expires_in_ms: 8000
  }
}

const heartbeat = () => ({ type: 'heartbeat', server_ts_ms: 1 })

function gesture(id: string, endTs: number): Gesture {
  return { gesture_id: id, type: 'blink', start_ts_ms: endTs - 100, end_ts_ms: endTs, amplitude_deg: null, swings: null }
}

function body(
  captureTs: number,
  opts: { status?: TrackingStatus; calibration?: CalibrationStatus; gestures?: Gesture[] } = {}
): ObservationBody {
  const status = opts.status ?? 'tracking'
  return {
    capture_ts_ms: captureTs,
    tracking: {
      status,
      valid: status === 'tracking',
      reason: null,
      face_count: 1,
      multiple_faces_visible: false,
      quality: m(0.9) as { value: number; reason: null }
    },
    calibration: { status: opts.calibration ?? 'calibrated', reason: null, progress: null },
    measurements: {
      head_yaw_deg: { value: 0, reason: null },
      head_pitch_deg: { value: 0, reason: null },
      head_roll_deg: { value: 0, reason: null },
      head_facing_score: { value: 0.95, reason: null },
      head_orientation: { value: 'toward', reason: null },
      head_away_ms: { value: 0, reason: null },
      head_away_episode: 0,
      eye_openness_left: { value: 1, reason: null },
      eye_openness_right: { value: 1, reason: null },
      eye_blink_coefficient_left: { value: 0.05, reason: null },
      eye_blink_coefficient_right: { value: 0.05, reason: null },
      eyes_closed: { value: false, reason: null },
      eyes_closed_ms: { value: 0, reason: null }
    },
    gestures: opts.gestures ?? [],
    perf: null,
    simulated: true
  }
}

function makeProducer(extra: Partial<ConstructorParameters<typeof ProducerConnection>[0]> = {}) {
  const ws = socketFactory()
  const producer = new ProducerConnection({
    baseUrl: 'http://127.0.0.1:8765/',
    sessionId: SID,
    producerToken: 'producer-token-0123456789',
    producerId: 'cam-1',
    webSocketFactory: ws.factory,
    now,
    random: noJitter,
    ...extra
  })
  return { producer, ws }
}

async function openProducer(extra: Partial<ConstructorParameters<typeof ProducerConnection>[0]> = {}) {
  const { producer, ws } = makeProducer(extra)
  const p = producer.connect()
  ws.last().open()
  ws.last().receive(welcome('producer'))
  await p
  return { producer, ws }
}

function makeAdapter(extra: Partial<ConstructorParameters<typeof GameAdapter>[0]> = {}) {
  const ws = socketFactory()
  const adapter = new GameAdapter({
    baseUrl: 'http://127.0.0.1:8765',
    sessionId: SID,
    consumerToken: 'consumer-token-0123456789',
    sourceId: 'game-1',
    webSocketFactory: ws.factory,
    now,
    random: noJitter,
    ...extra
  })
  return { adapter, ws }
}

async function openAdapter(extra: Partial<ConstructorParameters<typeof GameAdapter>[0]> = {}) {
  const { adapter, ws } = makeAdapter(extra)
  const p = adapter.connect()
  ws.last().open()
  ws.last().receive(welcome('consumer'))
  await p
  return { adapter, ws }
}

/** A minimal fetch Response stand-in. */
function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    body: null,
    json: async () => payload
  } as unknown as Response
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// --------------------------------------------------------------------------------------
// Backoff
// --------------------------------------------------------------------------------------

describe('backoff', () => {
  it('uses the documented defaults', () => {
    expect(resolveReconnectOptions()).toEqual({
      initialDelayMs: 500,
      maxDelayMs: 10_000,
      factor: 2,
      jitter: 0.2,
      maxAttempts: Infinity
    })
  })

  it('grows exponentially and caps at maxDelayMs', () => {
    const o = resolveReconnectOptions()
    const delays = [1, 2, 3, 4, 5, 6, 7, 50, 1000].map((n) => backoffDelay(n, o, noJitter))
    expect(delays.slice(0, 6)).toEqual([500, 1000, 2000, 4000, 8000, 10_000])
    for (const d of delays) expect(d).toBeLessThanOrEqual(10_000)
  })

  it('keeps jitter within ±jitter and within [0, max]', () => {
    const o = resolveReconnectOptions()
    expect(backoffDelay(1, o, () => 0)).toBe(400)
    expect(backoffDelay(1, o, () => 0.999999)).toBe(600)
    for (let i = 0; i < 200; i++) {
      const n = 1 + (i % 12)
      const d = backoffDelay(n, o)
      const base = Math.min(10_000, 500 * 2 ** (n - 1))
      expect(d).toBeGreaterThanOrEqual(Math.floor(base * 0.8))
      expect(d).toBeLessThanOrEqual(Math.min(10_000, Math.ceil(base * 1.2)))
    }
  })

  it('stops after maxAttempts and resets', () => {
    const b = new Backoff({ maxAttempts: 2 }, noJitter)
    expect(b.next()).toBe(500)
    expect(b.next()).toBe(1000)
    expect(b.next()).toBeNull()
    b.reset()
    expect(b.next()).toBe(500)
  })

  it('classifies close codes', () => {
    expect(classifyClose(4404)).toEqual({ kind: 'failed', reason: 'session_not_found' })
    expect(classifyClose(4401).kind).toBe('failed')
    expect(classifyClose(4403).kind).toBe('failed')
    expect(classifyClose(4000)).toEqual({ kind: 'closed', reason: 'session_closed' })
    expect(classifyClose(1006).kind).toBe('reconnect')
    expect(classifyClose(4409)).toEqual({ kind: 'reconnect', reason: 'too_slow' })
  })
})

// --------------------------------------------------------------------------------------
// Validation and URLs
// --------------------------------------------------------------------------------------

describe('validate', () => {
  it('accepts every well-formed server message', () => {
    for (const msg of [
      welcome('consumer'),
      stateMsg(1),
      gestureMsg(1, 'g1'),
      actionMsg(2, 'a1'),
      heartbeat(),
      { type: 'pong', nonce: null },
      { type: 'ack', kind: 'game_event', seq: 1, status: 'accepted', id: 'e1' },
      { type: 'error', code: 'out_of_order', message: 'x', seq: null }
    ]) {
      expect(validateServerMessage(msg), JSON.stringify(msg)).not.toBeNull()
    }
  })

  it('rejects malformed messages', () => {
    const bad: unknown[] = [
      null,
      42,
      'x',
      [],
      {},
      { type: 'nope' },
      { ...welcome('consumer'), schema_version: '2.0' },
      { ...welcome('consumer'), role: 'admin' },
      { ...stateMsg(1), state_seq: '1' },
      { ...stateMsg(1), state: { ...derivedState(), attention_state: 'FOCUSED' } },
      { ...gestureMsg(1, 'g'), gesture: { gesture_id: 'g', type: 'wink', start_ts_ms: 1, end_ts_ms: 2 } },
      { ...actionMsg(1, 'a'), action: 'punish' },
      { ...actionMsg(1, 'a'), source: 'camera' },
      { ...actionMsg(1, 'a'), event_seq: -1 },
      { type: 'ack', kind: 'game_event', seq: 1.5, status: 'accepted', id: null },
      { type: 'ack', kind: 'game_event', seq: 1, status: 'maybe', id: null },
      { type: 'error', code: 5, message: 'x' },
      { type: 'heartbeat' }
    ]
    for (const msg of bad) expect(validateServerMessage(msg), JSON.stringify(msg)).toBeNull()
  })

  it('rejects non-finite numbers anywhere', () => {
    expect(validateServerMessage({ type: 'heartbeat', server_ts_ms: Infinity })).toBeNull()
    expect(validateServerMessage({ ...gestureMsg(1, 'g'), server_receipt_ts_ms: NaN })).toBeNull()
    const s = stateMsg(1)
    ;(s.state.vision as Record<string, unknown>).inference_ms = -Infinity
    expect(validateServerMessage(s)).toBeNull()
    expect(validateServerMessage({ ...actionMsg(1, 'a'), evidence: { x: NaN } })).toBeNull()
  })

  it('parses raw frames and rejects invalid JSON', () => {
    expect(parseServerMessage('{"type":"heartbeat","server_ts_ms":5}')).not.toBeNull()
    expect(parseServerMessage('{not json')).toBeNull()
    expect(parseServerMessage(123)).toBeNull()
  })

  it('builds ws URLs from http base URLs without tokens', () => {
    expect(toWebSocketUrl('http://127.0.0.1:8765/', '/v1/x')).toBe('ws://127.0.0.1:8765/v1/x')
    expect(toWebSocketUrl('https://example.test', 'v1/x')).toBe('wss://example.test/v1/x')
    expect(streamUrl('http://localhost:8765', 's_1')).toBe('ws://localhost:8765/v1/sessions/s_1/stream')
    expect(() => toWebSocketUrl('ftp://x', '/y')).toThrow()
  })
})

// --------------------------------------------------------------------------------------
// Session HTTP helpers
// --------------------------------------------------------------------------------------

describe('session helpers', () => {
  it('creates a session with overrides and create key', async () => {
    const fetchImpl = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      jsonResponse(201, {
        schema_version: '1.0',
        session_id: 's_1',
        producer_token: 'p',
        consumer_token: 'c',
        endpoints: { observations: '', game_events: '', state: '', stream: '' },
        idle_ttl_s: 900,
        limits: {},
        policy: {}
      })
    )
    const res = await createSession('http://h:1/', {
      policyOverrides: { delay_instruction_after_ms: 500 },
      label: 'x',
      createKey: 'k',
      fetchImpl: fetchImpl as unknown as typeof fetch
    })
    expect(res.session_id).toBe('s_1')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://h:1/v1/sessions')
    expect(JSON.parse(String(init?.body))).toEqual({
      label: 'x',
      policy_overrides: { delay_instruction_after_ms: 500 }
    })
    expect((init?.headers as Record<string, string>)['X-Session-Create-Key']).toBe('k')
  })

  it('throws typed ServiceErrors', async () => {
    const notFound = (async () =>
      jsonResponse(404, { error: { code: 'session_not_found', message: 'gone' } })) as unknown as typeof fetch
    const err = await deleteSession('http://h:1', 's_1', 't', notFound).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ServiceError)
    expect(err).toMatchObject({ status: 404, code: 'session_not_found', message: 'gone' })
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(createSession('http://h:1', { fetchImpl: offline })).rejects.toMatchObject({
      status: 0,
      code: 'network_error'
    })
  })
})

// --------------------------------------------------------------------------------------
// ProducerConnection
// --------------------------------------------------------------------------------------

describe('ProducerConnection', () => {
  it('sends hello as producer with the token in the message, never the URL', async () => {
    const { ws } = await openProducer()
    const s = ws.sockets[0]
    expect(s.url).toBe('ws://127.0.0.1:8765/v1/sessions/s_test/stream')
    expect(s.url).not.toContain('token')
    expect(s.messages()[0]).toEqual({
      type: 'hello',
      schema_version: '1.0',
      role: 'producer',
      client_id: expect.stringMatching(/^cam-1\.[a-z0-9]{1,6}$/),
      token: 'producer-token-0123456789'
    })
  })

  it('uses a distinct producer_id per instance so a reload never reuses old seqs', async () => {
    const a = await openProducer()
    const b = await openProducer()
    const idA = a.ws.sockets[0].messages()[0].client_id
    const idB = b.ws.sockets[0].messages()[0].client_id
    expect(idA).not.toBe(idB)
    a.producer.disconnect()
    b.producer.disconnect()
  })

  it('assigns seq monotonically across reconnects and wraps the envelope', async () => {
    const { producer, ws } = await openProducer({ sendIntervalMs: 0 })
    producer.submit(body(now()))
    vi.advanceTimersByTime(10)
    producer.submit(body(now()))
    const first = ws.sockets[0].ofType('observation')
    expect(first.map((o) => o.seq)).toEqual([1, 2])
    expect(first[0]).toMatchObject({ session_id: SID, schema_version: '1.0', simulated: true })
    expect(first[0].producer_id).toBe(ws.sockets[0].messages()[0].client_id) // matches hello

    ws.sockets[0].serverClose(1006)
    expect(producer.status).toBe('reconnecting')
    vi.advanceTimersByTime(500)
    expect(ws.sockets).toHaveLength(2)
    ws.last().open()
    ws.last().receive(welcome('producer'))
    expect(producer.status).toBe('open')
    producer.submit(body(now()))
    expect(ws.last().ofType('observation').map((o) => o.seq)).toEqual([3])
    producer.disconnect()
  })

  it('throttles, but sends immediately for new gestures and status changes', async () => {
    const { producer, ws } = await openProducer({ sendIntervalMs: 100 })
    const obs = () => ws.sockets[0].ofType('observation')
    producer.submit(body(now()))
    expect(obs()).toHaveLength(1)
    vi.advanceTimersByTime(10)
    producer.submit(body(now()))
    vi.advanceTimersByTime(10)
    const latestTs = now()
    producer.submit(body(latestTs))
    expect(obs()).toHaveLength(1) // throttled
    vi.advanceTimersByTime(80)
    expect(obs()).toHaveLength(2) // only the latest is sent
    expect(obs()[1].capture_ts_ms).toBe(latestTs)

    vi.advanceTimersByTime(10)
    producer.submit(body(now(), { gestures: [gesture('g1', now())] }))
    expect(obs()).toHaveLength(3) // new gesture => immediate

    vi.advanceTimersByTime(10)
    producer.submit(body(now(), { status: 'no_face' }))
    expect(obs()).toHaveLength(4) // tracking status change => immediate

    vi.advanceTimersByTime(10)
    producer.submit(body(now(), { status: 'no_face', calibration: 'required' }))
    expect(obs()).toHaveLength(5) // calibration status change => immediate
    producer.disconnect()
  })

  it('keeps only the latest while disconnected and drops it if stale on reconnect', async () => {
    const { producer, ws } = await openProducer({ maxObservationAgeMs: 500 })
    ws.sockets[0].serverClose(1006)
    producer.submit(body(now()))
    producer.submit(body(now()))
    vi.advanceTimersByTime(500) // reconnect timer (500 ms) fires
    vi.advanceTimersByTime(100) // observation is now 600 ms old
    ws.last().open()
    ws.last().receive(welcome('producer'))
    expect(ws.last().ofType('observation')).toHaveLength(0)
    expect(producer.stats.droppedStale).toBe(1)
    expect(producer.stats.sent).toBe(0)

    // A fresh observation held while disconnected is sent on welcome.
    ws.last().serverClose(1006)
    vi.advanceTimersByTime(300)
    producer.submit(body(now()))
    vi.advanceTimersByTime(200)
    expect(ws.sockets).toHaveLength(3)
    ws.last().open()
    ws.last().receive(welcome('producer'))
    expect(ws.last().ofType('observation')).toHaveLength(1)
    producer.disconnect()
  })

  it('resends pending gestures until acked, then drops them', async () => {
    const { producer, ws } = await openProducer({ sendIntervalMs: 0 })
    const s = ws.sockets[0]
    const g = gesture('g-1', now())
    producer.submit(body(now(), { gestures: [g] }))
    vi.advanceTimersByTime(5)
    producer.submit(body(now(), { gestures: [g] })) // resubmitted: deduped by id
    vi.advanceTimersByTime(5)
    producer.submit(body(now()))
    let obs = s.ofType('observation')
    expect(obs.map((o) => (o.gestures as Gesture[]).map((x) => x.gesture_id))).toEqual([['g-1'], ['g-1'], ['g-1']])

    s.receive({ type: 'ack', kind: 'observation', seq: 2, status: 'accepted', id: null })
    expect(producer.pendingGestureCount).toBe(0)
    vi.advanceTimersByTime(5)
    producer.submit(body(now(), { gestures: [g] })) // already acked: not re-added
    obs = s.ofType('observation')
    expect(obs[obs.length - 1].gestures).toEqual([])
    expect(producer.stats.acked).toBe(1)

    // A duplicate ack also settles gestures.
    const g2 = gesture('g-2', now())
    producer.submit(body(now(), { gestures: [g2] }))
    const seq = s.ofType('observation').at(-1)!.seq as number
    s.receive({ type: 'ack', kind: 'observation', seq, status: 'duplicate', id: null })
    expect(producer.pendingGestureCount).toBe(0)
    expect(producer.stats.duplicates).toBe(1)
    producer.disconnect()
  })

  it('drops gestures that age out and never sends more than 16 per observation', async () => {
    const { producer, ws } = await openProducer({ sendIntervalMs: 0, maxGestureAgeMs: 1000 })
    const s = ws.sockets[0]
    producer.submit(body(now(), { gestures: [gesture('old', now())] }))
    vi.advanceTimersByTime(1500)
    producer.submit(body(now()))
    expect(s.ofType('observation').at(-1)!.gestures).toEqual([])
    expect(producer.pendingGestureCount).toBe(0)

    // Already too old on arrival: never added.
    producer.submit(body(now(), { gestures: [gesture('ancient', now() - 5000)] }))
    expect(producer.pendingGestureCount).toBe(0)

    const many = Array.from({ length: 20 }, (_, i) => gesture(`g${i}`, now()))
    producer.submit(body(now(), { gestures: many }))
    expect((s.ofType('observation').at(-1)!.gestures as Gesture[]).length).toBe(16)
    expect(producer.pendingGestureCount).toBe(20)
    producer.disconnect()
  })

  it('surfaces server errors such as producer_conflict', async () => {
    const { producer, ws } = await openProducer()
    const errors: string[] = []
    producer.onError((e) => errors.push(e.code))
    ws.sockets[0].receive({ type: 'error', code: 'producer_conflict', message: 'x', seq: 3 })
    expect(errors).toEqual(['producer_conflict'])
    expect(producer.stats.rejected).toBe(1)
    producer.disconnect()
  })

  it('is fatal on 4401/4403/4404, closed on 4000, with no reconnect', async () => {
    for (const [code, status, reason] of [
      [4404, 'failed', 'session_not_found'],
      [4401, 'failed', 'unauthorized'],
      [4403, 'failed', 'forbidden_origin'],
      [4000, 'closed', 'session_closed']
    ] as const) {
      const { producer, ws } = makeProducer()
      const events: string[] = []
      producer.onStatus((e) => events.push(`${e.status}:${e.reason}`))
      const p = producer.connect()
      ws.last().open()
      ws.last().serverClose(code)
      await expect(p).rejects.toMatchObject({ code: reason })
      expect(producer.status).toBe(status)
      vi.advanceTimersByTime(60_000)
      expect(ws.sockets).toHaveLength(1)
      expect(events.at(-1)).toBe(`${status}:${reason}`)
      expect(vi.getTimerCount()).toBe(0)
    }
  })

  it('reconnects after a heartbeat timeout', async () => {
    const { producer, ws } = await openProducer({ heartbeatTimeoutMs: 3000 })
    vi.advanceTimersByTime(2000)
    ws.sockets[0].receive(heartbeat())
    vi.advanceTimersByTime(2999)
    expect(producer.status).toBe('open')
    vi.advanceTimersByTime(1)
    expect(producer.status).toBe('reconnecting')
    vi.advanceTimersByTime(500)
    expect(ws.sockets).toHaveLength(2)
    producer.disconnect()
  })

  it('disconnect() cancels everything and is idempotent', async () => {
    const { producer, ws } = await openProducer({ sendIntervalMs: 100 })
    producer.submit(body(now()))
    vi.advanceTimersByTime(10)
    producer.submit(body(now())) // throttle timer pending
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    producer.disconnect()
    producer.disconnect()
    expect(vi.getTimerCount()).toBe(0)
    expect(producer.status).toBe('closed')
    expect(ws.sockets[0].closedWith).not.toBeNull()
    producer.submit(body(now()))
    vi.advanceTimersByTime(1000)
    expect(ws.sockets[0].ofType('observation')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  describe('HTTP transport', () => {
    function httpProducer(handler: (url: string, init: RequestInit) => Promise<Response>) {
      const calls: Array<{ url: string; init: RequestInit }> = []
      const fetchImpl = ((url: string, init: RequestInit) => {
        calls.push({ url, init })
        return handler(url, init)
      }) as unknown as typeof fetch
      const producer = new ProducerConnection({
        baseUrl: 'http://127.0.0.1:8765',
        sessionId: SID,
        producerToken: 'producer-token-0123456789',
        producerId: 'cam-1',
        transport: 'http',
        sendIntervalMs: 0,
        fetchImpl,
        now,
        random: noJitter
      })
      return { producer, calls }
    }

    it('never overlaps requests and sends only the latest afterwards', async () => {
      const pending: Array<(r: Response) => void> = []
      let inFlight = 0
      let maxInFlight = 0
      const { producer, calls } = httpProducer((url) => {
        if (url.endsWith('/state')) return Promise.resolve(jsonResponse(200, {}))
        inFlight += 1
        maxInFlight = Math.max(maxInFlight, inFlight)
        return new Promise<Response>((resolve) => {
          pending.push((r) => {
            inFlight -= 1
            resolve(r)
          })
        })
      })
      await producer.connect()
      expect(producer.status).toBe('open')
      expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(
        'Bearer producer-token-0123456789'
      )
      producer.submit(body(now()))
      producer.submit(body(now() + 1))
      producer.submit(body(now() + 2))
      producer.submit(body(now() + 3))
      const posts = () => calls.filter((c) => c.url.endsWith('/observations'))
      expect(posts()).toHaveLength(1)
      pending.shift()!(jsonResponse(200, { status: 'accepted', seq: 1, state_seq: 1 }))
      await vi.advanceTimersByTimeAsync(0)
      expect(posts()).toHaveLength(2)
      const second = JSON.parse(String(posts()[1].init.body))
      expect(second.capture_ts_ms).toBe(now() + 3)
      expect(second.seq).toBe(2)
      // 409 out_of_order: skipped, not fatal.
      pending.shift()!(jsonResponse(409, { error: { code: 'out_of_order', message: 'x' } }))
      await vi.advanceTimersByTimeAsync(0)
      expect(producer.status).toBe('open')
      expect(producer.stats).toMatchObject({ acked: 1, rejected: 1 })
      expect(maxInFlight).toBe(1)
      producer.disconnect()
      expect(vi.getTimerCount()).toBe(0)
    })

    it('fails permanently on 404', async () => {
      const { producer, calls } = httpProducer((url) =>
        Promise.resolve(
          url.endsWith('/state')
            ? jsonResponse(200, {})
            : jsonResponse(404, { error: { code: 'session_not_found', message: 'gone' } })
        )
      )
      const statuses: string[] = []
      producer.onStatus((e) => statuses.push(`${e.status}:${e.reason}`))
      await producer.connect()
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(0)
      expect(producer.status).toBe('failed')
      expect(statuses.at(-1)).toBe('failed:session_not_found')
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(60_000)
      expect(calls.filter((c) => c.url.endsWith('/observations'))).toHaveLength(1)
      expect(vi.getTimerCount()).toBe(0)
    })

    it('rejects connect() when the session does not exist', async () => {
      const { producer } = httpProducer(() =>
        Promise.resolve(jsonResponse(404, { error: { code: 'session_not_found', message: 'gone' } }))
      )
      await expect(producer.connect()).rejects.toMatchObject({ code: 'session_not_found', status: 404 })
      expect(producer.status).toBe('failed')
    })

    it('backs off on 429 before sending again', async () => {
      let n = 0
      const { producer, calls } = httpProducer((url) => {
        if (url.endsWith('/state')) return Promise.resolve(jsonResponse(200, {}))
        n += 1
        return Promise.resolve(
          n === 1
            ? jsonResponse(429, { error: { code: 'rate_limited', message: 'slow down' } })
            : jsonResponse(200, { status: 'accepted', seq: n, state_seq: 1 })
        )
      })
      await producer.connect()
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(0)
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(100)
      const posts = () => calls.filter((c) => c.url.endsWith('/observations'))
      expect(posts()).toHaveLength(1)
      await vi.advanceTimersByTimeAsync(400) // 500 ms rate-limit backoff elapsed
      expect(posts()).toHaveLength(2)
      producer.disconnect()
    })

    it('treats network errors as transient and reconnects', async () => {
      let fail = true
      const { producer, calls } = httpProducer((url) => {
        if (url.endsWith('/state')) return Promise.resolve(jsonResponse(200, {}))
        if (fail) {
          fail = false
          return Promise.reject(new TypeError('fetch failed'))
        }
        return Promise.resolve(jsonResponse(200, { status: 'accepted', seq: 2, state_seq: 1 }))
      })
      await producer.connect()
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(0)
      expect(producer.status).toBe('reconnecting')
      producer.submit(body(now()))
      await vi.advanceTimersByTimeAsync(500)
      expect(producer.status).toBe('open')
      expect(calls.filter((c) => c.url.endsWith('/observations'))).toHaveLength(2)
      producer.disconnect()
    })
  })
})

// --------------------------------------------------------------------------------------
// GameAdapter
// --------------------------------------------------------------------------------------

describe('GameAdapter', () => {
  it('sends a consumer hello (resume null first) and resolves connect on welcome', async () => {
    const { adapter, ws } = makeAdapter()
    let resolved = false
    const p = adapter.connect().then(() => {
      resolved = true
    })
    ws.last().open()
    expect(ws.last().messages()[0]).toEqual({
      type: 'hello',
      schema_version: '1.0',
      role: 'consumer',
      client_id: 'game-1',
      token: 'consumer-token-0123456789',
      resume_after_event_seq: null
    })
    await Promise.resolve()
    expect(resolved).toBe(false)
    ws.last().receive(welcome('consumer'))
    await p
    expect(adapter.status).toBe('open')
    adapter.disconnect()
  })

  it('delivers each action/gesture once, even when replayed after reconnect', async () => {
    const { adapter, ws } = await openAdapter()
    const actions: string[] = []
    const gestures: string[] = []
    adapter.onSuggestedAction((a) => actions.push(a.action_id))
    adapter.onGesture((g) => gestures.push(g.gesture.gesture_id))
    ws.last().receive(gestureMsg(1, 'g1'))
    ws.last().receive(actionMsg(2, 'a1'))
    ws.last().receive(actionMsg(2, 'a1'))
    ws.last().serverClose(1006)
    vi.advanceTimersByTime(500)
    ws.last().open()
    const hello = ws.last().messages()[0]
    expect(hello.resume_after_event_seq).toBe(2)
    ws.last().receive(welcome('consumer', 3))
    // A server replaying from an older point must not re-fire anything.
    ws.last().receive(gestureMsg(1, 'g1'))
    ws.last().receive(actionMsg(2, 'a1'))
    ws.last().receive(actionMsg(3, 'a2', 'gameplay', 'offer_hint'))
    expect(actions).toEqual(['a1', 'a2'])
    expect(gestures).toEqual(['g1'])
    expect(adapter.lastEventSeq).toBe(3)
    expect(adapter.stats.duplicatesSuppressed).toBe(3)
    adapter.disconnect()
  })

  it('goes stale (state null) on heartbeat timeout and reconnects', async () => {
    const { adapter, ws } = await openAdapter({ heartbeatTimeoutMs: 6000 })
    const states: Array<{ stale: boolean; attention: string | null }> = []
    const statuses: string[] = []
    adapter.onState((s) => states.push({ stale: s.stale, attention: s.state?.attention_state ?? null }))
    adapter.onConnectionStatus((e) => statuses.push(`${e.status}:${e.reason}`))
    ws.last().receive(stateMsg(1))
    expect(adapter.getLatestState()).toMatchObject({ stale: false, stateSeq: 1 })
    expect(adapter.getLatestState().state?.attention_state).toBe('HEAD_TOWARD_SCREEN')
    vi.advanceTimersByTime(4000)
    ws.last().receive(heartbeat())
    vi.advanceTimersByTime(5999)
    expect(adapter.getLatestState().stale).toBe(false)
    vi.advanceTimersByTime(1)
    expect(statuses).toContain('reconnecting:heartbeat_timeout')
    expect(adapter.getLatestState()).toMatchObject({ stale: true, state: null, connection: 'reconnecting' })
    expect(states).toEqual([
      { stale: false, attention: 'HEAD_TOWARD_SCREEN' },
      { stale: true, attention: null }
    ])
    expect(ws.sockets[0].closedWith).not.toBeNull()
    vi.advanceTimersByTime(500)
    expect(ws.sockets).toHaveLength(2)
    ws.last().open()
    ws.last().receive(welcome('consumer'))
    // The old state is not resurrected: only a fresh snapshot counts.
    expect(adapter.getLatestState().state).toBeNull()
    ws.last().receive(stateMsg(2, 'HEAD_AWAY'))
    expect(adapter.getLatestState().state?.attention_state).toBe('HEAD_AWAY')
    adapter.disconnect()
  })

  it('reports stale by time even before the timer fires', async () => {
    let t = 1000
    const { adapter, ws } = await openAdapter({ now: () => t, heartbeatTimeoutMs: 1000 })
    ws.last().receive(stateMsg(1))
    expect(adapter.getLatestState().stale).toBe(false)
    t += 1001
    expect(adapter.getLatestState()).toMatchObject({ stale: true, state: null })
    adapter.disconnect()
  })

  it('resends unacked events with the same seq and event_id after reconnect', async () => {
    const { adapter, ws } = await openAdapter()
    const id1 = adapter.sendGameEvent({ event_type: 'task_started', task_id: 't1' })
    const id2 = adapter.sendGameEvent({
      event_type: 'answer_submitted',
      task_id: 't1',
      data: { correct: false },
      event_id: 'my-event-2',
      client_ts_ms: 1234
    })
    expect(id2).toBe('my-event-2')
    const sent = ws.last().ofType('game_event')
    expect(sent).toHaveLength(2)
    expect(sent[0]).toMatchObject({
      schema_version: '1.0',
      session_id: SID,
      source_id: 'game-1',
      seq: 1,
      event_id: id1,
      event_type: 'task_started',
      task_id: 't1',
      data: {}
    })
    expect(sent[1]).toMatchObject({ seq: 2, event_id: 'my-event-2', client_ts_ms: 1234 })
    ws.last().receive({ type: 'ack', kind: 'game_event', seq: 1, status: 'accepted', id: id1 })
    expect(adapter.outboxSize).toBe(1)

    ws.last().serverClose(1006)
    const id3 = adapter.sendGameEvent({ event_type: 'player_activity' }) // queued while down
    vi.advanceTimersByTime(500)
    ws.last().open()
    expect(ws.last().ofType('game_event')).toHaveLength(0) // not before welcome
    ws.last().receive(welcome('consumer'))
    const resent = ws.last().ofType('game_event')
    expect(resent.map((e) => [e.seq, e.event_id])).toEqual([
      [2, 'my-event-2'],
      [3, id3]
    ])
    expect(resent[0]).toEqual(sent[1])
    ws.last().receive({ type: 'ack', kind: 'game_event', seq: 2, status: 'duplicate', id: 'my-event-2' })
    ws.last().receive({ type: 'ack', kind: 'game_event', seq: 3, status: 'accepted', id: id3 })
    expect(adapter.outboxSize).toBe(0)
    adapter.disconnect()
  })

  it('bounds the outbox and drops events the service rejects', async () => {
    const { adapter, ws } = await openAdapter({ outboxLimit: 3 })
    for (let i = 0; i < 5; i++) adapter.sendGameEvent({ event_type: 'player_activity' })
    expect(adapter.outboxSize).toBe(3)
    expect(adapter.stats.outboxDropped).toBe(2)
    ws.last().receive({ type: 'error', code: 'invalid_message', message: 'x', seq: 5 })
    expect(adapter.outboxSize).toBe(2)
    adapter.disconnect()
  })

  it('re-sequences a rate-limited event (same event_id) and resends it later', async () => {
    const { adapter, ws } = await openAdapter()
    const id1 = adapter.sendGameEvent({ event_type: 'player_activity' })
    const id2 = adapter.sendGameEvent({ event_type: 'player_activity' })
    ws.last().receive({ type: 'ack', kind: 'game_event', seq: 2, status: 'accepted', id: id2 })
    ws.last().receive({ type: 'error', code: 'rate_limited', message: 'slow down', seq: 1 })
    expect(adapter.outboxSize).toBe(1)
    const before = ws.last().ofType('game_event').length
    vi.advanceTimersByTime(1000)
    const resent = ws.last().ofType('game_event').slice(before)
    expect(resent).toHaveLength(1)
    expect(resent[0]).toMatchObject({ event_id: id1, seq: 3 })
    ws.last().receive({ type: 'ack', kind: 'game_event', seq: 3, status: 'accepted', id: id1 })
    expect(adapter.outboxSize).toBe(0)
    adapter.disconnect()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('suppresses vision-sourced actions while vision adaptation is disabled', async () => {
    const { adapter, ws } = await openAdapter()
    const actions: string[] = []
    adapter.onSuggestedAction((a) => actions.push(`${a.action}:${a.source}`))
    adapter.setVisionAdaptationEnabled(false)
    const setting = ws.last().ofType('game_event').at(-1)!
    expect(setting).toMatchObject({ event_type: 'adaptation_setting', data: { vision_adaptation_enabled: false } })
    expect(adapter.getLatestState().visionAdaptationEnabled).toBe(false)
    ws.last().receive(actionMsg(1, 'v1', 'vision', 'delay_instruction'))
    ws.last().receive(actionMsg(2, 'v2', 'vision+gameplay', 'gentle_cue'))
    ws.last().receive(actionMsg(3, 'g1', 'gameplay', 'offer_hint'))
    expect(actions).toEqual(['offer_hint:gameplay'])
    adapter.setVisionAdaptationEnabled(true)
    ws.last().receive(actionMsg(1, 'v1', 'vision', 'delay_instruction')) // already seen
    ws.last().receive(actionMsg(4, 'v3', 'vision', 'delay_instruction'))
    expect(actions).toEqual(['offer_hint:gameplay', 'delay_instruction:vision'])
    adapter.disconnect()
  })

  it('sends the adaptation setting on connect when constructed disabled', async () => {
    const { adapter, ws } = await openAdapter({ visionAdaptationEnabled: false })
    const events = ws.last().ofType('game_event')
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      seq: 1,
      event_type: 'adaptation_setting',
      data: { vision_adaptation_enabled: false }
    })
    adapter.disconnect()
  })

  it('fails on 4404 without reconnecting and rejects connect()', async () => {
    const { adapter, ws } = makeAdapter()
    const statuses: string[] = []
    adapter.onConnectionStatus((e) => statuses.push(`${e.status}:${e.reason}`))
    const p = adapter.connect()
    ws.last().open()
    ws.last().receive({ type: 'error', code: 'session_not_found', message: 'x', seq: null })
    ws.last().serverClose(4404)
    await expect(p).rejects.toMatchObject({ code: 'session_not_found' })
    expect(adapter.status).toBe('failed')
    vi.advanceTimersByTime(60_000)
    expect(ws.sockets).toHaveLength(1)
    expect(statuses).toEqual(['connecting:null', 'failed:session_not_found'])
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports closed when the session is deleted (4000)', async () => {
    const { adapter, ws } = await openAdapter()
    ws.last().receive(stateMsg(1))
    ws.last().serverClose(4000)
    expect(adapter.getLatestState()).toMatchObject({ connection: 'closed', stale: true, state: null })
    vi.advanceTimersByTime(60_000)
    expect(ws.sockets).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives up after maxAttempts', async () => {
    const { adapter, ws } = await openAdapter({ reconnect: { maxAttempts: 2 } })
    ws.last().serverClose(1006)
    vi.advanceTimersByTime(500)
    ws.last().serverClose(1006)
    vi.advanceTimersByTime(1000)
    ws.last().serverClose(1006)
    expect(adapter.status).toBe('failed')
    expect(adapter.getLatestState().connection).toBe('failed')
    expect(ws.sockets).toHaveLength(3)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unsubscribe works and throwing listeners do not break the adapter', async () => {
    const { adapter, ws } = await openAdapter()
    const seen: string[] = []
    const unsubscribe = adapter.onGesture((g) => seen.push(g.gesture.gesture_id))
    adapter.onGesture(() => {
      throw new Error('game bug')
    })
    const after: string[] = []
    adapter.onGesture((g) => after.push(g.gesture.gesture_id))
    ws.last().receive(gestureMsg(1, 'g1'))
    unsubscribe()
    ws.last().receive(gestureMsg(2, 'g2'))
    expect(seen).toEqual(['g1'])
    expect(after).toEqual(['g1', 'g2'])
    expect(adapter.stats.listenerErrors).toBe(2)
    expect(adapter.status).toBe('open')
    adapter.disconnect()
  })

  it('ignores and counts invalid or foreign messages', async () => {
    const { adapter, ws } = await openAdapter()
    const gestures: string[] = []
    adapter.onGesture((g) => gestures.push(g.gesture.gesture_id))
    ws.last().receive('{broken')
    ws.last().receive({ ...gestureMsg(1, 'g1'), event_seq: 'x' })
    ws.last().receive({ ...gestureMsg(1, 'g1'), session_id: 's_other' })
    ws.last().receive({ ...stateMsg(1), state: null })
    expect(gestures).toEqual([])
    expect(adapter.getLatestState().state).toBeNull()
    expect(adapter.stats.invalid).toBe(4)
    expect(adapter.lastEventSeq).toBeNull()
    adapter.disconnect()
  })

  it('disconnect() leaves no timers and is idempotent', async () => {
    const { adapter, ws } = await openAdapter()
    ws.last().receive(stateMsg(1))
    expect(vi.getTimerCount()).toBeGreaterThan(0) // heartbeat watchdog
    const statuses: string[] = []
    adapter.onConnectionStatus((e) => statuses.push(e.status))
    adapter.disconnect()
    adapter.disconnect()
    expect(vi.getTimerCount()).toBe(0)
    expect(statuses).toEqual(['closed'])
    expect(adapter.getLatestState()).toMatchObject({ connection: 'closed', stale: true, state: null })
    expect(ws.last().closedWith).not.toBeNull()

    // Also while waiting to reconnect.
    const second = await openAdapter()
    second.ws.last().serverClose(1006)
    expect(vi.getTimerCount()).toBe(1)
    const connecting = second.adapter.connect()
    second.adapter.disconnect()
    await expect(connecting).rejects.toBeInstanceOf(Error)
    expect(vi.getTimerCount()).toBe(0)
  })
})
