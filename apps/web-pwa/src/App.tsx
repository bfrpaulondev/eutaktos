import { lazy, Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type Ref, type SetStateAction } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CssBaseline,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  ThemeProvider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { PwaConnectionStatus } from './PwaConnectionStatus';
import { PwaUpdateRecovery } from './PwaUpdateRecovery';
import { SECTION_PATHS, sectionFromPath, type AppSection as Section } from './lib/navigation';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePaletteId,
  type PaletteId,
  type Preferences,
} from './lib/preferences';
import { buildEutaktosTheme, EUTAKTOS_PALETTES } from './theme';
import { Stack, Typography } from './ui/MuiCompat';

const SectionWorkspace = lazy(async () => {
  const module = await import('./SectionWorkspace');
  return { default: module.SectionWorkspace };
});

const STORAGE_KEY = 'eutaktos.preferences.v4';

const copy = {
  'pt-PT': {
    skip: 'Saltar para o conteúdo principal', navigation: 'Navegação principal', home: 'Início', agenda: 'Agenda', assignments: 'Designações', people: 'Pessoas', prefs: 'Preferências', more: 'Mais', close: 'Fechar', workspaceLoading: 'A carregar área…',
    eyebrow: 'O teu espaço de organização', title: 'Tudo em boa ordem.', subtitle: 'Encontra primeiro o que pede atenção, com contexto claro e sem ruído.', privacy: 'Privacidade primeiro', dataUnavailable: 'Dados de produção indisponíveis', dashboardUnavailableTitle: 'O painel aguarda dados reais', dashboardUnavailableDetail: 'As próximas reuniões, designações, tarefas, confirmações e alertas só serão apresentados quando as consultas de produção estiverem disponíveis. Nenhum dado demonstrativo é mostrado.', viewAgenda: 'Ver agenda',
    personal: 'As tuas escolhas', palette: 'Paleta', theme: 'Modo de cor', density: 'Densidade', textSize: 'Tamanho do texto', contrast: 'Contraste elevado', motion: 'Reduzir movimento', transparency: 'Reduzir transparência', language: 'Idioma', comfortable: 'Confortável', compact: 'Compacta',
    textSizes: { small: 'Pequeno', default: 'Padrão', large: 'Grande', 'extra-large': 'Muito grande' }, themes: { light: 'Claro', dark: 'Escuro', system: 'Sistema' }, palettes: ['Clássica', 'Acolhedora', 'Calma', 'Foco', 'Noturna', 'Alto contraste'],
  },
  en: {
    skip: 'Skip to main content', navigation: 'Primary navigation', home: 'Home', agenda: 'Agenda', assignments: 'Assignments', people: 'People', prefs: 'Preferences', more: 'More', close: 'Close', workspaceLoading: 'Loading area…',
    eyebrow: 'Your organization space', title: 'Everything in good order.', subtitle: 'Find what needs attention first, with clear context and no noise.', privacy: 'Privacy first', dataUnavailable: 'Production data unavailable', dashboardUnavailableTitle: 'The dashboard is waiting for real data', dashboardUnavailableDetail: 'Upcoming meetings, assignments, duties, confirmations and alerts will appear only when production queries are available. No demonstration data are shown.', viewAgenda: 'View agenda',
    personal: 'Your choices', palette: 'Palette', theme: 'Color mode', density: 'Density', textSize: 'Text size', contrast: 'High contrast', motion: 'Reduce motion', transparency: 'Reduce transparency', language: 'Language', comfortable: 'Comfortable', compact: 'Compact',
    textSizes: { small: 'Small', default: 'Default', large: 'Large', 'extra-large': 'Extra large' }, themes: { light: 'Light', dark: 'Dark', system: 'System' }, palettes: ['Classic', 'Welcoming', 'Calm', 'Focus', 'Night', 'High contrast'],
  },
  es: {
    skip: 'Saltar al contenido principal', navigation: 'Navegación principal', home: 'Inicio', agenda: 'Agenda', assignments: 'Asignaciones', people: 'Personas', prefs: 'Preferencias', more: 'Más', close: 'Cerrar', workspaceLoading: 'Cargando área…',
    eyebrow: 'Tu espacio de organización', title: 'Todo en buen orden.', subtitle: 'Encuentra primero lo que necesita atención, con contexto claro y sin ruido.', privacy: 'Privacidad primero', dataUnavailable: 'Datos de producción no disponibles', dashboardUnavailableTitle: 'El panel espera datos reales', dashboardUnavailableDetail: 'Las próximas reuniones, asignaciones, tareas, confirmaciones y alertas solo aparecerán cuando estén disponibles las consultas de producción. No se muestran datos de demostración.', viewAgenda: 'Ver agenda',
    personal: 'Tus elecciones', palette: 'Paleta', theme: 'Modo de color', density: 'Densidad', textSize: 'Tamaño del texto', contrast: 'Contraste alto', motion: 'Reducir movimiento', transparency: 'Reducir transparencia', language: 'Idioma', comfortable: 'Cómoda', compact: 'Compacta',
    textSizes: { small: 'Pequeño', default: 'Predeterminado', large: 'Grande', 'extra-large': 'Extra grande' }, themes: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }, palettes: ['Clásica', 'Acogedora', 'Calma', 'Foco', 'Nocturna', 'Alto contraste'],
  },
} as const;

