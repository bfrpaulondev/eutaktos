import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext } from '@eutaktos/domain';
import {
  DelegationService,
  type DelegationChange,
  type DelegationRecord,
  type DelegationRuntime,
  type DelegationUnitOfWork,
} from './delegation-service';

class FakeDelegationUnitOfWork implements DelegationUnitOfWork {
  readonly records = new Map<string, DelegationRecord>();
  readonly creates: DelegationChange[] = [];
  readonly updates: DelegationChange[] = [];

  list(context: AccessContext): readonly DelegationRecord[] {
    return [...this.records.values()].filter(item => item.tenantId === context.tenantId);
  }

  findById(context: AccessContext, delegationId: string): DelegationRecord | undefined {
    const item = this.records.get(delegationId);
    return item?.tenantId === context.tenantId ? item : undefined;
  }

  commitCreate(context: AccessContext, change: DelegationChange): DelegationRecord {
    if (change.delegation.tenantId !== context.tenantId) throw new Error('cross-tenant create');
    const next = structuredClone(change.delegation);
    this.records.set(next.id, next);
    this.creates.push(change);
    return next;
  }

  commitUpdate(context: AccessContext, change: DelegationChange): DelegationRecord {
    if (change.delegation.tenantId !== context.tenantId) throw new Error('cross-tenant update');
    const next = structuredClone(change.delegation);
    this.records.set(next.id, next);
    this.updates.push(change);
    return next;
  }
}

function runtime(): DelegationRuntime {
  const counters = new Map<string, number>();
  return {
    now: () => '2026-08-20T17:00:00.000Z',
    nextId: scope => {
      const next = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, next);
      return `${scope}-${next}`;
    },
  };
}

function context(capabilities: AccessContext['capabilities'] = ['delegations.read', 'delegations.write']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-1', capabilities });
}

function grantInput() {
  return {
    grantorId: 'person-a',
    delegateId: 'person-b',
    scopes: ['reports.submit', 'availability.submit'] as const,
    startsAt: '2026-08-21T00:00:00.000Z',
    endsAt: '2026-09-21T00:00:00.000Z',
  };
}

describe('DelegationService', () => {
  it('grants a tenant-scoped delegation with atomic audit and privacy-minimized event metadata', () => {
    const unitOfWork = new FakeDelegationUnitOfWork();
    const service = new DelegationService(unitOfWork, runtime());

    const granted = service.grant(context(), grantInput(), { correlationId: 'request-1' });

    expect(granted).toMatchObject({
      id: 'delegation-1',
      tenantId: 'tenant-a',
      grantorId: 'person-a',
      delegateId: 'person-b',
      scopes: ['availability.submit', 'reports.submit'],
      grantedAt: '2026-08-20T17:00:00.000Z',
    });
    expect(unitOfWork.creates[0]?.auditEvent).toMatchObject({
      resourceType: 'delegation', action: 'grant', actorId: 'admin-1', tenantId: 'tenant-a',
    });
    expect(unitOfWork.creates[0]?.domainEvent).toMatchObject({
      type: 'DelegationGranted', aggregateId: 'delegation-1', actorId: 'admin-1', correlationId: 'request-1',
    });
    expect(unitOfWork.creates[0]?.domainEvent).not.toHaveProperty('scopes');
    expect(unitOfWork.creates[0]?.domainEvent).not.toHaveProperty('delegateId');
  });

  it('requires dedicated read and write capabilities', () => {
    const service = new DelegationService(new FakeDelegationUnitOfWork(), runtime());
    expect(() => service.list(context(['delegations.write']))).toThrow('missing capability delegations.read');
    expect(() => service.grant(context(['delegations.read']), grantInput())).toThrow('missing capability delegations.write');
  });

  it('revokes idempotently and records one revoke audit/event only', () => {
    const unitOfWork = new FakeDelegationUnitOfWork();
    const service = new DelegationService(unitOfWork, runtime());
    const ctx = context();
    const granted = service.grant(ctx, grantInput());

    const revoked = service.revoke(ctx, granted.id, { correlationId: 'revoke-1' });
    const repeated = service.revoke(ctx, granted.id, { correlationId: 'revoke-2' });

    expect(revoked.revokedAt).toBe('2026-08-20T17:00:00.000Z');
    expect(repeated.revokedAt).toBe(revoked.revokedAt);
    expect(unitOfWork.updates).toHaveLength(1);
    expect(unitOfWork.updates[0]?.auditEvent).toMatchObject({ action: 'revoke', changedFields: ['revokedAt'] });
    expect(unitOfWork.updates[0]?.domainEvent).toMatchObject({ type: 'DelegationRevoked', correlationId: 'revoke-1' });
  });

  it('returns not found instead of disclosing another tenant delegation', () => {
    const unitOfWork = new FakeDelegationUnitOfWork();
    const service = new DelegationService(unitOfWork, runtime());
    const foreignService = new DelegationService(unitOfWork, runtime());
    const foreignContext = createAccessContext({
      tenantId: 'tenant-b', actorId: 'admin-b', capabilities: ['delegations.write'],
    });
    const foreign = foreignService.grant(foreignContext, grantInput());

    expect(() => service.revoke(context(['delegations.write']), foreign.id)).toThrow('Delegation not found');
  });

  it('defends against a faulty adapter returning a foreign tenant record', () => {
    const unitOfWork = new FakeDelegationUnitOfWork();
    unitOfWork.list = () => [{
      id: 'foreign', tenantId: 'tenant-b', grantorId: 'a', delegateId: 'b', scopes: ['reports.submit'],
      startsAt: '2026-08-21T00:00:00Z', grantedAt: '2026-08-20T00:00:00Z',
    }];
    const service = new DelegationService(unitOfWork, runtime());

    expect(() => service.list(context(['delegations.read']))).toThrow('Cross-tenant access denied');
  });
});
