import { describe, expect, it } from 'vitest';
import type { CongregationPerson } from '@eutaktos/domain';
import { parseContactListQuery, projectContactListPerson } from './contact-list';

function request(query: Record<string, string | string[] | undefined>) {
  return { method: 'GET', headers: {}, query } as const;
}

const person: CongregationPerson = {
  id: 'person-1',
  tenantId: 'tenant-1',
  displayName: 'Ana Example',
  preferredLocale: 'pt-PT',
  active: true,
  availability: [],
  eligibility: [],
  ordinaryContact: { phone: '+351 210000000', email: 'ana@example.org', address: 'Rua Segura 1' },
  emergencyContacts: [{ id: 'emergency-1', name: 'Private emergency', phone: '+351 999999999' }],
};
const groups = [{ id: 'g1', name: 'Grupo A', memberIds: ['person-1'] }];

describe('People Contact List contract', () => {
  it('defaults to phone/email and accepts only non-PII selectors', () => {
    expect(parseContactListQuery(request({}))).toEqual({ fields: ['phone', 'email'], status: 'all' });
    expect(parseContactListQuery(request({ fields: 'address,groups,state', status: 'active', groupId: 'g1' }))).toEqual({ fields: ['address', 'groups', 'state'], status: 'active', groupId: 'g1' });
  });

  it('rejects unknown, duplicate and repeated selectors', () => {
    expect(() => parseContactListQuery(request({ fields: 'phone,secret' }))).toThrow('Unknown contact list field');
    expect(() => parseContactListQuery(request({ fields: 'phone,phone' }))).toThrow('duplicates');
    expect(() => parseContactListQuery(request({ fields: ['phone', 'email'] }))).toThrow('must not be repeated');
    expect(() => parseContactListQuery(request({ q: 'Ana' }))).toThrow('Unknown query parameter');
  });

  it('projects only requested ordinary-contact fields and never emergency contacts', () => {
    const projected = projectContactListPerson(person, ['phone', 'groups', 'state'], groups);
    expect(projected).toEqual({
      personId: 'person-1',
      displayName: 'Ana Example',
      phone: '+351 210000000',
      groups: [{ id: 'g1', name: 'Grupo A' }],
      active: true,
    });
    expect(JSON.stringify(projected)).not.toContain('Private emergency');
    expect(JSON.stringify(projected)).not.toContain('999999999');
    expect(JSON.stringify(projected)).not.toContain('ana@example.org');
    expect(JSON.stringify(projected)).not.toContain('Rua Segura');
  });
});
