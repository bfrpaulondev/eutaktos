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

async function flushBody(unit: SchedulingSnapshotUnitOfWork): Promise<Record<string, unknown>> {
  let body: Record<string, unknown> = {};
  const fetcher: typeof fetch = async (_input, init) => {
    body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    return new Response(null, { status: 204 });
  };
  await unit.flush(new SupabaseRestDatabase({ url: 'https://example.supabase.co', serviceRoleKey: 'sb_secret_test' }, fetcher));
  return body;
}

function changeFor(studentAssignment: Record<string, unknown>, auditId = 'audit-1'): MidweekSchedulingChange {
  return {
    studentAssignment,
    auditEvents: [{ id: auditId, tenantId, occurredAt }],
    domainEvents: [{ id: `event-${auditId}`, tenantId }],
  } as unknown as MidweekSchedulingChange;
}

describe('SchedulingSnapshotUnitOfWork assignment history', () => {
  it('sends student and assistant history in the same atomic database call', async () => {
    const currentMeeting = meeting();
    const unit = new SchedulingSnapshotUnitOfWork(tenantId, {
      meetings: [row('midweek-meeting', currentMeeting)], studentAssignments: [], nonStudentAssignments: [], people: [], partDefinitions: [],
    });
    unit.commit(context, changeFor({
      id: 'assignment-1', tenantId, meetingId: currentMeeting.id, slotId: 'slot-1',
      studentId: 'person-student', assistantId: 'person-assistant', state: 'assigned',
    }));
    const body = await flushBody(unit);
    const history = body.p_history as Array<Record<string, unknown>>;
    expect(history).toHaveLength(2);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ personId: 'person-student', partType: 'student:part:initial-call', state: 'assigned' }),
      expect.objectContaining({ personId: 'person-assistant', partType: 'assistant:part:initial-call', state: 'assigned' }),
    ]));
  });

  it('cancels previous student and assistant facts when both are replaced', async () => {
    const currentMeeting = meeting();
    const previous = {
      id: 'assignment-1', tenantId, meetingId: currentMeeting.id, slotId: 'slot-1',
      studentId: 'student-old', assistantId: 'assistant-old', state: 'assigned',
    };
    const unit = new SchedulingSnapshotUnitOfWork(tenantId, {
      meetings: [row('midweek-meeting', currentMeeting)], studentAssignments: [row('student-assignment', previous)],
      nonStudentAssignments: [], people: [], partDefinitions: [],
    });
    unit.commit(context, changeFor({ ...previous, studentId: 'student-new', assistantId: 'assistant-new' }, 'audit-replace'));
    const history = (await flushBody(unit)).p_history as Array<Record<string, unknown>>;
    expect(history).toHaveLength(4);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ personId: 'student-old', partType: 'student:part:initial-call', state: 'cancelled' }),
      expect.objectContaining({ personId: 'assistant-old', partType: 'assistant:part:initial-call', state: 'cancelled' }),
      expect.objectContaining({ personId: 'student-new', partType: 'student:part:initial-call', state: 'assigned' }),
      expect.objectContaining({ personId: 'assistant-new', partType: 'assistant:part:initial-call', state: 'assigned' }),
    ]));
  });

  it('cancels the previous non-student assignee when a role assignment is replaced', async () => {
    const currentMeeting = meeting();
    const previous = {
      id: 'role-assignment-1', tenantId, meetingId: currentMeeting.id, slotId: 'slot-1',
      personId: 'person-old', role: 'chairman', state: 'assigned',
    };
    const unit = new SchedulingSnapshotUnitOfWork(tenantId, {
      meetings: [row('midweek-meeting', currentMeeting)], studentAssignments: [],
      nonStudentAssignments: [row('non-student-assignment', previous)], people: [], partDefinitions: [],
    });
    const change = {
      nonStudentAssignment: { ...previous, personId: 'person-new' },
      auditEvents: [{ id: 'audit-role-replace', tenantId, occurredAt }],
      domainEvents: [{ id: 'event-role-replace', tenantId }],
    } as unknown as MidweekSchedulingChange;
    unit.commit(context, change);
    const history = (await flushBody(unit)).p_history as Array<Record<string, unknown>>;
    expect(history).toHaveLength(2);
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ personId: 'person-old', partType: 'role:chairman', state: 'cancelled' }),
      expect.objectContaining({ personId: 'person-new', partType: 'role:chairman', state: 'assigned' }),
    ]));
  });
});
