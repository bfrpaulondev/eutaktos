import { describe, expect, it } from 'vitest';
import { inspectHourglassJsonExport } from '@eutaktos/application';
import { createAccessContext, type Capability, type CongregationPerson } from '@eutaktos/domain';
import type { EntityRow } from '../../_db';
import {
  executeHourglassImport,
  prepareHourglassExecution,
  type HourglassExecutionAttempt,
  type HourglassExecutionDatabase,
} from './_execution';

const ATTEMPT: Readonly<HourglassExecutionAttempt> = Object.freeze({
  executionId: 'execution-12345678',
  initiatedAt: '2026-08-27T10:30:00.000Z',
});

function context(capabilities: readonly Capability[] = ['people.read', 'people.write', 'eligibility.read', 'eligibility.write']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities });
}

function inspection() {
  return inspectHourglassJsonExport({
    publishers: [{ id: 1, firstname: 'Ana', lastname: 'Silva' }],
    fsGroups: [],
    privileges: { reader: [1], microphone: [1] },
  });
}

function row(person: Readonly<CongregationPerson>, version = 1): EntityRow {
  return { tenant_id: person.tenantId, entity_type: 'person', entity_id: person.id, data: person, version };
}

function existingPerson(input: Partial<CongregationPerson> = {}): Readonly<CongregationPerson> {
  return Object.freeze({
    id: 'existing-1',
    tenantId: 'tenant-a',
    displayName: 'Ana Silva',
    active: false,
    externalIds: Object.freeze(['hourglass:publisher:1']),
    availability: Object.freeze([]),
    eligibility: Object.freeze([
      Object.freeze({ assignmentTypeId: 'hourglass:microphone', enabled: true, decidedBy: 'elder-1', decidedAt: ATTEMPT.initiatedAt }),
      Object.freeze({ assignmentTypeId: 'hourglass:reader', enabled: true, decidedBy: 'elder-1', decidedAt: ATTEMPT.initiatedAt }),
    ]),
    emergencyContacts: Object.freeze([]),
    ...input,
  });
}

function databaseHarness(initialRows: readonly EntityRow[] = []) {
  let peopleRows = [...initialRows];
  let migrationRow: EntityRow | undefined;
  const commits: Readonly<Record<string, unknown>>[] = [];
  let entityReads = 0;
  let listReads = 0;

  const database: HourglassExecutionDatabase = {
    entities: async (tenantId, entityType) => {
      listReads += 1;
      expect(tenantId).toBe('tenant-a');
      expect(entityType).toBe('person');
      return Object.freeze([...peopleRows]);
    },
    entity: async (tenantId, entityType, entityId) => {
      entityReads += 1;
      if (tenantId !== 'tenant-a' || entityType !== 'hourglass-migration') return undefined;
      return migrationRow?.entity_id === entityId ? migrationRow : undefined;
    },
    applyHourglassMigrationCommit: async input => {
      commits.push(input);
      if (migrationRow) return { outcome: 'already-applied' as const };
      const migration = input.p_migration as Readonly<Record<string, unknown>>;
      const changes = input.p_person_changes as readonly Readonly<Record<string, unknown>>[];
      for (const change of changes) {
        const data = change.data as Readonly<CongregationPerson>;
        peopleRows.push(row(data));
      }
      const log = migration.log as Readonly<Record<string, unknown>>;
      const migrationId = String(log.migrationId);
      migrationRow = {
        tenant_id: 'tenant-a',
        entity_type: 'hourglass-migration',
        entity_id: migrationId,
        version: 1,
        data: Object.freeze({
          log: migration.log,
          rollbackPlan: migration.rollbackPlan,
          postCommitSteps: Object.freeze(changes.map(change => Object.freeze({
            kind: 'create',
            internalId: change.id,
            resultingVersion: 1,
          }))),
        }),
      };
      return { outcome: 'applied' as const };
    },
  };

  return {
    database,
    commits,
    get peopleRows() { return peopleRows; },
    setPeopleRows(next: readonly EntityRow[]) { peopleRows = [...next]; },
    get entityReads() { return entityReads; },
    get listReads() { return listReads; },
  };
}

