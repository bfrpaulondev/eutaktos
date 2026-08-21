import { describe, expect, it } from 'vitest';
import { createAccessContext } from '@eutaktos/domain';
import { InMemoryMidweekUnitOfWork } from './midweek-memory';
import type {
  MidweekMeeting,
  StudentAssignment,
  NonStudentAssignment,
  AuditEvent,
  DomainEvent,
} from './midweek-memory';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const ACTOR = 'actor-1';

function ctx(
  tenantId = TENANT_A,
  capabilities: readonly string[] = ['schedule.read', 'schedule.write'],
) {
  return createAccessContext({ tenantId, actorId: ACTOR, capabilities: capabilities as any });
}

function makeMeeting(
  id = 'm-1',
  tenantId = TENANT_A,
  date = '2025-06-11',
  overrides: Partial<MidweekMeeting> = {},
): MidweekMeeting {
  return {
    id,
    tenantId,
    date,
    isCancelled: false,
    ...overrides,
  };
}

function makeStudentAssignment(
  id = 'sa-1',
  tenantId = TENANT_A,
  meetingId = 'm-1',
  personId = 'p-1',
  overrides: Partial<StudentAssignment> = {},
): StudentAssignment {
  return { id, tenantId, meetingId, personId, assignmentType: 'Bible Highlights', ...overrides };
}

function makeNonStudentAssignment(
  id = 'nsa-1',
  tenantId = TENANT_A,
  meetingId = 'm-1',
  personId = 'p-1',
  overrides: Partial<NonStudentAssignment> = {},
): NonStudentAssignment {
  return { id, tenantId, meetingId, personId, assignmentType: 'Chairman', ...overrides };
}

function makeAuditEvent(
  id = 'audit-1',
  tenantId = TENANT_A,
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id,
    tenantId,
    resourceType: 'midweek-meeting',
    resourceId: 'm-1',
    action: 'create',
    actorId: ACTOR,
    occurredAt: '2025-06-11T00:00:00Z',
    changedFields: ['date'],
    ...overrides,
  };
}

function makeDomainEvent(
  id = 'event-1',
  tenantId = TENANT_A,
  overrides: Partial<DomainEvent> = {},
): DomainEvent {
  return {
    id,
    tenantId,
    type: 'MeetingScheduled',
    aggregateId: 'm-1',
    actorId: ACTOR,
    occurredAt: '2025-06-11T00:00:00Z',
    schemaVersion: 1,
    ...overrides,
  };
}

// ---- Tests ----

