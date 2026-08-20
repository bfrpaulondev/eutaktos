import {
  assertCapability,
  assertResourceTenant,
  createAuditEvent,
  createDelegation,
  createDomainEvent,
  type AccessContext,
  type AuditEvent,
  type DelegatedScope,
  type Delegation,
  type DomainEvent,
  type PersonId,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface DelegationRecord extends Delegation {
  id: string;
}

export interface GrantDelegationInput {
  grantorId: PersonId;
  delegateId: PersonId;
  scopes: readonly DelegatedScope[];
  startsAt: string;
  endsAt?: string;
}

export interface DelegationChange {
  delegation: Readonly<DelegationRecord>;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

/** Atomic repository boundary: delegation state, immutable audit and outbox event commit together. */
export interface DelegationUnitOfWork {
  list(context: AccessContext): readonly DelegationRecord[];
  findById(context: AccessContext, delegationId: string): DelegationRecord | undefined;
  commitCreate(context: AccessContext, change: DelegationChange): DelegationRecord;
  commitUpdate(context: AccessContext, change: DelegationChange): DelegationRecord;
}

export interface DelegationRuntime {
  now(): string;
  nextId(scope: 'delegation' | 'audit' | 'event'): string;
}

function record(id: string, delegation: Readonly<Delegation>): Readonly<DelegationRecord> {
  return Object.freeze({ id, ...delegation });
}

export class DelegationService {
  readonly #unitOfWork: DelegationUnitOfWork;
  readonly #runtime: DelegationRuntime;

  constructor(unitOfWork: DelegationUnitOfWork, runtime: DelegationRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  list(context: AccessContext): readonly DelegationRecord[] {
    assertCapability(context, 'delegations.read');
    const delegations = this.#unitOfWork.list(context);
    for (const delegation of delegations) assertResourceTenant(context, delegation);
    return delegations;
  }

  grant(
    context: AccessContext,
    input: GrantDelegationInput,
    metadata: RequestMetadata = {},
  ): DelegationRecord {
    assertCapability(context, 'delegations.write');
    const occurredAt = this.#runtime.now();
    const delegation = createDelegation({
      tenantId: context.tenantId,
      grantorId: input.grantorId,
      delegateId: input.delegateId,
      scopes: input.scopes,
      startsAt: input.startsAt,
      ...(input.endsAt ? { endsAt: input.endsAt } : {}),
      grantedAt: occurredAt,
    });
    const created = record(this.#runtime.nextId('delegation'), delegation);
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'delegation',
      resourceId: created.id,
      action: 'grant',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['delegateId', 'endsAt', 'grantorId', 'scopes', 'startsAt'],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'DelegationGranted',
      aggregateId: created.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });
    return this.#unitOfWork.commitCreate(context, { delegation: created, auditEvent, domainEvent });
  }

  revoke(
    context: AccessContext,
    delegationId: string,
    metadata: RequestMetadata = {},
  ): DelegationRecord {
    assertCapability(context, 'delegations.write');
    const current = this.#unitOfWork.findById(context, delegationId);
    if (!current) throw new Error('Delegation not found');
    assertResourceTenant(context, current);
    if (current.revokedAt) return current;

    const occurredAt = this.#runtime.now();
    const { id, ...delegation } = current;
    const revoked = record(id, createDelegation({ ...delegation, revokedAt: occurredAt }));
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'delegation',
      resourceId: id,
      action: 'revoke',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['revokedAt'],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'DelegationRevoked',
      aggregateId: id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });
    return this.#unitOfWork.commitUpdate(context, { delegation: revoked, auditEvent, domainEvent });
  }
}
