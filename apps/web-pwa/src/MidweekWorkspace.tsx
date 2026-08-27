import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Divider from 'antd/es/divider';
import Empty from 'antd/es/empty';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useEffect, useMemo, useRef, useState } from 'react';
import { midweekApi, type MidweekMeetingDto, type MidweekOverviewDto } from './lib/midweekApi';
import { authenticationApi } from './lib/authApi';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { CreateMidweekMeetingControl, MidweekMeetingControls, NonStudentAssignmentControls, StudentAssignmentControls } from './MidweekAuthoringControls';

export type MidweekWorkspaceSection = 'agenda' | 'assignments';

const copy = {
  'pt-PT': {
    agenda: 'Agenda', assignments: 'Designações', agendaSubtitle: 'Reuniões reais guardadas para esta congregação.', assignmentsSubtitle: 'Designações reais, com o estado atual e a reunião correspondente.',
    loadingAgenda: 'A carregar a agenda…', loadingAssignments: 'A carregar designações…', unavailable: 'Não foi possível carregar os dados reais.', retry: 'Tentar novamente',
    emptyAgenda: 'Ainda não existem reuniões na agenda.', emptyAssignments: 'Ainda não existem designações.', slots: 'partes', slot: 'parte',
    draft: 'Rascunho', published: 'Publicada', cancelled: 'Cancelada', archived: 'Arquivada', assigned: 'Designada', completed: 'Concluída',
    student: 'Estudante', assistant: 'Ajudante', role: 'Função', meeting: 'Reunião', noAssistant: 'Sem ajudante', realData: 'Dados reais', cancelledAssignment: 'Cancelada',
  },
  en: {
    agenda: 'Agenda', assignments: 'Assignments', agendaSubtitle: 'Real meetings stored for this congregation.', assignmentsSubtitle: 'Real assignments with their current state and related meeting.',
    loadingAgenda: 'Loading agenda…', loadingAssignments: 'Loading assignments…', unavailable: 'Real data could not be loaded.', retry: 'Try again',
    emptyAgenda: 'There are no meetings in the agenda yet.', emptyAssignments: 'There are no assignments yet.', slots: 'parts', slot: 'part',
    draft: 'Draft', published: 'Published', cancelled: 'Cancelled', archived: 'Archived', assigned: 'Assigned', completed: 'Completed',
    student: 'Student', assistant: 'Assistant', role: 'Role', meeting: 'Meeting', noAssistant: 'No assistant', realData: 'Real data', cancelledAssignment: 'Cancelled',
  },
  es: {
    agenda: 'Agenda', assignments: 'Asignaciones', agendaSubtitle: 'Reuniones reales guardadas para esta congregación.', assignmentsSubtitle: 'Asignaciones reales con su estado actual y la reunión correspondiente.',
    loadingAgenda: 'Cargando agenda…', loadingAssignments: 'Cargando asignaciones…', unavailable: 'No se pudieron cargar los datos reales.', retry: 'Intentar de nuevo',
    emptyAgenda: 'Todavía no hay reuniones en la agenda.', emptyAssignments: 'Todavía no hay asignaciones.', slots: 'partes', slot: 'parte',
    draft: 'Borrador', published: 'Publicada', cancelled: 'Cancelada', archived: 'Archivada', assigned: 'Asignada', completed: 'Completada',
    student: 'Estudiante', assistant: 'Ayudante', role: 'Función', meeting: 'Reunión', noAssistant: 'Sin ayudante', realData: 'Datos reales', cancelledAssignment: 'Cancelada',
  },
} as const;

