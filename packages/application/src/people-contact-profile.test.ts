import { describe, expect, it } from 'vitest';
import { createAccessContext, type AccessContext, type CongregationPerson } from '@eutaktos/domain';
import { PeopleDirectoryService, type ApplicationRuntime, type PeopleUnitOfWork, type PersonChange } from './people-service';

class ContactPeopleUow implements PeopleUnitOfWork {
  person?: CongregationPerson;
  changes: PersonChange[] = [];
  list(context: AccessContext) { return this.person?.tenantId === context.tenantId ? [this.person] : []; }
  findById(context: AccessContext, id: string) { return this.person?.tenantId === context.tenantId && this.person.id === id ? this.person : undefined; }
  commitCreate(_context: AccessContext, change: PersonChange) { this.person = change.person; this.changes.push(change); return change.person; }
  commitUpdate(_context: AccessContext, change: PersonChange) { this.person = change.person; this.changes.push(change); return change.person; }
}
function access() { return createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: ['people.read', 'people.write'] }); }
function runtime(): ApplicationRuntime { let n = 0; return { now: () => '2026-08-25T18:00:00.000Z', nextId: scope => `${scope}-${++n}` }; }

describe('PeopleDirectoryService contact profile', () => {
  it('creates normalized contact details but keeps PII out of audit/domain event metadata', () => {
    const uow = new ContactPeopleUow(); const service = new PeopleDirectoryService(uow, runtime());
    const created = service.create(access(), { displayName: 'Ana Costa', contact: { phone: ' +351 900 000 000 ', email: ' ANA@EXAMPLE.COM ' } });
    expect(created.contact).toEqual({ phone: '+351 900 000 000', email: 'ana@example.com' });
    expect(uow.changes[0]?.auditEvent.changedFields).toContain('contact');
    const metadata = JSON.stringify({ audit: uow.changes[0]?.auditEvent, event: uow.changes[0]?.domainEvent });
    expect(metadata).not.toContain('+351'); expect(metadata).not.toContain('ana@example.com');
  });

  it('updates and clears contact without touching availability, eligibility or emergency contacts', () => {
    const uow = new ContactPeopleUow();
    const availability = [{ id: 'away-1', startsAt: '2026-09-01T00:00:00Z', endsAt: '2026-09-02T00:00:00Z', reasonCode: 'away' as const }];
    const eligibility = [{ assignmentTypeId: 'builtin:reading', enabled: true, decidedBy: 'actor-a', decidedAt: '2026-08-01T00:00:00Z' }];
    const emergencyContacts = [{ id: 'em-1', name: 'Maria', phone: '+351 911 000 000' }];
    uow.person = { id: 'person-1', tenantId: 'tenant-a', displayName: 'Ana Costa', active: true, availability, eligibility, emergencyContacts };
    const service = new PeopleDirectoryService(uow, runtime());
    const updated = service.updateProfile(access(), { personId: 'person-1', contact: { address: { line1: 'Rua A', locality: 'Setúbal', countryCode: 'pt' } } });
    expect(updated.contact).toEqual({ address: { line1: 'Rua A', locality: 'Setúbal', countryCode: 'PT' } });
    expect(updated.availability).toBe(availability); expect(updated.eligibility).toBe(eligibility); expect(updated.emergencyContacts).toBe(emergencyContacts);
    const cleared = service.updateProfile(access(), { personId: 'person-1', contact: null });
    expect(cleared.contact).toBeUndefined();
  });
});
