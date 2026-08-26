import type { MidweekOverviewDto } from './midweekApi';
import type { PersonProfileData } from './personProfileData';
import {
  assignmentEvidenceForPerson,
  assignmentIsUpcoming,
  compareAssignmentsByInstant,
  currentAvailability,
  isActiveResponsibility,
  isCurrentProfileRequest,
  meetingStartMs,
  nextAvailability,
  PersonProfileLoadError,
  sectionIsPartial,
  sectionMessage,
} from './personProfileData';

const overview: MidweekOverviewDto = {
  meetings: [
    { id: 'meeting-new-york', date: '2032-06-10', localTime: '19:30', timezone: 'America/New_York', state: 'published', slots: [] },
    { id: 'meeting-lisbon', date: '2032-06-12', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'published', slots: [] },
  ],
  studentAssignments: [
    { id: 'completed-student', meetingId: 'meeting-new-york', slotId: 'slot-1', studentId: 'person-1', studentDisplayName: 'Sensitive display name', assistantId: null, assistantDisplayName: null, state: 'completed' },
    { id: 'assistant-assignment', meetingId: 'meeting-lisbon', slotId: 'slot-2', studentId: 'person-2', studentDisplayName: 'Another person', assistantId: 'person-1', assistantDisplayName: 'Sensitive display name', state: 'assigned' },
  ],
  nonStudentAssignments: [
    { id: 'cancelled-non-student', meetingId: 'meeting-lisbon', slotId: 'slot-3', personId: 'person-1', personDisplayName: 'Sensitive display name', role: 'chairman', state: 'cancelled' },
  ],
};

function readyData(): PersonProfileData {
  const ready = <T,>(value: T) => ({ status: 'ready' as const, value });
  return {
    person: { id: 'person-1', displayName: 'Ana Martins', active: true },
    session: { actorId: 'actor-1', capabilities: ['people.read'] },
    availability: ready([]),
    eligibility: ready([]),
    contacts: ready([]),
    groups: ready([]),
    households: ready([]),
    responsibilities: ready([]),
    assignments: ready(overview),
    history: ready([]),
  };
}

