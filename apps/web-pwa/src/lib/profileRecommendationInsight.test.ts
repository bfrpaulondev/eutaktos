import { describe, expect, it, vi } from 'vitest';
import type { MidweekOverviewDto } from './midweekApi';
import type { PeopleRecommendationDto } from './peopleRecommendationApi';
import {
  loadProfileRecommendationInsight,
  profileRecommendationTargets,
  type ProfileRecommendationInsightDependencies,
} from './profileRecommendationInsight';

function overview(): MidweekOverviewDto {
  return Object.freeze({
    meetings: Object.freeze([
      Object.freeze({ id: 'meeting-past', date: '2032-05-20', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published' as const, slots: Object.freeze([{ id: 'slot-past', position: 0, durationMinutes: 5, titleKey: 'past', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' }]) }),
      Object.freeze({ id: 'meeting-1', date: '2032-06-10', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft' as const, slots: Object.freeze([
        { id: 'slot-non-student', position: 0, durationMinutes: 5, titleKey: 'opening', partDefinitionId: 'builtin:opening-remarks' },
        { id: 'slot-occupied', position: 1, durationMinutes: 5, titleKey: 'occupied', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' },
        { id: 'slot-1', position: 2, durationMinutes: 5, titleKey: 'student', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' },
      ]) }),
      Object.freeze({ id: 'meeting-2', date: '2032-06-17', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published' as const, slots: Object.freeze([
        { id: 'slot-2', position: 0, durationMinutes: 5, titleKey: 'student', partDefinitionId: 'builtin:living-as-christians' },
        { id: 'slot-no-type', position: 1, durationMinutes: 5, titleKey: 'custom' },
      ]) }),
      Object.freeze({ id: 'meeting-cancelled', date: '2032-06-24', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'cancelled' as const, slots: Object.freeze([{ id: 'slot-cancelled', position: 0, durationMinutes: 5, titleKey: 'cancelled', partDefinitionId: 'builtin:apply-yourself-to-the-ministry' }]) }),
    ]),
    studentAssignments: Object.freeze([Object.freeze({ id: 'assignment-occupied', meetingId: 'meeting-1', slotId: 'slot-occupied', studentId: 'person-other', studentDisplayName: 'Other', assistantId: null, assistantDisplayName: null, state: 'assigned' as const })]),
    nonStudentAssignments: Object.freeze([]),
  });
}

function recommendation(meetingId: string, slotId: string, personId: string | undefined, rank = 2): PeopleRecommendationDto {
  return Object.freeze({
    contractVersion: 'people-recommendation-v1', evidenceContractVersion: 'px7-evidence-v1', inputContractVersion: 'px7-recommendation-input-v1', canManageManualConstraints: false,
    target: Object.freeze({ meetingId, slotId, assignmentTypeId: 'builtin:apply-yourself-to-the-ministry', meetingDate: meetingId === 'meeting-1' ? '2032-06-10' : '2032-06-17', startsAt: '2032-06-10T18:30:00.000Z', endsAt: '2032-06-10T18:35:00.000Z' }),
    candidates: Object.freeze(personId ? [Object.freeze({ personId, displayName: 'Profile Person', status: 'candidate' as const, rank, reasons: Object.freeze([{ code: 'ELIGIBLE' as const }, { code: 'AVAILABLE' as const }, { code: 'NO_MEETING_CONFLICT' as const }]), warnings: Object.freeze([]), manualConstraintCodes: Object.freeze([]), history: Object.freeze({ kind: 'no-completed-history' as const }), sameWeekAssignmentCount: 0 })] : []),
    excluded: Object.freeze([]),
  });
}

function dependencies(get: ProfileRecommendationInsightDependencies['recommendations']['get'], capabilities = ['people.read', 'eligibility.read', 'availability.read', 'schedule.read']): ProfileRecommendationInsightDependencies {
  return Object.freeze({ session: { current: vi.fn(async () => Object.freeze({ actorId: 'actor-1', capabilities: Object.freeze(capabilities) }) as never) }, assignments: { overview: vi.fn(async () => overview()) }, recommendations: { get } });
}

describe('C5.7 profile recommendation insight', () => {
  it('selects only bounded future, assignable, unoccupied student targets in chronological order', () => {
    const targets = profileRecommendationTargets(overview(), new Date('2032-06-01T12:00:00.000Z'));
    expect(targets.map(target => [target.meetingId, target.slotId, target.assignmentTypeId])).toEqual([
      ['meeting-1', 'slot-1', 'builtin:apply-yourself-to-the-ministry'],
      ['meeting-2', 'slot-2', 'builtin:living-as-christians'],
    ]);
    expect(profileRecommendationTargets(overview(), new Date('2032-06-01T12:00:00.000Z'), 1)).toHaveLength(1);
  });

  it('does not query PX7 when the authenticated session lacks required evidence capabilities', async () => {
    const get = vi.fn();
    const result = await loadProfileRecommendationInsight('person-1', new Date('2032-06-01T12:00:00.000Z'), undefined, dependencies(get as never, ['people.read', 'schedule.read']));
    expect(result).toEqual({ status: 'blocked' }); expect(get).not.toHaveBeenCalled();
  });

  it('returns only approved positive PX7 candidate evidence without recalculating rank', async () => {
    const get = vi.fn(async (meetingId: string, slotId: string) => recommendation(meetingId, slotId, meetingId === 'meeting-2' ? 'person-1' : undefined, 3));
    const result = await loadProfileRecommendationInsight('person-1', new Date('2032-06-01T12:00:00.000Z'), undefined, dependencies(get as never));
    expect(result.status).toBe('ready'); if (result.status !== 'ready') throw new Error('Expected ready insight');
    expect(result.partial).toBe(false); expect(result.insights).toHaveLength(1); expect(result.insights[0]).toMatchObject({ rank: 3, target: { meetingId: 'meeting-2', slotId: 'slot-2' } });
    expect(result.insights[0]?.reasons.map(reason => reason.code)).toEqual(['ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT']);
  });

  it('returns empty only when every bounded target was checked successfully and no candidate evidence exists', async () => {
    const get = vi.fn(async (meetingId: string, slotId: string) => recommendation(meetingId, slotId, undefined));
    await expect(loadProfileRecommendationInsight('person-1', new Date('2032-06-01T12:00:00.000Z'), undefined, dependencies(get as never))).resolves.toEqual({ status: 'empty' });
  });

  it('keeps uncertainty explicit when a target fails and there is no positive evidence', async () => {
    const get = vi.fn(async (meetingId: string, slotId: string) => { if (meetingId === 'meeting-2') throw new Error('People recommendation request failed (503)'); return recommendation(meetingId, slotId, undefined); });
    await expect(loadProfileRecommendationInsight('person-1', new Date('2032-06-01T12:00:00.000Z'), undefined, dependencies(get as never))).resolves.toEqual({ status: 'unavailable' });
  });

  it('may show confirmed positive evidence while flagging another target as partial', async () => {
    const get = vi.fn(async (meetingId: string, slotId: string) => { if (meetingId === 'meeting-2') throw new Error('People recommendation request failed (503)'); return recommendation(meetingId, slotId, 'person-1', 1); });
    const result = await loadProfileRecommendationInsight('person-1', new Date('2032-06-01T12:00:00.000Z'), undefined, dependencies(get as never));
    expect(result.status).toBe('ready'); if (result.status !== 'ready') throw new Error('Expected ready insight'); expect(result.partial).toBe(true); expect(result.insights[0]?.rank).toBe(1);
  });
});