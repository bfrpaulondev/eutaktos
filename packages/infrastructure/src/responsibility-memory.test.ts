import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  createDomainEvent,
  validateResponsibilityAssignment,
  type ResponsibilityAssignment,
} from '@eutaktos/domain';
import { InMemoryResponsibilityUnitOfWork } from './responsibility-memory';
import type { ResponsibilityChange } from '@eutaktos/application';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ACTOR = 'actor-1';

function ctx(
  tenantId = TENANT_A,
  capabilities: readonly string[] = ['responsibilities.read', 'responsibilities.write'],
) {
  return createAccessContext({ tenantId, actorId: ACTOR, capabilities: capabilities as any });
}

function makeResponsibility(
  id = 'resp-1',
  tenantId = TENANT_A,
  overrides: Partial<ResponsibilityAssignment> = {},
): ResponsibilityAssignment {
  return validateResponsibilityAssignment({
    id,
    tenantId,
    personId: 'p-1',
    responsibilityKey: 'cleaning',
    startsAt: '2025-01-01T00:00:00Z',
    assignedBy: ACTOR,
    assignedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  });
}

function makeChange(
  responsibility: ResponsibilityAssignment,
  action: 'create' | 'update' = 'create',
): ResponsibilityChange {
  const auditEvent = createAuditEvent({
    id: `audit-${responsibility.id}`,
    tenantId: responsibility.tenantId,
    resourceType: 'responsibility',
    resourceId: responsibility.id,
    action,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    changedFields: action === 'create' ? ['personId', 'responsibilityKey', 'startsAt'] : ['endsAt'],
  });

  const domainEvent = createDomainEvent({
    id: `event-${responsibility.id}`,
    tenantId: responsibility.tenantId,
    type: 'ResponsibilityChanged',
    aggregateId: responsibility.id,
    actorId: ACTOR,
    occurredAt: '2025-01-01T00:00:00Z',
    schemaVersion: 1,
  });

  return { responsibility, auditEvent, domainEvent };
}

// ---- Tests ----

