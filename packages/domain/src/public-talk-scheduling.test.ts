import { describe, expect, it } from 'vitest';
import {
  cancelPublicTalkSchedule,
  completePublicTalkSchedule,
  confirmPublicTalkSchedule,
  createPublicTalkSchedule,
  publicTalkSchedulesForSpeaker,
  publicTalkSchedulesInDateRange,
  updatePublicTalkSchedule,
} from './public-talk-scheduling';

function schedule(tenantId = 'a') {
  return createPublicTalkSchedule({
    id: 'talk-1', tenantId, weekendMeetingId: 'wm-1', talkOutlineId: 'outline-1', speakerId: 'speaker-1',
    speakerCongregationId: 'cong-2', date: '2026-08-23', localTime: '10:00', timezone: 'Europe/Lisbon',
    type: 'local', visiting: true, now: '2026-08-20T10:00:00.000Z',
  });
}

describe('public talk scheduling', () => {
  it('creates an immutable tenant-scoped draft', () => {
    const value = schedule();
    expect(value.state).toBe('draft');
    expect(value.tenantId).toBe('a');
    expect(Object.isFrozen(value)).toBe(true);
  });

  it('rejects non-boolean visiting values instead of coercing them', () => {
    expect(() => createPublicTalkSchedule({
      id: 'talk-1', tenantId: 'a', weekendMeetingId: 'wm-1', talkOutlineId: 'o1', speakerId: 's1', speakerCongregationId: 'c1',
      date: '2026-08-23', localTime: '10:00', timezone: 'UTC', type: 'local', visiting: 'false' as unknown as boolean, now: '2026-08-20T10:00:00.000Z',
    })).toThrow('visiting must be a boolean');
  });

  it('rejects the contradictory away + visiting combination', () => {
    expect(() => updatePublicTalkSchedule(schedule(), { type: 'away' }, '2026-08-21T10:00:00.000Z')).toThrow('cannot be marked as visiting');
  });

  it('enforces lifecycle transitions', () => {
    const confirmed = confirmPublicTalkSchedule(schedule(), '2026-08-21T10:00:00.000Z');
    const completed = completePublicTalkSchedule(confirmed, '2026-08-23T12:00:00.000Z');
    expect(completed.state).toBe('completed');
    expect(() => cancelPublicTalkSchedule(completed, '2026-08-24T10:00:00.000Z')).toThrow('Invalid public talk schedule transition');
  });

  it('scopes speaker queries by tenant', () => {
    const values = [schedule('a'), schedule('b')];
    expect(publicTalkSchedulesForSpeaker(values, 'a', 'speaker-1')).toHaveLength(1);
    expect(publicTalkSchedulesForSpeaker(values, 'a', 'speaker-1')[0].tenantId).toBe('a');
  });

  it('scopes date ranges by tenant and validates the range', () => {
    const values = [schedule('a'), schedule('b')];
    expect(publicTalkSchedulesInDateRange(values, 'a', '2026-08-01', '2026-08-31')).toHaveLength(1);
    expect(() => publicTalkSchedulesInDateRange(values, 'a', '2026-09-01', '2026-08-01')).toThrow('Date range must end');
  });
});


it('does not leak schedules across tenants when speaker ids coincide', () => {
  const own = schedule('tenant-a');
  const foreign = schedule('tenant-b');
  expect(publicTalkSchedulesForSpeaker([own, foreign], 'tenant-a', 'speaker-1')).toEqual([own]);
});
