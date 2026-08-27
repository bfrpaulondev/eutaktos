import BellOutlined from '@ant-design/icons/es/icons/BellOutlined';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Modal from 'antd/es/modal';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useRef, useState } from 'react';
import { peopleRemindersApi, type PeopleRemindersApi, type PeopleRemindersDto } from './lib/peopleRemindersApi';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': {
    title: 'Lembretes',
    explanation: 'Esta lista mostra apenas respostas de designação que o servidor confirmou como pendentes. Nenhuma regra de frequência é calculada no navegador.',
    reviewOnly: 'O envio de lembretes ainda não está disponível nesta vista. Esta etapa serve para rever quem aguarda resposta e quando ocorreu o último lembrete registado.',
    loading: 'A verificar respostas pendentes…',
    empty: 'Não existem respostas pendentes que precisem de revisão.',
    error: 'Não foi possível carregar os lembretes.',
    unauthorized: 'A sessão terminou. Inicie sessão novamente para consultar lembretes.',
    forbidden: 'Não tem permissão para consultar lembretes de designações.',
    retry: 'Tentar novamente',
    close: 'Fechar',
    awaiting: 'A aguardar resposta',
    pendingSince: 'Pendente desde',
    lastReminder: 'Último lembrete',
    neverReminded: 'Nenhum lembrete registado',
    countOne: '1 resposta pendente',
    countMany: 'respostas pendentes',
  },
  en: {
    title: 'Reminders',
    explanation: 'This list shows only assignment responses that the server has confirmed as pending. No reminder-frequency rule is calculated in the browser.',
    reviewOnly: 'Sending reminders is not yet available in this view. This step lets you review who is awaiting a response and when the last recorded reminder occurred.',
    loading: 'Checking pending responses…',
    empty: 'There are no pending responses that need review.',
    error: 'Reminders could not be loaded.',
    unauthorized: 'Your session ended. Sign in again to review reminders.',
    forbidden: 'You do not have permission to review assignment reminders.',
    retry: 'Try again',
    close: 'Close',
    awaiting: 'Awaiting response',
    pendingSince: 'Pending since',
    lastReminder: 'Last reminder',
    neverReminded: 'No reminder recorded',
    countOne: '1 pending response',
    countMany: 'pending responses',
  },
  es: {
    title: 'Recordatorios',
    explanation: 'Esta lista muestra solo respuestas de asignación que el servidor confirmó como pendientes. El navegador no calcula ninguna regla de frecuencia.',
    reviewOnly: 'El envío de recordatorios todavía no está disponible en esta vista. Esta etapa permite revisar quién espera respuesta y cuándo se registró el último recordatorio.',
    loading: 'Comprobando respuestas pendientes…',
    empty: 'No hay respuestas pendientes que necesiten revisión.',
    error: 'No se pudieron cargar los recordatorios.',
    unauthorized: 'La sesión terminó. Inicie sesión de nuevo para consultar recordatorios.',
    forbidden: 'No tiene permiso para consultar recordatorios de asignaciones.',
    retry: 'Intentar de nuevo',
    close: 'Cerrar',
    awaiting: 'Esperando respuesta',
    pendingSince: 'Pendiente desde',
    lastReminder: 'Último recordatorio',
    neverReminded: 'Ningún recordatorio registrado',
    countOne: '1 respuesta pendiente',
    countMany: 'respuestas pendientes',
  },
} as const;

type LoadState = 'loading' | 'ready' | 'error';

function errorStatus(error: unknown): number | undefined {
  const match = /\((\d{3})\)$/.exec(error instanceof Error ? error.message : '');
  return match ? Number(match[1]) : undefined;
}

export function formatReminderInstant(value: string, locale: Locale): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function PeopleRemindersDialog({ open, locale, onClose, api = peopleRemindersApi }: {
  readonly open: boolean;
  readonly locale: Locale;
  readonly onClose: () => void;
  readonly api?: PeopleRemindersApi;
}) {
  const text = copy[locale];
  const [data, setData] = useState<PeopleRemindersDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoadState('loading');
    setLoadError(null);
    try {
      const value = await api.get(controller.signal);
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setData(value);
      setLoadState('ready');
    } catch (error) {
      if (controller.signal.aborted || requestVersion !== requestVersionRef.current) return;
      setLoadError(error);
      setLoadState('error');
    }
  };

  useEffect(() => {
    if (!open) {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      return;
    }
    setData(null);
    void load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [open]);

  const status = errorStatus(loadError);
  const errorMessage = status === 401 ? text.unauthorized : status === 403 ? text.forbidden : text.error;
  const count = data?.items.length ?? 0;

  return <Modal
    open={open}
    title={<Space><BellOutlined />{text.title}</Space>}
    onCancel={onClose}
    footer={<Button onClick={onClose}>{text.close}</Button>}
    width={760}
    destroyOnHidden
  >
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.explanation} />
      <Typography.Text type="secondary">{text.reviewOnly}</Typography.Text>

      {loadState === 'loading' ? <Card aria-live="polite"><Skeleton active paragraph={{ rows: 4 }} /><Typography.Text type="secondary">{text.loading}</Typography.Text></Card> : null}
      {loadState === 'error' ? <Alert
        type="error"
        showIcon
        title={errorMessage}
        action={status !== 401 && status !== 403 ? <Button size="small" onClick={() => void load()}>{text.retry}</Button> : undefined}
      /> : null}
      {loadState === 'ready' && data ? <>
        <Typography.Text type="secondary" aria-live="polite">{count === 1 ? text.countOne : `${count} ${text.countMany}`}</Typography.Text>
        {data.items.length === 0 ? <Empty description={text.empty} /> : <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          {data.items.map(item => <Card key={item.responseId} size="small">
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text strong>{item.displayName}</Typography.Text>
                <Tag color="warning">{text.awaiting}</Tag>
              </Space>
              <Typography.Text><Typography.Text type="secondary">{text.pendingSince}: </Typography.Text>{formatReminderInstant(item.pendingSince, locale)}</Typography.Text>
              <Typography.Text><Typography.Text type="secondary">{text.lastReminder}: </Typography.Text>{item.lastReminderAt ? formatReminderInstant(item.lastReminderAt, locale) : text.neverReminded}</Typography.Text>
            </Space>
          </Card>)}
        </Space>}
      </> : null}
    </Space>
  </Modal>;
}
