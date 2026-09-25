/**
 * Public contracts for the two independent connections:
 *  - ProducerConnection: owned by the camera side; sends observations.
 *  - GameAdapter: owned by the game; sends game events, receives state/gestures/actions.
 * They never share a socket, so the game can consume the service without owning a camera.
 */

import type {
  DerivedState,
  GameEventInput,
  GestureEventMessage,
  ObservationBody,
  SuggestedActionMessage
} from '../protocol/types.ts'

/** Minimal WebSocket surface (browser WebSocket and the `ws` package both satisfy it). */
export interface WebSocketLike {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code: number; reason: string }) => void) | null
  onerror: ((ev: unknown) => void) | null
}
export type WebSocketFactory = (url: string) => WebSocketLike

export interface ReconnectOptions {
  initialDelayMs: number // 500
  maxDelayMs: number // 10_000
  factor: number // 2
  jitter: number // 0.2 (±20%)
  maxAttempts: number // Infinity
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'reconnecting'
  | 'closed' // disconnect() called or session deleted
  | 'failed' // fatal: unauthorized / session_not_found / attempts exhausted

export interface ConnectionStatusEvent {
  status: ConnectionStatus
  /** Machine-readable reason, e.g. 'session_not_found', 'unauthorized', 'heartbeat_timeout'. */
  reason: string | null
  attempt: number
}

export type Unsubscribe = () => void

// --- Producer ------------------------------------------------------------------------

export interface ProducerConnectionOptions {
  baseUrl: string // e.g. http://127.0.0.1:8765
  sessionId: string
  producerToken: string
  producerId: string
  transport?: 'websocket' | 'http' // default websocket
  /** Send at most this often unless gestures or status change. Default 100 ms. */
  sendIntervalMs?: number
  /** Observations older than this (producer clock) are dropped, never sent late. Default 500. */
  maxObservationAgeMs?: number
  /** Unacked gestures older than this are dropped. Default 4000. */
  maxGestureAgeMs?: number
  reconnect?: Partial<ReconnectOptions>
  webSocketFactory?: WebSocketFactory
  fetchImpl?: typeof fetch
  /** Monotonic clock, default performance.now. Injected for tests. */
  now?: () => number
}

export interface ProducerConnectionApi {
  connect(): Promise<void>
  disconnect(): void
  /** Hand over the latest observation body; the connection handles seq, throttling, gestures. */
  submit(body: ObservationBody): void
  onStatus(cb: (e: ConnectionStatusEvent) => void): Unsubscribe
  /** Server-reported errors (e.g. producer_conflict). */
  onError(cb: (e: { code: string; message: string }) => void): Unsubscribe
  readonly status: ConnectionStatus
  readonly stats: { sent: number; acked: number; duplicates: number; rejected: number; droppedStale: number }
}

// --- Game adapter --------------------------------------------------------------------

export interface GameAdapterOptions {
  baseUrl: string
  sessionId: string
  consumerToken: string
  sourceId?: string // default 'game-' + random
  /** No message at all for this long => connection considered dead, reconnect. Default 6000. */
  heartbeatTimeoutMs?: number
  reconnect?: Partial<ReconnectOptions>
  /** Max unacked game events kept for resend; oldest dropped beyond this. Default 200. */
  outboxLimit?: number
  /** Initial value; also sent to the service as an adaptation_setting event on connect. */
  visionAdaptationEnabled?: boolean // default true
  webSocketFactory?: WebSocketFactory
  now?: () => number
}

/** What getLatestState() returns. `state` is null whenever it cannot be trusted. */
export interface AdapterState {
  connection: ConnectionStatus
  /** true if the connection is not open or no message arrived within heartbeatTimeoutMs. */
  stale: boolean
  /** Latest server-derived state, or null if stale / never received. */
  state: DerivedState | null
  stateSeq: number | null
  /** Adapter-local monotonic time the last state arrived. */
  receivedAt: number | null
  visionAdaptationEnabled: boolean
}

export interface GameAdapterApi {
  connect(): Promise<void>
  disconnect(): void
  getLatestState(): AdapterState
  /** Queues and sends; resent with the same event_id after reconnect until acked. Returns event_id. */
  sendGameEvent(event: GameEventInput): string
  /** Fires on every accepted state message and on stale transitions (with state null). */
  onState(cb: (s: AdapterState) => void): Unsubscribe
  /** Each gesture_id fires exactly once per adapter instance. */
  onGesture(cb: (g: GestureEventMessage) => void): Unsubscribe
  /** Each action_id fires exactly once. Vision-sourced actions are suppressed while disabled. */
  onSuggestedAction(cb: (a: SuggestedActionMessage) => void): Unsubscribe
  onConnectionStatus(cb: (e: ConnectionStatusEvent) => void): Unsubscribe
  setVisionAdaptationEnabled(enabled: boolean): void
}
