import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import { EligibilityService } from './eligibility-service';
import type { ApplicationRuntime, PeopleUnitOfWork, PersonChange } from './people-service';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  constructor(readonly person: CongregationPerson) {}

  list(context: AccessContext): readonly CongregationPerson[] {
    return this.person.tenantId === context.tenantId ? [this.person] : [];
  }

  findById(context: AccessContext, personId: string): CongregationPerson | undefined {
    return this.person.tenantId === context.tenantId && this.person.id === personId ? this.person : undefined;
  }

  commitCreate(_context: AccessContext, _change: PersonChange): CongregationPerson {
    throw new Error('not used');
  }

  commitUpdate(_context: AccessContext, _change: PersonChange): CongregationPerson {
    throw new Error('not used');
  }
}

const runtime: ApplicationRuntime = {
  now: () => '2026-08-20T15:00:00.000Z',
  nextId: scope => `${scope}-1`,
};

function context(capabilities: AccessContext['capabilities']): Readonly<AccessContext> {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities });
}

function fixture(): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Sensitive Name',
    active: true,
    availability: [],
    eligibility: [
      {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedBy: 'elder-2',
        decidedAt: '2026-08-01T00:00:00Z',
      },
      {
        assignmentTypeId: 'bible-reading',
        enabled: false,
        decidedBy: 'elder-3',
        decidedAt: '2026-08-10T00:00:00Z',
      },
    ],
  };
}

describe('EligibilityService protected reads', () => {
  it('requires both people.read and eligibility.read', () => {
    const service = new EligibilityService(new FakePeopleUnitOfWork(fixture()), runtime);

    expect(() => service.listEligibility(context(['people.read']), 'person-1'))
      .toThrow('Access denied: missing capability eligibility.read');
    expect(() => service.listEligibility(context(['eligibility.read']), 'person-1'))
      .toThrow('Access denied: missing capability people.read');
  });

  it('does not let generic people.write substitute for eligibility.read', () => {
    const service = new EligibilityService(new FakePeopleUnitOfWork(fixture()), runtime);
    expect(() => service.listEligibility(context(['people.read', 'people.write']), 'person-1'))
      .toThrow('Access denied: missing capability eligibility.read');
  });

  it('returns eligibility history only for an authorized same-tenant person', () => {
    const service = new EligibilityService(new FakePeopleUnitOfWork(fixture()), runtime);
    const decisions = service.listEligibility(context(['people.read', 'eligibility.read']), 'person-1');
    expect(decisions).toHaveLength(2);
    expect(decisions[1]).toMatchObject({ assignmentTypeId: 'bible-reading', enabled: false });
  });

  it('does not disclose cross-tenant people as readable eligibility state', () => {
    const otherTenant = { ...fixture(), tenantId: 'tenant-b' };
    const service = new EligibilityService(new FakePeopleUnitOfWork(otherTenant), runtime);
    expect(() => service.listEligibility(context(['people.read', 'eligibility.read']), 'person-1'))
      .toThrow('Person not found');
  });
});
