import ArrowLeftOutlined from '@ant-design/icons/es/icons/ArrowLeftOutlined';
import CalendarOutlined from '@ant-design/icons/es/icons/CalendarOutlined';
import ClockCircleOutlined from '@ant-design/icons/es/icons/ClockCircleOutlined';
import LockOutlined from '@ant-design/icons/es/icons/LockOutlined';
import ReloadOutlined from '@ant-design/icons/es/icons/ReloadOutlined';
import Alert from 'antd/es/alert';
import Avatar from 'antd/es/avatar';
import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Empty from 'antd/es/empty';
import List from 'antd/es/list';
import Result from 'antd/es/result';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tabs from 'antd/es/tabs';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { assignmentTypeLabel } from './lib/assignmentTypeCatalog';
import type { Locale } from './lib/preferences';
import {
  assignmentEvidenceForPerson,
  assignmentIsUpcoming,
  compareAssignmentsByInstant,
  currentAvailability,
  isActiveResponsibility,
  isCurrentProfileRequest,
  nextAvailability,
  personProfileDataApi,
  sectionIsPartial,
  sectionMessage,
  type PersonAssignmentEvidence,
  type PersonProfileData,
  type PersonProfileSection,
  PersonProfileLoadError,
} from './lib/personProfileData';

const { Text, Title } = Typography;

type ProfileState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; data: PersonProfileData }>
  | Readonly<{ status: 'error'; error: PersonProfileLoadError }>;

export interface PersonProfileProps {
  readonly personId: string;
  readonly locale: Locale;
  readonly onBack?: () => void;
}

