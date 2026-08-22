import { describe, expect, it } from 'vitest';
import { SupabaseRestDatabase, type OutboxRow } from './_db';
import { isDeliverableNotificationEvent } from './workers/outbox';

function outbox(payload: Readonly<Record<string, unknown>>): OutboxRow {
  return Object.freeze({
    tenant_id: 'tenant-a', id: 'event-1', event_type: 'NotificationIntentQueued', aggregate_id: 'assignment-1', actor_id: 'actor-1',
    occurred_at: '2026-08-22T18:30:00.000Z', schema_version: 1, payload, delivery_attempts: 1,
  });
}

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

  it('parses the final K47 outbox row without coercion but does not treat an empty domain payload as deliverable', async () => {
    const row = {
      tenant_id: 'tenant-a', id: 'event-1', event_type: 'NotificationIntentQueued', aggregate_id: 'assignment-1', actor_id: 'actor-1',
      occurred_at: '2026-08-22T18:30:00.000Z', schema_version: 1, correlation_id: null, payload: {}, delivery_attempts: 1,
    };
    const fetcher: typeof fetch = async () => new Response(JSON.stringify([row]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher);
    const claimed = await database.claimNotificationOutbox(1);
    expect(claimed).toEqual([expect.objectContaining({ event_type: 'NotificationIntentQueued', schema_version: 1 })]);
    expect(isDeliverableNotificationEvent(claimed[0])).toBe(false);
  });

  it('requires the complete privacy-bounded delivery envelope before a provider may be called', () => {
    expect(isDeliverableNotificationEvent(outbox({
      deliveryId: 'delivery-1', recipientId: 'person-1', channel: 'email', templateKey: 'assignment.created', locale: 'pt-PT',
    }))).toBe(true);
    expect(isDeliverableNotificationEvent(outbox({
      deliveryId: 'delivery-1', recipientId: 'person-1', channel: 'unknown', templateKey: 'assignment.created', locale: 'pt-PT',
    }))).toBe(false);
    expect(isDeliverableNotificationEvent(outbox({
      deliveryId: 'delivery-1', recipientId: 'person-1', channel: 'email', templateKey: 'assignment.created',
    }))).toBe(false);
  });
});
