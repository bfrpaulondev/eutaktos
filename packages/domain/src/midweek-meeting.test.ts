import { describe, it, expect } from 'vitest';
import {
  createMidweekMeeting,
  publishMidweekMeeting,
  archiveMidweekMeeting,
  addMeetingSlot,
  removeMeetingSlot,
  updateMidweekMeeting,
  assertMeetingTenant,
  filterMeetingsByTenant,
  orderMeetingsByDate,
  isMeetingLocked,
  findSlotById,
  totalScheduledMinutes,
  validateMeetingSlot,
} from './midweek-meeting';
import type { MidweekMeeting, MeetingSlot } from './midweek-meeting';

// ---- Helpers ----

const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';
const NOW = '2025-06-15T10:00:00.000Z';
const SLOT_A: MeetingSlot = { id: 'slot-1', position: 0, durationMinutes: 10, titleKey: 'opening' };
const SLOT_B: MeetingSlot = { id: 'slot-2', position: 1, durationMinutes: 15, titleKey: 'treasures', partDefinitionId: 'part-treasures' };

function makeMeeting(overrides?: Partial<Parameters<typeof createMidweekMeeting>[0]>): Readonly<MidweekMeeting> {
  return createMidweekMeeting({
    id: 'meeting-1',
    tenantId: TENANT_A,
    date: '2025-07-01',
    localTime: '19:00',
    timezone: 'Europe/Lisbon',
    now: NOW,
    ...overrides,
  });
}

// ---- createMidweekMeeting ----

describe('createMidweekMeeting', () => {
  it('creates a draft meeting with correct defaults', () => {
    const m = makeMeeting();
    expect(m.id).toBe('meeting-1');
    expect(m.tenantId).toBe(TENANT_A);
    expect(m.date).toBe('2025-07-01');
    expect(m.localTime).toBe('19:00');
    expect(m.timezone).toBe('Europe/Lisbon');
    expect(m.state).toBe('draft');
    expect(m.slots).toEqual([]);
    expect(m.createdAt).toBe(NOW);
    expect(m.updatedAt).toBe(NOW);
    expect(m.locationId).toBeUndefined();
  });

  it('creates a meeting with slots sorted by position', () => {
    const m = makeMeeting({
      slots: [
        { id: 's2', position: 1, durationMinutes: 5, titleKey: 'b' },
        { id: 's1', position: 0, durationMinutes: 10, titleKey: 'a' },
      ],
    });
    expect(m.slots[0].id).toBe('s1');
    expect(m.slots[1].id).toBe('s2');
  });

  it('creates a meeting with locationId', () => {
    const m = makeMeeting({ locationId: 'loc-1' });
    expect(m.locationId).toBe('loc-1');
  });

  it('freezes the returned object', () => {
    const m = makeMeeting();
    expect(Object.isFrozen(m)).toBe(true);
    expect(Object.isFrozen(m.slots)).toBe(true);
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

  it('rejects duplicate slot ids', () => {
    expect(() => makeMeeting({
      slots: [
        { id: 'dup', position: 0, durationMinutes: 5, titleKey: 'a' },
        { id: 'dup', position: 1, durationMinutes: 5, titleKey: 'b' },
      ],
    })).toThrow('Duplicate slot id: dup');
  });

  it('rejects duplicate slot positions', () => {
    expect(() => makeMeeting({
      slots: [
        { id: 's1', position: 0, durationMinutes: 5, titleKey: 'a' },
        { id: 's2', position: 0, durationMinutes: 5, titleKey: 'b' },
      ],
    })).toThrow('Duplicate slot position: 0');
  });

  it('rejects slot with non-integer position', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: 1.5, durationMinutes: 5, titleKey: 'a' }],
    })).toThrow('slot position must be a non-negative integer');
  });

  it('rejects slot with negative position', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: -1, durationMinutes: 5, titleKey: 'a' }],
    })).toThrow('slot position must be a non-negative integer');
  });

  it('rejects slot with zero or negative duration', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: 0, durationMinutes: 0, titleKey: 'a' }],
    })).toThrow('slot durationMinutes must be a positive number');
  });

  it('rejects slot with NaN duration', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: 0, durationMinutes: NaN, titleKey: 'a' }],
    })).toThrow('slot durationMinutes must be a positive number');
  });

  it('rejects slot with empty titleKey', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: 0, durationMinutes: 5, titleKey: '' }],
    })).toThrow('slotTitleKey is required');
  });

  it('rejects slot with too-long titleKey', () => {
    expect(() => makeMeeting({
      slots: [{ id: 's1', position: 0, durationMinutes: 5, titleKey: 'x'.repeat(121) }],
    })).toThrow('slot titleKey is too long');
  });

  it('rejects empty locationId', () => {
    expect(() => makeMeeting({ locationId: '  ' })).toThrow('locationId is required');
  });

  it('rejects non-array slots', () => {
    expect(() => makeMeeting({ slots: {} as unknown as MeetingSlot[] })).toThrow('slots must be an array');
  });

  // -- DST boundary dates --

  it('accepts a date on DST transition day', () => {
    // 2025-10-26 is a DST transition in Europe/Lisbon
    const m = makeMeeting({ date: '2025-10-26', timezone: 'Europe/Lisbon' });
    expect(m.date).toBe('2025-10-26');
  });

  it('accepts a date at year boundary', () => {
    const m = makeMeeting({ date: '2025-12-31' });
    expect(m.date).toBe('2025-12-31');
  });

  it('accepts a leap year date', () => {
    const m = makeMeeting({ date: '2024-02-29' });
    expect(m.date).toBe('2024-02-29');
  });

  it('rejects Feb 29 on a non-leap year', () => {
    expect(() => makeMeeting({ date: '2025-02-29' })).toThrow('date is not a valid calendar date');
  });
});