describe('InMemoryMidweekUnitOfWork', () => {
  // ====== Constructor / Seed ======

  describe('constructor', () => {
    it('accepts empty seed', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listMeetings(ctx())).toEqual([]);
    });

    it('seeds meetings', () => {
      const m1 = makeMeeting('m-1');
      const m2 = makeMeeting('m-2', TENANT_A, '2025-06-18');
      const uow = new InMemoryMidweekUnitOfWork([m1, m2]);
      expect(uow.listMeetings(ctx())).toHaveLength(2);
    });

    it('rejects duplicate tenant+id in seed', () => {
      const m = makeMeeting('m-1');
      expect(() => new InMemoryMidweekUnitOfWork([m, m])).toThrow('Duplicate tenant meeting id');
    });

    it('isolates seed data from caller', () => {
      const original = makeMeeting();
      const uow = new InMemoryMidweekUnitOfWork([original]);
      (original as any).date = '2099-12-31';
      const found = uow.findMeetingById(ctx(), 'm-1');
      expect(found!.date).toBe('2025-06-11');
    });
  });

  // ====== saveMeeting ======

  describe('saveMeeting', () => {
    it('stores a new meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      const m = makeMeeting('m-1');
      uow.saveMeeting(ctx(), m);
      expect(uow.findMeetingById(ctx(), 'm-1')).toBeDefined();
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.saveMeeting(ctx(TENANT_A, ['schedule.read']), makeMeeting()),
      ).toThrow('missing capability schedule.write');
    });

    it('rejects cross-tenant meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      const m = makeMeeting('m-1', TENANT_B);
      expect(() => uow.saveMeeting(ctx(TENANT_A), m)).toThrow('Cross-tenant access denied');
    });

    it('allows same meeting id in different tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveMeeting(ctx(TENANT_A), makeMeeting('m-1', TENANT_A));
      uow.saveMeeting(ctx(TENANT_B), makeMeeting('m-1', TENANT_B));
      expect(uow.listMeetings(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listMeetings(ctx(TENANT_B))).toHaveLength(1);
    });

    it('overwrites existing meeting on save (upsert semantics)', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveMeeting(ctx(), makeMeeting('m-1'));
      uow.saveMeeting(ctx(), makeMeeting('m-1', TENANT_A, '2025-06-18', { isCancelled: true }));
      const found = uow.findMeetingById(ctx(), 'm-1');
      expect(found!.date).toBe('2025-06-18');
      expect(found!.isCancelled).toBe(true);
    });
  });

  // ====== findMeetingById ======

  describe('findMeetingById', () => {
    it('finds a meeting by id within the tenant', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      const found = uow.findMeetingById(ctx(TENANT_A), 'm-1');
      expect(found).toBeDefined();
      expect(found!.id).toBe('m-1');
      expect(found!.date).toBe('2025-06-11');
    });

    it('returns undefined for non-existent id', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findMeetingById(ctx(), 'nonexistent')).toBeUndefined();
    });

    it('returns undefined for id that belongs to another tenant', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1', TENANT_B)]);
      expect(uow.findMeetingById(ctx(TENANT_A), 'm-1')).toBeUndefined();
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.findMeetingById(ctx(TENANT_A, ['schedule.write']), 'm-1'),
      ).toThrow('missing capability schedule.read');
    });

    it('returns a defensive clone', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting()]);
      const found = uow.findMeetingById(ctx(), 'm-1')!;
      expect(found).not.toBe(uow.findMeetingById(ctx(), 'm-1'));
      (found as any).date = '2099-12-31';
      expect(uow.findMeetingById(ctx(), 'm-1')!.date).toBe('2025-06-11');
    });
  });

  // ====== listMeetings ======

  describe('listMeetings', () => {
    it('returns only tenant-scoped meetings', () => {
      const uow = new InMemoryMidweekUnitOfWork([
        makeMeeting('m-a', TENANT_A),
        makeMeeting('m-b', TENANT_B),
      ]);
      expect(uow.listMeetings(ctx(TENANT_A))).toEqual([expect.objectContaining({ id: 'm-a' })]);
      expect(uow.listMeetings(ctx(TENANT_B))).toEqual([expect.objectContaining({ id: 'm-b' })]);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() => uow.listMeetings(ctx(TENANT_A, ['schedule.write']))).toThrow('missing capability schedule.read');
    });

    it('returns defensive clones', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting()]);
      const list = uow.listMeetings(ctx());
      (list[0] as any).date = '2099-12-31';
      expect(uow.findMeetingById(ctx(), 'm-1')!.date).toBe('2025-06-11');
    });

    it('returns empty array for tenant with no meetings', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1', TENANT_A)]);
      expect(uow.listMeetings(ctx(TENANT_B))).toEqual([]);
    });
  });

  // ====== deleteMeeting ======

  describe('deleteMeeting', () => {
    it('deletes an existing meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      const result = uow.deleteMeeting(ctx(), 'm-1');
      expect(result).toBe(true);
      expect(uow.findMeetingById(ctx(), 'm-1')).toBeUndefined();
    });

    it('returns false for non-existent meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.deleteMeeting(ctx(), 'nonexistent')).toBe(false);
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      expect(() => uow.deleteMeeting(ctx(TENANT_A, ['schedule.read']), 'm-1')).toThrow('missing capability schedule.write');
    });

    it('does not delete a meeting from another tenant', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1', TENANT_B)]);
      const result = uow.deleteMeeting(ctx(TENANT_A), 'm-1');
      expect(result).toBe(false);
      expect(uow.findMeetingById(ctx(TENANT_B), 'm-1')).toBeDefined();
    });

    it('removes associated student assignments atomically', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1', 'p-1'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-2', TENANT_A, 'm-1', 'p-2'));

      uow.deleteMeeting(ctx(), 'm-1');

      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'm-1')).toEqual([]);
      expect(uow.listStudentAssignments(ctx())).toEqual([]);
    });

    it('removes associated non-student assignments atomically', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-2', TENANT_A, 'm-1'));

      uow.deleteMeeting(ctx(), 'm-1');

      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'm-1')).toEqual([]);
      expect(uow.listNonStudentAssignments(ctx())).toEqual([]);
    });

    it('removes both student and non-student assignments on delete', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1'));

      uow.deleteMeeting(ctx(), 'm-1');

      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'm-1')).toEqual([]);
      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'm-1')).toEqual([]);
    });

    it('does not remove assignments from other meetings', () => {
      const uow = new InMemoryMidweekUnitOfWork([
        makeMeeting('m-1'),
        makeMeeting('m-2', TENANT_A, '2025-06-18'),
      ]);
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-2', TENANT_A, 'm-2'));

      uow.deleteMeeting(ctx(), 'm-1');

      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'm-2')).toHaveLength(1);
    });

    it('does not remove assignments from other tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1', TENANT_A)]);
      uow.saveStudentAssignment(ctx(TENANT_B), makeStudentAssignment('sa-1', TENANT_B, 'm-1'));

      uow.deleteMeeting(ctx(TENANT_A), 'm-1');

      expect(uow.findStudentAssignmentsByMeeting(ctx(TENANT_B), 'm-1')).toHaveLength(1);
    });
  });

  // ====== Student Assignments ======

  describe('saveStudentAssignment', () => {
    it('stores a new student assignment', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment());
      expect(uow.listStudentAssignments(ctx())).toHaveLength(1);
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.saveStudentAssignment(ctx(TENANT_A, ['schedule.read']), makeStudentAssignment()),
      ).toThrow('missing capability schedule.write');
    });

    it('rejects cross-tenant assignment', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.saveStudentAssignment(ctx(TENANT_A), makeStudentAssignment('sa-1', TENANT_B)),
      ).toThrow('Cross-tenant access denied');
    });

    it('overwrites existing assignment (upsert semantics)', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1'));
      uow.saveStudentAssignment(
        ctx(),
        makeStudentAssignment('sa-1', TENANT_A, 'm-1', 'p-2', { assignmentType: 'No.1' }),
      );
      const list = uow.listStudentAssignments(ctx());
      expect(list).toHaveLength(1);
      expect(list[0].personId).toBe('p-2');
      expect(list[0].assignmentType).toBe('No.1');
    });
  });

  describe('findStudentAssignmentsByMeeting', () => {
    it('returns assignments for a specific meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-2', TENANT_A, 'm-2'));
      const result = uow.findStudentAssignmentsByMeeting(ctx(), 'm-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sa-1');
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.findStudentAssignmentsByMeeting(ctx(TENANT_A, ['schedule.write']), 'm-1'),
      ).toThrow('missing capability schedule.read');
    });

    it('returns empty for non-existent meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'nonexistent')).toEqual([]);
    });

    it('returns defensive clones', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment());
      const result = uow.findStudentAssignmentsByMeeting(ctx(), 'm-1');
      (result[0] as any).personId = 'MUTATED';
      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'm-1')[0].personId).toBe('p-1');
    });
  });

  describe('findStudentAssignmentsByPerson', () => {
    it('returns assignments for a specific person', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1', 'p-1'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-2', TENANT_A, 'm-2', 'p-2'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-3', TENANT_A, 'm-3', 'p-1'));
      const result = uow.findStudentAssignmentsByPerson(ctx(), 'p-1');
      expect(result).toHaveLength(2);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.findStudentAssignmentsByPerson(ctx(TENANT_A, ['schedule.write']), 'p-1'),
      ).toThrow('missing capability schedule.read');
    });

    it('returns empty for person with no assignments', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findStudentAssignmentsByPerson(ctx(), 'p-nope')).toEqual([]);
    });

    it('is tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(TENANT_A), makeStudentAssignment('sa-1', TENANT_A, 'm-1', 'p-1'));
      uow.saveStudentAssignment(ctx(TENANT_B), makeStudentAssignment('sa-2', TENANT_B, 'm-2', 'p-1'));
      expect(uow.findStudentAssignmentsByPerson(ctx(TENANT_A), 'p-1')).toHaveLength(1);
      expect(uow.findStudentAssignmentsByPerson(ctx(TENANT_B), 'p-1')).toHaveLength(1);
    });
  });

  describe('listStudentAssignments', () => {
    it('returns all student assignments for tenant', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1'));
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-2', TENANT_A, 'm-2'));
      expect(uow.listStudentAssignments(ctx())).toHaveLength(2);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() => uow.listStudentAssignments(ctx(TENANT_A, ['schedule.write']))).toThrow(
        'missing capability schedule.read',
      );
    });

    it('returns empty array for tenant with no assignments', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listStudentAssignments(ctx(TENANT_B))).toEqual([]);
    });

    it('returns defensive clones', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment());
      const list = uow.listStudentAssignments(ctx());
      (list[0] as any).assignmentType = 'MUTATED';
      expect(uow.listStudentAssignments(ctx())[0].assignmentType).toBe('Bible Highlights');
    });
  });

  // ====== Non-Student Assignments ======

  describe('saveNonStudentAssignment', () => {
    it('stores a new non-student assignment', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment());
      expect(uow.listNonStudentAssignments(ctx())).toHaveLength(1);
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.saveNonStudentAssignment(ctx(TENANT_A, ['schedule.read']), makeNonStudentAssignment()),
      ).toThrow('missing capability schedule.write');
    });

    it('rejects cross-tenant assignment', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.saveNonStudentAssignment(ctx(TENANT_A), makeNonStudentAssignment('nsa-1', TENANT_B)),
      ).toThrow('Cross-tenant access denied');
    });

    it('overwrites existing assignment (upsert semantics)', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1'));
      uow.saveNonStudentAssignment(
        ctx(),
        makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1', 'p-2', { assignmentType: 'Closing Prayer' }),
      );
      const list = uow.listNonStudentAssignments(ctx());
      expect(list).toHaveLength(1);
      expect(list[0].assignmentType).toBe('Closing Prayer');
    });
  });

  describe('findNonStudentAssignmentsByMeeting', () => {
    it('returns assignments for a specific meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-2', TENANT_A, 'm-2'));
      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'm-1')).toHaveLength(1);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.findNonStudentAssignmentsByMeeting(ctx(TENANT_A, ['schedule.write']), 'm-1'),
      ).toThrow('missing capability schedule.read');
    });

    it('returns empty for non-existent meeting', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'nonexistent')).toEqual([]);
    });

    it('returns defensive clones', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment());
      const result = uow.findNonStudentAssignmentsByMeeting(ctx(), 'm-1');
      (result[0] as any).personId = 'MUTATED';
      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'm-1')[0].personId).toBe('p-1');
    });
  });

  describe('findNonStudentAssignmentsByPerson', () => {
    it('returns assignments for a specific person', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1', 'p-1'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-2', TENANT_A, 'm-2', 'p-2'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-3', TENANT_A, 'm-3', 'p-1'));
      expect(uow.findNonStudentAssignmentsByPerson(ctx(), 'p-1')).toHaveLength(2);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.findNonStudentAssignmentsByPerson(ctx(TENANT_A, ['schedule.write']), 'p-1'),
      ).toThrow('missing capability schedule.read');
    });

    it('returns empty for person with no assignments', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findNonStudentAssignmentsByPerson(ctx(), 'p-nope')).toEqual([]);
    });

    it('is tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(TENANT_A), makeNonStudentAssignment('nsa-1', TENANT_A, 'm-1', 'p-1'));
      uow.saveNonStudentAssignment(ctx(TENANT_B), makeNonStudentAssignment('nsa-2', TENANT_B, 'm-2', 'p-1'));
      expect(uow.findNonStudentAssignmentsByPerson(ctx(TENANT_A), 'p-1')).toHaveLength(1);
      expect(uow.findNonStudentAssignmentsByPerson(ctx(TENANT_B), 'p-1')).toHaveLength(1);
    });
  });

  describe('listNonStudentAssignments', () => {
    it('returns all non-student assignments for tenant', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-1'));
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('nsa-2', TENANT_A, 'm-2'));
      expect(uow.listNonStudentAssignments(ctx())).toHaveLength(2);
    });

    it('requires schedule.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() => uow.listNonStudentAssignments(ctx(TENANT_A, ['schedule.write']))).toThrow(
        'missing capability schedule.read',
      );
    });

    it('returns empty array for tenant with no assignments', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listNonStudentAssignments(ctx(TENANT_B))).toEqual([]);
    });

    it('returns defensive clones', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment());
      const list = uow.listNonStudentAssignments(ctx());
      (list[0] as any).assignmentType = 'MUTATED';
      expect(uow.listNonStudentAssignments(ctx())[0].assignmentType).toBe('Chairman');
    });
  });

  // ====== Audit ======

  describe('recordAudit', () => {
    it('stores an audit event', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent());
      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceId).toBe('m-1');
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.recordAudit(ctx(TENANT_A, ['schedule.read']), makeAuditEvent()),
      ).toThrow('missing capability schedule.write');
    });

    it('rejects cross-tenant audit event', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.recordAudit(ctx(TENANT_A), makeAuditEvent('audit-1', TENANT_B)),
      ).toThrow('Cross-tenant access denied');
    });

    it('rejects duplicate audit event id', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent('audit-1'));
      expect(() => uow.recordAudit(ctx(), makeAuditEvent('audit-1'))).toThrow('Duplicate audit event id');
    });

    it('allows same audit id in different tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(TENANT_A), makeAuditEvent('audit-1', TENANT_A));
      uow.recordAudit(ctx(TENANT_B), makeAuditEvent('audit-1', TENANT_B));
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toHaveLength(1);
      expect(uow.listAudit(ctx(TENANT_B, ['audit.read']))).toHaveLength(1);
    });
  });

  describe('listAudit', () => {
    it('requires audit.read capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() => uow.listAudit(ctx(TENANT_A, ['schedule.read']))).toThrow('missing capability audit.read');
    });

    it('returns frozen clones of audit events', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent());
      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(Object.isFrozen(audit[0])).toBe(true);
      const audit2 = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit[0]).not.toBe(audit2[0]); // distinct clones each call
    });

    it('returns empty array when no audit events', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toEqual([]);
    });

    it('is tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(TENANT_A), makeAuditEvent('a-1', TENANT_A, { resourceId: 'r-a' }));
      uow.recordAudit(ctx(TENANT_B), makeAuditEvent('a-2', TENANT_B, { resourceId: 'r-b' }));
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toHaveLength(1);
      expect(uow.listAudit(ctx(TENANT_B, ['audit.read']))).toHaveLength(1);
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))[0].resourceId).toBe('r-a');
    });
  });

  // ====== Outbox ======

  describe('emitEvent', () => {
    it('stores a domain event', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent());
      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].aggregateId).toBe('m-1');
    });

    it('requires schedule.write capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.emitEvent(ctx(TENANT_A, ['schedule.read']), makeDomainEvent()),
      ).toThrow('missing capability schedule.write');
    });

    it('rejects cross-tenant domain event', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() =>
        uow.emitEvent(ctx(TENANT_A), makeDomainEvent('event-1', TENANT_B)),
      ).toThrow('Cross-tenant access denied');
    });

    it('rejects duplicate domain event id', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent('event-1'));
      expect(() => uow.emitEvent(ctx(), makeDomainEvent('event-1'))).toThrow('Duplicate domain event id');
    });

    it('allows same event id in different tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(TENANT_A), makeDomainEvent('event-1', TENANT_A));
      uow.emitEvent(ctx(TENANT_B), makeDomainEvent('event-1', TENANT_B));
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))).toHaveLength(1);
      expect(uow.listOutbox(ctx(TENANT_B, ['tenant.manage']))).toHaveLength(1);
    });
  });

  describe('listOutbox', () => {
    it('requires tenant.manage capability', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(() => uow.listOutbox(ctx(TENANT_A, ['schedule.read']))).toThrow('missing capability tenant.manage');
    });

    it('returns frozen clones of domain events', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent());
      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(Object.isFrozen(outbox[0])).toBe(true);
      const outbox2 = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox[0]).not.toBe(outbox2[0]); // distinct clones each call
    });

    it('returns empty array when no events', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))).toEqual([]);
    });

    it('is tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(TENANT_A), makeDomainEvent('e-1', TENANT_A, { aggregateId: 'a-a' }));
      uow.emitEvent(ctx(TENANT_B), makeDomainEvent('e-2', TENANT_B, { aggregateId: 'a-b' }));
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))).toHaveLength(1);
      expect(uow.listOutbox(ctx(TENANT_B, ['tenant.manage']))).toHaveLength(1);
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))[0].aggregateId).toBe('a-a');
    });
  });

  // ====== Cross-Tenant Isolation (Adversarial) ======

  describe('cross-tenant isolation', () => {
    it('listMeetings never leaks data across tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork([
        makeMeeting('m-a', TENANT_A, '2025-06-11'),
        makeMeeting('m-b', TENANT_B, '2025-06-18'),
      ]);
      const listA = uow.listMeetings(ctx(TENANT_A));
      const listB = uow.listMeetings(ctx(TENANT_B));
      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(1);
      expect(listA[0].id).toBe('m-a');
      expect(listB[0].id).toBe('m-b');
    });

    it('findMeetingById never leaks across tenants', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1', TENANT_B)]);
      expect(uow.findMeetingById(ctx(TENANT_A), 'm-1')).toBeUndefined();
    });

    it('student assignments are tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(TENANT_A), makeStudentAssignment('sa-a', TENANT_A, 'm-1'));
      uow.saveStudentAssignment(ctx(TENANT_B), makeStudentAssignment('sa-b', TENANT_B, 'm-2'));
      expect(uow.listStudentAssignments(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listStudentAssignments(ctx(TENANT_B))).toHaveLength(1);
    });

    it('non-student assignments are tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(TENANT_A), makeNonStudentAssignment('nsa-a', TENANT_A, 'm-1'));
      uow.saveNonStudentAssignment(ctx(TENANT_B), makeNonStudentAssignment('nsa-b', TENANT_B, 'm-2'));
      expect(uow.listNonStudentAssignments(ctx(TENANT_A))).toHaveLength(1);
      expect(uow.listNonStudentAssignments(ctx(TENANT_B))).toHaveLength(1);
    });

    it('audit events are tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(TENANT_A), makeAuditEvent('a-1', TENANT_A));
      uow.recordAudit(ctx(TENANT_B), makeAuditEvent('a-2', TENANT_B));
      const auditA = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      const auditB = uow.listAudit(ctx(TENANT_B, ['audit.read']));
      expect(auditA).toHaveLength(1);
      expect(auditB).toHaveLength(1);
      expect(auditA[0].id).toBe('a-1');
      expect(auditB[0].id).toBe('a-2');
    });

    it('outbox events are tenant-scoped', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(TENANT_A), makeDomainEvent('e-1', TENANT_A));
      uow.emitEvent(ctx(TENANT_B), makeDomainEvent('e-2', TENANT_B));
      const outA = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      const outB = uow.listOutbox(ctx(TENANT_B, ['tenant.manage']));
      expect(outA).toHaveLength(1);
      expect(outB).toHaveLength(1);
      expect(outA[0].id).toBe('e-1');
      expect(outB[0].id).toBe('e-2');
    });
  });

  // ====== Atomicity ======

  describe('atomicity', () => {
    it('saving a meeting does not affect audit store', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      const audit = makeAuditEvent();
      uow.recordAudit(ctx(), audit);

      // Save a meeting with cross-tenant (will fail)
      expect(() =>
        uow.saveMeeting(ctx(TENANT_A), makeMeeting('m-1', TENANT_B)),
      ).toThrow('Cross-tenant access denied');

      // Audit must still be there
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toHaveLength(1);
    });

    it('duplicate audit id does not corrupt meeting store', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent('audit-1'));
      uow.saveMeeting(ctx(), makeMeeting('m-1'));

      // Duplicate audit id should fail
      expect(() => uow.recordAudit(ctx(), makeAuditEvent('audit-1'))).toThrow('Duplicate audit event id');

      // Meeting must still be there
      expect(uow.findMeetingById(ctx(), 'm-1')).toBeDefined();
    });

    it('duplicate domain event id does not corrupt audit store', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent('event-1'));
      uow.recordAudit(ctx(), makeAuditEvent('audit-1'));

      expect(() => uow.emitEvent(ctx(), makeDomainEvent('event-1'))).toThrow('Duplicate domain event id');

      // Audit must still be intact
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toHaveLength(1);
    });

    it('failed delete does not remove assignments', () => {
      const uow = new InMemoryMidweekUnitOfWork([makeMeeting('m-1')]);
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('sa-1', TENANT_A, 'm-1'));

      // Delete non-existent meeting (no-op)
      uow.deleteMeeting(ctx(), 'nonexistent');

      // Assignment must still be there
      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'm-1')).toHaveLength(1);
    });

    it('each individual operation is self-contained (meeting save failure does not affect prior saves)', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveMeeting(ctx(), makeMeeting('m-1'));

      // Cross-tenant save will fail
      expect(() =>
        uow.saveMeeting(ctx(TENANT_A), makeMeeting('m-2', TENANT_B)),
      ).toThrow('Cross-tenant access denied');

      // m-1 must still be there
      expect(uow.findMeetingById(ctx(), 'm-1')).toBeDefined();
      expect(uow.listMeetings(ctx())).toHaveLength(1);
    });

    it('audit recorded before failed meeting save persists', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent('audit-1'));

      // Capability failure on meeting save
      const readOnlyCtx = ctx(TENANT_A, ['schedule.read']);
      expect(() => uow.saveMeeting(readOnlyCtx, makeMeeting('m-1'))).toThrow('missing capability schedule.write');

      // Audit must persist
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toHaveLength(1);
    });

    it('domain event emitted before failed audit record persists', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent('event-1'));

      // Duplicate audit id
      uow.recordAudit(ctx(), makeAuditEvent('audit-1'));
      expect(() => uow.recordAudit(ctx(), makeAuditEvent('audit-1'))).toThrow('Duplicate audit event id');

      // Domain event must persist
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))).toHaveLength(1);
    });
  });

  // ====== Empty States ======

  describe('empty states', () => {
    it('findMeetingById returns undefined on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findMeetingById(ctx(), 'any')).toBeUndefined();
    });

    it('listMeetings returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listMeetings(ctx())).toEqual([]);
    });

    it('findStudentAssignmentsByMeeting returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findStudentAssignmentsByMeeting(ctx(), 'any')).toEqual([]);
    });

    it('findStudentAssignmentsByPerson returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findStudentAssignmentsByPerson(ctx(), 'any')).toEqual([]);
    });

    it('listStudentAssignments returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listStudentAssignments(ctx())).toEqual([]);
    });

    it('findNonStudentAssignmentsByMeeting returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findNonStudentAssignmentsByMeeting(ctx(), 'any')).toEqual([]);
    });

    it('findNonStudentAssignmentsByPerson returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.findNonStudentAssignmentsByPerson(ctx(), 'any')).toEqual([]);
    });

    it('listNonStudentAssignments returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listNonStudentAssignments(ctx())).toEqual([]);
    });

    it('listAudit returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listAudit(ctx(TENANT_A, ['audit.read']))).toEqual([]);
    });

    it('listOutbox returns empty on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.listOutbox(ctx(TENANT_A, ['tenant.manage']))).toEqual([]);
    });

    it('deleteMeeting returns false on fresh UoW', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      expect(uow.deleteMeeting(ctx(), 'any')).toBe(false);
    });
  });

  // ====== Malformed Inputs ======

  describe('malformed inputs', () => {
    it('saveMeeting with empty id stores the empty-id meeting (valid upsert)', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveMeeting(ctx(), makeMeeting('', TENANT_A, '2025-06-11'));
      // The UoW is a store; validation of business rules belongs to the domain layer
      expect(uow.findMeetingById(ctx(), '')).toBeDefined();
    });

    it('saveStudentAssignment with empty id stores it', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveStudentAssignment(ctx(), makeStudentAssignment('', TENANT_A, 'm-1', 'p-1'));
      expect(uow.listStudentAssignments(ctx())).toHaveLength(1);
    });

    it('saveNonStudentAssignment with empty id stores it', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.saveNonStudentAssignment(ctx(), makeNonStudentAssignment('', TENANT_A, 'm-1', 'p-1'));
      expect(uow.listNonStudentAssignments(ctx())).toHaveLength(1);
    });

    it('recordAudit with mismatched resourceType still stores', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.recordAudit(ctx(), makeAuditEvent('a-1', TENANT_A, { resourceType: 'invalid-type' }));
      const audit = uow.listAudit(ctx(TENANT_A, ['audit.read']));
      expect(audit).toHaveLength(1);
      expect(audit[0].resourceType).toBe('invalid-type');
    });

    it('emitEvent with unknown type still stores', () => {
      const uow = new InMemoryMidweekUnitOfWork();
      uow.emitEvent(ctx(), makeDomainEvent('e-1', TENANT_A, { type: 'UnknownEvent' }));
      const outbox = uow.listOutbox(ctx(TENANT_A, ['tenant.manage']));
      expect(outbox).toHaveLength(1);
      expect(outbox[0].type).toBe('UnknownEvent');
    });
  });
});
