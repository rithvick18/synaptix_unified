/**
 * GameAdapter: the game's connection to the service (consumer role).
 *
 * It never touches game objects: it only invokes the callbacks the game registers.
 *
 * - Every incoming frame is validated; invalid frames are ignored and counted.
 * - Gestures and suggested actions fire exactly once per adapter (bounded seen-sets keyed
 *   by gesture_id / action_id), including across reconnect replay. On reconnect the
 *   adapter asks for replay after the highest event_seq it has seen.
 * - Freshness: if no message of any kind (the service sends heartbeats every 2 s) arrives
 *   within heartbeatTimeoutMs, the socket is treated as dead and replaced. While the
 *   connection is not open or not fresh, getLatestState().state is null: a stale
 *   favourable state is never kept.
 * - Game events go through a bounded outbox and are resent (same seq, same event_id)
 *   after reconnect until acked; the service dedupes by event_id.
 */

import type {
  AdapterState,
  ConnectionStatus,
  ConnectionStatusEvent,
  GameAdapterApi,
  GameAdapterOptions,
  Unsubscribe,
  WebSocketFactory,
  WebSocketLike
} from './contracts.ts'
import type {
  DerivedState,
  GameEventInput,
  GameEventMessage,
  GestureEventMessage,
  HelloMessage,
  ServerMessage,
  SuggestedActionMessage
} from '../protocol/types.ts'
import { SCHEMA_VERSION } from '../protocol/types.ts'
import { parseServerMessage, streamUrl, trimBaseUrl } from '../protocol/validate.ts'
import { Backoff, classifyClose } from './backoff.ts'
import { ServiceError } from './session.ts'

const WS_OPEN = 1
/** Remembered gesture/action ids; far more than the service's 256-event replay buffer. */
export const SEEN_ID_MEMORY = 4096

export interface GameAdapterStats {
  received: number
  invalid: number
  statesReceived: number
  gesturesDelivered: number
  actionsDelivered: number
  duplicatesSuppressed: number
  actionsSuppressedVisionDisabled: number
  eventsSent: number
  eventsAcked: number
  eventsDuplicate: number
  eventsRejected: number
  outboxDropped: number
  listenerErrors: number
}

export interface GameAdapterExtraOptions {
  /** Random source for backoff jitter (tests). */
  random?: () => number
}

type Timer = ReturnType<typeof setTimeout>

function noop(): void {}

function detach(ws: WebSocketLike): void {
  ws.onopen = noop
  ws.onmessage = noop
  ws.onclose = noop
  ws.onerror = noop
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket
  if (!Ctor) throw new Error('no global WebSocket; pass webSocketFactory')
  return new Ctor(url)
}

export function randomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

/** Insertion-ordered set that forgets its oldest entries beyond `capacity`. */
class BoundedSet {
  private readonly items = new Set<string>()
  private readonly capacity: number
  constructor(capacity: number) {
    this.capacity = capacity
  }
  has(id: string): boolean {
    return this.items.has(id)
  }
  add(id: string): void {
    this.items.add(id)
    while (this.items.size > this.capacity) {
      const oldest = this.items.values().next().value
      if (oldest === undefined) break
      this.items.delete(oldest)
    }
  }
  get size(): number {
    return this.items.size
  }
}

export class GameAdapter implements GameAdapterApi {
  readonly sourceId: string
  private readonly baseUrl: string
  private readonly sessionId: string
  private readonly token: string
  private readonly heartbeatTimeoutMs: number
  private readonly outboxLimit: number
  private readonly wsFactory: WebSocketFactory
  private readonly now: () => number
  private readonly backoff: Backoff

  private _status: ConnectionStatus = 'idle'
  private reason: string | null = null
  private generation = 0
  private ws: WebSocketLike | null = null
  private heartbeatTimer: Timer | null = null
  private reconnectTimer: Timer | null = null
  private retryTimer: Timer | null = null

  private visionEnabled: boolean
  private latestState: DerivedState | null = null
  private stateSeq: number | null = null
  private stateReceivedAt: number | null = null
  private lastMessageAt: number | null = null
  /** Whether the most recent onState emission reported stale=true (avoid repeats). */
  private emittedStale = true
  private maxEventSeq: number | null = null
  private readonly seenGestures = new BoundedSet(SEEN_ID_MEMORY)
  private readonly seenActions = new BoundedSet(SEEN_ID_MEMORY)

  private eventSeq = 0
  private readonly outbox: GameEventMessage[] = []

  private connectPromise: Promise<void> | null = null
  private connectResolve: (() => void) | null = null
  private connectReject: ((e: Error) => void) | null = null

