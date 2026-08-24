import { describe, expect, it } from 'vitest';
import { createAccessContext, type Capability } from '@eutaktos/domain';
import { parsePortableJson, serializePortableJson, type PortablePerson } from './portable-json';
import { MigrationWorkflowService, type MigrationWorkflowUnitOfWork } from './migration-workflow-service';
import { createMigrationSchema } from './migration-schema';

const now = '2026-08-24T12:00:00.000Z';
const ctx = (tenantId = 'tenant-a', capabilities: readonly Capability[] = ['people.write']) => createAccessContext({ tenantId, actorId: 'actor-1', capabilities });

function runtime() {
  let n = 0;
  return { now: () => now, nextId: (scope: string) => `${scope}-${++n}` };
}

describe('KP6 export / restore round-trip', () => {
  it('round-trips canonical portable people without changing identity data', () => {
    const people: PortablePerson[] = [
      { externalId: 'ext-1', displayName: 'Alice One', active: true, preferredLocale: 'pt-PT' },
      { externalId: 'ext-2', displayName: 'Bob Two', active: false },
    ];
    const exported = serializePortableJson({ sourceTenantId: 'tenant-a', people }, now);
    const restored = parsePortableJson(exported);
    const reExported = serializePortableJson({ sourceTenantId: restored.sourceTenantId, people: restored.people }, restored.exportedAt);
    expect(parsePortableJson(reExported)).toEqual(restored);
  });

  it('rejects duplicate stable external ids deterministically', () => {
    expect(() => serializePortableJson({ sourceTenantId: 'tenant-a', people: [
      { externalId: 'same', displayName: 'One', active: true },
      { externalId: 'same', displayName: 'Two', active: true },
    ] }, now)).toThrow('Duplicate externalId: same');
  });

  it('rejects malformed and unknown fields rather than silently dropping them', () => {
    expect(() => parsePortableJson('{"format":"eutaktos-portable","version":1,"exportedAt":"2026-08-24T12:00:00Z","sourceTenantId":"tenant-a","people":[{"externalId":"x","displayName":"X","active":true,"unknown":"bad"}]}')).toThrow('contains unknown fields');
    expect(() => parsePortableJson('not json')).toThrow('Invalid portable JSON');
  });

  it('never uses displayName as identity during migration restore planning', () => {
    const existing = [{ id: 'internal-1', externalId: 'ext-1', displayName: 'Same Name', active: true }];
    const rows = createMigrationSchema([
      { externalId: 'ext-new', displayName: 'Same Name', active: true },
    ], now).rows;
    const changes: unknown[] = [];
    const uow: MigrationWorkflowUnitOfWork = {
      listExistingPeople: () => existing,
      commitMigration: (_context, change) => { changes.push(change); },
      findMigration: () => undefined,
      commitRollback: () => undefined,
    };
    const service = new MigrationWorkflowService(uow, runtime());
    const prepared = service.prepare(ctx(), rows);
    expect(prepared.preview.items[0]?.action).toBe('create');
    service.execute(ctx(), rows, prepared.confirmation);
    expect(changes).toHaveLength(1);
  });

  it('dry-run prepare has no persistence side effects', () => {
    const changes: unknown[] = [];
    const rows = createMigrationSchema([{ externalId: 'ext-1', displayName: 'New', active: true }], now).rows;
    const service = new MigrationWorkflowService({ listExistingPeople: () => [], commitMigration: (_context, change) => changes.push(change), findMigration: () => undefined, commitRollback: () => undefined }, runtime());
    const prepared = service.prepare(ctx(), rows);
    expect(prepared.preview.counts.create).toBe(1);
    expect(changes).toHaveLength(0);
  });

  it('stale confirmation is rejected and does not commit', () => {
    const existingRef = [{ id: 'internal-1', externalId: 'ext-1', displayName: 'Old', active: true }];
    const rows = createMigrationSchema([{ externalId: 'ext-1', displayName: 'New', active: true }], now).rows;
    const changes: unknown[] = [];
    const service = new MigrationWorkflowService({ listExistingPeople: () => existingRef, commitMigration: (_context, change) => changes.push(change), findMigration: () => undefined, commitRollback: () => undefined }, runtime());
    const prepared = service.prepare(ctx(), rows);
    existingRef[0].displayName = 'Changed';
    expect(() => service.execute(ctx(), rows, prepared.confirmation)).toThrow('stale');
    expect(changes).toHaveLength(0);
  });
});