const copy = {
  'pt-PT': {
    back: 'Voltar', eyebrow: 'Pessoas', profile: 'Perfil da pessoa', active: 'Ativo', inactive: 'Inativo',
    loading: 'A carregar o perfil autorizado…', retry: 'Tentar novamente', partial: 'Algumas secções não estão disponíveis com as permissões atuais. O perfil mostra apenas dados confirmados.',
    unauthTitle: 'É necessário iniciar sessão', unauthDescription: 'A sua sessão não permite carregar este perfil.', forbiddenTitle: 'Sem acesso a este perfil', forbiddenDescription: 'Não tem a permissão necessária para consultar este perfil.',
    missingTitle: 'Pessoa não encontrada', missingDescription: 'Esta pessoa já não está disponível neste contexto.', errorTitle: 'Não foi possível carregar o perfil', errorDescription: 'Tente novamente. Nenhum dado estimado foi apresentado.',
    summary: 'Resumo', contacts: 'Contactos', participation: 'Participação e elegibilidade', availability: 'Disponibilidade', assignments: 'Designações', organization: 'Organização', history: 'Histórico',
    status: 'Estado', groups: 'Grupos de serviço', household: 'Agregado', availabilityNow: 'Disponibilidade atual', nextAbsence: 'Próxima ausência', lastAssignment: 'Última designação concluída', nextAssignment: 'Próxima designação', responsibilities: 'Responsabilidades',
    available: 'Disponível', unavailable: 'Indisponível', noGroups: 'Sem grupo registado', noHousehold: 'Sem agregado registado', none: 'Não disponível', noResponsibilities: 'Sem responsabilidade ativa registada',
    noCompleted: 'Sem designação concluída registada', noUpcoming: 'Sem próxima designação registada', noPeriods: 'Sem períodos de ausência registados', noEligibility: 'Sem decisões de elegibilidade registadas',
    emergency: 'Contactos de emergência autorizados', ordinaryContacts: 'Contactos de perfil', ordinaryBlocked: 'Telefone, e-mail e morada não são disponibilizados pelo contrato atual de perfil. Não são estimados nem inferidos.',
    noContacts: 'Não existem contactos de emergência autorizados para mostrar.', relation: 'Relação', phone: 'Telefone', enabled: 'Elegível', disabled: 'Não elegível', decided: 'Decisão registada',
    current: 'Atual', upcoming: 'Futuros', past: 'Passados', away: 'Ausência', unavailableReason: 'Indisponível', other: 'Outro',
    assigned: 'Designada', completed: 'Concluída', cancelled: 'Cancelada', student: 'Estudante', assistant: 'Ajudante',
    noAssignments: 'Não existem designações autorizadas para mostrar.', noOrganization: 'Não existe contexto organizacional autorizado para mostrar.',
    historyBlocked: 'O histórico de atividade requer uma permissão adicional. Nenhum evento é mostrado.', historyEmpty: 'Não existem eventos de atividade autorizados para mostrar.',
    created: 'Perfil criado', updated: 'Perfil atualizado', deleted: 'Perfil removido', activity: 'Atividade registada',
    unavailableSection: 'Esta secção não está disponível neste momento.', unauthenticatedSection: 'É necessário iniciar sessão para consultar esta secção.', forbiddenSection: 'Não tem permissão para consultar esta secção.',
    timezone: 'Fuso horário', date: 'Data', profileIncomplete: 'Dados parciais', operationalContext: 'Contexto operacional', noCandidateInsight: 'As recomendações de candidatos serão mostradas quando a integração PX7 estiver disponível neste perfil.',
  },
  en: {
    back: 'Back', eyebrow: 'People', profile: 'Person profile', active: 'Active', inactive: 'Inactive',
    loading: 'Loading the authorized profile…', retry: 'Try again', partial: 'Some sections are unavailable with the current permissions. The profile shows confirmed data only.',
    unauthTitle: 'Sign-in is required', unauthDescription: 'Your session cannot load this profile.', forbiddenTitle: 'No access to this profile', forbiddenDescription: 'You do not have permission to view this profile.',
    missingTitle: 'Person not found', missingDescription: 'This person is no longer available in this context.', errorTitle: 'The profile could not be loaded', errorDescription: 'Try again. No estimated data was displayed.',
    summary: 'Summary', contacts: 'Contacts', participation: 'Participation and eligibility', availability: 'Availability', assignments: 'Assignments', organization: 'Organization', history: 'History',
    status: 'Status', groups: 'Service groups', household: 'Household', availabilityNow: 'Current availability', nextAbsence: 'Next absence', lastAssignment: 'Last completed assignment', nextAssignment: 'Next assignment', responsibilities: 'Responsibilities',
    available: 'Available', unavailable: 'Unavailable', noGroups: 'No recorded group', noHousehold: 'No recorded household', none: 'Unavailable', noResponsibilities: 'No active responsibility recorded',
    noCompleted: 'No completed assignment recorded', noUpcoming: 'No upcoming assignment recorded', noPeriods: 'No away periods recorded', noEligibility: 'No eligibility decisions recorded',
    emergency: 'Authorized emergency contacts', ordinaryContacts: 'Profile contacts', ordinaryBlocked: 'Phone, email and address are not supplied by the current profile contract. They are not estimated or inferred.',
    noContacts: 'There are no authorized emergency contacts to show.', relation: 'Relationship', phone: 'Phone', enabled: 'Eligible', disabled: 'Not eligible', decided: 'Recorded decision',
    current: 'Current', upcoming: 'Future', past: 'Past', away: 'Away', unavailableReason: 'Unavailable', other: 'Other',
    assigned: 'Assigned', completed: 'Completed', cancelled: 'Cancelled', student: 'Student', assistant: 'Assistant',
    noAssignments: 'There are no authorized assignments to show.', noOrganization: 'There is no authorized organization context to show.',
    historyBlocked: 'Activity history requires an additional permission. No events are shown.', historyEmpty: 'There are no authorized activity events to show.',
    created: 'Profile created', updated: 'Profile updated', deleted: 'Profile deleted', activity: 'Recorded activity',
    unavailableSection: 'This section is unavailable right now.', unauthenticatedSection: 'Sign-in is required to view this section.', forbiddenSection: 'You do not have permission to view this section.',
    timezone: 'Time zone', date: 'Date', profileIncomplete: 'Partial data', operationalContext: 'Operational context', noCandidateInsight: 'Candidate recommendations will appear when the PX7 integration is available in this profile.',
  },
  es: {
    back: 'Volver', eyebrow: 'Personas', profile: 'Perfil de la persona', active: 'Activo', inactive: 'Inactivo',
    loading: 'Cargando el perfil autorizado…', retry: 'Intentar de nuevo', partial: 'Algunas secciones no están disponibles con los permisos actuales. El perfil muestra solo datos confirmados.',
    unauthTitle: 'Es necesario iniciar sesión', unauthDescription: 'Su sesión no puede cargar este perfil.', forbiddenTitle: 'Sin acceso a este perfil', forbiddenDescription: 'No tiene permiso para consultar este perfil.',
    missingTitle: 'Persona no encontrada', missingDescription: 'Esta persona ya no está disponible en este contexto.', errorTitle: 'No se pudo cargar el perfil', errorDescription: 'Inténtelo de nuevo. No se mostraron datos estimados.',
    summary: 'Resumen', contacts: 'Contactos', participation: 'Participación y elegibilidad', availability: 'Disponibilidad', assignments: 'Asignaciones', organization: 'Organización', history: 'Historial',
    status: 'Estado', groups: 'Grupos de servicio', household: 'Grupo familiar', availabilityNow: 'Disponibilidad actual', nextAbsence: 'Próxima ausencia', lastAssignment: 'Última asignación completada', nextAssignment: 'Próxima asignación', responsibilities: 'Responsabilidades',
    available: 'Disponible', unavailable: 'No disponible', noGroups: 'Sin grupo registrado', noHousehold: 'Sin grupo familiar registrado', none: 'No disponible', noResponsibilities: 'Sin responsabilidad activa registrada',
    noCompleted: 'Sin asignación completada registrada', noUpcoming: 'Sin próxima asignación registrada', noPeriods: 'Sin períodos de ausencia registrados', noEligibility: 'Sin decisiones de elegibilidad registradas',
    emergency: 'Contactos de emergencia autorizados', ordinaryContacts: 'Contactos del perfil', ordinaryBlocked: 'Teléfono, correo electrónico y dirección no son suministrados por el contrato actual del perfil. No se estiman ni infieren.',
    noContacts: 'No hay contactos de emergencia autorizados para mostrar.', relation: 'Relación', phone: 'Teléfono', enabled: 'Elegible', disabled: 'No elegible', decided: 'Decisión registrada',
    current: 'Actual', upcoming: 'Futuros', past: 'Pasados', away: 'Ausencia', unavailableReason: 'No disponible', other: 'Otro',
    assigned: 'Asignada', completed: 'Completada', cancelled: 'Cancelada', student: 'Estudiante', assistant: 'Ayudante',
    noAssignments: 'No hay asignaciones autorizadas para mostrar.', noOrganization: 'No hay contexto organizacional autorizado para mostrar.',
    historyBlocked: 'El historial de actividad requiere un permiso adicional. No se muestran eventos.', historyEmpty: 'No hay eventos de actividad autorizados para mostrar.',
    created: 'Perfil creado', updated: 'Perfil actualizado', deleted: 'Perfil eliminado', activity: 'Actividad registrada',
    unavailableSection: 'Esta sección no está disponible ahora.', unauthenticatedSection: 'Es necesario iniciar sesión para consultar esta sección.', forbiddenSection: 'No tiene permiso para consultar esta sección.',
    timezone: 'Zona horaria', date: 'Fecha', profileIncomplete: 'Datos parciales', operationalContext: 'Contexto operativo', noCandidateInsight: 'Las recomendaciones de candidatos aparecerán cuando la integración PX7 esté disponible en este perfil.',
  },
} as const;

