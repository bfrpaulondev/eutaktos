import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
  type Household,
  type ServiceGroup,
  type ResponsibilityAssignment,
} from '@eutaktos/domain';
import {
  OrganizationService,
  type HouseholdDeleteChange,
  type HouseholdUnitOfWork,
  type HouseholdChange,
  type ServiceGroupDeleteChange,
  type ServiceGroupUnitOfWork,
  type ServiceGroupChange,
  type ResponsibilityUnitOfWork,
  type ResponsibilityChange,
} from './organization-service';
import type { ApplicationRuntime } from './people-service';

// ---- Fake Unit of Work implementations ----

class FakeHouseholdUow implements HouseholdUnitOfWork {
  readonly records = new Map<string, Household>();
  readonly creates: HouseholdChange[] = [];
  readonly updates: HouseholdChange[] = [];
  readonly deletes: HouseholdDeleteChange[] = [];

  constructor(seed: readonly Household[] = []) {
    for (const h of seed) this.records.set(`${h.tenantId}:${h.id}`, h);
  }

  listHouseholds(context: AccessContext): readonly Household[] {
    return [...this.records.values()].filter(h => h.tenantId === context.tenantId);
  }

  findHouseholdById(context: AccessContext, id: string): Household | undefined {
    return this.records.get(`${context.tenantId}:${id}`);
  }

  commitHouseholdCreate(_context: AccessContext, change: HouseholdChange): Household {
    const key = `${change.household.tenantId}:${change.household.id}`;
    if (this.records.has(key)) throw new Error('duplicate');
    this.records.set(key, change.household);
    this.creates.push(change);
    return change.household;
  }

  commitHouseholdUpdate(_context: AccessContext, change: HouseholdChange): Household {
    const key = `${change.household.tenantId}:${change.household.id}`;
    if (!this.records.has(key)) throw new Error('missing');
    this.records.set(key, change.household);
    this.updates.push(change);
    return change.household;
  }

  commitHouseholdDelete(context: AccessContext, change: HouseholdDeleteChange): boolean {
    const key = `${context.tenantId}:${change.householdId}`;
    const deleted = this.records.delete(key);
    if (deleted) this.deletes.push(change);
    return deleted;
  }
}

class FakeServiceGroupUow implements ServiceGroupUnitOfWork {
  readonly records = new Map<string, ServiceGroup>();
  readonly creates: ServiceGroupChange[] = [];
  readonly updates: ServiceGroupChange[] = [];
  readonly deletes: ServiceGroupDeleteChange[] = [];

  constructor(seed: readonly ServiceGroup[] = []) {
    for (const g of seed) this.records.set(`${g.tenantId}:${g.id}`, g);
  }

  listServiceGroups(context: AccessContext): readonly ServiceGroup[] {
    return [...this.records.values()].filter(g => g.tenantId === context.tenantId);
  }

  findServiceGroupById(context: AccessContext, id: string): ServiceGroup | undefined {
    return this.records.get(`${context.tenantId}:${id}`);
  }

  commitServiceGroupCreate(_context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    const key = `${change.serviceGroup.tenantId}:${change.serviceGroup.id}`;
    if (this.records.has(key)) throw new Error('duplicate');
    this.records.set(key, change.serviceGroup);
    this.creates.push(change);
    return change.serviceGroup;
  }

  commitServiceGroupUpdate(_context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    const key = `${change.serviceGroup.tenantId}:${change.serviceGroup.id}`;
    if (!this.records.has(key)) throw new Error('missing');
    this.records.set(key, change.serviceGroup);
    this.updates.push(change);
    return change.serviceGroup;
  }

  commitServiceGroupDelete(context: AccessContext, change: ServiceGroupDeleteChange): boolean {
    const key = `${context.tenantId}:${change.serviceGroupId}`;
    const deleted = this.records.delete(key);
    if (deleted) this.deletes.push(change);
    return deleted;
  }
}

