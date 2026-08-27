import { useEffect, useRef, useState, type FormEvent } from 'react';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import type { Locale } from './lib/preferences';
import { emergencyContactsApi, type EmergencyContactDto } from './lib/emergencyContactsApi';
import { sessionApi } from './lib/sessionApi';

const { Paragraph, Text, Title } = Typography;

type AccessState = 'loading' | 'ready' | 'forbidden' | 'error';

const copy = {
  'pt-PT': {
    title: 'Modo de emergência', subtitle: 'Acesso rápido aos contactos de emergência desta pessoa.', loading: 'A carregar contactos de emergência…', empty: 'Não existem contactos de emergência registados.', name: 'Nome', phone: 'Telefone', relationship: 'Relação', add: 'Adicionar contacto', adding: 'A adicionar…', close: 'Fechar', remove: 'Remover', removing: 'A remover…', restricted: 'Dados sensíveis. Use este modo apenas quando o contacto for necessário e evite expor o ecrã a terceiros.', unavailable: 'Não foi possível aceder aos contactos de emergência. Tente novamente.', forbidden: 'Não tem permissão para consultar contactos de emergência.', saveError: 'Não foi possível guardar o contacto. Tente novamente.', removeError: 'Não foi possível remover o contacto. Tente novamente.', retry: 'Tentar novamente', successAdd: 'Contacto de emergência adicionado.', successRemove: 'Contacto de emergência removido.', confirmTitle: 'Remover contacto de emergência?', confirmBody: 'Esta ação remove o contacto selecionado. O nome e telefone não são repetidos nesta confirmação para reduzir a exposição visual de dados sensíveis.', confirm: 'Sim, remover', cancel: 'Cancelar', sensitive: 'Sensível', formTitle: 'Adicionar contacto de emergência', discardTitle: 'Descartar alterações?', discardBody: 'As alterações não guardadas a este contacto serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações', call: 'Ligar', readOnly: 'Tem acesso de leitura. Alterações exigem a permissão específica de escrita.' },
  en: {
    title: 'Emergency mode', subtitle: 'Quick access to this person’s emergency contacts.', loading: 'Loading emergency contacts…', empty: 'There are no emergency contacts recorded.', name: 'Name', phone: 'Phone', relationship: 'Relationship', add: 'Add contact', adding: 'Adding…', close: 'Close', remove: 'Remove', removing: 'Removing…', restricted: 'Sensitive data. Use this mode only when the contact is needed and avoid exposing the screen to bystanders.', unavailable: 'Emergency contacts could not be accessed. Please try again.', forbidden: 'You do not have permission to view emergency contacts.', saveError: 'The contact could not be saved. Please try again.', removeError: 'The contact could not be removed. Please try again.', retry: 'Try again', successAdd: 'Emergency contact added.', successRemove: 'Emergency contact removed.', confirmTitle: 'Remove emergency contact?', confirmBody: 'This action removes the selected contact. Name and phone are not repeated in this confirmation to reduce visual exposure of sensitive data.', confirm: 'Yes, remove', cancel: 'Cancel', sensitive: 'Sensitive', formTitle: 'Add emergency contact', discardTitle: 'Discard changes?', discardBody: 'Unsaved changes to this contact will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes', call: 'Call', readOnly: 'You have read access. Changes require the specific write permission.' },
  es: {
    title: 'Modo de emergencia', subtitle: 'Acceso rápido a los contactos de emergencia de esta persona.', loading: 'Cargando contactos de emergencia…', empty: 'No hay contactos de emergencia registrados.', name: 'Nombre', phone: 'Teléfono', relationship: 'Relación', add: 'Añadir contacto', adding: 'Añadiendo…', close: 'Cerrar', remove: 'Eliminar', removing: 'Eliminando…', restricted: 'Datos sensibles. Use este modo solo cuando el contacto sea necesario y evite exponer la pantalla a terceros.', unavailable: 'No se pudo acceder a los contactos de emergencia. Inténtelo de nuevo.', forbidden: 'No tiene permiso para consultar contactos de emergencia.', saveError: 'No se pudo guardar el contacto. Inténtelo de nuevo.', removeError: 'No se pudo eliminar el contacto. Inténtelo de nuevo.', retry: 'Intentar de nuevo', successAdd: 'Contacto de emergencia añadido.', successRemove: 'Contacto de emergencia eliminado.', confirmTitle: '¿Eliminar contacto de emergencia?', confirmBody: 'Esta acción elimina el contacto seleccionado. El nombre y el teléfono no se repiten en esta confirmación para reducir la exposición visual de datos sensibles.', confirm: 'Sí, eliminar', cancel: 'Cancelar', sensitive: 'Sensible', formTitle: 'Añadir contacto de emergencia', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderán los cambios no guardados de este contacto.', keepEditing: 'Seguir editando', discard: 'Descartar cambios', call: 'Llamar', readOnly: 'Tiene acceso de lectura. Los cambios requieren el permiso específico de escritura.' },
} as const;

export function canSubmitEmergencyContact(name: string, phone: string, saving: boolean): boolean {
  return !saving && name.trim().length > 0 && phone.trim().length > 0;
}

export function hasUnsavedEmergencyContactDraft(name: string, phone: string, relationship: string): boolean {
  return Boolean(name.trim() || phone.trim() || relationship.trim());
}

export function emergencyContactAccess(capabilities: readonly string[]): Readonly<{ canRead: boolean; canWrite: boolean }> {
  const canRead = capabilities.includes('emergency-contacts.read');
  return Object.freeze({ canRead, canWrite: canRead && capabilities.includes('emergency-contacts.write') });
}

function safeTelHref(phone: string): string | undefined {
  const normalized = phone.replace(/[^+0-9]/g, '');
  return normalized ? `tel:${normalized}` : undefined;
}

export function EmergencyContactsDialog({ personId, personName, locale, open, onClose }: { personId: string; personName: string; locale: Locale; open: boolean; onClose(): void }) {
  const text = copy[locale];
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [canWrite, setCanWrite] = useState(false);
  const [contacts, setContacts] = useState<readonly EmergencyContactDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'remove' | null>(null);
  const [notice, setNotice] = useState<'add' | 'remove' | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const savingRef = useRef(false);
  const removingRef = useRef(false);
  const removeTriggerRef = useRef<HTMLButtonElement | null>(null);
  const requestRef = useRef(0);

  const loadContacts = async (signal?: AbortSignal) => {
    const request = ++requestRef.current;
    setLoading(true); setLoadError(false);
    try {
      const value = await emergencyContactsApi.list(personId, signal);
      if (signal?.aborted || request !== requestRef.current) return;
      setContacts(value);
    } catch (reason) {
      if (signal?.aborted || request !== requestRef.current || (reason instanceof DOMException && reason.name === 'AbortError')) return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted && request === requestRef.current) setLoading(false);
    }
  };

  const initialize = async (signal?: AbortSignal) => {
    setAccessState('loading'); setCanWrite(false); setContacts([]); setLoadError(false);
    try {
      const session = await sessionApi.current(signal);
      if (signal?.aborted) return;
      const access = emergencyContactAccess(session.capabilities);
      if (!access.canRead) { setAccessState('forbidden'); return; }
      setCanWrite(access.canWrite);
      setAccessState('ready');
      await loadContacts(signal);
    } catch (reason) {
      if (signal?.aborted || (reason instanceof DOMException && reason.name === 'AbortError')) return;
      setAccessState('error');
    }
  };

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void initialize(controller.signal);
    return () => { requestRef.current += 1; controller.abort(); };
  }, [open, personId]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canWrite || !canSubmitEmergencyContact(name, phone, saving) || savingRef.current) return;
    savingRef.current = true; setSaving(true); setOperationError(null); setNotice(null);
    try {
      await emergencyContactsApi.create(personId, { name: name.trim(), phone: phone.trim(), relationship: relationship.trim() || undefined });
      setName(''); setPhone(''); setRelationship(''); setNotice('add'); await loadContacts();
    } catch { setOperationError('save'); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const remove = async () => {
    if (!canWrite || !confirmingId || removingRef.current) return;
    const id = confirmingId;
    removingRef.current = true; setRemovingId(id); setOperationError(null); setNotice(null);
    try {
      await emergencyContactsApi.remove(personId, id);
      setConfirmingId(null); setNotice('remove'); await loadContacts();
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    } catch {
      setConfirmingId(null); setOperationError('remove');
      window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
    } finally { removingRef.current = false; setRemovingId(null); }
  };

  const resetDraft = () => { setName(''); setPhone(''); setRelationship(''); setOperationError(null); };
  const closeDialog = () => {
    if (saving || removingId || confirmingId) return;
    if (canWrite && hasUnsavedEmergencyContactDraft(name, phone, relationship)) { setDiscardOpen(true); return; }
    onClose();
  };
  const discardDraftAndClose = () => { setDiscardOpen(false); resetDraft(); onClose(); };
  const closeRemoveConfirmation = () => {
    if (removingId) return;
    setConfirmingId(null);
    window.requestAnimationFrame(() => removeTriggerRef.current?.focus());
  };

  return <>
    <Modal open={open} onCancel={closeDialog} width={720} title={<Space direction="vertical" size={0}><Space wrap><Title level={4} style={{ margin: 0 }}>{text.title}</Title><Tag color="warning">{text.sensitive}</Tag></Space><Text type="secondary">{personName}</Text></Space>} footer={<Button onClick={closeDialog} disabled={saving || removingId !== null || confirmingId !== null || discardOpen}>{text.close}</Button>} styles={{ body: { maxHeight: '72vh', overflowY: 'auto' } }} destroyOnHidden aria-describedby="emergency-mode-description">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Paragraph id="emergency-mode-description" type="secondary" style={{ marginBottom: 0 }}>{text.subtitle}</Paragraph>
        <Alert type="warning" showIcon title={text.restricted} />
        {accessState === 'loading' ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}
        {accessState === 'forbidden' ? <Alert type="warning" showIcon title={text.forbidden} /> : null}
        {accessState === 'error' ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" onClick={() => void initialize()}>{text.retry}</Button>} /> : null}
        {accessState === 'ready' && !canWrite ? <Alert type="info" showIcon title={text.readOnly} /> : null}
        {accessState === 'ready' && notice ? <Alert type="success" showIcon closable onClose={() => setNotice(null)} title={notice === 'add' ? text.successAdd : text.successRemove} /> : null}
        {accessState === 'ready' && operationError ? <Alert type="error" showIcon title={operationError === 'save' ? text.saveError : text.removeError} /> : null}
        {accessState === 'ready' && loadError ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" disabled={loading} onClick={() => void loadContacts()}>{text.retry}</Button>} /> : null}
        {accessState === 'ready' && loading ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /></div> : null}
        {accessState === 'ready' && !loading && !loadError && contacts.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /> : null}
        {accessState === 'ready' && !loading && !loadError ? contacts.map(contact => {
          const tel = safeTelHref(contact.phone);
          return <Card key={contact.id} size="small"><Space direction="vertical" size="small" style={{ width: '100%' }}><Space align="start" style={{ width: '100%', justifyContent: 'space-between' }} wrap><div><Text strong>{contact.name}</Text>{contact.relationship ? <><br /><Text type="secondary">{contact.relationship}</Text></> : null}</div>{canWrite ? <Button danger size="small" disabled={removingId !== null} onClick={event => { removeTriggerRef.current = event.currentTarget; setConfirmingId(contact.id); setOperationError(null); }}>{removingId === contact.id ? text.removing : text.remove}</Button> : null}</Space><Text style={{ fontSize: 18, overflowWrap: 'anywhere' }}>{contact.phone}</Text>{tel ? <Button type="primary" href={tel} block>{text.call}</Button> : null}</Space></Card>;
        }) : null}
        {accessState === 'ready' && canWrite ? <Card size="small" title={text.formTitle}><form onSubmit={submit}><Space direction="vertical" size="small" style={{ width: '100%' }}><Input aria-label={text.name} placeholder={text.name} autoComplete="off" maxLength={120} value={name} onChange={event => setName(event.target.value)} required /><Input aria-label={text.phone} placeholder={text.phone} type="tel" inputMode="tel" autoComplete="off" maxLength={64} value={phone} onChange={event => setPhone(event.target.value)} required /><Input aria-label={text.relationship} placeholder={text.relationship} autoComplete="off" maxLength={120} value={relationship} onChange={event => setRelationship(event.target.value)} /><Button htmlType="submit" type="primary" loading={saving} disabled={!canSubmitEmergencyContact(name, phone, saving)} block>{saving ? text.adding : text.add}</Button></Space></form></Card> : null}
      </Space>
    </Modal>
    <Modal open={discardOpen} onCancel={() => setDiscardOpen(false)} title={text.discardTitle} footer={<Space><Button onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button><Button danger type="primary" onClick={discardDraftAndClose}>{text.discard}</Button></Space>}><Paragraph>{text.discardBody}</Paragraph></Modal>
    <Modal open={confirmingId !== null} onCancel={closeRemoveConfirmation} title={text.confirmTitle} footer={<Space><Button disabled={removingId !== null} onClick={closeRemoveConfirmation}>{text.cancel}</Button><Button danger type="primary" loading={removingId !== null} onClick={() => void remove()}>{removingId ? text.removing : text.confirm}</Button></Space>}><Paragraph>{text.confirmBody}</Paragraph></Modal>
  </>;
}
