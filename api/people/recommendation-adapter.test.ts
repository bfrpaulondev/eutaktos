import { describe, expect, it } from 'vitest';
import { createAccessContext, type CongregationPerson, type MidweekMeeting } from '@eutaktos/domain';
import { buildAuthorizedMidweekRecommendation } from './recommendation-adapter';
import { recommendationTargetFromRequest } from './recommendations';

const FULL_READ = ['people.read', 'eligibility.read', 'availability.read', 'schedule.read'] as const;

function person(input: {
  id: string;
  tenantId?: string;
  eligible?: boolean;
  unavailable?: boolean;
}): CongregationPerson {
  const tenantId = input.tenantId ?? 'tenant-a';
  return Object.freeze({
    id: input.id,
    tenantId,
    displayName: `Person ${input.id}`,
    active: true,
    availability: Object.freeze(input.unavailable ? [{
      id: `away-${input.id}`,
      startsAt: '2032-06-10T17:00:00.000Z',
      endsAt: '2032-06-10T22:00:00.000Z',
      reasonCode: 'away' as const,
    }] : []),
    eligibility: Object.freeze([{
      assignmentTypeId: 'reading',
      enabled: input.eligible ?? true,
      decidedBy: 'actor-config',
      decidedAt: '2032-01-01T00:00:00.000Z',
    }]),
  });
}

function meeting(state: MidweekMeeting['state'] = 'published'): MidweekMeeting {
  return Object.freeze({
    id: 'meeting-a',
    tenantId: 'tenant-a',
    date: '2032-06-10',
    localTime: '19:00',
    timezone: 'Europe/Lisbon',
    state,
    slots: Object.freeze([
      Object.freeze({ id: 'slot-a', position: 0, durationMinutes: 10, titleKey: 'slot.reading', partDefinitionId: 'reading' }),
    ]),
    createdAt: '2032-01-01T00:00:00.000Z',
    updatedAt: '2032-01-01T00:00:00.000Z',
  });
}

describe('C5.3 authorized PX7 adapter', () => {
  it('derives assignment facts on the server and excludes foreign-tenant people', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: FULL_READ });
    const result = buildAuthorizedMidweekRecommendation(
      context,
      { meetingId: 'meeting-a', slotId: 'slot-a', assignmentTypeId: 'browser-fake' } as never,
      {
        people: Object.freeze([
          person({ id: 'eligible' }),
          person({ id: 'not-eligible', eligible: false }),
          person({ id: 'away', unavailable: true }),
          person({ id: 'foreign', tenantId: 'tenant-b' }),
        ]),
        meetings: Object.freeze([meeting()]),
        studentAssignments: Object.freeze([]),
        nonStudentAssignments: Object.freeze([]),
      },
    );

    expect(result.contractVersion).toBe('people-recommendation-v1');
    expect(result.target.assignmentTypeId).toBe('reading');
    expect(result.target.meetingId).toBe('meeting-a');
    expect(result.target.slotId).toBe('slot-a');
    expect(result.candidates.map(item => item.personId)).toEqual(['eligible']);
    expect(result.candidates[0]?.reasons.map(item => item.code)).toEqual(expect.arrayContaining(['ELIGIBLE', 'AVAILABLE', 'NO_MEETING_CONFLICT']));
    expect(result.excluded.find(item => item.personId === 'not-eligible')?.reasons.map(item => item.code)).toContain('NOT_ELIGIBLE');
    expect(result.excluded.find(item => item.personId === 'away')?.reasons.map(item => item.code)).toContain('AWAY_DURING_MEETING');
    expect([...result.candidates, ...result.excluded].some(item => item.personId === 'foreign')).toBe(false);
  });

  it('fails closed when an evidence capability is missing', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: ['people.read', 'eligibility.read', 'schedule.read'] });
    expect(() => buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, {
      people: Object.freeze([person({ id: 'eligible' })]),
      meetings: Object.freeze([meeting()]),
      studentAssignments: Object.freeze([]),
      nonStudentAssignments: Object.freeze([]),
    })).toThrow();
  });

  it('rejects non-assignable meetings and slots without an explicit assignment type', () => {
    const context = createAccessContext({ tenantId: 'tenant-a', actorId: 'actor-a', capabilities: FULL_READ });
    const source = {
      people: Object.freeze([person({ id: 'eligible' })]),
      meetings: Object.freeze([meeting('cancelled')]),
      studentAssignments: Object.freeze([]),
      nonStudentAssignments: Object.freeze([]),
    };
    expect(() => buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, source)).toThrow('not assignable');

    const noType = Object.freeze({ ...meeting(), slots: Object.freeze([Object.freeze({ id: 'slot-a', position: 0, durationMinutes: 10, titleKey: 'slot.heading' })]) });
    expect(() => buildAuthorizedMidweekRecommendation(context, { meetingId: 'meeting-a', slotId: 'slot-a' }, { ...source, meetings: Object.freeze([noType]) })).toThrow('no explicit assignment type');
  });
});

describe('C5.3 public request contract', () => {
  it('accepts only opaque meeting and slot references', () => {
    expect(recommendationTargetFromRequest({ query: { meetingId: 'meeting-a', slotId: 'slot-a' } })).toEqual({ meetingId: 'meeting-a', slotId: 'slot-a' });
  });

  it.each(['tenantId', 'actorId', 'capabilities', 'assignmentTypeId', 'people', 'eligibility'])('rejects browser authority/fact field %s', field => {
    expect(() => recommendationTargetFromRequest({ query: { meetingId: 'meeting-a', slotId: 'slot-a', [field]: 'forged' } })).toThrow('Unknown recommendation query field');
  });

  it('rejects request bodies, duplicate query values and malformed references', () => {
    expect(() => recommendationTargetFromRequest({ query: { meetingId: 'meeting-a', slotId: 'slot-a' }, body: { tenantId: 'forged' } })).toThrow('does not accept a request body');
    expect(() => recommendationTargetFromRequest({ query: { meetingId: ['one', 'two'], slotId: 'slot-a' } })).toThrow('meetingId must be supplied once');
    expect(() => recommendationTargetFromRequest({ query: { meetingId: 'meeting a', slotId: 'slot-a' } })).toThrow('meetingId is invalid');
  });
});