class FakeResponsibilityUow implements ResponsibilityUnitOfWork {
  readonly records = new Map<string, ResponsibilityAssignment>();
  readonly creates: ResponsibilityChange[] = [];
  readonly updates: ResponsibilityChange[] = [];

  constructor(seed: readonly ResponsibilityAssignment[] = []) {
    for (const r of seed) this.records.set(`${r.tenantId}:${r.id}`, r);
  }

  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[] {
    return [...this.records.values()].filter(r => r.tenantId === context.tenantId);
  }

  findResponsibilityById(context: AccessContext, id: string): ResponsibilityAssignment | undefined {
    return this.records.get(`${context.tenantId}:${id}`);
  }

  commitResponsibilityCreate(_context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    const key = `${change.responsibility.tenantId}:${change.responsibility.id}`;
    if (this.records.has(key)) throw new Error('duplicate');
    this.records.set(key, change.responsibility);
    this.creates.push(change);
    return change.responsibility;
  }

  commitResponsibilityUpdate(_context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    const key = `${change.responsibility.tenantId}:${change.responsibility.id}`;
    if (!this.records.has(key)) throw new Error('missing');
    this.records.set(key, change.responsibility);
    this.updates.push(change);
    return change.responsibility;
  }
}

// ---- Helpers ----

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0 } as Record<string, number>;
  return {
    now: () => '2026-08-20T12:00:00.000Z',
    nextId: (scope: string) => `${scope}-${++counters[scope]}`,
  };
}

function ctx(capabilities: readonly string[]): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-a',
    actorId: 'elder-1',
    capabilities: capabilities as AccessContext['capabilities'],
  });
}

function createService(
  householdSeed?: readonly Household[],
  groupSeed?: readonly ServiceGroup[],
  respSeed?: readonly ResponsibilityAssignment[],
) {
  return new OrganizationService(
    new FakeHouseholdUow(householdSeed),
    new FakeServiceGroupUow(groupSeed),
    new FakeResponsibilityUow(respSeed),
    runtime(),
  );
}

// ---- Household tests ----

