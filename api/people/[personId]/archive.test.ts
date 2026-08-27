import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleNetlifyApiEvent, matchNetlifyApiRoute } from '../../_netlify';

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

function personRow(archive?: unknown) {
  return {
    tenant_id: 'tenant-a', entity_type: 'person', entity_id: 'person-1', version: 4,
    data: {
      id: 'person-1', tenantId: 'tenant-a', displayName: 'Sanitized person', active: archive ? false : true,
      availability: [], eligibility: [], emergencyContacts: [], ...(archive ? { publicationArchive: archive } : {}),
    },
  };
}

function archivedState() {
  return {
    current: { actorId: 'actor-a', archivedAt: '2026-08-27T09:00:00.000Z', reason: 'A não publicar', previousActive: true },
    history: [{ action: 'archived', actorId: 'actor-a', occurredAt: '2026-08-27T09:00:00.000Z', reason: 'A não publicar' }],
  };
}

function configureEnvironment(): void {
  vi.stubEnv('EUTAKTOS_PUBLIC_ORIGIN', 'https://eutakes.netlify.app');
  vi.stubEnv('EUTAKTOS_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EUTAKTOS_SUPABASE_SECRET_KEY', 'server-secret');
}

function request(method: 'GET' | 'POST', body?: unknown, extraHeaders: Record<string, string> = {}) {
  return handleNetlifyApiEvent({
    httpMethod: method,
    path: '/api/people/person-1/archive',
    headers: {
      'content-type': 'application/json',
      ...(method === 'POST' ? { origin: 'https://eutakes.netlify.app', 'sec-fetch-site': 'same-origin' } : {}),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function stubDatabase(capabilities: readonly string[], archive?: unknown) {
  const writes: unknown[] = [];
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (url.includes('eutaktos_sessions')) return jsonResponse([sessionRow()]);
    if (url.includes('eutaktos_access_grants')) return jsonResponse(capabilities.map(grant));
    if (url.includes('eutaktos_entities')) return jsonResponse([personRow(archive)]);
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

describe('GET/POST /api/people/:personId/archive real handler boundary', () => {
  it('routes the archive resource before the generic person route', () => {
    expect(matchNetlifyApiRoute('/people/person-1/archive')).toEqual({ key: 'person-archive', params: { personId: 'person-1' } });
  });

  it('returns privacy-minimized archive state using server-derived read authority', async () => {
    configureEnvironment();
    stubDatabase(['people.read'], archivedState());
    const result = await request('GET', undefined, { cookie: '__Host-eutaktos_session=session-a' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      status: 'archived',
      current: { archivedAt: '2026-08-27T09:00:00.000Z', reason: 'A não publicar' },
      history: [{ action: 'archived', occurredAt: '2026-08-27T09:00:00.000Z', reason: 'A não publicar' }],
      capabilities: { write: false },
    });
    expect(result.body).not.toContain('actor-a');
    expect(result.body).not.toContain('previousActive');
  });

  it('archives atomically through the existing optimistic-version People unit of work', async () => {
    configureEnvironment();
    const writes = stubDatabase(['people.read', 'people.write']);
    const result = await request('POST', { action: 'archive', reason: '  A não publicar  ' }, { cookie: '__Host-eutaktos_session=session-a', 'x-request-id': 'archive-request-1' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: 'archived', current: { reason: 'A não publicar' }, capabilities: { write: true } });
    expect(writes).toHaveLength(1);
    const write = writes[0] as { p_expected_version: number; p_data: { active: boolean; publicationArchive: unknown }; p_audit: unknown; p_event: unknown };
    expect(write.p_expected_version).toBe(4);
    expect(write.p_data.active).toBe(false);
    expect(write.p_data.publicationArchive).toBeTruthy();
    expect(JSON.stringify({ audit: write.p_audit, event: write.p_event })).not.toContain('A não publicar');
  });

  it('treats an identical archive retry as an idempotent read without duplicating history', async () => {
    configureEnvironment();
    const writes = stubDatabase(['people.read', 'people.write'], archivedState());
    const result = await request('POST', { action: 'archive', reason: 'A não publicar' }, { cookie: '__Host-eutaktos_session=session-a' });
    expect(result.statusCode).toBe(200);
    expect(writes).toHaveLength(0);
    expect((JSON.parse(result.body).history as unknown[])).toHaveLength(1);
  });

  it('restores through the explicit archive service and does not accept a browser without write authority', async () => {
    configureEnvironment();
    const writes = stubDatabase(['people.read', 'people.write'], archivedState());
    const result = await request('POST', { action: 'restore' }, { cookie: '__Host-eutaktos_session=session-a' });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ status: 'active', capabilities: { write: true } });
    expect(writes).toHaveLength(1);
    const write = writes[0] as { p_data: { active: boolean; publicationArchive: { history: unknown[] } } };
    expect(write.p_data.active).toBe(true);
    expect(write.p_data.publicationArchive.history).toHaveLength(2);

    vi.unstubAllGlobals();
    stubDatabase(['people.read'], archivedState());
    const forbidden = await request('POST', { action: 'restore' }, { cookie: '__Host-eutaktos_session=session-a' });
    expect(forbidden.statusCode).toBe(403);
    expect(JSON.parse(forbidden.body)).toEqual({ error: 'Forbidden' });
  });
});
