import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext, type AccessGrant } from '@eutaktos/domain';
import {
  AccessGrantService,
  type AccessGrantChange,
  type AccessGrantRuntime,
  type AccessGrantUnitOfWork,
} from './access-grant-service';

class FakeUnitOfWork implements AccessGrantUnitOfWork {
  readonly grants = new Map<string, Readonly<AccessGrant>>();
  readonly creates: AccessGrantChange[] = [];
  readonly updates: AccessGrantChange[] = [];

  listBySubject(context: AccessContext, subjectId: string): readonly Readonly<AccessGrant>[] {
    return [...this.grants.values()].filter(grant => grant.tenantId === context.tenantId && grant.subjectId === subjectId);
  }

  findById(context: AccessContext, grantId: string): Readonly<AccessGrant> | undefined {
    const grant = this.grants.get(grantId);
    return grant?.tenantId === context.tenantId ? grant : undefined;
  }

  commitCreate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant> {
    if (change.grant.tenantId !== context.tenantId) throw new Error('cross-tenant create');
    this.grants.set(change.grant.id, change.grant);
    this.creates.push(change);
    return change.grant;
  }

  commitUpdate(context: AccessContext, change: AccessGrantChange): Readonly<AccessGrant> {
    if (change.grant.tenantId !== context.tenantId) throw new Error('cross-tenant update');
    this.grants.set(change.grant.id, change.grant);
    this.updates.push(change);
    return change.grant;
  }
}

function context(capabilities: AccessContext['capabilities'] = ['access.manage']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'access-admin', capabilities });
}

function runtime(): AccessGrantRuntime {
  const counters = new Map<string, number>();
  return {
    now: () => '2026-08-20T18:00:00.000Z',
    nextId(scope) {
      const value = (counters.get(scope) ?? 0) + 1;
      counters.set(scope, value);
      return `${scope}-${value}`;
    },
  };
}

describe('AccessGrantService', () => {
  it('requires access.manage and does not let tenant.manage administer capabilities', () => {
    const service = new AccessGrantService(new FakeUnitOfWork(), runtime());
    expect(() => service.listBySubject(context(['tenant.manage']), 'person-a')).toThrow('missing capability access.manage');
    expect(() => service.grant(context(['tenant.manage']), { subjectId: 'person-a', capability: 'people.read' }))
      .toThrow('missing capability access.manage');
  });

  it('grants explicit capability access with atomic privacy-minimized audit/event metadata', () => {
    const unitOfWork = new FakeUnitOfWork();
    const service = new AccessGrantService(unitOfWork, runtime());

    const grant = service.grant(context(), { subjectId: 'person-a', capability: 'people.read' }, { correlationId: 'req-1' });

    expect(grant).toMatchObject({
      id: 'access-grant-1', tenantId: 'tenant-a', subjectId: 'person-a', capability: 'people.read', grantedBy: 'access-admin',
    });
    expect(unitOfWork.creates).toHaveLength(1);
    expect(unitOfWork.creates[0]?.auditEvent).toMatchObject({
      resourceType: 'access-grant', resourceId: 'access-grant-1', action: 'grant', actorId: 'access-admin',
    });
    expect(unitOfWork.creates[0]?.domainEvent).toMatchObject({
      type: 'CapabilityGranted', aggregateId: 'access-grant-1', correlationId: 'req-1',
    });
    expect(unitOfWork.creates[0]?.domainEvent).not.toHaveProperty('subjectId');
    expect(unitOfWork.creates[0]?.domainEvent).not.toHaveProperty('capability');
  });

  it('does not create duplicate active grants or duplicate audit events', () => {
    const unitOfWork = new FakeUnitOfWork();
    const service = new AccessGrantService(unitOfWork, runtime());
    const first = service.grant(context(), { subjectId: 'person-a', capability: 'people.read' });
    const second = service.grant(context(), { subjectId: 'person-a', capability: 'people.read' });

    expect(second.id).toBe(first.id);
    expect(unitOfWork.creates).toHaveLength(1);
  });

  it('revokes idempotently and writes one revoke audit/event', () => {
    const unitOfWork = new FakeUnitOfWork();
    const service = new AccessGrantService(unitOfWork, runtime());
    const grant = service.grant(context(), { subjectId: 'person-a', capability: 'reports.read' });

    const revoked = service.revoke(context(), grant.id, { correlationId: 'revoke-1' });
    const repeated = service.revoke(context(), grant.id, { correlationId: 'revoke-2' });

    expect(revoked.revokedAt).toBe('2026-08-20T18:00:00.000Z');
    expect(repeated.revokedAt).toBe(revoked.revokedAt);
    expect(unitOfWork.updates).toHaveLength(1);
    expect(unitOfWork.updates[0]?.domainEvent).toMatchObject({ type: 'CapabilityRevoked', correlationId: 'revoke-1' });
  });

  it('does not disclose another tenant grant by id', () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.grants.set('foreign', {
      id: 'foreign', tenantId: 'tenant-b', subjectId: 'person-b', capability: 'people.read',
      grantedBy: 'admin-b', grantedAt: '2026-08-20T10:00:00.000Z',
    });
    const service = new AccessGrantService(unitOfWork, runtime());
    expect(() => service.revoke(context(), 'foreign')).toThrow('Access grant not found');
  });

  it('fails closed if a faulty list adapter returns foreign tenant data', () => {
    const unitOfWork = new FakeUnitOfWork();
    unitOfWork.listBySubject = () => [{
      id: 'foreign', tenantId: 'tenant-b', subjectId: 'person-a', capability: 'people.read',
      grantedBy: 'admin-b', grantedAt: '2026-08-20T10:00:00.000Z',
    }];
    const service = new AccessGrantService(unitOfWork, runtime());
    expect(() => service.listBySubject(context(), 'person-a')).toThrow('Cross-tenant access denied');
  });
});
