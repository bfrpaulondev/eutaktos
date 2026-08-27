import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Timeline from 'antd/es/timeline';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { peopleArchiveApi, type PeopleArchiveApi, type PeopleArchiveStateDto } from './lib/peopleArchiveApi';
import { peopleDirectoryApi, type PeopleDirectoryApi, type PeopleDirectoryPersonDto } from './lib/peopleDirectoryApi';
import type { Locale } from './lib/preferences';

const copy = {
  'pt-PT': {
    title: 'Arquivo / A não publicar', explanation: 'Arquivar retira a pessoa do estado ativo e guarda motivo, data e histórico. Restaurar é sempre uma ação explícita.',
    person: 'Pessoa', choose: 'Escolher pessoa', loadingPeople: 'A carregar pessoas…', loadingState: 'A carregar estado…', retry: 'Tentar novamente',
    loadError: 'Não foi possível carregar o estado de arquivo.', noPeople: 'Não existem pessoas disponíveis.', active: 'Ativa', archived: 'Arquivada',
    currentReason: 'Motivo atual', archivedAt: 'Arquivada em', history: 'Histórico', noHistory: 'Ainda não existe histórico de arquivo.',
    reason: 'Motivo do arquivo', reasonPlaceholder: 'Indique o motivo administrativo desta decisão', reasonHelp: 'Obrigatório, até 240 caracteres.',
    archive: 'Arquivar pessoa', restore: 'Restaurar pessoa', confirmArchive: 'Confirmar arquivo', confirmRestore: 'Confirmar restauro',
    confirmArchiveText: 'Esta ação deixa a pessoa inativa e regista o motivo no histórico. Pretende continuar?',
    confirmRestoreText: 'Esta ação restaura explicitamente o estado anterior permitido pelo contrato de arquivo. Pretende continuar?',
    cancel: 'Cancelar', working: 'A guardar…', saved: 'Estado de arquivo atualizado.', unauthenticated: 'A sessão terminou. Inicie sessão novamente.',
    forbidden: 'Já não tem permissão para alterar este estado.', mutationError: 'Não foi possível concluir a alteração. Pode tentar novamente com segurança.',
    archivedAction: 'Arquivada', restoredAction: 'Restaurada', close: 'Fechar', readOnly: 'Pode consultar o arquivo, mas não tem permissão para o alterar.',
  },
  en: {
    title: 'Archive / Do not publish', explanation: 'Archiving removes a person from active state and preserves reason, date and history. Restore is always an explicit action.',
    person: 'Person', choose: 'Choose person', loadingPeople: 'Loading people…', loadingState: 'Loading archive state…', retry: 'Try again',
    loadError: 'The archive state could not be loaded.', noPeople: 'There are no people available.', active: 'Active', archived: 'Archived',
    currentReason: 'Current reason', archivedAt: 'Archived at', history: 'History', noHistory: 'There is no archive history yet.',
    reason: 'Archive reason', reasonPlaceholder: 'State the administrative reason for this decision', reasonHelp: 'Required, up to 240 characters.',
    archive: 'Archive person', restore: 'Restore person', confirmArchive: 'Confirm archive', confirmRestore: 'Confirm restore',
    confirmArchiveText: 'This action makes the person inactive and records the reason in history. Continue?',
    confirmRestoreText: 'This action explicitly restores the prior state allowed by the archive contract. Continue?',
    cancel: 'Cancel', working: 'Saving…', saved: 'Archive state updated.', unauthenticated: 'Your session ended. Sign in again.',
    forbidden: 'You no longer have permission to change this state.', mutationError: 'The change could not be completed. You can retry safely.',
    archivedAction: 'Archived', restoredAction: 'Restored', close: 'Close', readOnly: 'You can view archive state, but you do not have permission to change it.',
  },
  es: {
    title: 'Archivo / No publicar', explanation: 'Archivar retira a la persona del estado activo y conserva motivo, fecha e historial. Restaurar siempre es una acción explícita.',
    person: 'Persona', choose: 'Elegir persona', loadingPeople: 'Cargando personas…', loadingState: 'Cargando estado…', retry: 'Intentar de nuevo',
    loadError: 'No se pudo cargar el estado de archivo.', noPeople: 'No hay personas disponibles.', active: 'Activa', archived: 'Archivada',
    currentReason: 'Motivo actual', archivedAt: 'Archivada el', history: 'Historial', noHistory: 'Todavía no existe historial de archivo.',
    reason: 'Motivo del archivo', reasonPlaceholder: 'Indique el motivo administrativo de esta decisión', reasonHelp: 'Obligatorio, hasta 240 caracteres.',
    archive: 'Archivar persona', restore: 'Restaurar persona', confirmArchive: 'Confirmar archivo', confirmRestore: 'Confirmar restauración',
    confirmArchiveText: 'Esta acción deja a la persona inactiva y registra el motivo en el historial. ¿Continuar?',
    confirmRestoreText: 'Esta acción restaura explícitamente el estado anterior permitido por el contrato de archivo. ¿Continuar?',
    cancel: 'Cancelar', working: 'Guardando…', saved: 'Estado de archivo actualizado.', unauthenticated: 'La sesión terminó. Inicie sesión de nuevo.',
    forbidden: 'Ya no tiene permiso para cambiar este estado.', mutationError: 'No se pudo completar el cambio. Puede volver a intentarlo con seguridad.',
    archivedAction: 'Archivada', restoredAction: 'Restaurada', close: 'Cerrar', readOnly: 'Puede consultar el archivo, pero no tiene permiso para cambiarlo.',
  },
} as const;

