import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import EditOutlined from '@ant-design/icons/es/icons/EditOutlined';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import List from 'antd/es/list';
import Modal from 'antd/es/modal';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tabs from 'antd/es/tabs';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import { auditHistoryApi, type AuditHistoryDto } from './lib/auditHistoryApi';
import { availabilityApi, type AvailabilityPeriodDto } from './lib/availabilityApi';
import { eligibilityApi, type EligibilityDecisionDto } from './lib/eligibilityApi';
import { midweekApi, type MidweekOverviewDto } from './lib/midweekApi';
import { peopleApi, type PersonContactDetailsDto, type PersonProfileDto } from './lib/peopleApi';
import type { PeopleDirectoryDto, PeopleDirectoryPersonDto } from './lib/peopleDirectoryApi';
import type { Locale } from './lib/preferences';
import { responsibilitiesApi, type ResponsibilityDto } from './lib/responsibilitiesApi';

const { Paragraph, Text, Title } = Typography;
type Resource<T> = Readonly<{ status: 'ready'; value: T }> | Readonly<{ status: 'unavailable' }>;
interface ProfileData {
  detail: Resource<PersonProfileDto>;
  availability: Resource<readonly AvailabilityPeriodDto[]>;
  eligibility: Resource<readonly EligibilityDecisionDto[]>;
  responsibilities: Resource<readonly ResponsibilityDto[]>;
  schedule: Resource<MidweekOverviewDto>;
  audit: Resource<readonly AuditHistoryDto[]>;
}

