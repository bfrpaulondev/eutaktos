import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDomainEvent,
  emergencyContactsOf,
  normalizeEmergencyContact,
  type AccessContext,
  type CongregationPerson,
  type EmergencyContact,
  type EmergencyContactId,
  type PersonId,
} from '@eutaktos/domain';
import {
  eventCorrelation,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type RequestMetadata,
} from './people-service';

export interface UpsertEmergencyContactInput {
  personId: PersonId;
  contactId?: EmergencyContactId;
  name: string;
  phone: string;
  relationship?: string | null;
}

export class EmergencyContactService {
  readonly #unitOfWork: PeopleUnitOfWork;
  readonly #runtime: ApplicationRuntime;

  constructor(unitOfWork: PeopleUnitOfWork, runtime: ApplicationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  list(context: AccessContext, personId: PersonId): readonly EmergencyContact[] {
    assertCapability(context, 'people.read');
    assertCapability(context, 'emergency-contacts.read');
    const person = this.#getPerson(context, personId);
    return emergencyContactsOf(person).map(contact => ({ ...contact }));
  }

  upsert(
    context: AccessContext,
    input: UpsertEmergencyContactInput,
    metadata: RequestMetadata = {},
  ): EmergencyContact {
    assertCapability(context, 'people.read');
    assertCapability(context, 'emergency-contacts.read');
    assertCapability(context, 'emergency-contacts.write');
    const existing = this.#getPerson(context, input.personId);
    const contacts = [...emergencyContactsOf(existing)];
    const generatedId = this.#runtime.nextEntityId
      ? this.#runtime.nextEntityId('emergency-contact')
      : `emergency-contact-${this.#runtime.nextId('event')}`;
    const contactId = input.contactId?.trim() || generatedId;
    const contact = normalizeEmergencyContact({
      id: contactId,
      name: input.name,
      phone: input.phone,
      ...(input.relationship ? { relationship: input.relationship } : {}),
    });
    const index = contacts.findIndex(item => item.id === contactId);
    const action = index >= 0 ? 'update' : 'create';
    if (index >= 0) contacts[index] = contact;
    else contacts.push(contact);

    const occurredAt = this.#runtime.now();
    const person: CongregationPerson = { ...existing, emergencyContacts: contacts };
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'emergency-contact',
      resourceId: contactId,
      action,
      actorId: context.actorId,
      occurredAt,
      changedFields: ['name', 'phone', 'relationship'],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'EmergencyContactChanged',
      aggregateId: contactId,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    this.#unitOfWork.commitUpdate(context, { person, auditEvent, domainEvent });
    return { ...contact };
  }

  remove(
    context: AccessContext,
    personId: PersonId,
    contactId: EmergencyContactId,
    metadata: RequestMetadata = {},
  ): void {
    assertCapability(context, 'people.read');
    assertCapability(context, 'emergency-contacts.read');
    assertCapability(context, 'emergency-contacts.write');
    const existing = this.#getPerson(context, personId);
    const id = contactId.trim();
    if (!id) throw new Error('emergencyContactId is required');
    const contacts = emergencyContactsOf(existing);
    if (!contacts.some(contact => contact.id === id)) throw new Error('Emergency contact not found');

    const occurredAt = this.#runtime.now();
    const person: CongregationPerson = {
      ...existing,
      emergencyContacts: contacts.filter(contact => contact.id !== id),
    };
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'emergency-contact',
      resourceId: id,
      action: 'delete',
      actorId: context.actorId,
      occurredAt,
      changedFields: [],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'EmergencyContactChanged',
      aggregateId: id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });

    this.#unitOfWork.commitUpdate(context, { person, auditEvent, domainEvent });
  }

  #getPerson(context: AccessContext, personId: PersonId): CongregationPerson {
    const person = this.#unitOfWork.findById(context, personId);
    if (!person) throw new Error('Person not found');
    assertResourceTenant(context, person);
    return person;
  }
}
