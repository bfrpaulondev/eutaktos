import { useEffect, useRef, useState } from 'react';
import ArrowRightOutlined from '@ant-design/icons/es/icons/ArrowRightOutlined';
import ExclamationCircleOutlined from '@ant-design/icons/es/icons/ExclamationCircleOutlined';
import PlusOutlined from '@ant-design/icons/es/icons/PlusOutlined';
import UnorderedListOutlined from '@ant-design/icons/es/icons/UnorderedListOutlined';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Empty from 'antd/es/empty';
import Result from 'antd/es/result';
import Skeleton from 'antd/es/skeleton';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { theme } from 'antd';
import type { AvailabilityPeriodDto } from './lib/availabilityApi';
import type { MidweekOverviewDto } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';
import { peopleApi } from './lib/peopleApi';
import type { PeopleOverviewEvidenceDto } from './lib/peopleOverviewEvidenceApi';
import { peopleOverviewEvidenceApi } from './lib/peopleOverviewEvidenceApi';
import type { ServiceGroupDto } from './lib/serviceGroupsApi';
import { serviceGroupsApi } from './lib/serviceGroupsApi';
import type { Locale } from './lib/preferences';

const { Paragraph, Text, Title } = Typography;

type QueryState<T> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; value: T }>
  | Readonly<{ status: 'error'; error: unknown }>;

export interface AffectedAssignment {
  readonly assignmentId: string;
  readonly personId: string;
  readonly personDisplayName: string;
  readonly meetingId: string;
  readonly meetingDate: string;
}

export interface PeopleOverviewSummary {
  readonly totalPeople: number;
  readonly activePeople: number;
  readonly affectedPeople: readonly AffectedAssignment[];
}

export type PeopleOverviewProblem = 'unauthenticated' | 'forbidden' | 'retryable' | 'non-retryable';

