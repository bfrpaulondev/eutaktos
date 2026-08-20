import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  createHousehold,
  createServiceGroup,
  validateResponsibilityAssignment,
  type AccessContext,
  type AuditEvent,
  type DomainEvent,
  type Household,
  type HouseholdId,
  type PersonId,
  type ResponsibilityAssignment,
  type ResponsibilityId,
  type ServiceGroup,
  type ServiceGroupId,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type RequestMetadata,
} from './people-service';

// ---- Household ----

export interface CreateHouseholdInput {
  id: HouseholdId;
  name: string;
  memberIds: readonly PersonId[];
}

export interface UpdateHouseholdInput {
  id: HouseholdId;
  name?: string;
  memberIds?: readonly PersonId[];
}

export interface HouseholdChange {
  household: Household;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

export interface OrganizationDeletionChange {
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

export interface HouseholdUnitOfWork {
  listHouseholds(context: AccessContext): readonly Household[];
  findHouseholdById(context: AccessContext, id: HouseholdId): Household | undefined;
  commitHouseholdCreate(context: AccessContext, change: HouseholdChange): Household;
  commitHouseholdUpdate(context: AccessContext, change: HouseholdChange): Household;
  commitHouseholdDelete(
    context: AccessContext,
    id: HouseholdId,
    change: OrganizationDeletionChange,
  ): boolean;
}

// ---- Service Group ----

export interface CreateServiceGroupInput {
  id: ServiceGroupId;
  name: string;
  memberIds: readonly PersonId[];
  overseerId?: PersonId;
  assistantId?: PersonId;
}

export interface UpdateServiceGroupInput {
  id: ServiceGroupId;
  name?: string;
  memberIds?: readonly PersonId[];
  overseerId?: PersonId | null;
  assistantId?: PersonId | null;
}

export interface ServiceGroupChange {
  serviceGroup: ServiceGroup;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

export interface ServiceGroupUnitOfWork {
  listServiceGroups(context: AccessContext): readonly ServiceGroup[];
  findServiceGroupById(context: AccessContext, id: ServiceGroupId): ServiceGroup | undefined;
  commitServiceGroupCreate(context: AccessContext, change: ServiceGroupChange): ServiceGroup;
  commitServiceGroupUpdate(context: AccessContext, change: ServiceGroupChange): ServiceGroup;
  commitServiceGroupDelete(
    context: AccessContext,
    id: ServiceGroupId,
    change: OrganizationDeletionChange,
  ): boolean;
}

// ---- Responsibility ----

export interface AssignResponsibilityInput {
  id: ResponsibilityId;
  personId: PersonId;
  responsibilityKey: string;
  startsAt: string;
  endsAt?: string;
}

export interface EndResponsibilityInput {
  id: ResponsibilityId;
  endsAt: string;
}

export interface ResponsibilityChange {
  responsibility: ResponsibilityAssignment;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

export interface ResponsibilityUnitOfWork {
  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[];
  findResponsibilityById(context: AccessContext, id: ResponsibilityId): ResponsibilityAssignment | undefined;
  commitResponsibilityCreate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment;
  commitResponsibilityUpdate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment;
}

// ---- Service ----

export class OrganizationService {
  readonly #householdUow: HouseholdUnitOfWork;
  readonly #serviceGroupUow: ServiceGroupUnitOfWork;
  readonly #responsibilityUow: ResponsibilityUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(
    householdUow: HouseholdUnitOfWork,
    serviceGroupUow: ServiceGroupUnitOfWork,
    responsibilityUow: ResponsibilityUnitOfWork,
    runtime: ApplicationRuntime,
  ) {
    this.#householdUow = householdUow;
    this.#serviceGroupUow = serviceGroupUow;
    this.#responsibilityUow = responsibilityUow;
    this.#runtime = runtime;
  }

  // ---- Household use cases ----

  listHouseholds(context: AccessContext): readonly Household[] {
    assertCapability(context, 'people.read');
    return this.#householdUow.listHouseholds(context);
  }

  getHousehold(context: AccessContext, id: HouseholdId): Household | undefined {
    assertCapability(context, 'people.read');
    const household = this.#householdUow.findHouseholdById(context, id);
    if (household) assertResourceTenant(context, household);
    return household;
  }