export function getDashboardAvailability(locale: Preferences['locale']) {
  const text = copy[locale];
  return { title: text.dashboardUnavailableTitle, detail: text.dashboardUnavailableDetail };
}

type AppCopy = (typeof copy)[keyof typeof copy];
const paletteIds = Object.keys(EUTAKTOS_PALETTES) as PaletteId[];
const textSizes: Preferences['textSize'][] = ['small', 'default', 'large', 'extra-large'];
const navIcons: Record<Section, string> = { home: '⌂', agenda: '▦', assignments: '✓', people: '◌', preferences: '⚙' };

function loadPreferences(): Preferences {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizePreferences(JSON.parse(current));
    for (const key of ['eutaktos.preferences.v3', 'eutaktos.preferences.v2', 'eutaktos.preferences.v1']) {
      const stored = localStorage.getItem(key);
      if (stored) return normalizePreferences(JSON.parse(stored));
    }
    return DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const effectivePalette = resolvePaletteId(preferences.paletteId, preferences.colorMode, systemPrefersDark);
  const theme = useMemo(() => buildEutaktosTheme({ ...preferences, paletteId: effectivePalette }), [effectivePalette, preferences]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.documentElement.lang = preferences.locale;
    document.documentElement.dataset.palette = effectivePalette;
    document.documentElement.dataset.textSize = preferences.textSize;
    document.documentElement.dataset.colorMode = preferences.colorMode;
  }, [effectivePalette, preferences]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppShell preferences={preferences} setPreferences={setPreferences} />
      <PwaConnectionStatus locale={preferences.locale} />
      <PwaUpdateRecovery />
    </ThemeProvider>
  );
}

interface AppShellProps { preferences: Preferences; setPreferences: Dispatch<SetStateAction<Preferences>> }

