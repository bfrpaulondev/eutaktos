import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, normalizePreferences, resolvePaletteId } from './preferences';

describe('normalizePreferences', () => {
  it('returns safe defaults for missing input', () => {
    expect(normalizePreferences(undefined)).toEqual(DEFAULT_PREFERENCES);
  });

  it('uses Classic, system color mode and default text size as defaults', () => {
    expect(DEFAULT_PREFERENCES.paletteId).toBe('classic');
    expect(DEFAULT_PREFERENCES.colorMode).toBe('system');
    expect(DEFAULT_PREFERENCES.textSize).toBe('default');
  });

  it('preserves supported preferences', () => {
    expect(normalizePreferences({
      paletteId: 'blue',
      colorMode: 'light',
      density: 'compact',
      locale: 'en',
      textSize: 'large',
      reducedMotion: true,
      reducedTransparency: true,
      highContrast: true,
    })).toEqual({
      paletteId: 'blue',
      colorMode: 'light',
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
    const unsafe = { paletteId: 'neon', colorMode: 'sepia', density: 'tiny', locale: 'xx', textSize: 'huge' } as never;
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

describe('resolvePaletteId', () => {
  it('uses the selected light palette when light mode is explicit', () => {
    expect(resolvePaletteId('blue', 'light', true)).toBe('blue');
  });

  it('uses the night identity when dark mode is explicit or inherited from the system', () => {
    expect(resolvePaletteId('classic', 'dark', false)).toBe('dark');
    expect(resolvePaletteId('classic', 'system', true)).toBe('dark');
  });

  it('keeps the night preset when it is selected directly', () => {
    expect(resolvePaletteId('dark', 'light', false)).toBe('dark');
  });
});
