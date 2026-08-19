import { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  ThemeProvider,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { SectionWorkspace } from './SectionWorkspace';
import { DEFAULT_PREFERENCES, normalizePreferences, type PaletteId, type Preferences } from './lib/preferences';
import { buildEutaktosTheme, EUTAKTOS_PALETTES } from './theme';

const STORAGE_KEY = 'eutaktos.preferences.v2';

type Section = 'home' | 'agenda' | 'assignments' | 'people' | 'preferences';

const copy = {
  'pt-PT': {
    skip: 'Saltar para o conteúdo principal', home: 'Início', agenda: 'Agenda', assignments: 'Designações', people: 'Pessoas', prefs: 'Preferências',
    eyebrow: 'Quarta-feira, 19 de agosto', title: 'Tudo em boa ordem.', subtitle: 'O que precisa da tua atenção aparece primeiro, sem ruído e sem menus cansativos.',
    privacy: 'Privacidade primeiro', prepare: 'Preparar próxima reunião', focus: 'Agora', nextAssignment: 'Próxima designação', gems: 'Pérolas Espirituais', midweek: 'Reunião do meio da semana · 20:00', confirmed: 'Confirmada',
    pending: 'Por confirmar', pendingSub: 'designações', openRoles: 'Por preencher', openRolesSub: 'função esta semana', reports: 'Relatórios em falta', reportsSub: 'mês atual',
    smart: 'Smart Assign', balance: 'Equilíbrio da Escola', fairnessText: 'Há irmãos elegíveis que estão há bastante mais tempo sem uma leitura. O sistema apresenta razões transparentes; o responsável decide.',
    candidate: 'Elegível para leitura', days: 'dias', generate: 'Gerar proposta equilibrada', human: 'Recomendação objetiva. Decisão humana.',
    ready: 'Cobertura da reunião', almostReady: 'Quase pronta', sound: 'Som', video: 'Vídeo', microphone: 'Microfone 1', attendant: 'Indicador 2', missing: 'Ainda sem designação',
    personal: 'Só para ti', palette: 'Paleta', density: 'Densidade', contrast: 'Contraste elevado', motion: 'Reduzir movimento', transparency: 'Reduzir transparência', language: 'Idioma', comfortable: 'Confortável', compact: 'Compacta',
    palettes: ['Neutro Clássico', 'Neutro Quente', 'Monocromático + Verde', 'Azul Pastel', 'Dark Mode Minimalista', 'Pastel Suave'],
  },
  en: {
    skip: 'Skip to main content', home: 'Home', agenda: 'Agenda', assignments: 'Assignments', people: 'People', prefs: 'Preferences',
    eyebrow: 'Wednesday, 19 August', title: 'Everything in good order.', subtitle: 'What needs your attention comes first, without noise or tiring menus.',
    privacy: 'Privacy first', prepare: 'Prepare next meeting', focus: 'Now', nextAssignment: 'Next assignment', gems: 'Spiritual Gems', midweek: 'Midweek meeting · 20:00', confirmed: 'Confirmed',
    pending: 'Awaiting confirmation', pendingSub: 'assignments', openRoles: 'Unfilled', openRolesSub: 'role this week', reports: 'Missing reports', reportsSub: 'current month',
    smart: 'Smart Assign', balance: 'School balance', fairnessText: 'Some eligible brothers have gone significantly longer without a reading. The system shows transparent reasons; the responsible brother decides.',
    candidate: 'Eligible for reading', days: 'days', generate: 'Generate balanced proposal', human: 'Objective recommendation. Human decision.',
    ready: 'Meeting coverage', almostReady: 'Almost ready', sound: 'Sound', video: 'Video', microphone: 'Microphone 1', attendant: 'Attendant 2', missing: 'Not assigned yet',
    personal: 'Just for you', palette: 'Palette', density: 'Density', contrast: 'High contrast', motion: 'Reduce motion', transparency: 'Reduce transparency', language: 'Language', comfortable: 'Comfortable', compact: 'Compact',
    palettes: ['Neutral Classic', 'Neutral Warm', 'Monochrome + Green', 'Pastel Blue', 'Minimal Dark', 'Soft Pastel'],
  },
  es: {
    skip: 'Saltar al contenido principal', home: 'Inicio', agenda: 'Agenda', assignments: 'Asignaciones', people: 'Personas', prefs: 'Preferencias',
    eyebrow: 'Miércoles, 19 de agosto', title: 'Todo en buen orden.', subtitle: 'Lo que necesita tu atención aparece primero, sin ruido ni menús agotadores.',
    privacy: 'Privacidad primero', prepare: 'Preparar próxima reunión', focus: 'Ahora', nextAssignment: 'Próxima asignación', gems: 'Perlas espirituales', midweek: 'Reunión de entre semana · 20:00', confirmed: 'Confirmada',
    pending: 'Por confirmar', pendingSub: 'asignaciones', openRoles: 'Sin asignar', openRolesSub: 'función esta semana', reports: 'Informes pendientes', reportsSub: 'mes actual',
    smart: 'Smart Assign', balance: 'Equilibrio de la Escuela', fairnessText: 'Hay hermanos elegibles que llevan mucho más tiempo sin una lectura. El sistema muestra razones transparentes; el responsable decide.',
    candidate: 'Elegible para lectura', days: 'días', generate: 'Generar propuesta equilibrada', human: 'Recomendación objetiva. Decisión humana.',
    ready: 'Cobertura de la reunión', almostReady: 'Casi lista', sound: 'Sonido', video: 'Vídeo', microphone: 'Micrófono 1', attendant: 'Acomodador 2', missing: 'Aún sin asignar',
    personal: 'Solo para ti', palette: 'Paleta', density: 'Densidad', contrast: 'Contraste alto', motion: 'Reducir movimiento', transparency: 'Reducir transparencia', language: 'Idioma', comfortable: 'Cómoda', compact: 'Compacta',
    palettes: ['Neutro Clásico', 'Neutro Cálido', 'Monocromático + Verde', 'Azul Pastel', 'Modo Oscuro Minimalista', 'Pastel Suave'],
  },
} as const;

const paletteIds = Object.keys(EUTAKTOS_PALETTES) as PaletteId[];

function loadPreferences(): Preferences {
  try {
    const next = localStorage.getItem(STORAGE_KEY);
    if (next) return normalizePreferences(JSON.parse(next));
    const legacy = localStorage.getItem('eutaktos.preferences.v1');
    return normalizePreferences(legacy ? JSON.parse(legacy) : null);
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const theme = useMemo(() => buildEutaktosTheme(preferences), [preferences]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.palette = preferences.paletteId;
  }, [preferences]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell preferences={preferences} setPreferences={setPreferences} />
    </ThemeProvider>
  );
}

interface AppShellProps {
  preferences: Preferences;
  setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
}

function AppShell({ preferences, setPreferences }: AppShellProps) {
  const [section, setSection] = useState<Section>('home');
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const text = copy[preferences.locale];

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences(current => ({ ...current, [key]: value }));

  const goToSection = (next: Section) => {
    setSection(next);
    window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  };

  const nav: Array<[Section, string, string]> = [
    ['home', text.home, '⌂'],
    ['agenda', text.agenda, '▦'],
    ['assignments', text.assignments, '✓'],
    ['people', text.people, '◌'],
    ['preferences', text.prefs, '⚙'],
  ];

  const glass = {
    borderRadius: { xs: 3, md: 4 },
    overflow: 'hidden',
  } as const;

  return (
    <Box sx={{ minHeight: '100dvh', pb: { xs: 11, md: 0 } }}>
      <Button className="skip-link" href="#main" variant="contained" size="small">{text.skip}</Button>

      {desktop ? (
        <Paper component="aside" aria-label="Navegação principal" sx={{ position: 'fixed', inset: 16, right: 'auto', width: 236, p: 1.5, zIndex: 10, ...glass }}>
          <Stack sx={{ height: '100%' }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, mb: 1 }}>
              <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 38, height: 38, fontWeight: 800 }}>E</Avatar>
              <Box><Typography fontWeight={800}>Eutaktos</Typography><Typography variant="caption" color="text.secondary">Everything in good order.</Typography></Box>
            </Stack>
            <Stack component="nav" spacing={0.5} sx={{ flex: 1 }}>
              {nav.map(([key, label, icon]) => (
                <Button key={key} onClick={() => goToSection(key)} aria-current={section === key ? 'page' : undefined} variant={section === key ? 'contained' : 'text'} color={section === key ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start', gap: 1.25 }}>
                  <Box component="span" aria-hidden="true" sx={{ width: 22, textAlign: 'center' }}>{icon}</Box>{label}
                </Button>
              ))}
            </Stack>
            <Chip label={text.privacy} size="small" variant="outlined" sx={{ m: 1, justifyContent: 'flex-start' }} />
          </Stack>
        </Paper>
      ) : (
        <Paper component="nav" aria-label="Navegação principal" sx={{ position: 'fixed', zIndex: 20, left: 8, right: 8, bottom: 'max(8px, env(safe-area-inset-bottom))', p: 0.5, borderRadius: 4 }}>
          <Stack direction="row" justifyContent="space-between">
            {nav.map(([key, label, icon]) => (
              <Button key={key} onClick={() => goToSection(key)} aria-current={section === key ? 'page' : undefined} color={section === key ? 'primary' : 'inherit'} sx={{ minWidth: 0, flex: 1, px: 0.5, display: 'grid', gap: 0.25, fontSize: 11 }}>
                <Typography component="span" aria-hidden="true" sx={{ fontSize: 18, lineHeight: 1 }}>{icon}</Typography>{label}
              </Button>
            ))}
          </Stack>
        </Paper>
      )}

      <Box component="main" id="main" tabIndex={-1} sx={{ ml: { md: '268px' }, width: { md: 'calc(100% - 268px)' }, px: { xs: 1.5, sm: 2.5, md: 2, lg: 4 }, py: { xs: 1.5, md: 2 }, maxWidth: 1540 }}>
        <Paper component="header" sx={{ p: { xs: 2.25, sm: 3, lg: 4 }, mb: 2, ...glass }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
            <Box>
              <Typography variant="overline" color="text.secondary" fontWeight={800}>{text.eyebrow}</Typography>
              <Typography variant="h1" sx={{ fontSize: { xs: '2.35rem', sm: '3.1rem', lg: '4rem' }, maxWidth: 760 }}>{text.title}</Typography>
              <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 720, fontSize: { xs: 15, sm: 17 } }}>{text.subtitle}</Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Chip label={text.privacy} variant="outlined" />
              <Button variant="contained" onClick={() => goToSection('agenda')}>{text.prepare} →</Button>
            </Stack>
          </Stack>
        </Paper>

        {section === 'home' ? (
          <HomeDashboard text={text} goToSection={goToSection} preferences={preferences} update={update} />
        ) : section === 'preferences' ? (
          <PreferencesPanel text={text} preferences={preferences} update={update} />
        ) : (
          <SectionWorkspace locale={preferences.locale} section={section} />
        )}
      </Box>
    </Box>
  );
}

