import type { AccessGrantChange, AccessGrantUnitOfWork } from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  isActiveAccessGrant,
  type AccessContext,
  type AccessGrant,
  type AuditEvent,
  type Capability,
  type DomainEvent,
  type SessionIdentity,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneGrant(grant: AccessGrant): Readonly<AccessGrant> {
  return Object.freeze(structuredClone(grant));
}

export class InMemoryAccessGrantUnitOfWork implements AccessGrantUnitOfWork {
  readonly #grants = new Map<string, Readonly<AccessGrant>>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly AccessGrant[] = []) {
    for (const grant of seed) {
      const storageKey = key(grant.tenantId, grant.id);
      if (this.#grants.has(storageKey)) throw new Error('Duplicate tenant access grant id');
      this.#grants.set(storageKey, cloneGrant(grant));
    }
  }

  listBySubject(context: AccessContext, subjectId: string): readonly Readonly<AccessGrant>[] {
    assertCapability(context, 'access.manage');
    return [...this.#grants.values()]
      .filter(grant => grant.tenantId === context.tenantId && grant.subjectId === subjectId)
      .map(cloneGrant);
  }

  findById(context: AccessContext, grantId: string): Readonly<AccessGrant> | undefined {
    assertCapability(context, 'access.manage');
    const grant = this.#grants.get(key(context.tenantId, grantId));
    return grant ? cloneGrant(grant) : undefined;
  }

  commitCreate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant> {
    return this.#commit(context, change, true);
  }

  commitUpdate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant> {
    return this.#commit(context, change, false);
  }

  /** Trusted server-side resolver used after a session has resolved tenant+actor. */
  capabilitiesFor(identity: Readonly<SessionIdentity>): readonly Capability[] {
    const capabilities = [...this.#grants.values()]
      .filter(grant => grant.tenantId === identity.tenantId && grant.subjectId === identity.actorId && isActiveAccessGrant(grant))
      .map(grant => grant.capability);
    return Object.freeze([...new Set(capabilities)].sort());
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

  #commit(context: AccessContext, change: AccessGrantChange, create: boolean): Readonly<AccessGrant> {
    assertCapability(context, 'access.manage');
    assertResourceTenant(context, change.grant);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const grantKey = key(context.tenantId, change.grant.id);
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#grants.has(grantKey);
    if (create && exists) throw new Error('Access grant already exists');
    if (!create && !exists) throw new Error('Access grant not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    const grant = cloneGrant(change.grant);
    this.#grants.set(grantKey, grant);
    this.#audit.set(auditKey, Object.freeze(structuredClone(change.auditEvent)));
    this.#outbox.set(eventKey, Object.freeze(structuredClone(change.domainEvent)));
    return cloneGrant(grant);
  }
}
