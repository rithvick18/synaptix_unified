/**
 * Runtime structural validation of messages received from the service, plus URL helpers.
 *
 * The service validates everything it emits, but clients must not trust the wire: a
 * message that fails these checks is ignored (and counted) rather than acted upon. Checks
 * cover the `type` discriminant, the schema version where present, and the type of every
 * field a client reads. Non-finite numbers are rejected anywhere in the message.
 */

import type {
  ActionType,
  AttentionState,
  GestureType,
  ServerMessage
} from './types.ts'
import { SCHEMA_VERSION } from './types.ts'

type Obj = Record<string, unknown>

const ATTENTION_STATES: ReadonlySet<AttentionState> = new Set([
  'CALIBRATING',
  'TRACKING_UNAVAILABLE',
  'HEAD_TOWARD_SCREEN',
  'HEAD_AWAY',
  'UNKNOWN'
])
const GESTURE_TYPES: ReadonlySet<GestureType> = new Set(['blink', 'nod', 'head_shake'])
const ACTION_TYPES: ReadonlySet<ActionType> = new Set([
  'delay_instruction',
  'gentle_cue',
  'offer_hint',
  'increase_difficulty'
])
const ACTION_SOURCES: ReadonlySet<string> = new Set(['vision', 'gameplay', 'vision+gameplay'])
const MAX_DEPTH = 12

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
function isInt(v: unknown): v is number {
  return isNum(v) && Number.isInteger(v)
}
function isSeq(v: unknown): v is number {
  return isInt(v) && v >= 0
}
function isStr(v: unknown): v is string {
  return typeof v === 'string'
}
function isId(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= 128
}
function isStrOrNull(v: unknown): boolean {
  return v === null || isStr(v)
}
/** Optional-on-the-wire nullable field: absent, null, or the given type. */
function isOptional(v: unknown, check: (x: unknown) => boolean): boolean {
  return v === undefined || v === null || check(v)
}

/** true if every number in the structure is finite and nesting is bounded. */
export function allNumbersFinite(v: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return false
  if (typeof v === 'number') return Number.isFinite(v)
  if (Array.isArray(v)) return v.every((x) => allNumbersFinite(x, depth + 1))
  if (isObj(v)) {
    for (const key in v) {
      if (!allNumbersFinite(v[key], depth + 1)) return false
    }
  }
  return true
}

function isMeasurement(v: unknown): boolean {
  if (!isObj(v)) return false
  return (v.value === null || v.value !== undefined) && isStrOrNull(v.reason ?? null)
}

function isDerivedState(v: unknown): boolean {
  if (!isObj(v)) return false
  if (!ATTENTION_STATES.has(v.attention_state as AttentionState)) return false
  if (!isStr(v.attention_reason)) return false
  const vision = v.vision
  if (!isObj(vision) || typeof vision.fresh !== 'boolean' || typeof vision.simulated !== 'boolean') {
    return false
  }
  if (typeof vision.tracking_valid !== 'boolean') return false
  if (!isOptional(vision.observation_age_ms, isNum)) return false
  for (const key of ['head_yaw_deg', 'head_pitch_deg', 'head_roll_deg', 'head_facing_score', 'head_away_ms']) {
    if (!isMeasurement(vision[key])) return false
  }
  const gameplay = v.gameplay
  if (!isObj(gameplay) || typeof gameplay.paused !== 'boolean' || typeof gameplay.expected_idle !== 'boolean') {
    return false
  }
  if (!isOptional(gameplay.current_task_id, isStr)) return false
  if (!isMeasurement(v.task_engagement_score)) return false
  const policy = v.policy
  if (!isObj(policy)) return false
  if (!['active', 'held', 'disabled'].includes(policy.vision_adaptation as string)) return false
  if (typeof policy.hold_new_instructions !== 'boolean') return false
  return true
}

function isGesture(v: unknown): boolean {
  if (!isObj(v)) return false
  return (
    isId(v.gesture_id) &&
    GESTURE_TYPES.has(v.type as GestureType) &&
    isNum(v.start_ts_ms) &&
    isNum(v.end_ts_ms) &&
    isOptional(v.amplitude_deg, isNum) &&
    isOptional(v.swings, isNum)
  )
}