describe('PX9.9 Hourglass server execution composition', () => {
  it('prepares only a digest/count contract and executes creates as inactive people with explicit Hourglass eligibility', async () => {
    const harness = databaseHarness();
    const prepared = await prepareHourglassExecution(harness.database, context(), inspection(), ATTEMPT);
    expect(prepared).toMatchObject({
      attempt: ATTEMPT,
      counts: { create: 1, unchanged: 0, conflict: 0 },
    });
    expect(prepared.confirmationDigest).toMatch(/^[0-9a-f]{64}$/);

    const result = await executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT);
    expect(result).toMatchObject({ outcome: 'applied', createdCount: 1, unchangedCount: 0 });
    expect(result.migrationId).toMatch(/^hourglass-migration-[0-9a-f]{32}$/);
    expect(harness.commits).toHaveLength(1);

    const commit = harness.commits[0];
    const changes = commit.p_person_changes as readonly Readonly<Record<string, unknown>>[];
    expect(changes).toHaveLength(1);
    const person = changes[0].data as Readonly<CongregationPerson>;
    expect(person).toMatchObject({
      tenantId: 'tenant-a',
      displayName: 'Ana Silva',
      active: false,
      externalIds: ['hourglass:publisher:1'],
    });
    expect(person.eligibility).toEqual([
      { assignmentTypeId: 'hourglass:microphone', enabled: true, decidedBy: 'elder-1', decidedAt: ATTEMPT.initiatedAt },
      { assignmentTypeId: 'hourglass:reader', enabled: true, decidedBy: 'elder-1', decidedAt: ATTEMPT.initiatedAt },
    ]);

    const migration = commit.p_migration as Readonly<Record<string, unknown>>;
    expect(migration.audit).toMatchObject({ resourceType: 'migration', actorId: 'elder-1', changedFields: ['operations'] });
    expect(migration.event).toMatchObject({ type: 'MigrationApplied', actorId: 'elder-1' });
    expect(JSON.stringify(migration)).not.toContain('Ana Silva');
    expect(JSON.stringify(migration)).not.toContain('hourglass:publisher:1');
  });

  it('replays the exact same server-side attempt through the durable migration identity after an ambiguous success', async () => {
    const harness = databaseHarness();
    const prepared = await prepareHourglassExecution(harness.database, context(), inspection(), ATTEMPT);
    const first = await executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT);
    const second = await executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT);

    expect(first.outcome).toBe('applied');
    expect(second).toMatchObject({ outcome: 'already-applied', migrationId: first.migrationId, createdCount: 1 });
    expect(harness.commits).toHaveLength(2);
    expect(harness.peopleRows.filter(item => item.entity_type === 'person')).toHaveLength(1);
  });

  it('rejects a stale confirmation when authoritative People state changes before commit', async () => {
    const harness = databaseHarness();
    const prepared = await prepareHourglassExecution(harness.database, context(), inspection(), ATTEMPT);
    harness.setPeopleRows([row(existingPerson())]);

    await expect(executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT))
      .rejects.toThrow('Hourglass confirmation is stale');
    expect(harness.commits).toHaveLength(0);
  });

  it('keeps differences to an existing Hourglass-linked person as an explicit conflict instead of updating silently', async () => {
    const harness = databaseHarness([row(existingPerson({ displayName: 'Different Name' }))]);
    const prepared = await prepareHourglassExecution(harness.database, context(), inspection(), ATTEMPT);
    expect(prepared.counts).toEqual({ create: 0, unchanged: 0, conflict: 1 });

    await expect(executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT))
      .rejects.toThrow('unresolved conflicts');
    expect(harness.commits).toHaveLength(0);
  });

  it('requires eligibility.write as well as People read/write before reading or mutating production state', async () => {
    const harness = databaseHarness();
    await expect(prepareHourglassExecution(
      harness.database,
      context(['people.read', 'people.write', 'eligibility.read']),
      inspection(),
      ATTEMPT,
    )).rejects.toThrow();
    expect(harness.listReads).toBe(0);
    expect(harness.entityReads).toBe(0);
  });

  it('fails closed when a prior execution identity has already been rolled back', async () => {
    const harness = databaseHarness();
    const prepared = await prepareHourglassExecution(harness.database, context(), inspection(), ATTEMPT);
    const first = await executeHourglassImport(harness.database, context(), inspection(), prepared.confirmationDigest, ATTEMPT);
    expect(first.outcome).toBe('applied');

    const migration = harness.commits[0].p_migration as Readonly<Record<string, unknown>>;
    const current = harness.peopleRows;
    const migrationId = String((migration.log as Readonly<Record<string, unknown>>).migrationId);
    const fakeRolledBack: EntityRow = {
      tenant_id: 'tenant-a', entity_type: 'hourglass-migration', entity_id: migrationId, version: 2,
      data: {
        log: { ...(migration.log as Readonly<Record<string, unknown>>), status: 'rolled-back' },
        rollbackPlan: migration.rollbackPlan,
        postCommitSteps: (harness.commits[0].p_person_changes as readonly Readonly<Record<string, unknown>>[]).map(change => ({ kind: 'create', internalId: change.id, resultingVersion: 1 })),
      },
    };

    const rolledBackDatabase: HourglassExecutionDatabase = {
      entities: async () => current,
      entity: async () => fakeRolledBack,
      applyHourglassMigrationCommit: async () => { throw new Error('must not commit'); },
    };
    await expect(executeHourglassImport(rolledBackDatabase, context(), inspection(), prepared.confirmationDigest, ATTEMPT))
      .rejects.toThrow('was rolled back');
  });
});
