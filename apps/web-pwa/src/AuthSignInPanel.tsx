import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Typography from 'antd/es/typography';
import { useRef, useState, type FormEvent } from 'react';
import { AuthenticationApiError, authenticationApi } from './lib/authApi';

type Locale = 'pt-PT' | 'en' | 'es';
type PanelState = 'email' | 'sent' | 'submitting';
type ErrorKind = 'credentials' | 'service' | null;

const copy = {
  'pt-PT': {
    language: 'Idioma', eyebrow: 'Acesso seguro', title: 'Entrar no Eutaktos',
    intro: 'Usa o endereço de email autorizado para esta congregação. Enviaremos um link de acesso de utilização única.',
    email: 'Email', send: 'Enviar link de acesso', code: 'Código de 6 dígitos', verify: 'Entrar com código', retry: 'Tentar novamente', back: 'Usar outro email',
    sent: 'Se este email estiver autorizado, receberás um link. Abre-o neste dispositivo e o Eutaktos concluirá o acesso automaticamente.',
    codeHint: 'Se o email mostrar um código de 6 dígitos em vez de um link, também podes introduzi-lo abaixo.',
    pilotHint: 'Acesso temporário de teste: se já tens um código de 6 dígitos, podes entrar diretamente sem pedir um link.',
    error: 'Não foi possível concluir o acesso. O código ou link pode estar incorreto, expirado ou já ter sido utilizado.',
    serviceError: 'O serviço de autenticação está temporariamente indisponível. Tenta novamente sem alterar o código.',
    privacy: 'O link é trocado por uma sessão num cookie seguro. Não guardamos tokens de autenticação no armazenamento do browser.',
  },
  en: {
    language: 'Language', eyebrow: 'Secure access', title: 'Sign in to Eutaktos',
    intro: 'Use the email address authorized for this congregation. We will send a one-time sign-in link.',
    email: 'Email', send: 'Send sign-in link', code: '6-digit code', verify: 'Sign in with code', retry: 'Try again', back: 'Use another email',
    sent: 'If this email is authorized, you will receive a link. Open it on this device and Eutaktos will complete sign-in automatically.',
    codeHint: 'If the email contains a 6-digit code instead of a link, you can enter it below.',
    pilotHint: 'Temporary test access: if you already have a 6-digit code, you can sign in directly without requesting a link.',
    error: 'Sign-in could not be completed. The code or link may be incorrect, expired, or already used.',
    serviceError: 'The authentication service is temporarily unavailable. Try again without changing the code.',
    privacy: 'The link is exchanged for a secure cookie session. Authentication tokens are not stored in browser storage.',
  },
  es: {
    language: 'Idioma', eyebrow: 'Acceso seguro', title: 'Entrar en Eutaktos',
    intro: 'Usa el correo electrónico autorizado para esta congregación. Enviaremos un enlace de acceso de un solo uso.',
    email: 'Correo electrónico', send: 'Enviar enlace de acceso', code: 'Código de 6 dígitos', verify: 'Entrar con código', retry: 'Intentar de nuevo', back: 'Usar otro correo',
    sent: 'Si este correo está autorizado, recibirás un enlace. Ábrelo en este dispositivo y Eutaktos completará el acceso automáticamente.',
    codeHint: 'Si el correo contiene un código de 6 dígitos en lugar de un enlace, también puedes introducirlo abajo.',
    pilotHint: 'Acceso temporal de prueba: si ya tienes un código de 6 dígitos, puedes entrar directamente sin solicitar un enlace.',
    error: 'No se pudo completar el acceso. El código o enlace puede ser incorrecto, haber caducado o haberse usado ya.',
    serviceError: 'El servicio de autenticación no está disponible temporalmente. Inténtalo de nuevo sin cambiar el código.',
    privacy: 'El enlace se intercambia por una sesión en una cookie segura. No almacenamos tokens de autenticación en el navegador.',
  },
} as const;

function initialLocale(): Locale {
  const language = typeof navigator === 'undefined' ? 'pt-PT' : navigator.language;
  if (language.toLowerCase().startsWith('es')) return 'es';
  if (language.toLowerCase().startsWith('en')) return 'en';
  return 'pt-PT';
}

function errorKind(error: unknown): Exclude<ErrorKind, null> {
  return error instanceof AuthenticationApiError && error.status >= 500 ? 'service' : 'credentials';
}

