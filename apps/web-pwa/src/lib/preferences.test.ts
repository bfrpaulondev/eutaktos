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
});
