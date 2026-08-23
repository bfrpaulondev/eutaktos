import { describe, expect, it, vi } from 'vitest';
import { AuthenticationError } from './_auth';
import { SupabaseIdentityBridge } from './_identity-auth';
import type { DatabaseConfig } from './_db';

const config: DatabaseConfig = { url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_server' };
function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}
function jwt(payload: Readonly<Record<string, unknown>>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('SupabaseIdentityBridge', () => {
  it('looks up only enabled preauthorized identity rows by normalized email', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/rest/v1/eutaktos_auth_identities');
      expect(url.searchParams.get('email')).toBe('eq.person@example.test');
      expect(url.searchParams.get('enabled')).toBe('eq.true');
      const headers = init?.headers as Record<string, string>;
      expect(headers.apikey).toBe('sb_secret_server');
      expect(headers.Authorization).toBeUndefined();
      return json([{ tenant_id: 'tenant-a', actor_id: 'person-1', email: 'person@example.test', auth_user_id: null, mfa_required: false }]);
    });
    const identity = await new SupabaseIdentityBridge(config, fetcher).identityForEmail(' Person@Example.Test ');
    expect(identity).toEqual({ tenantId: 'tenant-a', actorId: 'person-1', email: 'person@example.test', mfaRequired: false });
  });

  it('requests passwordless access with signup disabled and an explicit scanner-safe confirmation redirect', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      expect(url.origin + url.pathname).toBe('https://example.supabase.co/auth/v1/otp');
      expect(url.searchParams.get('redirect_to')).toBe('https://eutakes.netlify.app/auth/confirm');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'person@example.test', create_user: false });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    await new SupabaseIdentityBridge(config, fetcher).requestEmailOtp('PERSON@example.test', false, 'https://eutakes.netlify.app/auth/confirm');
  });

  it('accepts a verified non-anonymous Supabase email OTP session and reads its AAL', async () => {
    const accessToken = jwt({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', aal: 'aal1' });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/auth/v1/verify');
      expect(JSON.parse(String(init?.body))).toEqual({ type: 'email', email: 'person@example.test', token: '123456' });
      return json({ access_token: accessToken, user: { id: '11111111-1111-4111-8111-111111111111', email: 'person@example.test', is_anonymous: false } });
    });
    await expect(new SupabaseIdentityBridge(config, fetcher).verifyEmailOtp('person@example.test', '123456')).resolves.toEqual({
      accessToken,
      authUserId: '11111111-1111-4111-8111-111111111111',
      email: 'person@example.test',
      aal: 'aal1',
    });
  });

  it('verifies scanner-safe email token hashes without a browser access token', async () => {
    const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const accessToken = jwt({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', aal: 'aal1' });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/auth/v1/verify');
      expect(JSON.parse(String(init?.body))).toEqual({ type: 'email', token_hash: tokenHash });
      return json({ access_token: accessToken, user: { id: '11111111-1111-4111-8111-111111111111', email: 'person@example.test', is_anonymous: false } });
    });
    await expect(new SupabaseIdentityBridge(config, fetcher).verifyEmailTokenHash(tokenHash)).resolves.toEqual({
      accessToken,
      authUserId: '11111111-1111-4111-8111-111111111111',
      email: 'person@example.test',
      aal: 'aal1',
    });
  });

  it('maps rejected token hashes to a generic authentication failure', async () => {
    const tokenHash = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const fetcher = vi.fn<typeof fetch>(async () => json({ error: 'otp_expired' }, 403));
    await expect(new SupabaseIdentityBridge(config, fetcher).verifyEmailTokenHash(tokenHash)).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('validates a legacy magic-link access token against Supabase Auth before trusting its identity', async () => {
    const accessToken = jwt({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', aal: 'aal1' });
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/auth/v1/user');
      const headers = init?.headers as Record<string, string>;
      expect(headers.apikey).toBe('sb_secret_server');
      expect(headers.Authorization).toBe(`Bearer ${accessToken}`);
      return json({ id: '11111111-1111-4111-8111-111111111111', email: 'person@example.test', is_anonymous: false });
    });
    await expect(new SupabaseIdentityBridge(config, fetcher).verifyAccessToken(accessToken)).resolves.toEqual({
      accessToken,
      authUserId: '11111111-1111-4111-8111-111111111111',
      email: 'person@example.test',
      aal: 'aal1',
    });
  });

  it('rejects an auth response whose verified user does not match the requested email', async () => {
    const accessToken = jwt({ sub: '11111111-1111-4111-8111-111111111111', role: 'authenticated', aal: 'aal1' });
    const fetcher = vi.fn<typeof fetch>(async () => json({ access_token: accessToken, user: { id: '11111111-1111-4111-8111-111111111111', email: 'other@example.test', is_anonymous: false } }));
    await expect(new SupabaseIdentityBridge(config, fetcher).verifyEmailOtp('person@example.test', '123456')).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('creates a session through one server-only RPC without accepting tenant or actor input', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/rest/v1/rpc/eutaktos_create_auth_session');
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        p_email: 'person@example.test',
        p_auth_user_id: '11111111-1111-4111-8111-111111111111',
        p_session_id: 'session-test-id',
        p_authenticated_at: '2026-08-23T00:00:00.000Z',
        p_aal: 'aal1',
      });
      expect(body.p_tenant_id).toBeUndefined();
      expect(body.p_actor_id).toBeUndefined();
      return json([{ session_id: 'session-test-id', tenant_id: 'tenant-a', actor_id: 'person-1', mfa_required: false }]);
    });
    await expect(new SupabaseIdentityBridge(config, fetcher).createEutaktosSession({
      email: 'person@example.test',
      authUserId: '11111111-1111-4111-8111-111111111111',
      sessionId: 'session-test-id',
      authenticatedAt: '2026-08-23T00:00:00.000Z',
      aal: 'aal1',
    })).resolves.toEqual({ sessionId: 'session-test-id', tenantId: 'tenant-a', actorId: 'person-1', mfaRequired: false });
  });
});