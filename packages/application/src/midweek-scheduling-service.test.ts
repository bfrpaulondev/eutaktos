import { describe, expect, it, vi } from 'vitest';
import {
  createAccessContext,
  type AccessContext,
} from '@eutaktos/domain';
import {
  createMidweekSchedulingService,
  type MidweekMeeting,
  type MeetingSlot,
  type StudentAssignment,
  type NonStudentAssignment,
  type Assignment,
  type AuditEvent,
  type DomainEvent,
  type MidweekMeetingPort,
  type AssignmentPort,
  type AuditPort,
  type DomainEventPort,
  type SchedulingRuntime,
} from './midweek-scheduling-service';

// ─── Mocks & Fixtures ───

let idCounter = 0;
let nowValue = '2026-09-01T19:00:00.000Z';

function resetCounters(): void {
  idCounter = 0;
  nowValue = '2026-09-01T19:00:00.000Z';
}

function fakeRuntime(): SchedulingRuntime {
  return {
    now: () => nowValue,
    nextId: (scope) => `${scope}-${++idCounter}`,
  };
}

const auditLog: AuditEvent[] = [];
const domainEventLog: DomainEvent[] = [];
const meetingStore = new Map<string, MidweekMeeting>();
const assignmentStore: Assignment[] = [];

function fakeMeetingPort(): MidweekMeetingPort {
  return {
    findById: (tenantId, meetingId) => {
      const key = `${tenantId}:${meetingId}`;
      return meetingStore.get(key);
    },
    save: (meeting) => {
      const key = `${meeting.tenantId}:${meeting.id}`;
      meetingStore.set(key, meeting);
    },
    listByTenant: (tenantId) => {
      return [...meetingStore.values()].filter((m) => m.tenantId === tenantId);
    },
  };
}

function fakeAssignmentPort(): AssignmentPort {
  return {
    saveStudentAssignment: (a) => assignmentStore.push(a),
    saveNonStudentAssignment: (a) => assignmentStore.push(a),
    findAssignmentsByMeeting: (meetingId) =>
      assignmentStore.filter((a) => a.meetingId === meetingId),
    removeAssignment: (assignmentId) => {
      const idx = assignmentStore.findIndex((a) => a.id === assignmentId);
      if (idx >= 0) assignmentStore.splice(idx, 1);
    },
  };
}

function fakeAuditPort(): AuditPort {
  return {
    record: (event) => auditLog.push(event),
  };
}

function fakeEventPort(): DomainEventPort {
  return {
    emit: (event) => domainEventLog.push(event),
  };
}

function writeCtx(overrides: Partial<AccessContext> = {}): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    capabilities: ['schedule.write', 'schedule.read'],
    ...overrides,
  });
}

function readCtx(overrides: Partial<AccessContext> = {}): Readonly<AccessContext> {
  return createAccessContext({
    tenantId: 'tenant-1',
    actorId: 'actor-1',
    capabilities: ['schedule.read'],
    ...overrides,
  });
}

const defaultInput = {
  date: '2026-09-10',
  localTime: '19:00',
  timezone: 'Europe/Lisbon',
  location: 'Kingdom Hall',
};

function createService() {
  resetCounters();
  auditLog.length = 0;
  domainEventLog.length = 0;
  meetingStore.clear();
  assignmentStore.length = 0;

  const ports = {
    meetingPort: fakeMeetingPort(),
    assignmentPort: fakeAssignmentPort(),
    auditPort: fakeAuditPort(),
    eventPort: fakeEventPort(),
    runtime: fakeRuntime(),
  };

  const service = createMidweekSchedulingService(
    ports.meetingPort,
    ports.assignmentPort,
    ports.auditPort,
    ports.eventPort,
    ports.runtime,
  );

  return { service, ...ports };
}

/** Helper to create a draft meeting with one required non-student slot filled. */
function createPublishedMeeting(service: ReturnType<typeof createMidweekSchedulingService>) {
  const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
  const withSlot = service.addSlot(writeCtx(), meeting.id, {
    slotType: 'non-student',
    order: 0,
    required: true,
    title: 'Chairman',
  });
  const slotId = withSlot.slots[0]!.id;
  service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'chairman');
  service.publishMeeting(writeCtx(), meeting.id);
  return { meetingId: meeting.id, slotId };
}

