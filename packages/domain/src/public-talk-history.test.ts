import { describe, it, expect } from 'vitest';
import {
  recordPublicTalkHistory,
  normalizePublicTalkHistoryRecord,
  assertPublicTalkHistoryTenant,
  filterPublicTalkHistoryByTenant,
  filterPublicTalkHistoryBySpeaker,
  filterPublicTalkHistoryByOutline,
  filterPublicTalkHistoryByCongregation,
  filterPublicTalkHistoryByDateRange,
  lastUseOfOutline,
  lastUseOfSpeaker,
  historyOfOutline,
  historyOfSpeaker,
  previousCombinations,
  orderPublicTalkHistoryByDate,
  countTalksByOutline,
  countTalksBySpeaker,
  PUBLIC_TALK_HISTORY_TYPES,
  PUBLIC_TALK_HISTORY_STATES,
} from './public-talk-history';
import type { PublicTalkHistoryRecord } from './public-talk-history';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';
const T2 = 'tenant-bbb';

interface MakeInput {
  id: string;
  tenantId: string;
  speakerId: string;
  talkOutlineId: string;
  congregationId: string;
  date: string;
  type: 'local' | 'away';
  state: 'completed' | 'cancelled';
  recordedAt: string;
  weekendMeetingId: string;
}

const DEFAULTS: MakeInput = {
  id: 'pth-1',
  tenantId: T,
  speakerId: 'sp-1',
  talkOutlineId: 'to-1',
  congregationId: 'cong-1',
  date: '2026-09-05',
  type: 'local',
  state: 'completed',
  recordedAt: NOW,
  weekendMeetingId: 'wm-1',
};

function make(overrides?: Partial<MakeInput>): Readonly<PublicTalkHistoryRecord> {
  return recordPublicTalkHistory({ ...DEFAULTS, ...overrides });
}