type Copy = (typeof copy)[Locale];

function formatDate(value: string, locale: Locale, withTime = false): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatMeeting(assignment: PersonAssignmentEvidence, text: Copy): string {
  return `${assignment.date} · ${assignment.localTime} · ${assignment.timezone || text.timezone}`;
}

function reasonLabel(reason: string | undefined, text: Copy): string {
  if (reason === 'away') return text.away;
  if (reason === 'unavailable') return text.unavailableReason;
  return text.other;
}

function assignmentStateLabel(state: PersonAssignmentEvidence['state'], text: Copy): string {
  if (state === 'assigned') return text.assigned;
  if (state === 'completed') return text.completed;
  return text.cancelled;
}

function assignmentRoleLabel(role: string, text: Copy): string {
  if (role === 'student') return text.student;
  if (role === 'assistant') return text.assistant;
  return role.replace(/[-_]+/g, ' ');
}

function sectionState<T>(section: PersonProfileSection<T>, text: Copy) {
  if (section.status === 'ready') return null;
  const reason = sectionMessage(section);
  const message = reason === 'unauthenticated' ? text.unauthenticatedSection : reason === 'forbidden' ? text.forbiddenSection : text.unavailableSection;
  return <Alert type={reason === 'unavailable' ? 'warning' : 'info'} showIcon icon={reason === 'forbidden' ? <LockOutlined /> : undefined} message={message} />;
}

