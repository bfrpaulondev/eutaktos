import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleNetlifyApiEvent } from '../../_netlify';

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function sessionRow() {
  return {
    id: 'session-a', tenant_id: 'tenant-a', actor_id: 'actor-a', issued_at: '2026-08-25T08:00:00.000Z',
    idle_expires_at: '2030-08-25T18:00:00.000Z', absolute_expires_at: '2030-08-26T08:00:00.000Z', idle_timeout_ms: 1_800_000, revoked_at: null,
  };
}

function grant(capability: string) {
  return { tenant_id: 'tenant-a', id: `grant-${capability}`, subject_id: 'actor-a', capability, granted_by: 'admin-a', granted_at: '2026-08-25T08:00:00.000Z', revoked_at: null };
}

function personRow() {
  return {
    tenant_id: 'tenant-a', entity_type: 'person', entity_id: 'person-1', version: 4,
    data: {
      id: 'person-1', tenantId: 'tenant-a', displayName: 'Sanitized person', active: true,
      availability: [], eligibility: [], ordinaryContact: { phone: '+351 900 000 000', email: 'person@example.test', address: 'Rua Um' },
      emergencyContacts: [{ id: 'emergency-1', name: 'Emergency name', phone: '+351 911 111 111' }],
    },
  };
}

function configureEnvironment(): void {
  vi.stubEnv('EUTAKTOS_PUBLIC_ORIGIN', 'https://eutakes.netlify.app');
  vi.stubEnv('EUTAKTOS_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EUTAKTOS_SUPABASE_SECRET_KEY', 'server-secret');
}

function request(method: 'GET' | 'PUT', body?: unknown, extraHeaders: Record<string, string> = {}) {
  return handleNetlifyApiEvent({
    httpMethod: method,
    path: '/api/people/person-1/contact',
    headers: {
      'content-type': 'application/json',
      ...(method === 'PUT' ? { origin: 'https://eutakes.netlify.app', 'sec-fetch-site': 'same-origin' } : {}),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function stubDatabase(capabilities: readonly string[]) {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.includes('eutaktos_sessions')) return jsonResponse([sessionRow()]);
    if (url.includes('eutaktos_access_grants')) return jsonResponse(capabilities.map(grant));
    if (url.includes('eutaktos_entities')) return jsonResponse([personRow()]);
    if (url.includes('eutaktos_apply_entity_change')) {
      writes.push(init?.body ? JSON.parse(String(init.body)) : undefined);
      return new Response(null, { status: 204 });
    }
    return jsonResponse([]);
  }));
  return writes;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('GET/PUT /api/people/:personId/contact real handler boundary', () => {
  it('rejects the dedicated contact endpoint without a server session', async () => {
    configureEnvironment();

    const result = await request('GET');

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body)).toEqual({ error: 'Unauthorized' });
  });

  it('returns only ordinary contact fields for an authorized server-derived principal', async () => {
    configureEnvironment();
    stubDatabase(['people.read']);

    const result = await request('GET', undefined, { cookie: '__Host-eutaktos_session=session-a' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ phone: '+351 900 000 000', email: 'person@example.test', address: 'Rua Um' });
    expect(result.body).not.toContain('emergency-1');
    expect(result.body).not.toContain('Emergency name');
  });

  it('uses server-derived write authority, trusted mutation headers and a privacy-minimized persistence record', async () => {
    configureEnvironment();
    const writes = stubDatabase(['people.read', 'people.write']);

    const result = await request('PUT', { phone: ' +351 900 000 001 ', email: 'updated@example.test', address: null }, { cookie: '__Host-eutaktos_session=session-a' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ phone: '+351 900 000 001', email: 'updated@example.test' });
    expect(writes).toHaveLength(1);
    const write = writes[0] as { p_data: { ordinaryContact?: unknown }; p_audit: unknown; p_event: unknown; p_expected_version: number };
    expect(write.p_data.ordinaryContact).toEqual({ phone: '+351 900 000 001', email: 'updated@example.test' });
    expect(write.p_expected_version).toBe(4);
    expect(JSON.stringify({ audit: write.p_audit, event: write.p_event })).not.toContain('updated@example.test');
  });

  it('rejects a browser mutation without people.write or trusted same-origin headers', async () => {
    configureEnvironment();
    stubDatabase(['people.read']);

    const forbidden = await request('PUT', { phone: '+351 900 000 001' }, { cookie: '__Host-eutaktos_session=session-a' });
    const csrf = await request('PUT', { phone: '+351 900 000 001' }, { cookie: '__Host-eutaktos_session=session-a', origin: 'https://attacker.invalid' });

    expect(forbidden.statusCode).toBe(403);
    expect(JSON.parse(forbidden.body)).toEqual({ error: 'Forbidden' });
    expect(csrf.statusCode).toBe(403);
    expect(JSON.parse(csrf.body)).toEqual({ error: 'Forbidden' });
  });
});
