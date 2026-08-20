import { describe, expect, it } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
  type CongregationPerson,
} from '@eutaktos/domain';
import { EmergencyContactService } from './emergency-contact-service';
import type {
  ApplicationRuntime,
  PeopleUnitOfWork,
  PersonChange,
} from './people-service';

class FakePeopleUnitOfWork implements PeopleUnitOfWork {
  person: CongregationPerson;
  readonly updates: PersonChange[] = [];

  constructor(person: CongregationPerson) {
    this.person = person;
  }

  list(): readonly CongregationPerson[] {
    return [this.person];
  }

  findById(_context: AccessContext, personId: string): CongregationPerson | undefined {
    return this.person.id === personId ? this.person : undefined;
  }

  commitCreate(): CongregationPerson {
    throw new Error('not used');
  }

  commitUpdate(_context: AccessContext, change: PersonChange): CongregationPerson {
    this.person = change.person;
    this.updates.push(change);
    return change.person;
  }
}

function fixture(): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Ana Costa',
    active: true,
    availability: [],
    eligibility: [],
  };
}

function context(capabilities: AccessContext['capabilities']): Readonly<AccessContext> {
  return createAccessContext({ tenantId: 'tenant-a', actorId: 'elder-1', capabilities });
}

function runtime(): ApplicationRuntime {
  const counters = { person: 0, availability: 0, audit: 0, event: 0, emergency: 0 };
  return {
    now: () => '2026-08-20T10:00:00.000Z',
    nextId: scope => `${scope}-${++counters[scope]}`,
    nextEntityId: () => `emergency-contact-${++counters.emergency}`,
  };
}

function emergencyAccess(): Readonly<AccessContext> {
  return context(['people.read', 'emergency-contacts.read', 'emergency-contacts.write']);
}

describe('EmergencyContactService', () => {
  it('stores normalized emergency contacts with dedicated authorization and privacy-minimized metadata', () => {
    const unitOfWork = new FakePeopleUnitOfWork(fixture());
    const service = new EmergencyContactService(unitOfWork, runtime());
    const access = emergencyAccess();

    const contact = service.upsert(access, {
      personId: 'person-1',
      name: '  Maria   Costa ',
      phone: ' +351 912 345 678 ',
      relationship: '  esposa ',
    });

    expect(contact).toEqual({
      id: 'emergency-contact-1',
      name: 'Maria Costa',
      phone: '+351 912 345 678',
      relationship: 'esposa',
    });
    expect(service.list(access, 'person-1')).toEqual([contact]);
    expect(unitOfWork.updates[0]?.auditEvent).toMatchObject({
      resourceType: 'emergency-contact',
      resourceId: 'emergency-contact-1',
      action: 'create',
    });
    expect(unitOfWork.updates[0]?.domainEvent).toMatchObject({
      type: 'EmergencyContactChanged',
      aggregateId: 'emergency-contact-1',
    });
    const metadata = JSON.stringify({
      auditEvent: unitOfWork.updates[0]?.auditEvent,
      domainEvent: unitOfWork.updates[0]?.domainEvent,
    });
    expect(metadata).not.toContain('Maria Costa');
    expect(metadata).not.toContain('+351 912 345 678');
  });

  it('updates and deletes by stable contact id', () => {
    const unitOfWork = new FakePeopleUnitOfWork({
      ...fixture(),
      emergencyContacts: [{ id: 'contact-1', name: 'Maria', phone: '111', relationship: 'irmã' }],
    });
    const service = new EmergencyContactService(unitOfWork, runtime());
    const access = emergencyAccess();

    service.upsert(access, {
      personId: 'person-1',
      contactId: 'contact-1',
      name: 'Maria Silva',
      phone: '222',
      relationship: null,
    });
    expect(service.list(access, 'person-1')).toEqual([
      { id: 'contact-1', name: 'Maria Silva', phone: '222' },
    ]);
    expect(unitOfWork.updates[0]?.auditEvent.action).toBe('update');

    service.remove(access, 'person-1', 'contact-1');
    expect(service.list(access, 'person-1')).toEqual([]);
    expect(unitOfWork.updates[1]?.auditEvent.action).toBe('delete');
  });

  it('rejects access without the dedicated sensitive capability', () => {
    const service = new EmergencyContactService(new FakePeopleUnitOfWork(fixture()), runtime());
    expect(() => service.list(context(['people.read']), 'person-1')).toThrow(
      'Access denied: missing capability emergency-contacts.read',
    );
    expect(() => service.upsert(context(['people.read', 'emergency-contacts.read']), {
      personId: 'person-1', name: 'Maria', phone: '111',
    })).toThrow('Access denied: missing capability emergency-contacts.write');
  });

  it('does not expose another tenant through a misbehaving adapter', () => {
    const unitOfWork = new FakePeopleUnitOfWork({ ...fixture(), tenantId: 'tenant-b' });
    const service = new EmergencyContactService(unitOfWork, runtime());
    expect(() => service.list(context(['people.read', 'emergency-contacts.read']), 'person-1')).toThrow(
      'Cross-tenant access denied',
    );
  });
});
