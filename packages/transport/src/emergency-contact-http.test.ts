import { describe, expect, it } from 'vitest';
import { type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import {
  EmergencyContactService,
  type ApplicationRuntime,
  type PeopleUnitOfWork,
  type PersonChange,
} from '@eutaktos/application';
import { EmergencyContactHttpTransport } from './emergency-contact-http';
import type { VerifiedPrincipal } from './people-http';

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
  const counters = { person: 0, availability: 0, audit: 0, event: 0, contact: 0 };
  return {
    now: () => '2026-08-20T11:00:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
    nextEntityId: () => `contact-${++counters.contact}`,
  };
}

function principal(
  capabilities: VerifiedPrincipal['capabilities'],
  tenantId = 'tenant-a',
): VerifiedPrincipal {
  return { tenantId, actorId: 'actor-1', capabilities };
}

function personFixture(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Ana Costa',
    active: true,
    availability: [],
    eligibility: [],
    emergencyContacts: [
      { id: 'contact-0', name: 'Maria Costa', phone: '+351 910 000 000', relationship: 'Mãe' },
    ],
    ...overrides,
  };
}

function transport(seed: readonly CongregationPerson[] = []): EmergencyContactHttpTransport {
  return new EmergencyContactHttpTransport(new EmergencyContactService(new FakePeopleUnitOfWork(seed), runtime()));
}

const readCaps: VerifiedPrincipal['capabilities'] = ['people.read', 'emergency-contacts.read'];
const writeCaps: VerifiedPrincipal['capabilities'] = [
  'people.read',
  'emergency-contacts.read',
  'emergency-contacts.write',
];

describe('EmergencyContactHttpTransport', () => {
  it('requires a verified principal', () => {
    expect(transport([personFixture()]).list({ params: { personId: 'person-1' } })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('requires the dedicated emergency contact read capability', () => {
    const response = transport([personFixture()]).list({
      principal: principal(['people.read']),
      params: { personId: 'person-1' },
    });
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('lists contacts only through the dedicated protected endpoint', () => {
    const response = transport([personFixture()]).list({
      principal: principal(readCaps),
      params: { personId: 'person-1' },
    });
    expect(response).toEqual({
      status: 200,
      body: [{ id: 'contact-0', name: 'Maria Costa', phone: '+351 910 000 000', relationship: 'Mãe' }],
    });
  });

  it('does not disclose another tenant person or contacts', () => {
    const response = transport([personFixture({ tenantId: 'tenant-b' })]).list({
      principal: principal(readCaps, 'tenant-a'),
      params: { personId: 'person-1' },
    });
    expect(response).toEqual({ status: 404, body: { error: 'Person not found' } });
  });

  it('creates a contact using only whitelisted fields', () => {
    const response = transport([personFixture({ emergencyContacts: [] })]).create({
      principal: principal(writeCaps),
      params: { personId: 'person-1' },
      correlationId: 'request-1',
      body: { name: ' João  Costa ', phone: ' +351 920 000 000 ', relationship: 'Irmão' },
    });
    expect(response).toEqual({
      status: 201,
      body: { id: 'contact-1', name: 'João Costa', phone: '+351 920 000 000', relationship: 'Irmão' },
    });
  });

  it('rejects mass-assignment fields before application logic', () => {
    const response = transport([personFixture()]).create({
      principal: principal(writeCaps),
      params: { personId: 'person-1' },
      body: { name: 'Private', phone: '+351 1', tenantId: 'tenant-b', personId: 'person-2' },
    });
    expect(response).toEqual({
      status: 400,
      body: { error: 'Unknown request fields: personId, tenantId' },
    });
  });

  it('requires dedicated write capability for mutation', () => {
    const response = transport([personFixture()]).update({
      principal: principal(readCaps),
      params: { personId: 'person-1', contactId: 'contact-0' },
      body: { name: 'Maria Costa', phone: '+351 930 000 000' },
    });
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('updates and removes an existing contact', () => {
    const api = transport([personFixture()]);
    const updated = api.update({
      principal: principal(writeCaps),
      params: { personId: 'person-1', contactId: 'contact-0' },
      body: { name: 'Maria Costa', phone: '+351 930 000 000', relationship: null },
    });
    expect(updated).toEqual({
      status: 200,
      body: { id: 'contact-0', name: 'Maria Costa', phone: '+351 930 000 000' },
    });

    expect(api.remove({
      principal: principal(writeCaps),
      params: { personId: 'person-1', contactId: 'contact-0' },
    })).toEqual({ status: 204, body: null });

    expect(api.list({
      principal: principal(readCaps),
      params: { personId: 'person-1' },
    })).toEqual({ status: 200, body: [] });
  });
});
