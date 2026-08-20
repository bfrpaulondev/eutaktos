import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  createDomainEvent,
  createServiceGroup,
  type ServiceGroup,
} from '@eutaktos/domain';
import { InMemoryServiceGroupUnitOfWork } from './service-group-memory';
import type {
  ServiceGroupChange,
  OrganizationDeletionChange,
} from '@eutaktos/application';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ACTOR = 'actor-1';

function ctx(
  tenantId = TENANT_A,
  capabilities: readonly string[] = ['people.read', 'people.write'],
) {
  return createAccessContext({ tenantId, actorId: ACTOR, capabilities: capabilities as any });
}

function makeServiceGroup(
  id = 'sg-1',
  tenantId = TENANT_A,
  name = 'Service Group One',
  memberIds = ['p-1', 'p-2'],
  overseerId?: string,
  assistantId?: string,
): ServiceGroup {
  return createServiceGroup({ id, tenantId, name, memberIds, overseerId, assistantId });
}

function makeChange(
  serviceGroup: ServiceGroup,
  action: 'create' | 'update' = 'create',
): ServiceGroupChange {
  const auditEvent = createAuditEvent({
    id: `audit-${serviceGroup.id}`,
    tenantId: serviceGroup.tenantId,
    resourceType: 'service-group',
    resourceId: serviceGroup.id,
    action,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    changedFields: action === 'create' ? ['name', 'memberIds'] : ['name'],
  });

  const domainEvent = createDomainEvent({
    id: `event-${serviceGroup.id}`,
    tenantId: serviceGroup.tenantId,
    type: action === 'create' ? 'ServiceGroupCreated' : 'ServiceGroupUpdated',
    aggregateId: serviceGroup.id,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    schemaVersion: 1,
  });

  return { serviceGroup, auditEvent, domainEvent };
}

function makeDeleteChange(serviceGroup: ServiceGroup): OrganizationDeletionChange {
  const auditEvent = createAuditEvent({
    id: `audit-del-${serviceGroup.id}`,
    tenantId: serviceGroup.tenantId,
    resourceType: 'service-group',
    resourceId: serviceGroup.id,
    action: 'delete',
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    changedFields: [],
  });

  const domainEvent = createDomainEvent({
    id: `event-del-${serviceGroup.id}`,
    tenantId: serviceGroup.tenantId,
    type: 'ServiceGroupDeleted',
    aggregateId: serviceGroup.id,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    schemaVersion: 1,
  });

  return { auditEvent, domainEvent };
}

// ---- Tests ----