type ErrorState = 'unauthenticated' | 'forbidden' | 'retryable' | null;

function errorState(error: unknown): Exclude<ErrorState, null> {
  const message = error instanceof Error ? error.message : '';
  if (/\(401\)$/.test(message)) return 'unauthenticated';
  if (/\(403\)$/.test(message)) return 'forbidden';
  return 'retryable';
}

function formatInstant(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function PeopleArchiveDialog({ locale, open, onClose, archiveApi = peopleArchiveApi, directoryApi = peopleDirectoryApi }: {
  locale: Locale;
  open: boolean;
  onClose: () => void;
  archiveApi?: PeopleArchiveApi;
  directoryApi?: PeopleDirectoryApi;
}) {
  const text = copy[locale];
  const [people, setPeople] = useState<readonly PeopleDirectoryPersonDto[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [state, setState] = useState<PeopleArchiveStateDto>();
  const [reason, setReason] = useState('');
  const [loadingPeople, setLoadingPeople] = useState(false);
  const [loadingState, setLoadingState] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [success, setSuccess] = useState(false);
  const peopleRequestRef = useRef(0);
  const stateRequestRef = useRef(0);
  const peopleControllerRef = useRef<AbortController | null>(null);
  const stateControllerRef = useRef<AbortController | null>(null);
  const mutationControllerRef = useRef<AbortController | null>(null);
  const mutationLockRef = useRef(false);

  const selected = useMemo(() => people.find(person => person.id === selectedId), [people, selectedId]);
  const normalizedReason = reason.trim().replace(/\s+/g, ' ');
  const validReason = normalizedReason.length > 0 && normalizedReason.length <= 240 && !/[\u0000-\u001f\u007f]/.test(normalizedReason);

  const loadPeople = async () => {
    const version = ++peopleRequestRef.current;
    peopleControllerRef.current?.abort();
    const controller = new AbortController();
    peopleControllerRef.current = controller;
    setLoadingPeople(true);
    setError(null);
    try {
      const directory = await directoryApi.get(controller.signal);
      if (controller.signal.aborted || version !== peopleRequestRef.current) return;
      setPeople(directory.people);
      setSelectedId(current => current && directory.people.some(person => person.id === current) ? current : directory.people[0]?.id);
    } catch (caught) {
      if (controller.signal.aborted || version !== peopleRequestRef.current) return;
      setError(errorState(caught));
    } finally {
      if (version === peopleRequestRef.current) setLoadingPeople(false);
    }
  };

  const loadState = async (personId: string) => {
    const version = ++stateRequestRef.current;
    stateControllerRef.current?.abort();
    const controller = new AbortController();
    stateControllerRef.current = controller;
    setLoadingState(true);
    setError(null);
    setSuccess(false);
    try {
      const value = await archiveApi.get(personId, controller.signal);
      if (controller.signal.aborted || version !== stateRequestRef.current) return;
      setState(value);
      setReason(value.current?.reason ?? '');
    } catch (caught) {
      if (controller.signal.aborted || version !== stateRequestRef.current) return;
      setState(undefined);
      setError(errorState(caught));
    } finally {
      if (version === stateRequestRef.current) setLoadingState(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setPeople([]); setSelectedId(undefined); setState(undefined); setReason(''); setSuccess(false); setError(null);
    void loadPeople();
    return () => {
      ++peopleRequestRef.current; ++stateRequestRef.current;
      peopleControllerRef.current?.abort(); stateControllerRef.current?.abort(); mutationControllerRef.current?.abort();
      mutationLockRef.current = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !selectedId) { setState(undefined); return; }
    void loadState(selectedId);
  }, [open, selectedId]);

  const mutate = async (action: 'archive' | 'restore') => {
    if (!selectedId || !state?.capabilities.write || mutationLockRef.current || (action === 'archive' && !validReason)) return;
    mutationLockRef.current = true;
    mutationControllerRef.current?.abort();
    const controller = new AbortController();
    mutationControllerRef.current = controller;
    const ownerId = selectedId;
    setMutating(true); setError(null); setSuccess(false);
    try {
      if (action === 'archive') await archiveApi.archive(ownerId, normalizedReason, controller.signal);
      else await archiveApi.restore(ownerId, controller.signal);
      if (controller.signal.aborted || selectedId !== ownerId) return;
      const authoritative = await archiveApi.get(ownerId, controller.signal);
      if (controller.signal.aborted || selectedId !== ownerId) return;
      setState(authoritative);
      setReason(authoritative.current?.reason ?? '');
      setSuccess(true);
      void loadPeople();
    } catch (caught) {
      if (!controller.signal.aborted && selectedId === ownerId) setError(errorState(caught));
    } finally {
      if (selectedId === ownerId) setMutating(false);
      mutationLockRef.current = false;
    }
  };

  const confirm = (action: 'archive' | 'restore') => Modal.confirm({
    title: action === 'archive' ? text.confirmArchive : text.confirmRestore,
    content: action === 'archive' ? text.confirmArchiveText : text.confirmRestoreText,
    okText: action === 'archive' ? text.archive : text.restore,
    cancelText: text.cancel,
    okButtonProps: action === 'archive' ? { danger: true } : undefined,
    onOk: () => mutate(action),
  });

  const errorMessage = error === 'unauthenticated' ? text.unauthenticated : error === 'forbidden' ? text.forbidden : error === 'retryable' ? text.loadError : undefined;

  return <Modal open={open} title={text.title} onCancel={mutating ? undefined : onClose} footer={<Button onClick={onClose} disabled={mutating}>{text.close}</Button>} width={760} destroyOnHidden>
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert type="info" showIcon title={text.explanation} />
      {success ? <Alert type="success" showIcon title={text.saved} /> : null}
      {errorMessage ? <Alert type="error" showIcon title={errorMessage} action={error === 'retryable' ? <Button size="small" onClick={() => selectedId ? void loadState(selectedId) : void loadPeople()}>{text.retry}</Button> : undefined} /> : null}
      {loadingPeople ? <Skeleton active paragraph={{ rows: 2 }} /> : people.length === 0 ? <Empty description={text.noPeople} /> : <>
        <div><Typography.Text strong>{text.person}</Typography.Text><Select aria-label={text.person} showSearch optionFilterProp="label" value={selectedId} onChange={setSelectedId} disabled={mutating} placeholder={text.choose} style={{ width: '100%', marginTop: 6 }} options={people.map(person => ({ value: person.id, label: person.displayName }))} /></div>
        {loadingState ? <Skeleton active paragraph={{ rows: 4 }} /> : state && selected ? <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap><Typography.Text strong>{selected.displayName}</Typography.Text><Tag color={state.status === 'archived' ? 'warning' : 'success'}>{state.status === 'archived' ? text.archived : text.active}</Tag></Space>
          {!state.capabilities.write ? <Alert type="warning" showIcon title={text.readOnly} /> : null}
          {state.current ? <div><Typography.Text type="secondary">{text.archivedAt}: {formatInstant(state.current.archivedAt, locale)}</Typography.Text><br /><Typography.Text><strong>{text.currentReason}:</strong> {state.current.reason}</Typography.Text></div> : null}
          {state.status === 'active' && state.capabilities.write ? <div><Typography.Text strong>{text.reason}</Typography.Text><Input.TextArea aria-label={text.reason} value={reason} onChange={event => setReason(event.target.value)} disabled={mutating} maxLength={240} autoSize={{ minRows: 3, maxRows: 6 }} placeholder={text.reasonPlaceholder} style={{ marginTop: 6 }} /><Typography.Text type={reason.length > 0 && !validReason ? 'danger' : 'secondary'}>{text.reasonHelp}</Typography.Text><div style={{ marginTop: 12 }}><Button danger type="primary" loading={mutating} disabled={!validReason} onClick={() => confirm('archive')}>{mutating ? text.working : text.archive}</Button></div></div> : null}
          {state.status === 'archived' && state.capabilities.write ? <Button type="primary" loading={mutating} onClick={() => confirm('restore')}>{mutating ? text.working : text.restore}</Button> : null}
          <div><Typography.Title level={5}>{text.history}</Typography.Title>{state.history.length ? <Timeline items={[...state.history].reverse().map(entry => ({ children: <><Typography.Text strong>{entry.action === 'archived' ? text.archivedAction : text.restoredAction}</Typography.Text><br /><Typography.Text type="secondary">{formatInstant(entry.occurredAt, locale)}</Typography.Text>{entry.reason ? <><br /><Typography.Text>{entry.reason}</Typography.Text></> : null}</> }))} /> : <Typography.Text type="secondary">{text.noHistory}</Typography.Text>}</div>
        </Space> : null}
      </>}
    </Space>
  </Modal>;
}
