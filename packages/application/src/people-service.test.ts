import { describe, expect, it } from 'vitest';
import {
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
  readonly creates: PersonChange[] = [];
  readonly updates: PersonChange[] = [];

  constructor(seed: readonly CongregationPerson[] = []) {
    for (const person of seed) this.records.set(`${person.tenantId}:${person.id}`, person);
  }

  list(context: AccessContext): readonly CongregationPerson[] {
    return [...this.records.values()].filter(person => person.tenantId === context.tenantId);
  }

  findById(context: AccessContext, personId: string): CongregationPerson | undefined {
    return this.records.get(`${context.tenantId}:${personId}`);
  }

  commitCreate(context: AccessContext, change: PersonChange): CongregationPerson {
    const key = `${context.tenantId}:${change.person.id}`;
    if (this.records.has(key)) throw new Error('duplicate');
    this.records.set(key, change.person);
    this.creates.push(change);
    return change.person;
  }

  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    const key = `${context.tenantId}:${change.person.id}`;
    if (!this.records.has(key)) throw new Error('missing');
    this.records.set(key, change.person);
    this.updates.push(change);
    return change.person;
  }
}

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0 };
  return {
    now: () => '2026-08-20T00:00:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
  };
}

function context(capabilities: AccessContext['capabilities']): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-a',
    actorId: 'elder-1',
    capabilities,
  });
}

function personFixture(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Carlos Silva',
    preferredLocale: 'pt-PT',
    active: true,
    availability: [
      { id: 'availability-legacy', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-08T00:00:00Z', reasonCode: 'away' },
    ],
    eligibility: [
      {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedBy: 'elder-2',
        decidedAt: '2026-07-01T12:00:00Z',
      },
    ],
    ...overrides,
  };
}

describe('PeopleDirectoryService', () => {
  it('creates a normalized person and emits privacy-minimized audit/event records', () => {
    const unitOfWork = new FakePeopleUnitOfWork();
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    const created = service.create(
      context(['people.write']),
      { displayName: '  Ana   Costa  ', preferredLocale: 'pt-pt' },
      { correlationId: 'request-42' },
    );

    expect(created).toEqual({
      id: 'person-1',
      tenantId: 'tenant-a',
      displayName: 'Ana Costa',
      preferredLocale: 'pt-PT',
      active: true,
      availability: [],
      eligibility: [],
    });
    expect(unitOfWork.creates).toHaveLength(1);
    expect(unitOfWork.creates[0]?.auditEvent).toMatchObject({
      resourceType: 'person',
      resourceId: 'person-1',
      action: 'create',
      actorId: 'elder-1',
      changedFields: ['active', 'displayName', 'preferredLocale'],
    });
    expect(unitOfWork.creates[0]?.domainEvent).toEqual({
      id: 'event-1',
      tenantId: 'tenant-a',
      type: 'PersonCreated',
      aggregateId: 'person-1',
      actorId: 'elder-1',
      occurredAt: '2026-08-20T00:00:00.000Z',
      schemaVersion: 1,
      correlationId: 'request-42',
    });

    const serializedMetadata = JSON.stringify({
      auditEvent: unitOfWork.creates[0]?.auditEvent,
      domainEvent: unitOfWork.creates[0]?.domainEvent,
    });
    expect(serializedMetadata).not.toContain('Ana Costa');
  });

  it('updates only profile fields and preserves eligibility/availability exactly', () => {
    const original = personFixture();
    const unitOfWork = new FakePeopleUnitOfWork([original]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    const updated = service.updateProfile(
      context(['people.read', 'people.write']),
      { personId: 'person-1', displayName: 'Carlos S. Silva', preferredLocale: 'es', active: false },
    );

    expect(updated.displayName).toBe('Carlos S. Silva');
    expect(updated.preferredLocale).toBe('es');
    expect(updated.active).toBe(false);
    expect(updated.availability).toBe(original.availability);
    expect(updated.eligibility).toBe(original.eligibility);
    expect(unitOfWork.updates[0]?.auditEvent.changedFields).toEqual([
      'active',
      'displayName',
      'preferredLocale',
    ]);
    expect(unitOfWork.updates[0]?.domainEvent.type).toBe('PersonUpdated');
  });

  it('supports explicitly clearing the preferred locale without touching protected fields', () => {
    const original = personFixture();
    const unitOfWork = new FakePeopleUnitOfWork([original]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    const updated = service.updateProfile(
      context(['people.read', 'people.write']),
      { personId: 'person-1', preferredLocale: null },
    );

    expect(updated.preferredLocale).toBeUndefined();
    expect(updated.availability).toBe(original.availability);
    expect(updated.eligibility).toBe(original.eligibility);
  });

  it('does not create audit noise for a no-op profile update', () => {
    const original = personFixture();
    const unitOfWork = new FakePeopleUnitOfWork([original]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    const result = service.updateProfile(
      context(['people.read', 'people.write']),
      { personId: 'person-1', displayName: 'Carlos Silva', preferredLocale: 'pt-PT', active: true },
    );

    expect(result).toBe(original);
    expect(unitOfWork.updates).toHaveLength(0);
  });

  it('rejects invalid locale input before committing', () => {
    const unitOfWork = new FakePeopleUnitOfWork();
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    expect(() => service.create(context(['people.write']), { displayName: 'Ana Costa', preferredLocale: 'not_a_locale' })).toThrow(
      'preferredLocale must be a valid BCP 47 locale',
    );
    expect(unitOfWork.creates).toHaveLength(0);
  });

  it('enforces capabilities before executing read and write use cases', () => {
    const unitOfWork = new FakePeopleUnitOfWork([personFixture()]);
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    expect(() => service.list(context([]))).toThrow('Access denied: missing capability people.read');
    expect(() => service.create(context(['people.read']), { displayName: 'Ana Costa' })).toThrow(
      'Access denied: missing capability people.write',
    );
    expect(() =>
      service.updateProfile(context(['people.read']), { personId: 'person-1', displayName: 'Other' }),
    ).toThrow('Access denied: missing capability people.write');
  });

  it('defends against a misbehaving adapter returning another tenant resource', () => {
    const unitOfWork = new FakePeopleUnitOfWork();
    unitOfWork.findById = () => personFixture({ tenantId: 'tenant-b' });
    const service = new PeopleDirectoryService(unitOfWork, runtime());

    expect(() => service.get(context(['people.read']), 'person-1')).toThrow('Cross-tenant access denied');
  });
});
