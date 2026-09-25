/**
 * Session lifecycle over HTTP: create and delete. Errors are thrown as ServiceError with
 * the service's machine-readable code (e.g. 'session_not_found', 'forbidden').
 */

import type { CreateSessionRequest, CreateSessionResponse } from '../protocol/types.ts'
import { trimBaseUrl } from '../protocol/validate.ts'

export class ServiceError extends Error {
  /** HTTP status, or 0 for network failures / malformed responses. */
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.status = status
    this.code = code
  }
}

export type FetchLike = typeof fetch

/** Wrap an optional fetch so it is never invoked as a method of another object. */
export function resolveFetch(fetchImpl?: FetchLike): FetchLike {
  if (fetchImpl) return fetchImpl
  return ((input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) =>
    globalThis.fetch(input, init)) as FetchLike
}

/** Build a ServiceError from a non-2xx response ({error:{code,message}} body if present). */
export async function readServiceError(res: Response): Promise<ServiceError> {
  let code = `http_${res.status}`
  let message = res.statusText || `HTTP ${res.status}`
  try {
    const body: unknown = await res.json()
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const err = (body as { error: unknown }).error
      if (typeof err === 'object' && err !== null) {
        const e = err as { code?: unknown; message?: unknown }
        if (typeof e.code === 'string') code = e.code
        if (typeof e.message === 'string') message = e.message
      }
    }
  } catch {
    // Non-JSON error body: keep the HTTP-derived code.
  }
  return new ServiceError(res.status, code, message)
}

function networkError(err: unknown): ServiceError {
  const message = err instanceof Error ? err.message : String(err)
  return new ServiceError(0, 'network_error', message)
}

function isCreateSessionResponse(v: unknown): v is CreateSessionResponse {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.session_id === 'string' &&
    typeof r.producer_token === 'string' &&
    typeof r.consumer_token === 'string' &&
    typeof r.endpoints === 'object' &&
    r.endpoints !== null
  )
}

export interface CreateSessionOptions {
  policyOverrides?: Record<string, number>
  label?: string
  /** Sent as X-Session-Create-Key when the service requires one. */
  createKey?: string
  fetchImpl?: FetchLike
}

export async function createSession(
  baseUrl: string,
  opts: CreateSessionOptions = {}
): Promise<CreateSessionResponse> {
  const fetchFn = resolveFetch(opts.fetchImpl)
  const body: CreateSessionRequest = {}
  if (opts.label !== undefined) body.label = opts.label
  if (opts.policyOverrides !== undefined) body.policy_overrides = opts.policyOverrides
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (opts.createKey !== undefined) headers['X-Session-Create-Key'] = opts.createKey
  let res: Response
  try {
    res = await fetchFn(`${trimBaseUrl(baseUrl)}/v1/sessions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
  } catch (err) {
    throw networkError(err)
  }
  if (!res.ok) throw await readServiceError(res)
  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    throw new ServiceError(res.status, 'invalid_response', 'session response is not JSON')
  }
  if (!isCreateSessionResponse(parsed)) {
    throw new ServiceError(res.status, 'invalid_response', 'unexpected session response shape')
  }
  return parsed
}

/** Delete a session with either role's token. Resolves on 204. */
export async function deleteSession(
  baseUrl: string,
  sessionId: string,
  token: string,
  fetchImpl?: FetchLike
): Promise<void> {
  const fetchFn = resolveFetch(fetchImpl)
  let res: Response
  try {
    res = await fetchFn(
      `${trimBaseUrl(baseUrl)}/v1/sessions/${encodeURIComponent(sessionId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
    )
  } catch (err) {
    throw networkError(err)
  }
  if (!res.ok) throw await readServiceError(res)
}
