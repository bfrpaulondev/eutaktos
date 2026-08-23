import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Divider, Paper } from '@mui/material';
import { midweekApi, type MidweekMeetingDto, type MidweekOverviewDto } from './lib/midweekApi';
import { authenticationApi } from './lib/authApi';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import { CreateMidweekMeetingControl, MidweekMeetingControls, NonStudentAssignmentControls, StudentAssignmentControls } from './MidweekAuthoringControls';
import { Stack, Typography } from './ui/MuiCompat';

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
    setLoading(true); setLoadError(false);
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
      } catch { /* writing controls remain available; person-dependent actions stay disabled */ }
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

  return <Box component="section" aria-labelledby={`midweek-${section}-title`}>
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2, borderRadius: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={2} alignItems={{ sm: 'flex-start' }}>
        <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.realData}</Typography><Typography variant="h2" id={`midweek-${section}-title`} sx={{ fontSize: { xs: '2rem', sm: '2.6rem' } }}>{title}</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>{subtitle}</Typography></Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>{!loading && !loadError && overview ? <Chip label={section === 'agenda' ? String(overview.meetings.length) : String(assignmentCount)} variant="outlined" color="info" /> : null}{canWrite && section === 'agenda' ? <CreateMidweekMeetingControl locale={locale} onChanged={refresh} /> : null}</Stack>
      </Stack>
    </Paper>

    {loadError ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>}>{text.unavailable}</Alert> : null}
    {loading ? <Stack direction="row" alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 7 }} role="status" aria-live="polite"><CircularProgress size={24} /><Typography color="text.secondary">{loadingText}</Typography></Stack> : null}

    {!loading && !loadError && overview && section === 'agenda' && overview.meetings.length === 0 ? <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3, boxShadow: 'none', bgcolor: 'transparent' }}><Stack spacing={2} alignItems="center"><Typography color="text.secondary">{text.emptyAgenda}</Typography>{canWrite ? <CreateMidweekMeetingControl locale={locale} onChanged={refresh} /> : null}</Stack></Paper> : null}
    {!loading && !loadError && overview && section === 'agenda' && overview.meetings.length > 0 ? <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5 }}>{overview.meetings.map(meeting => <Card component="article" key={meeting.id}><CardContent><Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" gap={1.5} alignItems="flex-start"><Box><Typography variant="h5" fontWeight={750}>{dateLabel(meeting, locale)}</Typography><Typography variant="body2" color="text.secondary">{meeting.timezone}</Typography></Box><Chip size="small" variant="outlined" label={stateLabel(meeting.state)} color={meeting.state === 'published' ? 'success' : meeting.state === 'cancelled' ? 'warning' : 'default'} /></Stack>
      <Divider /><Typography variant="body2" color="text.secondary">{meeting.slots.length} {meeting.slots.length === 1 ? text.slot : text.slots}</Typography>
      {canWrite ? <MidweekMeetingControls locale={locale} meeting={meeting} people={people} onChanged={refresh} /> : meeting.slots.length ? <Stack spacing={.75}>{meeting.slots.map(slot => <Typography key={slot.id} variant="body2">{slot.position + 1}. {slot.titleKey} · {slot.durationMinutes} min</Typography>)}</Stack> : null}
    </Stack></CardContent></Card>)}</Box> : null}

    {!loading && !loadError && overview && section === 'assignments' && assignmentCount === 0 ? <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3, boxShadow: 'none', bgcolor: 'transparent' }}><Typography color="text.secondary">{text.emptyAssignments}</Typography></Paper> : null}
    {!loading && !loadError && overview && section === 'assignments' && assignmentCount > 0 ? <Stack spacing={1.25}>
      {overview.studentAssignments.map(assignment => { const meeting = meetingsById.get(assignment.meetingId); return <Card component="article" key={`student-${assignment.id}`}><CardContent><Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="h5" fontWeight={750}>{assignment.studentDisplayName}</Typography><Typography variant="body2" color="text.secondary">{text.student}{assignment.assistantDisplayName ? ` · ${text.assistant}: ${assignment.assistantDisplayName}` : ` · ${text.noAssistant}`}</Typography></Box><Chip size="small" variant="outlined" label={stateLabel(assignment.state)} color={assignment.state === 'assigned' ? 'info' : assignment.state === 'completed' ? 'success' : 'default'} /></Stack>
        {meeting ? <Typography variant="body2" color="text.secondary">{text.meeting}: {dateLabel(meeting, locale)}</Typography> : null}{canWrite ? <StudentAssignmentControls locale={locale} assignment={assignment} people={people} onChanged={refresh} /> : null}
      </Stack></CardContent></Card>; })}
      {overview.nonStudentAssignments.map(assignment => { const meeting = meetingsById.get(assignment.meetingId); return <Card component="article" key={`role-${assignment.id}`}><CardContent><Stack spacing={1.25}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1}><Box><Typography variant="h5" fontWeight={750}>{assignment.personDisplayName}</Typography><Typography variant="body2" color="text.secondary">{text.role}: {assignment.role}</Typography></Box><Chip size="small" variant="outlined" label={stateLabel(assignment.state)} color={assignment.state === 'assigned' ? 'info' : assignment.state === 'completed' ? 'success' : 'default'} /></Stack>
        {meeting ? <Typography variant="body2" color="text.secondary">{text.meeting}: {dateLabel(meeting, locale)}</Typography> : null}{canWrite ? <NonStudentAssignmentControls locale={locale} assignment={assignment} people={people} onChanged={refresh} /> : null}
      </Stack></CardContent></Card>; })}
    </Stack> : null}
  </Box>;
}