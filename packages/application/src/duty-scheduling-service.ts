import {
  assertCapability,
  assertDutyAssignmentTenant,
  assertExplicitEligibility,
  assertResourceTenant,
  buildEligibilityIndex,
  cancelDutyAssignment,
  completeDutyAssignment,
  createAuditEvent,
  createDomainEvent,
  createDutyAssignment,
  createDutyDefinition,
  detectSchedulingConflicts,
  replaceDutyAssignment,
  unavailableIntervalsForPerson,
  type AccessContext,
  type AuditEvent,
  type ConflictAssignment,
  type CongregationPerson,
  type DomainEvent,
  type DutyAssignment,
  type DutyDefinition,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface DutySchedulingChange {
  readonly definition?: Readonly<DutyDefinition>;
  readonly assignment?: Readonly<DutyAssignment>;
  readonly auditEvents: readonly Readonly<AuditEvent>[];
  readonly domainEvents: readonly Readonly<DomainEvent>[];
}

export interface DutySchedulingUnitOfWork {
  findDefinition(context: AccessContext, definitionId: string): Readonly<DutyDefinition> | undefined;
  findAssignment(context: AccessContext, assignmentId: string): Readonly<DutyAssignment> | undefined;
  findPerson(context: AccessContext, personId: string): CongregationPerson | undefined;
  listConflictAssignments(context: AccessContext, personIds: readonly string[]): readonly ConflictAssignment[];
  commit(context: AccessContext, change: DutySchedulingChange): void;
}

export interface DutySchedulingRuntime {
  now(): string;
  nextId(scope: 'duty-definition' | 'duty-assignment' | 'audit' | 'event'): string;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

function event(
  runtime: DutySchedulingRuntime,
  context: AccessContext,
  type: 'DutyDefinitionCreated' | 'DutyAssigned' | 'DutyReplaced' | 'DutyCancelled' | 'DutyCompleted',
  aggregateId: string,
  occurredAt: string,
  metadata: RequestMetadata,
): Readonly<DomainEvent> {
  return createDomainEvent({
    id: runtime.nextId('event'), tenantId: context.tenantId, type, aggregateId,
    actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata),
  });
}

export class DutySchedulingService {
  readonly #uow: DutySchedulingUnitOfWork;
  readonly #runtime: DutySchedulingRuntime;

  constructor(uow: DutySchedulingUnitOfWork, runtime: DutySchedulingRuntime) {
    this.#uow = uow; this.#runtime = runtime;
  }

  #person(context: AccessContext, personId: string): CongregationPerson {
    const person = this.#uow.findPerson(context, required(personId, 'personId'));
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);
    if (!person.active) throw new Error('Inactive person cannot receive a duty');
    return person;
  }

  #definition(context: AccessContext, definitionId: string): Readonly<DutyDefinition> {
    const definition = this.#uow.findDefinition(context, required(definitionId, 'dutyDefinitionId'));
    if (!definition) throw new Error('Duty definition not found');
    assertResourceTenant(context, definition);
    return definition;
  }

  #audit(context: AccessContext, resourceType: 'duty-definition' | 'duty-assignment', resourceId: string, action: 'create' | 'update', fields: readonly string[], at: string): Readonly<AuditEvent> {
    return createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType, resourceId, action, actorId: context.actorId, occurredAt: at, changedFields: fields });
  }

  #assertAssignable(context: AccessContext, definition: Readonly<DutyDefinition>, person: CongregationPerson, assignmentId: string, startsAt: string, endsAt: string, ignoreAssignmentId?: string): void {
    assertCapability(context, 'eligibility.read');
    assertCapability(context, 'availability.read');
    const eligibility = buildEligibilityIndex([person], context.tenantId);
    assertExplicitEligibility(eligibility, context.tenantId, person.id, definition.id);
    const assignments = this.#uow.listConflictAssignments(context, [person.id]).filter(item => item.assignmentId !== ignoreAssignmentId);
    const conflicts = detectSchedulingConflicts({
      tenantId: context.tenantId,
      candidate: Object.freeze({ tenantId: context.tenantId, assignmentId, personId: person.id, startsAt, endsAt }),
      assignments,
      unavailable: unavailableIntervalsForPerson(person, context.tenantId),
    });
    if (conflicts.length) throw new Error('Scheduling conflict detected');
  }

  createDefinition(context: AccessContext, input: { key: string; label: string }, metadata: RequestMetadata = {}): Readonly<DutyDefinition> {
    assertCapability(context, 'schedule.write');
    const at = this.#runtime.now();
    const definition = createDutyDefinition({ id: this.#runtime.nextId('duty-definition'), tenantId: context.tenantId, key: required(input.key, 'dutyKey'), label: required(input.label, 'dutyLabel') });
    this.#uow.commit(context, { definition, auditEvents: [this.#audit(context, 'duty-definition', definition.id, 'create', ['key', 'label'], at)], domainEvents: [event(this.#runtime, context, 'DutyDefinitionCreated', definition.id, at, metadata)] });
    return definition;
  }

  assign(context: AccessContext, input: { definitionId: string; personId: string; startsAt: string; endsAt: string }, metadata: RequestMetadata = {}): Readonly<DutyAssignment> {
    assertCapability(context, 'schedule.write');
    const definition = this.#definition(context, input.definitionId);
    const person = this.#person(context, input.personId);
    const at = this.#runtime.now();
    const assignmentId = this.#runtime.nextId('duty-assignment');
    this.#assertAssignable(context, definition, person, assignmentId, input.startsAt, input.endsAt);
    const assignment = createDutyAssignment({ id: assignmentId, tenantId: context.tenantId, definitionId: definition.id, personId: person.id, startsAt: input.startsAt, endsAt: input.endsAt, assignedAt: at });
    this.#uow.commit(context, { assignment, auditEvents: [this.#audit(context, 'duty-assignment', assignment.id, 'create', ['definitionId', 'personId', 'startsAt', 'endsAt'], at)], domainEvents: [event(this.#runtime, context, 'DutyAssigned', assignment.id, at, metadata)] });
    return assignment;
  }

  replace(context: AccessContext, assignmentIdInput: string, personId: string, metadata: RequestMetadata = {}): Readonly<DutyAssignment> {
    assertCapability(context, 'schedule.write');
    const assignmentId = required(assignmentIdInput, 'dutyAssignmentId');
    const current = this.#uow.findAssignment(context, assignmentId);
    if (!current) throw new Error('Duty assignment not found');
    assertDutyAssignmentTenant(current, context.tenantId);
    if (current.state !== 'assigned') throw new Error('Only assigned duties can be replaced');
    const definition = this.#definition(context, current.definitionId);
    const person = this.#person(context, personId);
    this.#assertAssignable(context, definition, person, current.id, current.startsAt, current.endsAt, current.id);
    const at = this.#runtime.now();
    const replacement = replaceDutyAssignment(current, person.id, at);
    this.#uow.commit(context, { assignment: replacement, auditEvents: [this.#audit(context, 'duty-assignment', replacement.id, 'update', ['personId'], at)], domainEvents: [event(this.#runtime, context, 'DutyReplaced', replacement.id, at, metadata)] });
    return replacement;
  }

  cancel(context: AccessContext, assignmentIdInput: string, metadata: RequestMetadata = {}): Readonly<DutyAssignment> {
    assertCapability(context, 'schedule.write');
    const current = this.#uow.findAssignment(context, required(assignmentIdInput, 'dutyAssignmentId'));
    if (!current) throw new Error('Duty assignment not found');
    assertDutyAssignmentTenant(current, context.tenantId);
    const at = this.#runtime.now();
    const assignment = cancelDutyAssignment(current, at);
    this.#uow.commit(context, { assignment, auditEvents: [this.#audit(context, 'duty-assignment', assignment.id, 'update', ['state'], at)], domainEvents: [event(this.#runtime, context, 'DutyCancelled', assignment.id, at, metadata)] });
    return assignment;
  }

  complete(context: AccessContext, assignmentIdInput: string, metadata: RequestMetadata = {}): Readonly<DutyAssignment> {
    assertCapability(context, 'schedule.write');
    const current = this.#uow.findAssignment(context, required(assignmentIdInput, 'dutyAssignmentId'));
    if (!current) throw new Error('Duty assignment not found');
    assertDutyAssignmentTenant(current, context.tenantId);
    const at = this.#runtime.now();
    const assignment = completeDutyAssignment(current, at);
    this.#uow.commit(context, { assignment, auditEvents: [this.#audit(context, 'duty-assignment', assignment.id, 'update', ['state'], at)], domainEvents: [event(this.#runtime, context, 'DutyCompleted', assignment.id, at, metadata)] });
    return assignment;
  }
}
