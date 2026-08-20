import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  createAccessGrant,
  createAuditEvent,
  createDomainEvent,
  type AccessContext,
} from '@eutaktos/domain';
import { InMemoryAccessGrantUnitOfWork } from './access-grant-memory';

function context(capabilities: AccessContext['capabilities'] = ['access.manage', 'audit.read', 'tenant.manage']) {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'admin-a', capabilities });
}

function change(id = 'grant-1') {
  const grant = createAccessGrant({
    id,
    tenantId: 'tenant-a',
    subjectId: 'person-a',
    capability: 'people.read',
    grantedBy: 'admin-a',
    grantedAt: '2026-08-20T10:00:00.000Z',
  });
  return {
    grant,
    auditEvent: createAuditEvent({
      id: `audit-${id}`, tenantId: 'tenant-a', resourceType: 'access-grant', resourceId: id,
      action: 'grant', actorId: 'admin-a', occurredAt: '2026-08-20T10:00:00.000Z', changedFields: ['capability'],
    }),
    domainEvent: createDomainEvent({
      id: `event-${id}`, tenantId: 'tenant-a', type: 'CapabilityGranted', aggregateId: id,
      actorId: 'admin-a', occurredAt: '2026-08-20T10:00:00.000Z', schemaVersion: 1,
    }),
  };
}

describe('InMemoryAccessGrantUnitOfWork', () => {
  it('commits state + audit + outbox together and resolves active capabilities', () => {
    const store = new InMemoryAccessGrantUnitOfWork();
    store.commitCreate(context(), change());

    expect(store.listBySubject(context(), 'person-a')).toHaveLength(1);
    expect(store.listAudit(context())).toHaveLength(1);
    expect(store.listOutbox(context())).toHaveLength(1);
    expect(store.capabilitiesFor({ tenantId: 'tenant-a', actorId: 'person-a' })).toEqual(['people.read']);
  });

  it('resolves capabilities only for the exact tenant+actor identity', () => {
    const store = new InMemoryAccessGrantUnitOfWork([
      createAccessGrant({
        id: 'a', tenantId: 'tenant-a', subjectId: 'person-a', capability: 'people.read',
        grantedBy: 'admin-a', grantedAt: '2026-08-20T10:00:00.000Z',
      }),
      createAccessGrant({
        id: 'b', tenantId: 'tenant-b', subjectId: 'person-a', capability: 'tenant.manage',
        grantedBy: 'admin-b', grantedAt: '2026-08-20T10:00:00.000Z',
      }),
      createAccessGrant({
        id: 'c', tenantId: 'tenant-a', subjectId: 'person-b', capability: 'audit.read',
        grantedBy: 'admin-a', grantedAt: '2026-08-20T10:00:00.000Z',
      }),
    ]);

    expect(store.capabilitiesFor({ tenantId: 'tenant-a', actorId: 'person-a' })).toEqual(['people.read']);
    expect(store.capabilitiesFor({ tenantId: 'tenant-b', actorId: 'person-a' })).toEqual(['tenant.manage']);
  });

  it('drops revoked grants from capability resolution', () => {
    const store = new InMemoryAccessGrantUnitOfWork([
      createAccessGrant({
        id: 'a', tenantId: 'tenant-a', subjectId: 'person-a', capability: 'people.read',
        grantedBy: 'admin-a', grantedAt: '2026-08-20T10:00:00.000Z', revokedAt: '2026-08-20T11:00:00.000Z',
      }),
    ]);
    expect(store.capabilitiesFor({ tenantId: 'tenant-a', actorId: 'person-a' })).toEqual([]);
  });

  it('does not disclose foreign tenant grants through management reads', () => {
    const store = new InMemoryAccessGrantUnitOfWork([
      createAccessGrant({
        id: 'foreign', tenantId: 'tenant-b', subjectId: 'person-a', capability: 'people.read',
        grantedBy: 'admin-b', grantedAt: '2026-08-20T10:00:00.000Z',
      }),
    ]);
    expect(store.findById(context(), 'foreign')).toBeUndefined();
    expect(store.listBySubject(context(), 'person-a')).toEqual([]);
  });

  it('validates the whole write-set before mutation', () => {
    const store = new InMemoryAccessGrantUnitOfWork();
    const first = change('same');
    store.commitCreate(context(), first);
    const duplicateAudit = {
      ...change('second'),
      auditEvent: first.auditEvent,
    };

    expect(() => store.commitCreate(context(), duplicateAudit)).toThrow('Duplicate audit event id');
    expect(store.findById(context(), 'second')).toBeUndefined();
  });
});
