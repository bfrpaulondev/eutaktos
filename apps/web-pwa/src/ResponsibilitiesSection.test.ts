import { describe, expect, it } from 'vitest';
import { getResponsibilityStatus, isValidResponsibilityRange, localDate } from './ResponsibilitiesSection';

describe('ResponsibilitiesSection date handling', () => {
  it('accepts an open-ended responsibility or an end strictly after its start', () => {
    expect(isValidResponsibilityRange('2026-08-21', '')).toBe(true);
    expect(isValidResponsibilityRange('2026-08-21', '2026-08-22')).toBe(true);
    expect(isValidResponsibilityRange('2026-08-21', '2026-08-21')).toBe(false);
  });

  it('formats a local date without moving it across the local calendar day', () => {
    expect(localDate(new Date(2026, 7, 21))).toBe('2026-08-21');
  });
});

describe('ResponsibilitiesSection visual status', () => {
  it('marks a responsibility as ended only when the API end date is in the past', () => {
    const now = Date.parse('2026-08-21T12:00:00Z');
    expect(getResponsibilityStatus({ endsAt: '2026-08-20' }, now)).toBe('ended');
    expect(getResponsibilityStatus({ endsAt: '2026-08-22' }, now)).toBe('active');
    expect(getResponsibilityStatus({ endsAt: undefined }, now)).toBe('active');
  });
});
