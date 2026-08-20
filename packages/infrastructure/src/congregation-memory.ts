import type {
  CongregationChange,
  CongregationUnitOfWork,
} from '@eutaktos/application';
import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type AuditEvent,
  type CongregationProfile,
  type DomainEvent,
} from '@eutaktos/domain';

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneProfile(profile: CongregationProfile): CongregationProfile {
  return structuredClone(profile);
}

export class InMemoryCongregationUnitOfWork implements CongregationUnitOfWork {
  readonly #profiles = new Map<string, CongregationProfile>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly CongregationProfile[] = []) {
    for (const profile of seed) {
      if (this.#profiles.has(profile.tenantId)) throw new Error('Duplicate tenant congregation profile');
      this.#profiles.set(profile.tenantId, cloneProfile(profile));
    }
  }

  findProfile(context: AccessContext): CongregationProfile | undefined {
    assertCapability(context, 'tenant.manage');
    const profile = this.#profiles.get(context.tenantId);
    return profile ? cloneProfile(profile) : undefined;
  }

  commitCreate(context: AccessContext, change: CongregationChange): CongregationProfile {
    return this.#commit(context, change, true);
  }

  commitUpdate(context: AccessContext, change: CongregationChange): CongregationProfile {
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

  #commit(context: AccessContext, change: CongregationChange, create: boolean): CongregationProfile {
    assertCapability(context, 'tenant.manage');
    assertResourceTenant(context, change.profile);
    assertResourceTenant(context, change.auditEvent);
    assertResourceTenant(context, change.domainEvent);

    const profileKey = context.tenantId;
    const auditKey = key(context.tenantId, change.auditEvent.id);
    const eventKey = key(context.tenantId, change.domainEvent.id);
    const exists = this.#profiles.has(profileKey);

    if (create && exists) throw new Error('Congregation profile already exists');
    if (!create && !exists) throw new Error('Congregation profile not found');
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');

    // Validate the complete write-set before mutating any collection. A production
    // adapter must preserve this all-or-nothing behavior in a database transaction.
    const profile = cloneProfile(change.profile);
    const auditEvent = Object.freeze(structuredClone(change.auditEvent));
    const domainEvent = Object.freeze(structuredClone(change.domainEvent));

    this.#profiles.set(profileKey, profile);
    this.#audit.set(auditKey, auditEvent);
    this.#outbox.set(eventKey, domainEvent);
    return cloneProfile(profile);
  }
}
