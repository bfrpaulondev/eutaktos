import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  isExplicitlyEligible,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import { EligibilityService } from './eligibility-service';
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
    now: () => '2026-08-20T00:10:00.000Z',
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
    availability: [
      { id: 'away-1', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z', reasonCode: 'away' },
    ],
    eligibility: [],
    ...overrides,
  };
}

describe('EligibilityService', () => {
  it('records an explicit grant without requiring generic people.write', () => {
    const original = fixture();
    const unitOfWork = new FakePeopleUnitOfWork(original);
    const service = new EligibilityService(unitOfWork, runtime());

    const updated = service.setEligibility(
      context(['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: ' bible-reading ', enabled: true },
      { correlationId: 'eligibility-request-1' },
    );

    expect(isExplicitlyEligible(updated, 'bible-reading')).toBe(true);
    expect(updated.availability).toBe(original.availability);
    expect(updated.eligibility.at(-1)).toEqual({
      assignmentTypeId: 'bible-reading',
      enabled: true,
      decidedBy: 'elder-1',
      decidedAt: '2026-08-20T00:10:00.000Z',
    });
    expect(unitOfWork.updates[0]?.auditEvent).toMatchObject({
      resourceType: 'eligibility',
      resourceId: 'person-1:bible-reading',
      action: 'grant',
      changedFields: ['enabled'],
    });
    expect(unitOfWork.updates[0]?.domainEvent).toMatchObject({
      type: 'EligibilityChanged',
      aggregateId: 'person-1',
      correlationId: 'eligibility-request-1',
    });
  });

  it('records a revocation as the latest authoritative decision', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture({
      eligibility: [{
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedBy: 'elder-2',
        decidedAt: '2026-08-01T00:00:00Z',
      }],
    }));
    const service = new EligibilityService(unitOfWork, runtime());

    const updated = service.setEligibility(
      context(['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'bible-reading', enabled: false },
    );

    expect(isExplicitlyEligible(updated, 'bible-reading')).toBe(false);
    expect(unitOfWork.updates[0]?.auditEvent.action).toBe('revoke');
  });

  it('does not create duplicate decisions or audit noise for an unchanged state', () => {
    const original = fixture({
      eligibility: [{
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedBy: 'elder-2',
        decidedAt: '2026-08-01T00:00:00Z',
      }],
    });
    const unitOfWork = new FakePeopleUnitOfWork(original);
    const service = new EligibilityService(unitOfWork, runtime());

    const result = service.setEligibility(
      context(['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'bible-reading', enabled: true },
    );

    expect(result).toBe(original);
    expect(unitOfWork.updates).toHaveLength(0);
  });

  it('does not let generic people.write substitute for eligibility authority', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture());
    const service = new EligibilityService(unitOfWork, runtime());

    expect(() => service.setEligibility(
      context(['people.read', 'people.write']),
      { personId: 'person-1', assignmentTypeId: 'bible-reading', enabled: true },
    )).toThrow('Access denied: missing capability eligibility.write');
    expect(unitOfWork.updates).toHaveLength(0);
  });

  it('keeps person names out of general audit and domain-event metadata', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture());
    const service = new EligibilityService(unitOfWork, runtime());

    service.setEligibility(
      context(['people.read', 'eligibility.write']),
      { personId: 'person-1', assignmentTypeId: 'bible-reading', enabled: true },
    );

    const serialized = JSON.stringify({
      auditEvent: unitOfWork.updates[0]?.auditEvent,
      domainEvent: unitOfWork.updates[0]?.domainEvent,
    });
    expect(serialized).not.toContain('Carlos Silva');
  });
});
