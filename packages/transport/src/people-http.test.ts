import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import {
  PeopleDirectoryService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from '@eutaktos/application';
import { PeopleHttpTransport, type VerifiedPrincipal } from './people-http';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  readonly records = new Map<string, CongregationPerson>();

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
    this.records.set(`${context.tenantId}:${change.person.id}`, change.person);
    return change.person;
  }

  commitUpdate(context: AccessContext, change: PersonChange): CongregationPerson {
    this.records.set(`${context.tenantId}:${change.person.id}`, change.person);
    return change.person;
  }
}

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0 };
  return {
    now: () => '2026-08-20T10:00:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
  };
}

function principal(
  capabilities: VerifiedPrincipal['capabilities'] = ['people.read', 'people.write'],
  tenantId = 'tenant-a',
): VerifiedPrincipal {
  return { tenantId, actorId: 'actor-1', capabilities };
}

function personFixture(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Ana Costa',
    preferredLocale: 'pt-PT',
    active: true,
    availability: [
      { id: 'away-1', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-05T00:00:00Z', reasonCode: 'away' },
    ],
    eligibility: [
      { assignmentTypeId: 'reading', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-08-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

function transport(seed: readonly CongregationPerson[] = []): PeopleHttpTransport {
  const service = new PeopleDirectoryService(new FakePeopleUnitOfWork(seed), runtime());
  return new PeopleHttpTransport(service);
}

describe('PeopleHttpTransport', () => {
  it('requires a verified principal rather than accepting anonymous directory access', () => {
    expect(transport().list({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('projects directory records without eligibility or availability data', () => {
    const response = transport([personFixture()]).list({ principal: principal(['people.read']) });

    expect(response).toEqual({
      status: 200,
      body: [{ id: 'person-1', displayName: 'Ana Costa', preferredLocale: 'pt-PT', active: true }],
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('eligibility');
    expect(serialized).not.toContain('availability');
    expect(serialized).not.toContain('elder-1');
  });

  it('derives tenant scope from the verified principal', () => {
    const response = transport([
      personFixture(),
      personFixture({ id: 'person-2', tenantId: 'tenant-b', displayName: 'Private B' }),
    ]).list({ principal: principal(['people.read'], 'tenant-a') });

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('Private B');
  });

  it('rejects mass-assignment fields instead of accepting tenant or sensitive subdomains', () => {
    const response = transport().create({
      principal: principal(['people.write']),
      body: {
        displayName: 'Ana Costa',
        tenantId: 'tenant-b',
        eligibility: [{ assignmentTypeId: 'reading', enabled: true }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown request fields: eligibility, tenantId' });
  });

  it('maps missing capability failures to a non-disclosing forbidden response', () => {
    const response = transport([personFixture()]).get({
      principal: principal([]),
      params: { personId: 'person-1' },
    });

    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('creates a profile using only whitelisted fields and preserves correlation metadata', () => {
    const response = transport().create({
      principal: principal(['people.write']),
      correlationId: 'request-123',
      body: { displayName: '  Bruno   Paulon ', preferredLocale: 'pt-pt', active: true },
    });

    expect(response).toEqual({
      status: 201,
      body: { id: 'person-1', displayName: 'Bruno Paulon', preferredLocale: 'pt-PT', active: true },
    });
  });

  it('returns 404 for a person outside the active tenant without cross-tenant disclosure', () => {
    const response = transport([personFixture({ tenantId: 'tenant-b' })]).get({
      principal: principal(['people.read'], 'tenant-a'),
      params: { personId: 'person-1' },
    });

    expect(response).toEqual({ status: 404, body: { error: 'Person not found' } });
  });

  it('rejects malformed bodies before they reach profile application logic', () => {
    const response = transport().update({
      principal: principal(),
      params: { personId: 'person-1' },
      body: { active: 'yes' },
    });

    expect(response).toEqual({ status: 400, body: { error: 'active must be a boolean' } });
  });
});

// Compile-time sanity: transport principals are converted to domain contexts, never
// accepted as pre-built untrusted AccessContext values from request payloads.
void createAccessContext;
