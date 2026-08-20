import type {
  DelegationChange,
  DelegationRecord,
  DelegationUnitOfWork,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type AuditEvent,
  type DomainEvent,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneDelegation(value: DelegationRecord): DelegationRecord {
  return structuredClone(value);
}

export class InMemoryDelegationUnitOfWork implements DelegationUnitOfWork {
  readonly #delegations = new Map<string, DelegationRecord>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly DelegationRecord[] = []) {
    for (const delegation of seed) {
      const storageKey = key(delegation.tenantId, delegation.id);
      if (this.#delegations.has(storageKey)) throw new Error('Duplicate tenant delegation id');
      this.#delegations.set(storageKey, cloneDelegation(delegation));
    }
  }

  list(context: AccessContext): readonly DelegationRecord[] {
    assertCapability(context, 'delegations.read');
    return [...this.#delegations.values()]
      .filter(item => item.tenantId === context.tenantId)
      .map(cloneDelegation)
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id));
  }

  findById(context: AccessContext, delegationId: string): DelegationRecord | undefined {
    assertCapability(context, 'delegations.write');
    const delegation = this.#delegations.get(key(context.tenantId, delegationId));
    return delegation ? cloneDelegation(delegation) : undefined;
  }

  commitCreate(context: AccessContext, change: DelegationChange): DelegationRecord {
    return this.#commit(context, change, true);
  }

  commitUpdate(context: AccessContext, change: DelegationChange): DelegationRecord {
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

  #commit(context: AccessContext, change: DelegationChange, create: boolean): DelegationRecord {
    assertCapability(context, 'delegations.write');
    assertResourceTenant(context, change.delegation);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const delegationKey = key(context.tenantId, change.delegation.id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#delegations.has(delegationKey);

    if (create && exists) throw new Error('Delegation already exists');
    if (!create && !exists) throw new Error('Delegation not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    const delegation = cloneDelegation(change.delegation);
    this.#delegations.set(delegationKey, delegation);
    this.#audit.set(auditKey, Object.freeze(structuredClone(change.auditEvent)));
    this.#outbox.set(eventKey, Object.freeze(structuredClone(change.domainEvent)));
    return cloneDelegation(delegation);
  }
}
