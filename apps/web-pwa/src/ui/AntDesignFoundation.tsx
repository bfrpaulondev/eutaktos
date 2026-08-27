import { ConfigProvider, theme as antTheme, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import ptPT from 'antd/locale/pt_PT';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePaletteId,
  type ColorMode,
  type Locale,
  type Preferences,
} from '../lib/preferences';
import { EUTAKTOS_PALETTES, readableTextColor, type EutaktosPalette } from '../theme';

const STORAGE_KEY = 'eutaktos.preferences.v4';
const LEGACY_STORAGE_KEYS = ['eutaktos.preferences.v3', 'eutaktos.preferences.v2', 'eutaktos.preferences.v1'] as const;

export type EffectiveColorMode = 'light' | 'dark';

const TEXT_SIZE_PX: Record<Preferences['textSize'], number> = { small: 13, default: 14, large: 16, 'extra-large': 18 };
const TEXT_SIZE_PERCENT: Record<Preferences['textSize'], number> = { small: 87.5, default: 100, large: 112.5, 'extra-large': 125 };

export function resolveAntDesignMode(colorMode: ColorMode, systemPrefersDark: boolean): EffectiveColorMode {
  if (colorMode === 'dark') return 'dark';
  if (colorMode === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

export function resolveAntDesignPalette(preferences: Preferences, systemPrefersDark: boolean): EutaktosPalette {
  const paletteId = resolvePaletteId(preferences.paletteId, preferences.colorMode, systemPrefersDark);
  return EUTAKTOS_PALETTES[paletteId];
}

export function buildAntDesignTheme(preferences: Preferences, systemPrefersDark: boolean): ThemeConfig {
  const selected = resolveAntDesignPalette(preferences, systemPrefersDark);
  const mode = selected.mode;
  const border = preferences.highContrast ? selected.text : selected.muted;
  const muted = preferences.highContrast
    ? selected.text
    : readableTextColor(selected.muted, [selected.background, selected.surface], selected.text);

  return {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: selected.primary,
      colorPrimaryText: selected.primaryContrast,
      colorBgBase: selected.background,
      colorBgLayout: selected.background,
      colorBgContainer: selected.surface,
      colorBgElevated: selected.elevated,
      colorPrimaryBg: selected.background,
      colorText: selected.text,
      colorTextSecondary: muted,
      colorBorder: border,
      colorBorderSecondary: border,
      colorSuccess: selected.status.success,
      colorWarning: selected.status.warning,
      colorError: selected.status.error,
      colorInfo: selected.status.info,
      colorLink: selected.primary,
      borderRadius: 12,
      borderRadiusLG: 16,
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      fontSize: TEXT_SIZE_PX[preferences.textSize],
      controlHeight: preferences.density === 'compact' ? 36 : 44,
      lineWidth: preferences.highContrast ? 2 : 1,
      motion: !preferences.reducedMotion,
    },
  };
}

export function resolveAntDesignLocale(locale: Locale) {
  if (locale === 'en') return enUS;
  if (locale === 'es') return esES;
  return ptPT;
}

function readPreferences(): Preferences {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizePreferences(JSON.parse(current));
    for (const key of LEGACY_STORAGE_KEYS) {
      const stored = localStorage.getItem(key);
      if (stored) return normalizePreferences(JSON.parse(stored));
    }
  } catch {
    return DEFAULT_PREFERENCES;
  }
  return DEFAULT_PREFERENCES;
}

function currentSystemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

function usePreferenceBridge(): { preferences: Preferences; systemPrefersDark: boolean } {
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [systemPrefersDark, setSystemPrefersDark] = useState(currentSystemPrefersDark);

  useEffect(() => {
    const refreshPreferences = () => setPreferences(readPreferences());
    const root = document.documentElement;
    const observer = new MutationObserver(refreshPreferences);
    observer.observe(root, { attributes: true, attributeFilter: ['lang', 'data-palette', 'data-text-size', 'data-color-mode'] });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemModeChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener('change', onSystemModeChange);
    window.addEventListener('storage', refreshPreferences);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', onSystemModeChange);
      window.removeEventListener('storage', refreshPreferences);
    };
  }, []);

  return { preferences, systemPrefersDark };
}

function hexAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function applyAntDocumentTheme(preferences: Preferences, systemPrefersDark: boolean): void {
  const selected = resolveAntDesignPalette(preferences, systemPrefersDark);
  const root = document.documentElement;
  root.style.colorScheme = selected.mode;
  root.style.fontSize = `${TEXT_SIZE_PERCENT[preferences.textSize]}%`;
  root.style.setProperty('--eutaktos-focus', selected.focus);
  root.style.setProperty('--eutaktos-background', selected.background);
  root.style.setProperty('--eutaktos-surface', selected.surface);
  root.style.setProperty('--eutaktos-text', selected.text);
  document.body.style.backgroundColor = selected.background;
  document.body.style.color = selected.text;
  document.body.style.backgroundImage = preferences.reducedTransparency
    ? 'none'
    : `radial-gradient(circle at 18% -8%, ${hexAlpha(selected.primary, selected.mode === 'dark' ? 0.16 : 0.09)}, transparent 30%), radial-gradient(circle at 88% 4%, ${hexAlpha(selected.status.info, selected.mode === 'dark' ? 0.1 : 0.055)}, transparent 25%)`;
}

export function AntDesignFoundation({ children }: { children: ReactNode }) {
  const { preferences, systemPrefersDark } = usePreferenceBridge();
  const antThemeConfig = useMemo(() => buildAntDesignTheme(preferences, systemPrefersDark), [preferences, systemPrefersDark]);
  const locale = useMemo(() => resolveAntDesignLocale(preferences.locale), [preferences.locale]);

  useEffect(() => {
    applyAntDocumentTheme(preferences, systemPrefersDark);
  }, [preferences, systemPrefersDark]);

  return <ConfigProvider componentSize={preferences.density === 'compact' ? 'small' : 'middle'} locale={locale} theme={antThemeConfig}>{children}</ConfigProvider>;
}