function assignmentCard(assignment: PersonAssignmentEvidence, text: Copy) {
  const color = assignment.state === 'completed' ? 'success' : assignment.state === 'cancelled' ? 'default' : 'processing';
  return <List.Item key={assignment.id}>
    <List.Item.Meta
      avatar={<Badge status={assignment.state === 'completed' ? 'success' : assignment.state === 'cancelled' ? 'default' : 'processing'} />}
      title={<Space wrap><Text strong>{formatMeeting(assignment, text)}</Text><Tag color={color}>{assignmentStateLabel(assignment.state, text)}</Tag></Space>}
      description={assignmentRoleLabel(assignment.role, text)}
    />
  </List.Item>;
}

function EmptySection({ description }: { description: string }) {
  return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />;
}

function ProfileHeader({ data, text, onBack }: { data: PersonProfileData; text: Copy; onBack?: () => void }) {
  return <Card>
    <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
      {onBack ? <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} style={{ alignSelf: 'flex-start' }}>{text.back}</Button> : null}
      <Space align="start" size="middle" wrap>
        <Avatar size={64}>{data.person.displayName.slice(0, 1).toLocaleUpperCase()}</Avatar>
        <div>
          <Text type="secondary" strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{text.eyebrow}</Text>
          <Title level={1} id="person-profile-title" style={{ margin: '4px 0 8px' }}>{data.person.displayName}</Title>
          <Tag color={data.person.active ? 'success' : 'default'}>{data.person.active ? text.active : text.inactive}</Tag>
        </div>
      </Space>
    </Space>
  </Card>;
}

