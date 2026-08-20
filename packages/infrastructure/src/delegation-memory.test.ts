import { describe, expect, it } from 'vitest';
import {
  DelegationService,
  type DelegationRuntime,
} from '@eutaktos/application';
import { createAccessContext, type AccessContext } from '@eutaktos/domain';
import { InMemoryDelegationUnitOfWork } from './delegation-memory';

function runtime(prefix = ''): DelegationRuntime {
  const counters = new Map<string, number>();
  return {
    now: () => '2026-08-20T17:00:00.000Z',
    nextId: scope => {
      const next = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, next);
      return `${prefix}${scope}-${next}`;
    },
  };
}

function context(
  tenantId = 'tenant-a',
  capabilities: AccessContext['capabilities'] = ['delegations.read', 'delegations.write'],
) {
  return createAccessContext({ tenantId, actorId: `${tenantId}-admin`, capabilities });
}

const input = {
  grantorId: 'person-a',
  delegateId: 'person-b',
  scopes: ['reports.submit'] as const,
  startsAt: '2026-08-21T00:00:00.000Z',
  endsAt: '2026-09-21T00:00:00.000Z',
};

describe('InMemoryDelegationUnitOfWork', () => {
  it('persists grant/revoke state with audit and outbox atomically', () => {
    const unitOfWork = new InMemoryDelegationUnitOfWork();
    const service = new DelegationService(unitOfWork, runtime());
    const ctx = context();

    const granted = service.grant(ctx, input);
    service.revoke(ctx, granted.id);

    expect(service.list(ctx)[0]?.revokedAt).toBe('2026-08-20T17:00:00.000Z');
    expect(unitOfWork.listAudit(context('tenant-a', ['audit.read']))).toHaveLength(2);
    expect(unitOfWork.listOutbox(context('tenant-a', ['tenant.manage'])).map(event => event.type)).toEqual([
      'DelegationGranted',
      'DelegationRevoked',
    ]);
  });

  it('isolates reads and identifier lookups by tenant', () => {
    const unitOfWork = new InMemoryDelegationUnitOfWork();
    const serviceA = new DelegationService(unitOfWork, runtime('a-'));
    const serviceB = new DelegationService(unitOfWork, runtime('b-'));
    const a = serviceA.grant(context('tenant-a'), input);
    serviceB.grant(context('tenant-b'), { ...input, grantorId: 'person-c', delegateId: 'person-d' });

    expect(serviceA.list(context('tenant-a'))).toHaveLength(1);
    expect(serviceB.list(context('tenant-b'))).toHaveLength(1);
    expect(() => serviceB.revoke(context('tenant-b', ['delegations.write']), a.id)).toThrow('Delegation not found');
  });

  it('enforces capabilities at the persistence boundary', () => {
    const unitOfWork = new InMemoryDelegationUnitOfWork();
    expect(() => unitOfWork.list(context('tenant-a', []))).toThrow('missing capability delegations.read');
    expect(() => unitOfWork.findById(context('tenant-a', []), 'd-1')).toThrow('missing capability delegations.write');
    expect(() => unitOfWork.listAudit(context('tenant-a', ['delegations.read']))).toThrow('missing capability audit.read');
  });
});
