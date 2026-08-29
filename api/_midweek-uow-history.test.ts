import { describe, expect, it } from 'vitest';
import type { MidweekSchedulingChange } from '@eutaktos/application';
import { addMeetingSlot, createAccessContext, createMidweekMeeting, type MidweekMeeting } from '@eutaktos/domain';
import { SupabaseRestDatabase, type EntityRow } from './_db';
import { SchedulingSnapshotUnitOfWork } from './_midweek-uow';

const tenantId = 'tenant-a';
const occurredAt = '2026-08-29T20:00:00.000Z';

function row(entityType: string, value: { id: string; tenantId: string }, version = 1): EntityRow {
  return { tenant_id: value.tenantId, entity_type: entityType, entity_id: value.id, data: value, version };
}

function meeting(): Readonly<MidweekMeeting> {
  let value = createMidweekMeeting({ id: 'meeting-1', tenantId, date: '2026-09-01', localTime: '20:00', timezone: 'Europe/Lisbon', now: occurredAt });
  value = addMeetingSlot(value, { id: 'slot-1', position: 0, durationMinutes: 5, titleKey: 'part', partDefinitionId: 'part:initial-call' });
  return value;
}

const context = createAccessContext({ tenantId, actorId: 'actor-1', capabilities: ['schedule.read', 'schedule.write'] });

describe('SchedulingSnapshotUnitOfWork assignment history', () => {
  it('sends student and assistant history in the same atomic database call', async () => {
    const currentMeeting = meeting();
    const unit = new SchedulingSnapshotUnitOfWork(tenantId, {
      meetings: [row('midweek-meeting', currentMeeting)],
      studentAssignments: [],
      nonStudentAssignments: [],
      people: [],
      partDefinitions: [],
    });

    const studentAssignment = {
      id: 'assignment-1',
      tenantId,
      meetingId: currentMeeting.id,
      slotId: 'slot-1',
      studentId: 'person-student',
      assistantId: 'person-assistant',
      state: 'assigned',
    };
    const change = {
      studentAssignment,
      auditEvents: [{ id: 'audit-1', tenantId, occurredAt }],
      domainEvents: [{ id: 'event-1', tenantId }],
    } as unknown as MidweekSchedulingChange;

    unit.commit(context, change);

    let url = '';
    let body: Record<string, unknown> = {};
    const fetcher: typeof fetch = async (input, init) => {
      url = String(input);
      body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
      return new Response(null, { status: 204 });
    };
    await unit.flush(new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher));

    expect(url).toContain('/rest/v1/rpc/eutaktos_apply_scheduling_entity_change');
    const history = body.p_history as Array<Record<string, unknown>>;
    expect(history).toHaveLength(2);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ personId: 'person-student', partType: 'student:part:initial-call', state: 'assigned' }),
      expect.objectContaining({ personId: 'person-assistant', partType: 'assistant:part:initial-call', state: 'assigned' }),
    ]));
  });
});
