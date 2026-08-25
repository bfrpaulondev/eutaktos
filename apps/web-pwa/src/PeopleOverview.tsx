import { useEffect, useMemo, useRef, useState } from 'react';
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
import type { AvailabilityPeriodDto } from './lib/availabilityApi';
import { availabilityApi } from './lib/availabilityApi';
import type { MidweekOverviewDto } from './lib/midweekApi';
import { midweekApi } from './lib/midweekApi';
import type { PersonProfileDto } from './lib/peopleApi';
import { peopleApi } from './lib/peopleApi';
import type { Locale } from './lib/preferences';

const { Paragraph, Text, Title } = Typography;

type QueryState<T> =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; value: T }>
  | Readonly<{ status: 'error'; error: unknown }>;

type AvailabilityState =
  | Readonly<{ status: 'idle' }>
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'ready'; periodsByPersonId: ReadonlyMap<string, readonly AvailabilityPeriodDto[]> }>
  | Readonly<{ status: 'partial'; periodsByPersonId: ReadonlyMap<string, readonly AvailabilityPeriodDto[]> }>
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
    activePeople: 'perfis ativos',
    activePerson: 'perfil ativo',
    loading: 'A carregar os dados de Pessoas…',
    loadingDetails: 'A analisar designações e ausências…',
    attention: 'Precisa da sua atenção',
    affectedTitle: 'pessoas com designações afetadas por ausência',
    affectedSingularTitle: 'pessoa com designações afetadas por ausência',
    affectedDescription: 'Há ausências ou indisponibilidades registadas durante uma reunião futura com designação.',
    reviewAssignments: 'Rever designações',
    partial: 'Alguns dados necessários para identificar designações afetadas estão temporariamente indisponíveis. Os itens apresentados usam apenas os dados recebidos.',
    scheduleUnavailable: 'Não foi possível verificar designações e ausências neste momento. O resumo de pessoas continua disponível.',
    noAttention: 'Não existem designações futuras afetadas por ausências nos dados disponíveis.',
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
    availabilityPartial: 'Verificação parcial de ausências',
  },
  en: {
    eyebrow: 'People',
    title: 'Overview',
    subtitle: 'See what needs attention first, then move to the most useful next action.',
    add: 'Add person',
    directory: 'Directory',
    people: 'people',
    person: 'person',
    activePeople: 'active profiles',
    activePerson: 'active profile',
    loading: 'Loading People data…',
    loadingDetails: 'Checking assignments and away periods…',
    attention: 'Needs your attention',
    affectedTitle: 'people have assignments affected by an absence',
    affectedSingularTitle: 'person has assignments affected by an absence',
    affectedDescription: 'Registered away periods or unavailability overlap with a future meeting assignment.',
    reviewAssignments: 'Review assignments',
    partial: 'Some data needed to identify affected assignments is temporarily unavailable. The items shown use only data that was received.',
    scheduleUnavailable: 'Assignments and away periods could not be checked right now. The people summary remains available.',
    noAttention: 'No future assignments are affected by away periods in the available data.',
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
    availabilityPartial: 'Away-period check is partial',
  },
  es: {
    eyebrow: 'Personas',
    title: 'Vista general',
    subtitle: 'Vea primero lo que necesita atención y avance a la siguiente acción útil.',
    add: 'Añadir persona',
    directory: 'Directorio',
    people: 'personas',
    person: 'persona',
    activePeople: 'perfiles activos',
    activePerson: 'perfil activo',
    loading: 'Cargando los datos de Personas…',
    loadingDetails: 'Revisando asignaciones y períodos de ausencia…',
    attention: 'Requiere su atención',
    affectedTitle: 'personas tienen asignaciones afectadas por una ausencia',
    affectedSingularTitle: 'persona tiene asignaciones afectadas por una ausencia',
    affectedDescription: 'Las ausencias o indisponibilidades registradas coinciden con una asignación en una reunión futura.',
    reviewAssignments: 'Revisar asignaciones',
    partial: 'Algunos datos necesarios para identificar asignaciones afectadas no están disponibles temporalmente. Los elementos mostrados usan solo los datos recibidos.',
    scheduleUnavailable: 'No se pudieron revisar las asignaciones y los períodos de ausencia por ahora. El resumen de personas sigue disponible.',
    noAttention: 'No hay asignaciones futuras afectadas por ausencias en los datos disponibles.',
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
    availabilityPartial: 'Comprobación parcial de ausencias',
  },
} as const;

function dayKey(value: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : undefined;
}

function isFutureScheduledMeeting(meeting: MidweekOverviewDto['meetings'][number], today: string): boolean {
  return (meeting.state === 'draft' || meeting.state === 'published') && meeting.date >= today;
}

