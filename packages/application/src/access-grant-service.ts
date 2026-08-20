import {
  assertCapability,
  assertResourceTenant,
  createAccessGrant,
  createAuditEvent,
  createDomainEvent,
  isActiveAccessGrant,
  revokeAccessGrant,
  type AccessContext,
  type AccessGrant,
  type AuditEvent,
  type Capability,
  type DomainEvent,
} from '@eutaktos/domain';
import { eventCorrelation, type RequestMetadata } from './people-service';

export interface GrantCapabilityInput {
  subjectId: string;
  capability: Capability;
}

export interface AccessGrantChange {
  grant: Readonly<AccessGrant>;
  auditEvent: Readonly<AuditEvent>;
  domainEvent: Readonly<DomainEvent>;
}

export interface AccessGrantUnitOfWork {
  listBySubject(context: AccessContext, subjectId: string): readonly Readonly<AccessGrant>[];
  findById(context: AccessContext, grantId: string): Readonly<AccessGrant> | undefined;
  commitCreate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant>;
  commitUpdate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant>;
}

export interface AccessGrantRuntime {
  now(): string;
  nextId(scope: 'access-grant' | 'audit' | 'event'): string;
}

function identifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  if (normalized.length > 200) throw new Error(`${field} is too long`);
  return normalized;
}

export class AccessGrantService {
  readonly #unitOfWork: AccessGrantUnitOfWork;
  readonly #runtime: AccessGrantRuntime;

  constructor(unitOfWork: AccessGrantUnitOfWork, runtime: AccessGrantRuntime) {
    this.#unitOfWork = unitOfWork;
    this.#runtime = runtime;
  }

  listBySubject(context: AccessContext, subjectId: string): readonly Readonly<AccessGrant>[] {
    assertCapability(context, 'access.manage');
    const normalized = identifier(subjectId, 'subjectId');
    const grants = this.#unitOfWork.listBySubject(context, normalized);
    grants.forEach(grant => assertResourceTenant(context, grant));
    return grants;
  }

  grant(
    context: AccessContext,
    input: GrantCapabilityInput,
    metadata: RequestMetadata = {},
  ): Readonly<AccessGrant> {
    assertCapability(context, 'access.manage');
    const subjectId = identifier(input.subjectId, 'subjectId');
    const existing = this.#unitOfWork
      .listBySubject(context, subjectId)
      .find(grant => grant.capability === input.capability && isActiveAccessGrant(grant));
    if (existing) {
      assertResourceTenant(context, existing);
      return existing;
    }

    const occurredAt = this.#runtime.now();
    const grant = createAccessGrant({
      id: this.#runtime.nextId('access-grant'),
      tenantId: context.tenantId,
      subjectId,
      capability: input.capability,
      grantedBy: context.actorId,
      grantedAt: occurredAt,
    });
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'access-grant',
      resourceId: grant.id,
      action: 'grant',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['capability'],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'CapabilityGranted',
      aggregateId: grant.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });
    return this.#unitOfWork.commitCreate(context, { grant, auditEvent, domainEvent });
  }

  revoke(
    context: AccessContext,
    grantId: string,
    metadata: RequestMetadata = {},
  ): Readonly<AccessGrant> {
    assertCapability(context, 'access.manage');
    const normalized = identifier(grantId, 'grantId');
    const existing = this.#unitOfWork.findById(context, normalized);
    if (!existing) throw new Error('Access grant not found');
    assertResourceTenant(context, existing);
    if (!isActiveAccessGrant(existing)) return existing;

    const occurredAt = this.#runtime.now();
    const grant = revokeAccessGrant(existing, occurredAt);
    const auditEvent = createAuditEvent({
      id: this.#runtime.nextId('audit'),
      tenantId: context.tenantId,
      resourceType: 'access-grant',
      resourceId: grant.id,
      action: 'revoke',
      actorId: context.actorId,
      occurredAt,
      changedFields: ['capability'],
    });
    const domainEvent = createDomainEvent({
      id: this.#runtime.nextId('event'),
      tenantId: context.tenantId,
      type: 'CapabilityRevoked',
      aggregateId: grant.id,
      actorId: context.actorId,
      occurredAt,
      schemaVersion: 1,
      ...eventCorrelation(metadata),
    });
    return this.#unitOfWork.commitUpdate(context, { grant, auditEvent, domainEvent });
  }
}
