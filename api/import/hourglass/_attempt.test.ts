import { afterEach, describe, expect, it, vi } from 'vitest';
import { inspectHourglassJsonExport } from '@eutaktos/application';
import { createAccessContext } from '@eutaktos/domain';
import type { EntityRow } from '../../_db';
import {
  hourglassExecutionId,
  loadPersistedHourglassExecutionAttempt,
  preparePersistedHourglassExecutionAttempt,
} from './_attempt';
import { hourglassMigrationIdForAttempt } from './_execution';

function context(actorId = 'elder-1') {
  return createAccessContext({ tenantId: 'tenant-a', actorId, capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write'] });
}
function inspection(id = 1) {
  return inspectHourglassJsonExport({ publishers: [{ id, firstname: 'Ana', lastname: 'Silva' }], fsGroups: [], privileges: { reader: [id] } });
}

function harness() {
  let attemptRow: EntityRow | undefined;
  const extraRows = new Map<string, EntityRow>();
  let writes = 0;
  const database = {
    entities: async () => Object.freeze([]),
    entity: async (tenantId: string, entityType: string, entityId: string) => {
      if (tenantId !== 'tenant-a') return undefined;
      if (entityType === 'hourglass-execution-attempt' && attemptRow?.entity_id === entityId) return attemptRow;
      return extraRows.get(`${entityType}:${entityId}`);
    },
    applyHourglassMigrationCommit: async () => ({ outcome: 'applied' as const }),
    applyEntityChange: async (input: Readonly<Record<string, unknown>>) => {
      writes += 1;
      const data = input.p_data as Readonly<Record<string, unknown>>;
      attemptRow = { tenant_id: 'tenant-a', entity_type: 'hourglass-execution-attempt', entity_id: String(input.p_entity_id), data, version: 1 };
    },
  };
  return {
    database,
    get writes() { return writes; },
    setMigration(row: EntityRow) { extraRows.set(`hourglass-migration:${row.entity_id}`, row); },
  };
}

afterEach(() => { vi.useRealTimers(); });

describe('PX9.9 server-owned Hourglass execution attempt', () => {
  it('derives an opaque tenant+actor scoped id and reuses the exact persisted attempt and preview on retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T11:00:00.000Z'));
    const h = harness();
    const first = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    const second = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    expect(first.attempt.executionId).toMatch(/^hourglass-execution-[0-9a-f]{32}$/);
    expect(second.attempt).toEqual(first.attempt);
    expect(second.preview).toEqual(first.preview);
    expect(h.writes).toBe(1);
    expect(first.attempt.confirmationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.attempt.counts).toEqual({ create: 1, unchanged: 0, conflict: 0 });
    expect(first.preview.persons[0]).toMatchObject({ displayName: 'Ana Silva', action: 'create' });
  });

  it('does not let a browser mutation id become a cross-actor execution authority', async () => {
    const one = await hourglassExecutionId(context('elder-1'), 'mutation-12345678');
    const two = await hourglassExecutionId(context('elder-2'), 'mutation-12345678');
    expect(one).not.toBe(two);
  });

  it('rejects a different source, actor or confirmation digest when loading a persisted execution identity', async () => {
    const h = harness();
    const prepared = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    const attempt = prepared.attempt;
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context(), inspection(2), attempt.executionId, attempt.confirmationDigest)).rejects.toThrow('source mismatch');
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context('elder-2'), inspection(), attempt.executionId, attempt.confirmationDigest)).rejects.toThrow('ownership mismatch');
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context(), inspection(), attempt.executionId, '0'.repeat(64))).rejects.toThrow('does not match');
  });

  it('blocks a new execute after expiry but still permits exact recovery when that migration already committed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T11:00:00.000Z'));
    const h = harness();
    const prepared = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    const attempt = prepared.attempt;

    vi.setSystemTime(new Date('2026-08-27T11:31:00.000Z'));
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context(), inspection(), attempt.executionId, attempt.confirmationDigest)).rejects.toThrow('expired');

    const migrationId = await hourglassMigrationIdForAttempt(context(), attempt);
    h.setMigration({
      tenant_id: 'tenant-a', entity_type: 'hourglass-migration', entity_id: migrationId, version: 1,
      data: { log: { tenantId: 'tenant-a', migrationId, status: 'completed' }, postCommitSteps: [] },
    });
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context(), inspection(), attempt.executionId, attempt.confirmationDigest)).resolves.toEqual(attempt);
  });
});