function Summary({ data, locale, text, now }: { data: PersonProfileData; locale: Locale; text: Copy; now: Date }) {
  const groups = data.groups.status === 'ready' && data.groups.value ? data.groups.value.filter(group => group.memberIds.includes(data.person.id)) : undefined;
  const availability = data.availability.status === 'ready' && data.availability.value ? currentAvailability(data.availability.value, now) : undefined;
  const nextAway = data.availability.status === 'ready' && data.availability.value ? nextAvailability(data.availability.value, now) : undefined;
  const activeResponsibilities = data.responsibilities.status === 'ready' && data.responsibilities.value ? data.responsibilities.value.filter(value => value.personId === data.person.id && isActiveResponsibility(value, now)) : undefined;
  const assignments = data.assignments.status === 'ready' && data.assignments.value ? assignmentEvidenceForPerson(data.assignments.value, data.person.id) : undefined;
  const completed = assignments?.filter(item => item.state === 'completed').sort((left, right) => compareAssignmentsByInstant(right, left))[0];
  const upcoming = assignments?.filter(item => item.state === 'assigned' && assignmentIsUpcoming(item, now)).sort(compareAssignmentsByInstant)[0];

  return <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
    <Card title={text.summary}>
      <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small" bordered>
        <Descriptions.Item label={text.status}><Tag color={data.person.active ? 'success' : 'default'}>{data.person.active ? text.active : text.inactive}</Tag></Descriptions.Item>
        <Descriptions.Item label={text.groups}>{groups ? groups.length ? <Space wrap>{groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : text.noGroups : text.none}</Descriptions.Item>
        <Descriptions.Item label={text.availabilityNow}>{data.availability.status === 'ready' ? availability ? <Tag color="warning">{text.unavailable}</Tag> : <Tag color="success">{text.available}</Tag> : text.none}</Descriptions.Item>
        <Descriptions.Item label={text.nextAbsence}>{data.availability.status === 'ready' ? nextAway ? `${formatDate(nextAway.startsAt, locale)} – ${formatDate(nextAway.endsAt, locale)}` : text.noPeriods : text.none}</Descriptions.Item>
        <Descriptions.Item label={text.lastAssignment}>{assignments ? completed ? formatMeeting(completed, text) : text.noCompleted : text.none}</Descriptions.Item>
        <Descriptions.Item label={text.nextAssignment}>{assignments ? upcoming ? formatMeeting(upcoming, text) : text.noUpcoming : text.none}</Descriptions.Item>
        <Descriptions.Item label={text.responsibilities} span={{ xs: 1, sm: 2, lg: 3 }}>{activeResponsibilities ? activeResponsibilities.length ? <Space wrap>{activeResponsibilities.map(value => <Tag key={value.id}>{value.responsibilityKey.replace(/[-_]+/g, ' ')}</Tag>)}</Space> : text.noResponsibilities : text.none}</Descriptions.Item>
      </Descriptions>
    </Card>
    {sectionIsPartial(data) ? <Alert type="info" showIcon message={text.partial} /> : null}
  </Space>;
}

function Contacts({ data, text }: { data: PersonProfileData; text: Copy }) {
  const state = sectionState(data.contacts, text);
  return <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
    <Card title={text.emergency}>{state ?? (data.contacts.value?.length ? <List dataSource={[...data.contacts.value]} renderItem={contact => <List.Item key={contact.id}><List.Item.Meta title={<Text strong>{contact.name}</Text>} description={<Space direction="vertical" size={0}><Text>{text.phone}: {contact.phone}</Text>{contact.relationship ? <Text type="secondary">{text.relation}: {contact.relationship}</Text> : null}</Space>} /></List.Item>} /> : <EmptySection description={text.noContacts} />)}</Card>
    <Card title={text.ordinaryContacts}><Alert type="info" showIcon message={text.ordinaryBlocked} /></Card>
  </Space>;
}

function Participation({ data, locale, text }: { data: PersonProfileData; locale: Locale; text: Copy }) {
  const state = sectionState(data.eligibility, text);
  return <Card title={text.participation}>{state ?? (data.eligibility.value?.length ? <List dataSource={[...data.eligibility.value]} renderItem={decision => <List.Item key={decision.assignmentTypeId}><List.Item.Meta title={<Space wrap><Text strong>{assignmentTypeLabel(decision.assignmentTypeId, locale)}</Text><Tag color={decision.enabled ? 'success' : 'default'}>{decision.enabled ? text.enabled : text.disabled}</Tag></Space>} description={`${text.decided}: ${formatDate(decision.decidedAt, locale, true)}`} /></List.Item>} /> : <EmptySection description={text.noEligibility} />)}</Card>;
}

function Availability({ data, locale, text, now }: { data: PersonProfileData; locale: Locale; text: Copy; now: Date }) {
  const state = sectionState(data.availability, text);
  const periods = data.availability.value ? [...data.availability.value].sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt)) : [];
  return <Card title={text.availability}>{state ?? (periods.length ? <List dataSource={periods} renderItem={period => {
    const current = Boolean(currentAvailability([period], now));
    const future = Date.parse(period.startsAt) > now.getTime();
    return <List.Item key={period.id}><List.Item.Meta avatar={<CalendarOutlined />} title={<Space wrap><Text strong>{formatDate(period.startsAt, locale)} – {formatDate(period.endsAt, locale)}</Text><Tag color={current ? 'warning' : future ? 'processing' : 'default'}>{current ? text.current : future ? text.upcoming : text.past}</Tag></Space>} description={reasonLabel(period.reasonCode, text)} /></List.Item>;
  }} /> : <EmptySection description={text.noPeriods} />)}</Card>;
}

