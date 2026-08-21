import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  createDomainEvent,
  createHousehold,
  type Household,
} from '@eutaktos/domain';
import { InMemoryHouseholdUnitOfWork } from './household-memory';
import type {
  HouseholdChange,
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

function makeHousehold(
  id = 'hh-1',
  tenantId = TENANT_A,
  name = 'Household One',
  memberIds = ['p-1', 'p-2'],
): Household {
  return createHousehold({ id, tenantId, name, memberIds });
}

function makeChange(
  household: Household,
  action: 'create' | 'update' = 'create',
): HouseholdChange {
  const auditEvent = createAuditEvent({
    id: `audit-${household.id}`,
    tenantId: household.tenantId,
    resourceType: 'household',
    resourceId: household.id,
    action,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    changedFields: action === 'create' ? ['name', 'memberIds'] : ['name'],
  });

  const domainEvent = createDomainEvent({
    id: `event-${household.id}`,
    tenantId: household.tenantId,
    type: action === 'create' ? 'HouseholdCreated' : 'HouseholdUpdated',
    aggregateId: household.id,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    schemaVersion: 1,
  });

  return { household, auditEvent, domainEvent };
}

function makeDeleteChange(household: Household): OrganizationDeletionChange {
  const auditEvent = createAuditEvent({
    id: `audit-del-${household.id}`,
    tenantId: household.tenantId,
    resourceType: 'household',
    resourceId: household.id,
    action: 'delete',
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    changedFields: [],
  });

  const domainEvent = createDomainEvent({
    id: `event-del-${household.id}`,
    tenantId: household.tenantId,
    type: 'HouseholdDeleted',
    aggregateId: household.id,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    schemaVersion: 1,
  });

  return { auditEvent, domainEvent };
}

// ---- Tests ----

describe('InMemoryHouseholdUnitOfWork', () => {
  // ---- Constructor / Seed ----

  describe('constructor', () => {
    it('accepts empty seed', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(uow.listHouseholds(ctx())).toEqual([]);
    });

    it('seeds households', () => {
      const h1 = makeHousehold('hh-1');
      const h2 = makeHousehold('hh-2', TENANT_A, 'Household Two', ['p-3']);
      const uow = new InMemoryHouseholdUnitOfWork([h1, h2]);
      expect(uow.listHouseholds(ctx())).toHaveLength(2);
    });

    it('rejects duplicate tenant+id in seed', () => {
      const h = makeHousehold('hh-1');
      expect(() => new InMemoryHouseholdUnitOfWork([h, h])).toThrow('Duplicate tenant household id');
    });

    it('isolates seed data from caller', () => {
      const original = makeHousehold();
      const uow = new InMemoryHouseholdUnitOfWork([original]);
      // Mutate original — should not affect the UoW
      (original as any).name = 'MUTATED';
      const found = uow.findHouseholdById(ctx(), 'hh-1');
      expect(found!.name).toBe('Household One');
    });
  });

  // ---- listHouseholds ----

  describe('listHouseholds', () => {
    it('returns only tenant-scoped households', () => {
      const hA = makeHousehold('hh-a', TENANT_A);
      const hB = makeHousehold('hh-b', TENANT_B);
      const uow = new InMemoryHouseholdUnitOfWork([hA, hB]);
      expect(uow.listHouseholds(ctx(TENANT_A))).toEqual([expect.objectContaining({ id: 'hh-a' })]);
      expect(uow.listHouseholds(ctx(TENANT_B))).toEqual([expect.objectContaining({ id: 'hh-b' })]);
    });

    it('requires people.read capability', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(() => uow.listHouseholds(ctx(TENANT_A, ['people.write']))).toThrow('missing capability people.read');
    });

    it('returns defensive clones', () => {
      const h = makeHousehold();
      const uow = new InMemoryHouseholdUnitOfWork([h]);
      const list = uow.listHouseholds(ctx());
      expect(list[0]).not.toBe(h);
      expect(list[0]).toEqual(h);
      // Mutating a returned item should not affect the store
      (list[0] as any).name = 'MUTATED';
      expect(uow.findHouseholdById(ctx(), 'hh-1')!.name).toBe('Household One');
    });

    it('returns empty array for tenant with no households', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1', TENANT_A)]);
      expect(uow.listHouseholds(ctx(TENANT_B))).toEqual([]);
    });
  });

  // ---- findHouseholdById ----

  describe('findHouseholdById', () => {
    it('finds a household by id within the tenant', () => {
      const h = makeHousehold('hh-1', TENANT_A);
      const uow = new InMemoryHouseholdUnitOfWork([h]);
      const found = uow.findHouseholdById(ctx(TENANT_A), 'hh-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('hh-1');
      expect(found!.name).toBe('Household One');
    });

    it('returns undefined for non-existent id', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(uow.findHouseholdById(ctx(), 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for id that belongs to another tenant', () => {
      const h = makeHousehold('hh-1', TENANT_B);
      const uow = new InMemoryHouseholdUnitOfWork([h]);
      expect(uow.findHouseholdById(ctx(TENANT_A), 'hh-1')).toBeUndefined();
    });

    it('requires people.read capability', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(() => uow.findHouseholdById(ctx(TENANT_A, ['people.write']), 'hh-1')).toThrow('missing capability people.read');
    });

    it('returns a defensive clone', () => {
      const h = makeHousehold();
      const uow = new InMemoryHouseholdUnitOfWork([h]);
      const found = uow.findHouseholdById(ctx(), 'hh-1');
      expect(found).not.toBe(h);
      (found as any).name = 'MUTATED';
      expect(uow.findHouseholdById(ctx(), 'hh-1')!.name).toBe('Household One');
    });
  });

  // ---- commitHouseholdCreate ----

  describe('commitHouseholdCreate', () => {
    it('stores a new household and returns a clone', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1');
      const change = makeChange(h, 'create');
      const result = uow.commitHouseholdCreate(ctx(), change);

      expect(result.id).toBe('hh-1');
      expect(result).not.toBe(h);
      expect(uow.listHouseholds(ctx())).toHaveLength(1);
    });

    it('stores audit and domain events atomically', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1');
      const change = makeChange(h, 'create');

      uow.commitHouseholdCreate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceId).toBe('hh-1');
      expect(audit[0].action).toBe('create');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('HouseholdCreated');
    });

    it('rejects duplicate household id within same tenant', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const h2 = makeHousehold('hh-1');
      const change = makeChange(h2, 'create');
      expect(() => uow.commitHouseholdCreate(ctx(), change)).toThrow('Household already exists');
    });

    it('rejects duplicate audit event id', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h1 = makeHousehold('hh-1');
      const h2 = makeHousehold('hh-2');
      const change1 = makeChange(h1, 'create');
      const change2: HouseholdChange = {
        household: h2,
        auditEvent: change1.auditEvent, // same audit id
        domainEvent: createDomainEvent({
          id: 'event-hh-2',
          tenantId: TENANT_A,
          type: 'HouseholdCreated',
          aggregateId: 'hh-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      uow.commitHouseholdCreate(ctx(), change1);
      expect(() => uow.commitHouseholdCreate(ctx(), change2)).toThrow('Duplicate audit event id');
    });

    it('rejects duplicate domain event id', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h1 = makeHousehold('hh-1');
      const h2 = makeHousehold('hh-2');
      const change1 = makeChange(h1, 'create');
      const change2: HouseholdChange = {
        household: h2,
        auditEvent: createAuditEvent({
          id: 'audit-hh-2',
          tenantId: TENANT_A,
          resourceType: 'household',
          resourceId: 'hh-2',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['name', 'memberIds'],
        }),
        domainEvent: change1.domainEvent, // same event id
      };

      uow.commitHouseholdCreate(ctx(), change1);
      expect(() => uow.commitHouseholdCreate(ctx(), change2)).toThrow('Duplicate domain event id');
    });

    it('throws on cross-tenant household', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1', TENANT_B);
      const change = makeChange(h, 'create');
      expect(() => uow.commitHouseholdCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant audit event', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1', TENANT_A);
      const crossTenantAudit = createAuditEvent({
        id: 'audit-cross',
        tenantId: TENANT_B,
        resourceType: 'household',
        resourceId: 'hh-1',
        action: 'create',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        changedFields: ['name'],
      });
      const change: HouseholdChange = {
        household: h,
        auditEvent: crossTenantAudit,
        domainEvent: createDomainEvent({
          id: 'event-hh-1',
          tenantId: TENANT_A,
          type: 'HouseholdCreated',
          aggregateId: 'hh-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      expect(() => uow.commitHouseholdCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant domain event', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1', TENANT_A);
      const crossTenantEvent = createDomainEvent({
        id: 'event-cross',
        tenantId: TENANT_B,
        type: 'HouseholdCreated',
        aggregateId: 'hh-1',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        schemaVersion: 1,
      });
      const change: HouseholdChange = {
        household: h,
        auditEvent: createAuditEvent({
          id: 'audit-hh-1',
          tenantId: TENANT_A,
          resourceType: 'household',
          resourceId: 'hh-1',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['name'],
        }),
        domainEvent: crossTenantEvent,
      };
      expect(() => uow.commitHouseholdCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('allows same household id in different tenants', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const hA = makeHousehold('hh-1', TENANT_A);
      const hB = makeHousehold('hh-1', TENANT_B);

      uow.commitHouseholdCreate(ctx(TENANT_A), makeChange(hA, 'create'));
      uow.commitHouseholdCreate(ctx(TENANT_B), makeChange(hB, 'create'));

      expect(uow.listHouseholds(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listHouseholds(ctx(TENANT_B))).toHaveLength(1);
    });
  });

  // ---- commitHouseholdUpdate ----

  describe('commitHouseholdUpdate', () => {
    it('updates an existing household', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const updated = makeHousehold('hh-1', TENANT_A, 'Updated Name', ['p-1', 'p-3']);
      const change = makeChange(updated, 'update');
      const result = uow.commitHouseholdUpdate(ctx(), change);

      expect(result.name).toBe('Updated Name');
      expect(result.memberIds).toEqual(['p-1', 'p-3']);
      expect(uow.findHouseholdById(ctx(), 'hh-1')!.name).toBe('Updated Name');
    });

    it('throws if household does not exist', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1');
      const change = makeChange(h, 'update');
      expect(() => uow.commitHouseholdUpdate(ctx(), change)).toThrow('Household not found');
    });

    it('stores audit and domain events for update', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const updated = makeHousehold('hh-1', TENANT_A, 'Updated');
      const change = makeChange(updated, 'update');

      uow.commitHouseholdUpdate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('update');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('HouseholdUpdated');
    });

    it('returns defensive clone', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const updated = makeHousehold('hh-1', TENANT_A, 'Updated');
      const change = makeChange(updated, 'update');
      const result = uow.commitHouseholdUpdate(ctx(), change);
      expect(result).not.toBe(updated);
      (result as any).name = 'MUTATED';
      expect(uow.findHouseholdById(ctx(), 'hh-1')!.name).toBe('Updated');
    });
  });

  // ---- commitHouseholdDelete ----

  describe('commitHouseholdDelete', () => {
    it('deletes an existing household', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const h = makeHousehold('hh-1');
      const change = makeDeleteChange(h);
      const result = uow.commitHouseholdDelete(ctx(), 'hh-1', change);

      expect(result).toBe(true);
      expect(uow.findHouseholdById(ctx(), 'hh-1')).toBeUndefined();
      expect(uow.listHouseholds(ctx())).toHaveLength(0);
    });

    it('throws if household does not exist', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1');
      const change = makeDeleteChange(h);
      expect(() => uow.commitHouseholdDelete(ctx(), 'hh-1', change)).toThrow('Household not found');
    });

    it('requires people.write capability', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const h = makeHousehold('hh-1');
      const change = makeDeleteChange(h);
      expect(() => uow.commitHouseholdDelete(ctx(TENANT_A, ['people.read']), 'hh-1', change)).toThrow('missing capability people.write');
    });

    it('stores audit and domain events atomically with delete', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const h = makeHousehold('hh-1');
      const change = makeDeleteChange(h);

      uow.commitHouseholdDelete(ctx(), 'hh-1', change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('delete');
      expect(audit[0].resourceId).toBe('hh-1');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('HouseholdDeleted');
    });

    it('rejects duplicate audit event id on delete', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const h = makeHousehold('hh-1');
      const change = makeDeleteChange(h);

      uow.commitHouseholdDelete(ctx(), 'hh-1', change);
      // Second delete should fail (already deleted + duplicate audit)
      // Re-seed for the duplicate audit test
      const uow2 = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1'), makeHousehold('hh-2')]);
      const change2 = makeDeleteChange(makeHousehold('hh-1'));
      const dupAuditChange: OrganizationDeletionChange = {
        auditEvent: change2.auditEvent, // reuse same audit id
        domainEvent: createDomainEvent({
          id: 'event-del-2',
          tenantId: TENANT_A,
          type: 'HouseholdDeleted',
          aggregateId: 'hh-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      uow2.commitHouseholdDelete(ctx(), 'hh-1', change2);
      expect(() => uow2.commitHouseholdDelete(ctx(), 'hh-2', dupAuditChange)).toThrow('Duplicate audit event id');
    });

    it('throws on cross-tenant audit event in delete', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const crossTenantAudit = createAuditEvent({
        id: 'audit-cross-del',
        tenantId: TENANT_B,
        resourceType: 'household',
        resourceId: 'hh-1',
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
          type: 'HouseholdDeleted',
          aggregateId: 'hh-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      expect(() => uow.commitHouseholdDelete(ctx(), 'hh-1', change)).toThrow('Cross-tenant access denied');
    });

    it('does not delete a household from another tenant', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1', TENANT_B)]);
      const h = makeHousehold('hh-1', TENANT_B);
      const change = makeDeleteChange(h);
      // Tenant A tries to delete hh-1 which belongs to Tenant B.
      // The cross-tenant audit/domain event check fires before the not-found check.
      expect(() => uow.commitHouseholdDelete(ctx(TENANT_A), 'hh-1', change)).toThrow('Cross-tenant access denied');
      expect(uow.findHouseholdById(ctx(TENANT_B), 'hh-1')).toBeDefined();
    });
  });

  // ---- Cross-tenant isolation (adversarial) ----

  describe('cross-tenant isolation', () => {
    it('listHouseholds never leaks data across tenants', () => {
      const hA = makeHousehold('hh-a', TENANT_A, 'Alpha');
      const hB = makeHousehold('hh-b', TENANT_B, 'Beta');
      const uow = new InMemoryHouseholdUnitOfWork([hA, hB]);

      const listA = uow.listHouseholds(ctx(TENANT_A));
      const listB = uow.listHouseholds(ctx(TENANT_B));

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0].id).toBe('hh-a');
      expect(listB[0].id).toBe('hh-b');
    });

    it('findHouseholdById never leaks across tenants', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1', TENANT_B)]);
      expect(uow.findHouseholdById(ctx(TENANT_A), 'hh-1')).toBeUndefined();
    });

    it('audit events are tenant-scoped', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const hA = makeHousehold('hh-a', TENANT_A);
      const hB = makeHousehold('hh-b', TENANT_B);

      uow.commitHouseholdCreate(ctx(TENANT_A), makeChange(hA, 'create'));
      uow.commitHouseholdCreate(ctx(TENANT_B), makeChange(hB, 'create'));

      const auditA = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      const auditB = uow.listAudit(ctx(TENANT_B, ['audit.read']));

      expect(auditA).toHaveLength(1);
      expect(auditB).toHaveLength(1);
      expect(auditA[0].resourceId).toBe('hh-a');
      expect(auditB[0].resourceId).toBe('hh-b');
    });

    it('outbox events are tenant-scoped', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const hA = makeHousehold('hh-a', TENANT_A);
      const hB = makeHousehold('hh-b', TENANT_B);

      uow.commitHouseholdCreate(ctx(TENANT_A), makeChange(hA, 'create'));
      uow.commitHouseholdCreate(ctx(TENANT_B), makeChange(hB, 'create'));

      const outboxA = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      const outboxB = uow.listOutbox(ctx(TENANT_B, ['tenant.manage']));

      expect(outboxA).toHaveLength(1);
      expect(outboxB).toHaveLength(1);
      expect(outboxA[0].aggregateId).toBe('hh-a');
      expect(outboxB[0].aggregateId).toBe('hh-b');
    });
  });

  // ---- listAudit / listOutbox ----

  describe('listAudit', () => {
    it('requires audit.read capability', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(() => uow.listAudit(ctx(TENANT_A, ['people.read']))).toThrow('missing capability audit.read');
    });

    it('returns frozen clones of audit events', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold();
      uow.commitHouseholdCreate(ctx(), makeChange(h, 'create'));

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(Object.isFrozen(audit[0])).toBe(true);
      // Frozen objects prevent mutation entirely — verify the store is independent
      const audit2 = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit2[0].resourceId).toBe('hh-1');
      expect(audit[0]).not.toBe(audit2[0]); // distinct clones each call
    });
  });

  describe('listOutbox', () => {
    it('requires tenant.manage capability', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      expect(() => uow.listOutbox(ctx(TENANT_A, ['people.read']))).toThrow('missing capability tenant.manage');
    });

    it('returns frozen clones of domain events', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold();
      uow.commitHouseholdCreate(ctx(), makeChange(h, 'create'));

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(Object.isFrozen(outbox[0])).toBe(true);
      // Frozen objects prevent mutation entirely — verify the store is independent
      const outbox2 = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox2[0].aggregateId).toBe('hh-1');
      expect(outbox[0]).not.toBe(outbox2[0]); // distinct clones each call
    });
  });

  // ---- Atomicity ----

  describe('atomicity', () => {
    it('duplicate audit id rolls back the whole create', () => {
      const uow = new InMemoryHouseholdUnitOfWork();
      const h = makeHousehold('hh-1');
      const change = makeChange(h, 'create');

      uow.commitHouseholdCreate(ctx(), change);

      // Try to create another household reusing the same audit id
      const h2 = makeHousehold('hh-2');
      const change2: HouseholdChange = {
        household: h2,
        auditEvent: change.auditEvent, // duplicate
        domainEvent: createDomainEvent({
          id: 'event-hh-2',
          tenantId: TENANT_A,
          type: 'HouseholdCreated',
          aggregateId: 'hh-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      expect(() => uow.commitHouseholdCreate(ctx(), change2)).toThrow('Duplicate audit event id');
      // hh-2 should NOT have been persisted
      expect(uow.findHouseholdById(ctx(), 'hh-2')).toBeUndefined();
      // hh-1 should still be there
      expect(uow.findHouseholdById(ctx(), 'hh-1')).toBeDefined();
    });

    it('duplicate event id rolls back the whole update', () => {
      const uow = new InMemoryHouseholdUnitOfWork([makeHousehold('hh-1')]);
      const change1 = makeChange(makeHousehold('hh-1', TENANT_A, 'V2'), 'update');
      uow.commitHouseholdUpdate(ctx(), change1);

      const change2: HouseholdChange = {
        household: makeHousehold('hh-1', TENANT_A, 'V3'),
        auditEvent: createAuditEvent({
          id: 'audit-hh-1-v3',
          tenantId: TENANT_A,
          resourceType: 'household',
          resourceId: 'hh-1',
          action: 'update',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:01:00Z',
          changedFields: ['name'],
        }),
        domainEvent: change1.domainEvent, // duplicate event id
      };

      expect(() => uow.commitHouseholdUpdate(ctx(), change2)).toThrow('Duplicate domain event id');
      // hh-1 should still be V2, not V3
      expect(uow.findHouseholdById(ctx(), 'hh-1')!.name).toBe('V2');
    });
  });
});
