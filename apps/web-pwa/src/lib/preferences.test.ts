import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences';

describe('normalizePreferences', () => {
  it('returns safe defaults for missing input', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('uses Neutral Classic and default text size as defaults', () => {
    expect(DEFAULT_PREFERENCES.paletteId).toBe('classic');
    expect(DEFAULT_PREFERENCES.textSize).toBe('default');
  });

  it('preserves supported preferences', () => {
    expect(normalizePreferences({
      paletteId: 'dark',
      density: 'compact',
      locale: 'en',
      textSize: 'large',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    })).toEqual({
      paletteId: 'dark',
      density: 'compact',
      locale: 'en',
      textSize: 'large',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    });
  });

  it('accepts every supported text-size preset', () => {
    for (const textSize of ['small', 'default', 'large', 'extra-large'] as const) {
      expect(normalizePreferences({ textSize }).textSize).toBe(textSize);
    }
  });

  it('falls back when persisted values are unsupported', () => {
    const unsafe = { paletteId: 'neon', density: 'tiny', locale: 'xx', textSize: 'huge' } as never;
    expect(normalizePreferences(unsafe)).toEqual(DEFAULT_PREFERENCES);
  });

  it.each([
    ['string true', 'true'],
    ['string false', 'false'],
    ['number one', 1],
    ['number zero', 0],
    ['null', null],
    ['object', {}],
    ['array', []],
  ])('does not coerce malformed accessibility booleans: %s', (_label, value) => {
    const unsafe = {
      reducedMotion: value,
      reducedTransparency: value,
      highContrast: value,
    } as unknown as Partial<import('./preferences').Preferences>;

    expect(normalizePreferences(unsafe)).toMatchObject({
      reducedMotion: false,
      reducedTransparency: false,
      highContrast: false,
    });
  });
});
