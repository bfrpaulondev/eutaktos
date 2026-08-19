import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  normalizeDisplayName,
  type AccessContext,
  type AuditEvent,
  type CongregationPerson,
  type DomainEvent,
  type PersonId,
} from '@eutaktos/domain';

export interface RequestMetadata {
  correlationId?: string;
}

export interface CreatePersonInput {
  displayName: string;
  preferredLocale?: string;
  active?: boolean;
}

export interface UpdatePersonProfileInput {
  personId: PersonId;
  displayName?: string;
  preferredLocale?: string | null;
  active?: boolean;
}

export interface PersonChange {
  person: CongregationPerson;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

/**
 * This boundary is intentionally transactional. A production adapter should commit
 * the person row, immutable audit record and outbox/domain event in one database
 * transaction. That prevents a successful business write from existing without
 * the corresponding audit/event history.
 */
export interface PeopleUnitOfWork {
  list(context: AccessContext): readonly CongregationPerson[];
  findById(context: AccessContext, personId: PersonId): CongregationPerson | undefined;
  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson;
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson;
}

export interface ApplicationRuntime {
  now(): string;
  nextId(scope: 'person' | 'audit' | 'event'): string;
}

function normalizeLocale(value: string): string {
  const candidate = value.trim();
  if (!candidate) throw new Error('preferredLocale is required when provided');
  if (candidate.length > 35) throw new Error('preferredLocale is too long');

  try {
    return new Intl.Locale(candidate).toString();
  } catch {
    throw new Error('preferredLocale must be a valid BCP 47 locale');
  }
}

function eventCorrelation(metadata: RequestMetadata): Pick<DomainEvent, 'correlationId'> | Record<string, never> {
  return metadata.correlationId ? { correlationId: metadata.correlationId } : {};
}

export class PeopleDirectoryService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    assertCapability(context, 'people.read');
    return this.#unitOfWork.list(context);
  }

  get(context: AccessContext, personId: PersonId): CongregationPerson | undefined {
    assertCapability(context, 'people.read');
    const person = this.#unitOfWork.findById(context, personId);
    if (person) assertResourceTenant(context, person);
    return person;
  }

  create(
    context: AccessContext,
    input: CreatePersonInput,
    metadata: RequestMetadata = {},
  ): CongregationPerson {
    assertCapability(context, 'people.write');
    const occurredAt = this.#runtime.now();
    const personId = this.#runtime.nextId('person');
    const preferredLocale = input.preferredLocale ? normalizeLocale(input.preferredLocale) : undefined;

    const person: CongregationPerson = {
      id: personId,
      tenantId: context.tenantId,
      displayName: normalizeDisplayName(input.displayName),
      ...(preferredLocale ? { preferredLocale } : {}),
      active: input.active ?? true,
      availability: [],
      eligibility: [],
    };

    const changedFields = preferredLocale
      ? ['active', 'displayName', 'preferredLocale']
      : ['active', 'displayName'];

    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'person',
      resourceId: personId,
      action: 'create',
      actorId: context.actorId,
      occurredAt,
      changedFields,
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'PersonCreated',
      aggregateId: personId,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#unitOfWork.commitCreate(context, { person, auditEvent, domainEvent });
  }

  updateProfile(
    context: AccessContext,
    input: UpdatePersonProfileInput,
    metadata: RequestMetadata = {},
  ): CongregationPerson {
    assertCapability(context, 'people.read');
    assertCapability(context, 'people.write');

    const existing = this.#unitOfWork.findById(context, input.personId);
    if (!existing) throw new Error('Person not found');
    assertResourceTenant(context, existing);

    let displayName = existing.displayName;
    let preferredLocale = existing.preferredLocale;
    let active = existing.active;
    const changedFields: string[] = [];

    if (input.displayName !== undefined) {
      const next = normalizeDisplayName(input.displayName);
      if (next !== displayName) {
        displayName = next;
        changedFields.push('displayName');
      }
    }

    if (input.preferredLocale !== undefined) {
      const next = input.preferredLocale === null ? undefined : normalizeLocale(input.preferredLocale);
      if (next !== preferredLocale) {
        preferredLocale = next;
        changedFields.push('preferredLocale');
      }
    }

    if (input.active !== undefined && input.active !== active) {
      active = input.active;
      changedFields.push('active');
    }

    if (changedFields.length === 0) return existing;

    const person: CongregationPerson = {
      ...existing,
      displayName,
      ...(preferredLocale ? { preferredLocale } : { preferredLocale: undefined }),
      active,
      // Eligibility and availability are protected subdomains. Generic profile edits
      // must preserve them exactly; dedicated use cases will require their own capabilities.
      availability: existing.availability,
      eligibility: existing.eligibility,
    };

    const occurredAt = this.#runtime.now();
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'person',
      resourceId: person.id,
      action: 'update',
      actorId: context.actorId,
      occurredAt,
      changedFields,
    });

    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'PersonUpdated',
      aggregateId: person.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    return this.#unitOfWork.commitUpdate(context, { person, auditEvent, domainEvent });
  }
}
