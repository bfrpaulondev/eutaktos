import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress } from '@mui/material';
import { midweekApi, type MidweekOverviewDto } from './lib/midweekApi';
import { peopleApi, type PersonProfileDto } from './lib/peopleApi';
import { responsibilitiesApi, type ResponsibilityDto } from './lib/responsibilitiesApi';
import type { Preferences } from './lib/preferences';
import { Stack, Typography } from './ui/MuiCompat';

type Locale = Preferences['locale'];
type QueryState<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'error' };

export interface ProductionDashboardSummary {
  activePeople: number;
  activeResponsibilities: number;
  assignedParts: number;
  nextMeeting?: Readonly<{ date: string; localTime: string; state: 'draft' | 'published' }>;
}

export function buildProductionDashboardSummary(
  people: readonly PersonProfileDto[],
  responsibilities: readonly ResponsibilityDto[],
  midweek: MidweekOverviewDto,
  now = new Date(),
): ProductionDashboardSummary {
  const today = `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const nextMeeting = [...midweek.meetings]
    .filter(meeting => (meeting.state === 'draft' || meeting.state === 'published') && meeting.date >= today)
    .sort((a, b) => `${a.date}T${a.localTime}`.localeCompare(`${b.date}T${b.localTime}`))[0];
  const activeResponsibilities = responsibilities.filter(item => !item.endsAt || Date.parse(item.endsAt) > now.getTime()).length;
  const assignedParts = midweek.studentAssignments.filter(item => item.state === 'assigned').length
    + midweek.nonStudentAssignments.filter(item => item.state === 'assigned').length;

  return Object.freeze({
    activePeople: people.filter(person => person.active).length,
    activeResponsibilities,
    assignedParts,
    ...(nextMeeting ? { nextMeeting: Object.freeze({ date: nextMeeting.date, localTime: nextMeeting.localTime, state: nextMeeting.state === 'published' ? 'published' as const : 'draft' as const }) } : {}),
  });
}

export function isCurrentDashboardRequest(requestVersion: number, currentVersion: number, aborted: boolean): boolean {
  return requestVersion === currentVersion && !aborted;
}

const copy = {
  'pt-PT': {
    loading: 'A carregar dados reais de produção…', ready: 'Dados de produção ligados', degraded: 'Alguns dados de produção estão temporariamente indisponíveis', retry: 'Tentar novamente',
    people: 'Pessoas ativas', responsibilities: 'Responsabilidades ativas', assignments: 'Designações ativas', nextMeeting: 'Próxima reunião', noMeeting: 'Nenhuma reunião futura', draft: 'Rascunho', published: 'Publicada',
  },
  en: {
    loading: 'Loading real production data…', ready: 'Production data connected', degraded: 'Some production data is temporarily unavailable', retry: 'Try again',
    people: 'Active people', responsibilities: 'Active responsibilities', assignments: 'Active assignments', nextMeeting: 'Next meeting', noMeeting: 'No upcoming meeting', draft: 'Draft', published: 'Published',
  },
  es: {
    loading: 'Cargando datos reales de producción…', ready: 'Datos de producción conectados', degraded: 'Algunos datos de producción no están disponibles temporalmente', retry: 'Intentar de nuevo',
    people: 'Personas activas', responsibilities: 'Responsabilidades activas', assignments: 'Asignaciones activas', nextMeeting: 'Próxima reunión', noMeeting: 'No hay reunión futura', draft: 'Borrador', published: 'Publicada',
  },
} as const;

export function ProductionDashboard({ locale }: { locale: Locale }) {
  const [people, setPeople] = useState<QueryState<readonly PersonProfileDto[]>>({ status: 'loading' });
  const [responsibilities, setResponsibilities] = useState<QueryState<readonly ResponsibilityDto[]>>({ status: 'loading' });
  const [midweek, setMidweek] = useState<QueryState<MidweekOverviewDto>>({ status: 'loading' });
  const requestVersionRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const text = copy[locale];

  const load = async () => {
    const requestVersion = ++requestVersionRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setPeople({ status: 'loading' });
    setResponsibilities({ status: 'loading' });
    setMidweek({ status: 'loading' });

    const accept = () => isCurrentDashboardRequest(requestVersion, requestVersionRef.current, controller.signal.aborted);
    await Promise.all([
      peopleApi.list(controller.signal)
        .then(value => { if (accept()) setPeople({ status: 'ready', value }); })
        .catch(() => { if (accept()) setPeople({ status: 'error' }); }),
      responsibilitiesApi.list(controller.signal)
        .then(value => { if (accept()) setResponsibilities({ status: 'ready', value }); })
        .catch(() => { if (accept()) setResponsibilities({ status: 'error' }); }),
      midweekApi.overview(controller.signal)
        .then(value => { if (accept()) setMidweek({ status: 'ready', value }); })
        .catch(() => { if (accept()) setMidweek({ status: 'error' }); }),
    ]);
  };

  useEffect(() => {
    void load();
    return () => {
      requestVersionRef.current += 1;
      controllerRef.current?.abort();
    };
  }, []);

  const loading = people.status === 'loading' || responsibilities.status === 'loading' || midweek.status === 'loading';
  const failed = [people, responsibilities, midweek].filter(item => item.status === 'error').length;
  const summary = useMemo(() => {
    if (people.status !== 'ready' || responsibilities.status !== 'ready' || midweek.status !== 'ready') return undefined;
    return buildProductionDashboardSummary(people.value, responsibilities.value, midweek.value);
  }, [midweek, people, responsibilities]);

  if (loading && !summary) {
    return <Card><CardContent><Stack direction="row" spacing={1.5} alignItems="center" role="status" aria-live="polite"><CircularProgress size={22} /><Typography>{text.loading}</Typography></Stack></CardContent></Card>;
  }

  if (!summary) {
    return <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>}><Typography fontWeight={700}>{text.degraded}</Typography></Alert>;
  }

  const meeting = summary.nextMeeting;
  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} alignItems={{ sm: 'center' }}>
      <Typography variant="h3">{text.ready}</Typography>
      <Chip label={failed === 0 ? text.ready : text.degraded} color={failed === 0 ? 'success' : 'warning'} variant="outlined" />
    </Stack>
    {failed > 0 ? <Alert severity="warning" action={<Button color="inherit" size="small" disabled={loading} onClick={() => void load()}>{text.retry}</Button>}>{text.degraded}</Alert> : null}
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', lg: 'repeat(4, minmax(0,1fr))' }, gap: 1.5 }}>
      <MetricCard label={text.people} value={summary.activePeople} />
      <MetricCard label={text.responsibilities} value={summary.activeResponsibilities} />
      <MetricCard label={text.assignments} value={summary.assignedParts} />
      <Card><CardContent><Typography variant="overline" color="text.secondary">{text.nextMeeting}</Typography>{meeting ? <><Typography variant="h5">{meeting.date} · {meeting.localTime}</Typography><Typography variant="body2" color="text.secondary">{meeting.state === 'published' ? text.published : text.draft}</Typography></> : <Typography variant="h6">{text.noMeeting}</Typography>}</CardContent></Card>
    </Box>
  </Stack>;
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return <Card><CardContent><Typography variant="overline" color="text.secondary">{label}</Typography><Typography variant="h3">{value}</Typography></CardContent></Card>;
}
