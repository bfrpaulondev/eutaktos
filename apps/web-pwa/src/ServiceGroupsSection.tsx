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
import { serviceGroupsApi, type ServiceGroupDto, type ServiceGroupsApi } from './lib/serviceGroupsApi';

const copy = {
  'pt-PT': { title: 'Grupos de serviço', subtitle: 'Consulta grupos, membros e responsáveis conforme os dados já autorizados pela API.', create: 'Criar grupo', name: 'Nome do grupo', members: 'IDs dos membros', overseer: 'ID do responsável', assistant: 'ID do ajudante', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'A guardar…', cancel: 'Cancelar', confirm: 'Eliminar grupo de serviço?', confirmBody: 'Esta ação elimina o grupo, mas não elimina pessoas nem altera outras responsabilidades.', removing: 'A eliminar…', empty: 'Ainda não existem grupos de serviço.', loading: 'A carregar grupos de serviço…', error: 'Não foi possível carregar os grupos. Tenta novamente.', saveError: 'Não foi possível guardar o grupo. Tenta novamente.', deleteError: 'Não foi possível eliminar o grupo. Tenta novamente.', retry: 'Tentar novamente', hint: 'Separa IDs por vírgulas. Apenas IDs já fornecidos pela API são guardados.', member: 'membro', membersCount: 'membros', responsible: 'Responsável', helper: 'Ajudante', successCreate: 'Grupo criado com sucesso.', successUpdate: 'Grupo atualizado com sucesso.', successDelete: 'Grupo eliminado com sucesso.', actions: 'Ações do grupo', discardTitle: 'Descartar alterações?', discardBody: 'As alterações não guardadas a este grupo serão perdidas.', keepEditing: 'Continuar a editar', discard: 'Descartar alterações' },
  en: { title: 'Service groups', subtitle: 'Review groups, members and responsible people from data already authorized by the API.', create: 'Create group', name: 'Group name', members: 'Member IDs', overseer: 'Overseer ID', assistant: 'Assistant ID', edit: 'Edit', delete: 'Delete', save: 'Save', saving: 'Saving…', cancel: 'Cancel', confirm: 'Delete service group?', confirmBody: 'This deletes the group but does not delete people or change other responsibilities.', removing: 'Deleting…', empty: 'There are no service groups yet.', loading: 'Loading service groups…', error: 'Service groups could not be loaded. Please try again.', saveError: 'The group could not be saved. Please try again.', deleteError: 'The group could not be deleted. Please try again.', retry: 'Try again', hint: 'Separate IDs with commas. Only IDs already provided by the API are saved.', member: 'member', membersCount: 'members', responsible: 'Overseer', helper: 'Assistant', successCreate: 'Group created successfully.', successUpdate: 'Group updated successfully.', successDelete: 'Group deleted successfully.', actions: 'Group actions', discardTitle: 'Discard changes?', discardBody: 'Unsaved changes to this group will be lost.', keepEditing: 'Keep editing', discard: 'Discard changes' },
  es: { title: 'Grupos de servicio', subtitle: 'Consulta grupos, miembros y responsables según los datos ya autorizados por la API.', create: 'Crear grupo', name: 'Nombre del grupo', members: 'IDs de miembros', overseer: 'ID del responsable', assistant: 'ID del ayudante', edit: 'Editar', delete: 'Eliminar', save: 'Guardar', saving: 'Guardando…', cancel: 'Cancelar', confirm: '¿Eliminar grupo de servicio?', confirmBody: 'Esta acción elimina el grupo, pero no elimina personas ni cambia otras responsabilidades.', removing: 'Eliminando…', empty: 'Todavía no hay grupos de servicio.', loading: 'Cargando grupos de servicio…', error: 'No se pudieron cargar los grupos. Inténtalo de nuevo.', saveError: 'No se pudo guardar el grupo. Inténtalo de nuevo.', deleteError: 'No se pudo eliminar el grupo. Inténtalo de nuevo.', retry: 'Intentar de nuevo', hint: 'Separa los IDs con comas. Solo se guardan IDs ya proporcionados por la API.', member: 'miembro', membersCount: 'miembros', responsible: 'Responsable', helper: 'Ayudante', successCreate: 'Grupo creado correctamente.', successUpdate: 'Grupo actualizado correctamente.', successDelete: 'Grupo eliminado correctamente.', actions: 'Acciones del grupo', discardTitle: '¿Descartar cambios?', discardBody: 'Se perderán los cambios no guardados de este grupo.', keepEditing: 'Seguir editando', discard: 'Descartar cambios' },
} as const;