const copy = {
  'pt-PT': {
    eyebrow: 'Pessoas',
    title: 'Visão geral',
    subtitle: 'Veja primeiro o que precisa de atenção e avance para a próxima ação útil.',
    add: 'Adicionar pessoa',
    directory: 'Diretório',
    people: 'pessoas',
    person: 'pessoa',
    groups: 'grupos de serviço',
    group: 'grupo de serviço',
    attentionItems: 'condições requerem atenção',
    attentionItem: 'condição requer atenção',
    activePeople: 'perfis ativos',
    activePerson: 'perfil ativo',
    loading: 'A carregar os dados de Pessoas…',
    loadingDetails: 'A analisar grupos, designações, disponibilidade e histórico…',
    attention: 'Precisa da sua atenção',
    affectedTitle: 'pessoas com designações afetadas por ausência',
    affectedSingularTitle: 'pessoa com uma designação afetada por ausência',
    affectedDescription: 'Há uma indisponibilidade registada que se sobrepõe a uma designação ativa.',
    longTitle: 'pessoas elegíveis têm um intervalo maior desde a última designação concluída',
    longSingularTitle: 'pessoa elegível tem um intervalo maior desde a última designação concluída',
    longDescription: 'Há partes futuras em aberto em que a comparação factual entre candidatos válidos identifica um intervalo maior.',
    reviewAssignments: 'Rever designações',
    groupsUnavailable: 'Não foi possível verificar os grupos de serviço neste momento. O resumo de pessoas continua disponível.',
    evidenceUnavailable: 'Algumas verificações de atenção não estão disponíveis com as permissões atuais. Não são apresentados valores estimados.',
    evidenceError: 'Não foi possível verificar todas as condições de atenção neste momento. O resumo de pessoas continua disponível.',
    noAttention: 'Não existem condições de atenção suportadas pelos contratos atuais nos dados disponíveis.',
    emptyTitle: 'Ainda não existem pessoas',
    emptyDescription: 'Adicione a primeira pessoa para começar a organizar perfis e disponibilidade.',
    unauthorizedTitle: 'É necessário iniciar sessão',
    unauthorizedDescription: 'A sua sessão não permite carregar a área Pessoas.',
    forbiddenTitle: 'Sem acesso à área Pessoas',
    forbiddenDescription: 'Não tem a permissão necessária para consultar estes dados.',
    errorTitle: 'Não foi possível carregar Pessoas',
    errorDescription: 'Tente novamente. Os dados não foram substituídos por informação estimada.',
    invalidTitle: 'A resposta recebida para Pessoas não pode ser apresentada',
    invalidDescription: 'Não foi possível validar os dados necessários para esta área.',
    retry: 'Tentar novamente',
    goHome: 'Ir para o início',
    statusReady: 'Dados atuais',
    statusPartial: 'Dados parciais',
  },
  en: {
    eyebrow: 'People',
    title: 'Overview',
    subtitle: 'See what needs attention first, then move to the most useful next action.',
    add: 'Add person',
    directory: 'Directory',
    people: 'people',
    person: 'person',
    groups: 'service groups',
    group: 'service group',
    attentionItems: 'conditions need attention',
    attentionItem: 'condition needs attention',
    activePeople: 'active profiles',
    activePerson: 'active profile',
    loading: 'Loading People data…',
    loadingDetails: 'Checking groups, assignments, availability and history…',
    attention: 'Needs your attention',
    affectedTitle: 'people have assignments affected by an absence',
    affectedSingularTitle: 'person has an assignment affected by an absence',
    affectedDescription: 'Recorded unavailability overlaps an active assignment.',
    longTitle: 'eligible people have a longer interval since their last completed assignment',
    longSingularTitle: 'eligible person has a longer interval since their last completed assignment',
    longDescription: 'There are future open parts where factual comparison between valid candidates identifies a longer interval.',
    reviewAssignments: 'Review assignments',
    groupsUnavailable: 'Service groups could not be checked right now. The people summary remains available.',
    evidenceUnavailable: 'Some attention checks are unavailable with the current permissions. No estimated values are shown.',
    evidenceError: 'Not all attention conditions could be checked right now. The people summary remains available.',
    noAttention: 'There are no attention conditions supported by the current contracts in the available data.',
    emptyTitle: 'There are no people yet',
    emptyDescription: 'Add the first person to start organizing profiles and availability.',
    unauthorizedTitle: 'Sign-in is required',
    unauthorizedDescription: 'Your session cannot load the People area.',
    forbiddenTitle: 'No access to People',
    forbiddenDescription: 'You do not have the permission required to view this data.',
    errorTitle: 'People could not be loaded',
    errorDescription: 'Try again. No estimated information has replaced your data.',
    invalidTitle: 'The received People response cannot be displayed',
    invalidDescription: 'The data required for this area could not be validated.',
    retry: 'Try again',
    goHome: 'Go to home',
    statusReady: 'Current data',
    statusPartial: 'Partial data',
  },
  es: {
    eyebrow: 'Personas',
    title: 'Vista general',
    subtitle: 'Vea primero lo que necesita atención y avance a la siguiente acción útil.',
    add: 'Añadir persona',
    directory: 'Directorio',
    people: 'personas',
    person: 'persona',
    groups: 'grupos de servicio',
    group: 'grupo de servicio',
    attentionItems: 'condiciones requieren atención',
    attentionItem: 'condición requiere atención',
    activePeople: 'perfiles activos',
    activePerson: 'perfil activo',
    loading: 'Cargando los datos de Personas…',
    loadingDetails: 'Revisando grupos, asignaciones, disponibilidad e historial…',
    attention: 'Requiere su atención',
    affectedTitle: 'personas tienen asignaciones afectadas por una ausencia',
    affectedSingularTitle: 'persona tiene una asignación afectada por una ausencia',
    affectedDescription: 'Una indisponibilidad registrada coincide con una asignación activa.',
    longTitle: 'personas elegibles tienen un intervalo mayor desde su última asignación completada',
    longSingularTitle: 'persona elegible tiene un intervalo mayor desde su última asignación completada',
    longDescription: 'Hay partes futuras abiertas donde la comparación factual entre candidatos válidos identifica un intervalo mayor.',
    reviewAssignments: 'Revisar asignaciones',
    groupsUnavailable: 'No se pudieron revisar los grupos de servicio por ahora. El resumen de personas sigue disponible.',
    evidenceUnavailable: 'Algunas comprobaciones de atención no están disponibles con los permisos actuales. No se muestran valores estimados.',
    evidenceError: 'No se pudieron comprobar todas las condiciones de atención. El resumen de personas sigue disponible.',
    noAttention: 'No hay condiciones de atención admitidas por los contratos actuales en los datos disponibles.',
    emptyTitle: 'Todavía no hay personas',
    emptyDescription: 'Añada la primera persona para empezar a organizar perfiles y disponibilidad.',
    unauthorizedTitle: 'Es necesario iniciar sesión',
    unauthorizedDescription: 'Su sesión no puede cargar el área de Personas.',
    forbiddenTitle: 'Sin acceso a Personas',
    forbiddenDescription: 'No tiene el permiso necesario para consultar estos datos.',
    errorTitle: 'No se pudieron cargar Personas',
    errorDescription: 'Inténtelo de nuevo. Ninguna información estimada ha sustituido sus datos.',
    invalidTitle: 'La respuesta recibida para Personas no se puede mostrar',
    invalidDescription: 'No se pudieron validar los datos necesarios para esta área.',
    retry: 'Intentar de nuevo',
    goHome: 'Ir al inicio',
    statusReady: 'Datos actuales',
    statusPartial: 'Datos parciales',
  },
} as const;

