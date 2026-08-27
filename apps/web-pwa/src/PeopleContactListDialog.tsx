import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  peopleContactListApi,
  PeopleContactListApiError,
  type ContactListField,
  type ContactListStatus,
  type PeopleContactListDto,
} from './lib/peopleContactListApi';
import { exportPeopleContactListCsv, peopleContactListExportFilename } from './lib/peopleContactListExport';
import type { Locale } from './lib/preferences';

const ALL_FIELDS: readonly ContactListField[] = ['phone', 'email', 'address', 'preferredLocale', 'groups', 'state'];
const DEFAULT_FIELDS: readonly ContactListField[] = ['phone', 'email'];
type LoadState = 'idle' | 'loading' | 'ready' | 'error' | 'unauthenticated' | 'forbidden';

const copy = {
  'pt-PT': {
    title: 'Lista de contactos', privacy: 'Esta vista pode mostrar contactos de várias pessoas. O acesso exige permissão adicional de relatórios e os dados não são guardados no browser.', fields: 'Campos', status: 'Estado', group: 'Grupo', allGroups: 'Todos os grupos', all: 'Todos', active: 'Ativos', inactive: 'Inativos', search: 'Pesquisar nome', loading: 'A carregar lista de contactos…', retry: 'Tentar novamente', error: 'Não foi possível carregar a lista de contactos.', unauthenticated: 'A sessão terminou antes de carregar os contactos.', forbidden: 'Não tem permissão para consultar a lista de contactos.', empty: 'Nenhum contacto corresponde aos filtros atuais.', export: 'Exportar CSV', close: 'Fechar', phone: 'Telefone', email: 'Email', address: 'Morada', preferredLocale: 'Idioma preferido', groups: 'Grupos', state: 'Estado', activeValue: 'Ativo', inactiveValue: 'Inativo', generated: 'Atualizado', people: 'Pessoas' },
  en: {
    title: 'Contact list', privacy: 'This view may show contact details for several people. Access requires the additional reports permission and data are not stored in the browser.', fields: 'Fields', status: 'Status', group: 'Group', allGroups: 'All groups', all: 'All', active: 'Active', inactive: 'Inactive', search: 'Search name', loading: 'Loading contact list…', retry: 'Try again', error: 'The contact list could not be loaded.', unauthenticated: 'Your session ended before contacts were loaded.', forbidden: 'You do not have permission to view the contact list.', empty: 'No contacts match the current filters.', export: 'Export CSV', close: 'Close', phone: 'Phone', email: 'Email', address: 'Address', preferredLocale: 'Preferred language', groups: 'Groups', state: 'Status', activeValue: 'Active', inactiveValue: 'Inactive', generated: 'Updated', people: 'People' },
  es: {
    title: 'Lista de contactos', privacy: 'Esta vista puede mostrar contactos de varias personas. El acceso requiere el permiso adicional de informes y los datos no se guardan en el navegador.', fields: 'Campos', status: 'Estado', group: 'Grupo', allGroups: 'Todos los grupos', all: 'Todos', active: 'Activos', inactive: 'Inactivos', search: 'Buscar nombre', loading: 'Cargando lista de contactos…', retry: 'Intentar de nuevo', error: 'No se pudo cargar la lista de contactos.', unauthenticated: 'La sesión terminó antes de cargar los contactos.', forbidden: 'No tiene permiso para consultar la lista de contactos.', empty: 'Ningún contacto coincide con los filtros actuales.', export: 'Exportar CSV', close: 'Cerrar', phone: 'Teléfono', email: 'Email', address: 'Dirección', preferredLocale: 'Idioma preferido', groups: 'Grupos', state: 'Estado', activeValue: 'Activo', inactiveValue: 'Inactivo', generated: 'Actualizado', people: 'Personas' },
} as const;

