import { describe, expect, it } from 'vitest';
import { createAccessContext } from './access-control';
import { InMemoryTenantRepository } from './repository';

interface RecordFixture {
  id: string;
  tenantId: string;
  value: string;
}

function context(tenantId: string, capabilities: readonly ('people.read' | 'people.write')[]) {
  return createAccessContext({ tenantId, actorId: `actor-${tenantId}`, capabilities });
}

describe('InMemoryTenantRepository', () => {
  it('lists only records for the active tenant', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write', [
      { id: 'same-id', tenantId: 'tenant-a', value: 'A' },
      { id: 'same-id', tenantId: 'tenant-b', value: 'B' },
    ]);

    expect(repository.list(context('tenant-a', ['people.read']))).toEqual([
      { id: 'same-id', tenantId: 'tenant-a', value: 'A' },
    ]);
  });

  it('does not leak another tenant record through id lookup', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write', [
      { id: 'person-1', tenantId: 'tenant-b', value: 'private' },
    ]);

    expect(repository.findById(context('tenant-a', ['people.read']), 'person-1')).toBeUndefined();
  });

  it('rejects cross-tenant writes even when the actor has write capability', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write');

    expect(() =>
      repository.save(context('tenant-a', ['people.write']), {
        id: 'person-1',
        tenantId: 'tenant-b',
        value: 'blocked',
      }),
    ).toThrow('Cross-tenant access denied');
  });

  it('requires the configured capability at the repository boundary', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write');

    expect(() => repository.list(context('tenant-a', []))).toThrow(
      'Access denied: missing capability people.read',
    );
    expect(() =>
      repository.save(context('tenant-a', ['people.read']), {
        id: 'person-1',
        tenantId: 'tenant-a',
        value: 'blocked',
      }),
    ).toThrow('Access denied: missing capability people.write');
  });

  it('allows identical ids in different tenants without collisions', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write');
    const tenantA = context('tenant-a', ['people.read', 'people.write']);
    const tenantB = context('tenant-b', ['people.read', 'people.write']);

    repository.save(tenantA, { id: 'person-1', tenantId: 'tenant-a', value: 'A' });
    repository.save(tenantB, { id: 'person-1', tenantId: 'tenant-b', value: 'B' });

    expect(repository.findById(tenantA, 'person-1')?.value).toBe('A');
    expect(repository.findById(tenantB, 'person-1')?.value).toBe('B');
  });

  it('deletes only within the active tenant', () => {
    const repository = new InMemoryTenantRepository<RecordFixture>('people.read', 'people.write', [
      { id: 'person-1', tenantId: 'tenant-a', value: 'A' },
      { id: 'person-1', tenantId: 'tenant-b', value: 'B' },
    ]);
    const tenantA = context('tenant-a', ['people.read', 'people.write']);
    const tenantB = context('tenant-b', ['people.read']);

    expect(repository.delete(tenantA, 'person-1')).toBe(true);
    expect(repository.findById(tenantA, 'person-1')).toBeUndefined();
    expect(repository.findById(tenantB, 'person-1')?.value).toBe('B');
  });
});