  createHousehold(
    context: AccessContext,
    input: CreateHouseholdInput,
    metadata: RequestMetadata = {},
  ): Household {
    assertCapability(context, 'people.write');

    const household = createHousehold({
      id: input.id,
      tenantId: context.tenantId,
      name: input.name,
      memberIds: [...input.memberIds],
    });

    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'household',
      resourceId: household.id,
      action: 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['name', 'memberIds'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'HouseholdCreated',
      aggregateId: household.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#householdUow.commitHouseholdCreate(context, { household, auditEvent, domainEvent });
  }

  updateHousehold(
    context: AccessContext,
    input: UpdateHouseholdInput,
    metadata: RequestMetadata = {},
  ): Household {
    assertCapability(context, 'people.read');
    assertCapability(context, 'people.write');

    const existing = this.#householdUow.findHouseholdById(context, input.id);
    if (!existing) throw new Error('Household not found');
    assertResourceTenant(context, existing);

    let name = existing.name;
    let memberIds = existing.memberIds;
    const changedFields: string[] = [];

    if (input.name !== undefined) {
      const next = input.name.trim().replace(/\s+/g, ' ');
      if (!next) throw new Error('household name is required');
      if (next !== name) {
        name = next;
        changedFields.push('name');
      }
    }

    if (input.memberIds !== undefined) {
      memberIds = [...input.memberIds];
      changedFields.push('memberIds');
    }

    if (changedFields.length === 0) return existing;

    const household = createHousehold({ ...existing, name, memberIds });
    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'household',
      resourceId: household.id,
      action: 'update',
      actorId: context.actorId,
      occurredAt,
      changedFields,
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'HouseholdUpdated',
      aggregateId: household.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#householdUow.commitHouseholdUpdate(context, { household, auditEvent, domainEvent });
  }

  deleteHousehold(
    context: AccessContext,
    id: HouseholdId,
    metadata: RequestMetadata = {},
  ): boolean {
    assertCapability(context, 'people.write');

    const existing = this.#householdUow.findHouseholdById(context, id);
    if (!existing) throw new Error('Household not found');
    assertResourceTenant(context, existing);

    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'household',
      resourceId: id,
      action: 'delete',
      actorId: context.actorId,
      occurredAt,
      changedFields: [],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'HouseholdDeleted',
      aggregateId: id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#householdUow.commitHouseholdDelete(context, id, { auditEvent, domainEvent });
  }

  // ---- Service Group use cases ----

  listServiceGroups(context: AccessContext): readonly ServiceGroup[] {
    assertCapability(context, 'people.read');
    return this.#serviceGroupUow.listServiceGroups(context);
  }

  getServiceGroup(context: AccessContext, id: ServiceGroupId): ServiceGroup | undefined {
    assertCapability(context, 'people.read');
    const group = this.#serviceGroupUow.findServiceGroupById(context, id);
    if (group) assertResourceTenant(context, group);
    return group;
  }

  createServiceGroup(
    context: AccessContext,
    input: CreateServiceGroupInput,
    metadata: RequestMetadata = {},
  ): ServiceGroup {
    assertCapability(context, 'people.write');

    const serviceGroup = createServiceGroup({
      id: input.id,
      tenantId: context.tenantId,
      name: input.name,
      memberIds: [...input.memberIds],
      ...(input.overseerId ? { overseerId: input.overseerId } : {}),
      ...(input.assistantId ? { assistantId: input.assistantId } : {}),
    });

    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'service-group',
      resourceId: serviceGroup.id,
      action: 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['name', 'memberIds', 'overseerId', 'assistantId'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'ServiceGroupCreated',
      aggregateId: serviceGroup.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#serviceGroupUow.commitServiceGroupCreate(context, { serviceGroup, auditEvent, domainEvent });
  }

  updateServiceGroup(
    context: AccessContext,
    input: UpdateServiceGroupInput,
    metadata: RequestMetadata = {},
  ): ServiceGroup {
    assertCapability(context, 'people.read');
    assertCapability(context, 'people.write');

    const existing = this.#serviceGroupUow.findServiceGroupById(context, input.id);
    if (!existing) throw new Error('Service group not found');
    assertResourceTenant(context, existing);

    const changedFields: string[] = [];
    const nextInput: CreateServiceGroupInput = {
      id: existing.id,
      name: existing.name,
      memberIds: [...existing.memberIds],
      overseerId: existing.overseerId,
      assistantId: existing.assistantId,
    };

    if (input.name !== undefined) {
      const next = input.name.trim().replace(/\s+/g, ' ');
      if (!next) throw new Error('service group name is required');
      if (next !== existing.name) {
        nextInput.name = next;
        changedFields.push('name');
      }
    }

    if (input.memberIds !== undefined) {
      nextInput.memberIds = [...input.memberIds];
      changedFields.push('memberIds');
    }

    if (input.overseerId !== undefined) {
      nextInput.overseerId = input.overseerId ?? undefined;
      changedFields.push('overseerId');
    }

    if (input.assistantId !== undefined) {
      nextInput.assistantId = input.assistantId ?? undefined;
      changedFields.push('assistantId');
    }

    if (changedFields.length === 0) return existing;

    const serviceGroup = createServiceGroup({
      id: nextInput.id,
      tenantId: context.tenantId,
      name: nextInput.name,
      memberIds: nextInput.memberIds,
      overseerId: nextInput.overseerId,
      assistantId: nextInput.assistantId,
    });

    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'service-group',
      resourceId: serviceGroup.id,
      action: 'update',
      actorId: context.actorId,
      occurredAt,
      changedFields,
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'ServiceGroupUpdated',
      aggregateId: serviceGroup.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#serviceGroupUow.commitServiceGroupUpdate(context, { serviceGroup, auditEvent, domainEvent });
  }

  deleteServiceGroup(
    context: AccessContext,
    id: ServiceGroupId,
    metadata: RequestMetadata = {},
  ): boolean {
    assertCapability(context, 'people.write');

    const existing = this.#serviceGroupUow.findServiceGroupById(context, id);
    if (!existing) throw new Error('Service group not found');
    assertResourceTenant(context, existing);

    const occurredAt = this.#runtime.now();

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'service-group',
      resourceId: id,
      action: 'delete',
      actorId: context.actorId,
      occurredAt,
      changedFields: [],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'ServiceGroupDeleted',
      aggregateId: id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#serviceGroupUow.commitServiceGroupDelete(context, id, { auditEvent, domainEvent });
  }

  // ---- Responsibility use cases ----

  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[] {
    assertCapability(context, 'responsibilities.read');
    return this.#responsibilityUow.listResponsibilities(context);
  }

  getResponsibility(context: AccessContext, id: ResponsibilityId): ResponsibilityAssignment | undefined {
    assertCapability(context, 'responsibilities.read');
    const responsibility = this.#responsibilityUow.findResponsibilityById(context, id);
    if (responsibility) assertResourceTenant(context, responsibility);
    return responsibility;
  }

  assignResponsibility(
    context: AccessContext,
    input: AssignResponsibilityInput,
    metadata: RequestMetadata = {},
  ): ResponsibilityAssignment {
    assertCapability(context, 'responsibilities.write');

    const occurredAt = this.#runtime.now();

    const responsibility = validateResponsibilityAssignment({
      id: input.id,
      tenantId: context.tenantId,
      personId: input.personId,
      responsibilityKey: input.responsibilityKey,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      assignedBy: context.actorId,
      assignedAt: occurredAt,
    });

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'responsibility',
      resourceId: responsibility.id,
      action: 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['personId', 'responsibilityKey', 'startsAt', 'endsAt'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'ResponsibilityChanged',
      aggregateId: responsibility.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#responsibilityUow.commitResponsibilityCreate(context, { responsibility, auditEvent, domainEvent });
  }

  endResponsibility(
    context: AccessContext,
    input: EndResponsibilityInput,
    metadata: RequestMetadata = {},
  ): ResponsibilityAssignment {
    assertCapability(context, 'responsibilities.write');

    const existing = this.#responsibilityUow.findResponsibilityById(context, input.id);
    if (!existing) throw new Error('Responsibility not found');
    assertResourceTenant(context, existing);

    if (existing.endsAt) throw new Error('Responsibility is already ended');

    const occurredAt = this.#runtime.now();
    const endsAt = input.endsAt.trim();
    if (!Number.isFinite(Date.parse(endsAt))) throw new Error('Invalid ISO date for endsAt');

    const responsibility = validateResponsibilityAssignment({
      ...existing,
      endsAt,
    });

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'responsibility',
      resourceId: responsibility.id,
      action: 'update',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['endsAt'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'ResponsibilityChanged',
      aggregateId: responsibility.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#responsibilityUow.commitResponsibilityUpdate(context, { responsibility, auditEvent, domainEvent });
  }
}
