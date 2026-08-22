import { CAPABILITIES, type Capability } from '@eutaktos/domain';
import { SupabaseRestDatabase } from './_db';
import { header, type ApiRequest } from './_types';

export const SESSION_COOKIE_NAME = '__Host-eutaktos_session';
const SESSION_TOKEN = /^[A-Za-z0-9._~-]{1,200}$/;
const capabilitySet = new Set<string>(CAPABILITIES);

export interface VerifiedPrincipal {
  tenantId: string;
  actorId: string;
  capabilities: readonly Capability[];
  sessionId: string;
}

export class AuthenticationError extends Error {}
export class AuthorizationError extends Error {}

export function parseSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const matches: string[] = [];
  for (const part of cookieHeader.split(';')) {
    const item = part.trim();
    const separator = item.indexOf('=');
    if (separator < 1) continue;
    if (item.slice(0, separator).trim() !== SESSION_COOKIE_NAME) continue;
    matches.push(item.slice(separator + 1).trim());
  }
  if (matches.length !== 1) return undefined;
  const token = matches[0] ?? '';
  return SESSION_TOKEN.test(token) ? token : undefined;
}

function validFuture(value: string, now: number): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed > now;
}

export async function resolvePrincipal(
  request: ApiRequest,
  database: SupabaseRestDatabase,
  now: () => number = Date.now,
): Promise<VerifiedPrincipal> {
  const sessionId = parseSessionCookie(header(request, 'cookie'));
  if (!sessionId) throw new AuthenticationError('Unauthorized');
  const session = await database.session(sessionId);
  if (!session || session.revoked_at) throw new AuthenticationError('Unauthorized');
  const current = now();
  if (!validFuture(session.idle_expires_at, current) || !validFuture(session.absolute_expires_at, current)) {
    throw new AuthenticationError('Unauthorized');
  }

  const grants = await database.activeGrants(session.tenant_id, session.actor_id);
  const capabilities = grants
    .map(grant => grant.capability)
    .filter((value): value is Capability => capabilitySet.has(value))
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort();

  return Object.freeze({
    tenantId: session.tenant_id,
    actorId: session.actor_id,
    capabilities: Object.freeze(capabilities),
    sessionId,
  });
}

export function requireCapability(principal: VerifiedPrincipal, capability: Capability): void {
  if (!principal.capabilities.includes(capability)) throw new AuthorizationError('Forbidden');
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}