// ─── Tests ───

describe('MidweekSchedulingService', () => {
  // ── createDraftMeeting ──
  describe('createDraftMeeting', () => {
    it('creates a draft meeting with correct defaults', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);

      expect(meeting.id).toBe('meeting-1');
      expect(meeting.tenantId).toBe('tenant-1');
      expect(meeting.date).toBe('2026-09-10');
      expect(meeting.localTime).toBe('19:00');
      expect(meeting.timezone).toBe('Europe/Lisbon');
      expect(meeting.location).toBe('Kingdom Hall');
      expect(meeting.status).toBe('draft');
      expect(meeting.slots).toEqual([]);
    });

    it('persists the meeting via the port', () => {
      const { service, meetingPort } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);

      const found = meetingPort.findById('tenant-1', meeting.id);
      expect(found).toEqual(meeting);
    });

    it('records an audit event for the creation', () => {
      const { service } = createService();
      service.createDraftMeeting(writeCtx(), defaultInput);

      expect(auditLog).toHaveLength(1);
      expect(auditLog[0]).toMatchObject({
        tenantId: 'tenant-1',
        actorId: 'actor-1',
        resourceType: 'midweek-meeting',
        action: 'create',
        changedFields: expect.arrayContaining(['date', 'localTime', 'location', 'status', 'timezone']),
      });
    });

    it('emits a MidweekMeetingCreated domain event', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);

      expect(domainEventLog).toHaveLength(1);
      expect(domainEventLog[0]).toMatchObject({
        type: 'MidweekMeetingCreated',
        aggregateId: meeting.id,
        tenantId: 'tenant-1',
        schemaVersion: 1,
      });
    });

    it('requires schedule.write capability', () => {
      const { service } = createService();
      expect(() => service.createDraftMeeting(readCtx(), defaultInput)).toThrow(
        'Access denied: missing capability schedule.write',
      );
    });

    it('rejects empty date', () => {
      const { service } = createService();
      expect(() =>
        service.createDraftMeeting(writeCtx(), { ...defaultInput, date: '  ' }),
      ).toThrow('date is required');
    });

    it('rejects empty localTime', () => {
      const { service } = createService();
      expect(() =>
        service.createDraftMeeting(writeCtx(), { ...defaultInput, localTime: '' }),
      ).toThrow('localTime is required');
    });

    it('rejects empty timezone', () => {
      const { service } = createService();
      expect(() =>
        service.createDraftMeeting(writeCtx(), { ...defaultInput, timezone: ' ' }),
      ).toThrow('timezone is required');
    });

    it('rejects empty location', () => {
      const { service } = createService();
      expect(() =>
        service.createDraftMeeting(writeCtx(), { ...defaultInput, location: '' }),
      ).toThrow('location is required');
    });

    it('uses tenantId from ctx, never from input', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(meeting.tenantId).toBe('tenant-1');
    });

    it('returns an immutable slots array', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(Object.isFrozen(meeting.slots)).toBe(true);
    });
  });

  // ── addSlot ──
  describe('addSlot', () => {
    it('adds a slot to a draft meeting', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const updated = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'bible-reading',
        order: 1,
        required: true,
        title: 'Bible Reading',
      });

      expect(updated.slots).toHaveLength(1);
      expect(updated.slots[0]).toMatchObject({
        slotType: 'bible-reading',
        order: 1,
        required: true,
        title: 'Bible Reading',
        meetingId: meeting.id,
      });
    });

    it('records an audit event for slot addition', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      service.addSlot(writeCtx(), meeting.id, {
        slotType: 'talk',
        order: 0,
        required: true,
      });

      // First audit: createDraftMeeting, second: addSlot
      expect(auditLog).toHaveLength(2);
      expect(auditLog[1]).toMatchObject({
        resourceType: 'midweek-meeting',
        action: 'update',
        changedFields: ['slots'],
      });
    });

    it('rejects adding slot to non-existent meeting', () => {
      const { service } = createService();
      expect(() =>
        service.addSlot(writeCtx(), 'no-such-meeting', {
          slotType: 'talk',
          order: 0,
          required: true,
        }),
      ).toThrow('Meeting not found');
    });

    it('rejects adding slot to a published meeting', () => {
      const { service } = createService();
      const { meetingId } = createPublishedMeeting(service);

      expect(() =>
        service.addSlot(writeCtx(), meetingId, {
          slotType: 'talk',
          order: 1,
          required: false,
        }),
      ).toThrow("Cannot add a slot to a meeting in 'published' status");
    });

    it('rejects negative slot order', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.addSlot(writeCtx(), meeting.id, {
          slotType: 'talk',
          order: -1,
          required: true,
        }),
      ).toThrow('Slot order must be non-negative');
    });

    it('rejects empty slotType', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.addSlot(writeCtx(), meeting.id, {
          slotType: '  ',
          order: 0,
          required: true,
        }),
      ).toThrow('slotType is required');
    });

    it('requires schedule.write capability', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.addSlot(readCtx(), meeting.id, {
          slotType: 'talk',
          order: 0,
          required: true,
        }),
      ).toThrow('Access denied: missing capability schedule.write');
    });
  });

  // ── removeSlot ──
  describe('removeSlot', () => {
    it('removes a slot from a draft meeting', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'talk',
        order: 0,
        required: false,
      });
      const slotId = withSlot.slots[0]!.id;

      const updated = service.removeSlot(writeCtx(), meeting.id, slotId);
      expect(updated.slots).toHaveLength(0);
    });

    it('records an audit event for slot removal', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'talk',
        order: 0,
        required: false,
      });
      const slotId = withSlot.slots[0]!.id;

      service.removeSlot(writeCtx(), meeting.id, slotId);

      expect(auditLog).toHaveLength(3);
      expect(auditLog[2]).toMatchObject({
        resourceType: 'midweek-meeting',
        action: 'update',
        changedFields: ['slots'],
      });
    });

    it('rejects removing non-existent slot', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.removeSlot(writeCtx(), meeting.id, 'no-such-slot'),
      ).toThrow('Slot not found');
    });

    it('requires schedule.write capability', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.removeSlot(readCtx(), meeting.id, 'slot-1'),
      ).toThrow('Access denied: missing capability schedule.write');
    });
  });

  // ── assignStudent ──
  describe('assignStudent', () => {
    function setup(): { service: ReturnType<typeof createMidweekSchedulingService>; meeting: MidweekMeeting; slotId: string } {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'bible-reading',
        order: 1,
        required: true,
        title: 'Bible Reading',
      });
      return { service, meeting, slotId: withSlot.slots[0]!.id };
    }

    it('assigns a student to a slot', () => {
      const { service, meeting, slotId } = setup();
      const assignment = service.assignStudent(writeCtx(), meeting.id, slotId, 'student-1');

      expect(assignment.studentId).toBe('student-1');
      expect(assignment.slotId).toBe(slotId);
      expect(assignment.assistantId).toBeUndefined();
    });

    it('assigns a student with an assistant', () => {
      const { service, meeting, slotId } = setup();
      const assignment = service.assignStudent(writeCtx(), meeting.id, slotId, 'student-1', 'assistant-1');

      expect(assignment.assistantId).toBe('assistant-1');
    });

    it('persists the assignment via the port', () => {
      const { service, meeting, slotId } = setup();
      service.assignStudent(writeCtx(), meeting.id, slotId, 'student-1');
      expect(assignmentStore).toHaveLength(1);
      expect((assignmentStore[0] as StudentAssignment).studentId).toBe('student-1');
    });

    it('records an audit event', () => {
      const { service, meeting, slotId } = setup();
      service.assignStudent(writeCtx(), meeting.id, slotId, 'student-1');

      const assignmentAudit = auditLog.find(
        (a) => a.resourceType === 'assignment' && a.action === 'create',
      );
      expect(assignmentAudit).toBeDefined();
      expect(assignmentAudit!.changedFields).toContain('studentId');
    });

    it('rejects non-existent meeting', () => {
      const { service } = createService();
      expect(() =>
        service.assignStudent(writeCtx(), 'no-such-meeting', 'slot-1', 'student-1'),
      ).toThrow('Meeting not found');
    });

    it('rejects non-existent slot', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.assignStudent(writeCtx(), meeting.id, 'no-such-slot', 'student-1'),
      ).toThrow('Slot not found');
    });

    it('rejects empty studentId', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignStudent(writeCtx(), meeting.id, slotId, '  '),
      ).toThrow('studentId is required');
    });

    it('rejects empty assistantId when provided', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignStudent(writeCtx(), meeting.id, slotId, 'student-1', '  '),
      ).toThrow('assistantId is required');
    });

    it('requires schedule.write capability', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignStudent(readCtx(), meeting.id, slotId, 'student-1'),
      ).toThrow('Access denied: missing capability schedule.write');
    });
  });

  // ── assignNonStudent ──
  describe('assignNonStudent', () => {
    function setup() {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: true,
        title: 'Chairman',
      });
      return { service, meeting, slotId: withSlot.slots[0]!.id };
    }

    it('assigns a non-student to a slot', () => {
      const { service, meeting, slotId } = setup();
      const assignment = service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'chairman');

      expect(assignment.personId).toBe('person-1');
      expect(assignment.role).toBe('chairman');
    });

    it('records an audit event', () => {
      const { service, meeting, slotId } = setup();
      service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'chairman');

      const assignmentAudit = auditLog.find(
        (a) => a.resourceType === 'assignment' && a.action === 'create',
      );
      expect(assignmentAudit).toBeDefined();
      expect(assignmentAudit!.changedFields).toContain('personId');
      expect(assignmentAudit!.changedFields).toContain('role');
    });

    it('persists via the assignment port', () => {
      const { service, meeting, slotId } = setup();
      service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'chairman');
      expect(assignmentStore).toHaveLength(1);
      expect((assignmentStore[0] as NonStudentAssignment).role).toBe('chairman');
    });

    it('rejects empty role', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', '  '),
      ).toThrow('role is required');
    });

    it('rejects empty personId', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignNonStudent(writeCtx(), meeting.id, slotId, '', 'chairman'),
      ).toThrow('personId is required');
    });

    it('requires schedule.write capability', () => {
      const { service, meeting, slotId } = setup();
      expect(() =>
        service.assignNonStudent(readCtx(), meeting.id, slotId, 'person-1', 'chairman'),
      ).toThrow('Access denied: missing capability schedule.write');
    });
  });

  // ── cancelAssignment ──
  describe('cancelAssignment', () => {
    it('removes an assignment from the port', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: false,
        title: 'Prayer',
      });
      const slotId = withSlot.slots[0]!.id;
      const assignment = service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'prayer');

      service.cancelAssignment(writeCtx(), assignment.id);
      expect(assignmentStore).toHaveLength(0);
    });

    it('records a delete audit event', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: false,
        title: 'Prayer',
      });
      const slotId = withSlot.slots[0]!.id;
      const assignment = service.assignNonStudent(writeCtx(), meeting.id, slotId, 'person-1', 'prayer');

      service.cancelAssignment(writeCtx(), assignment.id);
      const deleteAudit = auditLog.find(
        (a) => a.resourceId === assignment.id && a.action === 'delete',
      );
      expect(deleteAudit).toBeDefined();
    });

    it('rejects empty assignmentId', () => {
      const { service } = createService();
      expect(() => service.cancelAssignment(writeCtx(), '  ')).toThrow('assignmentId is required');
    });

    it('requires schedule.write capability', () => {
      const { service } = createService();
      expect(() => service.cancelAssignment(readCtx(), 'assignment-1')).toThrow(
        'Access denied: missing capability schedule.write',
      );
    });
  });

  // ── publishMeeting ──
  describe('publishMeeting', () => {
    function setupWithAllSlotsFilled() {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);

      // Add a required non-student slot (chairman)
      const withChairman = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: true,
        title: 'Chairman',
      });
      service.assignNonStudent(writeCtx(), meeting.id, withChairman.slots[0]!.id, 'person-1', 'chairman');

      // Add a required student slot
      const withStudent = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'bible-reading',
        order: 1,
        required: true,
        title: 'Bible Reading',
      });
      service.assignStudent(writeCtx(), meeting.id, withStudent.slots[1]!.id, 'student-1');

      // Add an optional slot (no assignment needed)
      service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 2,
        required: false,
        title: 'Optional Prayer',
      });

      return { service, meetingId: meeting.id };
    }

    it('publishes a meeting when all required slots are filled', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      const published = service.publishMeeting(writeCtx(), meetingId);

      expect(published.status).toBe('published');
    });

    it('emits a MidweekMeetingPublished domain event', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      service.publishMeeting(writeCtx(), meetingId);

      const publishEvent = domainEventLog.find((e) => e.type === 'MidweekMeetingPublished');
      expect(publishEvent).toBeDefined();
      expect(publishEvent!.aggregateId).toBe(meetingId);
    });

    it('records an audit event for status change', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      service.publishMeeting(writeCtx(), meetingId);

      const statusAudit = auditLog.find(
        (a) => a.resourceType === 'midweek-meeting' && a.changedFields.includes('status') && a.action === 'update',
      );
      expect(statusAudit).toBeDefined();
    });

    it('rejects publishing when a required slot is empty', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: true,
        title: 'Chairman',
      });
      // No assignment for the chairman

      expect(() => service.publishMeeting(writeCtx(), meeting.id)).toThrow(
        "Cannot publish: required slot 'Chairman' has no assignment",
      );
    });

    it('allows optional slots to be empty on publish', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      // Only optional slot, no assignments needed
      service.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: false,
        title: 'Optional Prayer',
      });

      const published = service.publishMeeting(writeCtx(), meeting.id);
      expect(published.status).toBe('published');
    });

    it('rejects publishing a non-existent meeting', () => {
      const { service } = createService();
      expect(() => service.publishMeeting(writeCtx(), 'no-such-meeting')).toThrow(
        'Meeting not found',
      );
    });

    it('rejects publishing an already published meeting', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      service.publishMeeting(writeCtx(), meetingId);
      expect(() => service.publishMeeting(writeCtx(), meetingId)).toThrow(
        "Cannot publish a meeting in 'published' status",
      );
    });

    it('rejects publishing an archived meeting', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      service.publishMeeting(writeCtx(), meetingId);
      service.archiveMeeting(writeCtx(), meetingId);
      expect(() => service.publishMeeting(writeCtx(), meetingId)).toThrow(
        "Cannot publish a meeting in 'archived' status",
      );
    });

    it('requires schedule.write capability', () => {
      const { service, meetingId } = setupWithAllSlotsFilled();
      expect(() => service.publishMeeting(readCtx(), meetingId)).toThrow(
        'Access denied: missing capability schedule.write',
      );
    });
  });

  // ── archiveMeeting ──
  describe('archiveMeeting', () => {
    function setupPublished() {
      const { service } = createService();
      const { meetingId } = createPublishedMeeting(service);
      return { service, meetingId };
    }

    it('archives a published meeting', () => {
      const { service, meetingId } = setupPublished();
      const archived = service.archiveMeeting(writeCtx(), meetingId);
      expect(archived.status).toBe('archived');
    });

    it('emits a MidweekMeetingArchived domain event', () => {
      const { service, meetingId } = setupPublished();
      service.archiveMeeting(writeCtx(), meetingId);

      const archiveEvent = domainEventLog.find((e) => e.type === 'MidweekMeetingArchived');
      expect(archiveEvent).toBeDefined();
      expect(archiveEvent!.aggregateId).toBe(meetingId);
    });

    it('records an audit event for status change', () => {
      const { service, meetingId } = setupPublished();
      service.archiveMeeting(writeCtx(), meetingId);

      const statusAudits = auditLog.filter(
        (a) =>
          a.resourceType === 'midweek-meeting' &&
          a.changedFields.includes('status') &&
          a.action === 'update',
      );
      // Two status updates: publish + archive
      expect(statusAudits).toHaveLength(2);
    });

    it('rejects archiving a draft meeting', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() => service.archiveMeeting(writeCtx(), meeting.id)).toThrow(
        "Cannot archive a meeting in 'draft' status",
      );
    });

    it('rejects archiving an already archived meeting', () => {
      const { service, meetingId } = setupPublished();
      service.archiveMeeting(writeCtx(), meetingId);
      expect(() => service.archiveMeeting(writeCtx(), meetingId)).toThrow(
        "Cannot archive a meeting in 'archived' status",
      );
    });

    it('rejects archiving a non-existent meeting', () => {
      const { service } = createService();
      expect(() => service.archiveMeeting(writeCtx(), 'no-such-meeting')).toThrow(
        'Meeting not found',
      );
    });

    it('requires schedule.write capability', () => {
      const { service, meetingId } = setupPublished();
      expect(() => service.archiveMeeting(readCtx(), meetingId)).toThrow(
        'Access denied: missing capability schedule.write',
      );
    });
  });

  // ── updateMeetingDetails ──
  describe('updateMeetingDetails', () => {
    it('updates meeting date', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const updated = service.updateMeetingDetails(writeCtx(), meeting.id, {
        date: '2026-09-17',
      });
      expect(updated.date).toBe('2026-09-17');
    });

    it('updates multiple fields at once', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const updated = service.updateMeetingDetails(writeCtx(), meeting.id, {
        date: '2026-09-17',
        localTime: '18:30',
        timezone: 'America/New_York',
        location: 'Community Center',
      });
      expect(updated.date).toBe('2026-09-17');
      expect(updated.localTime).toBe('18:30');
      expect(updated.timezone).toBe('America/New_York');
      expect(updated.location).toBe('Community Center');
    });

    it('records audit with changed fields only', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      service.updateMeetingDetails(writeCtx(), meeting.id, { date: '2026-09-17' });

      const detailAudit = auditLog.find(
        (a) =>
          a.resourceType === 'midweek-meeting' &&
          a.action === 'update' &&
          a.changedFields.length === 1 &&
          a.changedFields.includes('date'),
      );
      expect(detailAudit).toBeDefined();
    });

    it('returns equivalent meeting on no-op update', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const result = service.updateMeetingDetails(writeCtx(), meeting.id, {
        date: '2026-09-10',
      });
      expect(result).toStrictEqual(meeting);
    });

    it('rejects updating a published meeting', () => {
      const { service } = createService();
      const { meetingId } = createPublishedMeeting(service);

      expect(() =>
        service.updateMeetingDetails(writeCtx(), meetingId, { date: '2026-09-17' }),
      ).toThrow("Cannot update details of a meeting in 'published' status");
    });

    it('rejects empty field values', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.updateMeetingDetails(writeCtx(), meeting.id, { location: '' }),
      ).toThrow('location is required');
    });

    it('rejects non-existent meeting', () => {
      const { service } = createService();
      expect(() =>
        service.updateMeetingDetails(writeCtx(), 'no-such-meeting', { date: '2026-09-17' }),
      ).toThrow('Meeting not found');
    });

    it('requires schedule.write capability', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(() =>
        service.updateMeetingDetails(readCtx(), meeting.id, { date: '2026-09-17' }),
      ).toThrow('Access denied: missing capability schedule.write');
    });
  });

  // ── Tenant isolation ──
  describe('tenant isolation', () => {
    it('rejects access when meeting belongs to a different tenant', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);

      // Directly put a cross-tenant meeting into the store to test the guard
      const otherTenantMeeting: MidweekMeeting = {
        ...meeting,
        tenantId: 'tenant-2',
      };
      meetingStore.set(`tenant-2:${meeting.id}`, otherTenantMeeting);
      meetingStore.delete(`tenant-1:${meeting.id}`);

      const otherTenantCtx = writeCtx({ tenantId: 'tenant-1' });
      // The service looks up by ctx.tenantId first, which is tenant-1, so meeting won't be found
      // Let's test with the other tenant's ctx trying to access
      const ctxTenant2 = writeCtx({ tenantId: 'tenant-2' });
      // This should find the meeting but fail tenant check... except we use ctx.tenantId for lookup
      // so let's test the tenant isolation by putting a meeting under tenant-1's key but with tenant-2 id
      meetingStore.set(`tenant-1:${meeting.id}`, otherTenantMeeting);

      expect(() =>
        service.addSlot(otherTenantCtx, meeting.id, {
          slotType: 'talk',
          order: 0,
          required: true,
        }),
      ).toThrow('Cross-tenant access denied');
    });

    it('does not leak meetings across tenants via port', () => {
      const { service, meetingPort } = createService();
      const ctxA = writeCtx({ tenantId: 'tenant-a' });
      const ctxB = writeCtx({ tenantId: 'tenant-b' });

      service.createDraftMeeting(ctxA, defaultInput);
      service.createDraftMeeting(ctxB, defaultInput);

      const tenantAMeetings = meetingPort.listByTenant('tenant-a');
      const tenantBMeetings = meetingPort.listByTenant('tenant-b');

      expect(tenantAMeetings).toHaveLength(1);
      expect(tenantBMeetings).toHaveLength(1);
      expect(tenantAMeetings[0]!.tenantId).toBe('tenant-a');
      expect(tenantBMeetings[0]!.tenantId).toBe('tenant-b');
    });
  });

  // ── Immutability ──
  describe('immutability', () => {
    it('returned meeting objects should be frozen', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      expect(Object.isFrozen(meeting)).toBe(true);
    });

    it('returned assignment objects should be frozen', () => {
      const { service } = createService();
      const meeting = service.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = service.addSlot(writeCtx(), meeting.id, {
        slotType: 'bible-reading',
        order: 0,
        required: true,
      });
      const assignment = service.assignStudent(writeCtx(), meeting.id, withSlot.slots[0]!.id, 'student-1');
      expect(Object.isFrozen(assignment)).toBe(true);
    });
  });

  // ── Port contract verification ──
  describe('port contract', () => {
    it('meetingPort.save is called on createDraftMeeting', () => {
      const saveSpy = vi.fn();
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const spiedPort: MidweekMeetingPort = {
        ...fakeMeetingPort(),
        save: saveSpy,
      };

      const svc = createMidweekSchedulingService(
        spiedPort,
        fakeAssignmentPort(),
        fakeAuditPort(),
        fakeEventPort(),
        fakeRuntime(),
      );

      svc.createDraftMeeting(writeCtx(), defaultInput);
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });

    it('assignmentPort.saveStudentAssignment is called on assignStudent', () => {
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const studentSpy = vi.fn();
      const spiedAssignPort: AssignmentPort = {
        ...fakeAssignmentPort(),
        saveStudentAssignment: studentSpy,
      };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        spiedAssignPort,
        fakeAuditPort(),
        fakeEventPort(),
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = svc.addSlot(writeCtx(), meeting.id, {
        slotType: 'bible-reading',
        order: 0,
        required: true,
      });

      svc.assignStudent(writeCtx(), meeting.id, withSlot.slots[0]!.id, 'student-1');
      expect(studentSpy).toHaveBeenCalledTimes(1);
    });

    it('assignmentPort.saveNonStudentAssignment is called on assignNonStudent', () => {
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const nonStudentSpy = vi.fn();
      const spiedAssignPort: AssignmentPort = {
        ...fakeAssignmentPort(),
        saveNonStudentAssignment: nonStudentSpy,
      };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        spiedAssignPort,
        fakeAuditPort(),
        fakeEventPort(),
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = svc.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: true,
      });

      svc.assignNonStudent(writeCtx(), meeting.id, withSlot.slots[0]!.id, 'person-1', 'chairman');
      expect(nonStudentSpy).toHaveBeenCalledTimes(1);
    });

    it('auditPort.record is called for every mutation', () => {
      const recordSpy = vi.fn();
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const spiedAuditPort: AuditPort = { record: recordSpy };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        fakeAssignmentPort(),
        spiedAuditPort,
        fakeEventPort(),
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      expect(recordSpy).toHaveBeenCalledTimes(1);

      const withSlot = svc.addSlot(writeCtx(), meeting.id, { slotType: 'talk', order: 0, required: true });
      expect(recordSpy).toHaveBeenCalledTimes(2);

      const slotId = withSlot.slots[0]!.id;
      svc.removeSlot(writeCtx(), meeting.id, slotId);
      expect(recordSpy).toHaveBeenCalledTimes(3);
    });

    it('eventPort.emit is called for key transitions', () => {
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const emitSpy = vi.fn();
      const spiedEventPort: DomainEventPort = { emit: emitSpy };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        fakeAssignmentPort(),
        fakeAuditPort(),
        spiedEventPort,
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect((emitSpy.mock.calls[0] as [DomainEvent])[0].type).toBe('MidweekMeetingCreated');

      // Add required slot + assign + publish
      const withSlot = svc.addSlot(writeCtx(), meeting.id, { slotType: 'non-student', order: 0, required: true, title: 'Chairman' });
      svc.assignNonStudent(writeCtx(), meeting.id, withSlot.slots[0]!.id, 'person-1', 'chairman');
      svc.publishMeeting(writeCtx(), meeting.id);

      expect(emitSpy).toHaveBeenCalledTimes(2);
      expect((emitSpy.mock.calls[1] as [DomainEvent])[0].type).toBe('MidweekMeetingPublished');

      svc.archiveMeeting(writeCtx(), meeting.id);
      expect(emitSpy).toHaveBeenCalledTimes(3);
      expect((emitSpy.mock.calls[2] as [DomainEvent])[0].type).toBe('MidweekMeetingArchived');
    });

    it('assignmentPort.removeAssignment is called on cancelAssignment', () => {
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const removeSpy = vi.fn();
      const spiedAssignPort: AssignmentPort = {
        ...fakeAssignmentPort(),
        removeAssignment: removeSpy,
      };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        spiedAssignPort,
        fakeAuditPort(),
        fakeEventPort(),
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      const withSlot = svc.addSlot(writeCtx(), meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: false,
      });
      const assignment = svc.assignNonStudent(writeCtx(), meeting.id, withSlot.slots[0]!.id, 'person-1', 'prayer');

      svc.cancelAssignment(writeCtx(), assignment.id);
      expect(removeSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledWith(assignment.id);
    });

    it('assignmentPort.findAssignmentsByMeeting is called on publishMeeting', () => {
      resetCounters();
      auditLog.length = 0;
      domainEventLog.length = 0;
      meetingStore.clear();
      assignmentStore.length = 0;

      const findSpy = vi.fn().mockReturnValue([]);
      const spiedAssignPort: AssignmentPort = {
        ...fakeAssignmentPort(),
        findAssignmentsByMeeting: findSpy,
      };

      const svc = createMidweekSchedulingService(
        fakeMeetingPort(),
        spiedAssignPort,
        fakeAuditPort(),
        fakeEventPort(),
        fakeRuntime(),
      );

      const meeting = svc.createDraftMeeting(writeCtx(), defaultInput);
      svc.publishMeeting(writeCtx(), meeting.id);
      expect(findSpy).toHaveBeenCalledWith(meeting.id);
    });
  });

  // ── Lifecycle ──
  describe('full lifecycle', () => {
    it('draft → add slots → assign → publish → archive', () => {
      const { service, meetingPort, assignmentPort } = createService();
      const ctx = writeCtx();

      // Create draft
      const meeting = service.createDraftMeeting(ctx, defaultInput);
      expect(meeting.status).toBe('draft');

      // Add slots
      const withSlots = service.addSlot(ctx, meeting.id, {
        slotType: 'non-student',
        order: 0,
        required: true,
        title: 'Chairman',
      });
      const finalSlots = service.addSlot(ctx, meeting.id, {
        slotType: 'student-talk',
        order: 1,
        required: true,
        title: 'Student Talk',
      });
      expect(finalSlots.slots).toHaveLength(2);

      // Assign
      service.assignNonStudent(ctx, meeting.id, withSlots.slots[0]!.id, 'person-1', 'chairman');
      service.assignStudent(ctx, meeting.id, finalSlots.slots[1]!.id, 'student-1', 'assistant-1');
      expect(assignmentPort.findAssignmentsByMeeting(meeting.id)).toHaveLength(2);

      // Publish
      const published = service.publishMeeting(ctx, meeting.id);
      expect(published.status).toBe('published');

      // Verify persisted
      const fromStore = meetingPort.findById('tenant-1', meeting.id);
      expect(fromStore?.status).toBe('published');

      // Archive
      const archived = service.archiveMeeting(ctx, meeting.id);
      expect(archived.status).toBe('archived');

      // Domain events: created + published + archived
      const eventTypes = domainEventLog.map((e) => e.type);
      expect(eventTypes).toEqual([
        'MidweekMeetingCreated',
        'MidweekMeetingPublished',
        'MidweekMeetingArchived',
      ]);
    });
  });
});
