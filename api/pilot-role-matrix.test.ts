import { describe, expect, it, vi } from 'vitest';
import type { Capability } from '@eutaktos/domain';
import {
  AuthorizationError,
  requireCapability,
  resolvePrincipal,
  type VerifiedPrincipal,
} from './_auth';
import { SupabaseRestDatabase, type DatabaseConfig } from './_db';
import type { ApiRequest } from './_types';

const config: DatabaseConfig = {
  url: 'https://example.supabase.co',
  serviceRoleKey: 'server-secret',
};

const NOW = Date.parse('2026-08-24T12:00:00.000Z');

interface RoleFixture {
  readonly sessionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly capabilities: readonly Capability[];
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function forgedRequest(sessionId: string): ApiRequest {
  return {
    method: 'GET',
    headers: {
      cookie: `__Host-eutaktos_session=${sessionId}`,
      'x-tenant-id': 'tenant-forged',
      'x-actor-id': 'actor-forged',
      'x-capabilities': 'access.manage,tenant.manage,people.write,schedule.write',
    },
    query: {
      tenantId: 'tenant-forged',
      actorId: 'actor-forged',
      capabilities: 'access.manage,tenant.manage,people.write,schedule.write',
    },
  };
}

function databaseForRoles(fixtures: readonly RoleFixture[]): SupabaseRestDatabase {
  const fetcher = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));

    if (url.pathname.endsWith('/eutaktos_sessions')) {
      const sessionId = url.searchParams.get('id')?.replace(/^eq\./, '');
      const fixture = fixtures.find(candidate => candidate.sessionId === sessionId);
      if (!fixture) return jsonResponse([]);
      return jsonResponse([{
        id: fixture.sessionId,
        tenant_id: fixture.tenantId,
        actor_id: fixture.actorId,
        issued_at: '2026-08-24T10:00:00.000Z',
        idle_expires_at: '2026-08-24T13:00:00.000Z',
        absolute_expires_at: '2026-08-25T10:00:00.000Z',
        idle_timeout_ms: 1_800_000,
        revoked_at: null,
      }]);
    }

    if (url.pathname.endsWith('/eutaktos_access_grants')) {
      const tenantId = url.searchParams.get('tenant_id')?.replace(/^eq\./, '');
      const actorId = url.searchParams.get('subject_id')?.replace(/^eq\./, '');
      const fixture = fixtures.find(candidate => candidate.tenantId === tenantId && candidate.actorId === actorId);
      if (!fixture) return jsonResponse([]);
      return jsonResponse(fixture.capabilities.map((capability, index) => ({
        tenant_id: fixture.tenantId,
        id: `${fixture.actorId}-grant-${index + 1}`,
        subject_id: fixture.actorId,
        capability,
        granted_by: 'pilot-bootstrap',
        granted_at: '2026-08-24T10:00:00.000Z',
        revoked_at: null,
      })));
    }

    throw new Error(`Unexpected database request: ${url.pathname}`);
  });

  return new SupabaseRestDatabase(config, fetcher);
}

async function principalFor(database: SupabaseRestDatabase, fixture: RoleFixture): Promise<VerifiedPrincipal> {
  return resolvePrincipal(forgedRequest(fixture.sessionId), database, () => NOW);
}

function expectAllowed(principal: VerifiedPrincipal, capability: Capability): void {
  expect(() => requireCapability(principal, capability)).not.toThrow();
}

function expectForbidden(principal: VerifiedPrincipal, capability: Capability): void {
  expect(() => requireCapability(principal, capability)).toThrow(AuthorizationError);
}

describe('pilot server-side role matrix', () => {
  const admin: RoleFixture = {
    sessionId: 'session-admin',
    tenantId: 'tenant-pilot',
    actorId: 'actor-admin',
    capabilities: [
      'people.read',
      'people.write',
      'schedule.read',
      'schedule.write',
      'audit.read',
      'access.manage',
      'tenant.manage',
    ],
  };

  const operator: RoleFixture = {
    sessionId: 'session-operator',
    tenantId: 'tenant-pilot',
    actorId: 'actor-operator',
    capabilities: ['people.read', 'schedule.read', 'schedule.write'],
  };

  const ordinary: RoleFixture = {
    sessionId: 'session-ordinary',
    tenantId: 'tenant-pilot',
    actorId: 'actor-ordinary',
    capabilities: ['people.read', 'schedule.read'],
  };

  const otherTenant: RoleFixture = {
    sessionId: 'session-other-tenant',
    tenantId: 'tenant-other',
    actorId: 'actor-admin',
    capabilities: ['people.read'],
  };

  const database = databaseForRoles([admin, operator, ordinary, otherTenant]);

  it('gives the administrator only capabilities loaded from server-side grants', async () => {
    const principal = await principalFor(database, admin);

    expect(principal).toEqual({
      tenantId: admin.tenantId,
      actorId: admin.actorId,
      capabilities: [...admin.capabilities].sort(),
      sessionId: admin.sessionId,
    });
    expectAllowed(principal, 'people.write');
    expectAllowed(principal, 'schedule.write');
    expectAllowed(principal, 'audit.read');
    expectAllowed(principal, 'access.manage');
    expectAllowed(principal, 'tenant.manage');
    expectForbidden(principal, 'eligibility.write');
  });

  it('allows the limited operator to schedule but denies administration and people writes', async () => {
    const principal = await principalFor(database, operator);

    expectAllowed(principal, 'people.read');
    expectAllowed(principal, 'schedule.read');
    expectAllowed(principal, 'schedule.write');
    expectForbidden(principal, 'people.write');
    expectForbidden(principal, 'audit.read');
    expectForbidden(principal, 'access.manage');
    expectForbidden(principal, 'tenant.manage');
  });

  it('keeps an ordinary user read-only for the pilot surfaces', async () => {
    const principal = await principalFor(database, ordinary);

    expectAllowed(principal, 'people.read');
    expectAllowed(principal, 'schedule.read');
    expectForbidden(principal, 'people.write');
    expectForbidden(principal, 'schedule.write');
    expectForbidden(principal, 'audit.read');
    expectForbidden(principal, 'access.manage');
    expectForbidden(principal, 'tenant.manage');
  });

  it('ignores forged browser tenant, actor and capability fields', async () => {
    const principal = await principalFor(database, ordinary);

    expect(principal.tenantId).toBe('tenant-pilot');
    expect(principal.actorId).toBe('actor-ordinary');
    expect(principal.capabilities).toEqual(['people.read', 'schedule.read']);
    expect(principal.tenantId).not.toBe('tenant-forged');
    expect(principal.actorId).not.toBe('actor-forged');
    expectForbidden(principal, 'access.manage');
    expectForbidden(principal, 'tenant.manage');
    expectForbidden(principal, 'people.write');
    expectForbidden(principal, 'schedule.write');
  });

  it('scopes grants by both tenant and actor even when actor ids collide across tenants', async () => {
    const pilotPrincipal = await principalFor(database, admin);
    const otherPrincipal = await principalFor(database, otherTenant);

    expect(pilotPrincipal.actorId).toBe(otherPrincipal.actorId);
    expect(pilotPrincipal.tenantId).toBe('tenant-pilot');
    expect(otherPrincipal.tenantId).toBe('tenant-other');
    expectAllowed(pilotPrincipal, 'access.manage');
    expectForbidden(otherPrincipal, 'access.manage');
    expect(otherPrincipal.capabilities).toEqual(['people.read']);
  });
});
