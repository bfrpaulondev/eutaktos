import { describe, expect, it, vi } from 'vitest';
import type { Capability, SessionIdentity } from '@eutaktos/domain';
import {
  SESSION_COOKIE_NAME,
  clearSessionCookie,
  parseSessionCookie,
  resolveVerifiedPrincipalFromCookie,
  serializeSessionCookie,
  type CapabilityResolver,
  type SessionIdentityResolver,
} from './session-cookie';

describe('session cookie boundary', () => {
  it('serializes a host-only secure HttpOnly session cookie', () => {
    const header = serializeSessionCookie('sess_abc-123', 1800);
    expect(header).toBe(`${SESSION_COOKIE_NAME}=sess_abc-123; Path=/; Max-Age=1800; HttpOnly; Secure; SameSite=Lax`);
    expect(header).not.toContain('Domain=');
  });

  it('clears with the same secure host-only attributes', () => {
    expect(clearSessionCookie()).toBe(`${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`);
  });

  it('parses only the exact session cookie and ignores frontend identity claims', () => {
    const header = `tenantId=tenant-b; capabilities=tenant.manage; ${SESSION_COOKIE_NAME}=sess-good; actorId=attacker`;
    expect(parseSessionCookie(header)).toBe('sess-good');
  });

  it('rejects duplicate or malformed session cookies', () => {
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=sess-a; ${SESSION_COOKIE_NAME}=sess-b`)).toBeUndefined();
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=person@example.com`)).toBeUndefined();
    expect(parseSessionCookie(`${SESSION_COOKIE_NAME}=session with spaces`)).toBeUndefined();
  });

  it('resolves identity from the session and capabilities freshly from server authorization', () => {
    const identity: SessionIdentity = { tenantId: 'tenant-a', actorId: 'person-a' };
    const sessions: SessionIdentityResolver = { resolve: vi.fn(() => identity) };
    const capabilitiesFor = vi.fn((_identity: Readonly<SessionIdentity>) => [
      'people.read', 'tenant.manage', 'people.read',
    ] as readonly Capability[]);
    const authorization: CapabilityResolver = { capabilitiesFor };

    expect(resolveVerifiedPrincipalFromCookie(
      `${SESSION_COOKIE_NAME}=sess-a; capabilities=review.write; tenantId=tenant-b`,
      sessions,
      authorization,
    )).toEqual({
      tenantId: 'tenant-a',
      actorId: 'person-a',
      capabilities: ['people.read', 'tenant.manage'],
    });
    expect(capabilitiesFor).toHaveBeenCalledWith(identity);
  });

  it('returns unauthenticated when the session is absent, expired or revoked', () => {
    const sessions: SessionIdentityResolver = { resolve: vi.fn(() => undefined) };
    const authorization: CapabilityResolver = {
      capabilitiesFor: vi.fn((_identity: Readonly<SessionIdentity>) => ['people.read'] as readonly Capability[]),
    };

    expect(resolveVerifiedPrincipalFromCookie(`${SESSION_COOKIE_NAME}=expired-session`, sessions, authorization)).toBeUndefined();
    expect(authorization.capabilitiesFor).not.toHaveBeenCalled();
  });

  it('validates cookie lifetime and opaque session token format', () => {
    expect(() => serializeSessionCookie('not valid', 1800)).toThrow('Invalid session id');
    expect(() => serializeSessionCookie('sess-a', 1)).toThrow('Invalid session cookie lifetime');
    expect(() => serializeSessionCookie('sess-a', 31 * 24 * 60 * 60)).toThrow('Invalid session cookie lifetime');
  });
});