// ---- Lifecycle ----

describe('publishMidweekMeeting', () => {
  it('transitions draft → published', () => {
    const published = publishMidweekMeeting(makeMeeting(), '2025-06-16T08:00:00Z');
    expect(published.state).toBe('published');
    expect(published.updatedAt).toBe('2025-06-16T08:00:00Z');
    expect(published.createdAt).toBe(NOW); // unchanged
  });

  it('freezes the returned meeting', () => {
    expect(Object.isFrozen(publishMidweekMeeting(makeMeeting(), NOW))).toBe(true);
  });

  it('rejects publishing an already-published meeting', () => {
    const published = publishMidweekMeeting(makeMeeting(), NOW);
    expect(() => publishMidweekMeeting(published, NOW)).toThrow("Cannot publish meeting in 'published' state");
  });

  it('rejects publishing an archived meeting', () => {
    const published = publishMidweekMeeting(makeMeeting(), NOW);
    const archived = archiveMidweekMeeting(published, NOW);
    expect(() => publishMidweekMeeting(archived, NOW)).toThrow("Cannot publish meeting in 'archived' state");
  });

  it('rejects invalid now', () => {
    expect(() => publishMidweekMeeting(makeMeeting(), 'bad')).toThrow('Invalid ISO date');
  });
});

describe('archiveMidweekMeeting', () => {
  it('transitions published → archived', () => {
    const published = publishMidweekMeeting(makeMeeting(), NOW);
    const archived = archiveMidweekMeeting(published, '2025-06-17T08:00:00Z');
    expect(archived.state).toBe('archived');
    expect(archived.updatedAt).toBe('2025-06-17T08:00:00Z');
  });

  it('rejects archiving a draft meeting', () => {
    expect(() => archiveMidweekMeeting(makeMeeting(), NOW)).toThrow("Cannot archive meeting in 'draft' state");
  });

  it('rejects archiving an already-archived meeting', () => {
    const archived = archiveMidweekMeeting(publishMidweekMeeting(makeMeeting(), NOW), NOW);
    expect(() => archiveMidweekMeeting(archived, NOW)).toThrow("Cannot archive meeting in 'archived' state");
  });
});

// ---- Slot mutations (draft only) ----

describe('addMeetingSlot', () => {
  it('adds a slot to a draft meeting', () => {
    const m = addMeetingSlot(makeMeeting(), SLOT_A);
    expect(m.slots).toHaveLength(1);
    expect(m.slots[0].id).toBe('slot-1');
  });

  it('rejects duplicate slot id', () => {
    const m = addMeetingSlot(makeMeeting(), SLOT_A);
    expect(() => addMeetingSlot(m, SLOT_A)).toThrow('Slot id already exists: slot-1');
  });

  it('rejects adding to a published meeting', () => {
    const published = publishMidweekMeeting(makeMeeting(), NOW);
    expect(() => addMeetingSlot(published, SLOT_A)).toThrow("Cannot modify slots on a 'published' meeting");
  });

  it('rejects adding to an archived meeting', () => {
    const archived = archiveMidweekMeeting(publishMidweekMeeting(makeMeeting(), NOW), NOW);
    expect(() => addMeetingSlot(archived, SLOT_A)).toThrow("Cannot modify slots on a 'archived' meeting");
  });

  it('maintains position order after multiple adds', () => {
    let m = makeMeeting();
    m = addMeetingSlot(m, SLOT_B);
    m = addMeetingSlot(m, SLOT_A);
    expect(m.slots[0].id).toBe('slot-1');
    expect(m.slots[1].id).toBe('slot-2');
  });

  it('rejects slot with empty id', () => {
    expect(() => addMeetingSlot(makeMeeting(), { ...SLOT_A, id: '' })).toThrow('slotId is required');
  });
});