  private readonly stateListeners = new Set<(s: AdapterState) => void>()
  private readonly gestureListeners = new Set<(g: GestureEventMessage) => void>()
  private readonly actionListeners = new Set<(a: SuggestedActionMessage) => void>()
  private readonly statusListeners = new Set<(e: ConnectionStatusEvent) => void>()
  private readonly counters: GameAdapterStats = {
    received: 0,
    invalid: 0,
    statesReceived: 0,
    gesturesDelivered: 0,
    actionsDelivered: 0,
    duplicatesSuppressed: 0,
    actionsSuppressedVisionDisabled: 0,
    eventsSent: 0,
    eventsAcked: 0,
    eventsDuplicate: 0,
    eventsRejected: 0,
    outboxDropped: 0,
    listenerErrors: 0
  }

  constructor(opts: GameAdapterOptions & GameAdapterExtraOptions) {
    this.baseUrl = trimBaseUrl(opts.baseUrl)
    this.sessionId = opts.sessionId
    this.token = opts.consumerToken
    this.sourceId = opts.sourceId ?? `game-${randomId().replace(/-/g, '').slice(0, 12)}`
    this.heartbeatTimeoutMs =
      typeof opts.heartbeatTimeoutMs === 'number' && opts.heartbeatTimeoutMs > 0
        ? opts.heartbeatTimeoutMs
        : 6000
    this.outboxLimit =
      typeof opts.outboxLimit === 'number' && opts.outboxLimit >= 1
        ? Math.floor(opts.outboxLimit)
        : 200
    this.wsFactory = opts.webSocketFactory ?? defaultWebSocketFactory
    this.now = opts.now ?? (() => performance.now())
    this.backoff = new Backoff(opts.reconnect, opts.random)
    this.visionEnabled = opts.visionAdaptationEnabled ?? true
    if (!this.visionEnabled) {
      // Queued now, delivered on the first connect (and resent until acked).
      this.enqueueSetting(false)
    }
  }

  // --- Public API -----------------------------------------------------------------------

  get status(): ConnectionStatus {
    return this._status
  }

  get stats(): GameAdapterStats {
    return { ...this.counters }
  }

  /** Unacked game events currently held for (re)send. */
  get outboxSize(): number {
    return this.outbox.length
  }

  /** Highest event_seq seen (sent as resume_after_event_seq on reconnect). */
  get lastEventSeq(): number | null {
    return this.maxEventSeq
  }

  connect(): Promise<void> {
    if (this._status === 'open') return Promise.resolve()
    if (!this.connectPromise) {
      this.connectPromise = new Promise<void>((resolve, reject) => {
        this.connectResolve = resolve
        this.connectReject = reject
      })
      this.connectPromise.catch(noop)
    }
    const promise = this.connectPromise
    if (this._status === 'idle' || this._status === 'closed' || this._status === 'failed') {
      this.backoff.reset()
      this.setStatus('connecting', null)
      this.startAttempt()
    }
    return promise
  }

  disconnect(): void {
    this.teardown()
    this.latestState = null
    if (this._status !== 'closed') this.setStatus('closed', 'client_disconnect')
    this.settleConnect(new ServiceError(0, 'closed', 'disconnected before the connection opened'))
  }

  getLatestState(): AdapterState {
    const stale = this.isStale()
    return {
      connection: this._status,
      stale,
      state: stale ? null : this.latestState,
      stateSeq: this.stateSeq,
      receivedAt: this.stateReceivedAt,
      visionAdaptationEnabled: this.visionEnabled
    }
  }

  sendGameEvent(input: GameEventInput): string {
    const message = this.buildEvent(input)
    this.outbox.push(message)
    while (this.outbox.length > this.outboxLimit) {
      this.outbox.shift()
      this.counters.outboxDropped += 1
    }
    if (this.isOpen()) this.transmit(message)
    return message.event_id
  }

  setVisionAdaptationEnabled(enabled: boolean): void {
    this.visionEnabled = enabled
    this.enqueueSetting(enabled)
  }

  onState(cb: (s: AdapterState) => void): Unsubscribe {
    return this.subscribe(this.stateListeners, cb)
  }

  onGesture(cb: (g: GestureEventMessage) => void): Unsubscribe {
    return this.subscribe(this.gestureListeners, cb)
  }

  onSuggestedAction(cb: (a: SuggestedActionMessage) => void): Unsubscribe {
    return this.subscribe(this.actionListeners, cb)
  }

  onConnectionStatus(cb: (e: ConnectionStatusEvent) => void): Unsubscribe {
    return this.subscribe(this.statusListeners, cb)
  }

  // --- Listeners ------------------------------------------------------------------------

  private subscribe<T>(set: Set<(v: T) => void>, cb: (v: T) => void): Unsubscribe {
    set.add(cb)
    return () => {
      set.delete(cb)
    }
  }

