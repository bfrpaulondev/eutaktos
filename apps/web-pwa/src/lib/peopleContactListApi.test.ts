import { describe, expect, it, vi } from 'vitest';
import { createPeopleContactListApi, parsePeopleContactList, PeopleContactListApiError } from './peopleContactListApi';

const response = {
  contractVersion: 'people-contact-list-v1',
  generatedAt: '2026-08-27T12:00:00.000Z',
  fields: ['phone', 'state'],
  groups: [{ id: 'g1', name: 'Grupo 1' }],
  people: [{ personId: 'p1', displayName: 'Ana Silva', phone: '+351 210000000', active: true }],
} as const;

describe('People Contact List API client', () => {
  it('parses only the reviewed projection and maps state to active', () => {
    expect(parsePeopleContactList(response).people[0]).toEqual({ personId: 'p1', displayName: 'Ana Silva', phone: '+351 210000000', active: true });
    expect(() => parsePeopleContactList({ ...response, people: [{ ...response.people[0], emergencyContacts: [] }] })).toThrow('Invalid Contact List API response');
  });

  it('sends only non-PII selectors with same-origin credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleContactListApi(fetcher);
    await api.get({ fields: ['phone', 'state'], status: 'active', groupId: 'g1' });
    expect(fetcher).toHaveBeenCalledWith('/api/people/contact-list?fields=phone%2Cstate&status=active&groupId=g1', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('preserves authorization failures as explicit status errors', async () => {
    const api = createPeopleContactListApi(vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })));
    await expect(api.get({ fields: ['phone'] })).rejects.toMatchObject({ name: 'PeopleContactListApiError', status: 403 });
    await expect(api.get({ fields: ['phone'] })).rejects.toBeInstanceOf(PeopleContactListApiError);
  });
});
