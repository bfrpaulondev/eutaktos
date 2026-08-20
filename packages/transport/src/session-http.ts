import type { Capability, SessionIdentity, SessionRecord } from '@eutaktos/domain';
import { assertTrustedBrowserMutation } from './csrf-origin';
import { authenticationSecurityHeaders } from './security-headers';
import {
  clearSessionCookie,
  parseSessionCookie,
  serializeSessionCookie,
  type CapabilityResolver,
  type SessionIdentityResolver,
} from './session-cookie';

export interface SessionLifecyclePort extends SessionIdentityResolver {
  rotate(sessionId: string): SessionRecord | undefined;
  revoke(sessionId: string): boolean;
  revokeAll(identity: Readonly<SessionIdentity>): number;
}

export interface SessionBrowserRequest {
  cookieHeader?: string;
  origin?: string;
  secFetchSite?: string;
}

export interface SessionPrincipalDto {
  actorId: string;
  capabilities: readonly Capability[];
}

export interface SessionHttpResponse<T> {
  status: number;
  body: T;
  headers: Readonly<Record<string, string>>;
}

function response<T>(status: number, body: T, setCookie?: string): SessionHttpResponse<T> {
  return {
    status,
    body,
    headers: Object.freeze({
      ...authenticationSecurityHeaders(),
      ...(setCookie ? { 'Set-Cookie': setCookie } : {}),
    }),
  };
}

function unauthorized(): SessionHttpResponse<{ error: string }> {
  return response(401, { error: 'Unauthorized' }, clearSessionCookie());
}

function forbidden(): SessionHttpResponse<{ error: string }> {
  return response(403, { error: 'Forbidden' });
}

function principal(identity: Readonly<SessionIdentity>, authorization: CapabilityResolver): SessionPrincipalDto {
  return Object.freeze({
    actorId: identity.actorId,
    capabilities: Object.freeze([...new Set(authorization.capabilitiesFor(identity))].sort()),
  });
}

function cookieLifetimeSeconds(session: SessionRecord): number | undefined {
  const issuedAt = Date.parse(session.issuedAt);
  const expiresAt = Math.min(Date.parse(session.idleExpiresAt), Date.parse(session.absoluteExpiresAt));
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return undefined;
  const seconds = Math.floor((expiresAt - issuedAt) / 1000);
  return seconds >= 60 ? seconds : undefined;
}

export class SessionHttpTransport {
  readonly #sessions: SessionLifecyclePort;
  readonly #authorization: CapabilityResolver;
  readonly #trustedOrigin: string;

  constructor(sessions: SessionLifecyclePort, authorization: CapabilityResolver, trustedOrigin: string) {
    this.#sessions = sessions;
    this.#authorization = authorization;
    this.#trustedOrigin = trustedOrigin;
  }

  current(request: SessionBrowserRequest): SessionHttpResponse<SessionPrincipalDto | { error: string }> {
    const sessionId = parseSessionCookie(request.cookieHeader);
    if (!sessionId) return unauthorized();
    const identity = this.#sessions.resolve(sessionId);
    if (!identity) return unauthorized();
    return response(200, principal(identity, this.#authorization));
  }

  rotate(request: SessionBrowserRequest): SessionHttpResponse<SessionPrincipalDto | { error: string }> {
    try {
      assertTrustedBrowserMutation({ method: 'POST', origin: request.origin, secFetchSite: request.secFetchSite }, this.#trustedOrigin);
    } catch {
      return forbidden();
    }

    const sessionId = parseSessionCookie(request.cookieHeader);
    if (!sessionId) return unauthorized();
    const rotated = this.#sessions.rotate(sessionId);
    if (!rotated) return unauthorized();

    const maxAge = cookieLifetimeSeconds(rotated);
    if (!maxAge) {
      this.#sessions.revoke(rotated.id);
      return unauthorized();
    }

    const identity: Readonly<SessionIdentity> = { tenantId: rotated.tenantId, actorId: rotated.actorId };
    return response(200, principal(identity, this.#authorization), serializeSessionCookie(rotated.id, maxAge));
  }

  logout(request: SessionBrowserRequest): SessionHttpResponse<null | { error: string }> {
    try {
      assertTrustedBrowserMutation({ method: 'POST', origin: request.origin, secFetchSite: request.secFetchSite }, this.#trustedOrigin);
    } catch {
      return forbidden();
    }

    const sessionId = parseSessionCookie(request.cookieHeader);
    if (sessionId) this.#sessions.revoke(sessionId);
    return response(204, null, clearSessionCookie());
  }

  logoutAll(request: SessionBrowserRequest): SessionHttpResponse<null | { error: string }> {
    try {
      assertTrustedBrowserMutation({ method: 'POST', origin: request.origin, secFetchSite: request.secFetchSite }, this.#trustedOrigin);
    } catch {
      return forbidden();
    }

    const sessionId = parseSessionCookie(request.cookieHeader);
    if (sessionId) {
      const identity = this.#sessions.resolve(sessionId);
      if (identity) this.#sessions.revokeAll(identity);
    }
    return response(204, null, clearSessionCookie());
  }
}
