import { describe, expect, it } from 'vitest';
import { SupabaseRestDatabase } from './_db';

describe('notification outbox contract', () => {
  it('claims through the notification-specific RPC instead of the generic domain outbox', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher);
    expect(await database.claimNotificationOutbox(25)).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain('/rest/v1/rpc/eutaktos_claim_notification_outbox');
    expect(calls[0]).not.toContain('eutaktos_claim_outbox');
  });

  it('accepts the final K47 NotificationIntentQueued row shape without coercion', async () => {
    const row = {
      tenant_id: 'tenant-a', id: 'event-1', event_type: 'NotificationIntentQueued', aggregate_id: 'assignment-1', actor_id: 'actor-1',
      occurred_at: '2026-08-22T18:30:00.000Z', schema_version: 1, correlation_id: null, payload: {}, delivery_attempts: 1,
    };
    const fetcher: typeof fetch = async () => new Response(JSON.stringify([row]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher);
    expect(await database.claimNotificationOutbox(1)).toEqual([expect.objectContaining({ event_type: 'NotificationIntentQueued', schema_version: 1 })]);
  });
});