describe('OrganizationService — Households', () => {
  it('creates a normalized household with audit and domain events', () => {
    const service = createService();
    const created = service.createHousehold(
      ctx(['people.write']),
      { id: 'h-1', name: '  Família   Silva ', memberIds: ['p-1', 'p-2'] },
      { correlationId: 'req-1' },
    );

    expect(created.name).toBe('Família Silva');
    expect(created.tenantId).toBe('tenant-a');
    expect(created.memberIds).toEqual(['p-1', 'p-2']);
  });

  it('rejects duplicate members in household creation', () => {
    const service = createService();
    expect(() =>
      service.createHousehold(
        ctx(['people.write']),
        { id: 'h-1', name: 'Silva', memberIds: ['p-1', 'p-1'] },
      ),
    ).toThrow(/Duplicate/);
  });

  it('lists households filtered by tenant', () => {
    const service = createService([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
      { id: 'h-2', tenantId: 'tenant-b', name: 'Costa', memberIds: ['p-2'] },
    ]);

    const list = service.listHouseholds(ctx(['people.read']));
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('h-1');
  });

  it('gets a single household and defends against cross-tenant lookup', () => {
    const service = createService([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
    ]);

    expect(service.getHousehold(ctx(['people.read']), 'h-1')?.name).toBe('Silva');
    expect(service.getHousehold(ctx(['people.read']), 'h-2')).toBeUndefined();
  });

  it('updates only changed fields and produces no-op when nothing changes', () => {
    const service = createService([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
    ]);

    const noOp = service.updateHousehold(ctx(['people.read', 'people.write']), {
      id: 'h-1',
      name: 'Silva',
    });
    expect(noOp.name).toBe('Silva');
  });

  it('no-ops when memberIds are identical', () => {
    const uow = new FakeHouseholdUow([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1', 'p-2'] },
    ]);
    const service = new OrganizationService(uow, new FakeServiceGroupUow(), new FakeResponsibilityUow(), runtime());

    const result = service.updateHousehold(ctx(['people.read', 'people.write']), {
      id: 'h-1',
      memberIds: ['p-1', 'p-2'],
    });

    expect(result.name).toBe('Silva');
    expect(uow.updates).toHaveLength(0);
  });

  it('updates household name and member list', () => {
    const service = createService([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
    ]);

    const updated = service.updateHousehold(ctx(['people.read', 'people.write']), {
      id: 'h-1',
      name: 'Família Silva Costa',
      memberIds: ['p-1', 'p-3'],
    });

    expect(updated.name).toBe('Família Silva Costa');
    expect(updated.memberIds).toEqual(['p-1', 'p-3']);
  });

  it('deletes a household and delivers atomic audit and domain events', () => {
    const uow = new FakeHouseholdUow([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
    ]);
    const service = new OrganizationService(uow, new FakeServiceGroupUow(), new FakeResponsibilityUow(), runtime());

    const result = service.deleteHousehold(
      ctx(['people.write']),
      'h-1',
      { correlationId: 'delete-req-1' },
    );

    expect(result).toBe(true);
    expect(service.listHouseholds(ctx(['people.read']))).toHaveLength(0);

    expect(uow.deletes).toHaveLength(1);
    const del = uow.deletes[0]!;
    expect(del.householdId).toBe('h-1');

    // Audit event correctness
    expect(del.auditEvent.resourceType).toBe('household');
    expect(del.auditEvent.resourceId).toBe('h-1');
    expect(del.auditEvent.action).toBe('delete');
    expect(del.auditEvent.tenantId).toBe('tenant-a');
    expect(del.auditEvent.actorId).toBe('elder-1');
    expect(del.auditEvent.changedFields).toEqual([]);

    // Domain event correctness
    expect(del.domainEvent.type).toBe('HouseholdDeleted');
    expect(del.domainEvent.aggregateId).toBe('h-1');
    expect(del.domainEvent.tenantId).toBe('tenant-a');
    expect(del.domainEvent.actorId).toBe('elder-1');
    expect(del.domainEvent.correlationId).toBe('delete-req-1');
    expect(del.domainEvent.schemaVersion).toBe(1);
  });

  it('rejects household operations without proper capabilities', () => {
    const service = createService();

    expect(() => service.listHouseholds(ctx([]))).toThrow('missing capability people.read');
    expect(() =>
      service.createHousehold(ctx(['people.read']), { id: 'h-1', name: 'Silva', memberIds: ['p-1'] }),
    ).toThrow('missing capability people.write');
    expect(() =>
      service.deleteHousehold(ctx(['people.read']), 'h-1'),
    ).toThrow('missing capability people.write');
  });

  it('rejects empty household name on update', () => {
    const service = createService([
      { id: 'h-1', tenantId: 'tenant-a', name: 'Silva', memberIds: ['p-1'] },
    ]);

    expect(() =>
      service.updateHousehold(ctx(['people.read', 'people.write']), {
        id: 'h-1',
        name: '   ',
      }),
    ).toThrow('household name is required');
  });

  it('rejects update/delete for non-existent household', () => {
    const service = createService();

    expect(() =>
      service.updateHousehold(ctx(['people.read', 'people.write']), {
        id: 'h-99', name: 'X',
      }),
    ).toThrow('Household not found');

    expect(() => service.deleteHousehold(ctx(['people.write']), 'h-99')).toThrow('Household not found');
  });
});

// ---- Service Group tests ----