interface HomeDashboardProps {
  text: (typeof copy)[keyof typeof copy];
  goToSection: (section: Section) => void;
  preferences: Preferences;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

function HomeDashboard({ text, goToSection, preferences, update }: HomeDashboardProps) {
  const metrics = [[text.pending, '2', text.pendingSub], [text.openRoles, '1', text.openRolesSub], [text.reports, '3', text.reportsSub]] as const;
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 2 }}>
        {metrics.map(([label, value, detail]) => <Card key={label}><CardContent><Typography variant="overline" color="text.secondary">{label}</Typography><Typography variant="h3" sx={{ my: 0.5 }}>{value}</Typography><Typography variant="body2" color="text.secondary">{detail}</Typography></CardContent></Card>)}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2 }}>
        <Card><CardContent><Stack spacing={2}><Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="overline" color="text.secondary">{text.nextAssignment}</Typography><Typography variant="h4">{text.gems}</Typography></Box><Chip label={text.confirmed} color="primary" variant="outlined" /></Stack><Typography color="text.secondary">{text.midweek}</Typography><Button variant="text" onClick={() => goToSection('agenda')} sx={{ alignSelf: 'flex-start' }}>{text.agenda} →</Button></Stack></CardContent></Card>

        <Card><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="overline" color="text.secondary">{text.smart}</Typography><Typography variant="h4">{text.balance}</Typography></Box><Chip label="92%" color="primary" /></Stack><Typography color="text.secondary">{text.fairnessText}</Typography>{[['C', 'Carlos', 126], ['A', 'André', 98]].map(([initial, name, days]) => <Paper key={name} sx={{ p: 1.25 }}><Stack direction="row" alignItems="center" justifyContent="space-between"><Stack direction="row" spacing={1} alignItems="center"><Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', color: 'primary.contrastText' }}>{initial}</Avatar><Typography fontWeight={700}>{name}</Typography></Stack><Typography fontWeight={800}>{days} {text.days}</Typography></Stack></Paper>)}<Button variant="contained" onClick={() => goToSection('assignments')}>{text.generate}</Button><Typography variant="caption" color="text.secondary">{text.human}</Typography></Stack></CardContent></Card>

        <Card><CardContent><Stack spacing={1.5}><Stack direction="row" justifyContent="space-between"><Box><Typography variant="overline" color="text.secondary">{text.ready}</Typography><Typography variant="h4">{text.almostReady}</Typography></Box><Chip label="75%" /></Stack><LinearProgress variant="determinate" value={75} sx={{ height: 8, borderRadius: 999 }} />{[[text.sound, 'Bruno'], [text.video, 'Carlos'], [text.microphone, 'André'], [text.attendant, text.missing]].map(([role, person]) => <Stack key={role} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderBottom: 1, borderColor: 'divider' }}><Typography color="text.secondary">{role}</Typography><Typography fontWeight={700}>{person}</Typography></Stack>)}</Stack></CardContent></Card>

        <PreferencesCard text={text} preferences={preferences} update={update} />
      </Box>
    </Stack>
  );
}

