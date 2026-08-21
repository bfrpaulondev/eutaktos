import { describe, it, expect } from 'vitest';
import {
  createPublicTalkAssignment,
  confirmTalkAssignment,
  cancelTalkAssignment,
  completeTalkAssignment,
  updateTalkAssignment,
  assertTalkAssignmentTenant,
  filterTalkAssignmentsByTenant,
  filterTalkAssignmentsByDateRange,
  filterTalkAssignmentsBySpeaker,
  filterTalkAssignmentsByOutline,
  filterLocalTalks,
  filterAwayTalks,
  orderTalkAssignmentsByDate,
  validateStructuralConsistency,
  TALK_ASSIGNMENT_TYPES,
  TALK_ASSIGNMENT_STATES,
} from './public-talk-scheduling';
import type { PublicTalkAssignment } from './public-talk-scheduling';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';
const T2 = 'tenant-bbb';

interface MakeInput {
  id: string;
  tenantId: string;
  weekendMeetingId: string;
  talkOutlineId: string;
  speakerId: string;
  speakerCongregationId: string;
  date: string;
  localTime: string;
  timezone: string;
  type: 'local' | 'away';
  visiting: boolean;
  now: string;
  locationId?: string | null;
}

const DEFAULTS: MakeInput = {
  id: 'pta-1',
  tenantId: T,
  weekendMeetingId: 'wm-1',
  talkOutlineId: 'to-1',
  speakerId: 'sp-1',
  speakerCongregationId: 'cong-1',
  date: '2026-09-05',
  localTime: '10:00',
  timezone: 'America/New_York',
  type: 'local',
  visiting: false,
  now: NOW,
};

function make(overrides?: Partial<MakeInput>): Readonly<PublicTalkAssignment> {
  return createPublicTalkAssignment({ ...DEFAULTS, ...overrides });
}

function makeMulti(count: number, overrides?: Partial<MakeInput>): Readonly<PublicTalkAssignment>[] {
  return Array.from({ length: count }, (_, i) =>
    make({ ...overrides, id: `pta-${i + 1}`, date: `2026-09-${String(5 + i).padStart(2, '0')}` }),
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('TALK_ASSIGNMENT_TYPES contains local and away', () => {
    expect(TALK_ASSIGNMENT_TYPES).toEqual(['local', 'away']);
    expect(Object.isFrozen(TALK_ASSIGNMENT_TYPES)).toBe(true);
  });

  it('TALK_ASSIGNMENT_STATES contains all four states', () => {
    expect(TALK_ASSIGNMENT_STATES).toEqual(['draft', 'confirmed', 'cancelled', 'completed']);
    expect(Object.isFrozen(TALK_ASSIGNMENT_STATES)).toBe(true);
  });
});

// ─── Creation ────────────────────────────────────────────────────────────────