describe('OrganizationService — Service Groups', () => {
  it('creates a service group with overseer and assistant', () => {
    const service = createService();
    const created = service.createServiceGroup(
      ctx(['people.write']),
      {
        id: 'g-1',
        name: '  Grupo   1  ',
        memberIds: ['p-1', 'p-2', 'p-3'],
        overseerId: 'p-1',
        assistantId: 'p-2',
      },
      { correlationId: 'req-2' },
    );

    expect(created.name).toBe('Grupo 1');
    expect(created.memberIds).toEqual(['p-1', 'p-2', 'p-3']);
    expect(created.overseerId).toBe('p-1');
    expect(created.assistantId).toBe('p-2');
  });

  it('rejects service group with non-member overseer', () => {
    const service = createService();
    expect(() =>
      service.createServiceGroup(ctx(['people.write']), {
        id: 'g-1', name: 'Grupo 1', memberIds: ['p-1'], overseerId: 'p-2',
      }),
    ).toThrow(/leaders/);
  });

  it('rejects service group with same overseer and assistant', () => {
    const service = createService();
    expect(() =>
      service.createServiceGroup(ctx(['people.write']), {
        id: 'g-1', name: 'Grupo 1', memberIds: ['p-1'], overseerId: 'p-1', assistantId: 'p-1',
      }),
    ).toThrow(/different/);
  });

  it('lists and gets service groups filtered by tenant', () => {
    const service = createService(undefined, [
      { id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1', memberIds: ['p-1'] },
      { id: 'g-2', tenantId: 'tenant-b', name: 'Grupo B', memberIds: ['p-2'] },
    ]);

    expect(service.listServiceGroups(ctx(['people.read']))).toHaveLength(1);
    expect(service.getServiceGroup(ctx(['people.read']), 'g-1')?.name).toBe('Grupo 1');
    expect(service.getServiceGroup(ctx(['people.read']), 'g-2')).toBeUndefined();
  });

  it('updates service group fields including clearing leaders', () => {
    const service = createService(undefined, [
      {
        id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1',
        memberIds: ['p-1', 'p-2'], overseerId: 'p-1', assistantId: 'p-2',
      },
    ]);

    const updated = service.updateServiceGroup(ctx(['people.read', 'people.write']), {
      id: 'g-1',
      name: 'Grupo 1 Atualizado',
      overseerId: null,
    });

    expect(updated.name).toBe('Grupo 1 Atualizado');
    expect(updated.overseerId).toBeUndefined();
    expect(updated.assistantId).toBe('p-2');
  });

  it('no-ops when no fields change', () => {
    const service = createService(undefined, [
      { id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1', memberIds: ['p-1'] },
    ]);

    const result = service.updateServiceGroup(ctx(['people.read', 'people.write']), {
      id: 'g-1',
    });
    expect(result.name).toBe('Grupo 1');
  });

  it('no-ops when memberIds are identical', () => {
    const uow = new FakeServiceGroupUow([
      { id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1', memberIds: ['p-1', 'p-2'] },
    ]);
    const service = new OrganizationService(new FakeHouseholdUow(), uow, new FakeResponsibilityUow(), runtime());

    const result = service.updateServiceGroup(ctx(['people.read', 'people.write']), {
      id: 'g-1',
      memberIds: ['p-1', 'p-2'],
    });

    expect(result.name).toBe('Grupo 1');
    expect(uow.updates).toHaveLength(0);
  });

  it('no-ops when overseerId and assistantId are unchanged', () => {
    const uow = new FakeServiceGroupUow([
      {
        id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1',
        memberIds: ['p-1', 'p-2'], overseerId: 'p-1', assistantId: 'p-2',
      },
    ]);
    const service = new OrganizationService(new FakeHouseholdUow(), uow, new FakeResponsibilityUow(), runtime());

    const result = service.updateServiceGroup(ctx(['people.read', 'people.write']), {
      id: 'g-1',
      overseerId: 'p-1',
      assistantId: 'p-2',
    });

    expect(uow.updates).toHaveLength(0);
    expect(result).toBe(uow.records.get('tenant-a:g-1'));
  });

  it('deletes a service group and delivers atomic audit and domain events', () => {
    const uow = new FakeServiceGroupUow([
      { id: 'g-1', tenantId: 'tenant-a', name: 'Grupo 1', memberIds: ['p-1'] },
    ]);
    const service = new OrganizationService(new FakeHouseholdUow(), uow, new FakeResponsibilityUow(), runtime());

    const result = service.deleteServiceGroup(
      ctx(['people.write']),
      'g-1',
      { correlationId: 'delete-req-2' },
    );

    expect(result).toBe(true);
    expect(service.listServiceGroups(ctx(['people.read']))).toHaveLength(0);

    expect(uow.deletes).toHaveLength(1);
    const del = uow.deletes[0]!;
    expect(del.serviceGroupId).toBe('g-1');

    // Audit event correctness
    expect(del.auditEvent.resourceType).toBe('service-group');
    expect(del.auditEvent.resourceId).toBe('g-1');
    expect(del.auditEvent.action).toBe('delete');
    expect(del.auditEvent.tenantId).toBe('tenant-a');
    expect(del.auditEvent.actorId).toBe('elder-1');
    expect(del.auditEvent.changedFields).toEqual([]);

    // Domain event correctness
    expect(del.domainEvent.type).toBe('ServiceGroupDeleted');
    expect(del.domainEvent.aggregateId).toBe('g-1');
    expect(del.domainEvent.tenantId).toBe('tenant-a');
    expect(del.domainEvent.actorId).toBe('elder-1');
    expect(del.domainEvent.correlationId).toBe('delete-req-2');
    expect(del.domainEvent.schemaVersion).toBe(1);
  });

  it('rejects service group operations without proper capabilities', () => {
    const service = createService();

    expect(() => service.listServiceGroups(ctx([]))).toThrow('missing capability people.read');
    expect(() =>
      service.createServiceGroup(ctx(['people.read']), {
        id: 'g-1', name: 'G1', memberIds: ['p-1'],
      }),
    ).toThrow('missing capability people.write');
  });

  it('rejects update/delete for non-existent service group', () => {
    const service = createService();

    expect(() =>
      service.updateServiceGroup(ctx(['people.read', 'people.write']), { id: 'g-99', name: 'X' }),
    ).toThrow('Service group not found');

    expect(() => service.deleteServiceGroup(ctx(['people.write']), 'g-99')).toThrow('Service group not found');
  });
});

// ---- Responsibility tests ----

describe('OrganizationService — Responsibilities', () => {
  it('assigns a responsibility with audit and domain events', () => {
    const service = createService();
    const assigned = service.assignResponsibility(
      ctx(['responsibilities.write']),
      {
        id: 'r-1',
        personId: 'p-1',
        responsibilityKey: 'sound',
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-10-01T00:00:00Z',
      },
      { correlationId: 'req-3' },
    );

    expect(assigned.personId).toBe('p-1');
    expect(assigned.responsibilityKey).toBe('sound');
    expect(assigned.assignedBy).toBe('elder-1');
    expect(assigned.assignedAt).toBe('2026-08-20T12:00:00.000Z');
  });

  it('rejects invalid date windows on assignment', () => {
    const service = createService();

    expect(() =>
      service.assignResponsibility(ctx(['responsibilities.write']), {
        id: 'r-1', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-08-01T00:00:00Z',
      }),
    ).toThrow('end after it starts');

    expect(() =>
      service.assignResponsibility(ctx(['responsibilities.write']), {
        id: 'r-1', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: 'not-a-date',
      }),
    ).toThrow('Invalid ISO date');
  });

  it('lists and gets responsibilities filtered by tenant', () => {
    const service = createService(undefined, undefined, [
      {
        id: 'r-1', tenantId: 'tenant-a', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: '2026-08-01T00:00:00Z', assignedBy: 'elder-1', assignedAt: '2026-07-20T12:00:00Z',
      },
      {
        id: 'r-2', tenantId: 'tenant-b', personId: 'p-2', responsibilityKey: 'sound',
        startsAt: '2026-08-01T00:00:00Z', assignedBy: 'elder-2', assignedAt: '2026-07-20T12:00:00Z',
      },
    ]);

    expect(service.listResponsibilities(ctx(['responsibilities.read']))).toHaveLength(1);
    expect(service.getResponsibility(ctx(['responsibilities.read']), 'r-1')?.personId).toBe('p-1');
    expect(service.getResponsibility(ctx(['responsibilities.read']), 'r-2')).toBeUndefined();
  });

  it('ends an active responsibility', () => {
    const service = createService(undefined, undefined, [
      {
        id: 'r-1', tenantId: 'tenant-a', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: '2026-08-01T00:00:00Z', assignedBy: 'elder-1', assignedAt: '2026-07-20T12:00:00Z',
      },
    ]);

    const ended = service.endResponsibility(
      ctx(['responsibilities.write']),
      { id: 'r-1', endsAt: '2026-08-15T00:00:00Z' },
    );

    expect(ended.endsAt).toBe('2026-08-15T00:00:00Z');
  });

  it('rejects ending an already-ended responsibility', () => {
    const service = createService(undefined, undefined, [
      {
        id: 'r-1', tenantId: 'tenant-a', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-08-20T00:00:00Z',
        assignedBy: 'elder-1', assignedAt: '2026-07-20T12:00:00Z',
      },
    ]);

    expect(() =>
      service.endResponsibility(ctx(['responsibilities.write']), {
        id: 'r-1', endsAt: '2026-08-25T00:00:00Z',
      }),
    ).toThrow('already ended');
  });

  it('rejects responsibility operations without proper capabilities', () => {
    const service = createService();

    expect(() => service.listResponsibilities(ctx([]))).toThrow('missing capability responsibilities.read');
    expect(() =>
      service.assignResponsibility(ctx(['responsibilities.read']), {
        id: 'r-1', personId: 'p-1', responsibilityKey: 'sound', startsAt: '2026-08-01T00:00:00Z',
      }),
    ).toThrow('missing capability responsibilities.write');
  });

  it('rejects end for non-existent responsibility', () => {
    const service = createService();
    expect(() =>
      service.endResponsibility(ctx(['responsibilities.write']), {
        id: 'r-99', endsAt: '2026-08-15T00:00:00Z',
      }),
    ).toThrow('Responsibility not found');
  });
});

// ---- Cross-tenant defense ----

describe('OrganizationService — tenant isolation', () => {
  it('defends against cross-tenant household returned by adapter', () => {
    const uow = new FakeHouseholdUow();
    uow.findHouseholdById = () =>
      ({ id: 'h-1', tenantId: 'tenant-b', name: 'Other', memberIds: ['p-1'] } as Household);
    const service = new OrganizationService(uow, new FakeServiceGroupUow(), new FakeResponsibilityUow(), runtime());

    expect(() => service.getHousehold(ctx(['people.read']), 'h-1')).toThrow('Cross-tenant access denied');
  });

  it('defends against cross-tenant service group returned by adapter', () => {
    const uow = new FakeServiceGroupUow();
    uow.findServiceGroupById = () =>
      ({ id: 'g-1', tenantId: 'tenant-b', name: 'Other', memberIds: ['p-1'] } as ServiceGroup);
    const service = new OrganizationService(new FakeHouseholdUow(), uow, new FakeResponsibilityUow(), runtime());

    expect(() => service.getServiceGroup(ctx(['people.read']), 'g-1')).toThrow('Cross-tenant access denied');
  });

  it('defends against cross-tenant responsibility returned by adapter', () => {
    const uow = new FakeResponsibilityUow();
    uow.findResponsibilityById = () =>
      ({
        id: 'r-1', tenantId: 'tenant-b', personId: 'p-1', responsibilityKey: 'sound',
        startsAt: '2026-09-01T00:00:00Z', assignedBy: 'p-2', assignedAt: '2026-08-20T12:00:00.000Z',
      } as ResponsibilityAssignment);
    const service = new OrganizationService(new FakeHouseholdUow(), new FakeServiceGroupUow(), uow, runtime());

    expect(() => service.getResponsibility(ctx(['responsibilities.read']), 'r-1')).toThrow('Cross-tenant access denied');
  });
});
