import { describe, expect, it } from 'vitest';
import {
  CongregationSettingsService,
  type ApplicationRuntime,
  type CongregationChange,
} from '@eutaktos/application';
import {
  createAccessContext,
  createAuditEvent,
  createCongregationProfile,
  createDomainEvent,
  type AccessContext,
  type CongregationProfile,
} from '@eutaktos/domain';
import { InMemoryCongregationUnitOfWork } from './congregation-memory';

function runtime(): ApplicationRuntime {
  const counters = new Map<string, number>();
  return {
    now: () => '2026-08-20T17:00:00.000Z',
    nextId: scope => {
      const next = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, next);
      return `${scope}-${next}`;
    },
  };
}

function context(
  tenantId = 'tenant-a',
  capabilities: AccessContext['capabilities'] = ['tenant.manage'],
): Readonly<AccessContext> {
  return createAccessContext({ tenantId, actorId: 'admin-1', capabilities });
}

function settings(name = 'Central Congregation') {
  return {
    name,
    timezone: 'Europe/Lisbon',
    defaultLocale: 'pt-PT',
    midweekMeeting: { weekday: 2 as const, localTime: '19:30' },
    weekendMeeting: { weekday: 0 as const, localTime: '10:00' },
  };
}

function profile(tenantId: string, name: string): CongregationProfile {
  return createCongregationProfile({ tenantId, ...settings(name) });
}

function change(
  tenantId: string,
  profileValue: CongregationProfile,
  options: {
    auditId?: string;
    eventId?: string;
    action?: 'create' | 'update';
    eventType?: 'CongregationCreated' | 'CongregationUpdated';
  } = {},
): CongregationChange {
  return {
    profile: profileValue,
    auditEvent: createAuditEvent({
      id: options.auditId ?? 'audit-1',
      tenantId,
      resourceType: 'congregation',
      resourceId: tenantId,
      action: options.action ?? 'create',
      actorId: 'admin-1',
      occurredAt: '2026-08-20T17:00:00.000Z',
      changedFields: ['name'],
    }),
    domainEvent: createDomainEvent({
      id: options.eventId ?? 'event-1',
      tenantId,
      type: options.eventType ?? 'CongregationCreated',
      aggregateId: tenantId,
      actorId: 'admin-1',
      occurredAt: '2026-08-20T17:00:00.000Z',
      schemaVersion: 1,
    }),
  };
}

describe('InMemoryCongregationUnitOfWork', () => {
  it('integrates with CongregationSettingsService and persists audit/outbox atomically', () => {
    const unitOfWork = new InMemoryCongregationUnitOfWork();
    const service = new CongregationSettingsService(unitOfWork, runtime());
    const ctx = context();

    service.save(ctx, settings());
    service.save(ctx, { ...settings(), timezone: 'Atlantic/Azores' });

    expect(service.get(ctx)?.timezone).toBe('Atlantic/Azores');
    expect(unitOfWork.listAudit(context('tenant-a', ['audit.read']))).toHaveLength(2);
    expect(unitOfWork.listOutbox(ctx).map(event => event.type)).toEqual([
      'CongregationCreated',
      'CongregationUpdated',
    ]);
  });

  it('returns defensive clones so callers cannot mutate persisted settings', () => {
    const seeded = profile('tenant-a', 'Central Congregation');
    const unitOfWork = new InMemoryCongregationUnitOfWork([seeded]);
    const ctx = context();

    const first = unitOfWork.findProfile(ctx);
    expect(first).toBeDefined();
    if (!first) throw new Error('missing fixture');
    first.name = 'Mutated';
    first.midweekMeeting.localTime = '00:01';

    expect(unitOfWork.findProfile(ctx)).toEqual(seeded);
  });

  it('isolates profiles audit and outbox by tenant', () => {
    const unitOfWork = new InMemoryCongregationUnitOfWork([
      profile('tenant-a', 'A'),
      profile('tenant-b', 'B'),
    ]);

    expect(unitOfWork.findProfile(context('tenant-a'))?.name).toBe('A');
    expect(unitOfWork.findProfile(context('tenant-b'))?.name).toBe('B');
    expect(unitOfWork.findProfile(context('tenant-c'))).toBeUndefined();
    expect(unitOfWork.listAudit(context('tenant-a', ['audit.read']))).toEqual([]);
  });

  it('rejects cross-tenant write-sets before mutating storage', () => {
    const unitOfWork = new InMemoryCongregationUnitOfWork();
    const ctx = context('tenant-a');
    const foreign = change('tenant-b', profile('tenant-b', 'Other'));

    expect(() => unitOfWork.commitCreate(ctx, foreign)).toThrow('Cross-tenant access denied');
    expect(unitOfWork.findProfile(ctx)).toBeUndefined();
    expect(unitOfWork.listAudit(context('tenant-a', ['audit.read']))).toEqual([]);
    expect(unitOfWork.listOutbox(ctx)).toEqual([]);
  });

  it('rejects duplicate audit/event ids without partially applying an update', () => {
    const unitOfWork = new InMemoryCongregationUnitOfWork();
    const ctx = context();
    const original = profile('tenant-a', 'Original');
    unitOfWork.commitCreate(ctx, change('tenant-a', original));

    const updated = profile('tenant-a', 'Updated');
    const duplicate = change('tenant-a', updated, {
      auditId: 'audit-1',
      eventId: 'event-2',
      action: 'update',
      eventType: 'CongregationUpdated',
    });

    expect(() => unitOfWork.commitUpdate(ctx, duplicate)).toThrow('Duplicate audit event id');
    expect(unitOfWork.findProfile(ctx)?.name).toBe('Original');
    expect(unitOfWork.listOutbox(ctx)).toHaveLength(1);
  });

  it('enforces capabilities at the persistence boundary', () => {
    const unitOfWork = new InMemoryCongregationUnitOfWork([profile('tenant-a', 'Central')]);

    expect(() => unitOfWork.findProfile(context('tenant-a', []))).toThrow('missing capability tenant.manage');
    expect(() => unitOfWork.listAudit(context('tenant-a', ['tenant.manage']))).toThrow('missing capability audit.read');
  });
});
