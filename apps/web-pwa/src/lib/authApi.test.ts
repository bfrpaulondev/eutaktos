import { describe, expect, it, vi } from 'vitest';
import { createAuthenticationApi } from './authApi';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('authenticationApi', () => {
  it('treats 401 session reads as signed out without throwing', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ error: 'Unauthorized' }, 401));
    await expect(createAuthenticationApi(fetcher).current()).resolves.toEqual({ status: 'unauthenticated' });
  });

  it('parses authenticated session responses without storing auth tokens', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/session');
      expect(init?.credentials).toBe('same-origin');
      return json({ actorId: 'actor-1', capabilities: ['people.read'] });
    });
    await expect(createAuthenticationApi(fetcher).current()).resolves.toEqual({
      status: 'authenticated',
      session: { actorId: 'actor-1', capabilities: ['people.read'] },
    });
  });

  it('sends only email when requesting an OTP', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/auth/otp');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.test' });
      return json({ status: 'check-email' }, 202);
    });
    await createAuthenticationApi(fetcher).requestOtp('person@example.test');
  });

  it('sends only email and code when verifying an OTP and accepts only the Eutaktos session DTO', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/auth/verify');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.test', token: '123456' });
      return json({ actorId: 'actor-1', capabilities: ['people.read', 'schedule.read'] });
    });
    await expect(createAuthenticationApi(fetcher).verifyOtp('person@example.test', '123456')).resolves.toEqual({
      actorId: 'actor-1',
      capabilities: ['people.read', 'schedule.read'],
    });
  });

  it('does not accept Supabase token material in the response DTO', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ actorId: 'actor-1', capabilities: [], access_token: 'leak' }));
    await expect(createAuthenticationApi(fetcher).verifyOtp('person@example.test', '123456')).rejects.toThrow('Invalid session API response');
  });
});