describe('removeMeetingSlot', () => {
  it('removes a slot from a draft meeting', () => {
    const m = addMeetingSlot(makeMeeting(), SLOT_A);
    const removed = removeMeetingSlot(m, 'slot-1');
    expect(removed.slots).toHaveLength(0);
  });

  it('throws when slot not found', () => {
    expect(() => removeMeetingSlot(makeMeeting(), 'nonexistent')).toThrow('Slot not found: nonexistent');
  });

  it('rejects removing from a published meeting', () => {
    const m = addMeetingSlot(makeMeeting(), SLOT_A);
    const published = publishMidweekMeeting(m, NOW);
    expect(() => removeMeetingSlot(published, 'slot-1')).toThrow("Cannot modify slots on a 'published' meeting");
  });

  it('rejects empty slotId', () => {
    expect(() => removeMeetingSlot(makeMeeting(), '')).toThrow('slotId is required');
  });
});

// ---- updateMidweekMeeting ----

describe('updateMidweekMeeting', () => {
  it('updates date, localTime, and timezone', () => {
    const m = updateMidweekMeeting(makeMeeting(), {
      date: '2025-07-08',
      localTime: '18:30',
      timezone: 'America/New_York',
    }, '2025-06-16T08:00:00Z');
    expect(m.date).toBe('2025-07-08');
    expect(m.localTime).toBe('18:30');
    expect(m.timezone).toBe('America/New_York');
    expect(m.updatedAt).toBe('2025-06-16T08:00:00Z');
  });

  it('sets locationId', () => {
    const m = updateMidweekMeeting(makeMeeting(), { locationId: 'hall-1' }, NOW);
    expect(m.locationId).toBe('hall-1');
  });

  it('clears locationId with null', () => {
    const m = updateMidweekMeeting(makeMeeting({ locationId: 'hall-1' }), { locationId: null }, NOW);
    expect(m.locationId).toBeUndefined();
  });

  it('rejects update on published meeting', () => {
    const published = publishMidweekMeeting(makeMeeting(), NOW);
    expect(() => updateMidweekMeeting(published, { date: '2025-07-08' }, NOW))
      .toThrow("Cannot update a 'published' meeting");
  });

  it('rejects update on archived meeting', () => {
    const archived = archiveMidweekMeeting(publishMidweekMeeting(makeMeeting(), NOW), NOW);
    expect(() => updateMidweekMeeting(archived, { date: '2025-07-08' }, NOW))
      .toThrow("Cannot update a 'archived' meeting");
  });

  it('validates new date format', () => {
    expect(() => updateMidweekMeeting(makeMeeting(), { date: 'bad' }, NOW))
      .toThrow('date must use YYYY-MM-DD format');
  });

  it('validates new localTime format', () => {
    expect(() => updateMidweekMeeting(makeMeeting(), { localTime: '25:00' }, NOW))
      .toThrow('localTime must use 24-hour HH:mm format');
  });

  it('validates new timezone', () => {
    expect(() => updateMidweekMeeting(makeMeeting(), { timezone: 'Invalid' }, NOW))
      .toThrow('timezone must be a valid IANA timezone');
  });

  it('rejects empty locationId', () => {
    expect(() => updateMidweekMeeting(makeMeeting(), { locationId: '  ' }, NOW))
      .toThrow('locationId is required');
  });

  it('leaves unspecified fields unchanged', () => {
    const m = updateMidweekMeeting(makeMeeting(), {}, '2025-06-20T10:00:00Z');
    expect(m.date).toBe('2025-07-01');
    expect(m.localTime).toBe('19:00');
    expect(m.timezone).toBe('Europe/Lisbon');
    expect(m.updatedAt).toBe('2025-06-20T10:00:00Z');
  });
});

// ---- Tenant isolation ----

