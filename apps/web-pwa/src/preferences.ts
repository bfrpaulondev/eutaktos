import type { Locale } from './i18n';

export type Theme = 'system' | 'light' | 'dark';
export interface Preferences { locale: Locale; theme: Theme; reducedMotion: boolean; highContrast: boolean; }

const key = 'eutaktos.preferences.v1';
const defaults: Preferences = { locale: 'pt-PT', theme: 'system', reducedMotion: false, highContrast: false };

export function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
}

export function savePreferences(preferences: Preferences): void {
  localStorage.setItem(key, JSON.stringify(preferences));
}
