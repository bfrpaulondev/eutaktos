import { describe, expect, it, vi } from 'vitest';
import type { Capability, SessionIdentity, SessionRecord } from '@eutaktos/domain';
import { SESSION_COOKIE_NAME, type CapabilityResolver } from './session-cookie';
import { SessionHttpTransport, type SessionLifecyclePort } from './session-http';

const trustedOrigin = 'https://app.eutaktos.example';
const identity: Readonly<SessionIdentity> = { tenantId: 'tenant-a', actorId: 'person-a' };

function session(id = 'sess-new'): SessionRecord {
  return {
    id,
    tenantId: 'tenant-a',
    actorId: 'person-a',
    issuedAt: '2026-08-20T10:00:00.000Z',
    idleExpiresAt: '2026-08-20T10:30:00.000Z',
    absoluteExpiresAt: '2026-08-20T22:00:00.000Z',
    idleTimeoutMs: 30 * 60 * 1000,
  };
}

function lifecycle(): SessionLifecyclePort & {
  resolve: ReturnType<typeof vi.fn>;
  rotate: ReturnType<typeof vi.fn>;
  revoke: ReturnType<typeof vi.fn>;
  revokeAll: ReturnType<typeof vi.fn>;
} {
  return {
    resolve: vi.fn(() => identity),
    rotate: vi.fn(() => session()),
    revoke: vi.fn(() => true),
    revokeAll: vi.fn(() => 2),
  };
}

function authorization(): CapabilityResolver & { capabilitiesFor: ReturnType<typeof vi.fn> } {
  return {
    capabilitiesFor: vi.fn((_identity: Readonly<SessionIdentity>) => ['people.read', 'audit.read'] as readonly Capability[]),
  };
}

function cookie(id = 'sess-old') {
  return `${SESSION_COOKIE_NAME}=${id}`;
}

function mutationRequest() {
  return { cookieHeader: cookie(), origin: trustedOrigin, secFetchSite: 'same-origin' };
}

describe('SessionHttpTransport', () => {
  it('returns the current actor and freshly resolved capabilities without exposing tenant id', () => {
    const sessions = lifecycle();
    const auth = authorization();
    const response = new SessionHttpTransport(sessions, auth, trustedOrigin).current({ cookieHeader: cookie() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ actorId: 'person-a', capabilities: ['audit.read', 'people.read'] });
    expect(JSON.stringify(response.body)).not.toContain('tenant-a');
    expect(auth.capabilitiesFor).toHaveBeenCalledWith(identity);
    expect(response.headers['Cache-Control']).toBe('no-store, private');
  });

  it('clears invalid, missing or expired sessions', () => {
    const sessions = lifecycle();
    sessions.resolve.mockReturnValue(undefined);
    const transport = new SessionHttpTransport(sessions, authorization(), trustedOrigin);

    for (const cookieHeader of [undefined, cookie('expired')]) {
      const response = transport.current({ cookieHeader });
      expect(response.status).toBe(401);
      expect(response.headers['Set-Cookie']).toContain('Max-Age=0');
    }
  });

  it('rotates only same-origin browser mutations and emits a fresh host-only cookie', () => {
    const sessions = lifecycle();
    const response = new SessionHttpTransport(sessions, authorization(), trustedOrigin).rotate(mutationRequest());

    expect(response.status).toBe(200);
    expect(sessions.rotate).toHaveBeenCalledWith('sess-old');
    expect(response.headers['Set-Cookie']).toContain(`${SESSION_COOKIE_NAME}=sess-new`);
    expect(response.headers['Set-Cookie']).toContain('Max-Age=1800');
    expect(response.headers['Set-Cookie']).toContain('HttpOnly; Secure; SameSite=Lax');
  });

  it('does not rotate or revoke sessions for cross-origin mutation attempts', () => {
    const sessions = lifecycle();
    const transport = new SessionHttpTransport(sessions, authorization(), trustedOrigin);

    expect(transport.rotate({ cookieHeader: cookie(), origin: 'https://evil.example', secFetchSite: 'cross-site' }).status).toBe(403);
    expect(transport.logout({ cookieHeader: cookie(), origin: 'https://evil.example', secFetchSite: 'cross-site' }).status).toBe(403);
    expect(sessions.rotate).not.toHaveBeenCalled();
    expect(sessions.revoke).not.toHaveBeenCalled();
  });

  it('revokes the current session idempotently and always clears the browser cookie', () => {
    const sessions = lifecycle();
    const response = new SessionHttpTransport(sessions, authorization(), trustedOrigin).logout(mutationRequest());

    expect(response.status).toBe(204);
    expect(response.body).toBeNull();
    expect(sessions.revoke).toHaveBeenCalledWith('sess-old');
    expect(response.headers['Set-Cookie']).toContain('Max-Age=0');
  });

  it('revokes all sessions for the server-resolved exact identity, never a frontend claim', () => {
    const sessions = lifecycle();
    const response = new SessionHttpTransport(sessions, authorization(), trustedOrigin).logoutAll({
      ...mutationRequest(),
      cookieHeader: `${cookie()}; tenantId=tenant-b; actorId=attacker`,
    });

    expect(response.status).toBe(204);
    expect(sessions.resolve).toHaveBeenCalledWith('sess-old');
    expect(sessions.revokeAll).toHaveBeenCalledWith(identity);
  });

  it('clears a rotated session that is too close to absolute expiry for a supported cookie lifetime', () => {
    const sessions = lifecycle();
    sessions.rotate.mockReturnValue({
      ...session(),
      issuedAt: '2026-08-20T21:59:30.000Z',
      idleExpiresAt: '2026-08-20T22:00:00.000Z',
      absoluteExpiresAt: '2026-08-20T22:00:00.000Z',
    });
    const response = new SessionHttpTransport(sessions, authorization(), trustedOrigin).rotate(mutationRequest());

    expect(response.status).toBe(401);
    expect(sessions.revoke).toHaveBeenCalledWith('sess-new');
    expect(response.headers['Set-Cookie']).toContain('Max-Age=0');
  });
});
