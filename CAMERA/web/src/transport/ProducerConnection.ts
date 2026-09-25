/**
 * ProducerConnection: the camera side's connection to the service.
 *
 * - Owns `seq` (strictly increasing for the lifetime of the instance, across reconnects)
 *   and wraps each ObservationBody in the observation envelope.
 * - Throttles to `sendIntervalMs`, except that a never-sent gesture or a change of
 *   tracking/calibration status is sent immediately.
 * - Holds only the LATEST observation while disconnected or while an HTTP request is in
 *   flight. There is no queue, so backpressure can never grow memory or latency.
 * - Never sends an observation whose capture time is older than `maxObservationAgeMs`:
 *   after a reconnect the service must not receive stale data that looks fresh.
 * - Gestures are held in a bounded pending set and carried by every observation until an
 *   ack (accepted or duplicate) arrives for a seq that carried them, or they age out.
 */

import type {
  ConnectionStatus,
  ConnectionStatusEvent,
  ProducerConnectionApi,
  ProducerConnectionOptions,
  Unsubscribe,
  WebSocketFactory,
  WebSocketLike
} from './contracts.ts'
import type {
  Gesture,
  HelloMessage,
  ObservationBody,
  ObservationMessage,
  ServerMessage
} from '../protocol/types.ts'
import { SCHEMA_VERSION } from '../protocol/types.ts'
import { parseServerMessage, streamUrl, trimBaseUrl } from '../protocol/validate.ts'
import { Backoff, classifyClose, fatalHttpReason } from './backoff.ts'
import { readServiceError, resolveFetch, ServiceError } from './session.ts'
import type { FetchLike } from './session.ts'

const WS_OPEN = 1
/** Service limit: at most 16 gestures per observation. */
export const MAX_GESTURES_PER_OBSERVATION = 16
/** Upper bound on unacked gestures held by the producer. */
export const MAX_PENDING_GESTURES = 64
const ACKED_GESTURE_MEMORY = 512
const DEFAULT_HEARTBEAT_TIMEOUT_MS = 6000

export interface ProducerStats {
  sent: number
  acked: number
  duplicates: number
  rejected: number
  droppedStale: number
}

/** Extra, optional knobs beyond the shared contract. */
export interface ProducerConnectionExtraOptions {
  /** WebSocket only: no message (heartbeats included) for this long => reconnect. Default 6000. */
  heartbeatTimeoutMs?: number
  /** Random source for backoff jitter (tests). */
  random?: () => number
}

interface PendingGesture {
  gesture: Gesture
  /** Observation seqs that carried this gesture; an ack for any of them settles it. */
  carriedBy: number[]
}

type Timer = ReturnType<typeof setTimeout>

function noop(): void {}

function detach(ws: WebSocketLike): void {
  ws.onopen = noop
  ws.onmessage = noop
  ws.onclose = noop
  // Keep an error handler: some implementations (the `ws` package) throw on unhandled errors.
  ws.onerror = noop
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

function defaultWebSocketFactory(url: string): WebSocketLike {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => WebSocketLike }).WebSocket
  if (!Ctor) throw new Error('no global WebSocket; pass webSocketFactory')
  return new Ctor(url)
}

function defaultNow(): number {
  return performance.now()
}

export class ProducerConnection implements ProducerConnectionApi {
  private readonly baseUrl: string
  private readonly sessionId: string
  private readonly token: string
  private readonly producerId: string
  private readonly transport: 'websocket' | 'http'
  private readonly sendIntervalMs: number
  private readonly maxObservationAgeMs: number
  private readonly maxGestureAgeMs: number
  private readonly heartbeatTimeoutMs: number
  private readonly wsFactory: WebSocketFactory
  private readonly fetchFn: FetchLike
  private readonly now: () => number
  private readonly backoff: Backoff
  private readonly rateBackoff: Backoff

  private _status: ConnectionStatus = 'idle'
  private reason: string | null = null
  /** Bumped on every new attempt and on teardown; stale async callbacks compare against it. */
  private generation = 0
  private ws: WebSocketLike | null = null
  /** true once the transport can carry observations (welcome received / session verified). */
  private ready = false