  private emit<T>(set: Set<(v: T) => void>, value: T): void {
    for (const cb of [...set]) {
      try {
        cb(value)
      } catch (err) {
        this.counters.listenerErrors += 1
        console.error('[GameAdapter] listener threw', err)
      }
    }
  }

  private setStatus(status: ConnectionStatus, reason: string | null): void {
    if (status === this._status && reason === this.reason) return
    this._status = status
    this.reason = reason
    this.emit(this.statusListeners, { status, reason, attempt: this.backoff.attempts })
    this.checkStaleTransition()
  }

  private settleConnect(err?: Error): void {
    const resolve = this.connectResolve
    const reject = this.connectReject
    this.connectPromise = null
    this.connectResolve = null
    this.connectReject = null
    if (err) reject?.(err)
    else resolve?.()
  }

  // --- Staleness ------------------------------------------------------------------------

  private isOpen(): boolean {
    return this._status === 'open' && this.ws !== null
  }

  private isStale(): boolean {
    if (!this.isOpen() || this.lastMessageAt === null) return true
    return this.now() - this.lastMessageAt > this.heartbeatTimeoutMs
  }

  /** Emit a state=null update once whenever the adapter becomes stale. */
  private checkStaleTransition(): void {
    if (this.isStale() && !this.emittedStale) {
      this.emittedStale = true
      this.emit(this.stateListeners, this.getLatestState())
    }
  }

  // --- Lifecycle ------------------------------------------------------------------------

  private clearTimer(timer: Timer | null): null {
    if (timer !== null) clearTimeout(timer)
    return null
  }

  private teardown(): void {
    this.generation += 1
    this.heartbeatTimer = this.clearTimer(this.heartbeatTimer)
    this.reconnectTimer = this.clearTimer(this.reconnectTimer)
    this.retryTimer = this.clearTimer(this.retryTimer)
    const ws = this.ws
    this.ws = null
    // A state received on a previous connection is never shown again.
    this.latestState = null
    if (ws) {
      detach(ws)
      try {
        ws.close(1000, 'client_close')
      } catch {
        // already closed
      }
    }
  }

  private startAttempt(): void {
    this.teardown()
    const gen = this.generation
    let ws: WebSocketLike
    try {
      ws = this.wsFactory(streamUrl(this.baseUrl, this.sessionId))
    } catch {
      this.scheduleReconnect('connect_error')
      return
    }
    this.ws = ws
    this.armHeartbeat()
    ws.onopen = () => {
      if (gen !== this.generation) return
      const hello: HelloMessage = {
        type: 'hello',
        schema_version: SCHEMA_VERSION,
        role: 'consumer',
        client_id: this.sourceId,
        token: this.token,
        resume_after_event_seq: this.maxEventSeq
      }
      this.sendRaw(JSON.stringify(hello))
    }
    ws.onmessage = (ev) => {
      if (gen !== this.generation) return
      this.handleFrame(ev.data)
    }
    ws.onerror = noop
    ws.onclose = (ev) => {
      if (gen !== this.generation) return
      this.handleClose(ev.code)
    }
  }

  private armHeartbeat(): void {
    this.heartbeatTimer = this.clearTimer(this.heartbeatTimer)
    const gen = this.generation
    this.heartbeatTimer = setTimeout(() => {
      this.heartbeatTimer = null
      if (gen !== this.generation) return
      this.scheduleReconnect('heartbeat_timeout')
    }, this.heartbeatTimeoutMs)
  }

  private handleClose(code: number): void {
    const outcome = classifyClose(code)
    if (outcome.kind === 'reconnect') this.scheduleReconnect(outcome.reason)
    else this.finish(outcome.kind, outcome.reason)
  }

  private finish(status: 'failed' | 'closed', reason: string): void {
    this.teardown()
    this.setStatus(status, reason)
    this.settleConnect(new ServiceError(0, reason, `game adapter ${status}: ${reason}`))
  }

