import { describe, expect, it } from 'vitest';
import { dateDraftToIso, formatAwayPeriodDate, hasUnsavedAwayPeriodDraft, isValidAwayPeriodRange } from './AwayPeriodsSection';

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

  it('builds an ISO date only from a complete real calendar date', () => {
    expect(dateDraftToIso({ day: '25', month: '8', year: '2026' })).toBe('2026-08-25');
    expect(dateDraftToIso({ day: '29', month: '2', year: '2028' })).toBe('2028-02-29');
    expect(dateDraftToIso({ day: '29', month: '2', year: '2027' })).toBe('');
    expect(dateDraftToIso({ day: '', month: '8', year: '2026' })).toBe('');
  });
});

describe('AwayPeriodsSection date display', () => {
  it('keeps malformed server values readable rather than throwing during rendering', () => {
    expect(formatAwayPeriodDate('invalid-value', 'pt-PT')).toBe('invalid-value');
  });
});

describe('AwayPeriodsSection unsaved draft guard', () => {
  it('identifies any entered date or reason before a form can be discarded', () => {
    expect(hasUnsavedAwayPeriodDraft('', '', '')).toBe(false);
    expect(hasUnsavedAwayPeriodDraft('2026-08-21', '', '')).toBe(true);
    expect(hasUnsavedAwayPeriodDraft('', '2026-08-22', '')).toBe(true);
    expect(hasUnsavedAwayPeriodDraft('', '', 'away')).toBe(true);
  });
});
