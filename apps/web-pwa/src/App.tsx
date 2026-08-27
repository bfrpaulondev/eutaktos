import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { AppRecoveryBoundary } from './AppRecoveryBoundary';
import { PwaConnectionStatus } from './PwaConnectionStatus';
import { PwaUpdateRecovery } from './PwaUpdateRecovery';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePaletteId,
  type Preferences,
} from './lib/preferences';
import { useSystemPrefersDark } from './lib/systemColorMode';
import { buildEutaktosTheme } from './theme';
import { LegacyMuiThemeBridge } from './ui/MuiCompat';

const TaskShell = lazy(async () => {
  const module = await import('./TaskShell');
  return { default: module.default };
});

const STORAGE_KEY = 'eutaktos.preferences.v4';

function loadPreferences(): Preferences {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizePreferences(JSON.parse(current));
    for (const key of ['eutaktos.preferences.v3', 'eutaktos.preferences.v2', 'eutaktos.preferences.v1']) {
      const stored = localStorage.getItem(key);
      if (stored) return normalizePreferences(JSON.parse(stored));
    }
    return DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const systemPrefersDark = useSystemPrefersDark();
  const effectivePalette = resolvePaletteId(preferences.paletteId, preferences.colorMode, systemPrefersDark);
  const theme = useMemo(() => buildEutaktosTheme({ ...preferences, paletteId: effectivePalette }), [effectivePalette, preferences]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.palette = effectivePalette;
    document.documentElement.dataset.textSize = preferences.textSize;
    document.documentElement.dataset.colorMode = preferences.colorMode;
    document.documentElement.style.colorScheme = theme.palette.mode;
  }, [effectivePalette, preferences, theme.palette.mode]);

  return <LegacyMuiThemeBridge theme={theme}>
    <AppRecoveryBoundary locale={preferences.locale}>
      <Suspense fallback={<main id="main" tabIndex={-1} style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}><p role="status">A carregar área…</p></main>}>
        <TaskShell preferences={preferences} setPreferences={setPreferences} />
      </Suspense>
    </AppRecoveryBoundary>
    <PwaConnectionStatus locale={preferences.locale} />
    <PwaUpdateRecovery />
  </LegacyMuiThemeBridge>;
}