export function parseServiceGroupMemberIds(value: string): string[] {
  return [...new Set(value.split(',').map(memberId => memberId.trim()).filter(Boolean))];
}

export function canSubmitServiceGroup(name: string, saving: boolean): boolean {
  return !saving && name.trim().length > 0;
}

export function hasUnsavedServiceGroupDraft(name: string, members: string, overseer: string, assistant: string, editing: Pick<ServiceGroupDto, 'name' | 'memberIds' | 'overseerId' | 'assistantId'> | null): boolean {
  const normalized = { name: name.trim(), memberIds: parseServiceGroupMemberIds(members), overseer: overseer.trim(), assistant: assistant.trim() };
  if (!editing) return normalized.name.length > 0 || normalized.memberIds.length > 0 || normalized.overseer.length > 0 || normalized.assistant.length > 0;
  return normalized.name !== editing.name
    || normalized.memberIds.join('\u0000') !== editing.memberIds.join('\u0000')
    || normalized.overseer !== (editing.overseerId ?? '')
    || normalized.assistant !== (editing.assistantId ?? '');
}

export function ServiceGroupsSection({ locale, api = serviceGroupsApi }: { locale: Locale; api?: ServiceGroupsApi }) {
  const text = copy[locale];
  const [items, setItems] = useState<readonly ServiceGroupDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [operationError, setOperationError] = useState<'save' | 'delete' | null>(null);
  const [notice, setNotice] = useState<'create' | 'update' | 'delete' | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceGroupDto | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [overseer, setOverseer] = useState('');
  const [assistant, setAssistant] = useState('');
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
  const deletingGroup = sorted.find(item => item.id === deleteId) ?? null;

  const restoreEditorTrigger = (wasEditing: boolean) => {
    window.requestAnimationFrame(() => {
      if (wasEditing) actionTriggerRef.current?.focus();
      else document.getElementById('service-groups-create-button')?.focus();
    });
  };

  const begin = (item?: ServiceGroupDto, trigger?: HTMLElement) => {
    if (trigger) actionTriggerRef.current = trigger;
    setNotice(null);
    setOperationError(null);
    setDiscardOpen(false);
    setEditing(item ?? null);
    setName(item?.name ?? '');
    setMembers(item?.memberIds.join(', ') ?? '');
    setOverseer(item?.overseerId ?? '');
    setAssistant(item?.assistantId ?? '');
    setOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    if (hasUnsavedServiceGroupDraft(name, members, overseer, assistant, editing)) {
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
    setOverseer('');
    setAssistant('');
    setOperationError(null);
    restoreEditorTrigger(wasEditing);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDeleteId(null);
    window.requestAnimationFrame(() => actionTriggerRef.current?.focus());
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmitServiceGroup(name, saving) || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setOperationError(null);
    setNotice(null);
    const payload = {
      name: name.trim(),
      memberIds: parseServiceGroupMemberIds(members),
      overseerId: overseer.trim() || undefined,
      assistantId: assistant.trim() || undefined,
    };
    try {
      const saved = editing ? await api.update(editing.id, payload) : await api.create(payload);
      const wasEditing = editing !== null;
      setItems(current => wasEditing ? current.map(item => item.id === saved.id ? saved : item) : [...current, saved]);
      setOpen(false);
      setDiscardOpen(false);
      setEditing(null);
      setName('');
      setMembers('');
      setOverseer('');
      setAssistant('');
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
    if (!deletingGroup || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setOperationError(null);
    setNotice(null);
    try {
      await api.delete(deletingGroup.id);
      setItems(current => current.filter(item => item.id !== deletingGroup.id));
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

  return <section aria-labelledby="service-groups-title">
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Row gutter={[16, 16]} align="bottom" justify="space-between">
          <Col xs={24} md={18}>
            <Typography.Text type="secondary">{text.title}</Typography.Text>
            <Typography.Title level={2} id="service-groups-title" style={{ marginTop: 4, marginBottom: 8 }}>{text.title}</Typography.Title>
            <Typography.Text type="secondary">{text.subtitle}</Typography.Text>
          </Col>
          <Col xs={24} md={6} style={{ textAlign: 'right' }}>
            <Button id="service-groups-create-button" type="primary" onClick={() => begin()}>{text.create}</Button>
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
              </Space> : null}
              <Space orientation="vertical" size="small">
                {item.overseerId ? <Typography.Text><strong>{text.responsible}:</strong> {item.overseerId}</Typography.Text> : null}
                {item.assistantId ? <Typography.Text><strong>{text.helper}:</strong> {item.assistantId}</Typography.Text> : null}
              </Space>
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
      title={<span id="service-group-editor-title">{editing ? text.edit : text.create}</span>}
      aria-labelledby="service-group-editor-title"
      aria-describedby={operationError === 'save' ? 'service-group-form-error' : undefined}
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
          <label>
            <Typography.Text strong>{text.overseer}</Typography.Text>
            <Input value={overseer} onChange={event => setOverseer(event.target.value)} aria-label={text.overseer} />
          </label>
          <label>
            <Typography.Text strong>{text.assistant}</Typography.Text>
            <Input value={assistant} onChange={event => setAssistant(event.target.value)} aria-label={text.assistant} />
          </label>
          {operationError === 'save' ? <Alert id="service-group-form-error" type="error" showIcon title={text.saveError} /> : null}
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={closeEditor} disabled={saving}>{text.cancel}</Button>
            <Button htmlType="submit" type="primary" loading={saving} disabled={!canSubmitServiceGroup(name, saving)}>{saving ? text.saving : text.save}</Button>
          </Space>
        </Space>
      </form>
    </Modal>

    <Modal
      open={discardOpen}
      title={<span id="service-group-discard-title">{text.discardTitle}</span>}
      aria-labelledby="service-group-discard-title"
      aria-describedby="service-group-discard-description"
      onCancel={() => setDiscardOpen(false)}
      footer={[
        <Button key="keep" autoFocus onClick={() => setDiscardOpen(false)}>{text.keepEditing}</Button>,
        <Button key="discard" danger type="primary" onClick={discardEditor}>{text.discard}</Button>,
      ]}
    >
      <Typography.Text id="service-group-discard-description">{text.discardBody}</Typography.Text>
    </Modal>

    <Modal
      open={deletingGroup !== null}
      title={<span id="service-group-delete-title">{text.confirm}</span>}
      aria-labelledby="service-group-delete-title"
      aria-describedby="service-group-delete-description"
      onCancel={closeDelete}
      maskClosable={!deleting}
      keyboard={!deleting}
      footer={[
        <Button key="cancel" disabled={deleting} onClick={closeDelete}>{text.cancel}</Button>,
        <Button key="delete" danger type="primary" loading={deleting} disabled={!deletingGroup} onClick={() => void remove()}>{deleting ? text.removing : text.delete}</Button>,
      ]}
    >
      <Space orientation="vertical" size="small">
        <Typography.Text id="service-group-delete-description">{text.confirmBody}</Typography.Text>
        {deletingGroup ? <Typography.Text strong>{deletingGroup.name}</Typography.Text> : null}
      </Space>
    </Modal>
  </section>;
}
