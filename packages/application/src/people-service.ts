import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  isPersonPublicationArchived,
  normalizeDisplayName,
  normalizeOrdinaryContact,
  normalizePersonLabels,
  type AccessContext,
  type AuditEvent,
  type CongregationPerson,
  type DomainEvent,
  type OrdinaryContact,
  type PersonId,
} from '@eutaktos/domain';

export interface RequestMetadata { correlationId?: string; }
export interface CreatePersonInput { displayName: string; preferredLocale?: string; active?: boolean; }
export interface CreateImportedPersonInput { externalId: string; displayName: string; preferredLocale?: string; }
export interface LinkExternalPersonReferenceInput { personId: PersonId; externalId: string; }
export interface UpdatePersonProfileInput { personId: PersonId; displayName?: string; preferredLocale?: string | null; active?: boolean; labels?: readonly string[]; ordinaryContact?: { phone?: string; email?: string; address?: string } | null; }
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
function ordinaryContactsEqual(left: OrdinaryContact | undefined, right: OrdinaryContact | undefined): boolean {
  return left?.phone === right?.phone && left?.email === right?.email && left?.address === right?.address;
}
function labelsEqual(left: readonly string[] | undefined, right: readonly string[] | undefined): boolean {
  const a = left ?? [];
  const b = right ?? [];
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
export function eventCorrelation(metadata: RequestMetadata): Pick<DomainEvent, 'correlationId'> | Record<string, never> { return metadata.correlationId ? { correlationId: metadata.correlationId } : {}; }

export class PeopleDirectoryService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;
  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) { this.#unitOfWork = unitOfWork; this.#runtime = runtime; }

  list(context: AccessContext): readonly CongregationPerson[] { assertCapability(context, 'people.read'); return this.#unitOfWork.list(context); }
  get(context: AccessContext, personId: PersonId): CongregationPerson | undefined { assertCapability(context, 'people.read'); const person = this.#unitOfWork.findById(context, personId); if (person) assertResourceTenant(context, person); return person; }

  create(context: AccessContext, input: CreatePersonInput, metadata: RequestMetadata = {}): CongregationPerson { return this.#create(context, input, [], metadata); }

  /**
   * Internal import path. Imported people are deliberately inactive until an
   * authorized user verifies their operational status; source status is never inferred.
   */
  createImported(context: AccessContext, input: CreateImportedPersonInput, metadata: RequestMetadata = {}): CongregationPerson {
    const externalId = normalizeExternalId(input.externalId);
    if (this.#unitOfWork.list(context).some(person => externalIdsOf(person).includes(externalId))) throw new Error('External person reference already exists');
    return this.#create(context, { displayName: input.displayName, ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}), active: false }, [externalId], metadata);
  }

  /** Links an explicit source identifier to an existing person after a human conflict decision. */
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
    let displayName = existing.displayName; let preferredLocale = existing.preferredLocale; let active = existing.active; let labels = existing.labels; let ordinaryContact = existing.ordinaryContact;
    const changedFields: string[] = [];
    if (input.displayName !== undefined) { const next = normalizeDisplayName(input.displayName); if (next !== displayName) { displayName = next; changedFields.push('displayName'); } }
    if (input.preferredLocale !== undefined) { const next = input.preferredLocale === null ? undefined : normalizeLocale(input.preferredLocale); if (next !== preferredLocale) { preferredLocale = next; changedFields.push('preferredLocale'); } }
    if (input.active !== undefined && input.active !== active) { if (input.active && isPersonPublicationArchived(existing)) throw new Error('active must be restored explicitly for archived person'); active = input.active; changedFields.push('active'); }
    if (input.labels !== undefined) { const next = normalizePersonLabels(input.labels); if (!labelsEqual(next, labels)) { labels = next; changedFields.push('labels'); } }
    if (input.ordinaryContact !== undefined) { const normalized = input.ordinaryContact === null ? undefined : normalizeOrdinaryContact(input.ordinaryContact); const next = normalized && Object.keys(normalized).length ? normalized : undefined; if (!ordinaryContactsEqual(next, ordinaryContact)) { ordinaryContact = next; changedFields.push('ordinaryContact'); } }
    if (changedFields.length === 0) return existing;
    const { ordinaryContact: _previousOrdinaryContact, labels: _previousLabels, ...personBase } = existing;
    const person: CongregationPerson = { ...personBase, displayName, ...(preferredLocale ? { preferredLocale } : { preferredLocale: undefined }), active, ...(labels?.length ? { labels } : {}), ...(ordinaryContact ? { ordinaryContact } : {}), availability: existing.availability, eligibility: existing.eligibility, emergencyContacts: existing.emergencyContacts };
    const occurredAt = this.#runtime.now();
    return this.#unitOfWork.commitUpdate(context, { person, auditEvent: createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: person.id, action: 'update', actorId: context.actorId, occurredAt, changedFields }), domainEvent: createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonUpdated', aggregateId: person.id, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) }) });
  }

  #create(context: AccessContext, input: CreatePersonInput, externalIds: readonly string[], metadata: RequestMetadata): CongregationPerson {
    assertCapability(context, 'people.write');
    const occurredAt = this.#runtime.now();
    const personId = this.#runtime.nextId('person');
    const preferredLocale = input.preferredLocale ? normalizeLocale(input.preferredLocale) : undefined;
    const person: CongregationPerson = { id: personId, tenantId: context.tenantId, displayName: normalizeDisplayName(input.displayName), ...(preferredLocale ? { preferredLocale } : {}), active: input.active ?? true, availability: [], eligibility: [], emergencyContacts: [], ...(externalIds.length ? { externalIds: Object.freeze([...externalIds]) } : {}) };
    const changedFields = [ 'active', 'displayName', ...(preferredLocale ? ['preferredLocale'] : []), ...(externalIds.length ? ['externalReferences'] : []) ];
    return this.#unitOfWork.commitCreate(context, { person, auditEvent: createAuditEvent({ id: this.#runtime.nextId('audit'), tenantId: context.tenantId, resourceType: 'person', resourceId: personId, action: 'create', actorId: context.actorId, occurredAt, changedFields }), domainEvent: createDomainEvent({ id: this.#runtime.nextId('event'), tenantId: context.tenantId, type: 'PersonCreated', aggregateId: personId, actorId: context.actorId, occurredAt, schemaVersion: 1, ...eventCorrelation(metadata) }) });
  }
}
