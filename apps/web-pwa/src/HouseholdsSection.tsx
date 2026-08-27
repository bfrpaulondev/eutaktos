import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Modal from 'antd/es/modal';
import Row from 'antd/es/row';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { Locale } from './lib/preferences';
import { householdsApi, type HouseholdDto, type HouseholdsApi } from './lib/householdsApi';

const copy = {
  'pt-PT': { title: 'Agregados familiares', subtitle: 'Agrupa pessoas da mesma família sem duplicar informação de perfis.', create: 'Criar agregado', name: 'Nome do agregado', members: 'IDs dos membros', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirm: 'Eliminar agregado?', confirmBody: 'Esta ação remove o agregado, mas não elimina os perfis das pessoas.', removing: 'A eliminar…', empty: 'Ainda não existem agregados familiares.', loading: 'A carregar agregados…', error: 'Não foi possível carregar os agregados. Tenta novamente.', saveError: 'Não foi possível guardar o agregado. Tenta novamente.', deleteError: 'Não foi possível eliminar o agregado. Tenta novamente.', retry: 'Tentar novamente', hint: 'Separa IDs por vírgulas. Apenas IDs já fornecidos pela API são guardados.', member: 'membro', membersCount: 'membros', successCreate: 'Agregado criado com sucesso.', successUpdate: 'Agregado atualizado com sucesso.', successDelete: 'Agregado eliminado com sucesso.', actions: 'Ações do agregado', discardTitle: 'Descartar alterações?', discardBody: 'As alterações não guardadas a este agregado serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Households', subtitle: 'Group people from the same family without duplicating profile information.', create: 'Create household', name: 'Household name', members: 'Member IDs', edit: 'Edit', delete: 'Delete', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirm: 'Delete household?', confirmBody: 'This removes the household but does not delete any people profiles.', removing: 'Deleting…', empty: 'There are no households yet.', loading: 'Loading households…', error: 'Households could not be loaded. Please try again.', saveError: 'The household could not be saved. Please try again.', deleteError: 'The household could not be deleted. Please try again.', retry: 'Try again', hint: 'Separate IDs with commas. Only IDs already provided by the API are saved.', member: 'member', membersCount: 'members', successCreate: 'Household created successfully.', successUpdate: 'Household updated successfully.', successDelete: 'Household deleted successfully.', actions: 'Household actions', discardTitle: 'Discard changes?', discardBody: 'Unsaved changes to this household will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Grupos familiares', subtitle: 'Agrupa personas de la misma familia sin duplicar información de perfiles.', create: 'Crear grupo', name: 'Nombre del grupo', members: 'IDs de miembros', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirm: '¿Eliminar grupo familiar?', confirmBody: 'Esta acción elimina el grupo, pero no elimina los perfiles de las personas.', removing: 'Eliminando…', empty: 'Todavía no hay grupos familiares.', loading: 'Cargando grupos familiares…', error: 'No se pudieron cargar los grupos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el grupo. Inténtalo de nuevo.', deleteError: 'No se pudo eliminar el grupo. Inténtalo de nuevo.', retry: 'Intentar de nuevo', hint: 'Separa los IDs con comas. Solo se guardan IDs ya proporcionados por la API.', member: 'miembro', membersCount: 'miembros', successCreate: 'Grupo creado correctamente.', successUpdate: 'Grupo actualizado correctamente.', successDelete: 'Grupo eliminado correctamente.', actions: 'Acciones del grupo', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderán los cambios no guardados de este grupo familiar.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

export function parseMemberIds(value: string): string[] {
  return [...new Set(value.split(',').map(memberId => memberId.trim()).filter(Boolean))];
}

export function canSubmitHousehold(name: string, saving: boolean): boolean {
  return !saving && name.trim().length > 0;
}

export function hasUnsavedHouseholdDraft(name: string, members: string, editing: Pick<HouseholdDto, 'name' | 'memberIds'> | null): boolean {
  const normalizedName = name.trim();
  const normalizedMembers = parseMemberIds(members);
  if (!editing) return normalizedName.length > 0 || normalizedMembers.length > 0;
  return normalizedName !== editing.name || normalizedMembers.join('\u0000') !== editing.memberIds.join('\u0000');
}

function focusCreateButton() {
  window.requestAnimationFrame(() => document.getElementById('households-create-button')?.focus());
}

export function HouseholdsSection({ locale, api = householdsApi }: { locale: Locale; api?: HouseholdsApi }) {
  const text = copy[locale];
  const [items, setItems] = useState<readonly HouseholdDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'delete' | null>(null);
  const [notice, setNotice] = useState<'create' | 'update' | 'delete' | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HouseholdDto | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const actionTriggerRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  const deletingRef = useRef(false);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError(false);
    try {
      setItems(await api.list(signal));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setLoadError(true);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [api]);

  const sorted = useMemo(() => [...items].sort((first, second) => first.name.localeCompare(second.name, locale)), [items, locale]);
  const deletingHousehold = sorted.find(item => item.id === deleteId) ?? null;

  const restoreEditorTrigger = (wasEditing: boolean) => {
    window.requestAnimationFrame(() => {
      if (wasEditing) actionTriggerRef.current?.focus();
      else document.getElementById('households-create-button')?.focus();
    });
  };

  const closeEditor = () => {
    if (saving) return;
    if (hasUnsavedHouseholdDraft(name, members, editing)) {
      setDiscardOpen(true);
      return;
    }
    const wasEditing = editing !== null;
    setOpen(false);
    setOperationError(null);
    restoreEditorTrigger(wasEditing);
  };

  const discardEditor = () => {
    const wasEditing = editing !== null;
    setDiscardOpen(false);
    setOpen(false);
    setEditing(null);
    setName('');
    setMembers('');
    setOperationError(null);
    restoreEditorTrigger(wasEditing);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteId(null);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
  };

  const begin = (item?: HouseholdDto, trigger?: HTMLElement) => {
    if (trigger) actionTriggerRef.current = trigger;
    setNotice(null);
    setOperationError(null);
    setDiscardOpen(false);
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setMembers(item?.memberIds.join(', ') ?? '');
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitHousehold(name, saving) || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setOperationError(null);
    setNotice(null);
    const householdName = name.trim();
    const memberIds = parseMemberIds(members);
    try {
      const saved = editing
        ? await api.update(editing.id, { name: householdName, memberIds })
        : await api.create({ name: householdName, memberIds });
      setItems(current => editing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      const wasEditing = editing !== null;
      setOpen(false);
      setDiscardOpen(false);
      setEditing(null);
      setName('');
      setMembers('');
      setNotice(wasEditing ? 'update' : 'create');
      restoreEditorTrigger(wasEditing);
    } catch {
      setOperationError('save');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deletingHousehold || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setOperationError(null);
    setNotice(null);
    try {
      await api.delete(deletingHousehold.id);
      setItems(current => current.filter(item => item.id !== deletingHousehold.id));
      setDeleteId(null);
      setNotice('delete');
      window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
    } catch {
      setOperationError('delete');
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const noticeText = notice === 'create' ? text.successCreate : notice === 'update' ? text.successUpdate : text.successDelete;

  return <section aria-labelledby="households-title">
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Row gutter={[16, 16]} align="bottom" justify="space-between">
          <Col xs={24} md={18}>
            <Typography.Text type="secondary">{text.title}</Typography.Text>
            <Typography.Title level={2} id="households-title" style={{ marginTop: 4, marginBottom: 8 }}>{text.title}</Typography.Title>
            <Typography.Text type="secondary">{text.subtitle}</Typography.Text>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Button id="households-create-button" type="primary" onClick={() => begin()}>{text.create}</Button>
          </Col>
        </Row>
      </Card>

      {notice ? <Alert type="success" showIcon closable title={noticeText} onClose={() => setNotice(null)} /> : null}
      {operationError ? <Alert type="error" showIcon title={operationError === 'save' ? text.saveError : text.deleteError} /> : null}
      {loadError ? <Alert type="warning" showIcon title={text.error} action={<Button size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {loading ? <Card role="status" aria-live="polite" aria-label={text.loading}><Skeleton active paragraph={{ rows: 3 }} /><Typography.Text type="secondary">{text.loading}</Typography.Text></Card> : null}
      {!loading && !loadError && sorted.length === 0 ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.empty} /></Card> : null}

      {!loading && !loadError && sorted.length > 0 ? <Row gutter={[16, 16]}>
        {sorted.map(item => <Col key={item.id} xs={24} sm={12} xl={8}>
          <Card title={item.name} extra={<Tag>{item.memberIds.length} {item.memberIds.length === 1 ? text.member : text.membersCount}</Tag>} style={{ height: '100%' }}>
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              {item.memberIds.length > 0 ? <Space wrap aria-label={text.members}>
                {item.memberIds.slice(0, 4).map(memberId => <Tag key={memberId}>{memberId}</Tag>)}
                {item.memberIds.length > 4 ? <Tag>+{item.memberIds.length - 4}</Tag> : null}
              </Space> : <Typography.Text type="secondary">{text.empty}</Typography.Text>}
              <Space wrap aria-label={`${text.actions} — ${item.name}`}>
                <Button size="small" onClick={event => begin(item, event.currentTarget)}>{text.edit}</Button>
                <Button size="small" danger disabled={deleting} onClick={event => { actionTriggerRef.current = event.currentTarget; setOperationError(null); setDeleteId(item.id); }}>{text.delete}</Button>
              </Space>
            </Space>
          </Card>
        </Col>)}
      </Row> : null}
    </Space>

    <Modal
      open={open}
      title={<span id="household-editor-title">{editing ? text.edit : text.create}</span>}
      aria-labelledby="household-editor-title"
      aria-describedby={operationError === 'save' ? 'household-form-error' : undefined}
      onCancel={closeEditor}
      maskClosable={!saving}
      keyboard={!saving}
      footer={null}
      destroyOnHidden
    >
      <form onSubmit={submit}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <label>
            <Typography.Text strong>{text.name}</Typography.Text>
            <Input autoFocus required maxLength={120} value={name} onChange={event => setName(event.target.value)} aria-label={text.name} />
          </label>
          <label>
            <Typography.Text strong>{text.members}</Typography.Text>
            <Input.TextArea rows={3} value={members} onChange={event => setMembers(event.target.value)} aria-label={text.members} placeholder={text.hint} />
          </label>
          {operationError === 'save' ? <Alert id="household-form-error" type="error" showIcon title={text.saveError} /> : null}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeEditor} disabled={saving}>{text.cancel}</Button>
            <Button htmlType="submit" type="primary" loading={saving} disabled={!canSubmitHousehold(name, saving)}>{saving ? text.saving : text.save}</Button>
          </Space>
        </Space>
      </form>
    </Modal>

    <Modal
      open={discardOpen}
      title={<span id="household-discard-title">{text.discardTitle}</span>}
      aria-labelledby="household-discard-title"
      aria-describedby="household-discard-description"
      onCancel={() => setDiscardOpen(false)}
      footer={[
        <Button key="keep" autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button>,
        <Button key="discard" danger type="primary" onClick={discardEditor}>{text.discard}</Button>,
      ]}
    >
      <Typography.Text id="household-discard-description">{text.discardBody}</Typography.Text>
    </Modal>

    <Modal
      open={deletingHousehold !== null}
      title={<span id="household-delete-title">{text.confirm}</span>}
      aria-labelledby="household-delete-title"
      aria-describedby="household-delete-description"
      onCancel={closeDelete}
      maskClosable={!deleting}
      keyboard={!deleting}
      footer={[
        <Button key="cancel" disabled={deleting} onClick={closeDelete}>{text.cancel}</Button>,
        <Button key="delete" danger type="primary" loading={deleting} disabled={!deletingHousehold} onClick={() => void remove()}>{deleting ? text.removing : text.delete}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Text id="household-delete-description">{text.confirmBody}</Typography.Text>
        {deletingHousehold ? <Typography.Text strong>{deletingHousehold.name}</Typography.Text> : null}
      </Space>
    </Modal>
  </section>;
}
