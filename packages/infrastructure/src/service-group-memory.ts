import type {
  ServiceGroupChange,
  ServiceGroupUnitOfWork,
  OrganizationDeletionChange,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type AuditEvent,
  type DomainEvent,
  type ServiceGroup,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneServiceGroup(serviceGroup: ServiceGroup): ServiceGroup {
  return structuredClone(serviceGroup);
}

export class InMemoryServiceGroupUnitOfWork implements ServiceGroupUnitOfWork {
  readonly #serviceGroups = new Map<string, ServiceGroup>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly ServiceGroup[] = []) {
    for (const serviceGroup of seed) {
      const storageKey = key(serviceGroup.tenantId, serviceGroup.id);
      if (this.#serviceGroups.has(storageKey)) throw new Error('Duplicate tenant service-group id');
      this.#serviceGroups.set(storageKey, cloneServiceGroup(serviceGroup));
    }
  }

  listServiceGroups(context: AccessContext): readonly ServiceGroup[] {
    assertCapability(context, 'people.read');
    return [...this.#serviceGroups.values()]
      .filter(sg => sg.tenantId === context.tenantId)
      .map(cloneServiceGroup);
  }

  findServiceGroupById(context: AccessContext, id: string): ServiceGroup | undefined {
    assertCapability(context, 'people.read');
    const serviceGroup = this.#serviceGroups.get(key(context.tenantId, id));
    return serviceGroup ? cloneServiceGroup(serviceGroup) : undefined;
  }

  commitServiceGroupCreate(context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    return this.#commit(context, change, true);
  }

  commitServiceGroupUpdate(context: AccessContext, change: ServiceGroupChange): ServiceGroup {
    return this.#commit(context, change, false);
  }

  commitServiceGroupDelete(
    context: AccessContext,
    id: string,
    change: OrganizationDeletionChange,
  ): boolean {
    assertCapability(context, 'people.write');
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const groupKey = key(context.tenantId, id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);

    if (!this.#serviceGroups.has(groupKey)) throw new Error('Service group not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    const auditEvent = Object.freeze(structuredClone(change.auditEvent));
    const domainEvent = Object.freeze(structuredClone(change.domainEvent));

    this.#serviceGroups.delete(groupKey);
    this.#audit.set(auditKey, auditEvent);
    this.#outbox.set(eventKey, domainEvent);
    return true;
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

  #commit(context: AccessContext, change: ServiceGroupChange, create: boolean): ServiceGroup {
    assertResourceTenant(context, change.serviceGroup);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const groupKey = key(context.tenantId, change.serviceGroup.id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#serviceGroups.has(groupKey);

    if (create && exists) throw new Error('Service group already exists');
    if (!create && !exists) throw new Error('Service group not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    // Validate the complete write-set before mutating any collection. A production
    // adapter must preserve this all-or-nothing behavior in a database transaction.
    const serviceGroup = cloneServiceGroup(change.serviceGroup);
    const auditEvent = Object.freeze(structuredClone(change.auditEvent));
    const domainEvent = Object.freeze(structuredClone(change.domainEvent));

    this.#serviceGroups.set(groupKey, serviceGroup);
    this.#audit.set(auditKey, auditEvent);
    this.#outbox.set(eventKey, domainEvent);
    return cloneServiceGroup(serviceGroup);
  }
}
