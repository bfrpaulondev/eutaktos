import { describe, expect, it, vi } from 'vitest';
import { AuthenticationApiError, createAuthenticationApi, isSupabaseAuthHash, scannerSafeMagicLinkTokenHash, supabaseAccessTokenFromHash } from './authApi';

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

  it('sends only the transient access token when exchanging a legacy magic link', async () => {
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

  it('exchanges a scanner-safe token hash only after an explicit caller action', async () => {
    const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/auth/verify');
      expect(init?.credentials).toBe('same-origin');
      expect(JSON.parse(String(init?.body))).toEqual({ tokenHash });
      return json({ actorId: 'actor-1', capabilities: ['people.read'] });
    });
    const api = createAuthenticationApi(fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(api.verifyMagicLinkTokenHash(tokenHash)).resolves.toEqual({ actorId: 'actor-1', capabilities: ['people.read'] });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not accept Supabase token material in the Eutaktos response DTO', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ actorId: 'actor-1', capabilities: [], access_token: 'leak' }));
    await expect(createAuthenticationApi(fetcher).verifyMagicLink('header.payload.signature')).rejects.toThrow('Invalid session API response');
  });

  it('logs out through the server-side session revocation endpoint', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('/api/session/logout');
      expect(init?.method).toBe('POST');
      expect(init?.credentials).toBe('same-origin');
      expect(init).not.toHaveProperty('body');
      return new Response(null, { status: 204 });
    });
    await expect(createAuthenticationApi(fetcher).logout()).resolves.toBeUndefined();
  });

  it('treats logout 401 as already signed out', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json({ error: 'Unauthorized' }, 401));
    await expect(createAuthenticationApi(fetcher).logout()).resolves.toBeUndefined();
  });
});

describe('Supabase auth callback parsing', () => {
  it('extracts only a bearer access token from legacy fragments and never requires the refresh token', () => {
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

  it('accepts only a scanner-safe email token hash on the dedicated confirmation route', () => {
    const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    expect(scannerSafeMagicLinkTokenHash('/auth/confirm', `?token_hash=${tokenHash}&type=email`)).toBe(tokenHash);
    expect(scannerSafeMagicLinkTokenHash('/', `?token_hash=${tokenHash}&type=email`)).toBeUndefined();
    expect(scannerSafeMagicLinkTokenHash('/auth/confirm', `?token_hash=${tokenHash}&type=recovery`)).toBeUndefined();
    expect(scannerSafeMagicLinkTokenHash('/auth/confirm', '?token_hash=short&type=email')).toBeUndefined();
  });
});