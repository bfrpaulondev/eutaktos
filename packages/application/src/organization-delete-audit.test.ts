import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
  type Household,
  type ResponsibilityAssignment,
  type ServiceGroup,
} from '@eutaktos/domain';
import {
  OrganizationService,
  type HouseholdChange,
  type HouseholdUnitOfWork,
  type OrganizationDeletionChange,
  type ResponsibilityChange,
  type ResponsibilityUnitOfWork,
  type ServiceGroupChange,
  type ServiceGroupUnitOfWork,
} from './organization-service';
import type { ApplicationRuntime } from './people-service';

function runtime(): ApplicationRuntime {
  const counters = new Map<string, number>();
  return {
    now: () => '2026-08-20T13:00:00.000Z',
    nextId: scope => {
      const next = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, next);
      return `${scope}-${next}`;
    },
  };
}

function context(): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-a',
    actorId: 'elder-1',
    capabilities: ['people.write'],
  });
}

class DeleteHouseholdUow implements HouseholdUnitOfWork {
  household: Household | undefined = {
    id: 'h-1',
    tenantId: 'tenant-a',
    name: 'Família Silva',
    memberIds: ['p-1'],
  };
  deletion: OrganizationDeletionChange | undefined;

  listHouseholds(): readonly Household[] { return this.household ? [this.household] : []; }
  findHouseholdById(): Household | undefined { return this.household; }
  commitHouseholdCreate(_context: AccessContext, change: HouseholdChange): Household { return change.household; }
  commitHouseholdUpdate(_context: AccessContext, change: HouseholdChange): Household { return change.household; }
  commitHouseholdDelete(
    _context: AccessContext,
    _id: string,
    change: OrganizationDeletionChange,
  ): boolean {
    this.deletion = change;
    this.household = undefined;
    return true;
  }
}

class DeleteServiceGroupUow implements ServiceGroupUnitOfWork {
  serviceGroup: ServiceGroup | undefined = {
    id: 'g-1',
    tenantId: 'tenant-a',
    name: 'Grupo 1',
    memberIds: ['p-1'],
  };
  deletion: OrganizationDeletionChange | undefined;

  listServiceGroups(): readonly ServiceGroup[] { return this.serviceGroup ? [this.serviceGroup] : []; }
  findServiceGroupById(): ServiceGroup | undefined { return this.serviceGroup; }
  commitServiceGroupCreate(_context: AccessContext, change: ServiceGroupChange): ServiceGroup { return change.serviceGroup; }
  commitServiceGroupUpdate(_context: AccessContext, change: ServiceGroupChange): ServiceGroup { return change.serviceGroup; }
  commitServiceGroupDelete(
    _context: AccessContext,
    _id: string,
    change: OrganizationDeletionChange,
  ): boolean {
    this.deletion = change;
    this.serviceGroup = undefined;
    return true;
  }
}

class EmptyResponsibilityUow implements ResponsibilityUnitOfWork {
  listResponsibilities(): readonly ResponsibilityAssignment[] { return []; }
  findResponsibilityById(): ResponsibilityAssignment | undefined { return undefined; }
  commitResponsibilityCreate(_context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return change.responsibility;
  }
  commitResponsibilityUpdate(_context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return change.responsibility;
  }
}

describe('OrganizationService auditable deletes', () => {
  it('commits household deletion with immutable audit and privacy-minimized domain event metadata', () => {
    const households = new DeleteHouseholdUow();
    const groups = new DeleteServiceGroupUow();
    const service = new OrganizationService(households, groups, new EmptyResponsibilityUow(), runtime());

    expect(service.deleteHousehold(context(), 'h-1', { correlationId: 'req-delete-household' })).toBe(true);
    expect(households.deletion?.auditEvent).toMatchObject({
      tenantId: 'tenant-a',
      resourceType: 'household',
      resourceId: 'h-1',
      action: 'delete',
      actorId: 'elder-1',
    });
    expect(households.deletion?.domainEvent).toMatchObject({
      tenantId: 'tenant-a',
      type: 'HouseholdDeleted',
      aggregateId: 'h-1',
      actorId: 'elder-1',
      correlationId: 'req-delete-household',
    });
    expect(JSON.stringify(households.deletion)).not.toContain('Família Silva');
  });

  it('commits service-group deletion with audit and ServiceGroupDeleted event', () => {
    const households = new DeleteHouseholdUow();
    const groups = new DeleteServiceGroupUow();
    const service = new OrganizationService(households, groups, new EmptyResponsibilityUow(), runtime());

    expect(service.deleteServiceGroup(context(), 'g-1', { correlationId: 'req-delete-group' })).toBe(true);
    expect(groups.deletion?.auditEvent).toMatchObject({
      tenantId: 'tenant-a',
      resourceType: 'service-group',
      resourceId: 'g-1',
      action: 'delete',
      actorId: 'elder-1',
    });
    expect(groups.deletion?.domainEvent).toMatchObject({
      tenantId: 'tenant-a',
      type: 'ServiceGroupDeleted',
      aggregateId: 'g-1',
      correlationId: 'req-delete-group',
    });
    expect(JSON.stringify(groups.deletion)).not.toContain('Grupo 1');
  });
});