function dateLabel(meeting: MidweekMeetingDto, locale: Locale): string {
  const language = locale === 'en' ? 'en-GB' : locale;
  const instant = new Date(`${meeting.date}T00:00:00Z`);
  const date = Number.isFinite(instant.getTime())
    ? new Intl.DateTimeFormat(language, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(instant)
    : meeting.date;
  return `${date} · ${meeting.localTime}`;
}

export function MidweekWorkspace({ locale, section }: { locale: Locale; section: MidweekWorkspaceSection }) {
  const text = copy[locale];
  const [overview, setOverview] = useState<MidweekOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [people, setPeople] = useState<readonly PersonProfileDto[]>([]);
  const requestVersionRef = useRef(0);

  const load = async (signal?: AbortSignal) => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setLoadError(false);
    try {
      const nextOverview = await midweekApi.overview(signal);
      if (requestVersion === requestVersionRef.current && !signal?.aborted) setOverview(nextOverview);
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      if (requestVersion === requestVersionRef.current) setLoadError(true);
    } finally {
      if (requestVersion === requestVersionRef.current && !signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    void authenticationApi.current(controller.signal).then(async state => {
      if (state.status !== 'authenticated' || !state.session.capabilities.includes('schedule.write') || controller.signal.aborted) return;
      setCanWrite(true);
      try {
        const nextPeople = await peopleApi.list(controller.signal);
        if (!controller.signal.aborted) setPeople(nextPeople);
      } catch {
        // Writing controls remain available; person-dependent actions stay disabled.
      }
    });
    return () => controller.abort();
  }, []);

  const refresh = async () => { await load(); };
  const meetingsById = useMemo(() => new Map((overview?.meetings ?? []).map(meeting => [meeting.id, meeting])), [overview]);
  const assignmentCount = (overview?.studentAssignments.length ?? 0) + (overview?.nonStudentAssignments.length ?? 0);
  const title = section === 'agenda' ? text.agenda : text.assignments;
  const subtitle = section === 'agenda' ? text.agendaSubtitle : text.assignmentsSubtitle;
  const loadingText = section === 'agenda' ? text.loadingAgenda : text.loadingAssignments;

  const stateLabel = (state: string): string => {
    if (state === 'draft') return text.draft;
    if (state === 'published') return text.published;
    if (state === 'archived') return text.archived;
    if (state === 'completed') return text.completed;
    if (state === 'assigned') return text.assigned;
    return section === 'assignments' ? text.cancelledAssignment : text.cancelled;
  };

  const stateColor = (state: string): string | undefined => {
    if (state === 'published' || state === 'completed') return 'success';
    if (state === 'cancelled') return 'warning';
    if (state === 'assigned') return 'processing';
    return undefined;
  };

  return <section aria-labelledby={`midweek-${section}-title`}>
    <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 760, flex: '1 1 420px' }}>
            <Typography.Text type="secondary" strong style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 12 }}>{text.realData}</Typography.Text>
            <Typography.Title level={2} id={`midweek-${section}-title`} style={{ marginBlock: '4px 0' }}>{title}</Typography.Title>
            <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 0 }}>{subtitle}</Typography.Paragraph>
          </div>
          <Space wrap>
            {!loading && !loadError && overview ? <Tag>{section === 'agenda' ? overview.meetings.length : assignmentCount}</Tag> : null}
            {canWrite && section === 'agenda' ? <CreateMidweekMeetingControl locale={locale} onChanged={refresh} /> : null}
          </Space>
        </div>
      </Card>

      {loadError ? <Alert type="warning" showIcon title={text.unavailable} action={<Button size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>} /> : null}
      {loading ? <div role="status" aria-live="polite" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingBlock: 56 }}><Spin size="small" /><Typography.Text type="secondary">{loadingText}</Typography.Text></div> : null}

      {!loading && !loadError && overview && section === 'agenda' && overview.meetings.length === 0 ? <Card><Empty description={text.emptyAgenda}>{canWrite ? <CreateMidweekMeetingControl locale={locale} onChanged={refresh} /> : null}</Empty></Card> : null}
      {!loading && !loadError && overview && section === 'agenda' && overview.meetings.length > 0 ? <Row gutter={[16, 16]}>{overview.meetings.map(meeting => <Col xs={24} md={12} xl={8} key={meeting.id}><Card style={{ height: '100%' }}>
        <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
            <div><Typography.Title level={4} style={{ marginBlock: 0 }}>{dateLabel(meeting, locale)}</Typography.Title><Typography.Text type="secondary">{meeting.timezone}</Typography.Text></div>
            <Tag color={stateColor(meeting.state)}>{stateLabel(meeting.state)}</Tag>
          </div>
          <Divider style={{ marginBlock: 0 }} />
          <Typography.Text type="secondary">{meeting.slots.length} {meeting.slots.length === 1 ? text.slot : text.slots}</Typography.Text>
          {canWrite ? <MidweekMeetingControls locale={locale} meeting={meeting} people={people} onChanged={refresh} /> : meeting.slots.length ? <Space orientation="vertical" size="small">{meeting.slots.map(slot => <Typography.Text key={slot.id}>{slot.position + 1}. {slot.titleKey} · {slot.durationMinutes} min</Typography.Text>)}</Space> : null}
        </Space>
      </Card></Col>)}</Row> : null}

      {!loading && !loadError && overview && section === 'assignments' && assignmentCount === 0 ? <Card><Empty description={text.emptyAssignments} /></Card> : null}
      {!loading && !loadError && overview && section === 'assignments' && assignmentCount > 0 ? <Space orientation="vertical" size="middle" style={{ display: 'flex' }}>
        {overview.studentAssignments.map(assignment => {
          const meeting = meetingsById.get(assignment.meetingId);
          return <Card key={`student-${assignment.id}`}>
            <Space orientation="vertical" size="small" style={{ display: 'flex' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div><Typography.Title level={4} style={{ marginBlock: 0 }}>{assignment.studentDisplayName}</Typography.Title><Typography.Text type="secondary">{text.student}{assignment.assistantDisplayName ? ` · ${text.assistant}: ${assignment.assistantDisplayName}` : ` · ${text.noAssistant}`}</Typography.Text></div>
                <Tag color={stateColor(assignment.state)}>{stateLabel(assignment.state)}</Tag>
              </div>
              {meeting ? <Typography.Text type="secondary">{text.meeting}: {dateLabel(meeting, locale)}</Typography.Text> : null}
              {canWrite ? <StudentAssignmentControls locale={locale} assignment={assignment} people={people} onChanged={refresh} /> : null}
            </Space>
          </Card>;
        })}
        {overview.nonStudentAssignments.map(assignment => {
          const meeting = meetingsById.get(assignment.meetingId);
          return <Card key={`role-${assignment.id}`}>
            <Space orientation="vertical" size="small" style={{ display: 'flex' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div><Typography.Title level={4} style={{ marginBlock: 0 }}>{assignment.personDisplayName}</Typography.Title><Typography.Text type="secondary">{text.role}: {assignment.role}</Typography.Text></div>
                <Tag color={stateColor(assignment.state)}>{stateLabel(assignment.state)}</Tag>
              </div>
              {meeting ? <Typography.Text type="secondary">{text.meeting}: {dateLabel(meeting, locale)}</Typography.Text> : null}
              {canWrite ? <NonStudentAssignmentControls locale={locale} assignment={assignment} people={people} onChanged={refresh} /> : null}
            </Space>
          </Card>;
        })}
      </Space> : null}
    </Space>
  </section>;
}
