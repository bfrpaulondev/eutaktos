export type Theme = 'light' | 'dark' | 'system';
export type Density = 'comfortable' | 'compact';
export type Locale = 'pt-PT' | 'en' | 'es';

export interface Preferences {
  theme: Theme;
  density: Density;
  locale: Locale;
  reducedMotion: boolean;
  highContrast: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system', density: 'comfortable', locale: 'pt-PT', reducedMotion: false, highContrast: false,
};

export function normalizePreferences(input: Partial<Preferences> | null | undefined): Preferences {
  const theme: Theme = input?.theme === 'light' || input?.theme === 'dark' ? input.theme : 'system';
  const density: Density = input?.density === 'compact' ? 'compact' : 'comfortable';
  const locale: Locale = input?.locale === 'en' || input?.locale === 'es' ? input.locale : 'pt-PT';
  return { theme, density, locale, reducedMotion: Boolean(input?.reducedMotion), highContrast: Boolean(input?.highContrast) };
}
