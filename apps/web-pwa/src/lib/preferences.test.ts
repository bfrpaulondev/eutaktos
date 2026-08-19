import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences } from './preferences';

describe('normalizePreferences', () => {
  it('returns safe defaults for missing input', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('preserves supported preferences', () => {
    expect(normalizePreferences({
      theme: 'dark',
      density: 'compact',
      locale: 'en',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    })).toEqual({
      theme: 'dark',
      density: 'compact',
      locale: 'en',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    });
  });

  it('falls back when persisted values are unsupported', () => {
    const unsafe = { theme: 'neon', density: 'tiny', locale: 'xx' } as never;
    expect(normalizePreferences(unsafe)).toEqual(DEFAULT_PREFERENCES);
  });
});
