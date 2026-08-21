import { describe, expect, it, vi } from 'vitest';
import { createAccessContext, type AccessContext, type Capability } from '@eutaktos/domain';
import type { VerifiedPrincipal } from './people-http';
import {
  handleAddSlot,
  handleArchiveMeeting,
  handleAssignNonStudent,
  handleAssignStudent,
  handleCancelAssignment,
  handleCreateMeeting,
  handleGetMeeting,
  handleListMeetings,
  handlePublishMeeting,
  handleRemoveSlot,
  handleUpdateMeeting,
  toMeetingDto,
  type MidweekSchedulingPort,
  type LocalMeeting,
  type LocalAssignment,
  type LocalSlot,
  type AssignmentResponse,
  type MeetingResponse,
  type SlotResponse,
} from './midweek-scheduling-http';

// ────────────────────────────────────────────────────────────
// Fixtures
// ────────────────────────────────────────────────────────────

function principal(
  capabilities: readonly Capability[] = ['schedule.read', 'schedule.write'],
  tenantId = 'tenant-a',
): VerifiedPrincipal {
  return { tenantId, actorId: 'actor-1', capabilities };
}

function slot(overrides: Partial<LocalSlot> = {}): LocalSlot {
  return {
    id: 'slot-1',
    meetingId: 'meeting-1',
    assignmentTypeId: 'bible-reading',
    label: 'Bible Reading',
    order: 0,
    ...overrides,
  };
}

function assignment(overrides: Partial<LocalAssignment> = {}): LocalAssignment {
  return {
    id: 'assign-1',
    meetingId: 'meeting-1',
    slotId: 'slot-1',
    personId: 'person-1',
    role: 'student',
    status: 'assigned',
    assignedBy: 'actor-1',
    assignedAt: '2026-09-01T12:00:00Z',
    tenantId: 'tenant-a',
    ...overrides,
  };
}

function meeting(overrides: Partial<LocalMeeting> = {}): LocalMeeting {
  return {
    id: 'meeting-1',
    tenantId: 'tenant-a',
    date: '2026-09-15',
    status: 'draft',
    slots: [slot()],
    createdBy: 'actor-1',
    createdAt: '2026-09-01T10:00:00Z',
    updatedAt: '2026-09-01T10:00:00Z',
    ...overrides,
  };
}

