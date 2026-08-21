/**
 * Midweek meeting scheduling application service.
 *
 * Orchestrates domain operations for midweek meeting lifecycle:
 * draft → published → archived.
 *
 * LOCAL DOMAIN TYPES — Types marked with @local are defined here temporarily
 * because K21–K30 have not yet merged to main. Once those branches are merged,
 * these local definitions will be replaced with imports from @eutaktos/domain.
 */

import {
  assertCapability,
  type AccessContext,
} from '@eutaktos/domain';

// ─── Local domain types (replace with @eutaktos/domain imports after K21–K30 merge) ───

/** @local — replace with @eutaktos/domain MidweekMeeting */
export type MidweekMeetingStatus = 'draft' | 'published' | 'archived';

/** @local — replace with @eutaktos/domain MidweekMeeting */
export interface MidweekMeeting {
  readonly id: string;
  readonly tenantId: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly location: string;
  readonly status: MidweekMeetingStatus;
  readonly slots: readonly MeetingSlot[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** @local — replace with @eutaktos/domain MeetingSlot */
export interface MeetingSlot {
  readonly id: string;
  readonly meetingId: string;
  readonly slotType: string;
  readonly order: number;
  readonly required: boolean;
  readonly title?: string;
}

/** @local — replace with @eutaktos/domain StudentAssignment */
export interface StudentAssignment {
  readonly id: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly studentId: string;
  readonly assistantId?: string;
  readonly createdAt: string;
}

/** @local — replace with @eutaktos/domain NonStudentAssignment */
export interface NonStudentAssignment {
  readonly id: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly personId: string;
  readonly role: string;
  readonly createdAt: string;
}

/** @local — union of assignment types */
export type Assignment = StudentAssignment | NonStudentAssignment;

/** @local — audit event shape matching @eutaktos/domain AuditEvent */
export interface AuditEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly action: 'create' | 'update' | 'delete' | 'grant' | 'revoke';
  readonly actorId: string;
  readonly occurredAt: string;
  readonly changedFields: readonly string[];
}

/** @local — domain event shape matching @eutaktos/domain DomainEvent */
export interface DomainEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly type: string;
  readonly aggregateId: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly schemaVersion: 1;
  readonly correlationId?: string;
}

// ─── Input types ───

export interface CreateMeetingInput {
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly location: string;
}

export interface AddSlotInput {
  readonly slotType: string;
  readonly order: number;
  readonly required: boolean;
  readonly title?: string;
}

export interface UpdateMeetingDetailsInput {
  readonly date?: string;
  readonly localTime?: string;
  readonly timezone?: string;
  readonly location?: string;
}

// ─── Ports ───

export interface MidweekMeetingPort {
  findById(tenantId: string, meetingId: string): MidweekMeeting | undefined;
  save(meeting: MidweekMeeting): void;
  listByTenant(tenantId: string): readonly MidweekMeeting[];
}

export interface AssignmentPort {
  saveStudentAssignment(assignment: StudentAssignment): void;
  saveNonStudentAssignment(assignment: NonStudentAssignment): void;
  findAssignmentsByMeeting(meetingId: string): readonly Assignment[];
  removeAssignment(assignmentId: string): void;
}

export interface AuditPort {
  record(event: AuditEvent): void;
}

export interface DomainEventPort {
  emit(event: DomainEvent): void;
}

// ─── Application runtime (ID/time generation) ───

export interface SchedulingRuntime {
  now(): string;
  nextId(scope: string): string;
}

// ─── Validation helpers ───

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function parseInstant(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
  return value;
}

function assertTenantMatch(ctx: AccessContext, resource: { readonly tenantId: string }): void {
  if (resource.tenantId !== ctx.tenantId) {
    throw new Error('Cross-tenant access denied');
  }
}

function freezeMeeting(m: MidweekMeeting): MidweekMeeting {
  return Object.freeze({ ...m, slots: Object.freeze([...m.slots]) });
}

function assertDraft(meeting: MidweekMeeting, operation: string): void {
  if (meeting.status !== 'draft') {
    throw new Error(`Cannot ${operation} a meeting in '${meeting.status}' status`);
  }
}

function assertPublished(meeting: MidweekMeeting, operation: string): void {
  if (meeting.status !== 'published') {
    throw new Error(`Cannot ${operation} a meeting in '${meeting.status}' status`);
  }
}

// ─── Service factory ───

