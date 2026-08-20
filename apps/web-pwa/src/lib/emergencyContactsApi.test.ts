import { describe, expect, it, vi } from 'vitest';
import { createEmergencyContactsApi } from './emergencyContactsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('emergencyContactsApi', () => {
  it('loads contacts from the dedicated person endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse([
      { id: 'c1', name: 'Maria', phone: '+351 910', relationship: 'Mãe', tenantId: 'should-be-dropped' },
    ]));
    const api = createEmergencyContactsApi(fetcher);

    await expect(api.list('person 1')).resolves.toEqual([
      { id: 'c1', name: 'Maria', phone: '+351 910', relationship: 'Mãe' },
    ]);
    expect(fetcher).toHaveBeenCalledWith('/api/people/person%201/emergency-contacts', expect.objectContaining({ method: 'GET' }));
  });

  it('creates, updates and deletes using encoded resource paths', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ id: 'c1', name: 'Maria', phone: '+351 910' }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 'c1', name: 'Maria', phone: '+351 920' }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const api = createEmergencyContactsApi(fetcher);

    await api.create('p/1', { name: 'Maria', phone: '+351 910' });
    await api.update('p/1', 'c/1', { name: 'Maria', phone: '+351 920' });
    await api.remove('p/1', 'c/1');

    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/people/p%2F1/emergency-contacts');
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/people/p%2F1/emergency-contacts/c%2F1');
    expect(fetcher.mock.calls[2]?.[0]).toBe('/api/people/p%2F1/emergency-contacts/c%2F1');
  });

  it('surfaces safe API errors', async () => {
    const api = createEmergencyContactsApi(vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden' }, 403)));
    await expect(api.list('person-1')).rejects.toThrow('Forbidden');
  });
});
