import { describe, expect, it } from 'vitest';
import { contrastRatio, EUTAKTOS_PALETTES, EUTAKTOS_STATUS_KEYS, readableTextColor, statusColor } from './theme';

const paletteIds = Object.keys(EUTAKTOS_PALETTES) as Array<keyof typeof EUTAKTOS_PALETTES>;

describe('Eutaktos design system', () => {
  it('keeps the six coherent user presets in their approved order', () => {
    expect(Object.keys(EUTAKTOS_PALETTES)).toEqual(['classic', 'warm', 'green', 'blue', 'dark', 'pastel']);
    expect(paletteIds.map(id => EUTAKTOS_PALETTES[id].label)).toEqual(['Clássica', 'Acolhedora', 'Calma', 'Foco', 'Noturna', 'Alto contraste']);
  });

  it('uses the Eutaktos teal identity as classic primary rather than reusing text as an action color', () => {
    const palette = EUTAKTOS_PALETTES.classic;
    expect(palette.primary).toBe('#2F6F73');
    expect(palette.primary).not.toBe(palette.text);
    expect(palette.primaryContrast).toBe('#FFFFFF');
  });

  it('keeps normal and resolved secondary text plus primary actions at WCAG AA contrast in every preset', () => {
    for (const paletteId of paletteIds) {
      const palette = EUTAKTOS_PALETTES[paletteId];
      const surfaces = [palette.background, palette.surface];
      const secondary = readableTextColor(palette.muted, surfaces, palette.text);
      for (const surface of surfaces) {
        expect(contrastRatio(palette.text, surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(secondary, surface)).toBeGreaterThanOrEqual(4.5);
      }
      expect(contrastRatio(palette.primary, palette.primaryContrast)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('provides a complete semantic status vocabulary in every preset', () => {
    for (const paletteId of paletteIds) for (const status of EUTAKTOS_STATUS_KEYS) expect(statusColor(paletteId, status)).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('uses a layered, non-black night mode', () => {
    const dark = EUTAKTOS_PALETTES.dark;
    expect(dark.mode).toBe('dark');
    expect(dark.background).toBe('#111B22');
    expect(dark.surface).not.toBe(dark.background);
    expect(dark.elevated).not.toBe(dark.surface);
    expect(dark.primary).toBe('#6BC7C4');
  });

  it('keeps the palette catalog framework-neutral after MUI retirement', async () => {
    const source = await import('./theme?raw').then(module => module.default as string);
    expect(source).not.toContain('@mui/material');
    expect(source).not.toContain('@emotion/');
  });
});
