export type Density = 'comfortable' | 'compact';
export type Locale = 'pt-PT' | 'en' | 'es';
export type PaletteId = 'classic' | 'warm' | 'green' | 'blue' | 'dark' | 'pastel';

export interface Preferences {
  paletteId: PaletteId;
  density: Density;
  locale: Locale;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  highContrast: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  paletteId: 'classic',
  density: 'comfortable',
  locale: 'pt-PT',
  reducedMotion: false,
  reducedTransparency: false,
  highContrast: false,
};

const PALETTE_IDS: readonly PaletteId[] = ['classic', 'warm', 'green', 'blue', 'dark', 'pastel'];

export function normalizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  const paletteId: PaletteId = PALETTE_IDS.includes(input?.paletteId as PaletteId)
    ? (input?.paletteId as PaletteId)
    : 'classic';
  const density: Density = input?.density === 'compact' ? 'compact' : 'comfortable';
  const locale: Locale = input?.locale === 'en' || input?.locale === 'es' ? input.locale : 'pt-PT';

  return {
    paletteId,
    density,
    locale,
    reducedMotion: Boolean(input?.reducedMotion),
    reducedTransparency: Boolean(input?.reducedTransparency),
    highContrast: Boolean(input?.highContrast),
  };
}
