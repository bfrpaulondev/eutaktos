import { useMemo, useState } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import { AuthenticationApiError, authenticationApi } from './lib/authApi';

type Locale = 'pt-PT' | 'en' | 'es';
type ConfirmationState = 'ready' | 'submitting' | 'error';
const { Paragraph, Text, Title } = Typography;

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

  const submitting = state === 'submitting';
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '32px 16px', boxSizing: 'border-box' }}>
      <Card style={{ width: '100%', maxWidth: 480 }} styles={{ body: { padding: 'clamp(20px, 5vw, 32px)' } }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Text strong type="secondary">{text.eyebrow}</Text>
            <Title level={1} style={{ margin: '4px 0 0', fontSize: 'clamp(28px, 6vw, 36px)' }}>{text.title}</Title>
          </div>
          <Paragraph style={{ margin: 0 }}>{text.intro}</Paragraph>
          {state === 'error' ? <Alert type="error" showIcon title={serviceFailure ? text.serviceError : text.error} /> : null}
          <Button type="primary" size="large" block loading={submitting} disabled={submitting} onClick={() => void confirm()}>
            {submitting ? text.working : text.confirm}
          </Button>
          <Button type="text" block disabled={submitting} onClick={onCancel}>{text.cancel}</Button>
        </Space>
      </Card>
    </main>
  );
}
