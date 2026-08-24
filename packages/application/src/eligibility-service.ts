import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  isExplicitlyEligible,
  recordEligibilityDecision,
  type AccessContext,
  type AssignmentTypeId,
  type CongregationPerson,
  type EligibilityGrant,
  type PersonId,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type RequestMetadata,
} from './people-service';

export interface SetEligibilityInput {
  personId: PersonId;
  assignmentTypeId: AssignmentTypeId;
  enabled: boolean;
}

function normalizeAssignmentTypeId(value: AssignmentTypeId): AssignmentTypeId {
  const normalized = value.trim();
  if (!normalized) throw new Error('assignmentTypeId is required');
  if (normalized.length > 100) throw new Error('assignmentTypeId is too long');
  return normalized;
}

export class EligibilityService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  listEligibility(context: AccessContext, personId: PersonId): readonly EligibilityGrant[] {
    assertCapability(context, 'people.read');
    assertCapability(context, 'eligibility.read');

    const person = this.#unitOfWork.findById(context, personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);
    return person.eligibility;
  }

  setEligibility(
    context: AccessContext,
    input: SetEligibilityInput,
    metadata: RequestMetadata = {},
  ): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'eligibility.write');

    const person = this.#unitOfWork.findById(context, input.personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);

    const assignmentTypeId = normalizeAssignmentTypeId(input.assignmentTypeId);
    const hasExplicitDecision = person.eligibility.some(
      grant => grant.assignmentTypeId === assignmentTypeId,
    );
    if (hasExplicitDecision && isExplicitlyEligible(person, assignmentTypeId) === input.enabled) {
      return person;
    }

    const occurredAt = this.#runtime.now();
    const updated = recordEligibilityDecision(person, {
      assignmentTypeId,
      enabled: input.enabled,
      decidedBy: context.actorId,
      decidedAt: occurredAt,
    });

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'eligibility',
      resourceId: `${person.id}:${assignmentTypeId}`,
      action: input.enabled ? 'grant' : 'revoke',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['enabled'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'EligibilityChanged',
      aggregateId: person.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#unitOfWork.commitUpdate(context, {
      person: updated,
      auditEvent,
      domainEvent,
    });
  }
}