const copy = {
  'pt-PT': {
    summary: 'Resumo', contacts: 'Contactos', participation: 'Participação / Elegibilidade', availability: 'Disponibilidade', assignments: 'Designações', organization: 'Organização', history: 'Histórico',
    loading: 'A carregar perfil…', partial: 'Algumas secções não estão disponíveis com as permissões atuais. Nada foi inferido para preencher dados em falta.', retry: 'Tentar novamente',
    status: 'Estado', active: 'Ativo', inactive: 'Inativo', groups: 'Grupos', noGroups: 'Sem grupo', language: 'Idioma preferido', notSet: 'Não definido',
    currentAvailability: 'Disponibilidade atual', availableNow: 'Disponível', unavailableNow: 'Indisponível', nextAway: 'Próxima indisponibilidade', noNextAway: 'Nenhuma registada',
    lastAssignment: 'Última designação concluída', noAssignment: 'Nenhuma concluída registada', responsibilities: 'Responsabilidades', noResponsibilities: 'Sem responsabilidade ativa',
    phone: 'Telefone', email: 'Email', address: 'Morada', editContacts: 'Editar contactos', save: 'Guardar', cancel: 'Cancelar', saving: 'A guardar…', contactError: 'Não foi possível guardar os contactos.', contactSaved: 'Contactos atualizados.',
    line1: 'Morada — linha 1', line2: 'Morada — linha 2', postalCode: 'Código postal', locality: 'Localidade', countryCode: 'País (código de 2 letras)',
    eligibilityEmpty: 'Não existem decisões de elegibilidade registadas.', enabled: 'Elegível', disabled: 'Não elegível', decidedAt: 'Decidido em',
    availabilityEmpty: 'Não existem períodos de indisponibilidade registados.', from: 'De', to: 'Até', reason: 'Motivo',
    assignmentsEmpty: 'Não existem designações registadas para esta pessoa.', meeting: 'Reunião', role: 'Parte / função', state: 'Estado',
    organizationEmpty: 'Sem dados de organização disponíveis.', auditEmpty: 'Não existem entradas de histórico disponíveis para este perfil.', changed: 'Campos alterados',
    close: 'Fechar', unavailable: 'Não disponível', profile: 'Perfil de pessoa',
  },
  en: {
    summary: 'Summary', contacts: 'Contacts', participation: 'Participation / Eligibility', availability: 'Availability', assignments: 'Assignments', organization: 'Organization', history: 'History',
    loading: 'Loading profile…', partial: 'Some sections are unavailable with the current permissions. Nothing was inferred to fill missing data.', retry: 'Try again',
    status: 'Status', active: 'Active', inactive: 'Inactive', groups: 'Groups', noGroups: 'No group', language: 'Preferred language', notSet: 'Not set',
    currentAvailability: 'Current availability', availableNow: 'Available', unavailableNow: 'Unavailable', nextAway: 'Next unavailability', noNextAway: 'None recorded',
    lastAssignment: 'Last completed assignment', noAssignment: 'No completed assignment recorded', responsibilities: 'Responsibilities', noResponsibilities: 'No active responsibility',
    phone: 'Phone', email: 'Email', address: 'Address', editContacts: 'Edit contacts', save: 'Save', cancel: 'Cancel', saving: 'Saving…', contactError: 'Contacts could not be saved.', contactSaved: 'Contacts updated.',
    line1: 'Address line 1', line2: 'Address line 2', postalCode: 'Postal code', locality: 'Locality', countryCode: 'Country (2-letter code)',
    eligibilityEmpty: 'No eligibility decisions are recorded.', enabled: 'Eligible', disabled: 'Not eligible', decidedAt: 'Decided at',
    availabilityEmpty: 'No unavailability periods are recorded.', from: 'From', to: 'To', reason: 'Reason',
    assignmentsEmpty: 'No assignments are recorded for this person.', meeting: 'Meeting', role: 'Part / role', state: 'State',
    organizationEmpty: 'No organization data is available.', auditEmpty: 'No history entries are available for this profile.', changed: 'Changed fields',
    close: 'Close', unavailable: 'Unavailable', profile: 'Person profile',
  },
  es: {
    summary: 'Resumen', contacts: 'Contactos', participation: 'Participación / Elegibilidad', availability: 'Disponibilidad', assignments: 'Asignaciones', organization: 'Organización', history: 'Historial',
    loading: 'Cargando perfil…', partial: 'Algunas secciones no están disponibles con los permisos actuales. No se ha inferido nada para rellenar datos faltantes.', retry: 'Intentar de nuevo',
    status: 'Estado', active: 'Activo', inactive: 'Inactivo', groups: 'Grupos', noGroups: 'Sin grupo', language: 'Idioma preferido', notSet: 'No definido',
    currentAvailability: 'Disponibilidad actual', availableNow: 'Disponible', unavailableNow: 'No disponible', nextAway: 'Próxima indisponibilidad', noNextAway: 'Ninguna registrada',
    lastAssignment: 'Última asignación completada', noAssignment: 'Sin asignación completada registrada', responsibilities: 'Responsabilidades', noResponsibilities: 'Sin responsabilidad activa',
    phone: 'Teléfono', email: 'Email', address: 'Dirección', editContacts: 'Editar contactos', save: 'Guardar', cancel: 'Cancelar', saving: 'Guardando…', contactError: 'No se pudieron guardar los contactos.', contactSaved: 'Contactos actualizados.',
    line1: 'Dirección — línea 1', line2: 'Dirección — línea 2', postalCode: 'Código postal', locality: 'Localidad', countryCode: 'País (código de 2 letras)',
    eligibilityEmpty: 'No hay decisiones de elegibilidad registradas.', enabled: 'Elegible', disabled: 'No elegible', decidedAt: 'Decidido el',
    availabilityEmpty: 'No hay periodos de indisponibilidad registrados.', from: 'Desde', to: 'Hasta', reason: 'Motivo',
    assignmentsEmpty: 'No hay asignaciones registradas para esta persona.', meeting: 'Reunión', role: 'Parte / función', state: 'Estado',
    organizationEmpty: 'No hay datos de organización disponibles.', auditEmpty: 'No hay entradas de historial disponibles para este perfil.', changed: 'Campos modificados',
    close: 'Cerrar', unavailable: 'No disponible', profile: 'Perfil de persona',
  },
} as const;

