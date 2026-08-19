import { describe, expect, it } from 'vitest';
import { buildEutaktosTheme, EUTAKTOS_PALETTES } from './theme';

describe('Eutaktos palettes', () => {
  it('keeps Neutral Classic as palette 1', () => {
    expect(EUTAKTOS_PALETTES.classic.colors).toEqual(['#FAFAFA', '#F2F2F2', '#1A1A1A', '#6B6B6B', '#3B82F6']);
  });

  it('contains only the six approved presets', () => {
    expect(Object.keys(EUTAKTOS_PALETTES)).toEqual(['classic', 'warm', 'green', 'blue', 'dark', 'pastel']);
  });

  it('maps the selected preset into the Material UI theme', () => {
    const theme = buildEutaktosTheme({
      paletteId: 'warm',
      density: 'comfortable',
      reducedMotion: false,
      reducedTransparency: false,
      highContrast: false,
    });

    expect(theme.palette.background.default).toBe('#F7F3EE');
    expect(theme.palette.background.paper).toBe('#EDE8E0');
    expect(theme.palette.text.primary).toBe('#2C2926');
    expect(theme.palette.text.secondary).toBe('#8A837B');
    expect(theme.palette.primary.main).toBe('#C17B5C');
  });
});
