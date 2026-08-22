import { describe, expect, it } from 'vitest';
import { MidweekSchedulingService } from '@eutaktos/application';
import { addMeetingSlot, createAccessContext, createMidweekMeeting, type MidweekMeeting } from '@eutaktos/domain';
import { SupabaseRestDatabase, type EntityRow } from './_db';
import { meetingStartInstant, SchedulingSnapshotUnitOfWork } from './_midweek-uow';

const tenantId = 'tenant-a';
const now = '2026-08-22T12:00:00.000Z';

function row(entityType: string, value: { id: string; tenantId: string }, version = 1): EntityRow {
  return { tenant_id: value.tenantId, entity_type: entityType, entity_id: value.id, data: value, version };
}
function meeting(): Readonly<MidweekMeeting> {
  let value = createMidweekMeeting({ id: 'meeting-1', tenantId, date: '2026-08-22', localTime: '19:00', timezone: 'Europe/Lisbon', now });
  value = addMeetingSlot(value, { id: 'slot-1', position: 0, durationMinutes: 5, titleKey: 'opening' });
  value = addMeetingSlot(value, { id: 'slot-2', position: 1, durationMinutes: 10, titleKey: 'second' });
  return value;
}
function uow(meetings: readonly EntityRow[] = []) {
  return new SchedulingSnapshotUnitOfWork(tenantId, { meetings, studentAssignments: [], nonStudentAssignments: [], people: [], partDefinitions: [] });
}
function context(tenant = tenantId) {
  return createAccessContext({ tenantId: tenant, actorId: 'actor-1', capabilities: ['schedule.write'] });
}

describe('SchedulingSnapshotUnitOfWork', () => {
  it('resolves Europe/Lisbon DST local time and slot offsets from trusted meeting data', () => {
    const value = meeting();
    expect(new Date(meetingStartInstant(value)).toISOString()).toBe('2026-08-22T18:00:00.000Z');
    const unit = uow([row('midweek-meeting', value)]);
    expect(unit.resolveSlotWindow(context(), value, 'slot-2')).toEqual({ startsAt: '2026-08-22T18:05:00.000Z', endsAt: '2026-08-22T18:15:00.000Z' });
  });

  it('rejects cross-tenant stored scheduling rows before any service call', () => {
    const value = { ...meeting(), tenantId: 'tenant-b' };
    expect(() => uow([{ tenant_id: tenantId, entity_type: 'midweek-meeting', entity_id: value.id, data: value, version: 1 }])).toThrow('identity');
  });

  it('derives tenant from AccessContext and flushes entity, audit and event through the atomic RPC', async () => {
    const unit = uow();
    let counter = 0;
    const service = new MidweekSchedulingService(unit, { now: () => now, nextId: scope => `${scope}-${++counter}` });
    const created = service.createDraftMeeting(context(), { date: '2026-08-24', localTime: '19:30', timezone: 'Europe/Lisbon' });
    expect(created.tenantId).toBe(tenantId);

    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> });
      return new Response(null, { status: 204 });
    };
    const database = new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher);
    await unit.flush(database);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('/rest/v1/rpc/eutaktos_apply_entity_change');
    expect(calls[0].body).toMatchObject({ p_tenant_id: tenantId, p_entity_type: 'midweek-meeting', p_entity_id: created.id, p_expected_version: null });
    expect((calls[0].body.p_data as Record<string, unknown>).tenantId).toBe(tenantId);
    expect((calls[0].body.p_audit as Record<string, unknown>).tenantId).toBe(tenantId);
    expect((calls[0].body.p_event as Record<string, unknown>).tenantId).toBe(tenantId);
  });

  it('uses the loaded optimistic version when updating an existing meeting', async () => {
    const current = meeting();
    const unit = uow([row('midweek-meeting', current, 7)]);
    let counter = 0;
    const service = new MidweekSchedulingService(unit, { now: () => '2026-08-22T12:05:00.000Z', nextId: scope => `${scope}-${++counter}` });
    service.updateMeeting(context(), current.id, { localTime: '19:15' });
    let body: Record<string, unknown> | undefined;
    const fetcher: typeof fetch = async (_input, init) => { body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>; return new Response(null, { status: 204 }); };
    await unit.flush(new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher));
    expect(body?.p_expected_version).toBe(7);
  });
});