function ready<T>(value: T): Resource<T> { return Object.freeze({ status: 'ready', value }); }
function unavailable<T>(): Resource<T> { return Object.freeze({ status: 'unavailable' }); }
function civil(value: string, locale: Locale): string { const normalized = locale === 'en' ? 'en-GB' : locale; const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(normalized, { dateStyle: 'medium', timeZone: 'UTC' }).format(date) : value; }
function instant(value: string, locale: Locale): string { const normalized = locale === 'en' ? 'en-GB' : locale; const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(normalized, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : value; }
function addressText(contact: PersonContactDetailsDto | undefined): string | undefined { const a = contact?.address; if (!a) return undefined; return [a.line1, a.line2, [a.postalCode, a.locality].filter(Boolean).join(' '), a.countryCode].filter(Boolean).join(', ') || undefined; }
function activeResponsibilities(items: readonly ResponsibilityDto[], personId: string): readonly ResponsibilityDto[] { const now = Date.now(); return items.filter(item => item.personId === personId && Date.parse(item.startsAt) <= now && (!item.endsAt || now < Date.parse(item.endsAt))); }
function latestEligibility(items: readonly EligibilityDecisionDto[]): readonly EligibilityDecisionDto[] { const map = new Map<string, EligibilityDecisionDto>(); for (const item of items) { const current = map.get(item.assignmentTypeId); if (!current || Date.parse(current.decidedAt) <= Date.parse(item.decidedAt)) map.set(item.assignmentTypeId, item); } return [...map.values()].sort((a, b) => a.assignmentTypeId.localeCompare(b.assignmentTypeId)); }

export function personAssignments(overview: MidweekOverviewDto, personId: string) {
  const meetings = new Map(overview.meetings.map(meeting => [meeting.id, meeting]));
  const rows: Array<{ id: string; date: string; title: string; state: string }> = [];
  for (const assignment of overview.studentAssignments) {
    if (assignment.studentId !== personId && assignment.assistantId !== personId) continue;
    const meeting = meetings.get(assignment.meetingId); if (!meeting) continue;
    const slot = meeting.slots.find(item => item.id === assignment.slotId);
    rows.push({ id: assignment.id, date: meeting.date, title: `${slot?.titleKey ?? assignment.slotId}${assignment.assistantId === personId ? ' · assistant' : ''}`, state: assignment.state });
  }
  for (const assignment of overview.nonStudentAssignments) {
    if (assignment.personId !== personId) continue;
    const meeting = meetings.get(assignment.meetingId); if (!meeting) continue;
    const slot = meeting.slots.find(item => item.id === assignment.slotId);
    rows.push({ id: assignment.id, date: meeting.date, title: `${slot?.titleKey ?? assignment.slotId} · ${assignment.role}`, state: assignment.state });
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

export function PersonProfileDrawer({ person, directory, locale, open, onClose, onChanged }: { person: PeopleDirectoryPersonDto; directory: PeopleDirectoryDto; locale: Locale; open: boolean; onClose(): void; onChanged(): void }) {
  const text = copy[locale];
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactError, setContactError] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [phone, setPhone] = useState(''); const [email, setEmail] = useState(''); const [line1, setLine1] = useState(''); const [line2, setLine2] = useState(''); const [postalCode, setPostalCode] = useState(''); const [locality, setLocality] = useState(''); const [countryCode, setCountryCode] = useState('');
  const requestRef = useRef(0);

  const load = async () => {
    const request = ++requestRef.current; setLoading(true); setContactSaved(false);
    const controller = new AbortController();
    const detailPromise = peopleApi.get(person.id, controller.signal).then(ready).catch(() => unavailable<PersonProfileDto>());
    const availabilityPromise = directory.capabilities.availability ? availabilityApi.list(person.id, controller.signal).then(ready).catch(() => unavailable<readonly AvailabilityPeriodDto[]>()) : Promise.resolve(unavailable<readonly AvailabilityPeriodDto[]>());
    const eligibilityPromise = directory.capabilities.eligibility ? eligibilityApi.list(person.id, controller.signal).then(ready).catch(() => unavailable<readonly EligibilityDecisionDto[]>()) : Promise.resolve(unavailable<readonly EligibilityDecisionDto[]>());
    const responsibilitiesPromise = directory.capabilities.responsibilities ? responsibilitiesApi.list(controller.signal).then(ready).catch(() => unavailable<readonly ResponsibilityDto[]>()) : Promise.resolve(unavailable<readonly ResponsibilityDto[]>());
    const schedulePromise = directory.capabilities.schedule ? midweekApi.overview(controller.signal).then(ready).catch(() => unavailable<MidweekOverviewDto>()) : Promise.resolve(unavailable<MidweekOverviewDto>());
    const auditPromise = auditHistoryApi.list({ resourceType: 'person', resourceId: person.id, limit: 50 }, controller.signal).then(ready).catch(() => unavailable<readonly AuditHistoryDto[]>());
    const [detail, availability, eligibility, responsibilities, schedule, audit] = await Promise.all([detailPromise, availabilityPromise, eligibilityPromise, responsibilitiesPromise, schedulePromise, auditPromise]);
    if (request !== requestRef.current) return;
    setData(Object.freeze({ detail, availability, eligibility, responsibilities, schedule, audit })); setLoading(false);
  };

  useEffect(() => { if (open) void load(); return () => { requestRef.current += 1; }; }, [open, person.id]);

  const detail = data?.detail.status === 'ready' ? data.detail.value : undefined;
  const responsibilities = data?.responsibilities.status === 'ready' ? activeResponsibilities(data.responsibilities.value, person.id) : undefined;
  const eligibility = data?.eligibility.status === 'ready' ? latestEligibility(data.eligibility.value) : undefined;
  const assignments = useMemo(() => data?.schedule.status === 'ready' ? personAssignments(data.schedule.value, person.id) : undefined, [data, person.id]);
  const partial = data ? Object.values(data).some(value => value.status === 'unavailable') : false;

  const openContactEdit = () => {
    const contact = detail?.contact; const a = contact?.address;
    setPhone(contact?.phone ?? ''); setEmail(contact?.email ?? ''); setLine1(a?.line1 ?? ''); setLine2(a?.line2 ?? ''); setPostalCode(a?.postalCode ?? ''); setLocality(a?.locality ?? ''); setCountryCode(a?.countryCode ?? ''); setContactError(false); setEditOpen(true);
  };
  const submitContacts = async (event: FormEvent) => {
    event.preventDefault(); if (saving) return; setSaving(true); setContactError(false);
    try {
      await peopleApi.update(person.id, { contact: { phone, email, address: { line1, line2, postalCode, locality, countryCode } } });
      setEditOpen(false); setContactSaved(true); await load(); onChanged();
    } catch { setContactError(true); } finally { setSaving(false); }
  };

  const summary = <Space direction="vertical" size="large" style={{ width: '100%' }}>
    <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small" items={[
      { key: 'status', label: text.status, children: <Tag color={person.active ? 'success' : 'default'}>{person.active ? text.active : text.inactive}</Tag> },
      { key: 'language', label: text.language, children: detail?.preferredLocale ?? person.preferredLocale ?? text.notSet },
      { key: 'groups', label: text.groups, children: person.groups.length ? <Space wrap>{person.groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : text.noGroups },
      { key: 'availability', label: text.currentAvailability, children: person.availability.status === 'ready' ? <Tag color={person.availability.current === 'available' ? 'success' : 'warning'}>{person.availability.current === 'available' ? text.availableNow : text.unavailableNow}</Tag> : text.unavailable },
      { key: 'next', label: text.nextAway, children: person.availability.status === 'ready' && person.availability.nextPeriod ? civil(person.availability.nextPeriod.startsAt, locale) : person.availability.status === 'ready' ? text.noNextAway : text.unavailable },
      { key: 'last', label: text.lastAssignment, children: person.assignmentHistory.status === 'ready' ? (person.assignmentHistory.lastCompletedMeetingDate ? civil(person.assignmentHistory.lastCompletedMeetingDate, locale) : text.noAssignment) : text.unavailable },
      { key: 'responsibilities', label: text.responsibilities, span: 2, children: responsibilities ? (responsibilities.length ? <Space wrap>{responsibilities.map(item => <Tag key={item.id}>{item.responsibilityKey}</Tag>)}</Space> : text.noResponsibilities) : text.unavailable },
    ]} />
  </Space>;

  const contacts = <Space direction="vertical" size="middle" style={{ width: '100%' }}>
    {contactSaved ? <Alert type="success" showIcon message={text.contactSaved} /> : null}
    {data?.detail.status === 'unavailable' ? <Alert type="info" showIcon message={text.unavailable} /> : <Descriptions column={1} bordered size="small" items={[
      { key: 'phone', label: text.phone, children: detail?.contact?.phone ?? text.notSet },
      { key: 'email', label: text.email, children: detail?.contact?.email ?? text.notSet },
      { key: 'address', label: text.address, children: addressText(detail?.contact) ?? text.notSet },
    ]} />}
    {directory.capabilities.writePeople && data?.detail.status === 'ready' ? <Button icon={<EditOutlined />} onClick={openContactEdit}>{text.editContacts}</Button> : null}
  </Space>;

  const participation = eligibility === undefined ? <Alert type="info" showIcon message={text.unavailable} /> : eligibility.length === 0 ? <Empty description={text.eligibilityEmpty} /> : <List dataSource={[...eligibility]} renderItem={item => <List.Item><List.Item.Meta title={assignmentTypeLabel(item.assignmentTypeId, locale)} description={`${text.decidedAt}: ${instant(item.decidedAt, locale)}`} /><Tag color={item.enabled ? 'success' : 'default'}>{item.enabled ? text.enabled : text.disabled}</Tag></List.Item>} />;
  const availabilityTab = data?.availability.status !== 'ready' ? <Alert type="info" showIcon message={text.unavailable} /> : data.availability.value.length === 0 ? <Empty description={text.availabilityEmpty} /> : <List dataSource={[...data.availability.value].sort((a,b)=>b.startsAt.localeCompare(a.startsAt))} renderItem={item => <List.Item><Space direction="vertical" size={2}><Text strong>{civil(item.startsAt, locale)} → {civil(item.endsAt, locale)}</Text><Text type="secondary">{text.reason}: {item.reasonCode ?? '—'}</Text></Space></List.Item>} />;
  const assignmentsTab = assignments === undefined ? <Alert type="info" showIcon message={text.unavailable} /> : assignments.length === 0 ? <Empty description={text.assignmentsEmpty} /> : <List dataSource={[...assignments]} renderItem={item => <List.Item><List.Item.Meta title={item.title} description={`${text.meeting}: ${civil(item.date, locale)}`} /><Tag>{item.state}</Tag></List.Item>} />;
  const organization = <Space direction="vertical" size="middle" style={{ width: '100%' }}><Descriptions column={1} bordered size="small" items={[
    { key: 'groups', label: text.groups, children: person.groups.length ? <Space wrap>{person.groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : text.noGroups },
    { key: 'responsibilities', label: text.responsibilities, children: responsibilities ? (responsibilities.length ? <Space wrap>{responsibilities.map(item => <Tag key={item.id}>{item.responsibilityKey}</Tag>)}</Space> : text.noResponsibilities) : text.unavailable },
  ]} /></Space>;
  const history = data?.audit.status !== 'ready' ? <Alert type="info" showIcon message={text.unavailable} /> : data.audit.value.length === 0 ? <Empty description={text.auditEmpty} /> : <List dataSource={[...data.audit.value]} renderItem={item => <List.Item><List.Item.Meta title={`${item.action} · ${instant(item.occurredAt, locale)}`} description={`${text.changed}: ${item.changedFields.join(', ') || '—'}`} /></List.Item>} />;

  return <>
    <Drawer open={open} onClose={onClose} width="min(960px, 100vw)" title={<div><Text type="secondary">{text.profile}</Text><Title level={3} style={{ margin: '2px 0 0' }}>{person.displayName}</Title></div>} extra={<Button onClick={onClose}>{text.close}</Button>}>
      {loading && !data ? <Skeleton active paragraph={{ rows: 8 }} /> : <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {partial ? <Alert type="info" showIcon message={text.partial} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
        <Tabs destroyOnHidden items={[
          { key: 'summary', label: text.summary, children: summary },
          { key: 'contacts', label: text.contacts, children: contacts },
          { key: 'participation', label: text.participation, children: participation },
          { key: 'availability', label: text.availability, children: availabilityTab },
          { key: 'assignments', label: text.assignments, children: assignmentsTab },
          { key: 'organization', label: text.organization, children: organization },
          { key: 'history', label: text.history, children: history },
        ]} />
      </Space>}
    </Drawer>

    <Modal open={editOpen} title={text.editContacts} onCancel={() => !saving && setEditOpen(false)} footer={null} destroyOnHidden>
      <form onSubmit={submitContacts}><Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <label><Text strong>{text.phone}</Text><Input value={phone} maxLength={40} onChange={event => setPhone(event.target.value)} /></label>
        <label><Text strong>{text.email}</Text><Input type="email" value={email} maxLength={254} onChange={event => setEmail(event.target.value)} /></label>
        <label><Text strong>{text.line1}</Text><Input value={line1} maxLength={160} onChange={event => setLine1(event.target.value)} /></label>
        <label><Text strong>{text.line2}</Text><Input value={line2} maxLength={160} onChange={event => setLine2(event.target.value)} /></label>
        <Space align="start" wrap><label><Text strong>{text.postalCode}</Text><Input value={postalCode} maxLength={24} onChange={event => setPostalCode(event.target.value)} /></label><label><Text strong>{text.locality}</Text><Input value={locality} maxLength={100} onChange={event => setLocality(event.target.value)} /></label><label><Text strong>{text.countryCode}</Text><Input value={countryCode} maxLength={2} onChange={event => setCountryCode(event.target.value)} /></label></Space>
        {contactError ? <Alert type="error" showIcon message={text.contactError} /> : null}
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}><Button disabled={saving} onClick={() => setEditOpen(false)}>{text.cancel}</Button><Button htmlType="submit" type="primary" loading={saving}>{saving ? text.saving : text.save}</Button></Space>
      </Space></form>
    </Modal>
  </>;
}
