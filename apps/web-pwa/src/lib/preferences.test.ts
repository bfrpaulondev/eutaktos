import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences';

describe('normalizePreferences', () => {
  it('returns safe defaults for missing input', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('uses Neutral Classic as the default palette', () => {
    expect(DEFAULT_PREFERENCES.paletteId).toBe('classic');
  });

  it('preserves supported preferences', () => {
    expect(normalizePreferences({
      paletteId: 'dark',
      density: 'compact',
      locale: 'en',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    })).toEqual({
      paletteId: 'dark',
      density: 'compact',
      locale: 'en',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    });
  });

  it('falls back when persisted values are unsupported', () => {
    const unsafe = { paletteId: 'neon', density: 'tiny', locale: 'xx' } as never;
    expect(normalizePreferences(unsafe)).toEqual(DEFAULT_PREFERENCES);
  });
});