export function PeopleContactListDialog({ locale, open, onClose }: { locale: Locale; open: boolean; onClose: () => void }) {
  const text = copy[locale];
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);
  const [fields, setFields] = useState<readonly ContactListField[]>(DEFAULT_FIELDS);
  const [status, setStatus] = useState<ContactListStatus>('all');
  const [groupId, setGroupId] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<LoadState>('idle');
  const [data, setData] = useState<PeopleContactListDto | null>(null);

  const cancel = () => {
    requestVersionRef.current += 1;
    requestControllerRef.current?.abort();
    requestControllerRef.current = null;
  };

  const load = async (nextFields = fields, nextStatus = status, nextGroupId = groupId) => {
    if (!nextFields.length) return;
    const version = ++requestVersionRef.current;
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;
    setState('loading');
    setData(null);
    try {
      const value = await peopleContactListApi.get({ fields: nextFields, status: nextStatus, ...(nextGroupId ? { groupId: nextGroupId } : {}) }, controller.signal);
      if (controller.signal.aborted || version !== requestVersionRef.current) return;
      setData(value);
      setState('ready');
    } catch (reason) {
      if (controller.signal.aborted || version !== requestVersionRef.current) return;
      if (reason instanceof PeopleContactListApiError && reason.status === 401) setState('unauthenticated');
      else if (reason instanceof PeopleContactListApiError && reason.status === 403) setState('forbidden');
      else setState('error');
    } finally {
      if (version === requestVersionRef.current) requestControllerRef.current = null;
    }
  };

  useEffect(() => {
    if (!open) { cancel(); return; }
    setFields(DEFAULT_FIELDS);
    setStatus('all');
    setGroupId(undefined);
    setSearch('');
    void load(DEFAULT_FIELDS, 'all', undefined);
    return cancel;
  }, [open]);

  const visiblePeople = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase(locale);
    if (!data || !normalized) return data?.people ?? [];
    return data.people.filter(person => person.displayName.toLocaleLowerCase(locale).includes(normalized));
  }, [data, locale, search]);

  const changeFields = (value: ContactListField[]) => {
    const next = value.length ? value : DEFAULT_FIELDS;
    setFields(next);
    void load(next, status, groupId);
  };
  const changeStatus = (value: ContactListStatus) => {
    setStatus(value);
    void load(fields, value, groupId);
  };
  const changeGroup = (value?: string) => {
    setGroupId(value);
    void load(fields, status, value);
  };

  const download = () => {
    if (!data || !visiblePeople.length) return;
    const csv = exportPeopleContactListCsv(visiblePeople, data.fields, locale);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = peopleContactListExportFilename();
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const fieldOptions = ALL_FIELDS.map(field => ({ value: field, label: text[field] }));
  const statusOptions = [
    { value: 'all', label: text.all },
    { value: 'active', label: text.active },
    { value: 'inactive', label: text.inactive },
  ];
  const groupOptions = [{ value: '', label: text.allGroups }, ...(data?.groups ?? []).map(group => ({ value: group.id, label: group.name }))];

  return <Modal open={open} onCancel={onClose} width={920} title={text.title} footer={<Space><Button onClick={onClose}>{text.close}</Button><Button type="primary" onClick={download} disabled={state !== 'ready' || !visiblePeople.length}>{text.export}</Button></Space>} destroyOnHidden>
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="warning" showIcon title={text.privacy} />
      <Space wrap style={{ width: '100%' }}>
        <Select aria-label={text.fields} mode="multiple" value={[...fields]} options={fieldOptions} onChange={changeFields} disabled={state === 'loading'} style={{ minWidth: 280 }} />
        <Select aria-label={text.status} value={status} options={statusOptions} onChange={changeStatus} disabled={state === 'loading'} style={{ minWidth: 150 }} />
        <Select aria-label={text.group} value={groupId ?? ''} options={groupOptions} onChange={value => changeGroup(value || undefined)} disabled={state === 'loading'} style={{ minWidth: 180 }} />
        <Input aria-label={text.search} placeholder={text.search} value={search} onChange={event => setSearch(event.target.value)} allowClear style={{ minWidth: 220, flex: '1 1 220px' }} />
      </Space>
      {state === 'loading' ? <div role="status" aria-label={text.loading}><Skeleton active paragraph={{ rows: 5 }} /></div> : null}
      {state === 'unauthenticated' ? <Alert type="error" showIcon title={text.unauthenticated} /> : null}
      {state === 'forbidden' ? <Alert type="warning" showIcon title={text.forbidden} /> : null}
      {state === 'error' ? <Alert type="error" showIcon title={text.error} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {state === 'ready' && data ? <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label={text.people}>{visiblePeople.length}</Descriptions.Item>
          <Descriptions.Item label={text.generated}>{new Date(data.generatedAt).toLocaleString(locale)}</Descriptions.Item>
        </Descriptions>
        {!visiblePeople.length ? <Empty description={text.empty} /> : <List
          dataSource={[...visiblePeople]}
          renderItem={person => <List.Item key={person.personId}>
            <Card size="small" style={{ width: '100%' }}>
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <Typography.Text strong>{person.displayName}</Typography.Text>
                <Space wrap>
                  {data.fields.includes('phone') && person.phone ? <Tag>{text.phone}: {person.phone}</Tag> : null}
                  {data.fields.includes('email') && person.email ? <Tag>{text.email}: {person.email}</Tag> : null}
                  {data.fields.includes('address') && person.address ? <Tag>{text.address}: {person.address}</Tag> : null}
                  {data.fields.includes('preferredLocale') && person.preferredLocale ? <Tag>{text.preferredLocale}: {person.preferredLocale}</Tag> : null}
                  {data.fields.includes('groups') ? (person.groups ?? []).map(group => <Tag key={group.id}>{group.name}</Tag>) : null}
                  {data.fields.includes('state') && person.active !== undefined ? <Tag>{person.active ? text.activeValue : text.inactiveValue}</Tag> : null}
                </Space>
              </Space>
            </Card>
          </List.Item>}
        />}
      </Space> : null}
    </Space>
  </Modal>;
}
