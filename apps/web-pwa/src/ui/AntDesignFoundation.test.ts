import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
import { EUTAKTOS_PALETTES } from '../theme';
import { buildAntDesignTheme, resolveAntDesignMode, resolveAntDesignPalette } from './AntDesignFoundation';

function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return { ...DEFAULT_PREFERENCES, ...overrides };
}

describe('resolveAntDesignMode', () => {
  it('keeps explicit light mode authoritative even when the operating system is dark', () => {
    expect(resolveAntDesignMode('light', true)).toBe('light');
  });

  it('keeps explicit dark mode authoritative even when the operating system is light', () => {
    expect(resolveAntDesignMode('dark', false)).toBe('dark');
  });

  it('follows the operating system only in system mode', () => {
    expect(resolveAntDesignMode('system', false)).toBe('light');
    expect(resolveAntDesignMode('system', true)).toBe('dark');
  });
});

describe('buildAntDesignTheme', () => {
  it('uses the selected Eutaktos palette for Ant semantic surfaces', () => {
    const warm = buildAntDesignTheme(preferences({ colorMode: 'light', paletteId: 'warm' }), false);
    expect(warm.token?.colorBgBase).toBe(EUTAKTOS_PALETTES.warm.background);
    expect(warm.token?.colorBgContainer).toBe(EUTAKTOS_PALETTES.warm.surface);
    expect(warm.token?.colorPrimary).toBe(EUTAKTOS_PALETTES.warm.primary);
  });

  it('forces the dark palette for explicit/system dark while preserving light palette choices otherwise', () => {
    expect(resolveAntDesignPalette(preferences({ colorMode: 'dark', paletteId: 'warm' }), false).id).toBe('dark');
    expect(resolveAntDesignPalette(preferences({ colorMode: 'system', paletteId: 'blue' }), true).id).toBe('dark');
    expect(resolveAntDesignPalette(preferences({ colorMode: 'system', paletteId: 'blue' }), false).id).toBe('blue');
  });

  it('reflects accessibility and density preferences in component tokens', () => {
    const configured = buildAntDesignTheme(preferences({ colorMode: 'light', density: 'compact', highContrast: true, reducedMotion: true, textSize: 'large' }), false);
    expect(configured.token?.controlHeight).toBe(36);
    expect(configured.token?.lineWidth).toBe(2);
    expect(configured.token?.motion).toBe(false);
    expect(configured.token?.fontSize).toBe(16);
    expect(configured.token?.colorTextSecondary).toBe(EUTAKTOS_PALETTES.classic.text);
  });
});