function dayKey(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : undefined;
}

export function localDateKey(now: Date, timezone: string): string | undefined {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    if (!values.year || !values.month || !values.day) return undefined;
    return `${values.year}-${values.month}-${values.day}`;
  } catch {
    return undefined;
  }
}

function isFutureScheduledMeeting(meeting: MidweekOverviewDto['meetings'][number], now: Date): boolean {
  if (meeting.state !== 'draft' && meeting.state !== 'published') return false;
  const today = localDateKey(now, meeting.timezone);
  return Boolean(today && meeting.date >= today);
}

function isUnavailableForMeeting(period: AvailabilityPeriodDto, meetingDate: string): boolean {
  const start = dayKey(period.startsAt);
  const end = dayKey(period.endsAt);
  return Boolean(start && end && start <= meetingDate && meetingDate < end);
}

/** Legacy pure regression helper retained while the runtime now consumes the server-owned evidence contract. */
export function buildPeopleOverviewSummary(
  people: readonly PersonProfileDto[],
  midweek: MidweekOverviewDto,
  periodsByPersonId: ReadonlyMap<string, readonly AvailabilityPeriodDto[]>,
  now = new Date(),
): PeopleOverviewSummary {
  const meetingsById = new Map(midweek.meetings
    .filter(meeting => isFutureScheduledMeeting(meeting, now))
    .map(meeting => [meeting.id, meeting] as const));
  const affected = new Map<string, AffectedAssignment>();

  for (const assignment of midweek.studentAssignments) {
    if (assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) continue;
    const participants = [
      { personId: assignment.studentId, personDisplayName: assignment.studentDisplayName },
      ...(assignment.assistantId && assignment.assistantDisplayName
        ? [{ personId: assignment.assistantId, personDisplayName: assignment.assistantDisplayName }]
        : []),
    ];
    for (const participant of participants) {
      if (periodsByPersonId.get(participant.personId)?.some(period => isUnavailableForMeeting(period, meeting.date))) {
        affected.set(`${assignment.id}:${participant.personId}`, Object.freeze({
          assignmentId: assignment.id,
          personId: participant.personId,
          personDisplayName: participant.personDisplayName,
          meetingId: meeting.id,
          meetingDate: meeting.date,
        }));
      }
    }
  }

  for (const assignment of midweek.nonStudentAssignments) {
    if (assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting || !periodsByPersonId.get(assignment.personId)?.some(period => isUnavailableForMeeting(period, meeting.date))) continue;
    affected.set(`${assignment.id}:${assignment.personId}`, Object.freeze({
      assignmentId: assignment.id,
      personId: assignment.personId,
      personDisplayName: assignment.personDisplayName,
      meetingId: meeting.id,
      meetingDate: meeting.date,
    }));
  }

  return Object.freeze({
    totalPeople: people.length,
    activePeople: people.filter(person => person.active).length,
    affectedPeople: Object.freeze([...affected.values()]),
  });
}

export function countServiceGroups(groups: readonly ServiceGroupDto[]): number {
  return groups.length;
}

export function isCurrentPeopleOverviewRequest(requestVersion: number, currentVersion: number, aborted: boolean): boolean {
  return requestVersion === currentVersion && !aborted;
}

export function classifyPeopleOverviewProblem(error: unknown): PeopleOverviewProblem {
  const message = error instanceof Error ? error.message : '';
  const match = /\((\d{3})\)$/.exec(message);
  const status = match ? Number(match[1]) : undefined;
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 429) return 'retryable';
  if (status && status >= 400 && status < 500) return 'non-retryable';
  return 'retryable';
}

function navigateToAssignments(): void {
  if (window.location.pathname === '/designacoes' && !window.location.search && !window.location.hash) return;
  window.history.pushState({ section: 'assignments' }, '', '/designacoes');
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
}

function readyEvidence(value: QueryState<PeopleOverviewEvidenceDto>): PeopleOverviewEvidenceDto | undefined {
  return value.status === 'ready' ? value.value : undefined;
}

