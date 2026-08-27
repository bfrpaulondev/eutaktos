import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import {
  PeopleDirectoryService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from './people-service';

class UnitOfWork implements PeopleUnitOfWork {
  person: CongregationPerson;
  update?: PersonChange;

  constructor(person: CongregationPerson) { this.person = person; }
  list(context: AccessContext): readonly CongregationPerson[] { return this.person.tenantId === context.tenantId ? [this.person] : []; }
  findById(context: AccessContext, personId: string): CongregationPerson | undefined { return this.person.tenantId === context.tenantId && this.person.id === personId ? this.person : undefined; }
  commitCreate(): CongregationPerson { throw new Error('not used'); }
  commitUpdate(_context: AccessContext, change: PersonChange): CongregationPerson { this.update = change; this.person = change.person; return change.person; }
}

function runtime(): ApplicationRuntime {
  let audit = 0;
  let event = 0;
  return {
    now: () => '2026-08-27T06:00:00.000Z',
    nextId: scope => scope === 'audit' ? `audit-${++audit}` : scope === 'event' ? `event-${++event}` : `${scope}-1`,
  };
}

const writer = createAccessContext({
  tenantId: 'tenant-a', actorId: 'actor-a', capabilities: ['people.read', 'people.write'],
});

function fixture(): CongregationPerson {
  return { id: 'p1', tenantId: 'tenant-a', displayName: 'Ana Costa', active: true, availability: [], eligibility: [] };
}

describe('PeopleDirectoryService labels', () => {
  it('normalizes labels and records only the changed field in audit/event metadata', () => {
    const unit = new UnitOfWork(fixture());
    const service = new PeopleDirectoryService(unit, runtime());

    const updated = service.updateProfile(writer, { personId: 'p1', labels: ['  Visita ', 'apoio', 'VISITA'] });

    expect(updated.labels).toEqual(['apoio', 'Visita']);
    expect(unit.update?.auditEvent).toMatchObject({ changedFields: ['labels'], resourceId: 'p1', actorId: 'actor-a' });
    expect(JSON.stringify(unit.update?.auditEvent)).not.toContain('Visita');
    expect(JSON.stringify(unit.update?.auditEvent)).not.toContain('apoio');
    expect(JSON.stringify(unit.update?.domainEvent)).not.toContain('Visita');
    expect(JSON.stringify(unit.update?.domainEvent)).not.toContain('apoio');
  });

  it('requires server-derived People write authority', () => {
    const unit = new UnitOfWork(fixture());
    const service = new PeopleDirectoryService(unit, runtime());
    const reader = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: ['people.read'] });
    expect(() => service.updateProfile(reader, { personId: 'p1', labels: ['Visita'] })).toThrow('Access denied');
    expect(unit.update).toBeUndefined();
  });

  it('preserves tenant isolation', () => {
    const unit = new UnitOfWork(fixture());
    const service = new PeopleDirectoryService(unit, runtime());
    const otherTenant = createAccessContext({ tenantId: 'tenant-b', actorId: 'actor-b', capabilities: ['people.read', 'people.write'] });
    expect(() => service.updateProfile(otherTenant, { personId: 'p1', labels: ['Visita'] })).toThrow('Person not found');
    expect(unit.update).toBeUndefined();
  });
});