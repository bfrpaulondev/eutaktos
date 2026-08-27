import { describe, expect, it } from 'vitest';
import { inspectHourglassJsonExport } from '@eutaktos/application';
import { createAccessContext } from '@eutaktos/domain';
import type { EntityRow } from '../../_db';
import { hourglassExecutionId, loadPersistedHourglassExecutionAttempt, preparePersistedHourglassExecutionAttempt } from './_attempt';

function context(actorId = 'elder-1') {
  return createAccessContext({ tenantId: 'tenant-a', actorId, capabilities: ['people.read', 'people.write', 'eligibility.read', 'eligibility.write'] });
}
function inspection(id = 1) {
  return inspectHourglassJsonExport({ publishers: [{ id, firstname: 'Ana', lastname: 'Silva' }], fsGroups: [], privileges: { reader: [id] } });
}

function harness() {
  let attemptRow: EntityRow | undefined;
  let writes = 0;
  const database = {
    entities: async () => Object.freeze([]),
    entity: async (tenantId: string, entityType: string, entityId: string) => tenantId === 'tenant-a' && entityType === 'hourglass-execution-attempt' && attemptRow?.entity_id === entityId ? attemptRow : undefined,
    applyHourglassMigrationCommit: async () => ({ outcome: 'applied' as const }),
    applyEntityChange: async (input: Readonly<Record<string, unknown>>) => {
      writes += 1;
      const data = input.p_data as Readonly<Record<string, unknown>>;
      attemptRow = { tenant_id: 'tenant-a', entity_type: 'hourglass-execution-attempt', entity_id: String(input.p_entity_id), data, version: 1 };
    },
  };
  return { database, get writes() { return writes; } };
}

describe('PX9.9 server-owned Hourglass execution attempt', () => {
  it('derives an opaque tenant+actor scoped id and reuses the exact persisted attempt on retry', async () => {
    const h = harness();
    const first = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    const second = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    expect(first.executionId).toMatch(/^hourglass-execution-[0-9a-f]{32}$/);
    expect(second).toEqual(first);
    expect(h.writes).toBe(1);
    expect(first.confirmationDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(first.counts).toEqual({ create: 1, unchanged: 0, conflict: 0 });
  });

  it('does not let a browser mutation id become a cross-actor execution authority', async () => {
    const one = await hourglassExecutionId(context('elder-1'), 'mutation-12345678');
    const two = await hourglassExecutionId(context('elder-2'), 'mutation-12345678');
    expect(one).not.toBe(two);
  });

  it('rejects a different source or actor when loading a persisted execution identity', async () => {
    const h = harness();
    const prepared = await preparePersistedHourglassExecutionAttempt(h.database, context(), inspection(), 'mutation-12345678');
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context(), inspection(2), prepared.executionId)).rejects.toThrow('source mismatch');
    await expect(loadPersistedHourglassExecutionAttempt(h.database, context('elder-2'), inspection(), prepared.executionId)).rejects.toThrow('ownership mismatch');
  });
});
