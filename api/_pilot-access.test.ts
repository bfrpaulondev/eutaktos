import { describe, expect, it, vi } from 'vitest';
import type { DatabaseConfig } from './_db';
import { consumeTemporaryPilotAccessCode, temporaryPilotAccessCodesEnabled } from './_pilot-access';

const config: DatabaseConfig = { url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_server' };

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

describe('temporary pilot access configuration', () => {
  it('is disabled by default and only accepts an explicit true value', () => {
    expect(temporaryPilotAccessCodesEnabled({})).toBe(false);
    expect(temporaryPilotAccessCodesEnabled({ EUTAKTOS_ENABLE_TEMPORARY_PILOT_ACCESS_CODES: 'false' })).toBe(false);
    expect(temporaryPilotAccessCodesEnabled({ EUTAKTOS_ENABLE_TEMPORARY_PILOT_ACCESS_CODES: '1' })).toBe(false);
    expect(temporaryPilotAccessCodesEnabled({ EUTAKTOS_ENABLE_TEMPORARY_PILOT_ACCESS_CODES: ' TRUE ' })).toBe(true);
  });
});

describe('consumeTemporaryPilotAccessCode', () => {
  it('hashes the code server-side and never sends tenant, actor, or raw code to the RPC', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/rest/v1/rpc/eutaktos_consume_pilot_access_code');
      const body = JSON.parse(String(init?.body));
      expect(body).toEqual({
        p_email: 'pilot@example.test',
        p_code_hash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
        p_session_id: 'session-test-id',
        p_authenticated_at: '2026-08-23T01:30:00.000Z',
      });
      expect(JSON.stringify(body)).not.toContain('123456');
      expect(body.p_tenant_id).toBeUndefined();
      expect(body.p_actor_id).toBeUndefined();
      return json([{ session_id: 'session-test-id', tenant_id: 'pilot-eutaktos', actor_id: 'pilot-admin', mfa_required: false }]);
    });

    await expect(consumeTemporaryPilotAccessCode({
      email: ' Pilot@Example.Test ',
      code: '123456',
      sessionId: 'session-test-id',
      authenticatedAt: '2026-08-23T01:30:00.000Z',
    }, config, fetcher)).resolves.toEqual({
      sessionId: 'session-test-id',
      tenantId: 'pilot-eutaktos',
      actorId: 'pilot-admin',
    });
  });

  it('returns undefined for a rejected or exhausted code without exposing why', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => json([]));
    await expect(consumeTemporaryPilotAccessCode({
      email: 'pilot@example.test',
      code: '000000',
      sessionId: 'session-test-id',
      authenticatedAt: '2026-08-23T01:30:00.000Z',
    }, config, fetcher)).resolves.toBeUndefined();
  });
});
