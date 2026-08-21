import { describe, expect, it } from 'vitest';
import {
  addMeetingSlot,
  archiveWeekendMeeting,
  buildEligibilityIndex,
  checkEligibility,
  createAuxiliaryClass,
  createMainClass,
  createMidweekMeeting,
  createMidweekPartDefinition,
  createNeighborCongregation,
  createNonStudentAssignment,
  createPublicSpeaker,
  createPublicTalkSchedule,
  createStudentAssignment,
  createTalkOutline,
  createWeekendMeeting,
  detectSchedulingConflicts,
  lastAssignment,
  lastPublicTalkUseOfOutline,
  publishWeekendMeeting,
  recordAssignmentHistory,
  recordPublicTalkHistory,
  unavailableIntervalsForPerson,
  validateNoSlotOverlap,
  type CongregationPerson,
} from './index';

const now = '2026-08-21T10:00:00.000Z';

describe('K40 scheduling invariants using real K21-K39 implementations', () => {
  it('connects real midweek meeting, part and assignment models without local mirror types', () => {
    const part = createMidweekPartDefinition({
      id: 'reading', type: 'apply-yourself-to-the-ministry', titleKey: 'part.reading', durationMinutes: 5,
      position: 1, studentNeeded: true, assistantRequirement: 'none',
    });
    const meeting = addMeetingSlot(
      createMidweekMeeting({ id: 'm1', tenantId: 'a', date: '2026-08-25', localTime: '19:00', timezone: 'Europe/Lisbon', now }),
      { id: 's1', position: 0, durationMinutes: part.durationMinutes, titleKey: part.titleKey, partDefinitionId: part.id },
    );
    const student = createStudentAssignment({ id: 'sa1', tenantId: 'a', meetingId: meeting.id, slotId: 's1', studentId: 'p1', assistantIsRequired: false, now });
    const nonStudent = createNonStudentAssignment({ id: 'na1', tenantId: 'a', meetingId: meeting.id, slotId: 's1', personId: 'p2', role: 'chairman', now });
    expect(student.tenantId).toBe(meeting.tenantId);
    expect(nonStudent.meetingId).toBe(meeting.id);
    expect(meeting.slots[0].partDefinitionId).toBe(part.id);
  });

  it('enforces class slot non-overlap using the actual meeting-class implementation', () => {
    const main = createMainClass('m1', 'a', now);
    const auxiliary = createAuxiliaryClass('m1', 'a', 1, now);
    const overlapping = [
      { ...main, slotIds: ['s1'] },
      { ...auxiliary, slotIds: ['s1'] },
    ];
    expect(() => validateNoSlotOverlap(overlapping)).toThrow('multiple classes');
  });

  it('keeps assignment history and recency queries inside the requested tenant', () => {
    const history = [
      recordAssignmentHistory({ id: 'h1', tenantId: 'a', assignmentId: 'a1', personId: 'p1', partType: 'reading', meetingDate: '2026-08-01', state: 'completed', recordedAt: now, meetingId: 'm1' }),
      recordAssignmentHistory({ id: 'h2', tenantId: 'b', assignmentId: 'a2', personId: 'p1', partType: 'reading', meetingDate: '2026-12-01', state: 'completed', recordedAt: now, meetingId: 'm2' }),
    ];
    expect(lastAssignment(history, 'p1', 'a')?.id).toBe('h1');
  });

  it('combines real availability adapter and conflict engine without crossing tenants', () => {
    const person: CongregationPerson = {
      id: 'p1', tenantId: 'a', displayName: 'P1', active: true, eligibility: [],
      availability: [{ id: 'away-1', startsAt: '2026-08-25T18:00:00.000Z', endsAt: '2026-08-25T20:00:00.000Z' }],
    };
    const unavailable = unavailableIntervalsForPerson(person, 'a');
    const conflicts = detectSchedulingConflicts({
      tenantId: 'a',
      candidate: { tenantId: 'a', assignmentId: 'candidate', personId: 'p1', startsAt: '2026-08-25T18:30:00.000Z', endsAt: '2026-08-25T19:00:00.000Z' },
      assignments: [{ tenantId: 'b', assignmentId: 'foreign', personId: 'p1', startsAt: '2026-08-25T18:30:00.000Z', endsAt: '2026-08-25T19:00:00.000Z' }],
      unavailable,
    });
    expect(conflicts.map(item => item.sourceId)).toEqual(['away-1']);
  });

  it('uses explicit human eligibility decisions only', () => {
    const person: CongregationPerson = {
      id: 'p1', tenantId: 'a', displayName: 'P1', active: true, availability: [],
      eligibility: [{ assignmentTypeId: 'reading', enabled: true, decidedBy: 'elder-1', decidedAt: now }],
    };
    const index = buildEligibilityIndex([person], 'a');
    expect(checkEligibility(index, 'a', 'p1', 'reading')).toBe(true);
    expect(checkEligibility(index, 'a', 'p1', 'unknown')).toBe(false);
  });

  it('connects weekend meeting, speaker, outline and neighbor models as factual references only', () => {
    const weekend = createWeekendMeeting({ id: 'wm1', tenantId: 'a', date: '2026-08-23', localTime: '10:00', timezone: 'Europe/Lisbon', now });
    const speaker = createPublicSpeaker({ id: 'speaker1', tenantId: 'a', name: 'External Speaker', congregationId: 'neighbor1', isVisiting: true }, now);
    const outline = createTalkOutline({ id: 'outline1', tenantId: 'a', title: 'Talk title', language: 'pt-PT' }, now);
    const neighbor = createNeighborCongregation({ id: 'neighbor1', tenantId: 'a', name: 'Neighbor', meetingDay: 0, meetingTime: '10:00', timezone: 'Europe/Lisbon', language: 'pt-PT', kind: 'nearby', now });
    expect([weekend, speaker, outline, neighbor].every(item => item.tenantId === 'a')).toBe(true);
    expect('score' in speaker || 'rank' in speaker || 'suitability' in speaker).toBe(false);
  });

  it('uses the real weekend lifecycle', () => {
    const draft = createWeekendMeeting({ id: 'wm1', tenantId: 'a', date: '2026-08-23', localTime: '10:00', timezone: 'Europe/Lisbon', now });
    const published = publishWeekendMeeting(draft, '2026-08-22T10:00:00.000Z');
    expect(archiveWeekendMeeting(published, '2026-08-24T10:00:00.000Z').state).toBe('archived');
  });

  it('keeps public talk scheduling strict and public talk history tenant-scoped', () => {
    const scheduled = createPublicTalkSchedule({
      id: 'ps1', tenantId: 'a', weekendMeetingId: 'wm1', talkOutlineId: 'o1', speakerId: 's1', speakerCongregationId: 'c1',
      date: '2026-08-23', localTime: '10:00', timezone: 'Europe/Lisbon', type: 'local', visiting: true, now,
    });
    expect(scheduled.visiting).toBe(true);
    const history = [
      recordPublicTalkHistory({ id: 'ph1', tenantId: 'a', speakerId: 's1', talkOutlineId: 'o1', congregationId: 'c1', date: '2026-08-23', type: 'local', state: 'completed', recordedAt: '2026-08-23T12:00:00.000Z', weekendMeetingId: 'wm1' }),
      recordPublicTalkHistory({ id: 'ph2', tenantId: 'b', speakerId: 's1', talkOutlineId: 'o1', congregationId: 'c1', date: '2026-12-31', type: 'local', state: 'completed', recordedAt: '2026-12-31T12:00:00.000Z', weekendMeetingId: 'wm2' }),
    ];
    expect(lastPublicTalkUseOfOutline(history, 'a', 'o1')).toBe('2026-08-23');
  });
});