function AppShell({ preferences, setPreferences }: AppShellProps) {
  const [section, setSection] = useState<Section>(() => sectionFromPath(window.location.pathname));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('md'));
  const text = copy[preferences.locale];
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const onPopState = () => {
      setSection(sectionFromPath(window.location.pathname));
      setMoreOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const label = text[section === 'preferences' ? 'prefs' : section];
    document.title = `Eutaktos — ${label}`;
  }, [section, text]);

  const closeMore = () => {
    setMoreOpen(false);
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  };
  const goToSection = (next: Section) => {
    const nextPath = SECTION_PATHS[next];
    if (window.location.pathname !== nextPath || window.location.search || window.location.hash) window.history.pushState({ section: next }, '', nextPath);
    setSection(next);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  };
  const nav: Section[] = ['home', 'agenda', 'assignments', 'people', 'preferences'];
  const mobileNav: Section[] = ['home', 'agenda', 'people'];

  return (
    <Box sx={{ minHeight: '100dvh', pb: { xs: 'calc(84px + env(safe-area-inset-bottom))', md: 0 } }}>
      <Button className="skip-link" href="#main" variant="contained" size="small">{text.skip}</Button>

      {desktop ? (
        <Paper component="aside" aria-label={text.navigation} sx={{ position: 'fixed', inset: 16, right: 'auto', width: 264, p: 1.25, zIndex: 10, borderRadius: 4, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.25, mb: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 42, height: 42, fontWeight: 800 }}>E</Avatar>
            <Box><Typography fontWeight={800}>Eutaktos</Typography><Typography variant="caption" color="text.secondary">{text.privacy}</Typography></Box>
          </Stack>
          <Stack component="nav" spacing={0.5} sx={{ flex: 1 }}>
            {nav.map(key => <NavigationButton key={key} active={section === key} icon={navIcons[key]} label={text[key === 'preferences' ? 'prefs' : key]} onClick={() => goToSection(key)} />)}
          </Stack>
          <Paper variant="outlined" sx={{ p: 1.25, m: 0.5, borderRadius: 2, boxShadow: 'none', bgcolor: 'transparent' }}>
            <Typography variant="caption" color="text.secondary">{text.dataUnavailable}</Typography>
            <Typography variant="caption" sx={{ mt: 0.25, display: 'block' }}>{text.privacy}</Typography>
          </Paper>
        </Paper>
      ) : (
        <Paper component="nav" aria-label={text.navigation} sx={{ position: 'fixed', zIndex: 20, left: 8, right: 8, bottom: 'max(8px, env(safe-area-inset-bottom))', px: 0.5, py: 0.65, borderRadius: 3 }}>
          <Stack direction="row" justifyContent="space-between">
            {mobileNav.map(key => <MobileNavigationButton key={key} active={section === key} icon={navIcons[key]} label={key === 'preferences' ? text.prefs : text[key]} onClick={() => goToSection(key)} />)}
            <MobileNavigationButton buttonRef={moreButtonRef} active={section === 'assignments' || section === 'preferences'} icon="•••" label={text.more} onClick={() => setMoreOpen(true)} />
          </Stack>
        </Paper>
      )}

      <Drawer anchor="bottom" open={moreOpen} onClose={closeMore} slotProps={{ paper: { sx: { borderTopLeftRadius: 24, borderTopRightRadius: 24, p: 2, pb: 'calc(16px + env(safe-area-inset-bottom))' } } }}>
        <Stack spacing={1.25} sx={{ maxWidth: 560, width: '100%', mx: 'auto' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">{text.more}</Typography><Button onClick={closeMore}>{text.close}</Button></Stack>
          <Divider />
          {(['assignments', 'preferences'] as const).map(key => <Button key={key} variant={section === key ? 'contained' : 'outlined'} startIcon={<span aria-hidden="true">{navIcons[key]}</span>} onClick={() => goToSection(key)} sx={{ justifyContent: 'flex-start' }}>{text[key === 'preferences' ? 'prefs' : key]}</Button>)}
        </Stack>
      </Drawer>

      <Box component="main" id="main" tabIndex={-1} sx={{ ml: { md: '296px' }, width: { md: 'calc(100% - 296px)' }, px: { xs: 1.5, sm: 2.5, lg: 4 }, py: { xs: 1.5, md: 2 }, maxWidth: 1640 }}>
        <Header text={text} onAgenda={() => goToSection('agenda')} />
        {section === 'home' ? <HomeDashboard text={text} preferences={preferences} update={update} /> : section === 'preferences' ? <PreferencesPanel text={text} preferences={preferences} update={update} /> : <Suspense fallback={<WorkspaceLoading label={text.workspaceLoading} />}><SectionWorkspace locale={preferences.locale} section={section} /></Suspense>}
      </Box>
    </Box>
  );
}

function NavigationButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return <Button onClick={onClick} aria-current={active ? 'page' : undefined} variant={active ? 'contained' : 'text'} color={active ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start', gap: 1.25, px: 1.5 }}><Box component="span" aria-hidden="true" sx={{ width: 22, textAlign: 'center' }}>{icon}</Box>{label}</Button>;
}

function MobileNavigationButton({ active, icon, label, onClick, buttonRef }: { active: boolean; icon: string; label: string; onClick: () => void; buttonRef?: Ref<HTMLButtonElement> }) {
  return <Button ref={buttonRef} onClick={onClick} aria-current={active ? 'page' : undefined} color={active ? 'primary' : 'inherit'} sx={{ minWidth: 0, flex: 1, px: 0.35, display: 'grid', gap: 0.15, fontSize: '0.68rem', lineHeight: 1.1, whiteSpace: 'normal' }}><Typography component="span" aria-hidden="true" sx={{ fontSize: 18, lineHeight: 1 }}>{icon}</Typography>{label}</Button>;
}

function WorkspaceLoading({ label }: { label: string }) { return <Box role="status" aria-live="polite" sx={{ py: 5, textAlign: 'center' }}><Typography color="text.secondary">{label}</Typography></Box>; }

function Header({ text, onAgenda }: { text: AppCopy; onAgenda: () => void }) {
  return <Paper component="header" sx={{ p: { xs: 2.25, sm: 3, lg: 4 }, mb: 2.5, borderRadius: { xs: 3, md: 4 } }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={{ xs: 2.5, lg: 4 }} alignItems={{ lg: 'center' }}>
        <Box sx={{ maxWidth: 760 }}><Typography variant="overline" color="primary.main">{text.eyebrow}</Typography><Typography variant="h1" sx={{ fontSize: { xs: '2.35rem', sm: '3.1rem', xl: '4rem' } }}>{text.title}</Typography><Typography color="text.secondary" sx={{ mt: 1, maxWidth: 680, fontSize: { xs: '0.98rem', sm: '1.05rem' } }}>{text.subtitle}</Typography></Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ flexShrink: 0 }}><Chip label={text.dataUnavailable} color="info" variant="outlined" /><Button variant="contained" onClick={onAgenda} sx={{ minWidth: { sm: 210 } }}>{text.viewAgenda}</Button></Stack>
      </Stack>
  </Paper>;
}

