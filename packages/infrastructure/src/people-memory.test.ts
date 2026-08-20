import { describe, expect, it } from 'vitest';
import { PeopleDirectoryService, type ApplicationRuntime } from '@eutaktos/application';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import { InMemoryPeopleUnitOfWork } from './people-memory';

function ctx(tenantId: string, capabilities: AccessContext['capabilities']) {
  return createAccessContext({ tenantId, actorId: `actor-${tenantId}`, capabilities });
}

function runtime(): ApplicationRuntime {
  let person = 0, audit = 0, event = 0, availability = 0;
  return {
    now: () => '2026-08-20T02:00:00.000Z',
    nextId: scope => {
      if (scope === 'person') return `person-${++person}`;
      if (scope === 'audit') return `audit-${++audit}`;
      if (scope === 'event') return `event-${++event}`;
      return `availability-${++availability}`;
    },
  };
}

const seed: CongregationPerson = {
  id: 'person-1', tenantId: 'tenant-b', displayName: 'Private', active: true, availability: [], eligibility: [],
};

describe('InMemoryPeopleUnitOfWork', () => {
  it('persists person, audit and outbox atomically through the application service', () => {
    const store = new InMemoryPeopleUnitOfWork();
    const service = new PeopleDirectoryService(store, runtime());
    const writer = ctx('tenant-a', ['people.read', 'people.write']);
    service.create(writer, { displayName: 'Ana Costa', preferredLocale: 'pt-PT' });

    expect(store.list(writer)).toHaveLength(1);
    expect(store.listAudit(ctx('tenant-a', ['audit.read']))).toHaveLength(1);
    expect(store.listOutbox(ctx('tenant-a', ['tenant.manage']))).toHaveLength(1);
  });

  it('never reveals another tenant through list or id lookup', () => {
    const store = new InMemoryPeopleUnitOfWork([seed]);
    const reader = ctx('tenant-a', ['people.read']);
    expect(store.list(reader)).toEqual([]);
    expect(store.findById(reader, 'person-1')).toBeUndefined();
  });

  it('rejects the complete write-set before mutation when event tenant mismatches', () => {
    const store = new InMemoryPeopleUnitOfWork();
    const context = ctx('tenant-a', ['people.read', 'people.write']);
    expect(() => store.commitCreate(context, {
      person: { id: 'person-1', tenantId: 'tenant-a', displayName: 'Ana', active: true, availability: [], eligibility: [] },
      auditEvent: { id: 'audit-1', tenantId: 'tenant-a', resourceType: 'person', resourceId: 'person-1', action: 'create', actorId: 'actor-tenant-a', occurredAt: '2026-08-20T02:00:00Z', changedFields: ['displayName'] },
      domainEvent: { id: 'event-1', tenantId: 'tenant-b', type: 'PersonCreated', aggregateId: 'person-1', actorId: 'actor-tenant-a', occurredAt: '2026-08-20T02:00:00Z', schemaVersion: 1 },
    })).toThrow('Cross-tenant access denied');
    expect(store.list(context)).toEqual([]);
    expect(store.listAudit(ctx('tenant-a', ['audit.read']))).toEqual([]);
  });

  it('requires audit and management capabilities for operational logs', () => {
    const store = new InMemoryPeopleUnitOfWork();
    expect(() => store.listAudit(ctx('tenant-a', []))).toThrow('audit.read');
    expect(() => store.listOutbox(ctx('tenant-a', []))).toThrow('tenant.manage');
  });
});
