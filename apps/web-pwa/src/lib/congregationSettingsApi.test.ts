import { describe, expect, it, vi } from 'vitest';
import { createCongregationSettingsApi } from './congregationSettingsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const settings = {
  name: 'Central Congregation',
  timezone: 'Europe/Lisbon',
  defaultLocale: 'pt-PT',
  midweekMeeting: { weekday: 2 as const, localTime: '19:30' },
  weekendMeeting: { weekday: 0 as const, localTime: '10:00' },
};

describe('congregationSettingsApi', () => {
  it('loads and minimizes the protected congregation settings DTO', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      ...settings,
      tenantId: 'must-not-cross-the-boundary',
      actorId: 'must-not-cross-the-boundary',
      midweekMeeting: { ...settings.midweekMeeting, internal: 'drop-me' },
    }));
    const api = createCongregationSettingsApi(fetcher);

    await expect(api.get()).resolves.toEqual(settings);
    expect(fetcher).toHaveBeenCalledWith('/api/congregation/settings', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
    }));
  });

  it('treats a missing profile as an unconfigured congregation instead of an API failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Congregation settings not found' }, 404));
    const api = createCongregationSettingsApi(fetcher);

    await expect(api.get()).resolves.toBeNull();
  });

  it('sends only the strict settings contract and strips mass-assignment fields', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(settings));
    const api = createCongregationSettingsApi(fetcher);
    const unsafe = {
      ...settings,
      tenantId: 'attacker-tenant',
      actorId: 'attacker',
      capabilities: ['tenant.manage'],
      midweekMeeting: { ...settings.midweekMeeting, tenantId: 'attacker-tenant' },
    } as typeof settings;

    await expect(api.save(unsafe)).resolves.toEqual(settings);

    const init = fetcher.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'PUT', credentials: 'same-origin' });
    expect(JSON.parse(String(init?.body))).toEqual(settings);
  });

  it('rejects malformed response meeting data', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({
      ...settings,
      weekendMeeting: { weekday: 9, localTime: '10:00' },
    }));
    const api = createCongregationSettingsApi(fetcher);

    await expect(api.get()).rejects.toThrow('Invalid congregation settings response: weekendMeeting');
  });

  it('surfaces server-safe errors without exposing arbitrary response structure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'Forbidden', debug: 'secret' }, 403));
    const api = createCongregationSettingsApi(fetcher);

    await expect(api.get()).rejects.toThrow('Forbidden');
  });
});