function makeMulti(count: number, overrides?: Partial<MakeInput>): Readonly<PublicTalkHistoryRecord>[] {
  return Array.from({ length: count }, (_, i) =>
    make({ ...overrides, id: `pth-${i + 1}`, date: `2026-09-${String(5 + i).padStart(2, '0')}` }),
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

describe('constants', () => {
  it('PUBLIC_TALK_HISTORY_TYPES contains local and away', () => {
    expect(PUBLIC_TALK_HISTORY_TYPES).toEqual(['local', 'away']);
    expect(Object.isFrozen(PUBLIC_TALK_HISTORY_TYPES)).toBe(true);
  });

  it('PUBLIC_TALK_HISTORY_STATES contains completed and cancelled', () => {
    expect(PUBLIC_TALK_HISTORY_STATES).toEqual(['completed', 'cancelled']);
    expect(Object.isFrozen(PUBLIC_TALK_HISTORY_STATES)).toBe(true);
  });
});

// ─── Creation ────────────────────────────────────────────────────────────────

describe('recordPublicTalkHistory', () => {
  it('creates a completed local record', () => {
    const r = make();
    expect(r.id).toBe('pth-1');
    expect(r.tenantId).toBe(T);
    expect(r.speakerId).toBe('sp-1');
    expect(r.talkOutlineId).toBe('to-1');
    expect(r.congregationId).toBe('cong-1');
    expect(r.date).toBe('2026-09-05');
    expect(r.type).toBe('local');
    expect(r.state).toBe('completed');
    expect(r.recordedAt).toBe(NOW);
    expect(r.weekendMeetingId).toBe('wm-1');
  });

  it('creates an away cancelled record', () => {
    const r = make({ type: 'away', state: 'cancelled' });
    expect(r.type).toBe('away');
    expect(r.state).toBe('cancelled');
  });

  it('freezes the object', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('trims whitespace on date', () => {
    const r = make({ date: '  2026-09-05  ' });
    expect(r.date).toBe('2026-09-05');
  });

  it('throws on empty id', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws on whitespace-only id', () => {
    expect(() => make({ id: '   ' })).toThrow('id is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on empty speakerId', () => {
    expect(() => make({ speakerId: '' })).toThrow('speakerId is required');
  });

  it('throws on empty talkOutlineId', () => {
    expect(() => make({ talkOutlineId: '' })).toThrow('talkOutlineId is required');
  });

  it('throws on empty congregationId', () => {
    expect(() => make({ congregationId: '' })).toThrow('congregationId is required');
  });

  it('throws on empty weekendMeetingId', () => {
    expect(() => make({ weekendMeetingId: '' })).toThrow('weekendMeetingId is required');
  });

  it('throws on invalid date format', () => {
    expect(() => make({ date: '09/05/2026' })).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid date value (Feb 29 non-leap)', () => {
    expect(() => make({ date: '2027-02-29' })).toThrow('Invalid date');
  });

  it('throws on date with trailing text', () => {
    expect(() => make({ date: '2026-09-05extra' })).toThrow('YYYY-MM-DD');
  });

  it('accepts Feb 29 on leap year', () => {
    const r = make({ date: '2028-02-29' });
    expect(r.date).toBe('2028-02-29');
  });

  it('throws on invalid type', () => {
    expect(() => make({ type: 'virtual' } as any)).toThrow('Invalid type');
  });

  it('throws on invalid state', () => {
    expect(() => make({ state: 'draft' } as any)).toThrow('Invalid state');
  });

  it('throws on invalid recordedAt', () => {
    expect(() => make({ recordedAt: 'not-a-date' })).toThrow('Invalid ISO date');
  });
});

// ─── Normalize ───────────────────────────────────────────────────────────────

describe('normalizePublicTalkHistoryRecord', () => {
  it('normalizes a valid record', () => {
    const r = make();
    const normalized = normalizePublicTalkHistoryRecord(r);
    expect(normalized.id).toBe('pth-1');
    expect(normalized.date).toBe('2026-09-05');
  });

  it('returns a frozen copy', () => {
    const r = make();
    const normalized = normalizePublicTalkHistoryRecord(r);
    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalized).not.toBe(r);
  });

  it('throws on invalid type in input', () => {
    const bad = { ...make(), type: 'unknown' } as any;
    expect(() => normalizePublicTalkHistoryRecord(bad)).toThrow('Invalid type');
  });

  it('throws on invalid state in input', () => {
    const bad = { ...make(), state: 'pending' } as any;
    expect(() => normalizePublicTalkHistoryRecord(bad)).toThrow('Invalid state');
  });

  it('throws on invalid date in input', () => {
    const bad = { ...make(), date: 'bad-date' } as any;
    expect(() => normalizePublicTalkHistoryRecord(bad)).toThrow('date must be YYYY-MM-DD');
  });

  it('trims whitespace on date during normalize', () => {
    const input = { ...make(), date: '  2026-09-10  ' } as unknown as PublicTalkHistoryRecord;
    const normalized = normalizePublicTalkHistoryRecord(input);
    expect(normalized.date).toBe('2026-09-10');
  });
});

// ─── Tenant isolation ────────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('assertPublicTalkHistoryTenant passes for matching tenant', () => {
    expect(() => assertPublicTalkHistoryTenant(make(), T)).not.toThrow();
  });

  it('assertPublicTalkHistoryTenant throws for different tenant', () => {
    expect(() => assertPublicTalkHistoryTenant(make(), T2)).toThrow('Cross-tenant');
  });

  it('filterPublicTalkHistoryByTenant returns only matching', () => {
    const a1 = make({ id: 'a', tenantId: T });
    const a2 = make({ id: 'b', tenantId: T2, weekendMeetingId: 'wm-2' });
    const result = filterPublicTalkHistoryByTenant([a1, a2], T);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('filterPublicTalkHistoryByTenant returns empty for no match', () => {
    expect(filterPublicTalkHistoryByTenant([make()], T2)).toHaveLength(0);
  });

  it('filterPublicTalkHistoryByTenant returns empty for empty input', () => {
    expect(filterPublicTalkHistoryByTenant([], T)).toHaveLength(0);
  });

  it('filterPublicTalkHistoryBySpeaker does not leak cross-tenant', () => {
    const a1 = make({ id: 'a', tenantId: T, speakerId: 'sp-1' });
    const a2 = make({ id: 'b', tenantId: T2, speakerId: 'sp-1', weekendMeetingId: 'wm-2' });
    // Filter by speaker first, then assert tenant on each result
    const bySpeaker = filterPublicTalkHistoryBySpeaker([a1, a2], 'sp-1');
    expect(bySpeaker).toHaveLength(2);
    // Now apply tenant filter
    const tenantOnly = filterPublicTalkHistoryByTenant(bySpeaker, T);
    expect(tenantOnly).toHaveLength(1);
    expect(tenantOnly[0].id).toBe('a');
  });
});

// ─── Filter by speaker ───────────────────────────────────────────────────────

describe('filterPublicTalkHistoryBySpeaker', () => {
  it('returns records for given speaker', () => {
    const a1 = make({ id: 'a', speakerId: 'sp-1' });
    const a2 = make({ id: 'b', speakerId: 'sp-2' });
    const result = filterPublicTalkHistoryBySpeaker([a1, a2], 'sp-1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  it('returns empty when no match', () => {
    expect(filterPublicTalkHistoryBySpeaker([make()], 'sp-999')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterPublicTalkHistoryBySpeaker([], 'sp-1')).toHaveLength(0);
  });
});

// ─── Filter by outline ───────────────────────────────────────────────────────

describe('filterPublicTalkHistoryByOutline', () => {
  it('returns records for given outline', () => {
    const a1 = make({ id: 'a', talkOutlineId: 'to-1' });
    const a2 = make({ id: 'b', talkOutlineId: 'to-2' });
    const result = filterPublicTalkHistoryByOutline([a1, a2], 'to-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('returns empty when no match', () => {
    expect(filterPublicTalkHistoryByOutline([make()], 'to-999')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterPublicTalkHistoryByOutline([], 'to-1')).toHaveLength(0);
  });
});

// ─── Filter by congregation ──────────────────────────────────────────────────

describe('filterPublicTalkHistoryByCongregation', () => {
  it('returns records for given congregation', () => {
    const a1 = make({ id: 'a', congregationId: 'cong-1' });
    const a2 = make({ id: 'b', congregationId: 'cong-2' });
    const result = filterPublicTalkHistoryByCongregation([a1, a2], 'cong-2');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('returns empty when no match', () => {
    expect(filterPublicTalkHistoryByCongregation([make()], 'cong-999')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterPublicTalkHistoryByCongregation([], 'cong-1')).toHaveLength(0);
  });
});

// ─── Filter by date range ────────────────────────────────────────────────────

describe('filterPublicTalkHistoryByDateRange', () => {
  const records = makeMulti(3); // 2026-09-05, 2026-09-06, 2026-09-07

  it('returns records within range', () => {
    const result = filterPublicTalkHistoryByDateRange(records, '2026-09-05', '2026-09-06');
    expect(result).toHaveLength(2);
  });

  it('inclusive on both bounds', () => {
    const result = filterPublicTalkHistoryByDateRange(records, '2026-09-06', '2026-09-06');
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2026-09-06');
  });

  it('returns empty when range does not overlap', () => {
    const result = filterPublicTalkHistoryByDateRange(records, '2026-10-01', '2026-10-31');
    expect(result).toHaveLength(0);
  });

  it('throws on invalid from date', () => {
    expect(() => filterPublicTalkHistoryByDateRange(records, 'bad', '2026-09-30')).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid to date', () => {
    expect(() => filterPublicTalkHistoryByDateRange(records, '2026-09-01', 'bad')).toThrow('YYYY-MM-DD');
  });

  it('returns empty for empty input', () => {
    expect(filterPublicTalkHistoryByDateRange([], '2026-01-01', '2026-12-31')).toHaveLength(0);
  });

  it('handles from = to (single day)', () => {
    const result = filterPublicTalkHistoryByDateRange(records, '2026-09-05', '2026-09-05');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('pth-1');
  });

  it('full range returns all', () => {
    const result = filterPublicTalkHistoryByDateRange(records, '2026-09-01', '2026-09-30');
    expect(result).toHaveLength(3);
  });
});

// ─── lastUseOfOutline ────────────────────────────────────────────────────────

describe('lastUseOfOutline', () => {
  it('returns most recent date for outline', () => {
    const records = [
      make({ id: 'a', talkOutlineId: 'to-1', date: '2026-01-15' }),
      make({ id: 'b', talkOutlineId: 'to-1', date: '2026-06-20' }),
      make({ id: 'c', talkOutlineId: 'to-2', date: '2026-12-01' }),
    ];
    expect(lastUseOfOutline(records, 'to-1')).toBe('2026-06-20');
  });

  it('returns null when outline never used', () => {
    expect(lastUseOfOutline([], 'to-99')).toBeNull();
  });

  it('returns the date when only one record exists', () => {
    const records = [make({ talkOutlineId: 'to-5' })];
    expect(lastUseOfOutline(records, 'to-5')).toBe('2026-09-05');
  });
});

// ─── lastUseOfSpeaker ────────────────────────────────────────────────────────

describe('lastUseOfSpeaker', () => {
  it('returns most recent date for speaker', () => {
    const records = [
      make({ id: 'a', speakerId: 'sp-1', date: '2026-03-10' }),
      make({ id: 'b', speakerId: 'sp-1', date: '2026-08-25' }),
      make({ id: 'c', speakerId: 'sp-2', date: '2026-12-01' }),
    ];
    expect(lastUseOfSpeaker(records, 'sp-1')).toBe('2026-08-25');
  });

  it('returns null when speaker never used', () => {
    expect(lastUseOfSpeaker([], 'sp-99')).toBeNull();
  });

  it('returns the date when only one record exists', () => {
    const records = [make({ speakerId: 'sp-5' })];
    expect(lastUseOfSpeaker(records, 'sp-5')).toBe('2026-09-05');
  });
});

// ─── historyOfOutline ────────────────────────────────────────────────────────

describe('historyOfOutline', () => {
  it('returns all records for outline', () => {
    const records = [
      make({ id: 'a', talkOutlineId: 'to-1' }),
      make({ id: 'b', talkOutlineId: 'to-2' }),
      make({ id: 'c', talkOutlineId: 'to-1', date: '2026-10-01' }),
    ];
    const result = historyOfOutline(records, 'to-1');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('returns empty for no match', () => {
    expect(historyOfOutline([make()], 'to-999')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(historyOfOutline([], 'to-1')).toHaveLength(0);
  });
});

// ─── historyOfSpeaker ────────────────────────────────────────────────────────

describe('historyOfSpeaker', () => {
  it('returns all records for speaker', () => {
    const records = [
      make({ id: 'a', speakerId: 'sp-1' }),
      make({ id: 'b', speakerId: 'sp-2' }),
      make({ id: 'c', speakerId: 'sp-1', date: '2026-10-01' }),
    ];
    const result = historyOfSpeaker(records, 'sp-1');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(['a', 'c']);
  });

  it('returns empty for no match', () => {
    expect(historyOfSpeaker([make()], 'sp-999')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(historyOfSpeaker([], 'sp-1')).toHaveLength(0);
  });
});

// ─── previousCombinations ────────────────────────────────────────────────────

describe('previousCombinations', () => {
  it('returns records matching both speaker and outline', () => {
    const records = [
      make({ id: 'a', speakerId: 'sp-1', talkOutlineId: 'to-1', date: '2026-01-15' }),
      make({ id: 'b', speakerId: 'sp-1', talkOutlineId: 'to-2' }),
      make({ id: 'c', speakerId: 'sp-2', talkOutlineId: 'to-1' }),
      make({ id: 'd', speakerId: 'sp-1', talkOutlineId: 'to-1', date: '2026-06-20' }),
    ];
    const result = previousCombinations(records, 'sp-1', 'to-1');
    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toEqual(['a', 'd']);
  });

  it('returns empty when no combination found', () => {
    const records = [make({ speakerId: 'sp-1', talkOutlineId: 'to-1' })];
    expect(previousCombinations(records, 'sp-1', 'to-2')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(previousCombinations([], 'sp-1', 'to-1')).toHaveLength(0);
  });
});

// ─── orderPublicTalkHistoryByDate ────────────────────────────────────────────

describe('orderPublicTalkHistoryByDate', () => {
  it('sorts ascending by date then by id', () => {
    const a1 = make({ id: 'c', date: '2026-09-07' });
    const a2 = make({ id: 'b', date: '2026-09-06' });
    const a3 = make({ id: 'a', date: '2026-09-06' });
    const sorted = orderPublicTalkHistoryByDate([a1, a2, a3]);
    expect(sorted.map(s => s.id)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty for empty input', () => {
    expect(orderPublicTalkHistoryByDate([])).toEqual([]);
  });

  it('returns single element unchanged', () => {
    const a = make();
    expect(orderPublicTalkHistoryByDate([a])).toEqual([a]);
  });

  it('does not mutate original', () => {
    const a1 = make({ id: 'a', date: '2026-09-07' });
    const a2 = make({ id: 'b', date: '2026-09-06' });
    const original = [a1, a2];
    orderPublicTalkHistoryByDate(original);
    expect(original[0].id).toBe('a');
  });

  it('returns new array', () => {
    const arr = makeMulti(2);
    const sorted = orderPublicTalkHistoryByDate(arr);
    expect(sorted).not.toBe(arr);
  });
});

// ─── countTalksByOutline ─────────────────────────────────────────────────────

describe('countTalksByOutline', () => {
  it('counts all talks for outline without date range', () => {
    const records = [
      make({ id: 'a', talkOutlineId: 'to-1', date: '2026-01-15' }),
      make({ id: 'b', talkOutlineId: 'to-1', date: '2026-06-20' }),
      make({ id: 'c', talkOutlineId: 'to-2' }),
    ];
    expect(countTalksByOutline(records, 'to-1')).toBe(2);
  });

  it('counts with date range', () => {
    const records = [
      make({ id: 'a', talkOutlineId: 'to-1', date: '2026-01-15' }),
      make({ id: 'b', talkOutlineId: 'to-1', date: '2026-06-20' }),
      make({ id: 'c', talkOutlineId: 'to-1', date: '2026-12-01' }),
    ];
    expect(countTalksByOutline(records, 'to-1', '2026-03-01', '2026-09-30')).toBe(1);
  });

  it('counts zero when no match', () => {
    expect(countTalksByOutline([], 'to-99')).toBe(0);
  });

  it('counts zero with date range excluding all', () => {
    const records = [make({ talkOutlineId: 'to-1', date: '2026-01-01' })];
    expect(countTalksByOutline(records, 'to-1', '2026-06-01', '2026-12-31')).toBe(0);
  });

  it('throws on invalid from date', () => {
    expect(() => countTalksByOutline([], 'to-1', 'bad')).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid to date', () => {
    expect(() => countTalksByOutline([], 'to-1', '2026-01-01', 'bad')).toThrow('YYYY-MM-DD');
  });
});

// ─── countTalksBySpeaker ─────────────────────────────────────────────────────

describe('countTalksBySpeaker', () => {
  it('counts all talks for speaker without date range', () => {
    const records = [
      make({ id: 'a', speakerId: 'sp-1', date: '2026-01-15' }),
      make({ id: 'b', speakerId: 'sp-1', date: '2026-06-20' }),
      make({ id: 'c', speakerId: 'sp-2' }),
    ];
    expect(countTalksBySpeaker(records, 'sp-1')).toBe(2);
  });

  it('counts with date range', () => {
    const records = [
      make({ id: 'a', speakerId: 'sp-1', date: '2026-01-15' }),
      make({ id: 'b', speakerId: 'sp-1', date: '2026-06-20' }),
      make({ id: 'c', speakerId: 'sp-1', date: '2026-12-01' }),
    ];
    expect(countTalksBySpeaker(records, 'sp-1', '2026-03-01', '2026-09-30')).toBe(1);
  });

  it('counts zero when no match', () => {
    expect(countTalksBySpeaker([], 'sp-99')).toBe(0);
  });

  it('throws on invalid from date', () => {
    expect(() => countTalksBySpeaker([], 'sp-1', 'bad')).toThrow('YYYY-MM-DD');
  });

  it('throws on invalid to date', () => {
    expect(() => countTalksBySpeaker([], 'sp-1', '2026-01-01', 'bad')).toThrow('YYYY-MM-DD');
  });
});

// ─── Immutability ────────────────────────────────────────────────────────────

describe('immutability', () => {
  it('record is frozen', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('mutation attempt throws in strict mode', () => {
    const r = make();
    expect(() => { (r as any).type = 'away'; }).toThrow();
  });

  it('filter returns new array', () => {
    const arr = makeMulti(2);
    const filtered = filterPublicTalkHistoryBySpeaker(arr, 'sp-1');
    expect(filtered).not.toBe(arr);
  });

  it('order returns new array', () => {
    const arr = makeMulti(2);
    const sorted = orderPublicTalkHistoryByDate(arr);
    expect(sorted).not.toBe(arr);
  });
});

// ─── Append-only verification ────────────────────────────────────────────────

describe('append-only (no update/delete exported)', () => {
  it('module does not export update or delete functions', async () => {
    const mod = await import('./public-talk-history');
    const exported = Object.keys(mod);
    expect(exported).not.toContain('updatePublicTalkHistory');
    expect(exported).not.toContain('deletePublicTalkHistory');
    expect(exported).not.toContain('removePublicTalkHistory');
    expect(exported).not.toContain('editPublicTalkHistory');
    expect(exported).not.toContain('modifyPublicTalkHistory');
  });
});

// ─── Empty inputs ────────────────────────────────────────────────────────────

describe('empty inputs', () => {
  it('lastUseOfOutline returns null', () => {
    expect(lastUseOfOutline([], 'to-1')).toBeNull();
  });

  it('lastUseOfSpeaker returns null', () => {
    expect(lastUseOfSpeaker([], 'sp-1')).toBeNull();
  });

  it('historyOfOutline returns empty', () => {
    expect(historyOfOutline([], 'to-1')).toEqual([]);
  });

  it('historyOfSpeaker returns empty', () => {
    expect(historyOfSpeaker([], 'sp-1')).toEqual([]);
  });

  it('previousCombinations returns empty', () => {
    expect(previousCombinations([], 'sp-1', 'to-1')).toEqual([]);
  });

  it('orderPublicTalkHistoryByDate returns empty', () => {
    expect(orderPublicTalkHistoryByDate([])).toEqual([]);
  });

  it('countTalksByOutline returns 0', () => {
    expect(countTalksByOutline([], 'to-1')).toBe(0);
  });

  it('countTalksBySpeaker returns 0', () => {
    expect(countTalksBySpeaker([], 'sp-1')).toBe(0);
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

  it('non-string type throws', () => {
    expect(() => make({ type: 1 as any })).toThrow('Invalid type');
  });

  it('non-string state throws', () => {
    expect(() => make({ state: true as any })).toThrow('Invalid state');
  });

  it('undefined recordedAt throws', () => {
    expect(() => make({ recordedAt: undefined as any })).toThrow('Invalid ISO date');
  });

  it('object injection via prototype pollution does not affect output', () => {
    const r = make();
    expect((r as any).polluted).toBeUndefined();
  });

  it('date 2026-13-01 throws', () => {
    expect(() => make({ date: '2026-13-01' })).toThrow('Invalid date');
  });

  it('type as object throws', () => {
    expect(() => make({ type: {} as any })).toThrow('Invalid type');
  });

  it('state as number throws', () => {
    expect(() => make({ state: 0 as any })).toThrow('Invalid state');
  });

  it('recordedAt as number throws', () => {
    expect(() => make({ recordedAt: 1692624000000 as any })).toThrow('Invalid ISO date');
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same input produces identical output', () => {
    const a = make();
    const b = make();
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
    expect(a.recordedAt).toBe(b.recordedAt);
  });

  it('orderPublicTalkHistoryByDate is deterministic', () => {
    const records = makeMulti(5);
    const a = orderPublicTalkHistoryByDate(records);
    const b = orderPublicTalkHistoryByDate(records);
    expect(a.map(r => r.id)).toEqual(b.map(r => r.id));
  });

  it('countTalksByOutline is deterministic', () => {
    const records = makeMulti(3);
    expect(countTalksByOutline(records, 'to-1')).toBe(countTalksByOutline(records, 'to-1'));
  });

  it('countTalksBySpeaker is deterministic', () => {
    const records = makeMulti(3);
    expect(countTalksBySpeaker(records, 'sp-1')).toBe(countTalksBySpeaker(records, 'sp-1'));
  });
});
