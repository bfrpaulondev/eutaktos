import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  isPersonPublicationArchived,
  personArchiveState,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import {
  PersonArchiveService,
} from './person-archive-service';
import type { ApplicationRuntime, PeopleUnitOfWork, PersonChange } from './people-service';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  readonly records = new Map<string, CongregationPerson>();
  readonly updates: PersonChange[] = [];
  constructor(seed: readonly CongregationPerson[]) { for (const person of seed) this.records.set(`${person.tenantId}:${person.id}`, person); }
  list(context: AccessContext): readonly CongregationPerson[] { return [...this.records.values()].filter(person => person.tenantId === context.tenantId); }
  findById(context: AccessContext, personId: string): CongregationPerson | undefined { return this.records.get(`${context.tenantId}:${personId}`); }
  commitCreate(): CongregationPerson { throw new Error('not used'); }
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    this.records.set(`${context.tenantId}:${change.person.id}`, change.person);
    this.updates.push(change);
    return change.person;
  }
}

function person(): CongregationPerson {
  return { id: 'person-1', tenantId: 'tenant-a', displayName: 'Ana Costa', active: true, availability: [], eligibility: [], emergencyContacts: [] };
}
function context(capabilities: AccessContext['capabilities']): Readonly<AccessContext> {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities });
}
function runtime(): ApplicationRuntime {
  let audit = 0; let event = 0;
  return { now: () => '2026-08-27T10:30:00.000Z', nextId: scope => scope === 'audit' ? `audit-${++audit}` : scope === 'event' ? `event-${++event}` : `${scope}-1` };
}

describe('PersonArchiveService', () => {
  it('archives with visible reason/date and privacy-minimized audit metadata', () => {
    const unitOfWork = new FakePeopleUnitOfWork([person()]);
    const service = new PersonArchiveService(unitOfWork, runtime());
    const archived = service.archive(context(['people.read', 'people.write']), { personId: 'person-1', reason: '  A não publicar   temporariamente ' }, { correlationId: 'request-1' });
    expect(archived.active).toBe(false);
    expect(isPersonPublicationArchived(archived)).toBe(true);
    expect(personArchiveState(archived).current).toEqual({ actorId: 'elder-1', archivedAt: '2026-08-27T10:30:00.000Z', reason: 'A não publicar temporariamente' });
    expect(personArchiveState(archived).history).toEqual([{ action: 'archived', actorId: 'elder-1', occurredAt: '2026-08-27T10:30:00.000Z', reason: 'A não publicar temporariamente' }]);
    expect(unitOfWork.updates[0]?.auditEvent.changedFields).toEqual(['active', 'publicationArchive']);
    expect(JSON.stringify({ audit: unitOfWork.updates[0]?.auditEvent, event: unitOfWork.updates[0]?.domainEvent })).not.toContain('A não publicar temporariamente');
  });

  it('restores only explicitly and preserves append-only archive history', () => {
    const unitOfWork = new FakePeopleUnitOfWork([person()]);
    const service = new PersonArchiveService(unitOfWork, runtime());
    const access = context(['people.read', 'people.write']);
    const archived = service.archive(access, { personId: 'person-1', reason: 'Registo histórico' });
    expect(archived.active).toBe(false);
    const restored = service.restore(access, { personId: 'person-1' });
    expect(restored.active).toBe(true);
    expect(isPersonPublicationArchived(restored)).toBe(false);
    expect(personArchiveState(restored).history.map(entry => entry.action)).toEqual(['archived', 'restored']);
  });

  it('rejects duplicate archive, restore without archive, invalid reasons and missing capabilities', () => {
    const unitOfWork = new FakePeopleUnitOfWork([person()]);
    const service = new PersonArchiveService(unitOfWork, runtime());
    const access = context(['people.read', 'people.write']);
    expect(() => service.archive(access, { personId: 'person-1', reason: '   ' })).toThrow('archiveReason is required');
    service.archive(access, { personId: 'person-1', reason: 'A não publicar' });
    expect(() => service.archive(access, { personId: 'person-1', reason: 'Outra' })).toThrow('Person is already archived');
    const fresh = new PersonArchiveService(new FakePeopleUnitOfWork([person()]), runtime());
    expect(() => fresh.restore(access, { personId: 'person-1' })).toThrow('Person is not archived');
    expect(() => fresh.archive(context(['people.read']), { personId: 'person-1', reason: 'A não publicar' })).toThrow('Access denied: missing capability people.write');
  });

  it('defends tenant scope even if an adapter returns another tenant resource', () => {
    const unitOfWork = new FakePeopleUnitOfWork([]);
    unitOfWork.findById = () => ({ ...person(), tenantId: 'tenant-b' });
    const service = new PersonArchiveService(unitOfWork, runtime());
    expect(() => service.archive(context(['people.read', 'people.write']), { personId: 'person-1', reason: 'A não publicar' })).toThrow('Cross-tenant access denied');
  });
});