function HomeDashboard({ text, preferences, update }: { text: AppCopy; preferences: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void }) {
  const dashboard = getDashboardAvailability(preferences.locale);
  return <Stack spacing={2.5}>
    <Alert severity="info" role="status" aria-live="polite"><Typography variant="subtitle2" fontWeight={700}>{dashboard.title}</Typography><Typography variant="body2">{dashboard.detail}</Typography></Alert>
    <Box sx={{ maxWidth: 640 }}><PreferencesCard text={text} preferences={preferences} update={update} /></Box>
  </Stack>;
}

function PreferencesCard(props: PreferenceProps) { return <Card><CardContent><Typography variant="overline" color="text.secondary">{props.text.personal}</Typography><Typography variant="h4" sx={{ mb: 2 }}>{props.text.prefs}</Typography><PreferenceControls {...props} compact /></CardContent></Card>; }
function PreferencesPanel(props: PreferenceProps) { return <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 980, borderRadius: 3 }}><Typography variant="overline" color="primary.main">{props.text.personal}</Typography><Typography variant="h3" sx={{ mb: 0.5 }}>{props.text.prefs}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{props.text.personal}</Typography><PreferenceControls {...props} /></Paper>; }

type PreferenceProps = { text: AppCopy; preferences: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void; compact?: boolean };
function PreferenceControls({ text, preferences, update, compact = false }: PreferenceProps) {
  return <Stack spacing={2}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
      <FormControl fullWidth size={compact ? 'small' : undefined}><InputLabel>{text.language}</InputLabel><Select label={text.language} value={preferences.locale} onChange={event => update('locale', event.target.value as Preferences['locale'])}><MenuItem value="pt-PT">Português</MenuItem><MenuItem value="en">English</MenuItem><MenuItem value="es">Español</MenuItem></Select></FormControl>
      <FormControl fullWidth size={compact ? 'small' : undefined}><InputLabel>{text.theme}</InputLabel><Select label={text.theme} value={preferences.colorMode} onChange={event => update('colorMode', event.target.value as Preferences['colorMode'])}>{(['light', 'dark', 'system'] as const).map(mode => <MenuItem key={mode} value={mode}>{text.themes[mode]}</MenuItem>)}</Select></FormControl>
      <FormControl fullWidth size={compact ? 'small' : undefined}><InputLabel>{text.palette}</InputLabel><Select label={text.palette} value={preferences.paletteId} onChange={event => update('paletteId', event.target.value as PaletteId)}>{paletteIds.map((id, index) => <MenuItem value={id} key={id}><Stack direction="row" spacing={1} alignItems="center"><Stack direction="row" spacing={0.35}>{EUTAKTOS_PALETTES[id].colors.map(color => <Box key={color} sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color, border: '1px solid', borderColor: 'divider' }} />)}</Stack><span>{index + 1}. {text.palettes[index]}</span></Stack></MenuItem>)}</Select></FormControl>
      <FormControl fullWidth size={compact ? 'small' : undefined}><InputLabel>{text.density}</InputLabel><Select label={text.density} value={preferences.density} onChange={event => update('density', event.target.value as Preferences['density'])}><MenuItem value="comfortable">{text.comfortable}</MenuItem><MenuItem value="compact">{text.compact}</MenuItem></Select></FormControl>
      <FormControl fullWidth size={compact ? 'small' : undefined}><InputLabel>{text.textSize}</InputLabel><Select label={text.textSize} value={preferences.textSize} onChange={event => update('textSize', event.target.value as Preferences['textSize'])}>{textSizes.map(value => <MenuItem key={value} value={value}>{text.textSizes[value]}</MenuItem>)}</Select></FormControl>
    </Box>
    <Stack direction={{ xs: 'column', sm: 'row' }} flexWrap="wrap" gap={0.5}><FormControlLabel control={<Switch checked={preferences.highContrast} onChange={(_, checked) => update('highContrast', checked)} />} label={text.contrast} /><FormControlLabel control={<Switch checked={preferences.reducedMotion} onChange={(_, checked) => update('reducedMotion', checked)} />} label={text.motion} /><FormControlLabel control={<Switch checked={preferences.reducedTransparency} onChange={(_, checked) => update('reducedTransparency', checked)} />} label={text.transparency} /></Stack>
  </Stack>;
}
