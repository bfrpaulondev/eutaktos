import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Modal from 'antd/es/modal';
import Segmented from 'antd/es/segmented';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { peopleDirectoryApi, type PeopleDirectoryPersonDto } from './lib/peopleDirectoryApi';
import {
  peopleTransfersApi,
  PeopleTransfersApiError,
  type PeopleTransferHistoryDto,
  type PeopleTransferPreviewDto,
  type PeopleTransferSendDto,
  type PeopleTransferStatus,
} from './lib/peopleTransfersApi';
import type { Locale } from './lib/preferences';

type Mode = 'send' | 'receive';
type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';

const copy = {
  'pt-PT': {
    title: 'Transferências', send: 'Enviar', receive: 'Receber', privacy: 'A transferência copia apenas nome, idioma preferido e contacto comum. Não transfere contactos de emergência, elegibilidade, ausências, etiquetas, grupos, responsabilidades, histórico ou IDs externos. A pessoa original não é removida automaticamente.', selectPeople: 'Selecionar pessoas', prepare: 'Preparar transferência', confirmSendTitle: 'Confirmar transferência', confirmSend: 'Criar código', cancel: 'Cancelar', codeTitle: 'Código de transferência', codeOnce: 'Guarde e partilhe este código por um canal apropriado. O Eutaktos mostra-o apenas nesta confirmação e ele expira em 72 horas.', expires: 'Expira', copy: 'Copiar código', copied: 'Código copiado.', history: 'Histórico de envios', noHistory: 'Ainda não existem transferências enviadas.', pending: 'Pendente', claimed: 'Recebida', expired: 'Expirada', cancelled: 'Cancelada', receiveCode: 'Código', preview: 'Pré-visualizar', receiveHelp: 'Cole o código recebido. O código fica apenas nesta janela e não é guardado no browser.', invalidCode: 'Introduza um código de transferência válido.', confirmReceive: 'Confirmar receção', confirmReceiveTitle: 'Receber estas pessoas?', receiveSuccess: 'Transferência recebida.', alreadyReceived: 'Esta transferência já tinha sido recebida nesta congregação; o resultado anterior foi recuperado.', close: 'Fechar', loading: 'A carregar transferências…', retry: 'Tentar novamente', error: 'Não foi possível carregar ou concluir a transferência.', unauthenticated: 'A sessão terminou.', forbidden: 'Não tem permissão para usar transferências.', noPeople: 'Não existem pessoas disponíveis para transferir.', peopleCount: 'pessoas' },
  en: {
    title: 'Transfers', send: 'Send', receive: 'Receive', privacy: 'A transfer copies only name, preferred language and ordinary contact. It does not transfer emergency contacts, eligibility, away periods, labels, groups, responsibilities, history or external IDs. The original person is not removed automatically.', selectPeople: 'Select people', prepare: 'Prepare transfer', confirmSendTitle: 'Confirm transfer', confirmSend: 'Create code', cancel: 'Cancel', codeTitle: 'Transfer code', codeOnce: 'Keep and share this code through an appropriate channel. Eutaktos shows it only in this confirmation and it expires in 72 hours.', expires: 'Expires', copy: 'Copy code', copied: 'Code copied.', history: 'Send history', noHistory: 'No transfers have been sent yet.', pending: 'Pending', claimed: 'Received', expired: 'Expired', cancelled: 'Cancelled', receiveCode: 'Code', preview: 'Preview', receiveHelp: 'Paste the received code. The code stays only in this window and is not stored in the browser.', invalidCode: 'Enter a valid transfer code.', confirmReceive: 'Confirm receive', confirmReceiveTitle: 'Receive these people?', receiveSuccess: 'Transfer received.', alreadyReceived: 'This transfer had already been received by this congregation; the previous result was recovered.', close: 'Close', loading: 'Loading transfers…', retry: 'Try again', error: 'The transfer could not be loaded or completed.', unauthenticated: 'Your session ended.', forbidden: 'You do not have permission to use transfers.', noPeople: 'There are no people available to transfer.', peopleCount: 'people' },
  es: {
    title: 'Transferencias', send: 'Enviar', receive: 'Recibir', privacy: 'La transferencia copia solo nombre, idioma preferido y contacto común. No transfiere contactos de emergencia, elegibilidad, ausencias, etiquetas, grupos, responsabilidades, historial ni IDs externos. La persona original no se elimina automáticamente.', selectPeople: 'Seleccionar personas', prepare: 'Preparar transferencia', confirmSendTitle: 'Confirmar transferencia', confirmSend: 'Crear código', cancel: 'Cancelar', codeTitle: 'Código de transferencia', codeOnce: 'Guarde y comparta este código por un canal apropiado. Eutaktos lo muestra solo en esta confirmación y caduca en 72 horas.', expires: 'Caduca', copy: 'Copiar código', copied: 'Código copiado.', history: 'Historial de envíos', noHistory: 'Todavía no hay transferencias enviadas.', pending: 'Pendiente', claimed: 'Recibida', expired: 'Caducada', cancelled: 'Cancelada', receiveCode: 'Código', preview: 'Vista previa', receiveHelp: 'Pegue el código recibido. El código permanece solo en esta ventana y no se guarda en el navegador.', invalidCode: 'Introduzca un código de transferencia válido.', confirmReceive: 'Confirmar recepción', confirmReceiveTitle: '¿Recibir estas personas?', receiveSuccess: 'Transferencia recibida.', alreadyReceived: 'Esta transferencia ya había sido recibida por esta congregación; se recuperó el resultado anterior.', close: 'Cerrar', loading: 'Cargando transferencias…', retry: 'Intentar de nuevo', error: 'No se pudo cargar o completar la transferencia.', unauthenticated: 'La sesión terminó.', forbidden: 'No tiene permiso para usar transferencias.', noPeople: 'No hay personas disponibles para transferir.', peopleCount: 'personas' },
} as const;