describe('assertMeetingTenant', () => {
  it('does not throw for matching tenant', () => {
    expect(() => assertMeetingTenant(makeMeeting(), TENANT_A)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    expect(() => assertMeetingTenant(makeMeeting(), TENANT_B)).toThrow('Cross-tenant meeting access denied');
  });
});

describe('filterMeetingsByTenant', () => {
  it('returns only matching tenant meetings', () => {
    const meetings = [
      makeMeeting({ id: 'm1', tenantId: TENANT_A }),
      makeMeeting({ id: 'm2', tenantId: TENANT_B }),
      makeMeeting({ id: 'm3', tenantId: TENANT_A }),
    ];
    const filtered = filterMeetingsByTenant(meetings, TENANT_A);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(m => m.tenantId === TENANT_A)).toBe(true);
  });

  it('returns empty for non-existent tenant', () => {
    const filtered = filterMeetingsByTenant([makeMeeting()], 'other-tenant');
    expect(filtered).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterMeetingsByTenant([], TENANT_A)).toHaveLength(0);
  });
});

// ---- Ordering ----

describe('orderMeetingsByDate', () => {
  it('sorts by date ascending', () => {
    const meetings = [
      makeMeeting({ id: 'm2', date: '2025-07-15' }),
      makeMeeting({ id: 'm1', date: '2025-07-01' }),
      makeMeeting({ id: 'm3', date: '2025-07-08' }),
    ];
    const sorted = orderMeetingsByDate(meetings);
    expect(sorted.map(m => m.id)).toEqual(['m1', 'm3', 'm2']);
  });

  it('breaks ties by id', () => {
    const meetings = [
      makeMeeting({ id: 'm-b', date: '2025-07-01' }),
      makeMeeting({ id: 'm-a', date: '2025-07-01' }),
    ];
    const sorted = orderMeetingsByDate(meetings);
    expect(sorted.map(m => m.id)).toEqual(['m-a', 'm-b']);
  });

  it('does not mutate input', () => {
    const meetings = [
      makeMeeting({ id: 'm2', date: '2025-07-15' }),
      makeMeeting({ id: 'm1', date: '2025-07-01' }),
    ];
    const copy = [...meetings];
    orderMeetingsByDate(meetings);
    expect(meetings).toEqual(copy);
  });
});

// ---- isMeetingLocked ----

describe('isMeetingLocked', () => {
  it('draft is not locked', () => {
    expect(isMeetingLocked(makeMeeting())).toBe(false);
  });

  it('published is locked', () => {
    expect(isMeetingLocked(publishMidweekMeeting(makeMeeting(), NOW))).toBe(true);
  });

  it('archived is locked', () => {
    expect(isMeetingLocked(archiveMidweekMeeting(publishMidweekMeeting(makeMeeting(), NOW), NOW))).toBe(true);
  });
});

// ---- findSlotById ----

describe('findSlotById', () => {
  it('finds an existing slot', () => {
    const m = addMeetingSlot(makeMeeting(), SLOT_B);
    const slot = findSlotById(m, 'slot-2');
    expect(slot?.titleKey).toBe('treasures');
  });

  it('returns undefined for missing slot', () => {
    expect(findSlotById(makeMeeting(), 'missing')).toBeUndefined();
  });
});

// ---- totalScheduledMinutes ----

describe('totalScheduledMinutes', () => {
  it('returns 0 for empty meeting', () => {
    expect(totalScheduledMinutes(makeMeeting())).toBe(0);
  });

  it('sums all slot durations', () => {
    let m = makeMeeting();
    m = addMeetingSlot(m, SLOT_A); // 10 min
    m = addMeetingSlot(m, SLOT_B); // 15 min
    expect(totalScheduledMinutes(m)).toBe(25);
  });
});

// ---- validateMeetingSlot ----

describe('validateMeetingSlot', () => {
  it('returns a frozen validated slot', () => {
    const slot = validateMeetingSlot(SLOT_A);
    expect(Object.isFrozen(slot)).toBe(true);
    expect(slot.id).toBe('slot-1');
  });

  it('rejects empty id', () => {
    expect(() => validateMeetingSlot({ ...SLOT_A, id: '' })).toThrow('slotId is required');
  });

  it('rejects negative position', () => {
    expect(() => validateMeetingSlot({ ...SLOT_A, position: -1 })).toThrow('slot position must be a non-negative integer');
  });

  it('rejects zero duration', () => {
    expect(() => validateMeetingSlot({ ...SLOT_A, durationMinutes: 0 })).toThrow('slot durationMinutes must be a positive number');
  });

  it('rejects empty titleKey', () => {
    expect(() => validateMeetingSlot({ ...SLOT_A, titleKey: '' })).toThrow('slotTitleKey is required');
  });

  it('accepts slot without partDefinitionId', () => {
    const slot = validateMeetingSlot({ id: 's', position: 0, durationMinutes: 5, titleKey: 't' });
    expect(slot.partDefinitionId).toBeUndefined();
  });

  it('accepts slot with partDefinitionId', () => {
    const slot = validateMeetingSlot({ id: 's', position: 0, durationMinutes: 5, titleKey: 't', partDefinitionId: 'pd' });
    expect(slot.partDefinitionId).toBe('pd');
  });
});

