import { describe, expect, it, vi } from 'vitest';
import { createAccessContext } from '@eutaktos/domain';
import type { EntityRow } from '../_db';
import { changeManualRecommendationConstraint, loadManualRecommendationConstraints, manualRecommendationConstraintId } from './recommendation-constraints';

function context(tenantId = 'tenant-a') {
  return createAccessContext({ tenantId, actorId: 'elder-1', capabilities: ['people.read', 'schedule.read', 'schedule.write'] });
}

function harness() {
  const rows = new Map<string, EntityRow>();
  const writes: Readonly<Record<string, unknown>>[] = [];
  const deletes: Readonly<Record<string, unknown>>[] = [];
  const database = {
    entities: async (tenantId: string, entityType: string) => Object.freeze([...rows.values()].filter(row => row.tenant_id === tenantId && row.entity_type === entityType)),
    entity: async (tenantId: string, entityType: string, entityId: string) => {
      const row = rows.get(entityId);
      return row?.tenant_id === tenantId && row.entity_type === entityType ? row : undefined;
    },
    applyEntityChange: async (input: Readonly<Record<string, unknown>>) => {
      writes.push(input);
      const data = input.p_data as Readonly<Record<string, unknown>>;
      rows.set(String(input.p_entity_id), { tenant_id: String(input.p_tenant_id), entity_type: String(input.p_entity_type), entity_id: String(input.p_entity_id), data, version: 1 });
    },
    deleteEntityChange: async (input: Readonly<Record<string, unknown>>) => {
      deletes.push(input);
      rows.delete(String(input.p_entity_id));
    },
  };
  return { database, writes, deletes, rows };
}

describe('PX7.8 manual recommendation constraint persistence', () => {
  it('uses deterministic tenant-scoped identity and exact retry is idempotent', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T12:00:00.000Z'));
    const h = harness();
    const first = await changeManualRecommendationConstraint(h.database, context(), 'person-1', 'reading', 'exclude');
    const second = await changeManualRecommendationConstraint(h.database, context(), 'person-1', 'reading', 'exclude');
    expect(first).toEqual({ excluded: true, changed: true });
    expect(second).toEqual({ excluded: true, changed: false });
    expect(h.writes).toHaveLength(1);
    expect((h.writes[0]?.p_audit as Readonly<Record<string, unknown>>).resource_type).toBeUndefined();
    expect(JSON.stringify(h.writes[0])).not.toContain('Ana');
    vi.useRealTimers();
  });

  it('separates tenant and assignment type identities', async () => {
    const one = await manualRecommendationConstraintId('tenant-a', 'person-1', 'reading');
    const two = await manualRecommendationConstraintId('tenant-b', 'person-1', 'reading');
    const three = await manualRecommendationConstraintId('tenant-a', 'person-1', 'talk');
    expect(new Set([one, two, three]).size).toBe(3);
  });

  it('removes only the exact persisted exclusion and makes retry idempotent', async () => {
    const h = harness();
    await changeManualRecommendationConstraint(h.database, context(), 'person-1', 'reading', 'exclude');
    expect(await changeManualRecommendationConstraint(h.database, context(), 'person-1', 'reading', 'allow')).toEqual({ excluded: false, changed: true });
    expect(await changeManualRecommendationConstraint(h.database, context(), 'person-1', 'reading', 'allow')).toEqual({ excluded: false, changed: false });
    expect(h.deletes).toHaveLength(1);
    expect(await loadManualRecommendationConstraints(h.database, 'tenant-a')).toEqual([]);
  });
});