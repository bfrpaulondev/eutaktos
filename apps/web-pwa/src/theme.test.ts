import { describe, expect, it } from 'vitest';
import { buildEutaktosTheme, contrastRatio, EUTAKTOS_PALETTES } from './theme';

const paletteIds = Object.keys(EUTAKTOS_PALETTES) as Array<keyof typeof EUTAKTOS_PALETTES>;

function themeFor(paletteId: keyof typeof EUTAKTOS_PALETTES) {
  return buildEutaktosTheme({
    paletteId,
    density: 'comfortable',
    reducedMotion: false,
    reducedTransparency: false,
    highContrast: false,
  });
}

describe('Eutaktos palettes', () => {
  it('keeps Neutral Classic as palette 1', () => {
    expect(EUTAKTOS_PALETTES.classic.colors).toEqual(['#FAFAFA', '#F2F2F2', '#1A1A1A', '#6B6B6B', '#3B82F6']);
  });

  it('contains only the six approved presets', () => {
    expect(Object.keys(EUTAKTOS_PALETTES)).toEqual(['classic', 'warm', 'green', 'blue', 'dark', 'pastel']);
  });

  it('keeps each supplied accent unchanged in the MUI secondary role', () => {
    for (const paletteId of paletteIds) {
      const [, , , , accent] = EUTAKTOS_PALETTES[paletteId].colors;
      expect(themeFor(paletteId).palette.secondary.main).toBe(accent);
    }
  });

  it('maps palette 1 to the expected default Material UI roles', () => {
    const theme = themeFor('classic');
    expect(theme.palette.background.default).toBe('#FAFAFA');
    expect(theme.palette.background.paper).toBe('#F2F2F2');
    expect(theme.palette.text.primary).toBe('#1A1A1A');
    expect(theme.palette.text.secondary).toBe('#6B6B6B');
    expect(theme.palette.primary.main).toBe('#1A1A1A');
    expect(theme.palette.secondary.main).toBe('#3B82F6');
  });

  it('keeps normal primary and secondary text at WCAG AA contrast on background and surface', () => {
    for (const paletteId of paletteIds) {
      const theme = themeFor(paletteId);
      const surfaces = [theme.palette.background.default, theme.palette.background.paper];
      for (const surface of surfaces) {
        expect(contrastRatio(theme.palette.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.palette.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps contained primary action text at WCAG AA contrast in every palette', () => {
    for (const paletteId of paletteIds) {
      const theme = themeFor(paletteId);
      expect(contrastRatio(theme.palette.primary.main, theme.palette.primary.contrastText)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
