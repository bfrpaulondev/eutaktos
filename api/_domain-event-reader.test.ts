import { describe, expect, it, vi } from 'vitest';
import { DomainEventReader } from './_domain-event-reader';

const config = { url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' } as const;

describe('DomainEventReader', () => {
  it('reads only minimized outbox metadata without claiming or mutating delivery state', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify([{
      tenant_id: 'tenant-a',
      id: 'event-1',
      event_type: 'AvailabilityChanged',
      aggregate_id: 'person-a',
      occurred_at: '2026-08-25T10:00:00.000Z',
      schema_version: 1,
    }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const reader = new DomainEventReader(config, fetchMock as unknown as typeof fetch);

    await expect(reader.list({ tenantId: 'tenant-a', eventType: 'AvailabilityChanged', from: '2026-08-12T00:00:00.000Z', limit: 200, offset: 400 })).resolves.toEqual([{
      tenant_id: 'tenant-a',
      id: 'event-1',
      event_type: 'AvailabilityChanged',
      aggregate_id: 'person-a',
      occurred_at: '2026-08-25T10:00:00.000Z',
      schema_version: 1,
    }]);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/eutaktos_outbox?');
    expect(url).toContain('event_type=eq.AvailabilityChanged');
    expect(url).toContain('tenant_id=eq.tenant-a');
    expect(url).toContain('limit=200');
    expect(url).toContain('offset=400');
    expect(decodeURIComponent(url)).toContain('select=tenant_id,id,event_type,aggregate_id,occurred_at,schema_version');
    expect(url).not.toContain('/rpc/');
    expect(url).not.toContain('actor_id');
    expect(url).not.toContain('payload');
    expect(init.method).toBeUndefined();
    expect(init.headers).toMatchObject({ apikey: 'sb_secret_test' });
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('rejects malformed projections and invalid paging rather than accepting ambiguous history', async () => {
    const malformedMock = vi.fn(async () => new Response(JSON.stringify([{ id: 'event-1' }]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const reader = new DomainEventReader(config, malformedMock as unknown as typeof fetch);
    await expect(reader.list({ tenantId: 'tenant-a', eventType: 'AvailabilityChanged', limit: 10 })).rejects.toThrow('Production database request failed');
    await expect(reader.list({ tenantId: 'tenant-a', eventType: 'AvailabilityChanged', limit: 0 })).rejects.toThrow('Production database request failed');
  });
});
