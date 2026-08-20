import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  isPersonAvailableAt,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import { AvailabilityService } from './availability-service';
import type { ApplicationRuntime, PeopleUnitOfWork, PersonChange } from './people-service';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  person: CongregationPerson;
  readonly updates: PersonChange[] = [];

  constructor(person: CongregationPerson) {
    this.person = person;
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    return this.person.tenantId === context.tenantId ? [this.person] : [];
  }

  findById(context: AccessContext, personId: string): CongregationPerson | undefined {
    return this.person.tenantId === context.tenantId && this.person.id === personId ? this.person : undefined;
  }

  commitCreate(_context: AccessContext, _change: PersonChange): CongregationPerson {
    throw new Error('not used');
  }

  commitUpdate(_context: AccessContext, change: PersonChange): CongregationPerson {
    this.person = change.person;
    this.updates.push(change);
    return change.person;
  }
}

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0 };
  return {
    now: () => '2026-08-20T00:15:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
  };
}

function context(capabilities: AccessContext['capabilities']): Readonly<AccessContext> {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities });
}

function fixture(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Carlos Silva',
    active: true,
    availability: [],
    eligibility: [{
      assignmentTypeId: 'bible-reading',
      enabled: true,
      decidedBy: 'elder-2',
      decidedAt: '2026-08-01T00:00:00Z',
    }],
    ...overrides,
  };
}

describe('AvailabilityService', () => {
  it('lists unavailability only with dedicated read capability', () => {
    const period = {
      id: 'availability-1',
      startsAt: '2026-09-12T00:00:00Z',
      endsAt: '2026-09-22T00:00:00Z',
      reasonCode: 'away' as const,
    };
    const unitOfWork = new FakePeopleUnitOfWork(fixture({ availability: [period] }));
    const service = new AvailabilityService(unitOfWork, runtime());

    expect(service.list(context(['people.read', 'availability.read']), 'person-1')).toEqual([period]);
    expect(() => service.list(context(['people.read']), 'person-1')).toThrow(
      'Access denied: missing capability availability.read',
    );
  });

  it('returns cloned periods so callers cannot mutate persisted availability', () => {
    const period = {
      id: 'availability-1',
      startsAt: '2026-09-12T00:00:00Z',
      endsAt: '2026-09-22T00:00:00Z',
      reasonCode: 'away' as const,
    };
    const unitOfWork = new FakePeopleUnitOfWork(fixture({ availability: [period] }));
    const service = new AvailabilityService(unitOfWork, runtime());

    const listed = service.list(context(['people.read', 'availability.read']), 'person-1');
    expect(listed[0]).not.toBe(unitOfWork.person.availability[0]);
  });

  it('adds an identified unavailability period without requiring generic people.write', () => {
    const original = fixture();
    const unitOfWork = new FakePeopleUnitOfWork(original);
    const service = new AvailabilityService(unitOfWork, runtime());

    const updated = service.addUnavailability(
      context(['people.read', 'availability.write']),
      {
        personId: 'person-1',
        startsAt: '2026-09-12T00:00:00Z',
        endsAt: '2026-09-22T00:00:00Z',
        reasonCode: 'away',
      },
      { correlationId: 'away-request-1' },
    );

    expect(updated.availability).toEqual([{
      id: 'availability-1',
      startsAt: '2026-09-12T00:00:00Z',
      endsAt: '2026-09-22T00:00:00Z',
      reasonCode: 'away',
    }]);
    expect(updated.eligibility).toBe(original.eligibility);
    expect(isPersonAvailableAt(updated, '2026-09-15T12:00:00Z')).toBe(false);
    expect(unitOfWork.updates[0]?.auditEvent).toMatchObject({
      resourceType: 'availability',
      resourceId: 'availability-1',
      action: 'create',
      changedFields: ['endsAt', 'reasonCode', 'startsAt'],
    });
    expect(unitOfWork.updates[0]?.domainEvent).toMatchObject({
      type: 'AvailabilityChanged',
      aggregateId: 'person-1',
      correlationId: 'away-request-1',
    });
  });

  it('removes a specific identified period and leaves other periods untouched', () => {
    const keep = {
      id: 'availability-keep',
      startsAt: '2026-10-01T00:00:00Z',
      endsAt: '2026-10-03T00:00:00Z',
      reasonCode: 'unavailable' as const,
    };
    const remove = {
      id: 'availability-remove',
      startsAt: '2026-09-12T00:00:00Z',
      endsAt: '2026-09-22T00:00:00Z',
      reasonCode: 'away' as const,
    };
    const unitOfWork = new FakePeopleUnitOfWork(fixture({ availability: [remove, keep] }));
    const service = new AvailabilityService(unitOfWork, runtime());

    const updated = service.removeUnavailability(
      context(['people.read', 'availability.write']),
      { personId: 'person-1', availabilityPeriodId: 'availability-remove' },
    );

    expect(updated.availability).toEqual([keep]);
    expect(unitOfWork.updates[0]?.auditEvent).toMatchObject({
      resourceType: 'availability',
      resourceId: 'availability-remove',
      action: 'delete',
    });
  });

  it('rejects invalid time windows before committing', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture());
    const service = new AvailabilityService(unitOfWork, runtime());

    expect(() => service.addUnavailability(
      context(['people.read', 'availability.write']),
      {
        personId: 'person-1',
        startsAt: '2026-09-22T00:00:00Z',
        endsAt: '2026-09-12T00:00:00Z',
      },
    )).toThrow('Availability period must end after it starts');
    expect(unitOfWork.updates).toHaveLength(0);
  });

  it('does not let generic people.write substitute for availability authority', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture());
    const service = new AvailabilityService(unitOfWork, runtime());

    expect(() => service.addUnavailability(
      context(['people.read', 'people.write']),
      {
        personId: 'person-1',
        startsAt: '2026-09-12T00:00:00Z',
        endsAt: '2026-09-22T00:00:00Z',
      },
    )).toThrow('Access denied: missing capability availability.write');
  });

  it('fails safely when attempting to remove an unknown or legacy period id', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture({
      availability: [{ startsAt: '2026-09-12T00:00:00Z', endsAt: '2026-09-22T00:00:00Z', reasonCode: 'away' }],
    }));
    const service = new AvailabilityService(unitOfWork, runtime());

    expect(() => service.removeUnavailability(
      context(['people.read', 'availability.write']),
      { personId: 'person-1', availabilityPeriodId: 'missing-id' },
    )).toThrow('Unavailability period not found');
    expect(unitOfWork.updates).toHaveLength(0);
  });
});