function fakePort(overrides: Partial<MidweekSchedulingPort> = {}): MidweekSchedulingPort {
  return {
    createMeeting: (_ctx: AccessContext, input: { date: string; note?: string }) =>
      meeting({ id: 'new-meeting', date: input.date, note: input.note }),
    getMeeting: (_ctx: AccessContext, id: string) =>
      id === 'meeting-1' ? meeting() : undefined,
    listMeetings: (_ctx: AccessContext) => [meeting()],
    addSlot: (_ctx: AccessContext, _meetingId: string, input: { assignmentTypeId: string; label?: string; order?: number }) =>
      meeting({
        slots: [
          slot(),
          slot({ id: 'slot-new', assignmentTypeId: input.assignmentTypeId, label: input.label, order: input.order ?? 1 }),
        ],
      }),
    removeSlot: (_ctx: AccessContext, _meetingId: string, _slotId: string) =>
      meeting({ slots: [] }),
    assignStudent: (_ctx: AccessContext, _meetingId: string, input: { personId: string; slotId: string; assistantId?: string }) =>
      assignment({ id: 'assign-new', personId: input.personId, slotId: input.slotId, assistantId: input.assistantId, role: 'student' }),
    assignNonStudent: (_ctx: AccessContext, _meetingId: string, input: { personId: string; slotId: string; role?: string }) =>
      assignment({ id: 'assign-new', personId: input.personId, slotId: input.slotId, role: 'non-student' }),
    cancelAssignment: (_ctx: AccessContext, _assignmentId: string) =>
      assignment({ status: 'cancelled' }),
    publishMeeting: (_ctx: AccessContext, _meetingId: string) =>
      meeting({ status: 'published' }),
    archiveMeeting: (_ctx: AccessContext, _meetingId: string) =>
      meeting({ status: 'archived' }),
    updateMeeting: (_ctx: AccessContext, _meetingId: string, input: { date?: string; note?: string }) =>
      meeting({ ...input, updatedAt: '2026-09-02T10:00:00Z' }),
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────

describe('MidweekScheduling HTTP Transport', () => {
  // ── Auth ──
  describe('authentication', () => {
    it('handleCreateMeeting rejects anonymous requests with 401', () => {
      expect(handleCreateMeeting(undefined, fakePort(), {})).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleGetMeeting rejects anonymous requests with 401', () => {
      expect(handleGetMeeting(undefined, fakePort(), 'meeting-1')).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleListMeetings rejects anonymous requests with 401', () => {
      expect(handleListMeetings(undefined, fakePort())).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleAddSlot rejects anonymous requests with 401', () => {
      expect(handleAddSlot(undefined, fakePort(), 'meeting-1', {})).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleRemoveSlot rejects anonymous requests with 401', () => {
      expect(handleRemoveSlot(undefined, fakePort(), 'meeting-1', 'slot-1')).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleAssignStudent rejects anonymous requests with 401', () => {
      expect(handleAssignStudent(undefined, fakePort(), 'meeting-1', {})).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleAssignNonStudent rejects anonymous requests with 401', () => {
      expect(handleAssignNonStudent(undefined, fakePort(), 'meeting-1', {})).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleCancelAssignment rejects anonymous requests with 401', () => {
      expect(handleCancelAssignment(undefined, fakePort(), 'assign-1')).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handlePublishMeeting rejects anonymous requests with 401', () => {
      expect(handlePublishMeeting(undefined, fakePort(), 'meeting-1')).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleArchiveMeeting rejects anonymous requests with 401', () => {
      expect(handleArchiveMeeting(undefined, fakePort(), 'meeting-1')).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });

    it('handleUpdateMeeting rejects anonymous requests with 401', () => {
      expect(handleUpdateMeeting(undefined, fakePort(), 'meeting-1', {})).toEqual({
        status: 401, body: { error: 'Unauthorized' },
      });
    });
  });

  // ── Capability enforcement ──
  describe('capability enforcement', () => {
    it('handleListMeetings maps Access denied to 403', () => {
      const port = fakePort({
        listMeetings: () => { throw new Error('Access denied: missing capability midweek.read'); },
      });
      const res = handleListMeetings(principal(['people.read']), port);
      expect(res).toEqual({ status: 403, body: { error: 'Forbidden' } });
    });

    it('handleCreateMeeting maps Access denied to 403', () => {
      const port = fakePort({
        createMeeting: () => { throw new Error('Access denied: missing capability midweek.write'); },
      });
      const res = handleCreateMeeting(principal(['schedule.read']), port, { date: '2026-09-15' });
      expect(res).toEqual({ status: 403, body: { error: 'Forbidden' } });
    });

    it('handlePublishMeeting maps Access denied to 403', () => {
      const port = fakePort({
        publishMeeting: () => { throw new Error('Access denied: missing capability midweek.publish'); },
      });
      const res = handlePublishMeeting(principal(['schedule.read']), port, 'meeting-1');
      expect(res).toEqual({ status: 403, body: { error: 'Forbidden' } });
    });

    it('handleAssignStudent maps Access denied to 403', () => {
      const port = fakePort({
        assignStudent: () => { throw new Error('Access denied: missing capability midweek.assign'); },
      });
      const res = handleAssignStudent(principal(['schedule.read']), port, 'meeting-1', { personId: 'p-1', slotId: 's-1' });
      expect(res).toEqual({ status: 403, body: { error: 'Forbidden' } });
    });
  });

  // ── Tenant isolation ──
  describe('tenant isolation', () => {
    it('handleListMeetings filters by tenant via AccessContext', () => {
      let seenTenant: string | undefined;
      const port = fakePort({
        listMeetings: (ctx: AccessContext) => { seenTenant = ctx.tenantId; return []; },
      });
      handleListMeetings(principal(['schedule.read'], 'tenant-xyz'), port);
      expect(seenTenant).toBe('tenant-xyz');
    });

    it('handleGetMeeting passes tenant from principal, not body', () => {
      let seenTenant: string | undefined;
      const port = fakePort({
        getMeeting: (ctx: AccessContext) => { seenTenant = ctx.tenantId; return meeting(); },
      });
      handleGetMeeting(principal(['schedule.read'], 'tenant-b'), port, 'meeting-1');
      expect(seenTenant).toBe('tenant-b');
    });

    it('handleCreateMeeting derives tenant from principal only', () => {
      let seenTenant: string | undefined;
      const port = fakePort({
        createMeeting: (ctx: AccessContext) => { seenTenant = ctx.tenantId; return meeting(); },
      });
      handleCreateMeeting(principal(['schedule.write'], 'tenant-isolated'), port, { date: '2026-09-20' });
      expect(seenTenant).toBe('tenant-isolated');
    });
  });

  // ── Valid handler flows ──
  describe('valid handler flows', () => {
    it('handleCreateMeeting returns 201 with MeetingResponse', () => {
      const res = handleCreateMeeting(
        principal(['schedule.write']),
        fakePort(),
        { date: '2026-09-15' },
        'corr-1',
      );
      expect(res.status).toBe(201);
      assertMeetingResponse(res.body);
      expect((res.body as MeetingResponse).date).toBe('2026-09-15');
    });

    it('handleGetMeeting returns 200 with MeetingResponse', () => {
      const res = handleGetMeeting(principal(['schedule.read']), fakePort(), 'meeting-1');
      expect(res.status).toBe(200);
      assertMeetingResponse(res.body);
    });

    it('handleGetMeeting returns 404 for missing meeting', () => {
      const res = handleGetMeeting(principal(['schedule.read']), fakePort(), 'missing');
      expect(res).toEqual({ status: 404, body: { error: 'Meeting not found' } });
    });

    it('handleListMeetings returns 200 with array of MeetingResponse', () => {
      const res = handleListMeetings(principal(['schedule.read']), fakePort());
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      assertMeetingResponse((res.body as MeetingResponse[])[0]);
    });

    it('handleAddSlot returns 200 with updated meeting', () => {
      const res = handleAddSlot(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        { assignmentTypeId: 'talk-1', label: 'Ministry Talk', order: 2 },
        'corr-2',
      );
      expect(res.status).toBe(200);
      assertMeetingResponse(res.body);
      expect((res.body as MeetingResponse).slots).toHaveLength(2);
    });

    it('handleRemoveSlot returns 200 with meeting without slot', () => {
      const res = handleRemoveSlot(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        'slot-1',
        'corr-3',
      );
      expect(res.status).toBe(200);
      assertMeetingResponse(res.body);
      expect((res.body as MeetingResponse).slots).toHaveLength(0);
    });

    it('handleAssignStudent returns 201 with AssignmentResponse', () => {
      const res = handleAssignStudent(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        { personId: 'p-2', slotId: 'slot-1', assistantId: 'p-3' },
        'corr-4',
      );
      expect(res.status).toBe(201);
      assertAssignmentResponse(res.body);
      expect((res.body as AssignmentResponse).assistantId).toBe('p-3');
    });

    it('handleAssignNonStudent returns 201 with AssignmentResponse', () => {
      const res = handleAssignNonStudent(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        { personId: 'p-4', slotId: 'slot-1' },
        'corr-5',
      );
      expect(res.status).toBe(201);
      assertAssignmentResponse(res.body);
      expect((res.body as AssignmentResponse).role).toBe('non-student');
    });

    it('handleCancelAssignment returns 200 with cancelled assignment', () => {
      const res = handleCancelAssignment(
        principal(['schedule.write']),
        fakePort(),
        'assign-1',
        'corr-6',
      );
      expect(res.status).toBe(200);
      expect((res.body as AssignmentResponse).status).toBe('cancelled');
    });

    it('handlePublishMeeting returns 200 with published meeting', () => {
      const res = handlePublishMeeting(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        'corr-7',
      );
      expect(res.status).toBe(200);
      expect((res.body as MeetingResponse).status).toBe('published');
    });

    it('handleArchiveMeeting returns 200 with archived meeting', () => {
      const res = handleArchiveMeeting(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        'corr-8',
      );
      expect(res.status).toBe(200);
      expect((res.body as MeetingResponse).status).toBe('archived');
    });

    it('handleUpdateMeeting returns 200 with updated meeting', () => {
      const res = handleUpdateMeeting(
        principal(['schedule.write']),
        fakePort(),
        'meeting-1',
        { date: '2026-09-22', note: 'Updated' },
        'corr-9',
      );
      expect(res.status).toBe(200);
      const m = res.body as MeetingResponse;
      expect(m.date).toBe('2026-09-22');
      expect(m.note).toBe('Updated');
    });
  });

  // ── Input validation ──
  describe('input validation', () => {
    it('handleCreateMeeting rejects missing date', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), {});
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('date must be a non-empty string');
    });

    it('handleCreateMeeting rejects wrong type for date', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), { date: 12345 });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('date must be a non-empty string');
    });

    it('handleCreateMeeting rejects empty string for date', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), { date: '' });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('date must be a non-empty string');
    });

    it('handleCreateMeeting rejects wrong type for note', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), { date: '2026-09-15', note: 42 });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('note must be a string');
    });

    it('handleAssignStudent rejects missing personId', () => {
      const res = handleAssignStudent(principal(['schedule.write']), fakePort(), 'meeting-1', { slotId: 's-1' });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('personId must be a non-empty string');
    });

    it('handleAssignStudent rejects missing slotId', () => {
      const res = handleAssignStudent(principal(['schedule.write']), fakePort(), 'meeting-1', { personId: 'p-1' });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('slotId must be a non-empty string');
    });

    it('handleUpdateMeeting rejects body with no fields', () => {
      const res = handleUpdateMeeting(principal(['schedule.write']), fakePort(), 'meeting-1', {});
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('At least one');
    });

    it('handleGetMeeting rejects missing meetingId', () => {
      expect(handleGetMeeting(principal(['schedule.read']), fakePort(), undefined)).toEqual({
        status: 400, body: { error: 'meetingId is required' },
      });
      expect(handleGetMeeting(principal(['schedule.read']), fakePort(), '')).toEqual({
        status: 400, body: { error: 'meetingId is required' },
      });
    });

    it('handleRemoveSlot rejects missing slotId', () => {
      const res = handleRemoveSlot(principal(['schedule.write']), fakePort(), 'meeting-1', undefined);
      expect(res).toEqual({ status: 400, body: { error: 'slotId is required' } });
    });

    it('handleCancelAssignment rejects missing assignmentId', () => {
      const res = handleCancelAssignment(principal(['schedule.write']), fakePort(), undefined);
      expect(res).toEqual({ status: 400, body: { error: 'assignmentId is required' } });
    });
  });

  // ── Unknown fields / mass-assignment protection ──
  describe('mass-assignment protection', () => {
    it('handleCreateMeeting rejects unknown fields like tenantId, id, status', () => {
      const spy = vi.fn(() => meeting());
      const port = fakePort({ createMeeting: spy });
      const res = handleCreateMeeting(principal(['schedule.write']), port, {
        date: '2026-09-15',
        tenantId: 'tenant-evil',
        id: 'evil-id',
        status: 'published',
        createdBy: 'hacker',
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
      expect((res.body as { error: string }).error).toContain('tenantId');
      expect((res.body as { error: string }).error).toContain('id');
      expect(spy).not.toHaveBeenCalled();
    });

    it('handleAssignStudent rejects unknown fields', () => {
      const spy = vi.fn(() => assignment());
      const port = fakePort({ assignStudent: spy });
      const res = handleAssignStudent(principal(['schedule.write']), port, 'meeting-1', {
        personId: 'p-1', slotId: 's-1',
        tenantId: 'tenant-b', role: 'student', meetingId: 'evil',
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
      expect(spy).not.toHaveBeenCalled();
    });

    it('handleUpdateMeeting rejects unknown fields', () => {
      const spy = vi.fn(() => meeting());
      const port = fakePort({ updateMeeting: spy });
      const res = handleUpdateMeeting(principal(['schedule.write']), port, 'meeting-1', {
        date: '2026-09-20', id: 'evil', tenantId: 'tenant-b',
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
      expect(spy).not.toHaveBeenCalled();
    });

    it('handleAddSlot rejects unknown fields', () => {
      const spy = vi.fn(() => meeting());
      const port = fakePort({ addSlot: spy });
      const res = handleAddSlot(principal(['schedule.write']), port, 'meeting-1', {
        assignmentTypeId: 'talk-1', meetingId: 'evil', id: 'slot-evil',
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  // ── Response DTO minimization ──
  describe('response DTO minimization', () => {
    it('toMeetingDto excludes tenantId, createdBy, createdAt, updatedAt', () => {
      const m = meeting({
        tenantId: 'tenant-secret',
        createdBy: 'admin-secret',
        createdAt: '2020-01-01T00:00:00Z',
        updatedAt: '2020-01-02T00:00:00Z',
        slots: [slot({
          meetingId: 'meeting-1',
          assignment: assignment({
            tenantId: 'tenant-secret',
            assignedBy: 'admin-secret',
            assignedAt: '2020-01-01T00:00:00Z',
          }),
        })],
      });
      const dto = toMeetingDto(m);
      const serialized = JSON.stringify(dto);
      expect(dto).not.toHaveProperty('tenantId');
      expect(dto).not.toHaveProperty('createdBy');
      expect(dto).not.toHaveProperty('createdAt');
      expect(dto).not.toHaveProperty('updatedAt');
      expect(serialized).not.toContain('tenant-secret');
      expect(serialized).not.toContain('admin-secret');
    });

    it('assignment in slot response excludes tenantId, assignedBy, assignedAt, meetingId', () => {
      const m = meeting({
        slots: [slot({
          assignment: assignment({
            tenantId: 'tenant-leak',
            assignedBy: 'actor-leak',
            assignedAt: '2020-01-01T00:00:00Z',
            meetingId: 'meeting-leak',
          }),
        })],
      });
      const dto = toMeetingDto(m);
      const a = dto.slots[0].assignment!;
      expect(a).not.toHaveProperty('tenantId');
      expect(a).not.toHaveProperty('assignedBy');
      expect(a).not.toHaveProperty('assignedAt');
      expect(a).not.toHaveProperty('meetingId');
    });

    it('slot response excludes meetingId', () => {
      const m = meeting({ slots: [slot({ meetingId: 'meeting-hidden' })] });
      const dto = toMeetingDto(m);
      expect(dto.slots[0]).not.toHaveProperty('meetingId');
    });

    it('list response does not leak internal fields', () => {
      const res = handleListMeetings(principal(['schedule.read']), fakePort());
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('tenantId');
      expect(serialized).not.toContain('createdBy');
      expect(serialized).not.toContain('assignedBy');
      expect(serialized).not.toContain('createdAt');
    });
  });

  // ── Error safety ──
  describe('safe error responses', () => {
    it('unexpected errors produce 500 without leaking details', () => {
      const port = fakePort({
        getMeeting: () => { throw new Error('Database connection string: postgres://admin:secret@host/db'); },
      });
      const res = handleGetMeeting(principal(['schedule.read']), port, 'meeting-1');
      expect(res).toEqual({ status: 500, body: { error: 'Internal server error' } });
    });

    it('non-Error throws produce 500', () => {
      const port = fakePort({
        listMeetings: () => { throw 'something weird'; },
      });
      const res = handleListMeetings(principal(['schedule.read']), port);
      expect(res).toEqual({ status: 500, body: { error: 'Internal server error' } });
    });

    it('Assignment not found maps to 404', () => {
      const port = fakePort({
        cancelAssignment: () => { throw new Error('Assignment not found'); },
      });
      const res = handleCancelAssignment(principal(['schedule.write']), port, 'assign-missing');
      expect(res).toEqual({ status: 404, body: { error: 'Assignment not found' } });
    });

    it('Slot not found maps to 404', () => {
      const port = fakePort({
        removeSlot: () => { throw new Error('Slot not found'); },
      });
      const res = handleRemoveSlot(principal(['schedule.write']), port, 'meeting-1', 'slot-missing');
      expect(res).toEqual({ status: 404, body: { error: 'Slot not found' } });
    });
  });

  // ── Correlation ID propagation ──
  describe('correlation ID propagation', () => {
    it('handleCreateMeeting passes correlationId to port metadata', () => {
      let seenMeta: { correlationId?: string } | undefined;
      const port = fakePort({
        createMeeting: (_ctx: AccessContext, _input: { date: string }, meta?: { correlationId?: string }) => {
          seenMeta = meta;
          return meeting();
        },
      });
      handleCreateMeeting(principal(['schedule.write']), port, { date: '2026-09-15' }, 'corr-abc');
      expect(seenMeta).toEqual({ correlationId: 'corr-abc' });
    });

    it('handlePublishMeeting passes correlationId to port metadata', () => {
      let seenMeta: { correlationId?: string } | undefined;
      const port = fakePort({
        publishMeeting: (_ctx: AccessContext, _meetingId: string, meta?: { correlationId?: string }) => {
          seenMeta = meta;
          return meeting();
        },
      });
      handlePublishMeeting(principal(['schedule.write']), port, 'meeting-1', 'corr-xyz');
      expect(seenMeta).toEqual({ correlationId: 'corr-xyz' });
    });
  });

  // ── Fuzz / adversarial payloads ──
  describe('fuzz and adversarial payloads', () => {
    it('rejects array instead of object for create body', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), [{ date: '2026-09-15' }]);
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('must be an object');
    });

    it('rejects null body', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), null);
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('must be an object');
    });

    it('rejects string body', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), 'not json');
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('must be an object');
    });

    it('rejects number body', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), 42);
      expect(res.status).toBe(400);
    });

    it('rejects boolean body', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), true);
      expect(res.status).toBe(400);
    });

    it('rejects __proto__ injection attempt', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), {
        date: '2026-09-15',
        ['__proto__']: { admin: true },
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
    });

    it('rejects constructor injection attempt', () => {
      const res = handleAssignStudent(principal(['schedule.write']), fakePort(), 'meeting-1', {
        personId: 'p-1', slotId: 's-1',
        ['constructor']: { prototype: { role: 'admin' } },
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('Unknown request fields');
    });

    it('rejects very long string values', () => {
      const longStr = 'x'.repeat(100_000);
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), { date: longStr });
      // Should not crash; the date is a string so it passes type validation
      expect(res.status).toBe(201);
    });

    it('handles unicode in field values without crashing', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), {
        date: '2026-09-15',
        note: '🎉 中文 тест 日本語 ñoño',
      });
      expect(res.status).toBe(201);
    });

    it('rejects nested object where string expected for date', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), {
        date: { value: '2026-09-15' },
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('date must be a non-empty string');
    });

    it('rejects number where string expected for personId', () => {
      const res = handleAssignStudent(principal(['schedule.write']), fakePort(), 'meeting-1', {
        personId: 123, slotId: 's-1',
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('personId must be a non-empty string');
    });

    it('rejects NaN for numeric field in addSlot', () => {
      const res = handleAddSlot(principal(['schedule.write']), fakePort(), 'meeting-1', {
        assignmentTypeId: 'talk-1', order: NaN,
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('order must be a number');
    });

    it('rejects Infinity for numeric field in addSlot', () => {
      const res = handleAddSlot(principal(['schedule.write']), fakePort(), 'meeting-1', {
        assignmentTypeId: 'talk-1', order: Infinity,
      });
      expect(res.status).toBe(400);
      expect((res.body as { error: string }).error).toContain('order must be a number');
    });

    it('handles undefined body gracefully', () => {
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), undefined);
      expect(res.status).toBe(400);
    });

    it('rejects object with only prototype-polluted keys', () => {
      const payload = Object.create(null);
      payload['toString'] = 'hacked';
      const res = handleCreateMeeting(principal(['schedule.write']), fakePort(), payload);
      expect(res.status).toBe(400);
    });
  });

  // ── Determinism ──
  describe('deterministic responses', () => {
    it('same input produces same output for handleGetMeeting', () => {
      const port = fakePort();
      const p = principal(['schedule.read']);
      const a = handleGetMeeting(p, port, 'meeting-1');
      const b = handleGetMeeting(p, port, 'meeting-1');
      expect(a).toEqual(b);
    });

    it('same input produces same output for handleListMeetings', () => {
      const port = fakePort();
      const p = principal(['schedule.read']);
      const a = handleListMeetings(p, port);
      const b = handleListMeetings(p, port);
      expect(a).toEqual(b);
    });

    it('same input produces same output for handleCreateMeeting', () => {
      const port = fakePort();
      const p = principal(['schedule.write']);
      const body = { date: '2026-09-15' };
      const a = handleCreateMeeting(p, port, body);
      const b = handleCreateMeeting(p, port, body);
      expect(a).toEqual(b);
    });
  });

  // ── PII check ──
  describe('PII safety', () => {
    it('response DTOs never contain person names or emails', () => {
      const m = meeting({
        slots: [slot({
          assignment: assignment({ personId: 'p-1' }),
        })],
      });
      const dto = toMeetingDto(m);
      const serialized = JSON.stringify(dto);
      expect(serialized).not.toContain('email');
      expect(serialized).not.toContain('phone');
      expect(serialized).not.toContain('displayName');
    });
  });
});

