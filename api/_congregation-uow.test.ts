import { describe, expect, it, vi } from 'vitest';
import { createAccessContext, createCongregationProfile } from '@eutaktos/domain';
import type { CongregationChange } from '@eutaktos/application';
import type { EntityRow } from './_db';
import { CongregationSnapshotUnitOfWork } from './_congregation-uow';

const context = createAccessContext({ tenantId: 'tenant-1', actorId: 'actor-1', capabilities: ['tenant.manage'] });
const profile = createCongregationProfile({
  tenantId: 'tenant-1',
  name: 'Congregação Teste',
  timezone: 'Europe/Lisbon',
  defaultLocale: 'pt-PT',
  midweekMeeting: { weekday: 2, localTime: '19:30' },
  weekendMeeting: { weekday: 0, localTime: '10:00' },
});
const change: CongregationChange = {
  profile,
  auditEvent: {
    id: 'audit-1', tenantId: 'tenant-1', resourceType: 'congregation', resourceId: 'tenant-1', action: 'create',
    actorId: 'actor-1', occurredAt: '2026-08-23T18:00:00.000Z', changedFields: ['name'],
  },
  domainEvent: {
    id: 'event-1', tenantId: 'tenant-1', type: 'CongregationCreated', aggregateId: 'tenant-1', actorId: 'actor-1',
    occurredAt: '2026-08-23T18:00:00.000Z', schemaVersion: 1,
  },
};

describe('CongregationSnapshotUnitOfWork', () => {
  it('persists a new profile through the atomic entity change contract', async () => {
    const uow = new CongregationSnapshotUnitOfWork('tenant-1', []);
    expect(uow.findProfile(context)).toBeUndefined();
    expect(uow.commitCreate(context, change)).toEqual(profile);

    const applyEntityChange = vi.fn(async () => undefined);
    await uow.flush({ applyEntityChange } as never);

    expect(applyEntityChange).toHaveBeenCalledOnce();
    expect(applyEntityChange).toHaveBeenCalledWith(expect.objectContaining({
      p_tenant_id: 'tenant-1',
      p_entity_type: 'congregation',
      p_entity_id: 'tenant-1',
      p_expected_version: null,
      p_data: expect.objectContaining({ id: 'tenant-1', tenantId: 'tenant-1', name: 'Congregação Teste' }),
    }));
  });

  it('loads an existing persisted profile without exposing the storage-only id', () => {
    const row: EntityRow = {
      tenant_id: 'tenant-1',
      entity_type: 'congregation',
      entity_id: 'tenant-1',
      version: 3,
      data: { id: 'tenant-1', ...profile },
    };
    const loaded = new CongregationSnapshotUnitOfWork('tenant-1', [row]).findProfile(context);
    expect(loaded).toEqual(profile);
    expect(loaded).not.toHaveProperty('id');
  });

  it('rejects cross-tenant stored data', () => {
    const row: EntityRow = {
      tenant_id: 'tenant-2',
      entity_type: 'congregation',
      entity_id: 'tenant-1',
      version: 1,
      data: { id: 'tenant-1', ...profile },
    };
    expect(() => new CongregationSnapshotUnitOfWork('tenant-1', [row])).toThrow('Cross-tenant');
  });
});
