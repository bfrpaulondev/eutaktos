import { describe, it, expect } from 'vitest';
import {
  createWeekendMeeting,
  publishWeekendMeeting,
  archiveWeekendMeeting,
  updateWeekendMeeting,
  assignPublicTalk,
  clearPublicTalk,
  assignWatchtowerStudy,
  assignChairman,
  assertWeekendMeetingTenant,
  filterWeekendMeetingsByTenant,
  orderWeekendMeetingsByDate,
  isWeekendMeetingLocked,
} from './weekend-meeting';
import type { WeekendMeeting } from './weekend-meeting';

// ---- Helpers ----

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';
const NOW = '2025-06-15T10:00:00.000Z';

function makeMeeting(overrides?: Partial<Parameters<typeof createWeekendMeeting>[0]>): Readonly<WeekendMeeting> {
  return createWeekendMeeting({
    id: 'meeting-1',
    tenantId: TENANT_A,
    date: '2025-07-05',
    localTime: '10:00',
    timezone: 'Europe/Lisbon',
    now: NOW,
    ...overrides,
  });
}

// ---- createWeekendMeeting ----

describe('createWeekendMeeting', () => {
  it('creates a draft meeting with correct defaults', () => {
    const m = makeMeeting();
    expect(m.id).toBe('meeting-1');
    expect(m.tenantId).toBe(TENANT_A);
    expect(m.date).toBe('2025-07-05');
    expect(m.localTime).toBe('10:00');
    expect(m.timezone).toBe('Europe/Lisbon');
    expect(m.state).toBe('draft');
    expect(m.publicTalk).toEqual({});
    expect(m.watchtowerStudy).toEqual({});
    expect(m.createdAt).toBe(NOW);
    expect(m.updatedAt).toBe(NOW);
    expect(m.locationId).toBeUndefined();
    expect(m.chairmanId).toBeUndefined();
  });

  it('creates a meeting with public talk assignment', () => {
    const m = makeMeeting({
      publicTalk: { outlineId: 'outline-1', speakerId: 'speaker-1', speakerCongregationId: 'cong-2' },
    });
    expect(m.publicTalk.outlineId).toBe('outline-1');
    expect(m.publicTalk.speakerId).toBe('speaker-1');
    expect(m.publicTalk.speakerCongregationId).toBe('cong-2');
  });

  it('creates a meeting with watchtower study assignment', () => {
    const m = makeMeeting({
      watchtowerStudy: { conductorId: 'cond-1', readerId: 'reader-1' },
    });
    expect(m.watchtowerStudy.conductorId).toBe('cond-1');
    expect(m.watchtowerStudy.readerId).toBe('reader-1');
  });

  it('creates a meeting with chairman', () => {
    const m = makeMeeting({ chairmanId: 'chair-1' });
    expect(m.chairmanId).toBe('chair-1');
  });

  it('creates a meeting with locationId', () => {
    const m = makeMeeting({ locationId: 'loc-1' });
    expect(m.locationId).toBe('loc-1');
  });

  it('freezes the returned object', () => {
    const m = makeMeeting();
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.publicTalk)).toBe(true);
    expect(Object.isFrozen(m.watchtowerStudy)).toBe(true);
  });

  // -- Validation failures --

  it('rejects missing id', () => {
    expect(() => makeMeeting({ id: '' })).toThrow('meetingId is required');
  });

  it('rejects missing tenantId', () => {
    expect(() => makeMeeting({ tenantId: '  ' })).toThrow('tenantId is required');
  });

  it('rejects invalid date format', () => {
    expect(() => makeMeeting({ date: '01/07/2025' })).toThrow('date must use YYYY-MM-DD format');
  });

  it('rejects invalid calendar date', () => {
    expect(() => makeMeeting({ date: '2025-13-01' })).toThrow('date is not a valid calendar date');
  });

  it('rejects invalid localTime format', () => {
    expect(() => makeMeeting({ localTime: '7pm' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects invalid timezone', () => {
    expect(() => makeMeeting({ timezone: 'Fake/Zone' })).toThrow('timezone must be a valid IANA timezone');
  });

  it('rejects empty now', () => {
    expect(() => makeMeeting({ now: '' })).toThrow('now is required');
  });

  it('rejects invalid ISO instant for now', () => {
    expect(() => makeMeeting({ now: 'not-a-date' })).toThrow('Invalid ISO date');
  });

  it('rejects empty locationId', () => {
    expect(() => makeMeeting({ locationId: '  ' })).toThrow('locationId is required');
  });

  it('rejects empty chairmanId', () => {
    expect(() => makeMeeting({ chairmanId: '  ' })).toThrow('chairmanId is required');
  });

  // -- Leap year / DST / edge dates --

  it('accepts a leap year date', () => {
    const m = makeMeeting({ date: '2024-02-29' });
    expect(m.date).toBe('2024-02-29');
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(() => makeMeeting({ date: '2025-02-29' })).toThrow('date is not a valid calendar date');
  });

  it('accepts a date on DST transition day', () => {
    // 2025-10-26 is a DST transition in Europe/Lisbon
    const m = makeMeeting({ date: '2025-10-26', timezone: 'Europe/Lisbon' });
    expect(m.date).toBe('2025-10-26');
  });

  it('accepts a date at year boundary', () => {
    const m = makeMeeting({ date: '2025-12-31' });
    expect(m.date).toBe('2025-12-31');
  });

  it('accepts Jan 1', () => {
    const m = makeMeeting({ date: '2025-01-01' });
    expect(m.date).toBe('2025-01-01');
  });

  it('rejects Feb 30', () => {
    expect(() => makeMeeting({ date: '2025-02-30' })).toThrow('date is not a valid calendar date');
  });

  it('rejects date with month 00', () => {
    expect(() => makeMeeting({ date: '2025-00-01' })).toThrow('date is not a valid calendar date');
  });

  it('rejects date with day 00', () => {
    expect(() => makeMeeting({ date: '2025-01-00' })).toThrow('date is not a valid calendar date');
  });

  it('rejects time 24:00', () => {
    expect(() => makeMeeting({ localTime: '24:00' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects time 25:00', () => {
    expect(() => makeMeeting({ localTime: '25:00' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects time 09:60', () => {
    expect(() => makeMeeting({ localTime: '09:60' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects time with single digit hour', () => {
    expect(() => makeMeeting({ localTime: '9:00' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects date 2024-13-01', () => {
    expect(() => makeMeeting({ date: '2024-13-01' })).toThrow('date is not a valid calendar date');
  });

  // -- Adversarial / malformed inputs --

  it('rejects date with extra characters', () => {
    expect(() => makeMeeting({ date: '2025-01-01extra' })).toThrow('date must use YYYY-MM-DD format');
  });

  it('rejects date with slashes', () => {
    expect(() => makeMeeting({ date: '2025/01/01' })).toThrow('date must use YYYY-MM-DD format');
  });

  it('rejects timezone that is empty string', () => {
    expect(() => makeMeeting({ timezone: '' })).toThrow('timezone is required');
  });

  it('rejects localTime with seconds', () => {
    expect(() => makeMeeting({ localTime: '10:00:00' })).toThrow('localTime must use 24-hour HH:mm format');
  });

  it('rejects publicTalk with empty outlineId', () => {
    expect(() => makeMeeting({ publicTalk: { outlineId: '' } })).toThrow('outlineId is required');
  });

  it('rejects watchtowerStudy with empty conductorId', () => {
    expect(() => makeMeeting({ watchtowerStudy: { conductorId: '', readerId: 'r1' } })).toThrow('conductorId is required');
  });

  it('rejects watchtowerStudy with empty readerId', () => {
    expect(() => makeMeeting({ watchtowerStudy: { conductorId: 'c1', readerId: '' } })).toThrow('readerId is required');
  });
});

// ---- Lifecycle ----

describe('publishWeekendMeeting', () => {
  it('transitions draft → published', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, '2025-06-16T09:00:00Z');
    expect(published.state).toBe('published');
    expect(published.updatedAt).toBe('2025-06-16T09:00:00Z');
    expect(published.id).toBe(m.id);
  });

  it('rejects publishing an already published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => publishWeekendMeeting(published, NOW)).toThrow("Cannot publish meeting in 'published' state");
  });

  it('rejects publishing an archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => publishWeekendMeeting(archived, NOW)).toThrow("Cannot publish meeting in 'archived' state");
  });

  it('rejects invalid now timestamp', () => {
    const m = makeMeeting();
    expect(() => publishWeekendMeeting(m, 'bad')).toThrow('Invalid ISO date');
  });
});

describe('archiveWeekendMeeting', () => {
  it('transitions published → archived', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, '2025-06-17T09:00:00Z');
    expect(archived.state).toBe('archived');
    expect(archived.updatedAt).toBe('2025-06-17T09:00:00Z');
  });

  it('rejects archiving a draft meeting', () => {
    const m = makeMeeting();
    expect(() => archiveWeekendMeeting(m, NOW)).toThrow("Cannot archive meeting in 'draft' state");
  });

  it('rejects archiving an already archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => archiveWeekendMeeting(archived, NOW)).toThrow("Cannot archive meeting in 'archived' state");
  });

  it('rejects invalid now timestamp', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => archiveWeekendMeeting(published, 'x')).toThrow('Invalid ISO date');
  });
});

// ---- updateWeekendMeeting ----

describe('updateWeekendMeeting', () => {
  it('updates date on a draft meeting', () => {
    const m = makeMeeting();
    const updated = updateWeekendMeeting(m, { date: '2025-07-12' }, '2025-06-16T09:00:00Z');
    expect(updated.date).toBe('2025-07-12');
    expect(updated.updatedAt).toBe('2025-06-16T09:00:00Z');
  });

  it('updates localTime on a draft meeting', () => {
    const m = makeMeeting();
    const updated = updateWeekendMeeting(m, { localTime: '14:30' }, NOW);
    expect(updated.localTime).toBe('14:30');
  });

  it('updates timezone on a draft meeting', () => {
    const m = makeMeeting();
    const updated = updateWeekendMeeting(m, { timezone: 'America/New_York' }, NOW);
    expect(updated.timezone).toBe('America/New_York');
  });

  it('clears locationId with null', () => {
    const m = makeMeeting({ locationId: 'loc-1' });
    const updated = updateWeekendMeeting(m, { locationId: null }, NOW);
    expect(updated.locationId).toBeUndefined();
  });

  it('sets locationId with a new value', () => {
    const m = makeMeeting();
    const updated = updateWeekendMeeting(m, { locationId: 'loc-2' }, NOW);
    expect(updated.locationId).toBe('loc-2');
  });

  it('rejects update on published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => updateWeekendMeeting(published, { date: '2025-07-12' }, NOW)).toThrow("Cannot update a 'published' meeting");
  });

  it('rejects update on archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => updateWeekendMeeting(archived, { date: '2025-07-12' }, NOW)).toThrow("Cannot update a 'archived' meeting");
  });

  it('preserves publicTalk when updating other fields', () => {
    const m = makeMeeting({ publicTalk: { outlineId: 'o1' } });
    const updated = updateWeekendMeeting(m, { date: '2025-07-12' }, NOW);
    expect(updated.publicTalk.outlineId).toBe('o1');
  });

  it('rejects invalid date in changes', () => {
    const m = makeMeeting();
    expect(() => updateWeekendMeeting(m, { date: 'bad' }, NOW)).toThrow('date must use YYYY-MM-DD format');
  });

  it('rejects invalid time in changes', () => {
    const m = makeMeeting();
    expect(() => updateWeekendMeeting(m, { localTime: 'abc' }, NOW)).toThrow('localTime must use 24-hour HH:mm format');
  });
});

// ---- assignPublicTalk ----

describe('assignPublicTalk', () => {
  it('assigns outline only', () => {
    const m = makeMeeting();
    const updated = assignPublicTalk(m, 'outline-1', NOW);
    expect(updated.publicTalk.outlineId).toBe('outline-1');
    expect(updated.publicTalk.speakerId).toBeUndefined();
    expect(updated.publicTalk.speakerCongregationId).toBeUndefined();
  });

  it('assigns outline and speaker', () => {
    const m = makeMeeting();
    const updated = assignPublicTalk(m, 'outline-1', NOW, 'speaker-1');
    expect(updated.publicTalk.outlineId).toBe('outline-1');
    expect(updated.publicTalk.speakerId).toBe('speaker-1');
  });

  it('assigns all public talk fields', () => {
    const m = makeMeeting();
    const updated = assignPublicTalk(m, 'outline-1', NOW, 'speaker-1', 'cong-2');
    expect(updated.publicTalk).toEqual({
      outlineId: 'outline-1',
      speakerId: 'speaker-1',
      speakerCongregationId: 'cong-2',
    });
  });

  it('replaces existing public talk', () => {
    const m = makeMeeting({ publicTalk: { outlineId: 'old', speakerId: 'old-speaker' } });
    const updated = assignPublicTalk(m, 'new-outline', NOW, 'new-speaker', 'cong-3');
    expect(updated.publicTalk.outlineId).toBe('new-outline');
    expect(updated.publicTalk.speakerId).toBe('new-speaker');
    expect(updated.publicTalk.speakerCongregationId).toBe('cong-3');
  });

  it('freezes publicTalk', () => {
    const m = makeMeeting();
    const updated = assignPublicTalk(m, 'o1', NOW, 's1', 'c1');
    expect(Object.isFrozen(updated.publicTalk)).toBe(true);
  });

  it('rejects empty outlineId', () => {
    const m = makeMeeting();
    expect(() => assignPublicTalk(m, '', NOW)).toThrow('outlineId is required');
  });

  it('rejects whitespace-only outlineId', () => {
    const m = makeMeeting();
    expect(() => assignPublicTalk(m, '   ', NOW)).toThrow('outlineId is required');
  });

  it('rejects assignment on published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => assignPublicTalk(published, 'o1', NOW, 's1', 'c1')).toThrow("Cannot modify a 'published' meeting");
  });

  it('rejects assignment on archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => assignPublicTalk(archived, 'o1', NOW, 's1', 'c1')).toThrow("Cannot modify a 'archived' meeting");
  });

  it('rejects invalid now', () => {
    const m = makeMeeting();
    expect(() => assignPublicTalk(m, 'o1', 'bad')).toThrow('Invalid ISO date');
  });

  it('rejects empty speakerId when provided', () => {
    const m = makeMeeting();
    expect(() => assignPublicTalk(m, 'o1', NOW, '  ')).toThrow('speakerId is required');
  });

  it('rejects empty speakerCongregationId when provided', () => {
    const m = makeMeeting();
    expect(() => assignPublicTalk(m, 'o1', NOW, 's1', '  ')).toThrow('speakerCongregationId is required');
  });
});

