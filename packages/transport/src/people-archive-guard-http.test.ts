import { describe, expect, it } from 'vitest';
import {
  archivePersonPublication,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import {
  PeopleDirectoryService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from '@eutaktos/application';
import { PeopleHttpTransport } from './people-http';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  readonly records = new Map<string, CongregationPerson>();
  constructor(seed: readonly CongregationPerson[]) { for (const person of seed) this.records.set(`${person.tenantId}:${person.id}`, person); }
  list(context: AccessContext): readonly CongregationPerson[] { return [...this.records.values()].filter(person => person.tenantId === context.tenantId); }
  findById(context: AccessContext, personId: string): CongregationPerson | undefined { return this.records.get(`${context.tenantId}:${personId}`); }
  commitCreate(): CongregationPerson { throw new Error('not used'); }
  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson { this.records.set(`${context.tenantId}:${change.person.id}`, change.person); return change.person; }
}

const runtime: ApplicationRuntime = { now: () => '2026-08-27T10:45:00.000Z', nextId: scope => `${scope}-1` };

describe('PeopleHttpTransport archived person guard', () => {
  it('returns a validation response instead of reactivating an archived person', () => {
    const person: CongregationPerson = { id: 'person-1', tenantId: 'tenant-a', displayName: 'Ana Costa', active: true, availability: [], eligibility: [], emergencyContacts: [] };
    const archived = archivePersonPublication(person, { actorId: 'elder-1', occurredAt: '2026-08-27T10:30:00.000Z', reason: 'A não publicar' });
    const unitOfWork = new FakePeopleUnitOfWork([archived]);
    const transport = new PeopleHttpTransport(new PeopleDirectoryService(unitOfWork, runtime));

    expect(transport.update({
      principal: { tenantId: 'tenant-a', actorId: 'elder-1', capabilities: ['people.read', 'people.write'] },
      params: { personId: 'person-1' },
      body: { active: true },
    })).toEqual({ status: 400, body: { error: 'active must be restored explicitly for archived person' } });
    expect(unitOfWork.findById({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities: [] }, 'person-1')?.active).toBe(false);
  });
});