  private scheduleReconnect(reason: string): void {
    this.teardown()
    const delay = this.backoff.next()
    if (delay === null) {
      this.finish('failed', 'reconnect_exhausted')
      return
    }
    this.setStatus('reconnecting', reason)
    const gen = this.generation
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (gen !== this.generation) return
      this.startAttempt()
    }, delay)
  }

  // --- Incoming -------------------------------------------------------------------------

  private handleFrame(data: unknown): void {
    this.lastMessageAt = this.now()
    this.armHeartbeat()
    this.counters.received += 1
    const msg = parseServerMessage(data)
    if (!msg || ('session_id' in msg && msg.session_id !== this.sessionId)) {
      this.counters.invalid += 1
      return
    }
    this.handleMessage(msg)
  }

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        if (msg.role !== 'consumer') {
          this.counters.invalid += 1
          return
        }
        this.onWelcome()
        return
      case 'state':
        if (!this.isOpen()) return
        this.latestState = msg.state
        this.stateSeq = msg.state_seq
        this.stateReceivedAt = this.now()
        this.counters.statesReceived += 1
        this.emittedStale = false
        this.emit(this.stateListeners, this.getLatestState())
        return
      case 'gesture':
        this.noteEventSeq(msg.event_seq)
        if (this.seenGestures.has(msg.gesture.gesture_id)) {
          this.counters.duplicatesSuppressed += 1
          return
        }
        this.seenGestures.add(msg.gesture.gesture_id)
        this.counters.gesturesDelivered += 1
        this.emit(this.gestureListeners, msg)
        return
      case 'suggested_action':
        this.noteEventSeq(msg.event_seq)
        if (this.seenActions.has(msg.action_id)) {
          this.counters.duplicatesSuppressed += 1
          return
        }
        this.seenActions.add(msg.action_id)
        if (!this.visionEnabled && msg.source !== 'gameplay') {
          this.counters.actionsSuppressedVisionDisabled += 1
          return
        }
        this.counters.actionsDelivered += 1
        this.emit(this.actionListeners, msg)
        return
      case 'ack':
        if (msg.kind !== 'game_event') return
        this.handleAck(msg.id ?? null, msg.seq, msg.status)
        return
      case 'error':
        this.handleError(msg.code, msg.seq ?? null)
        return
      default:
        // heartbeat / pong: liveness already recorded.
        return
    }
  }

  private noteEventSeq(seq: number): void {
    if (this.maxEventSeq === null || seq > this.maxEventSeq) this.maxEventSeq = seq
  }

  private onWelcome(): void {
    this.backoff.reset()
    this.setStatus('open', null)
    this.settleConnect()
    // Resend every unacked event, in order, with its original seq and event_id.
    for (const message of [...this.outbox]) this.transmit(message)
  }

  private handleAck(id: string | null, seq: number, status: 'accepted' | 'duplicate'): void {
    const index = this.outbox.findIndex((m) => (id !== null ? m.event_id === id : m.seq === seq))
    if (status === 'duplicate') this.counters.eventsDuplicate += 1
    else this.counters.eventsAcked += 1
    if (index >= 0) this.outbox.splice(index, 1)
  }

  private handleError(code: string, seq: number | null): void {
    if (seq === null) return
    if (code === 'rate_limited') {
      // Not a bad event, just too early. Re-sequence it (same event_id, so the service
      // still deduplicates) and resend shortly; later events may already have used
      // higher seqs, so resending the old seq would be rejected as out_of_order.
      const index = this.outbox.findIndex((m) => m.seq === seq)
      if (index < 0) return
      const [message] = this.outbox.splice(index, 1)
      this.eventSeq += 1
      this.outbox.push({ ...message, seq: this.eventSeq })
      if (this.retryTimer === null) {
        this.retryTimer = setTimeout(() => {
          this.retryTimer = null
          for (const m of [...this.outbox]) if (m.seq > seq) this.transmit(m)
        }, 1000)
      }
      return
    }
    // A rejected event (invalid, out of order, unknown task, rate limited) would be rejected
    // again on resend; drop it so it cannot block or repeat.
    const index = this.outbox.findIndex((m) => m.seq === seq)
    if (index >= 0) {
      this.outbox.splice(index, 1)
      this.counters.eventsRejected += 1
      console.warn(`[GameAdapter] game event seq=${seq} rejected: ${code}`)
    }
  }

  // --- Outgoing -------------------------------------------------------------------------

  private buildEvent(input: GameEventInput): GameEventMessage {
    this.eventSeq += 1
    return {
      type: 'game_event',
      schema_version: SCHEMA_VERSION,
      session_id: this.sessionId,
      source_id: this.sourceId,
      seq: this.eventSeq,
      event_id: input.event_id ?? randomId(),
      client_ts_ms: input.client_ts_ms ?? this.now(),
      event_type: input.event_type,
      task_id: input.task_id ?? null,
      data: input.data ?? {}
    }
  }

  private enqueueSetting(enabled: boolean): void {
    this.sendGameEvent({
      event_type: 'adaptation_setting',
      data: { vision_adaptation_enabled: enabled }
    })
  }

  private transmit(message: GameEventMessage): void {
    this.counters.eventsSent += 1
    this.sendRaw(JSON.stringify(message))
  }

  private sendRaw(payload: string): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WS_OPEN) return
    try {
      ws.send(payload)
    } catch {
      // The close handler reconnects; the outbox keeps the event.
    }
  }
}