describe('person profile evidence', () => {
  it('keeps assignment state factual, includes assistant participation and never exposes display names in the evidence projection', () => {
    const evidence = assignmentEvidenceForPerson(overview, 'person-1');

    expect(evidence).toEqual([
      expect.objectContaining({ id: 'completed-student', state: 'completed', role: 'student', timezone: 'America/New_York' }),
      expect.objectContaining({ id: 'assistant-assignment', state: 'assigned', role: 'assistant' }),
      expect.objectContaining({ id: 'cancelled-non-student', state: 'cancelled', role: 'chairman' }),
    ]);
    expect(JSON.stringify(evidence)).not.toContain('Sensitive display name');
  });

  it('uses meeting date, local time and timezone instead of the civil date alone for upcoming assignments', () => {
    const sameDayPast = { id: 'past', state: 'assigned' as const, date: '2032-06-10', localTime: '10:00', timezone: 'America/New_York', role: 'student' };
    const sameDayFuture = { id: 'future', state: 'assigned' as const, date: '2032-06-10', localTime: '20:00', timezone: 'America/New_York', role: 'student' };
    const now = new Date('2032-06-10T19:00:00.000Z'); // 15:00 in New York

    expect(assignmentIsUpcoming(sameDayPast, now)).toBe(false);
    expect(assignmentIsUpcoming(sameDayFuture, now)).toBe(true);
  });

  it('uses the scheduling earliest-match rule for an ambiguous Europe/Lisbon DST local time', () => {
    const ambiguous = { id: 'dst', state: 'assigned' as const, date: '2026-10-25', localTime: '01:30', timezone: 'Europe/Lisbon', role: 'student' };
    expect(meetingStartMs(ambiguous.date, ambiguous.localTime, ambiguous.timezone)).toBe(Date.parse('2026-10-25T00:30:00.000Z'));
    // At 01:00Z Lisbon has fallen back to 01:00 local. A civil-clock-only comparison would incorrectly call 01:30 upcoming.
    expect(assignmentIsUpcoming(ambiguous, new Date('2026-10-25T01:00:00.000Z'))).toBe(false);
  });

  it('fails closed for invalid or non-existent meeting civil times', () => {
    const invalid = { id: 'bad', state: 'assigned' as const, date: '2026-03-29', localTime: '01:30', timezone: 'Europe/Lisbon', role: 'student' };
    // 01:30 does not exist when Lisbon jumps from 01:00 UTC to 02:00 WEST on this date.
    expect(meetingStartMs(invalid.date, invalid.localTime, invalid.timezone)).toBeUndefined();
    expect(assignmentIsUpcoming(invalid, new Date('2026-03-28T00:00:00.000Z'))).toBe(false);
    expect(meetingStartMs('2032-06-10', '19:30', 'Invalid/Timezone')).toBeUndefined();
  });

  it('orders assignment evidence by resolved instant rather than local-time text', () => {
    const earlier = { id: 'earlier', state: 'assigned' as const, date: '2032-06-10', localTime: '19:00', timezone: 'Europe/Lisbon', role: 'student' };
    const later = { id: 'later', state: 'assigned' as const, date: '2032-06-10', localTime: '19:00', timezone: 'America/New_York', role: 'student' };
    expect([later, earlier].sort(compareAssignmentsByInstant).map(item => item.id)).toEqual(['earlier', 'later']);
  });

  it('treats every active explicit availability reason as unavailable and keeps future periods chronological', () => {
    const now = new Date('2032-06-10T12:00:00.000Z');
    const periods = [
      { id: 'future', startsAt: '2032-06-20T00:00:00.000Z', endsAt: '2032-06-21T00:00:00.000Z', reasonCode: 'other' as const },
      { id: 'current', startsAt: '2032-06-10T00:00:00.000Z', endsAt: '2032-06-11T00:00:00.000Z', reasonCode: 'unavailable' as const },
      { id: 'later', startsAt: '2032-06-23T00:00:00.000Z', endsAt: '2032-06-24T00:00:00.000Z', reasonCode: 'away' as const },
    ];

    expect(currentAvailability(periods, now)?.id).toBe('current');
    expect(nextAvailability(periods, now)?.id).toBe('future');
  });

  it('filters responsibilities using the canonical half-open active interval and rejects invalid timestamps', () => {
    const now = new Date('2032-06-10T12:00:00.000Z');
    expect(isActiveResponsibility({ id: 'active', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: '2032-06-01T00:00:00.000Z' }, now)).toBe(true);
    expect(isActiveResponsibility({ id: 'ended', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: '2032-06-01T00:00:00.000Z', endsAt: '2032-06-09T00:00:00.000Z' }, now)).toBe(false);
    expect(isActiveResponsibility({ id: 'future', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: '2032-06-11T00:00:00.000Z' }, now)).toBe(false);
    expect(isActiveResponsibility({ id: 'ends-now', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: '2032-06-01T00:00:00.000Z', endsAt: now.toISOString() }, now)).toBe(false);
    expect(isActiveResponsibility({ id: 'invalid-start', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: 'not-a-date' }, now)).toBe(false);
    expect(isActiveResponsibility({ id: 'invalid-end', personId: 'person-1', responsibilityKey: 'coordinator', startsAt: '2032-06-01T00:00:00.000Z', endsAt: 'not-a-date' }, now)).toBe(false);
  });
});

