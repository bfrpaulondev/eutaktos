import { describe, it, expect } from 'vitest';
import {
  buildConflictReport,
  conflictPersonNotEligible,
  conflictPersonInactive,
  conflictStudentHelperSamePerson,
  conflictAssistantRequiredMissing,
  conflictAssistantNotAllowed,
  conflictSlotNotFound,
  conflictMeetingNotDraft,
  conflictPartDefinitionMismatch,
  conflictClassConflict,
  conflictConcurrentModification,
  blockingConflicts,
  hasBlockingConflict,
  assertConflictTenant,
  type ConflictReportInput,
} from './conflict-report';
import type { ConflictAssignment, UnavailableInterval } from './conflict-engine';

const BASE: ConflictReportInput = {
  tenantId: 'tenant-a',
  candidate: {
    tenantId: 'tenant-a',
    assignmentId: 'candidate:p1',
    personId: 'p1',
    startsAt: '2026-09-01T19:00:00Z',
    endsAt: '2026-09-01T19:30:00Z',
  },
  existingAssignments: [],
  unavailable: [],
};

describe('conflict-report — buildConflictReport', () => {
  it('returns empty when no overlap', () => {
    expect(buildConflictReport(BASE)).toEqual([]);
  });

  it('returns blocking assignment-overlap when same person overlaps', () => {
    const existing: ConflictAssignment[] = [
      {
        tenantId: 'tenant-a',
        assignmentId: 'asg-1:student',
        personId: 'p1',
        startsAt: '2026-09-01T19:15:00Z',
        endsAt: '2026-09-01T19:45:00Z',
      },
    ];
    const report = buildConflictReport({ ...BASE, existingAssignments: existing });
    expect(report.length).toBe(1);
    expect(report[0].kind).toBe('assignment-overlap');
    expect(report[0].severity).toBe('blocking');
    expect(report[0].personId).toBe('p1');
    expect(report[0].sourceId).toBe('asg-1:student');
    expect(report[0].messageKey).toBe('midweek.conflict.assignmentOverlap');
  });

  it('returns blocking unavailable when person is in away period', () => {
    const unavailable: UnavailableInterval[] = [
      {
        tenantId: 'tenant-a',
        personId: 'p1',
        sourceId: 'away-1',
        startsAt: '2026-09-01T00:00:00Z',
        endsAt: '2026-09-02T00:00:00Z',
      },
    ];
    const report = buildConflictReport({ ...BASE, unavailable });
    expect(report.length).toBe(1);
    expect(report[0].kind).toBe('unavailable');
    expect(report[0].severity).toBe('blocking');
    expect(report[0].sourceId).toBe('away-1');
  });

  it('throws on cross-tenant candidate', () => {
    expect(() => buildConflictReport({
      ...BASE,
      candidate: { ...BASE.candidate, tenantId: 'tenant-b' },
    })).toThrow(/Cross-tenant/);
  });
});

