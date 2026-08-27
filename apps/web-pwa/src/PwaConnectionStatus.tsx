import { useEffect, useState } from 'react';
import Alert from 'antd/es/alert';
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

  if (!offline) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'max(16px, env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 40,
        width: 'min(94vw, 640px)',
      }}
    >
      <Alert type="warning" showIcon title={copy[locale]} />
    </div>
  );
}