describe('person profile async, authorization and partial-data states', () => {
  it('accepts only the latest non-aborted response', () => {
    expect(isCurrentProfileRequest(3, 3, false)).toBe(true);
    expect(isCurrentProfileRequest(2, 3, false)).toBe(false);
    expect(isCurrentProfileRequest(3, 3, true)).toBe(false);
  });

  it('identifies partial data and surfaces authorization states without data fallback', () => {
    const data = readyData();
    expect(sectionIsPartial(data)).toBe(false);

    const partial: PersonProfileData = { ...data, contacts: { status: 'blocked', reason: 'forbidden' } };
    expect(sectionIsPartial(partial)).toBe(true);
    expect(sectionMessage(partial.contacts)).toBe('forbidden');
    expect(sectionMessage({ status: 'blocked', reason: 'unauthenticated' })).toBe('unauthenticated');
    expect(sectionMessage({ status: 'unavailable', reason: 'unavailable' })).toBe('unavailable');
  });

  it('keeps structured load failures distinct for 401, 403, not-found and retry flows', () => {
    expect(new PersonProfileLoadError('unauthenticated', 'sign in').kind).toBe('unauthenticated');
    expect(new PersonProfileLoadError('forbidden', 'denied').kind).toBe('forbidden');
    expect(new PersonProfileLoadError('not-found', 'missing').kind).toBe('not-found');
    expect(new PersonProfileLoadError('retryable', 'retry').kind).toBe('retryable');
  });
});


describe('person profile composition API', () => {
  function dependencies(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      people: { list: vi.fn(async () => [{ id: 'person-1', displayName: 'Ana Martins', active: true }]) },
      session: { current: vi.fn(async () => ({ actorId: 'actor-1', capabilities: ['people.read', 'audit.read'] as never })) },
      availability: { list: vi.fn(async () => []) },
      eligibility: { list: vi.fn(async () => []) },
      contacts: { list: vi.fn(async () => []) },
      groups: { list: vi.fn(async () => []) },
      households: { list: vi.fn(async () => []) },
      responsibilities: { list: vi.fn(async () => []) },
      assignments: { overview: vi.fn(async () => overview) },
      history: { list: vi.fn(async () => []) },
      ...overrides,
    } as never;
  }

  it('loads only real API sections, represents a forbidden contacts section as blocked, and preserves available data', async () => {
    const { createPersonProfileDataApi } = await import('./personProfileData');
    const api = createPersonProfileDataApi(dependencies({ contacts: { list: vi.fn(async () => { throw new Error('Forbidden (403)'); }) } }));

    const data = await api.load('person-1');

    expect(data.person).toEqual({ id: 'person-1', displayName: 'Ana Martins', active: true });
    expect(data.contacts).toEqual({ status: 'blocked', reason: 'forbidden' });
    expect(data.availability).toEqual({ status: 'ready', value: [] });
    expect(data.history).toEqual({ status: 'ready', value: [] });
  });

  it('does not request history when the session lacks audit.read and reports it as blocked', async () => {
    const { createPersonProfileDataApi } = await import('./personProfileData');
    const history = { list: vi.fn(async () => []) };
    const api = createPersonProfileDataApi(dependencies({ session: { current: vi.fn(async () => ({ actorId: 'actor-1', capabilities: ['people.read'] as never })) }, history }));

    const data = await api.load('person-1');

    expect(data.history).toEqual({ status: 'blocked', reason: 'forbidden' });
    expect(history.list).not.toHaveBeenCalled();
  });

  it.each([
    ['unauthenticated', new Error('Unauthorized (401)')],
    ['forbidden', new Error('Forbidden (403)')],
    ['retryable', new Error('People API request failed (503)')],
  ] as const)('classifies primary %s failures', async (kind, failure) => {
    const { createPersonProfileDataApi } = await import('./personProfileData');
    const api = createPersonProfileDataApi(dependencies({ people: { list: vi.fn(async () => { throw failure; }) } }));

    await expect(api.load('person-1')).rejects.toMatchObject({ kind });
  });

  it('reports a person absent from the authorized People list as not-found without querying sensitive sections', async () => {
    const { createPersonProfileDataApi } = await import('./personProfileData');
    const contacts = { list: vi.fn(async () => []) };
    const api = createPersonProfileDataApi(dependencies({ people: { list: vi.fn(async () => []) }, contacts }));

    await expect(api.load('missing-person')).rejects.toMatchObject({ kind: 'not-found' });
    expect(contacts.list).not.toHaveBeenCalled();
  });
});
