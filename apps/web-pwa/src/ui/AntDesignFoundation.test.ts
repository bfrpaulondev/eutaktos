import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, type Preferences } from '../lib/preferences';
import { buildAntDesignTheme, resolveAntDesignMode } from './AntDesignFoundation';

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
  it('uses distinct semantic surfaces for light and dark mode', () => {
    const light = buildAntDesignTheme(preferences({ colorMode: 'light' }), true);
    const dark = buildAntDesignTheme(preferences({ colorMode: 'dark' }), false);

    expect(light.token?.colorBgBase).toBe('#F4F7FA');
    expect(light.token?.colorBgContainer).toBe('#FFFFFF');
    expect(dark.token?.colorBgBase).toBe('#0F151C');
    expect(dark.token?.colorBgContainer).toBe('#18212B');
    expect(light.token?.colorText).not.toBe(dark.token?.colorText);
  });

  it('reflects accessibility and density preferences in component tokens', () => {
    const configured = buildAntDesignTheme(preferences({
      colorMode: 'light',
      density: 'compact',
      highContrast: true,
      reducedMotion: true,
      textSize: 'large',
    }), false);

    expect(configured.token?.controlHeight).toBe(36);
    expect(configured.token?.lineWidth).toBe(2);
    expect(configured.token?.motion).toBe(false);
    expect(configured.token?.fontSize).toBe(16);
  });
});