function isUnavailableForMeeting(period: AvailabilityPeriodDto, meetingDate: string): boolean {
  const start = dayKey(period.startsAt);
  const end = dayKey(period.endsAt);
  return (period.reasonCode === 'away' || period.reasonCode === 'unavailable')
    && Boolean(start && end && start <= meetingDate && meetingDate < end);
}

function formatToday(now: Date): string {
  return `${String(now.getUTCFullYear()).padStart(4, '0')}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
}

export function buildPeopleOverviewSummary(
  people: readonly PersonProfileDto[],
  midweek: MidweekOverviewDto,
  periodsByPersonId: ReadonlyMap<string, readonly AvailabilityPeriodDto[]>,
  now = new Date(),
): PeopleOverviewSummary {
  const today = formatToday(now);
  const meetingsById = new Map(midweek.meetings
    .filter(meeting => isFutureScheduledMeeting(meeting, today))
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

export function isCurrentPeopleOverviewRequest(requestVersion: number, currentVersion: number, aborted: boolean): boolean {
  return requestVersion === currentVersion && !aborted;
}

export function classifyPeopleOverviewProblem(error: unknown): PeopleOverviewProblem {
  const message = error instanceof Error ? error.message : '';
  const match = /\((\d{3})\)$/.exec(message);
  const status = match ? Number(match[1]) : undefined;
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status && status >= 400 && status < 500) return 'non-retryable';
  return 'retryable';
}

function navigateToAssignments(): void {
  if (window.location.pathname !== '/designacoes') {
    window.history.pushState({ section: 'assignments' }, '', '/designacoes');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}

function availabilityPersonIds(midweek: MidweekOverviewDto, now: Date): readonly string[] {
  const today = formatToday(now);
  const scheduledMeetingIds = new Set(midweek.meetings
    .filter(meeting => isFutureScheduledMeeting(meeting, today))
    .map(meeting => meeting.id));
  const personIds = new Set<string>();
  for (const assignment of midweek.studentAssignments) {
    if (assignment.state === 'assigned' && scheduledMeetingIds.has(assignment.meetingId)) {
      personIds.add(assignment.studentId);
      if (assignment.assistantId) personIds.add(assignment.assistantId);
    }
  }
  for (const assignment of midweek.nonStudentAssignments) {
    if (assignment.state === 'assigned' && scheduledMeetingIds.has(assignment.meetingId)) personIds.add(assignment.personId);
  }
  return Object.freeze([...personIds]);
}

function countAffectedPeople(affected: readonly AffectedAssignment[]): number {
  return new Set(affected.map(item => item.personId)).size;
}

export function PeopleOverview({ locale, onOpenDirectory, onAddPerson }: { locale: Locale; onOpenDirectory: () => void; onAddPerson: () => void }) {
  const text = copy[locale];
  const [people, setPeople] = useState<QueryState<readonly PersonProfileDto[]>>({ status: 'loading' });
  const [midweek, setMidweek] = useState<QueryState<MidweekOverviewDto>>({ status: 'loading' });
  const [availability, setAvailability] = useState<AvailabilityState>({ status: 'idle' });
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  const load = async () => {
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPeople({ status: 'loading' });
    setMidweek({ status: 'loading' });
    setAvailability({ status: 'idle' });

    const accept = () => isCurrentPeopleOverviewRequest(requestVersion, requestVersionRef.current, controller.signal.aborted);
    const [peopleResult, midweekResult] = await Promise.allSettled([
      peopleApi.list(controller.signal),
      midweekApi.overview(controller.signal),
    ]);
    if (!accept()) return;

    if (peopleResult.status === 'fulfilled') setPeople({ status: 'ready', value: peopleResult.value });
    else setPeople({ status: 'error', error: peopleResult.reason });
    if (midweekResult.status === 'fulfilled') setMidweek({ status: 'ready', value: midweekResult.value });
    else setMidweek({ status: 'error', error: midweekResult.reason });

    if (peopleResult.status !== 'fulfilled' || midweekResult.status !== 'fulfilled') {
      setAvailability({ status: 'idle' });
      return;
    }

    const personIds = availabilityPersonIds(midweekResult.value, new Date());
    if (personIds.length === 0) {
      setAvailability({ status: 'ready', periodsByPersonId: new Map() });
      return;
    }

    setAvailability({ status: 'loading' });
    const results = await Promise.allSettled(personIds.map(async personId => [personId, await availabilityApi.list(personId, controller.signal)] as const));
    if (!accept()) return;

    const periodsByPersonId = new Map<string, readonly AvailabilityPeriodDto[]>();
    let failures = 0;
    for (const result of results) {
      if (result.status === 'fulfilled') periodsByPersonId.set(result.value[0], result.value[1]);
      else failures += 1;
    }
    setAvailability(failures === 0
      ? { status: 'ready', periodsByPersonId }
      : periodsByPersonId.size > 0 ? { status: 'partial', periodsByPersonId } : { status: 'error', error: results[0]?.status === 'rejected' ? results[0].reason : undefined });
  };

  useEffect(() => {
    void load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  const primaryProblem = people.status === 'error' ? classifyPeopleOverviewProblem(people.error) : undefined;
  const summary = useMemo(() => {
    if (people.status !== 'ready' || midweek.status !== 'ready' || (availability.status !== 'ready' && availability.status !== 'partial')) return undefined;
    return buildPeopleOverviewSummary(people.value, midweek.value, availability.periodsByPersonId);
  }, [availability, midweek, people]);
  const showingInitialLoading = people.status === 'loading';
  const isLoadingDetails = people.status === 'ready' && (midweek.status === 'loading' || availability.status === 'loading');
  const affectedCount = summary ? countAffectedPeople(summary.affectedPeople) : 0;
  const hasPartialData = midweek.status === 'error' || availability.status === 'partial' || availability.status === 'error';

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

  if (primaryProblem === 'non-retryable') {
    return <section aria-label={text.title}>
      <Result status="error" title={<Title level={2} style={{ margin: 0 }}>{text.invalidTitle}</Title>} subTitle={text.invalidDescription} extra={<Space wrap><Button onClick={onOpenDirectory}>{text.directory}</Button><Button href="/">{text.goHome}</Button></Space>} />
    </section>;
  }

  if (primaryProblem === 'retryable' && people.status === 'error') {
    return <section aria-label={text.title}>
      <Result status="error" title={<Title level={2} style={{ margin: 0 }}>{text.errorTitle}</Title>} subTitle={text.errorDescription} extra={<Space wrap><Button onClick={onOpenDirectory}>{text.directory}</Button><Button type="primary" onClick={() => void load()}>{text.retry}</Button></Space>} />
    </section>;
  }

  if (showingInitialLoading) {
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
        <Card size="small">
          <Space direction="vertical" size={2}>
            <Text type="secondary">{text.people}</Text>
            <Title level={2} style={{ margin: 0 }}>{people.value.length}</Title>
          </Space>
        </Card>
        <Card size="small">
          <Space direction="vertical" size={2}>
            <Text type="secondary">{people.value.length === 1 ? text.activePerson : text.activePeople}</Text>
            <Title level={2} style={{ margin: 0 }}>{people.value.filter(person => person.active).length}</Title>
          </Space>
        </Card>
      </div>
    </Card>

    <div style={{ marginTop: 20 }}>
      <Space direction="vertical" size="middle" style={{ display: 'flex' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={2} style={{ margin: 0 }}>{text.attention}</Title>
          <Tag color={hasPartialData ? 'warning' : 'success'}>{hasPartialData ? text.statusPartial : text.statusReady}</Tag>
        </div>

        {isLoadingDetails ? <Card aria-busy="true"><Space direction="vertical" size="small" style={{ display: 'flex' }}><Skeleton active title={{ width: '42%' }} paragraph={{ rows: 2 }} /><Text role="status" type="secondary">{text.loadingDetails}</Text></Space></Card> : null}
        {midweek.status === 'error' ? <Alert type="warning" showIcon message={text.scheduleUnavailable} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
        {availability.status === 'partial' ? <Alert type="warning" showIcon message={text.partial} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}
        {availability.status === 'error' ? <Alert type="warning" showIcon message={text.scheduleUnavailable} action={<Button size="small" onClick={() => void load()}>{text.retry}</Button>} /> : null}

        {summary && affectedCount > 0 ? <Card style={{ borderInlineStart: '4px solid var(--ant-color-warning)' }}>
          <Space direction="vertical" size="small" style={{ display: 'flex' }}>
            <Space align="start">
              <ExclamationCircleOutlined aria-hidden="true" style={{ color: 'var(--ant-color-warning)', fontSize: 20, marginTop: 3 }} />
              <div>
                <Title level={3} style={{ margin: 0 }}>{affectedCount} {affectedCount === 1 ? text.affectedSingularTitle : text.affectedTitle}</Title>
                <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>{text.affectedDescription}</Paragraph>
              </div>
            </Space>
            <Button type="link" icon={<ArrowRightOutlined />} iconPosition="end" onClick={navigateToAssignments} style={{ alignSelf: 'flex-start', paddingInline: 0 }}>{text.reviewAssignments}</Button>
          </Space>
        </Card> : null}
        {summary && affectedCount === 0 && availability.status === 'ready' ? <Card><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={text.noAttention} /></Card> : null}
      </Space>
    </div>
  </section>;
}

export const peopleOverviewCopy = copy;
