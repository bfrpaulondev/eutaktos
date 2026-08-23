import { useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Paper } from '@mui/material';
import { Stack, Typography } from './ui/MuiCompat';
import { AuthenticationApiError, authenticationApi } from './lib/authApi';

type Locale = 'pt-PT' | 'en' | 'es';
type ConfirmationState = 'ready' | 'submitting' | 'error';

const copy = {
  'pt-PT': {
    eyebrow: 'Acesso seguro',
    title: 'Confirmar entrada',
    intro: 'O link foi aberto. Para proteger links de utilização única contra pré-visualizações automáticas de email, confirma abaixo que és tu quem está a entrar.',
    confirm: 'Entrar no Eutaktos',
    cancel: 'Voltar ao início',
    working: 'A confirmar…',
    error: 'Não foi possível utilizar este link. Ele pode ter expirado ou já ter sido utilizado. Pede um novo link na página de entrada.',
    serviceError: 'O serviço de autenticação está temporariamente indisponível. Tenta novamente.',
  },
  en: {
    eyebrow: 'Secure access',
    title: 'Confirm sign-in',
    intro: 'The link is open. To protect one-time links from automatic email previews, confirm below that you are the person signing in.',
    confirm: 'Sign in to Eutaktos',
    cancel: 'Back to sign in',
    working: 'Confirming…',
    error: 'This link could not be used. It may have expired or already been used. Request a new link from the sign-in page.',
    serviceError: 'The authentication service is temporarily unavailable. Try again.',
  },
  es: {
    eyebrow: 'Acceso seguro',
    title: 'Confirmar acceso',
    intro: 'El enlace está abierto. Para proteger los enlaces de un solo uso frente a vistas previas automáticas del correo, confirma abajo que eres tú quien está entrando.',
    confirm: 'Entrar en Eutaktos',
    cancel: 'Volver al acceso',
    working: 'Confirmando…',
    error: 'No se pudo utilizar este enlace. Puede haber caducado o haberse usado ya. Solicita un enlace nuevo desde la página de acceso.',
    serviceError: 'El servicio de autenticación no está disponible temporalmente. Inténtalo de nuevo.',
  },
} as const;

function browserLocale(): Locale {
  const language = typeof navigator === 'undefined' ? 'pt-PT' : navigator.language.toLowerCase();
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('en')) return 'en';
  return 'pt-PT';
}

export function MagicLinkConfirmationPanel({
  tokenHash,
  onAuthenticated,
  onCancel,
}: {
  tokenHash: string;
  onAuthenticated: () => void;
  onCancel: () => void;
}) {
  const locale = useMemo(browserLocale, []);
  const text = copy[locale];
  const [state, setState] = useState<ConfirmationState>('ready');
  const [serviceFailure, setServiceFailure] = useState(false);

  const confirm = async () => {
    if (state === 'submitting') return;
    setState('submitting');
    setServiceFailure(false);
    try {
      await authenticationApi.verifyMagicLinkTokenHash(tokenHash);
      onAuthenticated();
    } catch (error) {
      setServiceFailure(error instanceof AuthenticationApiError && error.status >= 500);
      setState('error');
    }
  };

  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 4, bgcolor: 'background.default', boxSizing: 'border-box' }}>
      <Paper elevation={2} sx={{ width: '100%', maxWidth: 480, boxSizing: 'border-box', p: { xs: 2.5, sm: 4 }, borderRadius: 4 }}>
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="overline" color="primary.main" fontWeight={800}>{text.eyebrow}</Typography>
            <Typography component="h1" variant="h4" fontWeight={800}>{text.title}</Typography>
          </Box>
          <Typography>{text.intro}</Typography>
          {state === 'error' ? <Alert severity="error">{serviceFailure ? text.serviceError : text.error}</Alert> : null}
          <Button type="button" variant="contained" size="large" disabled={state === 'submitting'} onClick={() => void confirm()}>
            {state === 'submitting' ? <><CircularProgress size={20} sx={{ mr: 1 }} />{text.working}</> : text.confirm}
          </Button>
          <Button type="button" variant="text" disabled={state === 'submitting'} onClick={onCancel}>{text.cancel}</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
