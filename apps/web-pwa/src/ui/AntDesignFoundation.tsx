import { ConfigProvider, theme as antTheme, type ThemeConfig } from 'antd';
import enUS from 'antd/locale/en_US';
import esES from 'antd/locale/es_ES';
import ptPT from 'antd/locale/pt_PT';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type ColorMode,
  type Locale,
  type Preferences,
} from '../lib/preferences';

const STORAGE_KEY = 'eutaktos.preferences.v4';
const LEGACY_STORAGE_KEYS = ['eutaktos.preferences.v3', 'eutaktos.preferences.v2', 'eutaktos.preferences.v1'] as const;

export type EffectiveColorMode = 'light' | 'dark';

interface SemanticColors {
  canvas: string;
  surface: string;
  elevated: string;
  selected: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}

const LIGHT_COLORS: SemanticColors = {
  canvas: '#F4F7FA',
  surface: '#FFFFFF',
  elevated: '#FFFFFF',
  selected: '#E7F0F7',
  text: '#1B2733',
  muted: '#5B6876',
  border: '#D5DEE7',
  primary: '#2F6F8F',
  primaryText: '#FFFFFF',
  success: '#2F7657',
  warning: '#A86418',
  danger: '#B33B4E',
  info: '#2F6F9E',
};

const DARK_COLORS: SemanticColors = {
  canvas: '#0F151C',
  surface: '#18212B',
  elevated: '#202B37',
  selected: '#20394A',
  text: '#F3F6F8',
  muted: '#B8C2CC',
  border: '#344352',
  primary: '#7CC3E8',
  primaryText: '#0D2532',
  success: '#80C7A3',
  warning: '#F0B66D',
  danger: '#FF9BA8',
  info: '#85C6F2',
};

const TEXT_SIZE_PX: Record<Preferences['textSize'], number> = {
  small: 13,
  default: 14,
  large: 16,
  'extra-large': 18,
};

export function resolveAntDesignMode(colorMode: ColorMode, systemPrefersDark: boolean): EffectiveColorMode {
  if (colorMode === 'dark') return 'dark';
  if (colorMode === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}

function semanticColors(mode: EffectiveColorMode, highContrast: boolean): SemanticColors {
  const base = mode === 'dark' ? DARK_COLORS : LIGHT_COLORS;
  if (!highContrast) return base;
  return {
    ...base,
    border: mode === 'dark' ? '#E7EEF3' : '#273746',
    muted: mode === 'dark' ? '#E0E7EC' : '#40505F',
  };
}

export function buildAntDesignTheme(preferences: Preferences, systemPrefersDark: boolean): ThemeConfig {
  const mode = resolveAntDesignMode(preferences.colorMode, systemPrefersDark);
  const colors = semanticColors(mode, preferences.highContrast);

  return {
    algorithm: mode === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token: {
      colorPrimary: colors.primary,
      colorPrimaryText: colors.primaryText,
      colorBgBase: colors.canvas,
      colorBgLayout: colors.canvas,
      colorBgContainer: colors.surface,
      colorBgElevated: colors.elevated,
      colorPrimaryBg: colors.selected,
      colorText: colors.text,
      colorTextSecondary: colors.muted,
      colorBorder: colors.border,
      colorBorderSecondary: colors.border,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.danger,
      colorInfo: colors.info,
      colorLink: colors.primary,
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
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['lang', 'data-palette', 'data-text-size', 'data-color-mode'],
    });

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

export function AntDesignFoundation({ children }: { children: ReactNode }) {
  const { preferences, systemPrefersDark } = usePreferenceBridge();
  const antThemeConfig = useMemo(
    () => buildAntDesignTheme(preferences, systemPrefersDark),
    [preferences, systemPrefersDark],
  );
  const locale = useMemo(() => resolveAntDesignLocale(preferences.locale), [preferences.locale]);

  return (
    <ConfigProvider
      componentSize={preferences.density === 'compact' ? 'small' : 'middle'}
      locale={locale}
      theme={antThemeConfig}
    >
      {children}
    </ConfigProvider>
  );
}
