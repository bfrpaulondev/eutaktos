import { useEffect, useState } from 'react';
import { Alert, Snackbar } from '@mui/material';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': 'Estás offline. Os dados de produção não estão disponíveis até a ligação regressar.',
  en: 'You are offline. Production data are unavailable until the connection returns.',
  es: 'No tienes conexión. Los datos de producción no están disponibles hasta que vuelva la conexión.',
} as const;

export function PwaConnectionStatus({ locale }: { locale: Locale }) {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  useEffect(() => {
    const online = () => setOffline(false);
    const disconnected = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', disconnected); };
  }, []);
  return <Snackbar open={offline} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} sx={{ mb: { xs: 9, md: 2 }, maxWidth: 'min(94vw, 640px)' }}><Alert severity="warning" role="status" aria-live="polite">{copy[locale]}</Alert></Snackbar>;
}
