/**
 * Bounded exponential backoff with symmetric jitter.
 *
 * delay(n) = min(maxDelayMs, initialDelayMs * factor^(n-1)) * (1 + jitter * u), u in [-1, 1],
 * clamped to [0, maxDelayMs]. `n` is the 1-based reconnect attempt.
 */

import type { ReconnectOptions } from './contracts.ts'

export const DEFAULT_RECONNECT: Readonly<ReconnectOptions> = Object.freeze({
  initialDelayMs: 500,
  maxDelayMs: 10_000,
  factor: 2,
  jitter: 0.2,
  maxAttempts: Infinity
})

function finiteOr(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

/** Merge partial options over the defaults and clamp them to sane bounds. */
export function resolveReconnectOptions(partial?: Partial<ReconnectOptions>): ReconnectOptions {
  const p = partial ?? {}
  const initialDelayMs = finiteOr(p.initialDelayMs, DEFAULT_RECONNECT.initialDelayMs, 0, 3_600_000)
  const maxDelayMs = Math.max(
    initialDelayMs,
    finiteOr(p.maxDelayMs, DEFAULT_RECONNECT.maxDelayMs, 0, 3_600_000)
  )
  return {
    initialDelayMs,
    maxDelayMs,
    factor: finiteOr(p.factor, DEFAULT_RECONNECT.factor, 1, 100),
    jitter: finiteOr(p.jitter, DEFAULT_RECONNECT.jitter, 0, 1),
    // Infinity is allowed here (the default); negatives become 0.
    maxAttempts:
      typeof p.maxAttempts === 'number' && !Number.isNaN(p.maxAttempts)
        ? Math.max(0, p.maxAttempts)
        : DEFAULT_RECONNECT.maxAttempts
  }
}

/** Delay before 1-based attempt `attempt`. `random` returns [0, 1). */
export function backoffDelay(
  attempt: number,
  opts: ReconnectOptions,
  random: () => number = Math.random
): number {
  const n = Math.max(1, Math.floor(attempt))
  // Cap the exponent so factor^n never overflows to Infinity.
  const exp = Math.min(n - 1, 64)
  const base = Math.min(opts.maxDelayMs, opts.initialDelayMs * Math.pow(opts.factor, exp))
  const u = random() * 2 - 1
  const jittered = base * (1 + opts.jitter * u)
  return Math.round(Math.min(opts.maxDelayMs, Math.max(0, jittered)))
}

/** Stateful helper: counts attempts, reports exhaustion, resets on success. */
export class Backoff {
  readonly options: ReconnectOptions
  private attemptCount = 0
  private readonly random: () => number

  constructor(partial?: Partial<ReconnectOptions>, random: () => number = Math.random) {
    this.options = resolveReconnectOptions(partial)
    this.random = random
  }

  /** Number of attempts scheduled since the last reset. */
  get attempts(): number {
    return this.attemptCount
  }

  get exhausted(): boolean {
    return this.attemptCount >= this.options.maxAttempts
  }

  /** Advance to the next attempt and return its delay, or null when attempts are exhausted. */
  next(): number | null {
    if (this.exhausted) return null
    this.attemptCount += 1
    return backoffDelay(this.attemptCount, this.options, this.random)
  }

  reset(): void {
    this.attemptCount = 0
  }
}

// --- Reconnect policy shared by ProducerConnection and GameAdapter ---------------------

export type CloseOutcome =
  | { kind: 'reconnect'; reason: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'closed'; reason: string }

/** Map a WebSocket close code from the service to what the client should do next. */
export function classifyClose(code: number): CloseOutcome {
  switch (code) {
    case 4000:
      return { kind: 'closed', reason: 'session_closed' }
    case 4401:
      return { kind: 'failed', reason: 'unauthorized' }
    case 4403:
      return { kind: 'failed', reason: 'forbidden_origin' }
    case 4404:
      return { kind: 'failed', reason: 'session_not_found' }
    case 4408:
      return { kind: 'reconnect', reason: 'hello_timeout' }
    case 4409:
      return { kind: 'reconnect', reason: 'too_slow' }
    case 1008:
      return { kind: 'reconnect', reason: 'policy_violation' }
    case 1009:
      return { kind: 'reconnect', reason: 'message_too_big' }
    default:
      return { kind: 'reconnect', reason: 'connection_lost' }
  }
}

/** Map a fatal HTTP status to a reason, or null if the status is not fatal. */
export function fatalHttpReason(status: number, code: string): string | null {
  if (status === 401) return 'unauthorized'
  if (status === 403) return code === 'origin_not_allowed' ? 'forbidden_origin' : 'forbidden'
  if (status === 404) return 'session_not_found'
  return null
}
