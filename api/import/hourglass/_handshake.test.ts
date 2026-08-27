import { describe, expect, it } from 'vitest';
import { inspectHourglassJsonExport } from '@eutaktos/application';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import type { EntityRow } from '../../_db';
import {
  executePreparedHourglassHandshake,
  HourglassHandshakeError,
  prepareHourglassExecutionHandshake,
  type HourglassHandshakeDatabase,
  type HourglassHandshakeRuntime,
} from './_handshake';

const NOW = '2026-08-27T11:00:00.000Z';
const RUNTIME: HourglassHandshakeRuntime = Object.freeze({
  now: () => NOW,
  nextId: scope => `${scope}-12345678`,
});

function context(actorId = 'elder-1'): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-a',
    actorId,
    capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write'],
  });
}

function inspection(name = 'Ana') {
  return inspectHourglassJsonExport({
    publishers: [{ id: 1, firstname: name, lastname: 'Silva' }],
    fsGroups: [],
    privileges: { reader: [1] },
  });
}

function personRow(person: Readonly<CongregationPerson>, version = 1): EntityRow {
  return { tenant_id: person.tenantId, entity_type: 'person', entity_id: person.id, data: person, version };
}

function existingPerson(name = 'Ana Silva'): Readonly<CongregationPerson> {
  return Object.freeze({
    id: 'existing-1', tenantId: 'tenant-a', displayName: name, active: false,
    externalIds: Object.freeze(['hourglass:publisher:1']), availability: Object.freeze([]),
    eligibility: Object.freeze([{ assignmentTypeId: 'hourglass:reader', enabled: true, decidedBy: 'elder-1', decidedAt: NOW }]),
    emergencyContacts: Object.freeze([]),
  });
}

function harness(initialPeople: readonly EntityRow[] = []) {
  let people = [...initialPeople];
  const entities = new Map<string, EntityRow>();
  const attemptWrites: Readonly<Record<string, unknown>>[] = [];
  const migrationCommits: Readonly<Record<string, unknown>>[] = [];

  const database: HourglassHandshakeDatabase = {
    entities: async (tenantId, entityType) => {
      expect(tenantId).toBe('tenant-a');
      if (entityType !== 'person') return Object.freeze([]);
      return Object.freeze([...people]);
    },
    entity: async (tenantId, entityType, entityId) => entities.get(`${tenantId}:${entityType}:${entityId}`),
    applyEntityChange: async input => {
      attemptWrites.push(input);
      const tenantId = String(input.p_tenant_id);
      const entityType = String(input.p_entity_type);
      const entityId = String(input.p_entity_id);
      entities.set(`${tenantId}:${entityType}:${entityId}`, {
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        data: input.p_data,
        version: 1,
      });
    },
    applyHourglassMigrationCommit: async input => {
      migrationCommits.push(input);
      const migration = input.p_migration as Readonly<Record<string, unknown>>;
      const log = migration.log as Readonly<Record<string, unknown>>;
      const migrationId = String(log.migrationId);
      const migrationKey = `tenant-a:hourglass-migration:${migrationId}`;
      if (entities.has(migrationKey)) return { outcome: 'already-applied' as const };
      const changes = input.p_person_changes as readonly Readonly<Record<string, unknown>>[];
      for (const change of changes) {
        const data = change.data as Readonly<CongregationPerson>;
        people.push(personRow(data));
      }
      entities.set(migrationKey, {
        tenant_id: 'tenant-a', entity_type: 'hourglass-migration', entity_id: migrationId, version: 1,
        data: Object.freeze({
          log: migration.log,
          rollbackPlan: migration.rollbackPlan,
          postCommitSteps: Object.freeze(changes.map(change => Object.freeze({ kind: 'create', internalId: change.id, resultingVersion: 1 }))),
        }),
      });
      return { outcome: 'applied' as const };
    },
  };

  return {
    database,
    attemptWrites,
    migrationCommits,
    setPeople(next: readonly EntityRow[]) { people = [...next]; },
    get people() { return people; },
  };
}

