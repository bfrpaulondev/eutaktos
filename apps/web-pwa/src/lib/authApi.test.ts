import { describe, expect, it, vi } from 'vitest';
import { AuthenticationApiError, createAuthenticationApi, isSupabaseAuthHash, supabaseAccessTokenFromHash } from './authApi';

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

  it('sends only email when requesting passwordless access', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/auth/otp');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.test' });
      return json({ status: 'check-email' }, 202);
    });
    await createAuthenticationApi(fetcher).requestOtp('person@example.test');
  });

  it('keeps six-digit OTP verification as a safe fallback', async () => {
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

  it('preserves 5xx status without exposing server internals', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ error: 'Service temporarily unavailable' }, 503));
    const promise = createAuthenticationApi(fetcher).verifyOtp('person@example.test', '123456');
    await expect(promise).rejects.toMatchObject({
      name: 'AuthenticationApiError',
      status: 503,
      message: 'Authentication service unavailable',
    } satisfies Partial<AuthenticationApiError>);
  });

  it('sends only the transient access token when exchanging a magic link', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/auth/verify');
      expect(init?.credentials).toBe('same-origin');
      expect(JSON.parse(String(init?.body))).toEqual({ accessToken: 'header.payload.signature' });
      return json({ actorId: 'actor-1', capabilities: ['people.read'] });
    });
    await expect(createAuthenticationApi(fetcher).verifyMagicLink('header.payload.signature')).resolves.toEqual({
      actorId: 'actor-1', capabilities: ['people.read'],
    });
  });

  it('does not accept Supabase token material in the Eutaktos response DTO', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ actorId: 'actor-1', capabilities: [], access_token: 'leak' }));
    await expect(createAuthenticationApi(fetcher).verifyMagicLink('header.payload.signature')).rejects.toThrow('Invalid session API response');
  });
});

describe('Supabase auth fragment parsing', () => {
  it('extracts only a bearer access token and never requires the refresh token', () => {
    const hash = '#access_token=header.payload.signature&refresh_token=secret-refresh&token_type=bearer&type=magiclink';
    expect(isSupabaseAuthHash(hash)).toBe(true);
    expect(supabaseAccessTokenFromHash(hash)).toBe('header.payload.signature');
  });

  it('recognizes Supabase error fragments so the URL can be scrubbed', () => {
    expect(isSupabaseAuthHash('#error=access_denied&error_code=otp_expired')).toBe(true);
    expect(supabaseAccessTokenFromHash('#error=access_denied&error_code=otp_expired')).toBeUndefined();
  });

  it('ignores unrelated hashes and malformed token material', () => {
    expect(isSupabaseAuthHash('#section=settings')).toBe(false);
    expect(supabaseAccessTokenFromHash('#access_token=not-a-jwt&token_type=bearer')).toBeUndefined();
  });
});
