import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  validateAvailability,
  type AccessContext,
  type AvailabilityPeriod,
  type AvailabilityPeriodId,
  type CongregationPerson,
  type PersonId,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type RequestMetadata,
} from './people-service';

export interface AddUnavailabilityInput {
  personId: PersonId;
  startsAt: string;
  endsAt: string;
  reasonCode?: AvailabilityPeriod['reasonCode'];
}

export interface RemoveUnavailabilityInput {
  personId: PersonId;
  availabilityPeriodId: AvailabilityPeriodId;
}

function normalizePeriodId(value: AvailabilityPeriodId): AvailabilityPeriodId {
  const normalized = value.trim();
  if (!normalized) throw new Error('availabilityPeriodId is required');
  return normalized;
}

export class AvailabilityService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  list(context: AccessContext, personId: PersonId): readonly AvailabilityPeriod[] {
    assertCapability(context, 'people.read');
    assertCapability(context, 'availability.read');

    const person = this.#unitOfWork.findById(context, personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);

    return person.availability.map(period => ({ ...period }));
  }

  addUnavailability(
    context: AccessContext,
    input: AddUnavailabilityInput,
    metadata: RequestMetadata = {},
  ): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'availability.write');

    const person = this.#unitOfWork.findById(context, input.personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);

    const period: AvailabilityPeriod = validateAvailability({
      id: this.#runtime.nextId('availability'),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    });

    const updated: CongregationPerson = {
      ...person,
      availability: [...person.availability, period],
    };

    const occurredAt = this.#runtime.now();
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'availability',
      resourceId: period.id!,
      action: 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields: input.reasonCode ? ['endsAt', 'reasonCode', 'startsAt'] : ['endsAt', 'startsAt'],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'AvailabilityChanged',
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

  removeUnavailability(
    context: AccessContext,
    input: RemoveUnavailabilityInput,
    metadata: RequestMetadata = {},
  ): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'availability.write');

    const person = this.#unitOfWork.findById(context, input.personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);

    const availabilityPeriodId = normalizePeriodId(input.availabilityPeriodId);
    const existing = person.availability.find(period => period.id === availabilityPeriodId);
    if (!existing) throw new Error('Unavailability period not found');

    const updated: CongregationPerson = {
      ...person,
      availability: person.availability.filter(period => period.id !== availabilityPeriodId),
    };

    const occurredAt = this.#runtime.now();
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'availability',
      resourceId: availabilityPeriodId,
      action: 'delete',
      actorId: context.actorId,
      occurredAt,
      changedFields: [],
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'AvailabilityChanged',
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