describe('InMemoryResponsibilityUnitOfWork', () => {
  // ---- Constructor / Seed ----

  describe('constructor', () => {
    it('accepts empty seed', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(uow.listResponsibilities(ctx())).toEqual([]);
    });

    it('seeds responsibilities', () => {
      const r1 = makeResponsibility('resp-1');
      const r2 = makeResponsibility('resp-2', TENANT_A, { personId: 'p-2', responsibilityKey: 'sound' });
      const uow = new InMemoryResponsibilityUnitOfWork([r1, r2]);
      expect(uow.listResponsibilities(ctx())).toHaveLength(2);
    });

    it('rejects duplicate tenant+id in seed', () => {
      const r = makeResponsibility('resp-1');
      expect(() => new InMemoryResponsibilityUnitOfWork([r, r])).toThrow('Duplicate tenant responsibility id');
    });

    it('isolates seed data from caller', () => {
      const original = makeResponsibility();
      const uow = new InMemoryResponsibilityUnitOfWork([original]);
      // Mutate original — should not affect the UoW
      (original as any).responsibilityKey = 'MUTATED';
      const found = uow.findResponsibilityById(ctx(), 'resp-1');
      expect(found!.responsibilityKey).toBe('cleaning');
    });
  });

  // ---- listResponsibilities ----

  describe('listResponsibilities', () => {
    it('returns only tenant-scoped responsibilities', () => {
      const rA = makeResponsibility('resp-a', TENANT_A);
      const rB = makeResponsibility('resp-b', TENANT_B);
      const uow = new InMemoryResponsibilityUnitOfWork([rA, rB]);
      expect(uow.listResponsibilities(ctx(TENANT_A))).toEqual([expect.objectContaining({ id: 'resp-a' })]);
      expect(uow.listResponsibilities(ctx(TENANT_B))).toEqual([expect.objectContaining({ id: 'resp-b' })]);
    });

    it('requires responsibilities.read capability', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(() => uow.listResponsibilities(ctx(TENANT_A, ['responsibilities.write']))).toThrow('missing capability responsibilities.read');
    });

    it('returns defensive clones', () => {
      const r = makeResponsibility();
      const uow = new InMemoryResponsibilityUnitOfWork([r]);
      const list = uow.listResponsibilities(ctx());
      expect(list[0]).not.toBe(r);
      expect(list[0]).toEqual(r);
      // Mutating a returned item should not affect the store
      (list[0] as any).responsibilityKey = 'MUTATED';
      expect(uow.findResponsibilityById(ctx(), 'resp-1')!.responsibilityKey).toBe('cleaning');
    });

    it('returns empty array for tenant with no responsibilities', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1', TENANT_A)]);
      expect(uow.listResponsibilities(ctx(TENANT_B))).toEqual([]);
    });
  });

  // ---- findResponsibilityById ----

  describe('findResponsibilityById', () => {
    it('finds a responsibility by id within the tenant', () => {
      const r = makeResponsibility('resp-1', TENANT_A);
      const uow = new InMemoryResponsibilityUnitOfWork([r]);
      const found = uow.findResponsibilityById(ctx(TENANT_A), 'resp-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('resp-1');
      expect(found!.responsibilityKey).toBe('cleaning');
    });

    it('returns undefined for non-existent id', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(uow.findResponsibilityById(ctx(), 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for id that belongs to another tenant', () => {
      const r = makeResponsibility('resp-1', TENANT_B);
      const uow = new InMemoryResponsibilityUnitOfWork([r]);
      expect(uow.findResponsibilityById(ctx(TENANT_A), 'resp-1')).toBeUndefined();
    });

    it('requires responsibilities.read capability', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(() => uow.findResponsibilityById(ctx(TENANT_A, ['responsibilities.write']), 'resp-1')).toThrow('missing capability responsibilities.read');
    });

    it('returns a defensive clone', () => {
      const r = makeResponsibility();
      const uow = new InMemoryResponsibilityUnitOfWork([r]);
      const found = uow.findResponsibilityById(ctx(), 'resp-1');
      expect(found).not.toBe(r);
      (found as any).responsibilityKey = 'MUTATED';
      expect(uow.findResponsibilityById(ctx(), 'resp-1')!.responsibilityKey).toBe('cleaning');
    });
  });

  // ---- commitResponsibilityCreate ----

  describe('commitResponsibilityCreate', () => {
    it('stores a new responsibility and returns a clone', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1');
      const change = makeChange(r, 'create');
      const result = uow.commitResponsibilityCreate(ctx(), change);

      expect(result.id).toBe('resp-1');
      expect(result).not.toBe(r);
      expect(uow.listResponsibilities(ctx())).toHaveLength(1);
    });

    it('stores audit and domain events atomically', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1');
      const change = makeChange(r, 'create');

      uow.commitResponsibilityCreate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceId).toBe('resp-1');
      expect(audit[0].action).toBe('create');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('ResponsibilityChanged');
    });

    it('rejects duplicate responsibility id within same tenant', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1')]);
      const r2 = makeResponsibility('resp-1');
      const change = makeChange(r2, 'create');
      expect(() => uow.commitResponsibilityCreate(ctx(), change)).toThrow('Responsibility already exists');
    });

    it('rejects duplicate audit event id', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r1 = makeResponsibility('resp-1');
      const r2 = makeResponsibility('resp-2');
      const change1 = makeChange(r1, 'create');
      const change2: ResponsibilityChange = {
        responsibility: r2,
        auditEvent: change1.auditEvent, // same audit id
        domainEvent: createDomainEvent({
          id: 'event-resp-2',
          tenantId: TENANT_A,
          type: 'ResponsibilityChanged',
          aggregateId: 'resp-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      uow.commitResponsibilityCreate(ctx(), change1);
      expect(() => uow.commitResponsibilityCreate(ctx(), change2)).toThrow('Duplicate audit event id');
    });

    it('rejects duplicate domain event id', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r1 = makeResponsibility('resp-1');
      const r2 = makeResponsibility('resp-2');
      const change1 = makeChange(r1, 'create');
      const change2: ResponsibilityChange = {
        responsibility: r2,
        auditEvent: createAuditEvent({
          id: 'audit-resp-2',
          tenantId: TENANT_A,
          resourceType: 'responsibility',
          resourceId: 'resp-2',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['personId', 'responsibilityKey', 'startsAt'],
        }),
        domainEvent: change1.domainEvent, // same event id
      };

      uow.commitResponsibilityCreate(ctx(), change1);
      expect(() => uow.commitResponsibilityCreate(ctx(), change2)).toThrow('Duplicate domain event id');
    });

    it('throws on cross-tenant responsibility', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1', TENANT_B);
      const change = makeChange(r, 'create');
      expect(() => uow.commitResponsibilityCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant audit event', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1', TENANT_A);
      const crossTenantAudit = createAuditEvent({
        id: 'audit-cross',
        tenantId: TENANT_B,
        resourceType: 'responsibility',
        resourceId: 'resp-1',
        action: 'create',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        changedFields: ['personId'],
      });
      const change: ResponsibilityChange = {
        responsibility: r,
        auditEvent: crossTenantAudit,
        domainEvent: createDomainEvent({
          id: 'event-resp-1',
          tenantId: TENANT_A,
          type: 'ResponsibilityChanged',
          aggregateId: 'resp-1',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };
      expect(() => uow.commitResponsibilityCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('throws on cross-tenant domain event', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1', TENANT_A);
      const crossTenantEvent = createDomainEvent({
        id: 'event-cross',
        tenantId: TENANT_B,
        type: 'ResponsibilityChanged',
        aggregateId: 'resp-1',
        actorId: ACTOR,
        occurredAt: '2025-01-01T00:00:00Z',
        schemaVersion: 1,
      });
      const change: ResponsibilityChange = {
        responsibility: r,
        auditEvent: createAuditEvent({
          id: 'audit-resp-1',
          tenantId: TENANT_A,
          resourceType: 'responsibility',
          resourceId: 'resp-1',
          action: 'create',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          changedFields: ['personId'],
        }),
        domainEvent: crossTenantEvent,
      };
      expect(() => uow.commitResponsibilityCreate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });

    it('allows same responsibility id in different tenants', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const rA = makeResponsibility('resp-1', TENANT_A);
      const rB = makeResponsibility('resp-1', TENANT_B);

      uow.commitResponsibilityCreate(ctx(TENANT_A), makeChange(rA, 'create'));
      uow.commitResponsibilityCreate(ctx(TENANT_B), makeChange(rB, 'create'));

      expect(uow.listResponsibilities(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listResponsibilities(ctx(TENANT_B))).toHaveLength(1);
    });
  });

  // ---- commitResponsibilityUpdate ----

  describe('commitResponsibilityUpdate', () => {
    it('updates an existing responsibility (end responsibility)', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1')]);
      const updated = makeResponsibility('resp-1', TENANT_A, { endsAt: '2025-06-01T00:00:00Z' });
      const change = makeChange(updated, 'update');
      const result = uow.commitResponsibilityUpdate(ctx(), change);

      expect(result.endsAt).toBe('2025-06-01T00:00:00Z');
      expect(uow.findResponsibilityById(ctx(), 'resp-1')!.endsAt).toBe('2025-06-01T00:00:00Z');
    });

    it('throws if responsibility does not exist', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1');
      const change = makeChange(r, 'update');
      expect(() => uow.commitResponsibilityUpdate(ctx(), change)).toThrow('Responsibility not found');
    });

    it('stores audit and domain events for update', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1')]);
      const updated = makeResponsibility('resp-1', TENANT_A, { endsAt: '2025-06-01T00:00:00Z' });
      const change = makeChange(updated, 'update');

      uow.commitResponsibilityUpdate(ctx(), change);

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].action).toBe('update');

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('ResponsibilityChanged');
    });

    it('returns defensive clone', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1')]);
      const updated = makeResponsibility('resp-1', TENANT_A, { endsAt: '2025-06-01T00:00:00Z' });
      const change = makeChange(updated, 'update');
      const result = uow.commitResponsibilityUpdate(ctx(), change);
      expect(result).not.toBe(updated);
      (result as any).endsAt = 'MUTATED';
      expect(uow.findResponsibilityById(ctx(), 'resp-1')!.endsAt).toBe('2025-06-01T00:00:00Z');
    });

    it('throws on cross-tenant responsibility in update', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1', TENANT_B);
      const change = makeChange(r, 'update');
      expect(() => uow.commitResponsibilityUpdate(ctx(TENANT_A), change)).toThrow('Cross-tenant access denied');
    });
  });

  // ---- Cross-tenant isolation (adversarial) ----

  describe('cross-tenant isolation', () => {
    it('listResponsibilities never leaks data across tenants', () => {
      const rA = makeResponsibility('resp-a', TENANT_A, { responsibilityKey: 'cleaning' });
      const rB = makeResponsibility('resp-b', TENANT_B, { responsibilityKey: 'sound' });
      const uow = new InMemoryResponsibilityUnitOfWork([rA, rB]);

      const listA = uow.listResponsibilities(ctx(TENANT_A));
      const listB = uow.listResponsibilities(ctx(TENANT_B));

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0].id).toBe('resp-a');
      expect(listB[0].id).toBe('resp-b');
    });

    it('findResponsibilityById never leaks across tenants', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1', TENANT_B)]);
      expect(uow.findResponsibilityById(ctx(TENANT_A), 'resp-1')).toBeUndefined();
    });

    it('audit events are tenant-scoped', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const rA = makeResponsibility('resp-a', TENANT_A);
      const rB = makeResponsibility('resp-b', TENANT_B);

      uow.commitResponsibilityCreate(ctx(TENANT_A), makeChange(rA, 'create'));
      uow.commitResponsibilityCreate(ctx(TENANT_B), makeChange(rB, 'create'));

      const auditA = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      const auditB = uow.listAudit(ctx(TENANT_B, ['audit.read']));

      expect(auditA).toHaveLength(1);
      expect(auditB).toHaveLength(1);
      expect(auditA[0].resourceId).toBe('resp-a');
      expect(auditB[0].resourceId).toBe('resp-b');
    });

    it('outbox events are tenant-scoped', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const rA = makeResponsibility('resp-a', TENANT_A);
      const rB = makeResponsibility('resp-b', TENANT_B);

      uow.commitResponsibilityCreate(ctx(TENANT_A), makeChange(rA, 'create'));
      uow.commitResponsibilityCreate(ctx(TENANT_B), makeChange(rB, 'create'));

      const outboxA = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      const outboxB = uow.listOutbox(ctx(TENANT_B, ['tenant.manage']));

      expect(outboxA).toHaveLength(1);
      expect(outboxB).toHaveLength(1);
      expect(outboxA[0].aggregateId).toBe('resp-a');
      expect(outboxB[0].aggregateId).toBe('resp-b');
    });
  });

  // ---- listAudit / listOutbox ----

  describe('listAudit', () => {
    it('requires audit.read capability', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(() => uow.listAudit(ctx(TENANT_A, ['responsibilities.read']))).toThrow('missing capability audit.read');
    });

    it('returns frozen clones of audit events', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility();
      uow.commitResponsibilityCreate(ctx(), makeChange(r, 'create'));

      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(Object.isFrozen(audit[0])).toBe(true);
      const audit2 = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit2[0].resourceId).toBe('resp-1');
      expect(audit[0]).not.toBe(audit2[0]);
    });
  });

  describe('listOutbox', () => {
    it('requires tenant.manage capability', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      expect(() => uow.listOutbox(ctx(TENANT_A, ['responsibilities.read']))).toThrow('missing capability tenant.manage');
    });

    it('returns frozen clones of domain events', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility();
      uow.commitResponsibilityCreate(ctx(), makeChange(r, 'create'));

      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(Object.isFrozen(outbox[0])).toBe(true);
      const outbox2 = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox2[0].aggregateId).toBe('resp-1');
      expect(outbox[0]).not.toBe(outbox2[0]);
    });
  });

  // ---- Atomicity ----

  describe('atomicity', () => {
    it('duplicate audit id rolls back the whole create', () => {
      const uow = new InMemoryResponsibilityUnitOfWork();
      const r = makeResponsibility('resp-1');
      const change = makeChange(r, 'create');

      uow.commitResponsibilityCreate(ctx(), change);

      const r2 = makeResponsibility('resp-2');
      const change2: ResponsibilityChange = {
        responsibility: r2,
        auditEvent: change.auditEvent, // duplicate
        domainEvent: createDomainEvent({
          id: 'event-resp-2',
          tenantId: TENANT_A,
          type: 'ResponsibilityChanged',
          aggregateId: 'resp-2',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:00:00Z',
          schemaVersion: 1,
        }),
      };

      expect(() => uow.commitResponsibilityCreate(ctx(), change2)).toThrow('Duplicate audit event id');
      expect(uow.findResponsibilityById(ctx(), 'resp-2')).toBeUndefined();
      expect(uow.findResponsibilityById(ctx(), 'resp-1')).toBeDefined();
    });

    it('duplicate event id rolls back the whole update', () => {
      const uow = new InMemoryResponsibilityUnitOfWork([makeResponsibility('resp-1')]);
      const change1 = makeChange(makeResponsibility('resp-1', TENANT_A, { endsAt: '2025-06-01T00:00:00Z' }), 'update');
      uow.commitResponsibilityUpdate(ctx(), change1);

      const change2: ResponsibilityChange = {
        responsibility: makeResponsibility('resp-1', TENANT_A, { endsAt: '2025-07-01T00:00:00Z' }),
        auditEvent: createAuditEvent({
          id: 'audit-resp-1-v3',
          tenantId: TENANT_A,
          resourceType: 'responsibility',
          resourceId: 'resp-1',
          action: 'update',
          actorId: ACTOR,
          occurredAt: '2025-01-01T00:01:00Z',
          changedFields: ['endsAt'],
        }),
        domainEvent: change1.domainEvent, // duplicate event id
      };

      expect(() => uow.commitResponsibilityUpdate(ctx(), change2)).toThrow('Duplicate domain event id');
      // Should still have the first update's endsAt
      expect(uow.findResponsibilityById(ctx(), 'resp-1')!.endsAt).toBe('2025-06-01T00:00:00Z');
    });
  });
});
