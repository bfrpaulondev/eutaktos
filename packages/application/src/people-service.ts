import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  normalizeDisplayName,
  normalizePersonContactDetails,
  type AccessContext,
  type AuditEvent,
  type CongregationPerson,
  type DomainEvent,
  type PersonContactDetails,
  type PersonId,
} from '@eutaktos/domain';

export interface RequestMetadata { correlationId?: string; }
export interface CreatePersonInput { displayName: string; preferredLocale?: string; active?: boolean; contact?: PersonContactDetails; }
export interface CreateImportedPersonInput { externalId: string; displayName: string; preferredLocale?: string; }
export interface LinkExternalPersonReferenceInput { personId: PersonId; externalId: string; }
export interface UpdatePersonProfileInput { personId: PersonId; displayName?: string; preferredLocale?: string | null; active?: boolean; contact?: PersonContactDetails | null; }
export interface PersonChange { person: CongregationPerson; auditEvent: Readonly<AuditEvent>; domainEvent: Readonly<DomainEvent>; }

/** This boundary commits the person, audit row and outbox event atomically. */
export interface PeopleUnitOfWork {
  list(context: AccessContext): readonly CongregationPerson[];
  findById(context: AccessContext, personId: PersonId): CongregationPerson | undefined;
  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson;
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson;
}
export type ApplicationIdScope = 'person' | 'availability' | 'audit' | 'event';
export interface ApplicationRuntime { now(): string; nextId(scope: ApplicationIdScope): string; nextEntityId?(scope: 'emergency-contact'): string; }

function normalizeLocale(value: string): string {
  const candidate = value.trim();
  if (!candidate) throw new Error('preferredLocale is required when provided');
  if (candidate.length > 35) throw new Error('preferredLocale is too long');
  try { return new Intl.Locale(candidate).toString(); } catch { throw new Error('preferredLocale must be a valid BCP 47 locale'); }
}
function normalizeExternalId(value: string): string {
  if (typeof value !== 'string') throw new Error('externalId must be a string');
  const normalized = value.trim();
  if (!normalized) throw new Error('externalId is required');
  if (normalized.length > 250) throw new Error('externalId is too long');
  if (/[\u0000-\u001F]/.test(normalized)) throw new Error('externalId contains control characters');
  return normalized;
}
function externalIdsOf(person: CongregationPerson): readonly string[] { return person.externalIds ?? []; }
export function eventCorrelation(metadata: RequestMetadata): Pick<DomainEvent, 'correlationId'> | Record<string, never> { return metadata.correlationId ? { correlationId: metadata.correlationId } : {}; }