  private seq = 0
  private latest: ObservationBody | null = null
  private lastSentAt: number | null = null
  private lastSentCaptureTs = -Infinity
  private lastSentTracking: string | null = null
  private lastSentCalibration: string | null = null
  private readonly pending = new Map<string, PendingGesture>()
  private readonly ackedGestures = new Set<string>()

  private throttleTimer: Timer | null = null
  private reconnectTimer: Timer | null = null
  private heartbeatTimer: Timer | null = null
  private rateLimitTimer: Timer | null = null
  private httpInFlight: AbortController | null = null

  private connectPromise: Promise<void> | null = null
  private connectResolve: (() => void) | null = null
  private connectReject: ((e: Error) => void) | null = null

  private readonly statusListeners = new Set<(e: ConnectionStatusEvent) => void>()
  private readonly errorListeners = new Set<(e: { code: string; message: string }) => void>()
  private readonly counters: ProducerStats = {
    sent: 0,
    acked: 0,
    duplicates: 0,
    rejected: 0,
    droppedStale: 0
  }
  private invalidMessages = 0

  constructor(opts: ProducerConnectionOptions & ProducerConnectionExtraOptions) {
    this.baseUrl = trimBaseUrl(opts.baseUrl)
    this.sessionId = opts.sessionId
    this.token = opts.producerToken
    // Per-instance suffix: the service tracks seq per producer_id, so a reloaded page that
    // restarted at seq 0 under the same id would be rejected as out_of_order forever. A new
    // instance is a new producer; the service admits it once the old one has gone silent.
    this.producerId = `${opts.producerId}.${randomSuffix()}`
    this.transport = opts.transport ?? 'websocket'
    this.sendIntervalMs = positive(opts.sendIntervalMs, 100)
    this.maxObservationAgeMs = positive(opts.maxObservationAgeMs, 500)
    this.maxGestureAgeMs = positive(opts.maxGestureAgeMs, 4000)
    this.heartbeatTimeoutMs = positive(opts.heartbeatTimeoutMs, DEFAULT_HEARTBEAT_TIMEOUT_MS)
    this.wsFactory = opts.webSocketFactory ?? defaultWebSocketFactory
    this.fetchFn = resolveFetch(opts.fetchImpl)
    this.now = opts.now ?? defaultNow
    this.backoff = new Backoff(opts.reconnect, opts.random)
    this.rateBackoff = new Backoff({ ...opts.reconnect, maxAttempts: Infinity }, opts.random)
  }

  // --- Public API -----------------------------------------------------------------------

  get status(): ConnectionStatus {
    return this._status
  }

  get stats(): ProducerStats {
    return { ...this.counters }
  }

  /** Messages from the service that failed validation and were ignored. */
  get invalidMessageCount(): number {
    return this.invalidMessages
  }

  /** Gestures still waiting for an ack. */
  get pendingGestureCount(): number {
    return this.pending.size
  }

  /** Next seq to be assigned minus one (0 before the first send). */
  get lastSeq(): number {
    return this.seq
  }