interface PreferencesProps {
  text: (typeof copy)[keyof typeof copy];
  preferences: Preferences;
  update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
}

function PreferencesCard(props: PreferencesProps) {
  return <Card><CardContent><Typography variant="overline" color="text.secondary">{props.text.personal}</Typography><Typography variant="h4" sx={{ mb: 2 }}>{props.text.prefs}</Typography><PreferenceControls {...props} /></CardContent></Card>;
}

function PreferencesPanel(props: PreferencesProps) {
  return <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 880 }}><Typography variant="h3" sx={{ mb: 0.5 }}>{props.text.prefs}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{props.text.personal}</Typography><PreferenceControls {...props} /></Paper>;
}

function PreferenceControls({ text, preferences, update }: PreferencesProps) {
  return (
    <Stack spacing={2}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
        <FormControl fullWidth><InputLabel>{text.language}</InputLabel><Select label={text.language} value={preferences.locale} onChange={event => update('locale', event.target.value as Preferences['locale'])}><MenuItem value="pt-PT">Português</MenuItem><MenuItem value="en">English</MenuItem><MenuItem value="es">Español</MenuItem></Select></FormControl>
        <FormControl fullWidth><InputLabel>{text.palette}</InputLabel><Select label={text.palette} value={preferences.paletteId} onChange={event => update('paletteId', event.target.value as PaletteId)}>{paletteIds.map((id, index) => <MenuItem value={id} key={id}><Stack direction="row" spacing={1} alignItems="center"><Stack direction="row" spacing={0.35}>{EUTAKTOS_PALETTES[id].colors.map(color => <Box key={color} sx={{ width: 11, height: 11, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />)}</Stack><span>{index + 1}. {text.palettes[index]}</span></Stack></MenuItem>)}</Select></FormControl>
        <FormControl fullWidth><InputLabel>{text.density}</InputLabel><Select label={text.density} value={preferences.density} onChange={event => update('density', event.target.value as Preferences['density'])}><MenuItem value="comfortable">{text.comfortable}</MenuItem><MenuItem value="compact">{text.compact}</MenuItem></Select></FormControl>
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={0.5}>
        <FormControlLabel control={<Switch checked={preferences.highContrast} onChange={(_, checked) => update('highContrast', checked)} />} label={text.contrast} />
        <FormControlLabel control={<Switch checked={preferences.reducedMotion} onChange={(_, checked) => update('reducedMotion', checked)} />} label={text.motion} />
        <FormControlLabel control={<Switch checked={preferences.reducedTransparency} onChange={(_, checked) => update('reducedTransparency', checked)} />} label={text.transparency} />
      </Stack>
    </Stack>
  );
}