describe('PX9.9 server-owned Hourglass handshake', () => {
  it('persists only server-owned attempt metadata and digests without imported PII', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);

    expect(prepared).toMatchObject({
      attemptId: 'hourglass-execution-12345678',
      expiresAt: '2026-08-27T11:15:00.000Z',
      counts: { create: 1, unchanged: 0, conflict: 0 },
    });
    expect(prepared.confirmationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(test.attemptWrites).toHaveLength(1);
    const write = test.attemptWrites[0];
    expect(write).toMatchObject({ p_tenant_id: 'tenant-a', p_entity_type: 'hourglass-execution-attempt', p_entity_id: 'hourglass-execution-12345678', p_expected_version: null });
    const stored = JSON.stringify({ data: write.p_data, audit: write.p_audit, event: write.p_event });
    expect(stored).not.toContain('Ana Silva');
    expect(stored).not.toContain('hourglass:publisher:1');
    expect(stored).not.toContain('reader');
    expect(write.p_event).toMatchObject({ type: 'MigrationPrepared', actorId: 'elder-1', aggregateId: 'hourglass-execution-12345678' });
  });

  it('executes only from the persisted server attempt and supports exact ambiguous retry', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);
    const first = await executePreparedHourglassHandshake(test.database, context(), inspection(), prepared.attemptId, prepared.confirmationDigest, '2026-08-27T11:05:00.000Z');
    const retry = await executePreparedHourglassHandshake(test.database, context(), inspection(), prepared.attemptId, prepared.confirmationDigest, '2026-08-27T11:06:00.000Z');

    expect(first).toMatchObject({ outcome: 'applied', createdCount: 1, unchangedCount: 0 });
    expect(retry).toMatchObject({ outcome: 'already-applied', migrationId: first.migrationId, createdCount: 1 });
    expect(test.migrationCommits).toHaveLength(2);
    expect(test.people).toHaveLength(1);
  });

  it('does not allow another actor to reuse a prepared attempt', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);
    await expect(executePreparedHourglassHandshake(test.database, context('elder-2'), inspection(), prepared.attemptId, prepared.confirmationDigest))
      .rejects.toThrow('Hourglass execution attempt is unavailable');
    expect(test.migrationCommits).toHaveLength(0);
  });

  it('rejects a changed source payload even when the browser reuses the prepared digest', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);
    await expect(executePreparedHourglassHandshake(test.database, context(), inspection('Maria'), prepared.attemptId, prepared.confirmationDigest))
      .rejects.toThrow('Hourglass payload no longer matches the prepared execution');
    expect(test.migrationCommits).toHaveLength(0);
  });

  it('rejects an altered confirmation digest before mutation', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);
    await expect(executePreparedHourglassHandshake(test.database, context(), inspection(), prepared.attemptId, '0'.repeat(64)))
      .rejects.toThrow('Hourglass confirmation does not match the prepared execution');
    expect(test.migrationCommits).toHaveLength(0);
  });

  it('rejects fresh execution after expiry but permits an exact replay of an already committed migration', async () => {
    const fresh = harness();
    const preparedFresh = await prepareHourglassExecutionHandshake(fresh.database, context(), inspection(), RUNTIME);
    await expect(executePreparedHourglassHandshake(fresh.database, context(), inspection(), preparedFresh.attemptId, preparedFresh.confirmationDigest, '2026-08-27T11:16:00.000Z'))
      .rejects.toThrow('Hourglass execution attempt has expired');
    expect(fresh.migrationCommits).toHaveLength(0);

    const replay = harness();
    const preparedReplay = await prepareHourglassExecutionHandshake(replay.database, context(), inspection(), RUNTIME);
    const first = await executePreparedHourglassHandshake(replay.database, context(), inspection(), preparedReplay.attemptId, preparedReplay.confirmationDigest, '2026-08-27T11:05:00.000Z');
    const lateRetry = await executePreparedHourglassHandshake(replay.database, context(), inspection(), preparedReplay.attemptId, preparedReplay.confirmationDigest, '2026-08-27T12:00:00.000Z');
    expect(first.outcome).toBe('applied');
    expect(lateRetry.outcome).toBe('already-applied');
  });

  it('revalidates authoritative People state and fails stale before the atomic commit', async () => {
    const test = harness();
    const prepared = await prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME);
    test.setPeople([personRow(existingPerson())]);
    await expect(executePreparedHourglassHandshake(test.database, context(), inspection(), prepared.attemptId, prepared.confirmationDigest, '2026-08-27T11:05:00.000Z'))
      .rejects.toThrow(HourglassHandshakeError);
    expect(test.migrationCommits).toHaveLength(0);
  });

  it('does not persist an execution attempt while reconciliation conflicts remain', async () => {
    const test = harness([personRow(existingPerson('Different Name'))]);
    await expect(prepareHourglassExecutionHandshake(test.database, context(), inspection(), RUNTIME))
      .rejects.toThrow('Hourglass preview contains unresolved conflicts');
    expect(test.attemptWrites).toHaveLength(0);
  });
});
