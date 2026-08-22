import { describe, expect, it, vi } from 'vitest';
import { AuthenticationError, parseSessionCookie, resolvePrincipal, sessionCookie } from './_auth';
import { SupabaseRestDatabase, type DatabaseConfig } from './_db';

const config: DatabaseConfig = { url: 'https://example.supabase.co', serviceRoleKey: 'server-secret' };
function jsonResponse(value: unknown): Response { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } }); }
function request(cookie: string) { return { method: 'GET', headers: { cookie }, query: {} } as const; }
const session = (overrides: Readonly<Record<string, unknown>> = {}) => ({ id:'session-1', tenant_id:'tenant-a', actor_id:'person-a', issued_at:'2026-08-22T12:00:00.000Z', idle_expires_at:'2026-08-22T18:00:00.000Z', absolute_expires_at:'2026-08-23T12:00:00.000Z', idle_timeout_ms:1800000, revoked_at:null, ...overrides });

describe('production session boundary', () => {
  it('rejects duplicate session cookies instead of choosing one', () => {
    expect(parseSessionCookie('__Host-eutaktos_session=a; __Host-eutaktos_session=b')).toBeUndefined();
  });
  it('rejects malformed session tokens', () => {
    expect(parseSessionCookie('__Host-eutaktos_session=<script>')).toBeUndefined();
  });
  it('emits only a host-only secure HttpOnly session cookie', () => {
    const cookie=sessionCookie('session-1');
    expect(cookie).toContain('__Host-eutaktos_session=session-1');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).not.toContain('Domain=');
  });
  it('derives tenant and capabilities only from server-side records', async () => {
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      if (url.includes('eutaktos_sessions')) return jsonResponse([session()]);
      expect(url).toContain('tenant_id=eq.tenant-a');
      expect(url).toContain('subject_id=eq.person-a');
      return jsonResponse([
        { tenant_id:'tenant-a', id:'g1', subject_id:'person-a', capability:'people.read', granted_by:'admin', granted_at:'2026-08-22T12:00:00.000Z', revoked_at:null },
        { tenant_id:'tenant-a', id:'g2', subject_id:'person-a', capability:'not-a-capability', granted_by:'admin', granted_at:'2026-08-22T12:00:00.000Z', revoked_at:null },
      ]);
    });
    const principal = await resolvePrincipal(request('__Host-eutaktos_session=session-1'), new SupabaseRestDatabase(config, fetcher), () => Date.parse('2026-08-22T13:00:00.000Z'));
    expect(principal).toEqual({ tenantId:'tenant-a', actorId:'person-a', capabilities:['people.read'], sessionId:'session-1' });
  });
  it('rejects an expired server-side session', async () => {
    const fetcher = vi.fn<typeof fetch>(async input => String(input).includes('eutaktos_sessions') ? jsonResponse([session({idle_expires_at:'2026-08-22T11:00:00.000Z'})]) : jsonResponse([]));
    await expect(resolvePrincipal(request('__Host-eutaktos_session=session-1'), new SupabaseRestDatabase(config, fetcher), () => Date.parse('2026-08-22T13:00:00.000Z'))).rejects.toBeInstanceOf(AuthenticationError);
  });
});
