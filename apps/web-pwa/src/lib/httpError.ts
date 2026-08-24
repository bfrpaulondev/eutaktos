/**
 * HttpError — Uniform API error type preserving the HTTP status code.
 *
 * Most *Api.ts modules used to throw plain `Error` with the status embedded
 * in the message string (e.g. "Households API request failed (409)"), which
 * forced components to do fragile string parsing to differentiate 401 / 403 /
 * 404 / 409 / 5xx. This class preserves the numeric `status` so components can
 * branch programmatically and provide accurate recovery UX.
 *
 * The optional `code` field mirrors the backend `error` string when present
 * (e.g. "Forbidden", "Conflict", "Service temporarily unavailable"). It is
 * sanitized — never reflects tokens, cookies or PII.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    if (code) this.code = code;
  }
}

/**
 * Error kind discriminator used by UI recovery states.
 *
 * - `auth`      → 401 (session expired / unauthenticated). Components should
 *                  surface a sign-in prompt, not a generic "try again".
 * - `forbidden` → 403 (authenticated but lacking capability). Retry will not
 *                  help; the UI should hide / disable the action.
 * - `not-found` → 404 factual (resource does not exist). Distinct from "list
 *                  is empty" — the user was looking for something specific.
 * - `conflict`  → 409 (optimistic concurrency failure, duplicate, scheduling
 *                  rejection). The user needs to refresh and re-apply.
 * - `client`    → other 4xx (malformed request, validation). No retry.
 * - `server`    → 5xx (transient backend failure). Retry may help.
 * - `network`   → fetch threw (offline, DNS, CORS, abort). Retry on connectivity.
 */
export type HttpErrorKind = 'auth' | 'forbidden' | 'not-found' | 'conflict' | 'client' | 'server' | 'network';

export function httpErrorKind(error: unknown): HttpErrorKind {
  if (error instanceof DOMException && error.name === 'AbortError') return 'network';
  if (error instanceof HttpError) {
    if (error.status === 401) return 'auth';
    if (error.status === 403) return 'forbidden';
    if (error.status === 404) return 'not-found';
    if (error.status === 409) return 'conflict';
    if (error.status >= 500) return 'server';
    if (error.status >= 400) return 'client';
  }
  if (error instanceof Error) return 'network';
  return 'network';
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

interface ErrorBody {
  error?: unknown;
}

interface SanitizedErrorInit {
  status: number;
  body: unknown;
  /** Optional label used in fallback messages, e.g. "People API". */
  fallbackLabel: string;
}

/**
 * Build an HttpError from a fetch Response + parsed body.
 *
 * The `message` is sanitized:
 * - 5xx always gets a generic "Service temporarily unavailable" message
 *   (never the upstream body, which may leak internals).
 * - 4xx may surface a short upstream `error` string if it looks safe
 *   (string ≤ 200 chars). Otherwise a generic fallback is used.
 *
 * The `code` is preserved from the upstream `error` field when safe, so
 * components can branch on known backend codes without parsing messages.
 */
export function buildHttpError({ status, body, fallbackLabel }: SanitizedErrorInit): HttpError {
  const upstreamError = body && typeof body === 'object' && !Array.isArray(body)
    ? (body as ErrorBody).error
    : undefined;
  const safeUpstream = typeof upstreamError === 'string' && upstreamError.length > 0 && upstreamError.length <= 200
    ? upstreamError
    : undefined;

  if (status >= 500) {
    // 5xx: never expose upstream body — use generic message and no code.
    return new HttpError(status, 'Service temporarily unavailable');
  }
  if (status === 401) {
    return new HttpError(status, safeUpstream ?? 'Unauthorized', safeUpstream);
  }
  if (status === 403) {
    return new HttpError(status, safeUpstream ?? 'Forbidden', safeUpstream);
  }
  if (status === 404) {
    return new HttpError(status, safeUpstream ?? 'Not found', safeUpstream);
  }
  if (status === 409) {
    return new HttpError(status, safeUpstream ?? 'Conflict', safeUpstream);
  }
  if (status >= 400) {
    return new HttpError(status, safeUpstream ?? `${fallbackLabel} request failed`, safeUpstream);
  }
  return new HttpError(status, `${fallbackLabel} request failed`, safeUpstream);
}

/**
 * Read JSON body, tolerating non-JSON responses (e.g. HTML error pages from
 * edge proxies). Returns `undefined` when the body cannot be parsed as JSON.
 */
export async function readJsonBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) return undefined;
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