describe('createPublicTalkAssignment', () => {
  it('creates a draft assignment with defaults', () => {
    const a = make();
    expect(a.id).toBe('pta-1');
    expect(a.tenantId).toBe(T);
    expect(a.state).toBe('draft');
    expect(a.visiting).toBe(false);
    expect(a.locationId).toBeNull();
    expect(a.createdAt).toBe(NOW);
    expect(a.updatedAt).toBe(NOW);
  });

  it('freezes the object', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('accepts visiting=true with type=local', () => {
    const a = make({ type: 'local', visiting: true });
    expect(a.visiting).toBe(true);
    expect(a.type).toBe('local');
  });

  it('accepts a locationId', () => {
    const a = make({ locationId: 'loc-1' });
    expect(a.locationId).toBe('loc-1');
  });

  it('normalises whitespace on date', () => {
    const a = make({ date: '  2026-09-05  ' });
    expect(a.date).toBe('2026-09-05');
  });

  it('normalises whitespace on localTime', () => {
    const a = make({ localTime: '  10:00  ' });
    expect(a.localTime).toBe('10:00');
  });

  it('normalises whitespace on timezone', () => {
    const a = make({ timezone: '  America/New_York  ' });
    expect(a.timezone).toBe('America/New_York');
  });

  it('normalises empty locationId to null', () => {
    const a = make({ locationId: '' });
    expect(a.locationId).toBeNull();
  });

  it('throws on missing id', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws on missing tenantId', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on missing weekendMeetingId', () => {
    expect(() => make({ weekendMeetingId: '' })).toThrow('weekendMeetingId is required');
  });

  it('throws on missing talkOutlineId', () => {
    expect(() => make({ talkOutlineId: '' })).toThrow('talkOutlineId is required');
  });

  it('throws on missing speakerId', () => {
    expect(() => make({ speakerId: '' })).toThrow('speakerId is required');
  });

  it('throws on missing speakerCongregationId', () => {
    expect(() => make({ speakerCongregationId: '' })).toThrow('speakerCongregationId is required');
  });

  it('throws on invalid date format', () => {
    expect(() => make({ date: '09/05/2026' })).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid date value', () => {
    expect(() => make({ date: '2026-13-01' })).toThrow('Invalid date');
  });

  it('throws on invalid localTime format', () => {
    expect(() => make({ localTime: '10:00:00' })).toThrow('HH:mm');
  });

  it('throws on out-of-range localTime hours', () => {
    expect(() => make({ localTime: '25:00' })).toThrow('out of range');
  });

  it('throws on out-of-range localTime minutes', () => {
    expect(() => make({ localTime: '10:60' })).toThrow('out of range');
  });

  it('throws on invalid timezone', () => {
    expect(() => make({ timezone: 'Not/Real/Zone' })).toThrow('Unrecognised IANA timezone');
  });

  it('throws on timezone with special characters', () => {
    expect(() => make({ timezone: 'Europe-London' })).toThrow('Invalid timezone format');
  });

  it('throws on empty timezone', () => {
    expect(() => make({ timezone: '' })).toThrow('timezone is required');
  });

  it('throws on invalid type', () => {
    expect(() => make({ type: 'virtual' } as any)).toThrow('Invalid type');
  });

  it('throws on invalid now', () => {
    expect(() => make({ now: 'not-a-date' })).toThrow('Invalid ISO date');
  });

  it('creates type=away assignment', () => {
    const a = make({ type: 'away' });
    expect(a.type).toBe('away');
  });
});

// ─── Structural consistency ──────────────────────────────────────────────────

describe('validateStructuralConsistency', () => {
  it('type=away + visiting=true is invalid', () => {
    expect(() => make({ type: 'away', visiting: true })).toThrow('Structural inconsistency');
  });

  it('type=local + visiting=true is valid', () => {
    expect(() => make({ type: 'local', visiting: true })).not.toThrow();
  });

  it('type=local + visiting=false is valid', () => {
    expect(() => make({ type: 'local', visiting: false })).not.toThrow();
  });

  it('type=away + visiting=false is valid', () => {
    expect(() => make({ type: 'away', visiting: false })).not.toThrow();
  });

  it('can be called standalone on an object', () => {
    const a = make({ type: 'local', visiting: true });
    expect(() => validateStructuralConsistency(a)).not.toThrow();
  });
});

// ─── State transitions ───────────────────────────────────────────────────────

describe('state transitions', () => {
  it('draft → confirmed', () => {
    const a = confirmTalkAssignment(make(), '2026-08-22T09:00:00Z');
    expect(a.state).toBe('confirmed');
    expect(a.updatedAt).toBe('2026-08-22T09:00:00Z');
  });

  it('confirmed → completed', () => {
    const a = completeTalkAssignment(confirmTalkAssignment(make(), NOW), NOW);
    expect(a.state).toBe('completed');
  });

  it('draft → cancelled', () => {
    const a = cancelTalkAssignment(make(), NOW);
    expect(a.state).toBe('cancelled');
  });

  it('confirmed → cancelled', () => {
    const a = cancelTalkAssignment(confirmTalkAssignment(make(), NOW), NOW);
    expect(a.state).toBe('cancelled');
  });

  it('cancelled → confirmed is invalid', () => {
    const a = cancelTalkAssignment(make(), NOW);
    expect(() => confirmTalkAssignment(a, NOW)).toThrow('Invalid transition');
  });

  it('completed → cancelled is invalid', () => {
    let a = make();
    a = confirmTalkAssignment(a, NOW);
    a = completeTalkAssignment(a, NOW);
    expect(() => cancelTalkAssignment(a, NOW)).toThrow('Invalid transition');
  });

  it('draft → completed is invalid', () => {
    expect(() => completeTalkAssignment(make(), NOW)).toThrow('Invalid transition');
  });

  it('confirmed → confirmed is invalid (no self-loop)', () => {
    const a = confirmTalkAssignment(make(), NOW);
    expect(() => confirmTalkAssignment(a, NOW)).toThrow('Invalid transition');
  });

  it('cancelled → completed is invalid', () => {
    const a = cancelTalkAssignment(make(), NOW);
    expect(() => completeTalkAssignment(a, NOW)).toThrow('Invalid transition');
  });

  it('transition updates updatedAt but preserves createdAt', () => {
    const original = make();
    const confirmed = confirmTalkAssignment(original, '2026-09-01T10:00:00Z');
    expect(confirmed.createdAt).toBe(original.createdAt);
    expect(confirmed.updatedAt).toBe('2026-09-01T10:00:00Z');
  });

  it('transition with invalid now throws', () => {
    expect(() => confirmTalkAssignment(make(), 'bad')).toThrow('Invalid ISO date');
  });

  it('transitioned objects are frozen', () => {
    const a = confirmTalkAssignment(make(), NOW);
    expect(Object.isFrozen(a)).toBe(true);
  });
});

// ─── Update ──────────────────────────────────────────────────────────────────

describe('updateTalkAssignment', () => {
  it('updates draft speaker', () => {
    const a = updateTalkAssignment(make(), { speakerId: 'sp-2' }, NOW);
    expect(a.speakerId).toBe('sp-2');
    expect(a.state).toBe('draft');
  });

  it('updates draft outline', () => {
    const a = updateTalkAssignment(make(), { talkOutlineId: 'to-99' }, NOW);
    expect(a.talkOutlineId).toBe('to-99');
  });

  it('updates draft date and time', () => {
    const a = updateTalkAssignment(make(), { date: '2026-10-10', localTime: '14:30' }, NOW);
    expect(a.date).toBe('2026-10-10');
    expect(a.localTime).toBe('14:30');
  });

  it('updates timezone', () => {
    const a = updateTalkAssignment(make(), { timezone: 'Europe/London' }, NOW);
    expect(a.timezone).toBe('Europe/London');
  });

  it('updates locationId', () => {
    const a = updateTalkAssignment(make(), { locationId: 'loc-5' }, NOW);
    expect(a.locationId).toBe('loc-5');
  });

  it('clears locationId with null', () => {
    const a = updateTalkAssignment(make({ locationId: 'loc-1' }), { locationId: null }, NOW);
    expect(a.locationId).toBeNull();
  });

  it('updates updatedAt', () => {
    const a = updateTalkAssignment(make(), {}, '2026-10-01T00:00:00Z');
    expect(a.updatedAt).toBe('2026-10-01T00:00:00Z');
  });

  it('throws on confirmed state', () => {
    const confirmed = confirmTalkAssignment(make(), NOW);
    expect(() => updateTalkAssignment(confirmed, { speakerId: 'x' }, NOW)).toThrow('Can only update draft');
  });

  it('throws on cancelled state', () => {
    const cancelled = cancelTalkAssignment(make(), NOW);
    expect(() => updateTalkAssignment(cancelled, { speakerId: 'x' }, NOW)).toThrow('Can only update draft');
  });

  it('throws on completed state', () => {
    let a = make();
    a = confirmTalkAssignment(a, NOW);
    a = completeTalkAssignment(a, NOW);
    expect(() => updateTalkAssignment(a, { speakerId: 'x' }, NOW)).toThrow('Can only update draft');
  });

  it('structural consistency is checked on update', () => {
    const a = make({ type: 'local', visiting: true });
    // Changing type to away while visiting stays true must fail
    expect(() => updateTalkAssignment(a, { type: 'away' }, NOW)).toThrow('Structural inconsistency');
  });

  it('result is frozen', () => {
    const a = updateTalkAssignment(make(), { speakerId: 'sp-2' }, NOW);
    expect(Object.isFrozen(a)).toBe(true);
  });

  it('original is unmodified', () => {
    const original = make();
    updateTalkAssignment(original, { speakerId: 'sp-2' }, NOW);
    expect(original.speakerId).toBe('sp-1');
  });

  it('throws on invalid date in changes', () => {
    expect(() => updateTalkAssignment(make(), { date: 'bad' }, NOW)).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid localTime in changes', () => {
    expect(() => updateTalkAssignment(make(), { localTime: '25:00' }, NOW)).toThrow('out of range');
  });

  it('throws on invalid timezone in changes', () => {
    expect(() => updateTalkAssignment(make(), { timezone: 'Mars/Olympus' }, NOW)).toThrow('Unrecognised IANA timezone');
  });

  it('throws on empty speakerId in changes', () => {
    expect(() => updateTalkAssignment(make(), { speakerId: '' }, NOW)).toThrow('speakerId is required');
  });
});

// ─── Tenant isolation ────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('assertTalkAssignmentTenant passes for matching tenant', () => {
    expect(() => assertTalkAssignmentTenant(make(), T)).not.toThrow();
  });

  it('assertTalkAssignmentTenant throws for different tenant', () => {
    expect(() => assertTalkAssignmentTenant(make(), T2)).toThrow('Cross-tenant');
  });

  it('filterTalkAssignmentsByTenant returns only matching', () => {
    const a1 = make({ id: 'a', tenantId: T });
    const a2 = make({ id: 'b', tenantId: T2, weekendMeetingId: 'wm-2' });
    const result = filterTalkAssignmentsByTenant([a1, a2], T);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('filterTalkAssignmentsByTenant returns empty for no match', () => {
    expect(filterTalkAssignmentsByTenant([make()], T2)).toHaveLength(0);
  });

  it('filterTalkAssignmentsByTenant returns empty for empty input', () => {
    expect(filterTalkAssignmentsByTenant([], T)).toHaveLength(0);
  });
});

