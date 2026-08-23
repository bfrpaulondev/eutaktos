import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button } from '@mui/material';
import { authenticationApi } from './lib/authApi';

function label(): string {
  const locale = document.documentElement.lang.toLowerCase();
  if (locale.startsWith('es')) return 'Salir';
  if (locale.startsWith('en')) return 'Sign out';
  return 'Sair';
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

  return (
    <Box sx={{ position: 'fixed', top: 'max(8px, env(safe-area-inset-top))', right: 8, zIndex: 30, display: 'grid', justifyItems: 'end', gap: 1 }}>
      <Button type="button" size="small" variant="outlined" disabled={submitting} onClick={() => void logout()} sx={{ bgcolor: 'background.paper' }}>
        {submitting ? '…' : label()}
      </Button>
      {failed ? <Alert severity="error" sx={{ maxWidth: 320 }}>Não foi possível terminar a sessão. Tenta novamente.</Alert> : null}
    </Box>
  );
}
