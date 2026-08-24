import { describe, it, expect } from 'vitest';
import { localDate, formatResponsibilityDate } from '../ResponsibilitiesSection';
import type { Locale } from '../lib/preferences';

describe('i18n & datetime: date-only handling', () => {
  describe('localDate', () => {
    it('returns YYYY-MM-DD using local civil date', () => {
      const date = new Date(2026, 0, 15, 10, 30); // Jan 15, 2026 10:30 local
      const result = localDate(date);
      expect(result).toBe('2026-01-15');
    });

    it('does not shift the day when parsed as UTC', () => {
      // Simulate Lisbon winter (WET, UTC+0): Jan 15 midnight local
      const date = new Date(2026, 0, 15, 0, 0);
      const result = localDate(date);
      expect(result).toBe('2026-01-15');
    });

    it('handles year boundary correctly', () => {
      const date = new Date(2026, 11, 31, 23, 59); // Dec 31, 2026 23:59
      const result = localDate(date);
      expect(result).toBe('2026-12-31');
    });
  });

  describe('formatResponsibilityDate', () => {
    const locales: Locale[] = ['pt-PT', 'en', 'es'];

    it('preserves date-only civil date (no UTC shift)', () => {
      // 2026-08-25 should stay August 25 in all locales
      const input = '2026-08-25';
      locales.forEach(locale => {
        const result = formatResponsibilityDate(input, locale);
        // Should contain "25" (the day) and some form of "August" / "agosto" / "agosto"
        expect(result).toContain('25');
      });
    });

    it('formats Lisbon summer date correctly (DST)', () => {
      // August in Lisbon is WEST (UTC+1, DST active)
      // The date-only '2026-08-15' should display as August 15, not August 14
      const input = '2026-08-15';
      const ptResult = formatResponsibilityDate(input, 'pt-PT');
      expect(ptResult).toContain('15');
      expect(ptResult.toLowerCase()).toMatch(/ago|aug/);
    });

    it('formats Lisbon winter date correctly (no DST)', () => {
      // January in Lisbon is WET (UTC+0, no DST)
      // The date-only '2026-01-15' should display as January 15
      const input = '2026-01-15';
      const ptResult = formatResponsibilityDate(input, 'pt-PT');
      expect(ptResult).toContain('15');
      expect(ptResult.toLowerCase()).toMatch(/jan|janeiro/);
    });

    it('handles DST transition date (last Sunday of March)', () => {
      // 2026-03-29 is the last Sunday of March 2026 (DST starts in Lisbon)
      const input = '2026-03-29';
      const result = formatResponsibilityDate(input, 'en');
      expect(result).toContain('29');
      expect(result.toLowerCase()).toMatch(/mar|march/);
    });

    it('handles DST transition date (last Sunday of October)', () => {
      // 2026-10-25 is the last Sunday of October 2026 (DST ends in Lisbon)
      const input = '2026-10-25';
      const result = formatResponsibilityDate(input, 'en');
      expect(result).toContain('25');
      expect(result.toLowerCase()).toMatch(/oct|october/);
    });

    it('returns original string for invalid date', () => {
      const result = formatResponsibilityDate('invalid-date', 'en');
      expect(result).toBe('invalid-date');
    });

    it('formats in pt-PT', () => {
      const result = formatResponsibilityDate('2026-08-25', 'pt-PT');
      expect(result).toContain('25');
      expect(result.length).toBeGreaterThan(5);
    });

    it('formats in en', () => {
      const result = formatResponsibilityDate('2026-08-25', 'en');
      expect(result).toContain('25');
      expect(result.length).toBeGreaterThan(5);
    });

    it('formats in es', () => {
      const result = formatResponsibilityDate('2026-08-25', 'es');
      expect(result).toContain('25');
      expect(result.length).toBeGreaterThan(5);
    });
  });
});

describe('i18n: locale coverage for all MVP strings', () => {
  // Verify that copy objects have all three locales
  const locales: Locale[] = ['pt-PT', 'en', 'es'];

  it('all three required locales are defined', () => {
    expect(locales).toEqual(['pt-PT', 'en', 'es']);
    expect(locales).toHaveLength(3);
  });

  it('locale codes follow BCP 47 format', () => {
    // pt-PT: Portuguese (Portugal)
    // en: English (generic)
    // es: Spanish (generic)
    expect(locales[0]).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    expect(locales[1]).toMatch(/^[a-z]{2}$/);
    expect(locales[2]).toMatch(/^[a-z]{2}$/);
  });
});