function statusLabel(status: PeopleTransferStatus, text: (typeof copy)[Locale]): string {
  return text[status];
}

export function PeopleTransfersDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const requestVersion = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const [mode, setMode] = useState<Mode>('send');
  const [state, setState] = useState<LoadState>('idle');
  const [people, setPeople] = useState<readonly PeopleDirectoryPersonDto[]>([]);
  const [history, setHistory] = useState<readonly PeopleTransferHistoryDto[]>([]);
  const [selectedIds, setSelectedIds] = useState<readonly string[]>([]);
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<PeopleTransferSendDto | null>(null);
  const [copyNotice, setCopyNotice] = useState(false);
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<PeopleTransferPreviewDto | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [claimConfirmOpen, setClaimConfirmOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [receiveNotice, setReceiveNotice] = useState<string | null>(null);

  const cancelRequests = () => {
    requestVersion.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  };

  const load = async () => {
    const version = ++requestVersion.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState('loading');
    try {
      const [directory, transfers] = await Promise.all([peopleDirectoryApi.get(controller.signal), peopleTransfersApi.list(controller.signal)]);
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setPeople(directory.people.filter(person => person.active));
      setHistory(transfers.transfers);
      setState('ready');
    } catch (reason) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      if (reason instanceof PeopleTransfersApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleTransfersApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally {
      if (version === requestVersion.current) controllerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) { cancelRequests(); return; }
    setMode('send');
    setSelectedIds([]);
    setSent(null);
    setCopyNotice(false);
    setCode('');
    setPreview(null);
    setReceiveNotice(null);
    void load();
    return cancelRequests;
  }, [open]);

  const selectedPeople = useMemo(() => selectedIds.map(id => people.find(person => person.id === id)).filter((person): person is PeopleDirectoryPersonDto => Boolean(person)), [people, selectedIds]);
  const validCode = /^[A-Za-z0-9_-]{43}$/.test(code.trim());

  const send = async () => {
    if (!selectedIds.length || sending) return;
    setSending(true);
    setState('ready');
    try {
      const result = await peopleTransfersApi.send(selectedIds);
      setSent(result);
      setSelectedIds([]);
      setSendConfirmOpen(false);
      const transfers = await peopleTransfersApi.list();
      setHistory(transfers.transfers);
    } catch (reason) {
      if (reason instanceof PeopleTransfersApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleTransfersApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally { setSending(false); }
  };

  const previewCode = async () => {
    const normalized = code.trim();
    if (!/^[A-Za-z0-9_-]{43}$/.test(normalized) || previewing) return;
    const version = ++requestVersion.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPreviewing(true);
    setPreview(null);
    setReceiveNotice(null);
    try {
      const value = await peopleTransfersApi.preview(normalized, controller.signal);
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setPreview(value);
    } catch (reason) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      if (reason instanceof PeopleTransfersApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleTransfersApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally {
      if (version === requestVersion.current) controllerRef.current = null;
      setPreviewing(false);
    }
  };

  const claim = async () => {
    const normalized = code.trim();
    if (!preview || !/^[A-Za-z0-9_-]{43}$/.test(normalized) || claiming) return;
    setClaiming(true);
    try {
      const result = await peopleTransfersApi.claim(normalized);
      setReceiveNotice(result.outcome === 'already-claimed' ? text.alreadyReceived : text.receiveSuccess);
      setCode('');
      setPreview(null);
      setClaimConfirmOpen(false);
      await load();
    } catch (reason) {
      if (reason instanceof PeopleTransfersApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleTransfersApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally { setClaiming(false); }
  };

  const changeCode = (value: string) => {
    cancelRequests();
    setCode(value);
    setPreview(null);
    setReceiveNotice(null);
    if (state === 'error') setState('ready');
  };

  const close = () => {
    cancelRequests();
    setCode('');
    setSent(null);
    setPreview(null);
    onClose();
  };

  const peopleOptions = people.map(person => ({ value: person.id, label: person.displayName }));

  return <Modal open={open} onCancel={close} width={900} title={text.title} destroyOnHidden footer={<Button onClick={close}>{text.close}</Button>}>
    <Space orientation="vertical" size="large" style={{ width: '100%' }}>
      <Segmented value={mode} options={[{ value: 'send', label: text.send }, { value: 'receive', label: text.receive }]} onChange={value => { cancelRequests(); setMode(value as Mode); setPreview(null); setReceiveNotice(null); }} />
      {state === 'loading' ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 5 }} /></div> : null}
      {state === 'unauthenticated' ? <Alert type="error" showIcon title={text.unauthenticated} /> : null}
      {state === 'forbidden' ? <Alert type="warning" showIcon title={text.forbidden} /> : null}
      {state === 'error' ? <Alert type="error" showIcon title={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {state === 'ready' && mode === 'send' ? <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Alert type="warning" showIcon title={text.privacy} />
        {people.length ? <Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text strong>{text.selectPeople}</Typography.Text>
          <Select aria-label={text.selectPeople} mode="multiple" value={[...selectedIds]} options={peopleOptions} onChange={values => { setSent(null); setSelectedIds(values); }} style={{ width: '100%' }} />
          <Button type="primary" disabled={!selectedIds.length || sending} onClick={() => setSendConfirmOpen(true)}>{text.prepare}</Button>
        </Space> : <Empty description={text.noPeople} />}
        {sent ? <Alert type="success" showIcon title={text.codeTitle} description={<Space orientation="vertical" size="small" style={{ width: '100%' }}>
          <Typography.Text>{text.codeOnce}</Typography.Text>
          <Input value={sent.code} readOnly aria-label={text.codeTitle} />
          <Space wrap><Button onClick={() => { void navigator.clipboard?.writeText(sent.code); setCopyNotice(true); }}>{text.copy}</Button><Typography.Text type="secondary">{text.expires}: {new Date(sent.expiresAt).toLocaleString(locale)}</Typography.Text></Space>
          {copyNotice ? <Typography.Text type="success">{text.copied}</Typography.Text> : null}
        </Space>} /> : null}
        <Typography.Title level={4}>{text.history}</Typography.Title>
        {!history.length ? <Empty description={text.noHistory} /> : <List dataSource={[...history]} renderItem={transfer => <List.Item key={transfer.transferId}><Card size="small" style={{ width: '100%' }}><Space orientation="vertical" size="small"><Space wrap><Tag>{statusLabel(transfer.status, text)}</Tag><Typography.Text type="secondary">{transfer.people.length} {text.peopleCount}</Typography.Text></Space><Typography.Text>{transfer.people.map(person => person.displayName).join(', ')}</Typography.Text><Typography.Text type="secondary">{new Date(transfer.createdAt).toLocaleString(locale)} · {text.expires}: {new Date(transfer.expiresAt).toLocaleString(locale)}</Typography.Text></Space></Card></List.Item>} />}
      </Space> : null}
      {state === 'ready' && mode === 'receive' ? <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        <Alert type="info" showIcon title={text.receiveHelp} />
        <Input aria-label={text.receiveCode} value={code} onChange={event => changeCode(event.target.value)} autoComplete="off" spellCheck={false} />
        {!validCode && code.trim() ? <Typography.Text type="danger">{text.invalidCode}</Typography.Text> : null}
        <Button type="primary" disabled={!validCode || previewing} loading={previewing} onClick={() => void previewCode()}>{text.preview}</Button>
        {preview ? <Card title={`${preview.people.length} ${text.peopleCount}`}><Space orientation="vertical" size="middle" style={{ width: '100%' }}><List size="small" dataSource={[...preview.people]} renderItem={person => <List.Item>{person.displayName}</List.Item>} /><Typography.Text type="secondary">{text.expires}: {new Date(preview.expiresAt).toLocaleString(locale)}</Typography.Text><Button type="primary" danger disabled={claiming} onClick={() => setClaimConfirmOpen(true)}>{text.confirmReceive}</Button></Space></Card> : null}
        {receiveNotice ? <Alert type="success" showIcon title={receiveNotice} /> : null}
      </Space> : null}
    </Space>
    <Modal open={sendConfirmOpen} title={text.confirmSendTitle} onCancel={() => !sending && setSendConfirmOpen(false)} footer={<Space><Button disabled={sending} onClick={() => setSendConfirmOpen(false)}>{text.cancel}</Button><Button type="primary" loading={sending} onClick={() => void send()}>{text.confirmSend}</Button></Space>}>
      <List size="small" dataSource={selectedPeople} renderItem={person => <List.Item>{person.displayName}</List.Item>} />
    </Modal>
    <Modal open={claimConfirmOpen} title={text.confirmReceiveTitle} onCancel={() => !claiming && setClaimConfirmOpen(false)} footer={<Space><Button disabled={claiming} onClick={() => setClaimConfirmOpen(false)}>{text.cancel}</Button><Button type="primary" danger loading={claiming} onClick={() => void claim()}>{text.confirmReceive}</Button></Space>}>
      <List size="small" dataSource={preview ? [...preview.people] : []} renderItem={person => <List.Item>{person.displayName}</List.Item>} />
    </Modal>
  </Modal>;
}