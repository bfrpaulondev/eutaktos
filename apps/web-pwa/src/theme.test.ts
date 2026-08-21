import { describe, expect, it } from 'vitest';
import { buildEutaktosTheme, contrastRatio, EUTAKTOS_PALETTES, EUTAKTOS_STATUS_KEYS, statusColor } from './theme';

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

describe('Eutaktos design system', () => {
  it('keeps the six coherent user presets in their approved order', () => {
    expect(Object.keys(EUTAKTOS_PALETTES)).toEqual(['classic', 'warm', 'green', 'blue', 'dark', 'pastel']);
    expect(paletteIds.map(id => EUTAKTOS_PALETTES[id].label)).toEqual([
      'Clássica', 'Acolhedora', 'Calma', 'Foco', 'Noturna', 'Alto contraste',
    ]);
  });

  it('uses the Eutaktos teal identity as classic primary rather than reusing text as an action color', () => {
    const theme = themeFor('classic');
    expect(theme.palette.primary.main).toBe('#2F6F73');
    expect(theme.palette.primary.main).not.toBe(theme.palette.text.primary);
    expect(theme.palette.primary.contrastText).toBe('#FFFFFF');
  });

  it('keeps normal text and contained primary actions at WCAG AA contrast in every preset', () => {
    for (const paletteId of paletteIds) {
      const theme = themeFor(paletteId);
      const source = EUTAKTOS_PALETTES[paletteId];
      const surfaces = [source.background, source.surface];
      for (const surface of surfaces) {
        expect(contrastRatio(theme.palette.text.primary, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.palette.text.secondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(theme.palette.primary.main, theme.palette.primary.contrastText)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('provides a complete semantic status vocabulary in every preset', () => {
    for (const paletteId of paletteIds) {
      for (const status of EUTAKTOS_STATUS_KEYS) {
        expect(statusColor(paletteId, status)).toMatch(/^#[0-9A-F]{6}$/i);
      }
    }
  });

  it('uses a layered, non-black night mode', () => {
    const dark = EUTAKTOS_PALETTES.dark;
    expect(dark.mode).toBe('dark');
    expect(dark.background).toBe('#111B22');
    expect(dark.surface).not.toBe(dark.background);
    expect(dark.elevated).not.toBe(dark.surface);
    expect(dark.primary).toBe('#6BC7C4');
  });

  it('makes high contrast and reduced transparency explicit rather than relying on glass', () => {
    const highContrast = buildEutaktosTheme({
      paletteId: 'classic', density: 'comfortable', highContrast: true, reducedMotion: false, reducedTransparency: true,
    });
    const paper = highContrast.components?.MuiPaper?.styleOverrides?.root as { border?: string; backdropFilter?: string };
    expect(paper.border).toContain('2px');
    expect(paper.backdropFilter).toBe('none');
  });
});
