import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
} from '@mui/material';
import { Stack, Typography } from './ui/MuiCompat';
import { authenticationApi } from './lib/authApi';

type Locale = 'pt-PT' | 'en' | 'es';
type GateState = 'checking' | 'signed-out' | 'code' | 'submitting' | 'unavailable' | 'authenticated';

const copy = {
  'pt-PT': {
    language: 'Idioma', eyebrow: 'Acesso seguro', title: 'Entrar no Eutaktos',
    intro: 'Usa o endereço de email autorizado para esta congregação. Enviaremos um código de acesso de utilização única.',
    email: 'Email', send: 'Enviar código', code: 'Código de 6 dígitos', verify: 'Entrar', back: 'Usar outro email',
    sent: 'Se este email estiver autorizado, receberás um código. Introduz o código para continuar.',
    checking: 'A verificar a tua sessão…', unavailable: 'Não foi possível verificar o serviço de autenticação.', retry: 'Tentar novamente',
    error: 'Não foi possível concluir o acesso. Confirma os dados ou pede um novo código.', privacy: 'A sessão fica num cookie seguro. Não guardamos tokens de autenticação no armazenamento do browser.',
  },
  en: {
    language: 'Language', eyebrow: 'Secure access', title: 'Sign in to Eutaktos',
    intro: 'Use the email address authorized for this congregation. We will send a one-time access code.',
    email: 'Email', send: 'Send code', code: '6-digit code', verify: 'Sign in', back: 'Use another email',
    sent: 'If this email is authorized, you will receive a code. Enter it to continue.',
    checking: 'Checking your session…', unavailable: 'The authentication service could not be verified.', retry: 'Try again',
    error: 'Sign-in could not be completed. Check the details or request a new code.', privacy: 'Your session stays in a secure cookie. Authentication tokens are not stored in browser storage.',
  },
  es: {
    language: 'Idioma', eyebrow: 'Acceso seguro', title: 'Entrar en Eutaktos',
    intro: 'Usa el correo electrónico autorizado para esta congregación. Enviaremos un código de acceso de un solo uso.',
    email: 'Correo electrónico', send: 'Enviar código', code: 'Código de 6 dígitos', verify: 'Entrar', back: 'Usar otro correo',
    sent: 'Si este correo está autorizado, recibirás un código. Introdúcelo para continuar.',
    checking: 'Comprobando tu sesión…', unavailable: 'No se pudo verificar el servicio de autenticación.', retry: 'Intentar de nuevo',
    error: 'No se pudo completar el acceso. Comprueba los datos o solicita un código nuevo.', privacy: 'La sesión permanece en una cookie segura. No almacenamos tokens de autenticación en el navegador.',
  },
} as const;

function initialLocale(): Locale {
  const language = typeof navigator === 'undefined' ? 'pt-PT' : navigator.language;
  if (language.toLowerCase().startsWith('es')) return 'es';
  if (language.toLowerCase().startsWith('en')) return 'en';
  return 'pt-PT';
}

export function shouldBypassAuthentication(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1' || normalized === '[::1]';
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const localHarness = useMemo(() => typeof window !== 'undefined' && shouldBypassAuthentication(window.location.hostname), []);
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<GateState>(localHarness ? 'authenticated' : 'checking');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [failed, setFailed] = useState(false);
  const text = copy[locale];

  const checkSession = () => {
    if (localHarness) { setState('authenticated'); return () => undefined; }
    const controller = new AbortController();
    setFailed(false);
    setState('checking');
    void authenticationApi.current(controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setState(result.status === 'authenticated' ? 'authenticated' : result.status === 'unauthenticated' ? 'signed-out' : 'unavailable');
    });
    return () => controller.abort();
  };

  useEffect(checkSession, [localHarness]);

  const requestCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setFailed(false);
    setState('submitting');
    try {
      await authenticationApi.requestOtp(email.trim());
      setState('code');
    } catch {
      setFailed(true);
      setState('signed-out');
    }
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(token)) { setFailed(true); return; }
    setFailed(false);
    setState('submitting');
    try {
      await authenticationApi.verifyOtp(email.trim(), token);
      setToken('');
      setState('authenticated');
    } catch {
      setFailed(true);
      setState('code');
    }
  };

  if (state === 'authenticated') return <>{children}</>;

  return (
    <Box component="main" sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', px: 2, py: 4, bgcolor: 'background.default' }}>
      <Paper elevation={2} sx={{ width: '100%', maxWidth: 480, p: { xs: 2.5, sm: 4 }, borderRadius: 4 }}>
        <Stack spacing={2.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="overline" color="primary.main" fontWeight={800}>{text.eyebrow}</Typography>
              <Typography component="h1" variant="h4" fontWeight={800}>{text.title}</Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 118 }}>
              <InputLabel id="auth-language-label">{text.language}</InputLabel>
              <Select labelId="auth-language-label" value={locale} label={text.language} onChange={event => setLocale(event.target.value as Locale)}>
                <MenuItem value="pt-PT">Português</MenuItem>
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="es">Español</MenuItem>
              </Select>
            </FormControl>
          </Stack>

          {state === 'checking' || state === 'submitting' ? (
            <Stack role="status" aria-live="polite" spacing={1.5} alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography color="text.secondary">{state === 'checking' ? text.checking : '…'}</Typography>
            </Stack>
          ) : state === 'unavailable' ? (
            <Stack spacing={2}>
              <Alert severity="warning">{text.unavailable}</Alert>
              <Button variant="contained" onClick={checkSession}>{text.retry}</Button>
            </Stack>
          ) : state === 'code' ? (
            <Box component="form" onSubmit={verifyCode} noValidate>
              <Stack spacing={2}>
                <Alert severity="info">{text.sent}</Alert>
                {failed ? <Alert severity="error">{text.error}</Alert> : null}
                <TextField label={text.code} value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} slotProps={{ htmlInput: { inputMode: 'numeric', autoComplete: 'one-time-code', pattern: '[0-9]{6}', maxLength: 6 } }} required autoFocus />
                <Button type="submit" variant="contained" disabled={token.length !== 6}>{text.verify}</Button>
                <Button type="button" onClick={() => { setToken(''); setFailed(false); setState('signed-out'); }}>{text.back}</Button>
              </Stack>
            </Box>
          ) : (
            <Box component="form" onSubmit={requestCode} noValidate>
              <Stack spacing={2}>
                <Typography color="text.secondary">{text.intro}</Typography>
                {failed ? <Alert severity="error">{text.error}</Alert> : null}
                <TextField type="email" label={text.email} value={email} onChange={event => setEmail(event.target.value)} slotProps={{ htmlInput: { autoComplete: 'email', inputMode: 'email', maxLength: 254 } }} required autoFocus />
                <Button type="submit" variant="contained" disabled={!email.trim()}>{text.send}</Button>
              </Stack>
            </Box>
          )}

          <Typography variant="caption" color="text.secondary">{text.privacy}</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