export function createMidweekSchedulingService(
  meetingPort: MidweekMeetingPort,
  assignmentPort: AssignmentPort,
  auditPort: AuditPort,
  eventPort: DomainEventPort,
  runtime: SchedulingRuntime,
) {
  function recordAudit(
    ctx: AccessContext,
    resourceType: string,
    resourceId: string,
    action: AuditEvent['action'],
    changedFields: readonly string[],
  ): void {
    auditPort.record({
      id: runtime.nextId('audit'),
      tenantId: ctx.tenantId,
      resourceType,
      resourceId,
      action,
      actorId: ctx.actorId,
      occurredAt: runtime.now(),
      changedFields: [...changedFields].sort(),
    });
  }

  function emitEvent(
    ctx: AccessContext,
    type: string,
    aggregateId: string,
  ): void {
    eventPort.emit({
      id: runtime.nextId('event'),
      tenantId: ctx.tenantId,
      type,
      aggregateId,
      actorId: ctx.actorId,
      occurredAt: runtime.now(),
      schemaVersion: 1,
    });
  }

  return {
    /** Create a new draft midweek meeting. */
    createDraftMeeting(ctx: AccessContext, input: CreateMeetingInput): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const date = parseInstant(required(input.date, 'date'));
      const localTime = required(input.localTime, 'localTime');
      const timezone = required(input.timezone, 'timezone');
      const location = required(input.location, 'location');

      const now = runtime.now();
      const meeting: MidweekMeeting = {
        id: runtime.nextId('meeting'),
        tenantId: ctx.tenantId,
        date,
        localTime,
        timezone,
        location,
        status: 'draft',
        slots: [],
        createdAt: now,
        updatedAt: now,
      };

      meetingPort.save(meeting);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'create', [
        'date', 'localTime', 'location', 'status', 'timezone',
      ]);
      emitEvent(ctx, 'MidweekMeetingCreated', meeting.id);

      return freezeMeeting(meeting);
    },

    /** Add a slot to a draft meeting. */
    addSlot(ctx: AccessContext, meetingId: string, slot: AddSlotInput): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'add a slot to');

      const slotType = required(slot.slotType, 'slotType');
      if (slot.order < 0) throw new Error('Slot order must be non-negative');

      const newSlot: MeetingSlot = {
        id: runtime.nextId('slot'),
        meetingId: meeting.id,
        slotType,
        order: slot.order,
        required: slot.required,
        ...(slot.title ? { title: required(slot.title, 'title') } : {}),
      };

      const updated: MidweekMeeting = {
        ...meeting,
        slots: [...meeting.slots, newSlot],
        updatedAt: runtime.now(),
      };

      meetingPort.save(updated);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'update', ['slots']);

      return freezeMeeting(updated);
    },

    /** Remove a slot from a draft meeting. */
    removeSlot(ctx: AccessContext, meetingId: string, slotId: string): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'remove a slot from');

      const slotExists = meeting.slots.some(s => s.id === slotId);
      if (!slotExists) throw new Error('Slot not found');

      const updated: MidweekMeeting = {
        ...meeting,
        slots: meeting.slots.filter(s => s.id !== slotId),
        updatedAt: runtime.now(),
      };

      meetingPort.save(updated);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'update', ['slots']);

      return freezeMeeting(updated);
    },

    /** Assign a student (and optional assistant) to a slot. */
    assignStudent(
      ctx: AccessContext,
      meetingId: string,
      slotId: string,
      studentId: string,
      assistantId?: string,
    ): StudentAssignment {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'assign to');

      const slotExists = meeting.slots.some(s => s.id === slotId);
      if (!slotExists) throw new Error('Slot not found');

      const student = required(studentId, 'studentId');
      const assistant = assistantId ? required(assistantId, 'assistantId') : undefined;

      const assignment: StudentAssignment = {
        id: runtime.nextId('assignment'),
        meetingId,
        slotId,
        studentId: student,
        ...(assistant ? { assistantId: assistant } : {}),
        createdAt: runtime.now(),
      };

      assignmentPort.saveStudentAssignment(assignment);
      recordAudit(ctx, 'assignment', assignment.id, 'create', ['studentId', 'slotId', ...(assistant ? ['assistantId'] : [])]);

      return Object.freeze(assignment);
    },

    /** Assign a non-student (chairman, prayer, etc.) to a slot. */
    assignNonStudent(
      ctx: AccessContext,
      meetingId: string,
      slotId: string,
      personId: string,
      role: string,
    ): NonStudentAssignment {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'assign to');

      const slotExists = meeting.slots.some(s => s.id === slotId);
      if (!slotExists) throw new Error('Slot not found');

      const person = required(personId, 'personId');
      const normalizedRole = required(role, 'role');

      const assignment: NonStudentAssignment = {
        id: runtime.nextId('assignment'),
        meetingId,
        slotId,
        personId: person,
        role: normalizedRole,
        createdAt: runtime.now(),
      };

      assignmentPort.saveNonStudentAssignment(assignment);
      recordAudit(ctx, 'assignment', assignment.id, 'create', ['personId', 'role', 'slotId']);

      return Object.freeze(assignment);
    },

    /** Cancel an assignment. */
    cancelAssignment(ctx: AccessContext, assignmentId: string): void {
      assertCapability(ctx, 'schedule.write');

      if (!required(assignmentId, 'assignmentId')) throw new Error('assignmentId is required');

      // We need to find the assignment to record the meeting audit.
      // The assignment port doesn't have findById, so we record with the assignmentId.
      recordAudit(ctx, 'assignment', assignmentId, 'delete', []);
      assignmentPort.removeAssignment(assignmentId);
    },

    /** Publish a draft meeting (validates no empty required slots). */
    publishMeeting(ctx: AccessContext, meetingId: string): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'publish');

      // Validate required slots are filled
      const assignments = assignmentPort.findAssignmentsByMeeting(meetingId);
      const requiredSlotIds = new Set(
        meeting.slots.filter(s => s.required).map(s => s.id),
      );
      const assignedSlotIds = new Set(assignments.map(a => a.slotId));

      for (const slotId of requiredSlotIds) {
        if (!assignedSlotIds.has(slotId)) {
          const slot = meeting.slots.find(s => s.id === slotId);
          throw new Error(
            `Cannot publish: required slot '${slot?.title ?? slot?.slotType ?? slotId}' has no assignment`,
          );
        }
      }

      const published: MidweekMeeting = {
        ...meeting,
        status: 'published',
        updatedAt: runtime.now(),
      };

      meetingPort.save(published);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'update', ['status']);
      emitEvent(ctx, 'MidweekMeetingPublished', meeting.id);

      return freezeMeeting(published);
    },

    /** Archive a published meeting. */
    archiveMeeting(ctx: AccessContext, meetingId: string): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertPublished(meeting, 'archive');

      const archived: MidweekMeeting = {
        ...meeting,
        status: 'archived',
        updatedAt: runtime.now(),
      };

      meetingPort.save(archived);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'update', ['status']);
      emitEvent(ctx, 'MidweekMeetingArchived', meeting.id);

      return freezeMeeting(archived);
    },

    /** Update meeting date/time/timezone/location. */
    updateMeetingDetails(
      ctx: AccessContext,
      meetingId: string,
      changes: UpdateMeetingDetailsInput,
    ): MidweekMeeting {
      assertCapability(ctx, 'schedule.write');

      const meeting = meetingPort.findById(ctx.tenantId, meetingId);
      if (!meeting) throw new Error('Meeting not found');
      assertTenantMatch(ctx, meeting);
      assertDraft(meeting, 'update details of');

      const changedFields: string[] = [];
      let date = meeting.date;
      let localTime = meeting.localTime;
      let timezone = meeting.timezone;
      let location = meeting.location;

      if (changes.date !== undefined) {
        date = parseInstant(required(changes.date, 'date'));
        if (date !== meeting.date) changedFields.push('date');
      }

      if (changes.localTime !== undefined) {
        localTime = required(changes.localTime, 'localTime');
        if (localTime !== meeting.localTime) changedFields.push('localTime');
      }

      if (changes.timezone !== undefined) {
        timezone = required(changes.timezone, 'timezone');
        if (timezone !== meeting.timezone) changedFields.push('timezone');
      }

      if (changes.location !== undefined) {
        location = required(changes.location, 'location');
        if (location !== meeting.location) changedFields.push('location');
      }

      if (changedFields.length === 0) return meeting;

      const updated: MidweekMeeting = {
        ...meeting,
        date,
        localTime,
        timezone,
        location,
        updatedAt: runtime.now(),
      };

      meetingPort.save(updated);
      recordAudit(ctx, 'midweek-meeting', meeting.id, 'update', changedFields);

      return freezeMeeting(updated);
    },
  };
}

/** Type of the object returned by createMidweekSchedulingService. */
export type MidweekSchedulingService = ReturnType<typeof createMidweekSchedulingService>;
