import { describe, expect, it } from 'vitest';
import {
  archivePersonPublication,
  createAccessContext,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import {
  PeopleDirectoryService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from './people-service';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  readonly records = new Map<string, CongregationPerson>();
  readonly updates: PersonChange[] = [];
  constructor(seed: readonly CongregationPerson[]) { for (const person of seed) this.records.set(`${person.tenantId}:${person.id}`, person); }
  list(context: AccessContext): readonly CongregationPerson[] { return [...this.records.values()].filter(person => person.tenantId === context.tenantId); }
  findById(context: AccessContext, personId: string): CongregationPerson | undefined { return this.records.get(`${context.tenantId}:${personId}`); }
  commitCreate(): CongregationPerson { throw new Error('not used'); }
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson { this.records.set(`${context.tenantId}:${change.person.id}`, change.person); this.updates.push(change); return change.person; }
}

function runtime(): ApplicationRuntime {
  return { now: () => '2026-08-27T10:45:00.000Z', nextId: scope => `${scope}-1` };
}

function context(): Readonly<AccessContext> {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities: ['people.read', 'people.write'] });
}

function person(): CongregationPerson {
  return { id: 'person-1', tenantId: 'tenant-a', displayName: 'Ana Costa', active: true, availability: [], eligibility: [], emergencyContacts: [] };
}

describe('PeopleDirectoryService archive guard', () => {
  it('requires the explicit restore use case before an archived person can become active', () => {
    const archived = archivePersonPublication(person(), { actorId: 'elder-1', occurredAt: '2026-08-27T10:30:00.000Z', reason: 'A não publicar' });
    const unitOfWork = new FakePeopleUnitOfWork([archived]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    expect(() => service.updateProfile(context(), { personId: 'person-1', active: true })).toThrow('active must be restored explicitly for archived person');
    expect(unitOfWork.updates).toHaveLength(0);
    expect(unitOfWork.findById(context(), 'person-1')?.active).toBe(false);
  });

  it('still permits normal active-state changes when no archive state exists', () => {
    const unitOfWork = new FakePeopleUnitOfWork([person()]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());
    expect(service.updateProfile(context(), { personId: 'person-1', active: false }).active).toBe(false);
    expect(service.updateProfile(context(), { personId: 'person-1', active: true }).active).toBe(true);
    expect(unitOfWork.updates).toHaveLength(2);
  });
});