// ---- clearPublicTalk ----

describe('clearPublicTalk', () => {
  it('clears all public talk fields', () => {
    const m = makeMeeting({ publicTalk: { outlineId: 'o1', speakerId: 's1', speakerCongregationId: 'c1' } });
    const updated = clearPublicTalk(m, NOW);
    expect(updated.publicTalk).toEqual({});
  });

  it('freezes the cleared publicTalk', () => {
    const m = makeMeeting({ publicTalk: { outlineId: 'o1' } });
    const updated = clearPublicTalk(m, NOW);
    expect(Object.isFrozen(updated.publicTalk)).toBe(true);
  });

  it('rejects clearing on published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => clearPublicTalk(published, NOW)).toThrow("Cannot modify a 'published' meeting");
  });

  it('rejects clearing on archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => clearPublicTalk(archived, NOW)).toThrow("Cannot modify a 'archived' meeting");
  });

  it('rejects invalid now', () => {
    const m = makeMeeting();
    expect(() => clearPublicTalk(m, 'bad')).toThrow('Invalid ISO date');
  });
});

// ---- assignWatchtowerStudy ----

describe('assignWatchtowerStudy', () => {
  it('assigns conductor and reader', () => {
    const m = makeMeeting();
    const updated = assignWatchtowerStudy(m, 'cond-1', 'reader-1', NOW);
    expect(updated.watchtowerStudy.conductorId).toBe('cond-1');
    expect(updated.watchtowerStudy.readerId).toBe('reader-1');
  });

  it('replaces existing watchtower study assignment', () => {
    const m = makeMeeting({ watchtowerStudy: { conductorId: 'old-c', readerId: 'old-r' } });
    const updated = assignWatchtowerStudy(m, 'new-c', 'new-r', NOW);
    expect(updated.watchtowerStudy.conductorId).toBe('new-c');
    expect(updated.watchtowerStudy.readerId).toBe('new-r');
  });

  it('freezes watchtowerStudy', () => {
    const m = makeMeeting();
    const updated = assignWatchtowerStudy(m, 'c1', 'r1', NOW);
    expect(Object.isFrozen(updated.watchtowerStudy)).toBe(true);
  });

  it('rejects empty conductorId', () => {
    const m = makeMeeting();
    expect(() => assignWatchtowerStudy(m, '', 'r1', NOW)).toThrow('conductorId is required');
  });

  it('rejects empty readerId', () => {
    const m = makeMeeting();
    expect(() => assignWatchtowerStudy(m, 'c1', '', NOW)).toThrow('readerId is required');
  });

  it('rejects whitespace conductorId', () => {
    const m = makeMeeting();
    expect(() => assignWatchtowerStudy(m, '   ', 'r1', NOW)).toThrow('conductorId is required');
  });

  it('rejects assignment on published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => assignWatchtowerStudy(published, 'c1', 'r1', NOW)).toThrow("Cannot modify a 'published' meeting");
  });

  it('rejects assignment on archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => assignWatchtowerStudy(archived, 'c1', 'r1', NOW)).toThrow("Cannot modify a 'archived' meeting");
  });

  it('rejects invalid now', () => {
    const m = makeMeeting();
    expect(() => assignWatchtowerStudy(m, 'c1', 'r1', 'bad')).toThrow('Invalid ISO date');
  });
});

