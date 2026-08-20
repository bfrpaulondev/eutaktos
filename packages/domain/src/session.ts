import type { PersonId, TenantId } from './people';

export type SessionId = string;

export interface SessionIdentity {
  tenantId: TenantId;
  actorId: PersonId;
}

export interface SessionPolicy {
  idleTimeoutMs: number;
  absoluteTimeoutMs: number;
}

export interface SessionRecord extends SessionIdentity {
  id: SessionId;
  issuedAt: string;
  idleExpiresAt: string;
  absoluteExpiresAt: string;
  idleTimeoutMs: number;
  revokedAt?: string;
}

export const DEFAULT_SESSION_POLICY: Readonly<SessionPolicy> = Object.freeze({
  idleTimeoutMs: 30 * 60 * 1000,
  absoluteTimeoutMs: 12 * 60 * 60 * 1000,
});

const SESSION_ID = /^[A-Za-z0-9._~-]+$/;
const MIN_IDLE_MS = 60_000;
const MAX_IDLE_MS = 24 * 60 * 60 * 1000;
const MAX_ABSOLUTE_MS = 30 * 24 * 60 * 60 * 1000;

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validInstant(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be a valid ISO date`);
  return parsed;
}

function validSessionId(value: string): string {
  const normalized = required(value, 'sessionId');
  if (normalized.length > 200 || !SESSION_ID.test(normalized)) {
    throw new Error('sessionId must be an opaque URL-safe token');
  }
  return normalized;
}

export function validateSessionPolicy(policy: SessionPolicy): Readonly<SessionPolicy> {
  if (!Number.isInteger(policy.idleTimeoutMs) || policy.idleTimeoutMs < MIN_IDLE_MS || policy.idleTimeoutMs > MAX_IDLE_MS) {
    throw new Error('idleTimeoutMs is outside the supported range');
  }
  if (
    !Number.isInteger(policy.absoluteTimeoutMs) ||
    policy.absoluteTimeoutMs < policy.idleTimeoutMs ||
    policy.absoluteTimeoutMs > MAX_ABSOLUTE_MS
  ) {
    throw new Error('absoluteTimeoutMs is outside the supported range');
  }
  return Object.freeze({ ...policy });
}

export function createSessionRecord(input: {
  id: SessionId;
  identity: SessionIdentity;
  issuedAt: string;
  policy?: SessionPolicy;
}): Readonly<SessionRecord> {
  const policy = validateSessionPolicy(input.policy ?? DEFAULT_SESSION_POLICY);
  const issuedAtMs = validInstant(input.issuedAt, 'issuedAt');
  const tenantId = required(input.identity.tenantId, 'tenantId');
  const actorId = required(input.identity.actorId, 'actorId');

  return Object.freeze({
    id: validSessionId(input.id),
    tenantId,
    actorId,
    issuedAt: new Date(issuedAtMs).toISOString(),
    idleExpiresAt: new Date(issuedAtMs + policy.idleTimeoutMs).toISOString(),
    absoluteExpiresAt: new Date(issuedAtMs + policy.absoluteTimeoutMs).toISOString(),
    idleTimeoutMs: policy.idleTimeoutMs,
  });
}

export function isSessionActiveAt(session: SessionRecord, at: string): boolean {
  const atMs = validInstant(at, 'at');
  if (session.revokedAt) return false;
  return atMs < validInstant(session.idleExpiresAt, 'idleExpiresAt') &&
    atMs < validInstant(session.absoluteExpiresAt, 'absoluteExpiresAt');
}

export function revokeSessionRecord(session: SessionRecord, revokedAt: string): Readonly<SessionRecord> {
  if (session.revokedAt) return session;
  const revokedAtMs = validInstant(revokedAt, 'revokedAt');
  const issuedAtMs = validInstant(session.issuedAt, 'issuedAt');
  if (revokedAtMs < issuedAtMs) throw new Error('revokedAt cannot be before issuedAt');
  return Object.freeze({ ...session, revokedAt: new Date(revokedAtMs).toISOString() });
}

/**
 * Rotating a session never resets the original absolute lifetime. Only the idle
 * window is renewed, bounded by the previous absolute expiration.
 */
export function rotateSessionRecord(
  session: SessionRecord,
  nextSessionId: SessionId,
  rotatedAt: string,
): Readonly<{ previous: Readonly<SessionRecord>; next: Readonly<SessionRecord> }> {
  if (!isSessionActiveAt(session, rotatedAt)) throw new Error('Session is not active');
  const rotatedAtMs = validInstant(rotatedAt, 'rotatedAt');
  const absoluteExpiresAtMs = validInstant(session.absoluteExpiresAt, 'absoluteExpiresAt');
  const nextIdleExpiresAtMs = Math.min(rotatedAtMs + session.idleTimeoutMs, absoluteExpiresAtMs);
  const id = validSessionId(nextSessionId);
  if (id === session.id) throw new Error('Session rotation requires a new session id');

  const previous = revokeSessionRecord(session, rotatedAt);
  const next = Object.freeze({
    id,
    tenantId: session.tenantId,
    actorId: session.actorId,
    issuedAt: new Date(rotatedAtMs).toISOString(),
    idleExpiresAt: new Date(nextIdleExpiresAtMs).toISOString(),
    absoluteExpiresAt: new Date(absoluteExpiresAtMs).toISOString(),
    idleTimeoutMs: session.idleTimeoutMs,
  });

  return Object.freeze({ previous, next });
}

export function sessionIdentity(session: SessionRecord): Readonly<SessionIdentity> {
  return Object.freeze({ tenantId: session.tenantId, actorId: session.actorId });
}