export function createAuthMutationGuard() {
  let active = false;
  return async <T>(mutation: () => Promise<T>): Promise<T | undefined> => {
    if (active) return undefined;
    active = true;
    try {
      return await mutation();
    } finally {
      active = false;
    }
  };
}

export function AuthSignInPanel({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [state, setState] = useState<PanelState>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [failure, setFailure] = useState<ErrorKind>(null);
  const mutationGuardRef = useRef(createAuthMutationGuard());
  const text = copy[locale];

  const requestLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || state === 'submitting') return;
    await mutationGuardRef.current(async () => {
      setFailure(null);
      setState('submitting');
      try {
        await authenticationApi.requestOtp(email.trim());
        setState('sent');
      } catch (error) {
        setFailure(errorKind(error));
        setState('email');
      }
    });
  };

  const verifyCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !/^\d{6}$/.test(token) || state === 'submitting') {
      if (state !== 'submitting') setFailure('credentials');
      return;
    }
    await mutationGuardRef.current(async () => {
      setFailure(null);
      setState('submitting');
      try {
        await authenticationApi.verifyOtp(email.trim(), token);
        setToken('');
        onAuthenticated();
      } catch (error) {
        setFailure(errorKind(error));
        setState('email');
      }
    });
  };

  const failureAlert = failure
    ? <Alert type="error" showIcon title={failure === 'service' ? text.serviceError : text.error} />
    : null;

  const codeInput = <Input
    aria-label={text.code}
    value={token}
    onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))}
    inputMode="numeric"
    autoComplete="one-time-code"
    pattern="[0-9]{6}"
    maxLength={6}
    placeholder={text.code}
  />;

  return <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
    <Card style={{ width: '100%', maxWidth: 480 }} styles={{ body: { padding: 'clamp(20px, 5vw, 32px)' } }}>
      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <Typography.Text type="secondary" strong>{text.eyebrow}</Typography.Text>
            <Typography.Title level={2} style={{ margin: '4px 0 0' }}>{text.title}</Typography.Title>
          </div>
          <label style={{ minWidth: 118 }}>
            <Typography.Text>{text.language}</Typography.Text>
            <Select
              aria-label={text.language}
              value={locale}
              style={{ width: '100%', marginTop: 6 }}
              onChange={value => setLocale(value)}
              options={[
                { value: 'pt-PT', label: 'Português' },
                { value: 'en', label: 'English' },
                { value: 'es', label: 'Español' },
              ]}
            />
          </label>
        </div>

        {state === 'submitting' ? <div role="status" aria-live="polite" style={{ minHeight: 128, display: 'grid', placeItems: 'center' }}>
          <Spin size="large" />
        </div> : state === 'sent' ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Alert type="info" showIcon title={text.sent} />
          {failureAlert}
          <form onSubmit={verifyCode} noValidate>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Typography.Text type="secondary">{text.codeHint}</Typography.Text>
              {codeInput}
              <Button htmlType="submit" block disabled={token.length !== 6}>{failure === 'service' ? text.retry : text.verify}</Button>
            </Space>
          </form>
          <Button type="link" block onClick={() => { setToken(''); setFailure(null); setState('email'); }}>{text.back}</Button>
        </Space> : <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Typography.Text type="secondary">{text.intro}</Typography.Text>
          {failureAlert}
          <form onSubmit={requestLink} noValidate>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <label>
                <Typography.Text>{text.email}</Typography.Text>
                <Input
                  aria-label={text.email}
                  type="email"
                  value={email}
                  style={{ marginTop: 6 }}
                  onChange={event => setEmail(event.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  maxLength={254}
                  required
                  autoFocus
                />
              </label>
              <Button htmlType="submit" type="primary" block disabled={!email.trim()}>{text.send}</Button>
            </Space>
          </form>
          <form onSubmit={verifyCode} noValidate>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Typography.Text type="secondary">{text.pilotHint}</Typography.Text>
              {codeInput}
              <Button htmlType="submit" block disabled={!email.trim() || token.length !== 6}>{failure === 'service' ? text.retry : text.verify}</Button>
            </Space>
          </form>
        </Space>}

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>{text.privacy}</Typography.Text>
      </Space>
    </Card>
  </main>;
}