// ---- assignChairman ----

describe('assignChairman', () => {
  it('assigns a chairman', () => {
    const m = makeMeeting();
    const updated = assignChairman(m, 'chair-1', NOW);
    expect(updated.chairmanId).toBe('chair-1');
  });

  it('replaces existing chairman', () => {
    const m = makeMeeting({ chairmanId: 'old-chair' });
    const updated = assignChairman(m, 'new-chair', NOW);
    expect(updated.chairmanId).toBe('new-chair');
  });

  it('rejects empty personId', () => {
    const m = makeMeeting();
    expect(() => assignChairman(m, '', NOW)).toThrow('personId is required');
  });

  it('rejects whitespace personId', () => {
    const m = makeMeeting();
    expect(() => assignChairman(m, '   ', NOW)).toThrow('personId is required');
  });

  it('rejects assignment on published meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(() => assignChairman(published, 'c1', NOW)).toThrow("Cannot modify a 'published' meeting");
  });

  it('rejects assignment on archived meeting', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(() => assignChairman(archived, 'c1', NOW)).toThrow("Cannot modify a 'archived' meeting");
  });

  it('rejects invalid now', () => {
    const m = makeMeeting();
    expect(() => assignChairman(m, 'c1', 'bad')).toThrow('Invalid ISO date');
  });
});

