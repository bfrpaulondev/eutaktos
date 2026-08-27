import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleNetlifyApiEvent } from '../../_netlify';
import type { EntityRow } from '../../_db';

const PAYLOAD = {
  publishers: [{ id: 1, firstname: 'Ana', lastname: 'Silva' }],
  fsGroups: [],
  privileges: { reader: [1] },
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function sessionRow() {
  return {
    id: 'session-a', tenant_id: 'tenant-a', actor_id: 'actor-a', issued_at: '2026-08-27T10:00:00.000Z',
    idle_expires_at: '2030-08-27T18:00:00.000Z', absolute_expires_at: '2030-08-28T08:00:00.000Z', idle_timeout_ms: 1_800_000, revoked_at: null,
  };
}

function grant(capability: string) {
  return { tenant_id: 'tenant-a', id: `grant-${capability}`, subject_id: 'actor-a', capability, granted_by: 'admin-a', granted_at: '2026-08-27T10:00:00.000Z', revoked_at: null };
}

function configureEnvironment(): void {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-27T11:00:00.000Z'));
  vi.stubEnv('EUTAKTOS_PUBLIC_ORIGIN', 'https://eutakes.netlify.app');
  vi.stubEnv('EUTAKTOS_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EUTAKTOS_SUPABASE_SECRET_KEY', 'server-secret');
}

function mutationRequest(path: string, body: unknown, trusted = true) {
  return handleNetlifyApiEvent({
    httpMethod: 'POST',
    path: `/api${path}`,
    headers: {
      'content-type': 'application/json',
      cookie: '__Host-eutaktos_session=session-a',
      ...(trusted ? { origin: 'https://eutakes.netlify.app', 'sec-fetch-site': 'same-origin' } : {}),
    },
    body: JSON.stringify(body),
  });
}

function databaseHarness(capabilities: readonly string[] = ['people.read', 'people.write', 'eligibility.read', 'eligibility.write']) {
  const entityRows = new Map<string, EntityRow>();
  const attemptWrites: Readonly<Record<string, unknown>>[] = [];
  const migrationCommits: Readonly<Record<string, unknown>>[] = [];
  const rollbackCommits: Readonly<Record<string, unknown>>[] = [];

  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const path = url.pathname;
    if (path.endsWith('/eutaktos_sessions')) return jsonResponse([sessionRow()]);
    if (path.endsWith('/eutaktos_access_grants')) return jsonResponse(capabilities.map(grant));

    if (path.endsWith('/eutaktos_entities')) {
      const tenantId = url.searchParams.get('tenant_id')?.replace(/^eq\./, '') ?? '';
      const entityType = url.searchParams.get('entity_type')?.replace(/^eq\./, '') ?? '';
      const entityId = url.searchParams.get('entity_id')?.replace(/^eq\./, '');
      const rows = [...entityRows.values()].filter(row => row.tenant_id === tenantId && row.entity_type === entityType && (!entityId || row.entity_id === entityId));
      return jsonResponse(rows);
    }

    if (path.endsWith('/rpc/eutaktos_apply_entity_change')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as Readonly<Record<string, unknown>>;
      attemptWrites.push(body);
      const tenantId = String(body.p_tenant_id);
      const entityType = String(body.p_entity_type);
      const entityId = String(body.p_entity_id);
      entityRows.set(`${entityType}:${entityId}`, { tenant_id: tenantId, entity_type: entityType, entity_id: entityId, data: body.p_data, version: 1 });
      return new Response(null, { status: 204 });
    }

    if (path.endsWith('/rpc/eutaktos_apply_hourglass_migration_commit')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as Readonly<Record<string, unknown>>;
      migrationCommits.push(body);
      const migration = body.p_migration as Readonly<Record<string, unknown>>;
      const log = migration.log as Readonly<Record<string, unknown>>;
      const migrationId = String(log.migrationId);
      const migrationKey = `hourglass-migration:${migrationId}`;
      if (entityRows.has(migrationKey)) return jsonResponse({ outcome: 'already-applied' });
      const changes = body.p_person_changes as readonly Readonly<Record<string, unknown>>[];
      for (const change of changes) {
        const personId = String(change.id);
        entityRows.set(`person:${personId}`, { tenant_id: 'tenant-a', entity_type: 'person', entity_id: personId, data: change.data, version: 1 });
      }
      entityRows.set(migrationKey, {
        tenant_id: 'tenant-a', entity_type: 'hourglass-migration', entity_id: migrationId, version: 1,
        data: {
          log: migration.log,
          rollbackPlan: migration.rollbackPlan,
          postCommitSteps: changes.map(change => ({ kind: 'create', internalId: change.id, resultingVersion: 1 })),
        },
      });
      return jsonResponse({ outcome: 'applied' });
    }

    if (path.endsWith('/rpc/eutaktos_rollback_hourglass_create_migration')) {
      const body = JSON.parse(String(init?.body ?? '{}')) as Readonly<Record<string, unknown>>;
      rollbackCommits.push(body);
      const migrationId = String(body.p_migration_id);
      const key = `hourglass-migration:${migrationId}`;
      const row = entityRows.get(key);
      if (!row) return jsonResponse({ error: 'missing' }, 404);
      const data = row.data as Readonly<Record<string, unknown>>;
      const log = data.log as Readonly<Record<string, unknown>>;
      if (log.status === 'rolled-back') return jsonResponse({ outcome: 'already-rolled-back' });
      const steps = data.postCommitSteps as readonly Readonly<Record<string, unknown>>[];
      for (const step of steps) entityRows.delete(`person:${String(step.internalId)}`);
      entityRows.set(key, { ...row, version: row.version + 1, data: { ...data, log: { ...log, status: 'rolled-back' } } });
      return jsonResponse({ outcome: 'rolled-back' });
    }

    return jsonResponse([]);
  }));

  return { entityRows, attemptWrites, migrationCommits, rollbackCommits };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('PX9.9 Hourglass real write handler boundary', () => {
  it('rejects mutation before auth when same-origin proof is absent', async () => {
    configureEnvironment();
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await mutationRequest('/import/hourglass/prepare', { source: 'json', payload: PAYLOAD, mutationId: 'mutation-12345678' }, false);
    expect(result.statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('requires all server-derived People and eligibility capabilities', async () => {
    configureEnvironment();
    databaseHarness(['people.read', 'people.write', 'eligibility.read']);
    const result = await mutationRequest('/import/hourglass/prepare', { source: 'json', payload: PAYLOAD, mutationId: 'mutation-12345678' });
    expect(result.statusCode).toBe(403);
  });

  it('prepares the exact visible preview while persisting only non-PII attempt evidence', async () => {
    configureEnvironment();
    const h = databaseHarness();
    const result = await mutationRequest('/import/hourglass/prepare', { source: 'json', payload: PAYLOAD, mutationId: 'mutation-12345678' });
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toMatchObject({
      contractVersion: 'hourglass-execution-prepare-v1',
      counts: { create: 1, unchanged: 0, conflict: 0 },
      canExecute: true,
      preview: { matchingPolicy: 'tenant-scoped-external-id-only', counts: { create: 1, unchanged: 0, conflict: 0 } },
    });
    expect(body.executionId).toMatch(/^hourglass-execution-[0-9a-f]{32}$/);
    expect(body.confirmationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(body.preview.persons[0]).toMatchObject({ displayName: 'Ana Silva', action: 'create', linked: false, explicitAssignmentTypeIds: ['hourglass:reader'] });
    expect(h.attemptWrites).toHaveLength(1);
    const persisted = JSON.stringify(h.attemptWrites[0]);
    expect(persisted).not.toContain('Ana Silva');
    expect(persisted).not.toContain('hourglass:publisher:1');
    expect(persisted).not.toContain('hourglass:reader');
  });

  it('executes only the confirmed attempt, is retry-safe, and rejects altered confirmation', async () => {
    configureEnvironment();
    const h = databaseHarness();
    const preparedResult = await mutationRequest('/import/hourglass/prepare', { source: 'json', payload: PAYLOAD, mutationId: 'mutation-12345678' });
    const prepared = JSON.parse(preparedResult.body);

    const bad = await mutationRequest('/import/hourglass/execute', {
      source: 'json', payload: PAYLOAD, executionId: prepared.executionId, confirmationDigest: '0'.repeat(64),
    });
    expect(bad.statusCode).toBe(400);
    expect(h.migrationCommits).toHaveLength(0);

    const first = await mutationRequest('/import/hourglass/execute', {
      source: 'json', payload: PAYLOAD, executionId: prepared.executionId, confirmationDigest: prepared.confirmationDigest,
    });
    expect(first.statusCode).toBe(200);
    const firstBody = JSON.parse(first.body);
    expect(firstBody).toMatchObject({ contractVersion: 'hourglass-execution-result-v1', outcome: 'applied', createdCount: 1, unchangedCount: 0 });

    const retry = await mutationRequest('/import/hourglass/execute', {
      source: 'json', payload: PAYLOAD, executionId: prepared.executionId, confirmationDigest: prepared.confirmationDigest,
    });
    expect(retry.statusCode).toBe(200);
    expect(JSON.parse(retry.body)).toMatchObject({ outcome: 'already-applied', migrationId: firstBody.migrationId, createdCount: 1 });
    expect([...h.entityRows.values()].filter(row => row.entity_type === 'person')).toHaveLength(1);
  });

  it('rolls back only the persisted create-only migration and verifies the imported Person is removed', async () => {
    configureEnvironment();
    const h = databaseHarness();
    const preparedResult = await mutationRequest('/import/hourglass/prepare', { source: 'json', payload: PAYLOAD, mutationId: 'mutation-12345678' });
    const prepared = JSON.parse(preparedResult.body);
    const executed = await mutationRequest('/import/hourglass/execute', {
      source: 'json', payload: PAYLOAD, executionId: prepared.executionId, confirmationDigest: prepared.confirmationDigest,
    });
    const migrationId = JSON.parse(executed.body).migrationId;

    const rolledBack = await mutationRequest('/import/hourglass/rollback', { migrationId });
    expect(rolledBack.statusCode).toBe(200);
    expect(JSON.parse(rolledBack.body)).toMatchObject({ contractVersion: 'hourglass-rollback-result-v1', outcome: 'rolled-back', migrationId, removedCount: 1 });
    expect(h.rollbackCommits).toHaveLength(1);
    expect([...h.entityRows.values()].filter(row => row.entity_type === 'person')).toHaveLength(0);
  });
});