function Assignments({ data, text, now }: { data: PersonProfileData; text: Copy; now: Date }) {
  const state = sectionState(data.assignments, text);
  if (state) return <Card title={text.assignments}>{state}</Card>;
  const evidence = assignmentEvidenceForPerson(data.assignments.value!, data.person.id);
  const upcoming = evidence.filter(item => item.state === 'assigned' && assignmentIsUpcoming(item, now)).sort(compareAssignmentsByInstant);
  const completed = evidence.filter(item => item.state === 'completed').sort((left, right) => compareAssignmentsByInstant(right, left));
  const cancelled = evidence.filter(item => item.state === 'cancelled').sort((left, right) => compareAssignmentsByInstant(right, left));
  if (!evidence.length) return <Card title={text.assignments}><EmptySection description={text.noAssignments} /></Card>;
  return <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
    <Card title={text.upcoming}>{upcoming.length ? <List dataSource={upcoming} renderItem={item => assignmentCard(item, text)} /> : <EmptySection description={text.noUpcoming} />}</Card>
    <Card title={text.lastAssignment}>{completed.length ? <List dataSource={completed} renderItem={item => assignmentCard(item, text)} /> : <EmptySection description={text.noCompleted} />}</Card>
    {cancelled.length ? <Card title={text.cancelled}><List dataSource={cancelled} renderItem={item => assignmentCard(item, text)} /></Card> : null}
  </Space>;
}

function Organization({ data, text, now }: { data: PersonProfileData; text: Copy; now: Date }) {
  const groups = data.groups.status === 'ready' && data.groups.value ? data.groups.value.filter(group => group.memberIds.includes(data.person.id)) : [];
  const households = data.households.status === 'ready' && data.households.value ? data.households.value.filter(household => household.memberIds.includes(data.person.id)) : [];
  const responsibilities = data.responsibilities.status === 'ready' && data.responsibilities.value ? data.responsibilities.value.filter(value => value.personId === data.person.id && isActiveResponsibility(value, now)) : [];
  const unavailable = [data.groups, data.households, data.responsibilities].find(section => section.status !== 'ready');
  return <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
    {unavailable ? sectionState(unavailable as PersonProfileSection<unknown>, text) : null}
    <Card title={text.operationalContext}>
      {groups.length || households.length || responsibilities.length ? <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
        <Descriptions.Item label={text.groups}>{groups.length ? <Space wrap>{groups.map(group => <Tag key={group.id}>{group.name}</Tag>)}</Space> : text.noGroups}</Descriptions.Item>
        <Descriptions.Item label={text.household}>{households.length ? <Space wrap>{households.map(household => <Tag key={household.id}>{household.name}</Tag>)}</Space> : text.noHousehold}</Descriptions.Item>
        <Descriptions.Item label={text.responsibilities} span={{ xs: 1, sm: 2 }}>{responsibilities.length ? <Space wrap>{responsibilities.map(value => <Tag key={value.id}>{value.responsibilityKey.replace(/[-_]+/g, ' ')}</Tag>)}</Space> : text.noResponsibilities}</Descriptions.Item>
      </Descriptions> : <EmptySection description={text.noOrganization} />}
    </Card>
  </Space>;
}

