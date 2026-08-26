import { describe, expect, it } from 'vitest';
import type { AccessContext, Capability, PersonId } from '@eutaktos/domain';
import { OrdinaryContactHttpTransport, type OrdinaryContactPort } from './ordinary-contact-http';
import type { VerifiedPrincipal } from './people-http';

function principal(capabilities: readonly Capability[] = ['people.read', 'people.write']): VerifiedPrincipal {
  return { tenantId: 'tenant-a', actorId: 'actor-a', capabilities };
}

function port(overrides: Partial<OrdinaryContactPort> = {}): OrdinaryContactPort {
  return {
    get: (_context: AccessContext, personId: PersonId) => personId === 'person-a' ? { id: 'person-a', ordinaryContact: { phone: '+351 000', email: 'safe@example.test' } } : undefined,
    updateProfile: (_context: AccessContext, input) => ({ id: input.personId, ordinaryContact: input.ordinaryContact ?? {} }),
    ...overrides,
  };
}

describe('OrdinaryContactHttpTransport', () => {
  it('requires a verified server principal', () => {
    expect(new OrdinaryContactHttpTransport(port()).get({ params: { personId: 'person-a' } })).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('projects only the ordinary contact fields and never emergency contact data', () => {
    const response = new OrdinaryContactHttpTransport(port()).get({ principal: principal(['people.read']), params: { personId: 'person-a' } });
    expect(response).toEqual({ status: 200, body: { phone: '+351 000', email: 'safe@example.test' } });
    expect(JSON.stringify(response.body)).not.toContain('emergency');
  });

  it('does not disclose a person outside the authorized tenant projection', () => {
    expect(new OrdinaryContactHttpTransport(port()).get({ principal: principal(['people.read']), params: { personId: 'person-b' } })).toEqual({ status: 404, body: { error: 'Person not found' } });
  });

  it('rejects browser authority and unknown contact fields', () => {
    const response = new OrdinaryContactHttpTransport(port()).update({ principal: principal(), params: { personId: 'person-a' }, body: { phone: '+351 000', tenantId: 'tenant-b' } });
    expect(response).toEqual({ status: 400, body: { error: 'Unknown request fields: tenantId' } });
  });

  it('maps capability denial to a non-disclosing forbidden response', () => {
    const response = new OrdinaryContactHttpTransport(port({ get: () => { throw new Error('Access denied: people.read'); } })).get({ principal: principal([]), params: { personId: 'person-a' } });
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('accepts explicit nulls as field removal and returns the confirmed server projection', () => {
    const response = new OrdinaryContactHttpTransport(port()).update({ principal: principal(), params: { personId: 'person-a' }, body: { phone: null, email: 'next@example.test', address: null } });
    expect(response).toEqual({ status: 200, body: { email: 'next@example.test' } });
  });
});