  connect(): Promise<void> {
    if (this._status === 'open') return Promise.resolve()
    if (!this.connectPromise) {
      this.connectPromise = new Promise<void>((resolve, reject) => {
        this.connectResolve = resolve
        this.connectReject = reject
      })
      // Mark handled: callers that await it still observe the rejection.
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
    this.latest = null
    this.pending.clear()
    if (this._status !== 'closed') this.setStatus('closed', 'client_disconnect')
    this.settleConnect(new ServiceError(0, 'closed', 'disconnected before the connection opened'))
  }

  submit(body: ObservationBody): void {
    if (this._status === 'closed' || this._status === 'failed') return
    const t = this.now()
    this.addGestures(body.gestures ?? [], t)
    this.latest = body
    this.maybeSend()
  }

  onStatus(cb: (e: ConnectionStatusEvent) => void): Unsubscribe {
    this.statusListeners.add(cb)
    return () => {
      this.statusListeners.delete(cb)
    }
  }

  onError(cb: (e: { code: string; message: string }) => void): Unsubscribe {
    this.errorListeners.add(cb)
    return () => {
      this.errorListeners.delete(cb)
    }
  }

  // --- Status / listeners ---------------------------------------------------------------

  private setStatus(status: ConnectionStatus, reason: string | null): void {
    if (status === this._status && reason === this.reason) return
    this._status = status
    this.reason = reason
    const event: ConnectionStatusEvent = { status, reason, attempt: this.backoff.attempts }
    for (const cb of [...this.statusListeners]) {
      try {
        cb(event)
      } catch (err) {
        console.error('[ProducerConnection] status listener threw', err)
      }
    }
  }

  private emitError(code: string, message: string): void {
    for (const cb of [...this.errorListeners]) {
      try {
        cb({ code, message })
      } catch (err) {
        console.error('[ProducerConnection] error listener threw', err)
      }
    }
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

  // --- Lifecycle ------------------------------------------------------------------------

  private clearTimer(timer: Timer | null): null {
    if (timer !== null) clearTimeout(timer)
    return null
  }

  /** Stop every timer, socket and request. Idempotent. */
  private teardown(): void {
    this.generation += 1
    this.ready = false
    this.throttleTimer = this.clearTimer(this.throttleTimer)
    this.reconnectTimer = this.clearTimer(this.reconnectTimer)
    this.heartbeatTimer = this.clearTimer(this.heartbeatTimer)
    this.rateLimitTimer = this.clearTimer(this.rateLimitTimer)
    if (this.httpInFlight) {
      this.httpInFlight.abort()
      this.httpInFlight = null
    }
    const ws = this.ws
    this.ws = null
    if (ws) {
      detach(ws)
      try {
        ws.close(1000, 'client_close')
      } catch {
        // Already closed or never opened.
      }
    }
  }

  private startAttempt(): void {
    this.teardown()
    if (this.transport === 'http') {
      void this.verifyHttpSession()
      return
    }
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
        role: 'producer',
        client_id: this.producerId,
        token: this.token
      }
      this.sendRaw(JSON.stringify(hello))
    }
    ws.onmessage = (ev) => {
      if (gen !== this.generation) return
      this.armHeartbeat()
      const msg = parseServerMessage(ev.data)
      if (!msg) {
        this.invalidMessages += 1
        return
      }
      this.handleMessage(msg)
    }
    ws.onerror = noop // a close event always follows
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
      this.teardown()
      this.scheduleReconnect('heartbeat_timeout')
    }, this.heartbeatTimeoutMs)
  }

  private handleClose(code: number): void {
    this.teardown()
    const outcome = classifyClose(code)
    if (outcome.kind === 'reconnect') this.scheduleReconnect(outcome.reason)
    else this.finish(outcome.kind, outcome.reason)
  }

  /** Terminal state: 'failed' (fatal) or 'closed' (session ended). */
  private finish(status: 'failed' | 'closed', reason: string, httpStatus = 0): void {
    this.teardown()
    this.latest = null
    this.setStatus(status, reason)
    this.settleConnect(new ServiceError(httpStatus, reason, `producer connection ${status}: ${reason}`))
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

  private becameReady(): void {
    this.ready = true
    this.backoff.reset()
    this.setStatus('open', null)
    this.settleConnect()
    this.flush()
  }

  // --- Incoming (WebSocket) -------------------------------------------------------------

  private handleMessage(msg: ServerMessage): void {
    switch (msg.type) {
      case 'welcome':
        if (msg.role !== 'producer' || msg.session_id !== this.sessionId) {
          this.invalidMessages += 1
          return
        }
        this.becameReady()
        return
      case 'ack':
        if (msg.kind !== 'observation') return
        this.handleAck(msg.seq, msg.status)
        return
      case 'error':
        if (msg.seq !== null && msg.seq !== undefined) this.counters.rejected += 1
        this.emitError(msg.code, msg.message)
        return
      default:
        // heartbeat / pong: liveness only (already recorded). Producers get nothing else.
        return
    }
  }

  private handleAck(seq: number, status: 'accepted' | 'duplicate'): void {
    if (status === 'duplicate') this.counters.duplicates += 1
    else this.counters.acked += 1
    for (const [id, p] of this.pending) {
      if (p.carriedBy.includes(seq)) {
        this.pending.delete(id)
        this.rememberAcked(id)
      }
    }
  }

  // --- Gestures -------------------------------------------------------------------------

  private rememberAcked(id: string): void {
    this.ackedGestures.add(id)
    if (this.ackedGestures.size > ACKED_GESTURE_MEMORY) {
      const oldest = this.ackedGestures.values().next().value
      if (oldest !== undefined) this.ackedGestures.delete(oldest)
    }
  }

  private addGestures(gestures: Gesture[], t: number): void {
    for (const g of gestures) {
      if (!g || typeof g.gesture_id !== 'string') continue
      if (this.pending.has(g.gesture_id) || this.ackedGestures.has(g.gesture_id)) continue
      if (t - g.end_ts_ms > this.maxGestureAgeMs) continue
      this.pending.set(g.gesture_id, { gesture: g, carriedBy: [] })
      while (this.pending.size > MAX_PENDING_GESTURES) {
        const oldest = this.pending.keys().next().value
        if (oldest === undefined) break
        this.pending.delete(oldest)
      }
    }
  }

  private pruneGestures(t: number): void {
    for (const [id, p] of this.pending) {
      if (t - p.gesture.end_ts_ms > this.maxGestureAgeMs) this.pending.delete(id)
    }
  }

  private hasUnsentGesture(): boolean {
    for (const p of this.pending.values()) if (p.carriedBy.length === 0) return true
    return false
  }

  // --- Sending --------------------------------------------------------------------------

  private canSendNow(): boolean {
    if (!this.ready) return false
    if (this.transport === 'http' && (this.httpInFlight !== null || this.rateLimitTimer !== null)) {
      return false
    }
    return true
  }

  private maybeSend(): void {
    if (!this.latest || !this.canSendNow()) return
    const t = this.now()
    this.pruneGestures(t)
    const body = this.latest
    const urgent =
      this.hasUnsentGesture() ||
      body.tracking.status !== this.lastSentTracking ||
      body.calibration.status !== this.lastSentCalibration
    if (urgent || this.lastSentAt === null || t - this.lastSentAt >= this.sendIntervalMs) {
      this.flush()
      return
    }
    if (this.throttleTimer === null) {
      const gen = this.generation
      this.throttleTimer = setTimeout(() => {
        this.throttleTimer = null
        if (gen !== this.generation) return
        this.flush()
      }, Math.max(0, this.sendIntervalMs - (t - this.lastSentAt)))
    }
  }

  /** Send the latest observation now (if any and not stale). */
  private flush(): void {
    this.throttleTimer = this.clearTimer(this.throttleTimer)
    if (!this.latest || !this.canSendNow()) return
    const body = this.latest
    this.latest = null
    const t = this.now()
    if (
      !Number.isFinite(body.capture_ts_ms) ||
      t - body.capture_ts_ms > this.maxObservationAgeMs ||
      body.capture_ts_ms < this.lastSentCaptureTs
    ) {
      // Too old (or older than something already sent): never deliver it late.
      this.counters.droppedStale += 1
      return
    }
    this.pruneGestures(t)
    const carried: PendingGesture[] = []
    for (const p of this.pending.values()) {
      if (carried.length >= MAX_GESTURES_PER_OBSERVATION) break
      carried.push(p)
    }
    this.seq += 1
    const seq = this.seq
    const message: ObservationMessage = {
      type: 'observation',
      schema_version: SCHEMA_VERSION,
      session_id: this.sessionId,
      producer_id: this.producerId,
      seq,
      capture_ts_ms: body.capture_ts_ms,
      tracking: body.tracking,
      calibration: body.calibration,
      measurements: body.measurements,
      gestures: carried.map((p) => p.gesture),
      perf: body.perf ?? null,
      simulated: body.simulated === true
    }
    for (const p of carried) p.carriedBy.push(seq)
    this.lastSentAt = t
    this.lastSentCaptureTs = body.capture_ts_ms
    this.lastSentTracking = body.tracking.status
    this.lastSentCalibration = body.calibration.status
    this.counters.sent += 1
    const payload = JSON.stringify(message)
    if (this.transport === 'http') void this.postObservation(payload, seq)
    else this.sendRaw(payload)
  }

  private sendRaw(payload: string): void {
    const ws = this.ws
    if (!ws || ws.readyState !== WS_OPEN) return
    try {
      ws.send(payload)
    } catch {
      // The close handler takes care of reconnecting.
    }
  }

  // --- HTTP transport -------------------------------------------------------------------

  private authHeaders(json: boolean): Record<string, string> {
    const h: Record<string, string> = { Authorization: `Bearer ${this.token}` }
    if (json) h['Content-Type'] = 'application/json'
    return h
  }

  private sessionPath(suffix: string): string {
    return `${this.baseUrl}/v1/sessions/${encodeURIComponent(this.sessionId)}${suffix}`
  }

  /** HTTP "connect": verify the session and token with GET /state (allowed for producers). */
  private async verifyHttpSession(): Promise<void> {
    const gen = this.generation
    const ctrl = new AbortController()
    this.httpInFlight = ctrl
    let res: Response
    try {
      res = await this.fetchFn(this.sessionPath('/state'), {
        method: 'GET',
        headers: this.authHeaders(false),
        signal: ctrl.signal
      })
    } catch {
      if (gen !== this.generation) return
      this.httpInFlight = null
      this.scheduleReconnect('network_error')
      return
    }
    if (gen !== this.generation) return
    this.httpInFlight = null
    if (res.ok) {
      void res.body?.cancel().catch(noop)
      this.becameReady()
      return
    }
    const err = await readServiceError(res)
    if (gen !== this.generation) return
    const fatal = fatalHttpReason(err.status, err.code)
    this.emitError(err.code, err.message)
    if (fatal) this.finish('failed', fatal, err.status)
    else this.scheduleReconnect(err.code)
  }

  private async postObservation(payload: string, seq: number): Promise<void> {
    const gen = this.generation
    const ctrl = new AbortController()
    this.httpInFlight = ctrl
    let res: Response
    try {
      res = await this.fetchFn(this.sessionPath('/observations'), {
        method: 'POST',
        headers: this.authHeaders(true),
        body: payload,
        signal: ctrl.signal
      })
    } catch {
      if (gen !== this.generation) return
      this.httpInFlight = null
      this.scheduleReconnect('network_error')
      return
    }
    if (gen !== this.generation) return
    if (res.ok) {
      let status: 'accepted' | 'duplicate' = 'accepted'
      try {
        const body = (await res.json()) as { status?: unknown }
        if (body.status === 'duplicate') status = 'duplicate'
      } catch {
        // A 2xx without a JSON body still means the service took it.
      }
      if (gen !== this.generation) return
      this.httpInFlight = null
      this.rateBackoff.reset()
      this.handleAck(seq, status)
      this.maybeSend()
      return
    }
    const err = await readServiceError(res)
    if (gen !== this.generation) return
    this.httpInFlight = null
    this.emitError(err.code, err.message)
    const fatal = fatalHttpReason(err.status, err.code)
    if (fatal) {
      this.finish('failed', fatal, err.status)
      return
    }
    if (err.status >= 500) {
      this.scheduleReconnect('server_error')
      return
    }
    // 400/409/413/422: this observation is skipped (its gestures stay pending).
    this.counters.rejected += 1
    if (err.status === 429) {
      const delay = this.rateBackoff.next() ?? this.rateBackoff.options.maxDelayMs
      this.rateLimitTimer = setTimeout(() => {
        this.rateLimitTimer = null
        if (gen !== this.generation) return
        this.maybeSend()
      }, delay)
      return
    }
    this.maybeSend()
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8)
}
