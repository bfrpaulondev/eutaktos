import { createAccessContext, type Capability, type SessionIdentity } from '@eutaktos/domain';
import type { VerifiedPrincipal } from './people-http';

export const SESSION_COOKIE_NAME = '__Host-eutaktos_session';
const SESSION_TOKEN = /^[A-Za-z0-9._~-]{1,200}$/;
const MAX_COOKIE_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionIdentityResolver {
  resolve(sessionId: string): Readonly<SessionIdentity> | undefined;
}

export interface CapabilityResolver {
  capabilitiesFor(identity: Readonly<SessionIdentity>): readonly Capability[];
}

export function serializeSessionCookie(sessionId: string, maxAgeSeconds: number): string {
  if (!SESSION_TOKEN.test(sessionId)) throw new Error('Invalid session id');
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 60 || maxAgeSeconds > MAX_COOKIE_AGE_SECONDS) {
    throw new Error('Invalid session cookie lifetime');
  }
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/**
 * Rejects duplicate session cookies instead of choosing first/last value. This
 * prevents ambiguous proxy/browser parsing from becoming a session-smuggling path.
 */
export function parseSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const matches: string[] = [];

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const name = trimmed.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    matches.push(trimmed.slice(separator + 1).trim());
  }

  if (matches.length !== 1) return undefined;
  return SESSION_TOKEN.test(matches[0] ?? '') ? matches[0] : undefined;
}

/**
 * Resolves tenant+actor from a verified server-side session, then obtains a fresh
 * capability set from the authorization layer. Cookie/header values never supply
 * tenant, actor or capabilities.
 */
export function resolveVerifiedPrincipalFromCookie(
  cookieHeader: string | undefined,
  sessions: SessionIdentityResolver,
  authorization: CapabilityResolver,
): VerifiedPrincipal | undefined {
  const sessionId = parseSessionCookie(cookieHeader);
  if (!sessionId) return undefined;

  const identity = sessions.resolve(sessionId);
  if (!identity) return undefined;

  const context = createAccessContext({
    tenantId: identity.tenantId,
    actorId: identity.actorId,
    capabilities: authorization.capabilitiesFor(identity),
  });

  return {
    tenantId: context.tenantId,
    actorId: context.actorId,
    capabilities: context.capabilities,
  };
}
