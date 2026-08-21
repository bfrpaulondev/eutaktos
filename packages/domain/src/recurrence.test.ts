import { describe, it, expect } from 'vitest';
import { expandRecurrence, createRecurrenceRule } from './recurrence';

describe('createRecurrenceRule', () => {
  it('validates weekly requires dayOfWeek', () => {
    expect(() => createRecurrenceRule({ frequency: 'weekly', interval: 1 })).toThrow('dayOfWeek is required');
    expect(() => createRecurrenceRule({ frequency: 'weekly', interval: 1, dayOfWeek: 3 })).not.toThrow();
  });
  it('validates monthly requires dayOfMonth', () => {
    expect(() => createRecurrenceRule({ frequency: 'monthly', interval: 1 })).toThrow('dayOfMonth is required');
  });
  it('validates yearly requires monthOfYear + dayOfMonth', () => {
    expect(() => createRecurrenceRule({ frequency: 'yearly', interval: 1 })).toThrow('monthOfYear is required');
  });
  it('rejects invalid interval', () => {
    expect(() => createRecurrenceRule({ frequency: 'weekly', interval: 0, dayOfWeek: 1 })).toThrow('interval must be a positive');
    expect(() => createRecurrenceRule({ frequency: 'weekly', interval: 100, dayOfWeek: 1 })).toThrow('interval is too large');
  });
});

describe('expandRecurrence', () => {
  it('weekly basic', () => {
    // 2026-08-19 is a Wednesday (day 3)
    const dates = expandRecurrence({ frequency: 'weekly', interval: 1, dayOfWeek: 3 }, { from: '2026-08-19T00:00:00Z', until: '2026-09-01T00:00:00Z' });
    expect(dates).toEqual(['2026-08-19', '2026-08-26']);
  });

  it('weekly every 2 weeks', () => {
    const dates = expandRecurrence({ frequency: 'weekly', interval: 2, dayOfWeek: 0 }, { from: '2026-08-01T00:00:00Z', until: '2026-09-30T00:00:00Z' });
    // First Sunday on or after Aug 1 is Aug 2
    expect(dates[0]).toBe('2026-08-02');
    expect(dates[1]).toBe('2026-08-16');
    expect(dates[2]).toBe('2026-08-30');
  });

  it('monthly basic', () => {
    const dates = expandRecurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 15 }, { from: '2026-08-01T00:00:00Z', until: '2026-10-31T00:00:00Z' });
    expect(dates).toEqual(['2026-08-15', '2026-09-15', '2026-10-15']);
  });

  it('monthly day 31 clamped to feb', () => {
    const dates = expandRecurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 31 }, { from: '2026-01-01T00:00:00Z', until: '2026-03-31T00:00:00Z' });
    // Jan 31, Feb has 28 days (2026 not leap), Mar 31
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('monthly day 30 clamped to feb', () => {
    const dates = expandRecurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 30 }, { from: '2026-01-01T00:00:00Z', until: '2026-03-31T00:00:00Z' });
    expect(dates).toEqual(['2026-01-30', '2026-02-28', '2026-03-30']);
  });

  it('yearly basic', () => {
    const dates = expandRecurrence({ frequency: 'yearly', interval: 1, monthOfYear: 3, dayOfMonth: 14 }, { from: '2024-01-01T00:00:00Z', until: '2027-12-31T00:00:00Z' });
    expect(dates).toEqual(['2024-03-14', '2025-03-14', '2026-03-14', '2027-03-14']);
  });

  it('yearly leap year feb 29', () => {
    const dates = expandRecurrence({ frequency: 'yearly', interval: 1, monthOfYear: 2, dayOfMonth: 29 }, { from: '2024-01-01T00:00:00Z', until: '2028-12-31T00:00:00Z' });
    // Feb 29 only exists in leap years; non-leap years clamp to Feb 28
    expect(dates).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);
  });

  it('yearly non-leap clamps feb 29 to 28', () => {
    const dates = expandRecurrence({ frequency: 'yearly', interval: 1, monthOfYear: 2, dayOfMonth: 29 }, { from: '2025-01-01T00:00:00Z', until: '2027-12-31T00:00:00Z' });
    expect(dates).toEqual(['2025-02-28', '2026-02-28', '2027-02-28']);
  });

  it('expansion limit', () => {
    const dates = expandRecurrence({ frequency: 'weekly', interval: 1, dayOfWeek: 1 }, { from: '2020-01-01T00:00:00Z', until: '2030-12-31T00:00:00Z' });
    // Should stop at MAX_EXPANSION (500)
    expect(dates.length).toBe(500);
  });

  it('throws on inverted window', () => {
    expect(() => expandRecurrence({ frequency: 'weekly', interval: 1, dayOfWeek: 1 }, { from: '2026-08-20T00:00:00Z', until: '2026-08-19T00:00:00Z' })).toThrow('Window from must be before until');
  });

  it('window from == until returns empty', () => {
    const dates = expandRecurrence({ frequency: 'weekly', interval: 1, dayOfWeek: 1 }, { from: '2026-08-20T00:00:00Z', until: '2026-08-20T00:00:00Z' });
    expect(dates).toEqual([]);
  });

  it('deterministic output', () => {
    const rule = { frequency: 'monthly' as const, interval: 1, dayOfMonth: 1 };
    const window = { from: '2026-01-01T00:00:00Z', until: '2026-06-30T00:00:00Z' };
    expect(expandRecurrence(rule, window)).toEqual(expandRecurrence(rule, window));
  });

  it('throws on invalid window', () => {
    expect(() => expandRecurrence({ frequency: 'weekly', interval: 1, dayOfWeek: 1 }, { from: 'bad', until: '2026-08-20T00:00:00Z' })).toThrow('Invalid ISO date');
  });

  it('frozen output', () => {
    const dates = expandRecurrence({ frequency: 'monthly', interval: 1, dayOfMonth: 1 }, { from: '2026-01-01T00:00:00Z', until: '2026-01-31T00:00:00Z' });
    expect(Object.isFrozen(dates)).toBe(true);
  });
});