export function PeopleOverview({ locale, onOpenDirectory, onAddPerson }: { locale: Locale; onOpenDirectory: () => void; onAddPerson: () => void }) {
  const text = copy[locale];
  const [people, setPeople] = useState<QueryState<readonly PersonProfileDto[]>>({ status: 'loading' });
  const [serviceGroups, setServiceGroups] = useState<QueryState<readonly ServiceGroupDto[]>>({ status: 'loading' });
  const [evidence, setEvidence] = useState<QueryState<PeopleOverviewEvidenceDto>>({ status: 'loading' });
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const { token } = theme.useToken();

  const load = async () => {
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPeople({ status: 'loading' });
    setServiceGroups({ status: 'loading' });
    setEvidence({ status: 'loading' });

    const accept = () => isCurrentPeopleOverviewRequest(requestVersion, requestVersionRef.current, controller.signal.aborted);
    const [peopleResult, groupsResult, evidenceResult] = await Promise.allSettled([
      peopleApi.list(controller.signal),
      serviceGroupsApi.list(controller.signal),
      peopleOverviewEvidenceApi.get(controller.signal),
    ]);
    if (!accept()) return;

    setPeople(peopleResult.status === 'fulfilled'
      ? { status: 'ready', value: peopleResult.value }
      : { status: 'error', error: peopleResult.reason });
    setServiceGroups(groupsResult.status === 'fulfilled'
      ? { status: 'ready', value: groupsResult.value }
      : { status: 'error', error: groupsResult.reason });
    setEvidence(evidenceResult.status === 'fulfilled'
      ? { status: 'ready', value: evidenceResult.value }
      : { status: 'error', error: evidenceResult.reason });
  };

  useEffect(() => {
    void load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  const peopleProblem = people.status === 'error' ? classifyPeopleOverviewProblem(people.error) : undefined;
  const evidenceProblem = evidence.status === 'error' ? classifyPeopleOverviewProblem(evidence.error) : undefined;
  const primaryProblem = peopleProblem ?? (evidenceProblem === 'unauthenticated' ? 'unauthenticated' : undefined);

  if (primaryProblem === 'unauthenticated' || primaryProblem === 'forbidden') {
    return <section aria-label={text.title}>
      <Result
        status="403"
        title={<Title level={2} style={{ margin: 0 }}>{primaryProblem === 'unauthenticated' ? text.unauthorizedTitle : text.forbiddenTitle}</Title>}
        subTitle={primaryProblem === 'unauthenticated' ? text.unauthorizedDescription : text.forbiddenDescription}
        extra={<Button href="/" type="primary">{text.goHome}</Button>}
      />
    </section>;
  }

  if (peopleProblem === 'non-retryable') {
    return <section aria-label={text.title}>
      <Result status="error" title={<Title level={2} style={{ margin: 0 }}>{text.invalidTitle}</Title>} subTitle={text.invalidDescription} extra={<Space wrap><Button onClick={onOpenDirectory}>{text.directory}</Button><Button href="/">{text.goHome}</Button></Space>} />
    </section>;
  }

  if (peopleProblem === 'retryable' && people.status === 'error') {
    return <section aria-label={text.title}>
      <Result status="error" title={<Title level={2} style={{ margin: 0 }}>{text.errorTitle}</Title>} subTitle={text.errorDescription} extra={<Space wrap><Button onClick={onOpenDirectory}>{text.directory}</Button><Button type="primary" onClick={() => void load()}>{text.retry}</Button></Space>} />
    </section>;
  }

  if (people.status === 'loading') {
    return <section aria-label={text.title} aria-busy="true">
      <Card>
        <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
          <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 3 }} />
          <Text role="status" type="secondary">{text.loading}</Text>
        </Space>
      </Card>
    </section>;
  }

  if (people.status !== 'ready') return null;

  if (people.value.length === 0) {
    return <section aria-label={text.title}>
      <Card>
        <Empty description={<Space direction="vertical" size={4}><Title id="people-overview-title" level={2}>{text.emptyTitle}</Title><Paragraph type="secondary">{text.emptyDescription}</Paragraph></Space>}>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddPerson}>{text.add}</Button>
        </Empty>
      </Card>
    </section>;
  }

  const evidenceValue = readyEvidence(evidence);
  const affected = evidenceValue?.affectedAssignments.status === 'ready' ? evidenceValue.affectedAssignments : undefined;
  const longInterval = evidenceValue?.longInterval.status === 'ready' ? evidenceValue.longInterval : undefined;
  const affectedCount = affected?.affectedPeopleCount ?? 0;
  const longCount = longInterval?.candidateCount ?? 0;
  const attentionCount = Number(affectedCount > 0) + Number(longCount > 0);
  const attentionComplete = Boolean(affected && longInterval);
  const evidenceUnavailable = Boolean(evidenceValue && (!affected || !longInterval));
  const hasPartialData = serviceGroups.status === 'error' || evidence.status === 'error' || evidenceUnavailable;
  const isLoadingDetails = serviceGroups.status === 'loading' || evidence.status === 'loading';

  return <section aria-label={text.title}>
    <Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ maxWidth: 720 }}>
          <Text type="secondary" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{text.eyebrow}</Text>
          <Title id="people-overview-title" level={1} style={{ margin: '4px 0 8px' }}>{text.title}</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>{text.subtitle}</Paragraph>
        </div>
        <Space wrap>
          <Button icon={<UnorderedListOutlined />} onClick={onOpenDirectory}>{text.directory}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onAddPerson}>{text.add}</Button>
        </Space>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 24 }}>
        <Card size="small"><Space direction="vertical" size={2}><Text type="secondary">{people.value.length === 1 ? text.person : text.people}</Text><Title level={2} style={{ margin: 0 }}>{people.value.length}</Title></Space></Card>
        <Card size="small"><Space direction="vertical" size={2}><Text type="secondary">{people.value.length === 1 ? text.activePerson : text.activePeople}</Text><Title level={2} style={{ margin: 0 }}>{people.value.filter(person => person.active).length}</Title></Space></Card>
        {serviceGroups.status === 'ready' ? <Card size="small"><Space direction="vertical" size={2}><Text type="secondary">{countServiceGroups(serviceGroups.value) === 1 ? text.group : text.groups}</Text><Title level={2} style={{ margin: 0 }}>{countServiceGroups(serviceGroups.value)}</Title></Space></Card> : null}
        {attentionComplete ? <Card size="small"><Space direction="vertical" size={2}><Text type="secondary">{attentionCount === 1 ? text.attentionItem : text.attentionItems}</Text><Title level={2} style={{ margin: 0 }}>{attentionCount}</Title></Space></Card> : null}
      </div>
    </Card>

    <div style={{ marginTop: 20 }}>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>{text.attention}</Title>
          <Tag color={hasPartialData ? 'warning' : 'success'}>{hasPartialData ? text.statusPartial : text.statusReady}</Tag>
        </div>

        {isLoadingDetails ? <Card aria-busy="true"><Space direction="vertical" size="small" style={{ display: 'flex' }}><Skeleton active title={{ width: '42%' }} paragraph={{ rows: 2 }} /><Text role="status" type="secondary">{text.loadingDetails}</Text></Space></Card> : null}
        {serviceGroups.status === 'error' ? <Alert type="warning" showIcon message={text.groupsUnavailable} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
        {evidence.status === 'error' ? <Alert type="warning" showIcon message={text.evidenceError} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
        {evidenceUnavailable ? <Alert type="warning" showIcon message={text.evidenceUnavailable} /> : null}

        {affected && affectedCount > 0 ? <Card style={{ borderInlineStart: `4px solid ${token.colorWarning}` }}>
          <Space direction="vertical" size="small" style={{ display: 'flex' }}>
            <Space align="start">
              <ExclamationCircleOutlined aria-hidden="true" style={{ color: token.colorWarning, fontSize: 20, marginTop: 3 }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>{affectedCount} {affectedCount === 1 ? text.affectedSingularTitle : text.affectedTitle}</Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{text.affectedDescription}</Paragraph>
              </div>
            </Space>
            <Button type="link" icon={<ArrowRightOutlined />} iconPosition="end" onClick={navigateToAssignments} style={{ alignSelf: 'flex-start', paddingInline: 0 }}>{text.reviewAssignments}</Button>
          </Space>
        </Card> : null}

        {longInterval && longCount > 0 ? <Card style={{ borderInlineStart: `4px solid ${token.colorWarning}` }}>
          <Space direction="vertical" size="small" style={{ display: 'flex' }}>
            <Space align="start">
              <ExclamationCircleOutlined aria-hidden="true" style={{ color: token.colorWarning, fontSize: 20, marginTop: 3 }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>{longCount} {longCount === 1 ? text.longSingularTitle : text.longTitle}</Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{text.longDescription}</Paragraph>
              </div>
            </Space>
            <Button type="link" icon={<ArrowRightOutlined />} iconPosition="end" onClick={navigateToAssignments} style={{ alignSelf: 'flex-start', paddingInline: 0 }}>{text.reviewAssignments}</Button>
          </Space>
        </Card> : null}

        {attentionComplete && attentionCount === 0 ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.noAttention} /></Card> : null}
      </Space>
    </div>
  </section>;
}

export const peopleOverviewCopy = copy;
