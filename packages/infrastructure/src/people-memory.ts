import type { PeopleUnitOfWork, PersonChange } from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type AuditEvent,
  type CongregationPerson,
  type DomainEvent,
  type PersonId,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function clonePerson(person: CongregationPerson): CongregationPerson {
  return structuredClone(person);
}

export class InMemoryPeopleUnitOfWork implements PeopleUnitOfWork {
  readonly #people = new Map<string, CongregationPerson>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly CongregationPerson[] = []) {
    for (const person of seed) {
      const storageKey = key(person.tenantId, person.id);
      if (this.#people.has(storageKey)) throw new Error('Duplicate tenant person id');
      this.#people.set(storageKey, clonePerson(person));
    }
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    assertCapability(context, 'people.read');
    return [...this.#people.values()]
      .filter(person => person.tenantId === context.tenantId)
      .map(clonePerson);
  }

  findById(context: AccessContext, personId: PersonId): CongregationPerson | undefined {
    assertCapability(context, 'people.read');
    const person = this.#people.get(key(context.tenantId, personId));
    return person ? clonePerson(person) : undefined;
  }

  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson {
    return this.#commit(context, change, true);
  }

  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    return this.#commit(context, change, false);
  }

  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[] {
    assertCapability(context, 'audit.read');
    return [...this.#audit.values()].filter(event => event.tenantId === context.tenantId);
  }

  listOutbox(context: AccessContext): readonly Readonly<DomainEvent>[] {
    assertCapability(context, 'tenant.manage');
    return [...this.#outbox.values()].filter(event => event.tenantId === context.tenantId);
  }

  #commit(context: AccessContext, change: PersonChange, create: boolean): CongregationPerson {
    assertResourceTenant(context, change.person);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const personKey = key(context.tenantId, change.person.id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#people.has(personKey);

    if (create && exists) throw new Error('Person already exists');
    if (!create && !exists) throw new Error('Person not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    // Validate the complete write-set before mutating any collection. Production
    // adapters must preserve this all-or-nothing behavior with a database transaction.
    const person = clonePerson(change.person);
    this.#people.set(personKey, person);
    this.#audit.set(auditKey, Object.freeze(structuredClone(change.auditEvent)));
    this.#outbox.set(eventKey, Object.freeze(structuredClone(change.domainEvent)));
    return clonePerson(person);
  }
}