describe('InMemoryServiceGroupUnitOfWork', () => {
  // ---- Constructor / Seed ----

  describe('constructor', () => {
    it('accepts empty seed', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(uow.listServiceGroups(ctx())).toEqual([]);
    });

    it('seeds service groups', () => {
      const sg1 = makeServiceGroup('sg-1');
      const sg2 = makeServiceGroup('sg-2', TENANT_A, 'Service Group Two', ['p-3']);
      const uow = new InMemoryServiceGroupUnitOfWork([sg1, sg2]);
      expect(uow.listServiceGroups(ctx())).toHaveLength(2);
    });

    it('rejects duplicate tenant+id in seed', () => {
      const sg = makeServiceGroup('sg-1');
      expect(() => new InMemoryServiceGroupUnitOfWork([sg, sg])).toThrow('Duplicate tenant service-group id');
    });

    it('isolates seed data from caller', () => {
      const original = makeServiceGroup();
      const uow = new InMemoryServiceGroupUnitOfWork([original]);
      // Mutate original — should not affect the UoW
      (original as any).name = 'MUTATED';
      const found = uow.findServiceGroupById(ctx(), 'sg-1');
      expect(found!.name).toBe('Service Group One');
    });
  });

  // ---- listServiceGroups ----

  describe('listServiceGroups', () => {
    it('returns only tenant-scoped service groups', () => {
      const sgA = makeServiceGroup('sg-a', TENANT_A);
      const sgB = makeServiceGroup('sg-b', TENANT_B);
      const uow = new InMemoryServiceGroupUnitOfWork([sgA, sgB]);
      expect(uow.listServiceGroups(ctx(TENANT_A))).toEqual([expect.objectContaining({ id: 'sg-a' })]);
      expect(uow.listServiceGroups(ctx(TENANT_B))).toEqual([expect.objectContaining({ id: 'sg-b' })]);
    });

    it('requires people.read capability', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(() => uow.listServiceGroups(ctx(TENANT_A, ['people.write']))).toThrow('missing capability people.read');
    });

    it('returns defensive clones', () => {
      const sg = makeServiceGroup();
      const uow = new InMemoryServiceGroupUnitOfWork([sg]);
      const list = uow.listServiceGroups(ctx());
      expect(list[0]).not.toBe(sg);
      expect(list[0]).toEqual(sg);
      // Mutating a returned item should not affect the store
      (list[0] as any).name = 'MUTATED';
      expect(uow.findServiceGroupById(ctx(), 'sg-1')!.name).toBe('Service Group One');
    });

    it('returns empty array for tenant with no service groups', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1', TENANT_A)]);
      expect(uow.listServiceGroups(ctx(TENANT_B))).toEqual([]);
    });
  });

  // ---- findServiceGroupById ----

  describe('findServiceGroupById', () => {
    it('finds a service group by id within the tenant', () => {
      const sg = makeServiceGroup('sg-1', TENANT_A);
      const uow = new InMemoryServiceGroupUnitOfWork([sg]);
      const found = uow.findServiceGroupById(ctx(TENANT_A), 'sg-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('sg-1');
      expect(found!.name).toBe('Service Group One');
    });

    it('returns undefined for non-existent id', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(uow.findServiceGroupById(ctx(), 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for id that belongs to another tenant', () => {
      const sg = makeServiceGroup('sg-1', TENANT_B);
      const uow = new InMemoryServiceGroupUnitOfWork([sg]);
      expect(uow.findServiceGroupById(ctx(TENANT_A), 'sg-1')).toBeUndefined();
    });

    it('requires people.read capability', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(() => uow.findServiceGroupById(ctx(TENANT_A, ['people.write']), 'sg-1')).toThrow('missing capability people.read');
    });

    it('returns a defensive clone', () => {
      const sg = makeServiceGroup();
      const uow = new InMemoryServiceGroupUnitOfWork([sg]);
      const found = uow.findServiceGroupById(ctx(), 'sg-1');
      expect(found).not.toBe(sg);
      (found as any).name = 'MUTATED';
      expect(uow.findServiceGroupById(ctx(), 'sg-1')!.name).toBe('Service Group One');
    });

    it('preserves overseer and assistant fields', () => {
      const sg = makeServiceGroup('sg-1', TENANT_A, 'Group', ['p-1', 'p-2', 'p-3'], 'p-1', 'p-2');
      const uow = new InMemoryServiceGroupUnitOfWork([sg]);
      const found = uow.findServiceGroupById(ctx(), 'sg-1');
      expect(found!.overseerId).toBe('p-1');
      expect(found!.assistantId).toBe('p-2');
    });
  });

  // ---- commitServiceGroupCreate ----

  describe('commitServiceGroupCreate', () => {
    it('stores a new service group and returns a clone', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1');
      const change = makeChange(sg, 'create');
      const result = uow.commitServiceGroupCreate(ctx(), change);

      expect(result.id).toBe('sg-1');
      expect(result).not.toBe(sg);
      expect(uow.listServiceGroups(ctx())).toHaveLength(1);
    });

    it('stores audit and domain events atomically', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1');
      const change = makeChange(sg, 'create');

      uow.commitServiceGroupCreate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceId).toBe('sg-1');
      expect(audit[0].action).toBe('create');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('ServiceGroupCreated');
    });

    it('rejects duplicate service group id within same tenant', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const sg2 = makeServiceGroup('sg-1');
      const change = makeChange(sg2, 'create');
      expect(() => uow.commitServiceGroupCreate(ctx(), change)).toThrow('Service group already exists');
    });

    it('rejects duplicate audit event id', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg1 = makeServiceGroup('sg-1');
      const sg2 = makeServiceGroup('sg-2');
      const change1 = makeChange(sg1, 'create');
      const change2: ServiceGroupChange = {
        serviceGroup: sg2,
        auditEvent: change1.auditEvent, // same audit id
        domainEvent: createDomainEvent({
          id: 'event-sg-2',
          tenantId: TENANT_A,
          type: 'ServiceGroupCreated',
          aggregateId: 'sg-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      uow.commitServiceGroupCreate(ctx(), change1);
      expect(() => uow.commitServiceGroupCreate(ctx(), change2)).toThrow('Duplicate audit event id');
    });

    it('rejects duplicate domain event id', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg1 = makeServiceGroup('sg-1');
      const sg2 = makeServiceGroup('sg-2');
      const change1 = makeChange(sg1, 'create');
      const change2: ServiceGroupChange = {
        serviceGroup: sg2,
        auditEvent: createAuditEvent({
          id: 'audit-sg-2',
          tenantId: TENANT_A,
          resourceType: 'service-group',
          resourceId: 'sg-2',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['name', 'memberIds'],
        }),
        domainEvent: change1.domainEvent, // same event id
      };

      uow.commitServiceGroupCreate(ctx(), change1);
      expect(() => uow.commitServiceGroupCreate(ctx(), change2)).toThrow('Duplicate domain event id');
    });

    it('throws on cross-tenant service group', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1', TENANT_B);
      const change = makeChange(sg, 'create');
      expect(() => uow.commitServiceGroupCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant audit event', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1', TENANT_A);
      const crossTenantAudit = createAuditEvent({
        id: 'audit-cross',
        tenantId: TENANT_B,
        resourceType: 'service-group',
        resourceId: 'sg-1',
        action: 'create',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        changedFields: ['name'],
      });
      const change: ServiceGroupChange = {
        serviceGroup: sg,
        auditEvent: crossTenantAudit,
        domainEvent: createDomainEvent({
          id: 'event-sg-1',
          tenantId: TENANT_A,
          type: 'ServiceGroupCreated',
          aggregateId: 'sg-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      expect(() => uow.commitServiceGroupCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant domain event', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1', TENANT_A);
      const crossTenantEvent = createDomainEvent({
        id: 'event-cross',
        tenantId: TENANT_B,
        type: 'ServiceGroupCreated',
        aggregateId: 'sg-1',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        schemaVersion: 1,
      });
      const change: ServiceGroupChange = {
        serviceGroup: sg,
        auditEvent: createAuditEvent({
          id: 'audit-sg-1',
          tenantId: TENANT_A,
          resourceType: 'service-group',
          resourceId: 'sg-1',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['name'],
        }),
        domainEvent: crossTenantEvent,
      };
      expect(() => uow.commitServiceGroupCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('allows same service group id in different tenants', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sgA = makeServiceGroup('sg-1', TENANT_A);
      const sgB = makeServiceGroup('sg-1', TENANT_B);

      uow.commitServiceGroupCreate(ctx(TENANT_A), makeChange(sgA, 'create'));
      uow.commitServiceGroupCreate(ctx(TENANT_B), makeChange(sgB, 'create'));

      expect(uow.listServiceGroups(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listServiceGroups(ctx(TENANT_B))).toHaveLength(1);
    });
  });

  // ---- commitServiceGroupUpdate ----

  describe('commitServiceGroupUpdate', () => {
    it('updates an existing service group', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const updated = makeServiceGroup('sg-1', TENANT_A, 'Updated Name', ['p-1', 'p-3']);
      const change = makeChange(updated, 'update');
      const result = uow.commitServiceGroupUpdate(ctx(), change);

      expect(result.name).toBe('Updated Name');
      expect(result.memberIds).toEqual(['p-1', 'p-3']);
      expect(uow.findServiceGroupById(ctx(), 'sg-1')!.name).toBe('Updated Name');
    });

    it('throws if service group does not exist', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1');
      const change = makeChange(sg, 'update');
      expect(() => uow.commitServiceGroupUpdate(ctx(), change)).toThrow('Service group not found');
    });

    it('stores audit and domain events for update', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const updated = makeServiceGroup('sg-1', TENANT_A, 'Updated');
      const change = makeChange(updated, 'update');

      uow.commitServiceGroupUpdate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('update');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('ServiceGroupUpdated');
    });

    it('returns defensive clone', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const updated = makeServiceGroup('sg-1', TENANT_A, 'Updated');
      const change = makeChange(updated, 'update');
      const result = uow.commitServiceGroupUpdate(ctx(), change);
      expect(result).not.toBe(updated);
      (result as any).name = 'MUTATED';
      expect(uow.findServiceGroupById(ctx(), 'sg-1')!.name).toBe('Updated');
    });
  });

  // ---- commitServiceGroupDelete ----

  describe('commitServiceGroupDelete', () => {
    it('deletes an existing service group', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const sg = makeServiceGroup('sg-1');
      const change = makeDeleteChange(sg);
      const result = uow.commitServiceGroupDelete(ctx(), 'sg-1', change);

      expect(result).toBe(true);
      expect(uow.findServiceGroupById(ctx(), 'sg-1')).toBeUndefined();
      expect(uow.listServiceGroups(ctx())).toHaveLength(0);
    });

    it('throws if service group does not exist', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1');
      const change = makeDeleteChange(sg);
      expect(() => uow.commitServiceGroupDelete(ctx(), 'sg-1', change)).toThrow('Service group not found');
    });

    it('requires people.write capability', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const sg = makeServiceGroup('sg-1');
      const change = makeDeleteChange(sg);
      expect(() => uow.commitServiceGroupDelete(ctx(TENANT_A, ['people.read']), 'sg-1', change)).toThrow('missing capability people.write');
    });

    it('stores audit and domain events atomically with delete', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const sg = makeServiceGroup('sg-1');
      const change = makeDeleteChange(sg);

      uow.commitServiceGroupDelete(ctx(), 'sg-1', change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('delete');
      expect(audit[0].resourceId).toBe('sg-1');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('ServiceGroupDeleted');
    });

    it('rejects duplicate audit event id on delete', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1'), makeServiceGroup('sg-2')]);
      const change1 = makeDeleteChange(makeServiceGroup('sg-1'));
      const change2: OrganizationDeletionChange = {
        auditEvent: change1.auditEvent, // reuse same audit id
        domainEvent: createDomainEvent({
          id: 'event-del-2',
          tenantId: TENANT_A,
          type: 'ServiceGroupDeleted',
          aggregateId: 'sg-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      uow.commitServiceGroupDelete(ctx(), 'sg-1', change1);
      expect(() => uow.commitServiceGroupDelete(ctx(), 'sg-2', change2)).toThrow('Duplicate audit event id');
    });

    it('rejects duplicate domain event id on delete', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1'), makeServiceGroup('sg-2')]);
      const change1 = makeDeleteChange(makeServiceGroup('sg-1'));
      const change2: OrganizationDeletionChange = {
        auditEvent: createAuditEvent({
          id: 'audit-del-2',
          tenantId: TENANT_A,
          resourceType: 'service-group',
          resourceId: 'sg-2',
          action: 'delete',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: [],
        }),
        domainEvent: change1.domainEvent, // reuse same event id
      };
      uow.commitServiceGroupDelete(ctx(), 'sg-1', change1);
      expect(() => uow.commitServiceGroupDelete(ctx(), 'sg-2', change2)).toThrow('Duplicate domain event id');
    });

    it('throws on cross-tenant audit event in delete', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const crossTenantAudit = createAuditEvent({
        id: 'audit-cross-del',
        tenantId: TENANT_B,
        resourceType: 'service-group',
        resourceId: 'sg-1',
        action: 'delete',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        changedFields: [],
      });
      const change: OrganizationDeletionChange = {
        auditEvent: crossTenantAudit,
        domainEvent: createDomainEvent({
          id: 'event-del-cross',
          tenantId: TENANT_A,
          type: 'ServiceGroupDeleted',
          aggregateId: 'sg-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      expect(() => uow.commitServiceGroupDelete(ctx(), 'sg-1', change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant domain event in delete', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const crossTenantEvent = createDomainEvent({
        id: 'event-del-cross',
        tenantId: TENANT_B,
        type: 'ServiceGroupDeleted',
        aggregateId: 'sg-1',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        schemaVersion: 1,
      });
      const change: OrganizationDeletionChange = {
        auditEvent: createAuditEvent({
          id: 'audit-del-cross',
          tenantId: TENANT_A,
          resourceType: 'service-group',
          resourceId: 'sg-1',
          action: 'delete',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: [],
        }),
        domainEvent: crossTenantEvent,
      };
      expect(() => uow.commitServiceGroupDelete(ctx(), 'sg-1', change)).toThrow('Cross-tenant access denied');
    });

    it('does not delete a service group from another tenant', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1', TENANT_B)]);
      const sg = makeServiceGroup('sg-1', TENANT_B);
      const change = makeDeleteChange(sg);
      // Tenant A tries to delete sg-1 which belongs to Tenant B.
      // The cross-tenant audit/domain event check fires before the not-found check.
      expect(() => uow.commitServiceGroupDelete(ctx(TENANT_A), 'sg-1', change)).toThrow('Cross-tenant access denied');
      expect(uow.findServiceGroupById(ctx(TENANT_B), 'sg-1')).toBeDefined();
    });
  });

  // ---- Cross-tenant isolation (adversarial) ----

  describe('cross-tenant isolation', () => {
    it('listServiceGroups never leaks data across tenants', () => {
      const sgA = makeServiceGroup('sg-a', TENANT_A, 'Alpha');
      const sgB = makeServiceGroup('sg-b', TENANT_B, 'Beta');
      const uow = new InMemoryServiceGroupUnitOfWork([sgA, sgB]);

      const listA = uow.listServiceGroups(ctx(TENANT_A));
      const listB = uow.listServiceGroups(ctx(TENANT_B));

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0].id).toBe('sg-a');
      expect(listB[0].id).toBe('sg-b');
    });

    it('findServiceGroupById never leaks across tenants', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1', TENANT_B)]);
      expect(uow.findServiceGroupById(ctx(TENANT_A), 'sg-1')).toBeUndefined();
    });

    it('audit events are tenant-scoped', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sgA = makeServiceGroup('sg-a', TENANT_A);
      const sgB = makeServiceGroup('sg-b', TENANT_B);

      uow.commitServiceGroupCreate(ctx(TENANT_A), makeChange(sgA, 'create'));
      uow.commitServiceGroupCreate(ctx(TENANT_B), makeChange(sgB, 'create'));

      const auditA = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      const auditB = uow.listAudit(ctx(TENANT_B, ['audit.read']));

      expect(auditA).toHaveLength(1);
      expect(auditB).toHaveLength(1);
      expect(auditA[0].resourceId).toBe('sg-a');
      expect(auditB[0].resourceId).toBe('sg-b');
    });

    it('outbox events are tenant-scoped', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sgA = makeServiceGroup('sg-a', TENANT_A);
      const sgB = makeServiceGroup('sg-b', TENANT_B);

      uow.commitServiceGroupCreate(ctx(TENANT_A), makeChange(sgA, 'create'));
      uow.commitServiceGroupCreate(ctx(TENANT_B), makeChange(sgB, 'create'));

      const outboxA = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      const outboxB = uow.listOutbox(ctx(TENANT_B, ['tenant.manage']));

      expect(outboxA).toHaveLength(1);
      expect(outboxB).toHaveLength(1);
      expect(outboxA[0].aggregateId).toBe('sg-a');
      expect(outboxB[0].aggregateId).toBe('sg-b');
    });
  });

  // ---- listAudit / listOutbox ----

  describe('listAudit', () => {
    it('requires audit.read capability', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(() => uow.listAudit(ctx(TENANT_A, ['people.read']))).toThrow('missing capability audit.read');
    });

    it('returns frozen clones of audit events', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup();
      uow.commitServiceGroupCreate(ctx(), makeChange(sg, 'create'));

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(Object.isFrozen(audit[0])).toBe(true);
      // Frozen objects prevent mutation entirely — verify the store is independent
      const audit2 = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit2[0].resourceId).toBe('sg-1');
      expect(audit[0]).not.toBe(audit2[0]); // distinct clones each call
    });
  });

  describe('listOutbox', () => {
    it('requires tenant.manage capability', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      expect(() => uow.listOutbox(ctx(TENANT_A, ['people.read']))).toThrow('missing capability tenant.manage');
    });

    it('returns frozen clones of domain events', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup();
      uow.commitServiceGroupCreate(ctx(), makeChange(sg, 'create'));

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(Object.isFrozen(outbox[0])).toBe(true);
      // Frozen objects prevent mutation entirely — verify the store is independent
      const outbox2 = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox2[0].aggregateId).toBe('sg-1');
      expect(outbox[0]).not.toBe(outbox2[0]); // distinct clones each call
    });
  });

  // ---- Atomicity ----

  describe('atomicity', () => {
    it('duplicate audit id rolls back the whole create', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg = makeServiceGroup('sg-1');
      const change = makeChange(sg, 'create');

      uow.commitServiceGroupCreate(ctx(), change);

      // Try to create another service group reusing the same audit id
      const sg2 = makeServiceGroup('sg-2');
      const change2: ServiceGroupChange = {
        serviceGroup: sg2,
        auditEvent: change.auditEvent, // duplicate
        domainEvent: createDomainEvent({
          id: 'event-sg-2',
          tenantId: TENANT_A,
          type: 'ServiceGroupCreated',
          aggregateId: 'sg-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      expect(() => uow.commitServiceGroupCreate(ctx(), change2)).toThrow('Duplicate audit event id');
      // sg-2 should NOT have been persisted
      expect(uow.findServiceGroupById(ctx(), 'sg-2')).toBeUndefined();
      // sg-1 should still be there
      expect(uow.findServiceGroupById(ctx(), 'sg-1')).toBeDefined();
    });

    it('duplicate event id rolls back the whole update', () => {
      const uow = new InMemoryServiceGroupUnitOfWork([makeServiceGroup('sg-1')]);
      const change1 = makeChange(makeServiceGroup('sg-1', TENANT_A, 'V2'), 'update');
      uow.commitServiceGroupUpdate(ctx(), change1);

      const change2: ServiceGroupChange = {
        serviceGroup: makeServiceGroup('sg-1', TENANT_A, 'V3'),
        auditEvent: createAuditEvent({
          id: 'audit-sg-1-v3',
          tenantId: TENANT_A,
          resourceType: 'service-group',
          resourceId: 'sg-1',
          action: 'update',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:01:00Z',
          changedFields: ['name'],
        }),
        domainEvent: change1.domainEvent, // duplicate event id
      };

      expect(() => uow.commitServiceGroupUpdate(ctx(), change2)).toThrow('Duplicate domain event id');
      // sg-1 should still be V2, not V3
      expect(uow.findServiceGroupById(ctx(), 'sg-1')!.name).toBe('V2');
    });

    it('duplicate audit id on create does not leak the service group', () => {
      const uow = new InMemoryServiceGroupUnitOfWork();
      const sg1 = makeServiceGroup('sg-1');
      const sg2 = makeServiceGroup('sg-2');
      const change1 = makeChange(sg1, 'create');

      uow.commitServiceGroupCreate(ctx(), change1);

      const change2: ServiceGroupChange = {
        serviceGroup: sg2,
        auditEvent: change1.auditEvent,
        domainEvent: createDomainEvent({
          id: 'event-sg-2',
          tenantId: TENANT_A,
          type: 'ServiceGroupCreated',
          aggregateId: 'sg-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      expect(() => uow.commitServiceGroupCreate(ctx(), change2)).toThrow('Duplicate audit event id');
      // Verify no domain event leaked for sg-2
      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].aggregateId).toBe('sg-1');
    });
  });
});