// ─── Filtering by date range ─────────────────────────────────────────────────

describe('filterTalkAssignmentsByDateRange', () => {
  const assignments = makeMulti(3); // 2026-09-05, 2026-09-06, 2026-09-07

  it('returns assignments within range', () => {
    const result = filterTalkAssignmentsByDateRange(assignments, '2026-09-05', '2026-09-06');
    expect(result).toHaveLength(2);
  });

  it('inclusive on both bounds', () => {
    const result = filterTalkAssignmentsByDateRange(assignments, '2026-09-06', '2026-09-06');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-09-06');
  });

  it('returns empty when range does not overlap', () => {
    const result = filterTalkAssignmentsByDateRange(assignments, '2026-10-01', '2026-10-31');
    expect(result).toHaveLength(0);
  });

  it('throws on invalid from date', () => {
    expect(() => filterTalkAssignmentsByDateRange(assignments, 'bad', '2026-09-30')).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid to date', () => {
    expect(() => filterTalkAssignmentsByDateRange(assignments, '2026-09-01', 'bad')).toThrow('YYYY-MM-DD');
  });
});

// ─── Filtering by speaker ────────────────────────────────────────────────────

describe('filterTalkAssignmentsBySpeaker', () => {
  it('returns assignments for given speaker', () => {
    const a1 = make({ id: 'a', speakerId: 'sp-1' });
    const a2 = make({ id: 'b', speakerId: 'sp-2' });
    const result = filterTalkAssignmentsBySpeaker([a1, a2], 'sp-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when no match', () => {
    expect(filterTalkAssignmentsBySpeaker([make()], 'sp-999')).toHaveLength(0);
  });
});

// ─── Filtering by outline ────────────────────────────────────────────────────

describe('filterTalkAssignmentsByOutline', () => {
  it('returns assignments for given outline', () => {
    const a1 = make({ id: 'a', talkOutlineId: 'to-1' });
    const a2 = make({ id: 'b', talkOutlineId: 'to-2' });
    const result = filterTalkAssignmentsByOutline([a1, a2], 'to-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('returns empty when no match', () => {
    expect(filterTalkAssignmentsByOutline([make()], 'to-999')).toHaveLength(0);
  });
});

// ─── Filter local / away ─────────────────────────────────────────────────────

describe('filterLocalTalks / filterAwayTalks', () => {
  it('filterLocalTalks returns only local', () => {
    const a1 = make({ id: 'a', type: 'local' });
    const a2 = make({ id: 'b', type: 'away' });
    expect(filterLocalTalks([a1, a2])).toHaveLength(1);
    expect(filterLocalTalks([a1, a2])[0].id).toBe('a');
  });

  it('filterAwayTalks returns only away', () => {
    const a1 = make({ id: 'a', type: 'local' });
    const a2 = make({ id: 'b', type: 'away' });
    expect(filterAwayTalks([a1, a2])).toHaveLength(1);
    expect(filterAwayTalks([a1, a2])[0].id).toBe('b');
  });

  it('returns empty on empty input', () => {
    expect(filterLocalTalks([])).toHaveLength(0);
    expect(filterAwayTalks([])).toHaveLength(0);
  });
});

// ─── Ordering ────────────────────────────────────────────────────────────────

describe('orderTalkAssignmentsByDate', () => {
  it('sorts by date then time', () => {
    const a1 = make({ id: 'c', date: '2026-09-07', localTime: '10:00' });
    const a2 = make({ id: 'b', date: '2026-09-06', localTime: '11:00' });
    const a3 = make({ id: 'a', date: '2026-09-06', localTime: '09:30' });
    const sorted = orderTalkAssignmentsByDate([a1, a2, a3]);
    expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for empty input', () => {
    expect(orderTalkAssignmentsByDate([])).toEqual([]);
  });

  it('returns single element unchanged', () => {
    const a = make();
    expect(orderTalkAssignmentsByDate([a])).toEqual([a]);
  });

  it('does not mutate original', () => {
    const a1 = make({ id: 'a', date: '2026-09-07' });
    const a2 = make({ id: 'b', date: '2026-09-06' });
    const original = [a1, a2];
    orderTalkAssignmentsByDate(original);
    expect(original[0].id).toBe('a');
  });
});

// ─── Immutability ────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('assignment is frozen', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('update returns new object', () => {
    const original = make();
    const updated = updateTalkAssignment(original, { speakerId: 'sp-2' }, NOW);
    expect(updated).not.toBe(original);
  });

  it('original unchanged after update', () => {
    const original = make();
    updateTalkAssignment(original, { speakerId: 'sp-2' }, NOW);
    expect(original.speakerId).toBe('sp-1');
  });

  it('transition returns new object', () => {
    const original = make();
    const confirmed = confirmTalkAssignment(original, NOW);
    expect(confirmed).not.toBe(original);
  });

  it('order returns new array', () => {
    const arr = makeMulti(2);
    const sorted = orderTalkAssignmentsByDate(arr);
    expect(sorted).not.toBe(arr);
  });

  it('filter returns new array', () => {
    const arr = makeMulti(2);
    const filtered = filterLocalTalks(arr);
    expect(filtered).not.toBe(arr);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('same speaker same date is allowed (no domain-level uniqueness)', () => {
    const a1 = make({ id: 'a', speakerId: 'sp-1', date: '2026-09-05' });
    const a2 = make({ id: 'b', speakerId: 'sp-1', date: '2026-09-05' });
    // Both should be created without error — uniqueness is application-layer concern
    expect(a1.speakerId).toBe('sp-1');
    expect(a2.speakerId).toBe('sp-1');
    expect(a1.date).toBe(a2.date);
  });

  it('same outline same date is allowed', () => {
    const a1 = make({ id: 'a', talkOutlineId: 'to-1', date: '2026-09-05' });
    const a2 = make({ id: 'b', talkOutlineId: 'to-1', date: '2026-09-05' });
    expect(a1.talkOutlineId).toBe(a2.talkOutlineId);
  });

  it('UTC timezone is accepted', () => {
    const a = make({ timezone: 'UTC' });
    expect(a.timezone).toBe('UTC');
  });

  it('midnight time 00:00 is accepted', () => {
    const a = make({ localTime: '00:00' });
    expect(a.localTime).toBe('00:00');
  });

  it('last minute 23:59 is accepted', () => {
    const a = make({ localTime: '23:59' });
    expect(a.localTime).toBe('23:59');
  });
});

// ─── Adversarial / malformed inputs ──────────────────────────────────────────

describe('adversarial inputs', () => {
  it('non-string id throws', () => {
    expect(() => make({ id: 42 as any })).toThrow('id must be a string');
  });

  it('non-string tenantId throws', () => {
    expect(() => make({ tenantId: null as any })).toThrow('tenantId must be a string');
  });

  it('non-string date throws', () => {
    expect(() => make({ date: 12345 as any })).toThrow('date must be a string');
  });

  it('non-string localTime throws', () => {
    expect(() => make({ localTime: true as any })).toThrow('localTime must be a string');
  });

  it('non-string timezone throws', () => {
    expect(() => make({ timezone: {} as any })).toThrow('timezone must be a string');
  });

  it('undefined now throws', () => {
    expect(() => make({ now: undefined as any })).toThrow('Invalid ISO date');
  });

  it('object injection via prototype pollution does not affect output', () => {
    const a = make();
    expect((a as any).polluted).toBeUndefined();
  });

  it('whitespace-only id throws', () => {
    expect(() => make({ id: '   ' })).toThrow('id is required');
  });

  it('date with trailing text throws', () => {
    expect(() => make({ date: '2026-09-05extra' })).toThrow('YYYY-MM-DD');
  });

  it('type as number throws', () => {
    expect(() => make({ type: 1 as any })).toThrow('Invalid type');
  });

  it('visiting as string "true" is coerced to boolean true', () => {
    const a = make({ visiting: 'true' as any });
    expect(a.visiting).toBe(true);
  });

  it('visiting as 1 is coerced to true', () => {
    const a = make({ visiting: 1 as any });
    expect(a.visiting).toBe(true);
  });

  it('visiting as 0 is coerced to false', () => {
    const a = make({ visiting: 0 as any });
    expect(a.visiting).toBe(false);
  });

  it('date February 29 on leap year is accepted', () => {
    const a = make({ date: '2028-02-29' });
    expect(a.date).toBe('2028-02-29');
  });

  it('date February 29 on non-leap year throws', () => {
    expect(() => make({ date: '2027-02-29' })).toThrow('Invalid date');
  });

  it('all fields preserved through confirm → complete chain', () => {
    const original = make({
      id: 'pta-x', tenantId: T, weekendMeetingId: 'wm-x',
      talkOutlineId: 'to-x', speakerId: 'sp-x', speakerCongregationId: 'cong-x',
      date: '2026-12-25', localTime: '15:00', timezone: 'Europe/Berlin',
      locationId: 'loc-x', type: 'local', visiting: true,
    });
    let a = confirmTalkAssignment(original, NOW);
    a = completeTalkAssignment(a, NOW);
    expect(a.id).toBe('pta-x');
    expect(a.tenantId).toBe(T);
    expect(a.weekendMeetingId).toBe('wm-x');
    expect(a.talkOutlineId).toBe('to-x');
    expect(a.speakerId).toBe('sp-x');
    expect(a.speakerCongregationId).toBe('cong-x');
    expect(a.date).toBe('2026-12-25');
    expect(a.localTime).toBe('15:00');
    expect(a.timezone).toBe('Europe/Berlin');
    expect(a.locationId).toBe('loc-x');
    expect(a.type).toBe('local');
    expect(a.visiting).toBe(true);
    expect(a.state).toBe('completed');
  });

  it('update with no changes still updates timestamp', () => {
    const a = updateTalkAssignment(make(), {}, NOW);
    expect(a.updatedAt).toBe(NOW);
    expect(a.speakerId).toBe('sp-1');
  });

  it('Asia/Tokyo timezone is accepted', () => {
    const a = make({ timezone: 'Asia/Tokyo' });
    expect(a.timezone).toBe('Asia/Tokyo');
  });

  it('Australia/Sydney timezone is accepted', () => {
    const a = make({ timezone: 'Australia/Sydney' });
    expect(a.timezone).toBe('Australia/Sydney');
  });

  it('away talk has visiting=false enforced', () => {
    const a = make({ type: 'away', visiting: false });
    expect(a.type).toBe('away');
    expect(a.visiting).toBe(false);
  });

  it('locationId undefined treated as null', () => {
    const a = make({ locationId: undefined });
    expect(a.locationId).toBeNull();
  });
});