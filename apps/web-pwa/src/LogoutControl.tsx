import { useCallback, useEffect, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Space from 'antd/es/space';
import { authenticationApi } from './lib/authApi';

function copy(): Readonly<{ action: string; failure: string }> {
  const locale = document.documentElement.lang.toLowerCase();
  if (locale.startsWith('es')) return { action: 'Salir', failure: 'No se pudo cerrar la sesión. Inténtalo de nuevo.' };
  if (locale.startsWith('en')) return { action: 'Sign out', failure: 'The session could not be ended. Try again.' };
  return { action: 'Sair', failure: 'Não foi possível terminar a sessão. Tenta novamente.' };
}

export function LogoutControl() {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const logout = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await authenticationApi.logout();
      window.location.replace('/');
    } catch {
      setFailed(true);
      setSubmitting(false);
    }
  }, [submitting]);

  useEffect(() => {
    if (window.location.pathname === '/logout') void logout();
  }, [logout]);

  const text = copy();
  return (
    <Space
      direction="vertical"
      align="end"
      size="small"
      style={{ position: 'fixed', top: 'max(8px, env(safe-area-inset-top))', right: 8, zIndex: 30 }}
    >
      <Button type="default" size="small" loading={submitting} disabled={submitting} onClick={() => void logout()}>
        {text.action}
      </Button>
      {failed ? <Alert type="error" showIcon role="alert" title={text.failure} style={{ maxWidth: 320 }} /> : null}
    </Space>
  );
}