describe('conflict-report — individual builders', () => {
  it('conflictPersonNotEligible has blocking severity', () => {
    const c = conflictPersonNotEligible('tenant-a', 'p1', 'part:treasures');
    expect(c.kind).toBe('person-not-eligible');
    expect(c.severity).toBe('blocking');
    expect(c.params.personId).toBe('p1');
  });

  it('conflictPersonInactive has blocking severity', () => {
    const c = conflictPersonInactive('tenant-a', 'p1');
    expect(c.kind).toBe('person-inactive');
    expect(c.severity).toBe('blocking');
  });

  it('conflictStudentHelperSamePerson has blocking severity', () => {
    const c = conflictStudentHelperSamePerson('tenant-a', 'p1');
    expect(c.kind).toBe('student-helper-same-person');
    expect(c.severity).toBe('blocking');
  });

  it('conflictAssistantRequiredMissing has blocking severity', () => {
    const c = conflictAssistantRequiredMissing('tenant-a', 'slot-1');
    expect(c.kind).toBe('assistant-required-missing');
    expect(c.severity).toBe('blocking');
  });

  it('conflictAssistantNotAllowed has blocking severity', () => {
    const c = conflictAssistantNotAllowed('tenant-a', 'slot-1');
    expect(c.kind).toBe('assistant-not-allowed');
    expect(c.severity).toBe('blocking');
  });

  it('conflictSlotNotFound has blocking severity', () => {
    const c = conflictSlotNotFound('tenant-a', 'slot-1');
    expect(c.kind).toBe('slot-not-found');
    expect(c.severity).toBe('blocking');
  });

  it('conflictMeetingNotDraft has blocking severity', () => {
    const c = conflictMeetingNotDraft('tenant-a', 'meeting-1', 'published');
    expect(c.kind).toBe('meeting-not-draft');
    expect(c.severity).toBe('blocking');
    expect(c.params.currentState).toBe('published');
  });

  it('conflictPartDefinitionMismatch has blocking severity', () => {
    const c = conflictPartDefinitionMismatch('tenant-a', 'slot-1');
    expect(c.kind).toBe('part-definition-mismatch');
    expect(c.severity).toBe('blocking');
  });

  it('conflictClassConflict has blocking severity', () => {
    const c = conflictClassConflict('tenant-a', 'p1', 'aux-1');
    expect(c.kind).toBe('class-conflict');
    expect(c.severity).toBe('blocking');
  });

  it('conflictConcurrentModification has blocking severity', () => {
    const c = conflictConcurrentModification('tenant-a', 'meeting-1');
    expect(c.kind).toBe('concurrent-modification');
    expect(c.severity).toBe('blocking');
  });
});

describe('conflict-report — blocking filters', () => {
  it('blockingConflicts filters only blocking', () => {
    const all = [
      conflictPersonNotEligible('tenant-a', 'p1', 'part:treasures'),
      conflictPersonInactive('tenant-a', 'p2'),
    ];
    expect(blockingConflicts(all).length).toBe(2);
  });

  it('hasBlockingConflict returns true when at least one blocking exists', () => {
    const all = [
      conflictPersonNotEligible('tenant-a', 'p1', 'part:treasures'),
    ];
    expect(hasBlockingConflict(all)).toBe(true);
  });

  it('hasBlockingConflict returns false when empty', () => {
    expect(hasBlockingConflict([])).toBe(false);
  });
});

describe('conflict-report — tenant guard', () => {
  it('passes when tenant matches', () => {
    expect(() => assertConflictTenant(conflictPersonInactive('tenant-a', 'p1'), 'tenant-a')).not.toThrow();
  });

  it('throws when tenant differs', () => {
    expect(() => assertConflictTenant(conflictPersonInactive('tenant-a', 'p1'), 'tenant-b')).toThrow(/Cross-tenant/);
  });
});

describe('conflict-report — translation keys are stable', () => {
  it('all messageKeys are non-empty and prefixed', () => {
    const conflicts = [
      ...buildConflictReport({
        ...BASE,
        existingAssignments: [
          {
            tenantId: 'tenant-a',
            assignmentId: 'asg-1:student',
            personId: 'p1',
            startsAt: '2026-09-01T19:15:00Z',
            endsAt: '2026-09-01T19:45:00Z',
          },
        ],
      }),
      conflictPersonNotEligible('tenant-a', 'p1', 'part:treasures'),
      conflictPersonInactive('tenant-a', 'p1'),
      conflictStudentHelperSamePerson('tenant-a', 'p1'),
      conflictAssistantRequiredMissing('tenant-a', 'slot-1'),
      conflictAssistantNotAllowed('tenant-a', 'slot-1'),
      conflictSlotNotFound('tenant-a', 'slot-1'),
      conflictMeetingNotDraft('tenant-a', 'meeting-1', 'published'),
      conflictPartDefinitionMismatch('tenant-a', 'slot-1'),
      conflictClassConflict('tenant-a', 'p1', 'aux-1'),
      conflictConcurrentModification('tenant-a', 'meeting-1'),
    ];
    for (const c of conflicts) {
      expect(c.messageKey.length).toBeGreaterThan(0);
      expect(c.messageKey.startsWith('midweek.conflict.')).toBe(true);
    }
  });
});