function hasVersion(m: Obj): boolean {
  return m.schema_version === SCHEMA_VERSION
}

/**
 * Returns the message typed as ServerMessage if it is structurally valid, else null.
 * Accepts an already-parsed value (use parseServerMessage for raw frames).
 */
export function validateServerMessage(value: unknown): ServerMessage | null {
  if (!isObj(value) || !isStr(value.type)) return null
  if (!allNumbersFinite(value)) return null
  const m = value
  switch (m.type) {
    case 'state':
      return hasVersion(m) &&
        isId(m.session_id) &&
        isSeq(m.state_seq) &&
        isNum(m.server_ts_ms) &&
        isDerivedState(m.state)
        ? (m as unknown as ServerMessage)
        : null
    case 'gesture':
      return hasVersion(m) &&
        isId(m.session_id) &&
        isSeq(m.event_seq) &&
        isId(m.producer_id) &&
        isNum(m.server_receipt_ts_ms) &&
        isGesture(m.gesture)
        ? (m as unknown as ServerMessage)
        : null
    case 'suggested_action':
      return hasVersion(m) &&
        isId(m.session_id) &&
        isSeq(m.event_seq) &&
        isId(m.action_id) &&
        ACTION_TYPES.has(m.action as ActionType) &&
        ACTION_SOURCES.has(m.source as string) &&
        isStrOrNull(m.task_id) &&
        isStr(m.reason) &&
        isObj(m.evidence) &&
        isNum(m.server_ts_ms) &&
        isNum(m.expires_in_ms)
        ? (m as unknown as ServerMessage)
        : null
    case 'ack':
      return (m.kind === 'observation' || m.kind === 'game_event') &&
        isInt(m.seq) &&
        (m.status === 'accepted' || m.status === 'duplicate') &&
        isOptional(m.id, isStr)
        ? (m as unknown as ServerMessage)
        : null
    case 'error':
      return isStr(m.code) && isStr(m.message) && isOptional(m.seq, isInt)
        ? (m as unknown as ServerMessage)
        : null
    case 'welcome':
      return hasVersion(m) &&
        isId(m.session_id) &&
        (m.role === 'producer' || m.role === 'consumer') &&
        isNum(m.heartbeat_interval_ms) &&
        isSeq(m.last_event_seq)
        ? (m as unknown as ServerMessage)
        : null
    case 'heartbeat':
      return isNum(m.server_ts_ms) ? (m as unknown as ServerMessage) : null
    case 'pong':
      return isOptional(m.nonce, isStr) ? (m as unknown as ServerMessage) : null
    default:
      return null
  }
}

/** Parse a raw WebSocket frame (JSON text) and validate it. Returns null if invalid. */
export function parseServerMessage(data: unknown): ServerMessage | null {
  if (typeof data !== 'string') {
    // `ws` delivers Buffers for text frames only when configured to; accept Uint8Array text.
    if (data instanceof Uint8Array) data = new TextDecoder().decode(data)
    else return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(data as string)
  } catch {
    return null
  }
  return validateServerMessage(parsed)
}

/** Strip trailing slashes from a base URL. */
export function trimBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

/**
 * Convert an http(s) base URL plus a path into a ws(s) URL.
 * http://host:8765 + /v1/x -> ws://host:8765/v1/x. ws:// and wss:// bases pass through.
 */
export function toWebSocketUrl(baseUrl: string, path: string): string {
  const url = new URL(trimBaseUrl(baseUrl) + (path.startsWith('/') ? path : '/' + path))
  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error(`unsupported base URL protocol: ${url.protocol}`)
  }
  return url.toString()
}

/** ws(s) URL of a session's stream. Tokens are never placed in the URL. */
export function streamUrl(baseUrl: string, sessionId: string): string {
  return toWebSocketUrl(baseUrl, `/v1/sessions/${encodeURIComponent(sessionId)}/stream`)
}