// ---- Immutability / defensive cloning ----

describe('immutability', () => {
  it('slots array is frozen', () => {
    const m = makeMeeting({ slots: [SLOT_A] });
    expect(Object.isFrozen(m.slots)).toBe(true);
    expect(() => { (m.slots as MeetingSlot[]).push({} as MeetingSlot); }).toThrow();
  });

  it('individual slots are frozen', () => {
    const m = makeMeeting({ slots: [SLOT_A] });
    expect(Object.isFrozen(m.slots[0])).toBe(true);
  });

  it('lifecycle transitions produce new objects', () => {
    const draft = makeMeeting();
    const published = publishMidweekMeeting(draft, NOW);
    expect(draft).not.toBe(published);
    expect(draft.state).toBe('draft');
  });

  it('addMeetingSlot does not mutate original', () => {
    const draft = makeMeeting();
    const withSlot = addMeetingSlot(draft, SLOT_A);
    expect(draft.slots).toHaveLength(0);
    expect(withSlot.slots).toHaveLength(1);
  });

  it('removeMeetingSlot does not mutate original', () => {
    const withSlot = addMeetingSlot(makeMeeting(), SLOT_A);
    const without = removeMeetingSlot(withSlot, 'slot-1');
    expect(withSlot.slots).toHaveLength(1);
    expect(without.slots).toHaveLength(0);
  });
});

// ---- Timezone and DST ----

describe('timezone handling', () => {
  const timezones = [
    'America/New_York',
    'America/Sao_Paulo',
    'Europe/Lisbon',
    'Europe/Berlin',
    'Asia/Tokyo',
    'Australia/Sydney',
    'UTC',
  ];

  for (const tz of timezones) {
    it(`accepts timezone ${tz}`, () => {
      const m = makeMeeting({ timezone: tz });
      expect(m.timezone).toBe(tz);
    });
  }

  it('rejects empty timezone', () => {
    expect(() => makeMeeting({ timezone: '' })).toThrow('timezone is required');
  });
});

// ---- Cross-tenant security ----

describe('cross-tenant security', () => {
  it('filterMeetingsByTenant never leaks other tenant data', () => {
    const meetings = [
      makeMeeting({ id: 't1', tenantId: TENANT_A }),
      makeMeeting({ id: 't2', tenantId: TENANT_B }),
    ];
    const aMeetings = filterMeetingsByTenant(meetings, TENANT_A);
    expect(aMeetings).toHaveLength(1);
    expect(aMeetings[0].tenantId).toBe(TENANT_A);
  });

  it('assertMeetingTenant throws without revealing existence', () => {
    // The error message must not reveal whether the meeting exists
    try {
      assertMeetingTenant(makeMeeting({ tenantId: TENANT_A }), TENANT_B);
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect((e as Error).message).toBe('Cross-tenant meeting access denied');
      expect((e as Error).message).not.toContain('meeting-1');
    }
  });
});


describe('cancelMidweekMeeting', () => {
  it('transitions draft and published meetings to cancelled', async () => {
    const { cancelMidweekMeeting } = await import('./midweek-meeting');
    expect(cancelMidweekMeeting(makeMeeting(), NOW).state).toBe('cancelled');
    expect(cancelMidweekMeeting(publishMidweekMeeting(makeMeeting(), NOW), NOW).state).toBe('cancelled');
  });

  it('makes cancellation terminal and blocks republishing or editing', async () => {
    const { cancelMidweekMeeting } = await import('./midweek-meeting');
    const cancelled = cancelMidweekMeeting(makeMeeting(), NOW);
    expect(() => cancelMidweekMeeting(cancelled, NOW)).toThrow("Cannot cancel meeting in 'cancelled' state");
    expect(() => publishMidweekMeeting(cancelled, NOW)).toThrow("Cannot publish meeting in 'cancelled' state");
    expect(() => updateMidweekMeeting(cancelled, { localTime: '20:00' }, NOW)).toThrow("Cannot update a 'cancelled' meeting");
  });
});
