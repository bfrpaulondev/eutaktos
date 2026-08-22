import { describe, expect, it, vi } from 'vitest';
import { SupabaseRestDatabase, type DatabaseConfig } from './_db';

const config: DatabaseConfig = { url: 'https://example.supabase.co', serviceRoleKey: 'server-secret' };
function jsonResponse(value: unknown, status = 200): Response { return new Response(status === 204 ? null : JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }

describe('SupabaseRestDatabase', () => {
  it('always includes tenant and entity type in entity queries', async () => {
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url = String(input);
      expect(url).toContain('tenant_id=eq.tenant-a');
      expect(url).toContain('entity_type=eq.person');
      return jsonResponse([{ tenant_id:'tenant-a', entity_type:'person', entity_id:'p1', data:{id:'p1',tenantId:'tenant-a'}, version:1 }]);
    });
    const rows = await new SupabaseRestDatabase(config, fetcher).entities('tenant-a','person');
    expect(rows[0]?.tenant_id).toBe('tenant-a');
  });

  it('scopes direct entity lookup by tenant even when entity ids can collide', async () => {
    const fetcher = vi.fn<typeof fetch>(async input => {
      const url=String(input);
      expect(url).toContain('tenant_id=eq.tenant-a');
      expect(url).toContain('entity_type=eq.person');
      expect(url).toContain('entity_id=eq.shared-id');
      return jsonResponse([{tenant_id:'tenant-a',entity_type:'person',entity_id:'shared-id',data:{id:'shared-id',tenantId:'tenant-a'},version:2}]);
    });
    const row=await new SupabaseRestDatabase(config,fetcher).entity('tenant-a','person','shared-id');
    expect(row?.tenant_id).toBe('tenant-a');
  });

  it('scopes active access grants by both tenant and subject', async()=>{
    const fetcher=vi.fn<typeof fetch>(async input=>{
      const url=String(input);
      expect(url).toContain('tenant_id=eq.tenant-a');
      expect(url).toContain('subject_id=eq.shared-admin');
      expect(url).toContain('revoked_at=is.null');
      return jsonResponse([]);
    });
    await new SupabaseRestDatabase(config,fetcher).activeGrants('tenant-a','shared-admin');
  });

  it('scopes audit history by tenant before applying optional filters', async()=>{
    const fetcher=vi.fn<typeof fetch>(async input=>{
      const url=String(input);
      expect(url).toContain('tenant_id=eq.tenant-a');
      expect(url).toContain('resource_id=eq.shared-id');
      return jsonResponse([]);
    });
    await new SupabaseRestDatabase(config,fetcher).audit({tenantId:'tenant-a',resourceId:'shared-id',limit:50});
  });

  it('keeps the service role key in request headers rather than query parameters', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).not.toContain('server-secret');
      const headers = init?.headers as Record<string,string>;
      expect(headers.apikey).toBe('server-secret');
      expect(headers.Authorization).toBe('Bearer server-secret');
      return jsonResponse([]);
    });
    await new SupabaseRestDatabase(config, fetcher).entities('tenant-a','person');
  });

  it('uses one database RPC for entity + audit + outbox mutation', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(String(input)).toBe('https://example.supabase.co/rest/v1/rpc/eutaktos_apply_entity_change');
      expect(init?.method).toBe('POST');
      const body = JSON.parse(String(init?.body));
      expect(body.p_tenant_id).toBe('tenant-a');
      expect(body.p_expected_version).toBe(4);
      return jsonResponse(undefined, 204);
    });
    await new SupabaseRestDatabase(config, fetcher).applyEntityChange({ p_tenant_id:'tenant-a', p_entity_type:'person', p_entity_id:'p1', p_data:{id:'p1',tenantId:'tenant-a'}, p_expected_version:4, p_audit:{}, p_event:{} });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reports readiness false when the database schema is unavailable', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}',{status:500,headers:{'content-type':'application/json'}}));
    await expect(new SupabaseRestDatabase(config,fetcher).ready()).resolves.toBe(false);
  });
});
