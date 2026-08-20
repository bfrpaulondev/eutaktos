import { describe, expect, it } from 'vitest';
import {
  createSessionRecord,
  isSessionActiveAt,
  revokeSessionRecord,
  rotateSessionRecord,
  sessionIdentity,
  validateSessionPolicy,
} from './session';

describe('session domain', () => {
  const policy = { idleTimeoutMs: 30 * 60 * 1000, absoluteTimeoutMs: 12 * 60 * 60 * 1000 };

  it('creates an identity-only session with idle and absolute expiry', () => {
    const session = createSessionRecord({
      id: 'sess_abc-123',
      identity: { tenantId: 'tenant-a', actorId: 'person-a' },
      issuedAt: '2026-08-20T17:00:00Z',
      policy,
    });

    expect(session).toEqual({
      id: 'sess_abc-123',
      tenantId: 'tenant-a',
      actorId: 'person-a',
      issuedAt: '2026-08-20T17:00:00.000Z',
      idleExpiresAt: '2026-08-20T17:30:00.000Z',
      absoluteExpiresAt: '2026-08-21T05:00:00.000Z',
      idleTimeoutMs: 1_800_000,
    });
    expect(session).not.toHaveProperty('capabilities');
    expect(Object.isFrozen(session)).toBe(true);
  });

  it('uses half-open expiry boundaries', () => {
    const session = createSessionRecord({
      id: 'sess-a', identity: { tenantId: 'tenant-a', actorId: 'person-a' },
      issuedAt: '2026-08-20T17:00:00Z', policy,
    });
    expect(isSessionActiveAt(session, '2026-08-20T17:29:59.999Z')).toBe(true);
    expect(isSessionActiveAt(session, '2026-08-20T17:30:00.000Z')).toBe(false);
  });

  it('rotates without resetting the absolute lifetime', () => {
    const session = createSessionRecord({
      id: 'sess-a', identity: { tenantId: 'tenant-a', actorId: 'person-a' },
      issuedAt: '2026-08-20T17:00:00Z',
      policy: { idleTimeoutMs: 60 * 60 * 1000, absoluteTimeoutMs: 2 * 60 * 60 * 1000 },
    });

    const rotated = rotateSessionRecord(session, 'sess-b', '2026-08-20T17:45:00Z');
    expect(rotated.previous.revokedAt).toBe('2026-08-20T17:45:00.000Z');
    expect(rotated.next.issuedAt).toBe('2026-08-20T17:45:00.000Z');
    expect(rotated.next.idleExpiresAt).toBe('2026-08-20T18:45:00.000Z');
    expect(rotated.next.absoluteExpiresAt).toBe('2026-08-20T19:00:00.000Z');
  });

  it('bounds the renewed idle window by absolute expiry', () => {
    const session = createSessionRecord({
      id: 'sess-a', identity: { tenantId: 'tenant-a', actorId: 'person-a' },
      issuedAt: '2026-08-20T17:00:00Z',
      policy: { idleTimeoutMs: 60 * 60 * 1000, absoluteTimeoutMs: 70 * 60 * 1000 },
    });
    const rotated = rotateSessionRecord(session, 'sess-b', '2026-08-20T17:30:00Z');
    expect(rotated.next.idleExpiresAt).toBe('2026-08-20T18:10:00.000Z');
  });

  it('revokes idempotently and rejects impossible timestamps', () => {
    const session = createSessionRecord({
      id: 'sess-a', identity: { tenantId: 'tenant-a', actorId: 'person-a' }, issuedAt: '2026-08-20T17:00:00Z', policy,
    });
    const revoked = revokeSessionRecord(session, '2026-08-20T17:05:00Z');
    expect(revokeSessionRecord(revoked, '2026-08-20T17:06:00Z')).toBe(revoked);
    expect(isSessionActiveAt(revoked, '2026-08-20T17:05:01Z')).toBe(false);
    expect(() => revokeSessionRecord(session, '2026-08-20T16:59:59Z')).toThrow('before issuedAt');
  });

  it('validates policy and opaque session ids', () => {
    expect(() => validateSessionPolicy({ idleTimeoutMs: 1, absoluteTimeoutMs: 10 })).toThrow('idleTimeoutMs');
    expect(() => validateSessionPolicy({ idleTimeoutMs: 60_000, absoluteTimeoutMs: 30_000 })).toThrow('absoluteTimeoutMs');
    expect(() => createSessionRecord({
      id: 'customer name', identity: { tenantId: 'tenant-a', actorId: 'person-a' }, issuedAt: '2026-08-20T17:00:00Z', policy,
    })).toThrow('opaque URL-safe token');
  });

  it('returns only tenant and actor identity for request-context resolution', () => {
    const session = createSessionRecord({
      id: 'sess-a', identity: { tenantId: 'tenant-a', actorId: 'person-a' }, issuedAt: '2026-08-20T17:00:00Z', policy,
    });
    expect(sessionIdentity(session)).toEqual({ tenantId: 'tenant-a', actorId: 'person-a' });
  });
});
