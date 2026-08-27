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
    sendExplanation: 'Enviar coloca um lembrete no canal autorizado da pessoa. “Em fila” não significa que um canal externo foi entregue.',
    loading: 'A verificar respostas pendentes…',
    empty: 'Não existem respostas pendentes que precisem de revisão.',
    error: 'Não foi possível carregar os lembretes.',
    sendError: 'Não foi possível colocar o lembrete em fila.',
    unauthorized: 'A sessão terminou. Inicie sessão novamente para consultar lembretes.',
    forbidden: 'Não tem permissão para consultar ou enviar lembretes de designações.',
    retry: 'Tentar novamente',
    close: 'Fechar',
    awaiting: 'A aguardar resposta',
    pendingSince: 'Pendente desde',
    lastReminder: 'Último lembrete',
    neverReminded: 'Nenhum lembrete registado',
    countOne: '1 resposta pendente',
    countMany: 'respostas pendentes',
    send: 'Enviar lembrete',
    sending: 'A colocar em fila…',
    queued: 'Lembrete colocado em fila.',
  },
  en: {
    title: 'Reminders',
    explanation: 'This list shows only assignment responses that the server has confirmed as pending. No reminder-frequency rule is calculated in the browser.',
    sendExplanation: 'Send queues a reminder on the person’s authorized channel. “Queued” does not mean an external channel was delivered.',
    loading: 'Checking pending responses…',
    empty: 'There are no pending responses that need review.',
    error: 'Reminders could not be loaded.',
    sendError: 'The reminder could not be queued.',
    unauthorized: 'Your session ended. Sign in again to review reminders.',
    forbidden: 'You do not have permission to review or send assignment reminders.',
    retry: 'Try again',
    close: 'Close',
    awaiting: 'Awaiting response',
    pendingSince: 'Pending since',
    lastReminder: 'Last reminder',
    neverReminded: 'No reminder recorded',
    countOne: '1 pending response',
    countMany: 'pending responses',
    send: 'Send reminder',
    sending: 'Queueing…',
    queued: 'Reminder queued.',
  },
  es: {
    title: 'Recordatorios',
    explanation: 'Esta lista muestra solo respuestas de asignación que el servidor confirmó como pendientes. El navegador no calcula ninguna regla de frecuencia.',
    sendExplanation: 'Enviar pone un recordatorio en cola en el canal autorizado de la persona. “En cola” no significa que un canal externo se haya entregado.',
    loading: 'Comprobando respuestas pendientes…',
    empty: 'No hay respuestas pendientes que necesiten revisión.',
    error: 'No se pudieron cargar los recordatorios.',
    sendError: 'No se pudo poner el recordatorio en cola.',
    unauthorized: 'La sesión terminó. Inicie sesión de nuevo para consultar recordatorios.',
    forbidden: 'No tiene permiso para consultar o enviar recordatorios de asignaciones.',
    retry: 'Intentar de nuevo',
    close: 'Cerrar',
    awaiting: 'Esperando respuesta',
    pendingSince: 'Pendiente desde',
    lastReminder: 'Último recordatorio',
    neverReminded: 'Ningún recordatorio registrado',
    countOne: '1 respuesta pendiente',
    countMany: 'respuestas pendientes',
    send: 'Enviar recordatorio',
    sending: 'Poniendo en cola…',
    queued: 'Recordatorio puesto en cola.',
  },
} as const;

type LoadState = 'loading' | 'ready' | 'error';

export function peopleRemindersCopy(locale: Locale) {
  return copy[locale];
}

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
  const text = peopleRemindersCopy(locale);
  const [data, setData] = useState<PeopleRemindersDto | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [sendingResponseId, setSendingResponseId] = useState<string | null>(null);
  const [sendError, setSendError] = useState<{ responseId: string; error: unknown } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const sendControllerRef = useRef<AbortController | null>(null);
  const mutationIdsRef = useRef(new Map<string, string>());

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

  const send = async (responseId: string) => {
    if (sendingResponseId) return;
    let mutationId = mutationIdsRef.current.get(responseId);
    if (!mutationId) {
      mutationId = crypto.randomUUID();
      mutationIdsRef.current.set(responseId, mutationId);
    }
    sendControllerRef.current?.abort();
    const controller = new AbortController();
    sendControllerRef.current = controller;
    setSendingResponseId(responseId);
    setSendError(null);
    setSuccessMessage(null);
    try {
      await api.send({ responseId, mutationId, locale }, controller.signal);
      if (controller.signal.aborted) return;
      mutationIdsRef.current.delete(responseId);
      setSuccessMessage(text.queued);
      await load();
    } catch (error) {
      if (controller.signal.aborted) return;
      setSendError({ responseId, error });
    } finally {
      if (!controller.signal.aborted) setSendingResponseId(null);
    }
  };

  useEffect(() => {
    if (!open) {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      sendControllerRef.current?.abort();
      setSendingResponseId(null);
      return;
    }
    setData(null);
    setSendError(null);
    setSuccessMessage(null);
    void load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
      sendControllerRef.current?.abort();
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
      <Typography.Text type="secondary">{text.sendExplanation}</Typography.Text>
      {successMessage ? <Alert type="success" showIcon title={successMessage} /> : null}

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
          {data.items.map(item => {
            const itemError = sendError?.responseId === item.responseId ? sendError.error : null;
            const itemStatus = errorStatus(itemError);
            const itemErrorMessage = itemStatus === 401 ? text.unauthorized : itemStatus === 403 ? text.forbidden : text.sendError;
            return <Card key={item.responseId} size="small">
              <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Typography.Text strong>{item.displayName}</Typography.Text>
                  <Tag color="warning">{text.awaiting}</Tag>
                </Space>
                <Typography.Text><Typography.Text type="secondary">{text.pendingSince}: </Typography.Text>{formatReminderInstant(item.pendingSince, locale)}</Typography.Text>
                <Typography.Text><Typography.Text type="secondary">{text.lastReminder}: </Typography.Text>{item.lastReminderAt ? formatReminderInstant(item.lastReminderAt, locale) : text.neverReminded}</Typography.Text>
                {itemError ? <Alert
                  type="error"
                  showIcon
                  title={itemErrorMessage}
                  action={itemStatus !== 401 && itemStatus !== 403 ? <Button size="small" onClick={() => void send(item.responseId)}>{text.retry}</Button> : undefined}
                /> : null}
                <Button
                  type="primary"
                  onClick={() => void send(item.responseId)}
                  loading={sendingResponseId === item.responseId}
                  disabled={sendingResponseId !== null}
                >{sendingResponseId === item.responseId ? text.sending : text.send}</Button>
              </Space>
            </Card>;
          })}
        </Space>}
      </> : null}
    </Space>
  </Modal>;
}