export class PeopleDirectoryService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;
  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) { this.#unitOfWork = unitOfWork; this.#runtime = runtime; }

  list(context: AccessContext): readonly CongregationPerson[] { assertCapability(context, 'people.read'); return this.#unitOfWork.list(context); }
  get(context: AccessContext, personId: PersonId): CongregationPerson | undefined { assertCapability(context, 'people.read'); const person = this.#unitOfWork.findById(context, personId); if (person) assertResourceTenant(context, person); return person; }

  create(context: AccessContext, input: CreatePersonInput, metadata: RequestMetadata = {}): CongregationPerson { return this.#create(context, input, [], metadata); }

  /** Internal import path. Imported people are inactive until an authorized human verifies status. */
  createImported(context: AccessContext, input: CreateImportedPersonInput, metadata: RequestMetadata = {}): CongregationPerson {
    const externalId = normalizeExternalId(input.externalId);
    if (this.#unitOfWork.list(context).some(person => externalIdsOf(person).includes(externalId))) throw new Error('External person reference already exists');
    return this.#create(context, { displayName: input.displayName, ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}), active: false }, [externalId], metadata);
  }

  linkExternalReference(context: AccessContext, input: LinkExternalPersonReferenceInput, metadata: RequestMetadata = {}): CongregationPerson {
    assertCapability(context, 'people.read'); assertCapability(context, 'people.write');
    const externalId = normalizeExternalId(input.externalId);
    const existingOwner = this.#unitOfWork.list(context).find(person => externalIdsOf(person).includes(externalId));
    if (existingOwner && existingOwner.id !== input.personId) throw new Error('External person reference already exists');
    const existing = this.#unitOfWork.findById(context, input.personId);
    if (!existing) throw new Error('Person not found');
    assertResourceTenant(context, existing);
    if (externalIdsOf(existing).includes(externalId)) return existing;
    const occurredAt = this.#runtime.now();
    const person: CongregationPerson = { ...existing, externalIds: Object.freeze([...externalIdsOf(existing), externalId].sort()), availability: existing.availability, eligibility: existing.eligibility, emergencyContacts: existing.emergencyContacts };
    return this.#unitOfWork.commitUpdate(context, { person, auditEvent: createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: person.id, action: 'update', actorId: context.actorId, occurredAt, changedFields: ['externalReferences'] }), domainEvent: createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonUpdated', aggregateId: person.id, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) }) });
  }

  updateProfile(context: AccessContext, input: UpdatePersonProfileInput, metadata: RequestMetadata = {}): CongregationPerson {
    assertCapability(context, 'people.read'); assertCapability(context, 'people.write');
    const existing = this.#unitOfWork.findById(context, input.personId);
    if (!existing) throw new Error('Person not found');
    assertResourceTenant(context, existing);
    let displayName = existing.displayName; let preferredLocale = existing.preferredLocale; let active = existing.active; let contact = existing.contact;
    const changedFields: string[] = [];
    if (input.displayName !== undefined) { const next = normalizeDisplayName(input.displayName); if (next !== displayName) { displayName = next; changedFields.push('displayName'); } }
    if (input.preferredLocale !== undefined) { const next = input.preferredLocale === null ? undefined : normalizeLocale(input.preferredLocale); if (next !== preferredLocale) { preferredLocale = next; changedFields.push('preferredLocale'); } }
    if (input.active !== undefined && input.active !== active) { active = input.active; changedFields.push('active'); }
    if (input.contact !== undefined) {
      const next = normalizePersonContactDetails(input.contact);
      if (JSON.stringify(next ?? null) !== JSON.stringify(contact ?? null)) { contact = next; changedFields.push('contact'); }
    }
    if (changedFields.length === 0) return existing;
    const person: CongregationPerson = { ...existing, displayName, ...(preferredLocale ? { preferredLocale } : { preferredLocale: undefined }), active, ...(contact ? { contact } : { contact: undefined }), availability: existing.availability, eligibility: existing.eligibility, emergencyContacts: existing.emergencyContacts };
    const occurredAt = this.#runtime.now();
    return this.#unitOfWork.commitUpdate(context, { person, auditEvent: createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: person.id, action: 'update', actorId: context.actorId, occurredAt, changedFields }), domainEvent: createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonUpdated', aggregateId: person.id, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) }) });
  }

  #create(context: AccessContext, input: CreatePersonInput, externalIds: readonly string[], metadata: RequestMetadata): CongregationPerson {
    assertCapability(context, 'people.write');
    const occurredAt = this.#runtime.now();
    const personId = this.#runtime.nextId('person');
    const preferredLocale = input.preferredLocale ? normalizeLocale(input.preferredLocale) : undefined;
    const contact = normalizePersonContactDetails(input.contact);
    const person: CongregationPerson = { id: personId, tenantId: context.tenantId, displayName: normalizeDisplayName(input.displayName), ...(preferredLocale ? { preferredLocale } : {}), active: input.active ?? true, ...(contact ? { contact } : {}), availability: [], eligibility: [], emergencyContacts: [], ...(externalIds.length ? { externalIds: Object.freeze([...externalIds]) } : {}) };
    const changedFields = ['active', 'displayName', ...(preferredLocale ? ['preferredLocale'] : []), ...(contact ? ['contact'] : []), ...(externalIds.length ? ['externalReferences'] : [])];
    return this.#unitOfWork.commitCreate(context, { person, auditEvent: createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: personId, action: 'create', actorId: context.actorId, occurredAt, changedFields }), domainEvent: createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonCreated', aggregateId: personId, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) }) });
  }
}