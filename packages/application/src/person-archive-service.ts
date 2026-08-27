import {
  archivePersonPublication,
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  restorePersonPublication,
  type AccessContext,
  type CongregationPerson,
  type PersonId,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type RequestMetadata,
} from './people-service';

export interface ArchivePersonInput { personId: PersonId; reason: string; }
export interface RestorePersonInput { personId: PersonId; }

export class PersonArchiveService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  archive(context: AccessContext, input: ArchivePersonInput, metadata: RequestMetadata = {}): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'people.write');
    const existing = this.#unitOfWork.findById(context, input.personId);
    if (!existing) throw new Error('Person not found');
    assertResourceTenant(context, existing);
    const occurredAt = this.#runtime.now();
    const person = archivePersonPublication(existing, { actorId: context.actorId, occurredAt, reason: input.reason });
    return this.#unitOfWork.commitUpdate(context, {
      person,
      auditEvent: createAuditEvent({
        id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: person.id,
        action: 'update', actorId: context.actorId, occurredAt, changedFields: ['active', 'publicationArchive'],
      }),
      domainEvent: createDomainEvent({
        id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonUpdated', aggregateId: person.id,
        actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata),
      }),
    });
  }

  restore(context: AccessContext, input: RestorePersonInput, metadata: RequestMetadata = {}): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'people.write');
    const existing = this.#unitOfWork.findById(context, input.personId);
    if (!existing) throw new Error('Person not found');
    assertResourceTenant(context, existing);
    const occurredAt = this.#runtime.now();
    const person = restorePersonPublication(existing, { actorId: context.actorId, occurredAt });
    return this.#unitOfWork.commitUpdate(context, {
      person,
      auditEvent: createAuditEvent({
        id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: person.id,
        action: 'update', actorId: context.actorId, occurredAt, changedFields: ['active', 'publicationArchive'],
      }),
      domainEvent: createDomainEvent({
        id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonUpdated', aggregateId: person.id,
        actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata),
      }),
    });
  }
}
