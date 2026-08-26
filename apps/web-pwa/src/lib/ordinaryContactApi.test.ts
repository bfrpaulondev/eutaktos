import { describe, expect, it, vi } from 'vitest';
import { createOrdinaryContactApi } from './ordinaryContactApi';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('ordinaryContactApi', () => {
  it('uses the dedicated person path with same-origin credentials and no contact PII in the URL', async () => {
    const fetcher = vi.fn(async () => response({ phone: '+351 000', email: 'person@example.test' }));
    const api = createOrdinaryContactApi(fetcher as unknown as typeof fetch);

    await expect(api.get('person id')).resolves.toEqual({ phone: '+351 000', email: 'person@example.test' });
    expect(fetcher).toHaveBeenCalledWith('/api/people/person%20id/contact', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('sends only the explicit contact payload and rejects unexpected response fields', async () => {
    const fetcher = vi.fn(async () => response({ phone: '+351 000', emergencyContacts: [] }));
    const api = createOrdinaryContactApi(fetcher as unknown as typeof fetch);

    await expect(api.update('person-1', { phone: '+351 000' })).rejects.toThrow('Invalid ordinary contact API response');
    expect(fetcher).toHaveBeenCalledWith('/api/people/person-1/contact', expect.objectContaining({ method: 'PUT', credentials: 'same-origin', body: JSON.stringify({ phone: '+351 000' }) }));
  });

  it('preserves server authorization failure instead of returning a fabricated contact', async () => {
    const api = createOrdinaryContactApi((async () => response({ error: 'Forbidden' }, 403)) as typeof fetch);
    await expect(api.get('person-1')).rejects.toThrow('Forbidden (403)');
  });

  it('propagates an abort signal on the dedicated save so obsolete UI ownership can be cancelled', async () => {
    const fetcher = vi.fn(async () => response({}));
    const api = createOrdinaryContactApi(fetcher as unknown as typeof fetch);
    const controller = new AbortController();

    await api.update('person-1', {}, controller.signal);

    expect(fetcher).toHaveBeenCalledWith('/api/people/person-1/contact', expect.objectContaining({ signal: controller.signal }));
  });
});
