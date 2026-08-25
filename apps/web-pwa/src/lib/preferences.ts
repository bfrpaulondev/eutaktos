export type Density = 'comfortable' | 'compact';
export type Locale = 'pt-PT' | 'en' | 'es';
export type PaletteId = 'classic' | 'warm' | 'green' | 'blue' | 'dark' | 'pastel';
export type TextSize = 'small' | 'default' | 'large' | 'extra-large';
export type ColorMode = 'light' | 'dark' | 'system';

export interface Preferences {
  paletteId: PaletteId;
  colorMode: ColorMode;
  density: Density;
  locale: Locale;
  textSize: TextSize;
  reducedMotion: boolean;
  reducedTransparency: boolean;
  highContrast: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  paletteId: 'classic',
  colorMode: 'system',
  density: 'comfortable',
  locale: 'pt-PT',
  textSize: 'default',
  reducedMotion: false,
  reducedTransparency: false,
  highContrast: false,
};

const PALETTE_IDS: readonly PaletteId[] = ['classic', 'warm', 'green', 'blue', 'dark', 'pastel'];
const TEXT_SIZES: readonly TextSize[] = ['small', 'default', 'large', 'extra-large'];

function normalizePersistedBoolean(value: unknown): boolean {
  return value === true;
}

export function resolvePaletteId(paletteId: PaletteId, colorMode: ColorMode, systemPrefersDark: boolean): PaletteId {
  if (colorMode === 'dark' || (colorMode === 'system' && systemPrefersDark)) return 'dark';
  // `dark` used to double as a selectable palette. Color mode is now authoritative,
  // so explicit/system-light must never remain dark because of that legacy value.
  return paletteId === 'dark' ? 'classic' : paletteId;
}

export function normalizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  const paletteId: PaletteId = PALETTE_IDS.includes(input?.paletteId as PaletteId)
    ? (input?.paletteId as PaletteId)
    : 'classic';
  const density: Density = input?.density === 'compact' ? 'compact' : 'comfortable';
  const locale: Locale = input?.locale === 'en' || input?.locale === 'es' ? input.locale : 'pt-PT';
  const textSize: TextSize = TEXT_SIZES.includes(input?.textSize as TextSize)
    ? (input?.textSize as TextSize)
    : 'default';
  const colorMode: ColorMode = input?.colorMode === 'light' || input?.colorMode === 'dark' ? input.colorMode : 'system';

  return {
    paletteId,
    colorMode,
    density,
    locale,
    textSize,
    reducedMotion: normalizePersistedBoolean(input?.reducedMotion),
    reducedTransparency: normalizePersistedBoolean(input?.reducedTransparency),
    highContrast: normalizePersistedBoolean(input?.highContrast),
  };
}
