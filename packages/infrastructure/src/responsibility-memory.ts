import type {
  ResponsibilityChange,
  ResponsibilityUnitOfWork,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type AuditEvent,
  type DomainEvent,
  type ResponsibilityAssignment,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneResponsibility(responsibility: ResponsibilityAssignment): ResponsibilityAssignment {
  return structuredClone(responsibility);
}

export class InMemoryResponsibilityUnitOfWork implements ResponsibilityUnitOfWork {
  readonly #responsibilities = new Map<string, ResponsibilityAssignment>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly ResponsibilityAssignment[] = []) {
    for (const responsibility of seed) {
      const storageKey = key(responsibility.tenantId, responsibility.id);
      if (this.#responsibilities.has(storageKey)) throw new Error('Duplicate tenant responsibility id');
      this.#responsibilities.set(storageKey, cloneResponsibility(responsibility));
    }
  }

  listResponsibilities(context: AccessContext): readonly ResponsibilityAssignment[] {
    assertCapability(context, 'responsibilities.read');
    return [...this.#responsibilities.values()]
      .filter(r => r.tenantId === context.tenantId)
      .map(cloneResponsibility);
  }

  findResponsibilityById(context: AccessContext, id: string): ResponsibilityAssignment | undefined {
    assertCapability(context, 'responsibilities.read');
    const responsibility = this.#responsibilities.get(key(context.tenantId, id));
    return responsibility ? cloneResponsibility(responsibility) : undefined;
  }

  commitResponsibilityCreate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return this.#commit(context, change, true);
  }

  commitResponsibilityUpdate(context: AccessContext, change: ResponsibilityChange): ResponsibilityAssignment {
    return this.#commit(context, change, false);
  }

  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[] {
    assertCapability(context, 'audit.read');
    return [...this.#audit.values()]
      .filter(event => event.tenantId === context.tenantId)
      .map(event => Object.freeze(structuredClone(event)));
  }

  listOutbox(context: AccessContext): readonly Readonly<DomainEvent>[] {
    assertCapability(context, 'tenant.manage');
    return [...this.#outbox.values()]
      .filter(event => event.tenantId === context.tenantId)
      .map(event => Object.freeze(structuredClone(event)));
  }

  #commit(context: AccessContext, change: ResponsibilityChange, create: boolean): ResponsibilityAssignment {
    assertResourceTenant(context, change.responsibility);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const respKey = key(context.tenantId, change.responsibility.id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#responsibilities.has(respKey);

    if (create && exists) throw new Error('Responsibility already exists');
    if (!create && !exists) throw new Error('Responsibility not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    // Validate the complete write-set before mutating any collection. A production
    // adapter must preserve this all-or-nothing behavior in a database transaction.
    const responsibility = cloneResponsibility(change.responsibility);
    const auditEvent = Object.freeze(structuredClone(change.auditEvent));
    const domainEvent = Object.freeze(structuredClone(change.domainEvent));

    this.#responsibilities.set(respKey, responsibility);
    this.#audit.set(auditKey, auditEvent);
    this.#outbox.set(eventKey, domainEvent);
    return cloneResponsibility(responsibility);
  }
}