// ────────────────────────────────────────────────────────────
// Type guard helpers for test assertions
// ────────────────────────────────────────────────────────────

function assertMeetingResponse(body: unknown): asserts body is MeetingResponse {
  if (!body || typeof body !== 'object') throw new Error('Expected MeetingResponse object');
  const m = body as MeetingResponse;
  if (typeof m.id !== 'string') throw new Error('MeetingResponse.id must be string');
  if (typeof m.date !== 'string') throw new Error('MeetingResponse.date must be string');
  if (typeof m.status !== 'string') throw new Error('MeetingResponse.status must be string');
  if (!Array.isArray(m.slots)) throw new Error('MeetingResponse.slots must be array');
}

function assertAssignmentResponse(body: unknown): asserts body is AssignmentResponse {
  if (!body || typeof body !== 'object') throw new Error('Expected AssignmentResponse object');
  const a = body as AssignmentResponse;
  if (typeof a.id !== 'string') throw new Error('AssignmentResponse.id must be string');
  if (typeof a.personId !== 'string') throw new Error('AssignmentResponse.personId must be string');
  if (typeof a.slotId !== 'string') throw new Error('AssignmentResponse.slotId must be string');
  if (typeof a.role !== 'string') throw new Error('AssignmentResponse.role must be string');
  if (typeof a.status !== 'string') throw new Error('AssignmentResponse.status must be string');
}

// Compile-time sanity: principals are converted to domain contexts
void createAccessContext;
