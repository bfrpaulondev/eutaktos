import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Snackbar, ThemeProvider } from '@mui/material';
import { DEFAULT_PREFERENCES, normalizePreferences, type Locale, type Preferences } from './lib/preferences';
import { registerPwaUpdateController, type PwaUpdateController } from './lib/pwaUpdate';
import { buildEutaktosTheme } from './theme';

const STORAGE_KEY = 'eutaktos.preferences.v2';

const copy = {
  'pt-PT': {
    available: 'Existe uma nova versão do Eutaktos pronta a instalar.',
    update: 'Atualizar agora',
    later: 'Mais tarde',
    activating: 'A aplicar a atualização…',
    error: 'Não foi possível verificar atualizações neste momento.',
    retry: 'Tentar novamente',
  },
  en: {
    available: 'A new version of Eutaktos is ready to install.',
    update: 'Update now',
    later: 'Later',
    activating: 'Applying the update…',
    error: 'Updates could not be checked right now.',
    retry: 'Try again',
  },
  es: {
    available: 'Hay una nueva versión de Eutaktos lista para instalar.',
    update: 'Actualizar ahora',
    later: 'Más tarde',
    activating: 'Aplicando la actualización…',
    error: 'No se pudieron comprobar las actualizaciones en este momento.',
    retry: 'Intentar de nuevo',
  },
} as const;

function currentLocale(): Locale {
  const lang = document.documentElement.lang;
  if (lang === 'pt-PT' || lang.toLowerCase().startsWith('pt')) return 'pt-PT';
  if (lang === 'es' || lang.toLowerCase().startsWith('es')) return 'es';
  return 'en';
}

function currentPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return normalizePreferences(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function PwaUpdateRecovery() {
  const [available, setAvailable] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState(false);
  const [locale, setLocale] = useState<Locale>(currentLocale);
  const controllerRef = useRef<PwaUpdateController | null>(null);
  const text = copy[locale];
  const theme = useMemo(
    () => buildEutaktosTheme(currentPreferences()),
    [available, activating, error, locale],
  );

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(currentLocale()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

    let disposed = false;
    const scriptUrl = new URL('sw.js', import.meta.env.BASE_URL).toString();

    void registerPwaUpdateController({
      serviceWorker: navigator.serviceWorker,
      scriptUrl,
      reload: () => window.location.reload(),
      onUpdateAvailable: () => {
        if (disposed) return;
        setError(false);
        setAvailable(true);
      },
      onActivating: () => {
        if (disposed) return;
        setActivating(true);
      },
    }).then(controller => {
      if (disposed) {
        controller.dispose();
        return;
      }
      controllerRef.current = controller;
    }).catch(() => {
      if (!disposed) setError(true);
    });

    const check = () => {
      if (document.visibilityState === 'hidden') return;
      void controllerRef.current?.check().catch(() => {
        if (!disposed) setError(true);
      });
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
  }, []);

  const applyUpdate = () => {
    setError(false);
    if (!controllerRef.current?.apply()) {
      setAvailable(false);
      setError(true);
    }
  };

  const retry = () => {
    setError(false);
    void controllerRef.current?.check().catch(() => setError(true));
  };

  return (
    <ThemeProvider theme={theme}>
      <Snackbar
        open={available || activating || error}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: { xs: 9, md: 2 }, maxWidth: 'min(94vw, 640px)' }}
      >
        {error ? (
          <Alert
            severity="warning"
            variant="filled"
            role="status"
            action={<Button color="inherit" size="small" onClick={retry}>{text.retry}</Button>}
          >
            {text.error}
          </Alert>
        ) : (
          <Alert
            severity="info"
            variant="filled"
            role="status"
            aria-live="polite"
            onClose={activating ? undefined : () => setAvailable(false)}
            action={activating ? undefined : (
              <Button color="inherit" size="small" onClick={applyUpdate}>{text.update}</Button>
            )}
          >
            {activating ? text.activating : text.available}
          </Alert>
        )}
      </Snackbar>
    </ThemeProvider>
  );
}