function History({ data, locale, text }: { data: PersonProfileData; locale: Locale; text: Copy }) {
  if (data.history.status === 'blocked') return <Card title={text.history}><Alert type="info" showIcon icon={<LockOutlined />} message={text.historyBlocked} /></Card>;
  if (data.history.status === 'unavailable') return <Card title={text.history}>{sectionState(data.history, text)}</Card>;
  const events = [...(data.history.value ?? [])];
  const eventTitle = (action: string) => action === 'create' ? text.created : action === 'update' ? text.updated : action === 'delete' ? text.deleted : text.activity;
  return <Card title={text.history}>{events.length ? <List dataSource={events} renderItem={event => <List.Item key={event.id}><List.Item.Meta avatar={<ClockCircleOutlined />} title={<Text strong>{eventTitle(event.action)}</Text>} description={formatDate(event.occurredAt, locale, true)} /></List.Item>} /> : <EmptySection description={text.historyEmpty} />}</Card>;
}

function ProfileContent({ data, locale, text }: { data: PersonProfileData; locale: Locale; text: Copy }) {
  const now = useMemo(() => new Date(), [data]);
  return <Tabs
    defaultActiveKey="summary"
    items={[
      { key: 'summary', label: text.summary, children: <Summary data={data} locale={locale} text={text} now={now} /> },
      { key: 'contacts', label: text.contacts, children: <Contacts data={data} text={text} /> },
      { key: 'participation', label: text.participation, children: <Participation data={data} locale={locale} text={text} /> },
      { key: 'availability', label: text.availability, children: <Availability data={data} locale={locale} text={text} now={now} /> },
      { key: 'assignments', label: text.assignments, children: <Assignments data={data} text={text} now={now} /> },
      { key: 'organization', label: text.organization, children: <Organization data={data} text={text} now={now} /> },
      { key: 'history', label: text.history, children: <History data={data} locale={locale} text={text} /> },
    ]}
  />;
}

export function PersonProfile({ personId, locale, onBack }: PersonProfileProps) {
  const text = copy[locale];
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: 'loading' });
    void personProfileDataApi.load(personId, controller.signal).then(data => {
      if (!isCurrentProfileRequest(requestVersion, requestVersionRef.current, controller.signal.aborted)) return;
      setState({ status: 'ready', data });
    }).catch(error => {
      if (!isCurrentProfileRequest(requestVersion, requestVersionRef.current, controller.signal.aborted)) return;
      setState({ status: 'error', error: error instanceof PersonProfileLoadError ? error : new PersonProfileLoadError('retryable', 'Person profile could not be loaded') });
    });
  };

  useEffect(() => {
    load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, [personId]);

  if (state.status === 'loading') return <section aria-labelledby="person-profile-title" aria-busy="true"><Card><Space direction="vertical" size="middle" style={{ display: 'flex' }}><Skeleton active avatar paragraph={{ rows: 6 }} /><Text role="status" type="secondary">{text.loading}</Text></Space></Card></section>;

  if (state.status === 'error') {
    const isUnauthenticated = state.error.kind === 'unauthenticated';
    const isForbidden = state.error.kind === 'forbidden';
    const isMissing = state.error.kind === 'not-found';
    return <section aria-label={text.profile}><Result status={isUnauthenticated || isForbidden ? '403' : 'error'} title={isUnauthenticated ? text.unauthTitle : isForbidden ? text.forbiddenTitle : isMissing ? text.missingTitle : text.errorTitle} subTitle={isUnauthenticated ? text.unauthDescription : isForbidden ? text.forbiddenDescription : isMissing ? text.missingDescription : text.errorDescription} extra={!isUnauthenticated && !isForbidden && !isMissing ? <Button type="primary" icon={<ReloadOutlined />} onClick={load}>{text.retry}</Button> : onBack ? <Button onClick={onBack}>{text.back}</Button> : undefined} /></section>;
  }

  return <section aria-labelledby="person-profile-title">
    <Space direction="vertical" size="large" style={{ display: 'flex' }}>
      <ProfileHeader data={state.data} text={text} onBack={onBack} />
      <ProfileContent data={state.data} locale={locale} text={text} />
    </Space>
  </section>;
}

export const personProfileCopy = copy;