// ---- Tenant isolation ----

describe('assertWeekendMeetingTenant', () => {
  it('does not throw for matching tenant', () => {
    const m = makeMeeting({ tenantId: TENANT_A });
    expect(() => assertWeekendMeetingTenant(m, TENANT_A)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    const m = makeMeeting({ tenantId: TENANT_A });
    expect(() => assertWeekendMeetingTenant(m, TENANT_B)).toThrow('Cross-tenant weekend meeting access denied');
  });

  it('throws for empty tenant id in meeting', () => {
    expect(() => makeMeeting({ tenantId: '  ' })).toThrow('tenantId is required');
  });
});

describe('filterWeekendMeetingsByTenant', () => {
  it('filters to only matching tenant', () => {
    const m1 = makeMeeting({ id: 'm1', tenantId: TENANT_A });
    const m2 = makeMeeting({ id: 'm2', tenantId: TENANT_B, date: '2025-07-06' });
    const m3 = makeMeeting({ id: 'm3', tenantId: TENANT_A, date: '2025-07-12' });
    const result = filterWeekendMeetingsByTenant([m1, m2, m3], TENANT_A);
    expect(result).toHaveLength(2);
    expect(result.every(m => m.tenantId === TENANT_A)).toBe(true);
  });

  it('returns empty array when no matches', () => {
    const m1 = makeMeeting({ id: 'm1', tenantId: TENANT_A });
    const result = filterWeekendMeetingsByTenant([m1], TENANT_B);
    expect(result).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    const result = filterWeekendMeetingsByTenant([], TENANT_A);
    expect(result).toHaveLength(0);
  });
});

// ---- Ordering ----

describe('orderWeekendMeetingsByDate', () => {
  it('sorts meetings by date ascending', () => {
    const m1 = makeMeeting({ id: 'm1', date: '2025-07-12' });
    const m2 = makeMeeting({ id: 'm2', date: '2025-07-05' });
    const m3 = makeMeeting({ id: 'm3', date: '2025-07-19' });
    const result = orderWeekendMeetingsByDate([m1, m2, m3]);
    expect(result.map(m => m.id)).toEqual(['m2', 'm1', 'm3']);
  });

  it('sorts by id for same date', () => {
    const m1 = makeMeeting({ id: 'm-b', date: '2025-07-05' });
    const m2 = makeMeeting({ id: 'm-a', date: '2025-07-05' });
    const result = orderWeekendMeetingsByDate([m1, m2]);
    expect(result.map(m => m.id)).toEqual(['m-a', 'm-b']);
  });

  it('does not mutate original array', () => {
    const m1 = makeMeeting({ id: 'm1', date: '2025-07-12' });
    const m2 = makeMeeting({ id: 'm2', date: '2025-07-05' });
    const original = [m1, m2];
    orderWeekendMeetingsByDate(original);
    expect(original[0].id).toBe('m1');
  });

  it('returns empty for empty input', () => {
    const result = orderWeekendMeetingsByDate([]);
    expect(result).toHaveLength(0);
  });
});

// ---- Immutability ----

describe('immutability', () => {
  it('meeting is frozen after creation', () => {
    const m = makeMeeting();
    expect(Object.isFrozen(m)).toBe(true);
  });

  it('publicTalk is frozen', () => {
    const m = makeMeeting({ publicTalk: { outlineId: 'o1' } });
    expect(Object.isFrozen(m.publicTalk)).toBe(true);
  });

  it('watchtowerStudy is frozen', () => {
    const m = makeMeeting({ watchtowerStudy: { conductorId: 'c1', readerId: 'r1' } });
    expect(Object.isFrozen(m.watchtowerStudy)).toBe(true);
  });

  it('published meeting is frozen', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(Object.isFrozen(published)).toBe(true);
  });

  it('archived meeting is frozen', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    const archived = archiveWeekendMeeting(published, NOW);
    expect(Object.isFrozen(archived)).toBe(true);
  });

  it('updated meeting is frozen', () => {
    const m = makeMeeting();
    const updated = updateWeekendMeeting(m, { date: '2025-07-12' }, NOW);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('cannot mutate frozen meeting properties', () => {
    const m = makeMeeting();
    expect(() => {
      (m as any).date = '2099-01-01';
    }).toThrow();
  });
});

// ---- isWeekendMeetingLocked ----

describe('isWeekendMeetingLocked', () => {
  it('returns false for draft', () => {
    expect(isWeekendMeetingLocked(makeMeeting())).toBe(false);
  });

  it('returns true for published', () => {
    const m = makeMeeting();
    expect(isWeekendMeetingLocked(publishWeekendMeeting(m, NOW))).toBe(true);
  });

  it('returns true for archived', () => {
    const m = makeMeeting();
    const published = publishWeekendMeeting(m, NOW);
    expect(isWeekendMeetingLocked(archiveWeekendMeeting(published, NOW))).toBe(true);
  });
});

// ---- Full lifecycle integration ----

describe('full lifecycle', () => {
  it('create → assign → publish → archive with full assignments', () => {
    let m = makeMeeting({ date: '2025-07-05' });
    m = assignPublicTalk(m, 'outline-1', '2025-06-16T09:00:00Z', 'speaker-1', 'cong-2');
    m = assignWatchtowerStudy(m, 'cond-1', 'reader-1', '2025-06-16T09:01:00Z');
    m = assignChairman(m, 'chair-1', '2025-06-16T09:02:00Z');
    m = updateWeekendMeeting(m, { locationId: 'loc-1' }, '2025-06-16T09:03:00Z');
    m = publishWeekendMeeting(m, '2025-06-16T09:04:00Z');

    expect(m.state).toBe('published');
    expect(m.publicTalk.outlineId).toBe('outline-1');
    expect(m.watchtowerStudy.conductorId).toBe('cond-1');
    expect(m.chairmanId).toBe('chair-1');
    expect(m.locationId).toBe('loc-1');

    m = archiveWeekendMeeting(m, '2025-06-17T09:00:00Z');
    expect(m.state).toBe('archived');
  });

  it('cannot modify after publish', () => {
    let m = makeMeeting();
    m = publishWeekendMeeting(m, NOW);
    expect(() => updateWeekendMeeting(m, { date: '2025-07-12' }, NOW)).toThrow();
    expect(() => assignPublicTalk(m, 'o1', NOW)).toThrow();
    expect(() => clearPublicTalk(m, NOW)).toThrow();
    expect(() => assignWatchtowerStudy(m, 'c1', 'r1', NOW)).toThrow();
    expect(() => assignChairman(m, 'c1', NOW)).toThrow();
  });
});

// ---- Adversarial tests ----

describe('adversarial inputs', () => {
  it('rejects non-string id (number)', () => {
    expect(() => createWeekendMeeting({
      id: 42 as any, tenantId: TENANT_A, date: '2025-07-05', localTime: '10:00', timezone: 'UTC', now: NOW,
    })).toThrow('meetingId must be a string');
  });

  it('rejects non-string date (number)', () => {
    expect(() => createWeekendMeeting({
      id: 'm1', tenantId: TENANT_A, date: 12345 as any, localTime: '10:00', timezone: 'UTC', now: NOW,
    })).toThrow('date must be a string');
  });

  it('rejects null id', () => {
    expect(() => createWeekendMeeting({
      id: null as any, tenantId: TENANT_A, date: '2025-07-05', localTime: '10:00', timezone: 'UTC', now: NOW,
    })).toThrow('meetingId must be a string');
  });

  it('rejects undefined id', () => {
    expect(() => createWeekendMeeting({
      id: undefined as any, tenantId: TENANT_A, date: '2025-07-05', localTime: '10:00', timezone: 'UTC', now: NOW,
    })).toThrow('meetingId must be a string');
  });

  it('handles timezone America/Sao_Paulo with DST date', () => {
    // 2025-02-16 is DST end in Brazil
    const m = makeMeeting({ date: '2025-02-16', timezone: 'America/Sao_Paulo' });
    expect(m.timezone).toBe('America/Sao_Paulo');
  });

  it('handles timezone Australia/Sydney with DST date', () => {
    // 2025-04-06 is DST end in Sydney
    const m = makeMeeting({ date: '2025-04-06', timezone: 'Australia/Sydney' });
    expect(m.timezone).toBe('Australia/Sydney');
  });

  it('rejects date 0000-01-01 (year 0)', () => {
    // Date.parse of '0000-01-01T00:00:00Z' may be NaN
    expect(() => makeMeeting({ date: '0000-01-01' })).toThrow();
  });

  it('rejects date with negative year', () => {
    expect(() => makeMeeting({ date: '-0001-01-01' })).toThrow('date must use YYYY-MM-DD format');
  });

  it('accepts time 00:00 as valid 24-hour format', () => {
    const m = makeMeeting({ localTime: '00:00' });
    expect(m.localTime).toBe('00:00');
  });

  it('rejects time with letters', () => {
    expect(() => makeMeeting({ localTime: 'ab:cd' })).toThrow('localTime must use 24-hour HH:mm format');
  });
});
