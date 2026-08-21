import { describe, expect, it } from 'vitest';
import { formatAwayPeriodDate, isValidAwayPeriodRange } from './AwayPeriodsSection';

describe('AwayPeriodsSection date validation', () => {
  it('accepts only a period whose end is strictly after its start', () => {
    expect(isValidAwayPeriodRange('2026-08-21', '2026-08-22')).toBe(true);
    expect(isValidAwayPeriodRange('2026-08-21', '2026-08-21')).toBe(false);
    expect(isValidAwayPeriodRange('2026-08-22', '2026-08-21')).toBe(false);
  });

  it('rejects incomplete or malformed dates before the availability API is called', () => {
    expect(isValidAwayPeriodRange('', '2026-08-22')).toBe(false);
    expect(isValidAwayPeriodRange('2026-08-21', '')).toBe(false);
    expect(isValidAwayPeriodRange('not-a-date', '2026-08-22')).toBe(false);
  });
});

describe('AwayPeriodsSection date display', () => {
  it('keeps malformed server values readable rather than throwing during rendering', () => {
    expect(formatAwayPeriodDate('invalid-value', 'pt-PT')).toBe('invalid-value');
  });
});
