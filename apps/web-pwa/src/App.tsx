import { lazy, Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Box,
  Card,
  CardContent,
  CssBaseline,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  ThemeProvider,
  useMediaQuery,
} from '@mui/material';
import HomeOutlined from '@ant-design/icons/es/icons/HomeOutlined';
import CalendarOutlined from '@ant-design/icons/es/icons/CalendarOutlined';
import TeamOutlined from '@ant-design/icons/es/icons/TeamOutlined';
import ApartmentOutlined from '@ant-design/icons/es/icons/ApartmentOutlined';
import ProjectOutlined from '@ant-design/icons/es/icons/ProjectOutlined';
import SafetyCertificateOutlined from '@ant-design/icons/es/icons/SafetyCertificateOutlined';
import MoreOutlined from '@ant-design/icons/es/icons/MoreOutlined';
import LockOutlined from '@ant-design/icons/es/icons/LockOutlined';
import AntButton from 'antd/es/button';
import AntDrawer from 'antd/es/drawer';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Result from 'antd/es/result';
import Space from 'antd/es/space';
import Tabs from 'antd/es/tabs';
import AntTypography from 'antd/es/typography';
import { ProductionDashboard } from './ProductionDashboard';
import { PwaConnectionStatus } from './PwaConnectionStatus';
import { PwaUpdateRecovery } from './PwaUpdateRecovery';
import {
  PREPARE_PATHS,
  SECTION_PATHS,
  normalizeAppPath,
  prepareMeetingViewFromPath,
  sectionFromPath,
  type AppSection as Section,
} from './lib/navigation';
import {
  DEFAULT_PREFERENCES,
  normalizePreferences,
  resolvePaletteId,
  type PaletteId,
  type Preferences,
} from './lib/preferences';
import { buildEutaktosTheme, EUTAKTOS_PALETTES } from './theme';
import { Stack, Typography } from './ui/MuiCompat';
import './task-shell.css';

const SectionWorkspace = lazy(async () => {
  const module = await import('./SectionWorkspace');
  return { default: module.SectionWorkspace };
});

const { Sider, Content } = Layout;
const { Text: AntText, Title: AntTitle } = AntTypography;
const STORAGE_KEY = 'eutaktos.preferences.v4';

const copy = {
  'pt-PT': {
    skip: 'Saltar para o conteúdo principal', navigation: 'Navegação principal', home: 'Início', prepare: 'Preparar reunião', people: 'Pessoas', organization: 'Organização', planning: 'Planeamento', administration: 'Administração', more: 'Mais', close: 'Fechar', workspaceLoading: 'A carregar área…', privacy: 'Privacidade primeiro',
    agenda: 'Agenda', assignments: 'Designações', prefs: 'Preferências',
    organizationPendingTitle: 'Organização está a ser reunida numa experiência própria', organizationPendingBody: 'Agregados, grupos e responsabilidades continuam disponíveis na área Pessoas enquanto esta migração é concluída.', organizationPendingAction: 'Abrir Pessoas',
    planningPendingTitle: 'Planeamento guiado está a ser preparado', planningPendingBody: 'Agenda e Designações continuam funcionais em Preparar reunião. Esta área só ganhará conteúdo quando houver um fluxo próprio e factual.', planningPendingAction: 'Preparar reunião',
    administrationNote: 'As ferramentas administrativas serão reunidas aqui gradualmente. As preferências pessoais continuam disponíveis sem alterar permissões ou dados da congregação.',
    personal: 'As tuas escolhas', palette: 'Paleta', theme: 'Modo de cor', density: 'Densidade', textSize: 'Tamanho do texto', contrast: 'Contraste elevado', motion: 'Reduzir movimento', transparency: 'Reduzir transparência', language: 'Idioma', comfortable: 'Confortável', compact: 'Compacta',
    textSizes: { small: 'Pequeno', default: 'Padrão', large: 'Grande', 'extra-large': 'Muito grande' }, themes: { light: 'Claro', dark: 'Escuro', system: 'Sistema' }, palettes: ['Clássica', 'Acolhedora', 'Calma', 'Foco', 'Noturna', 'Alto contraste'],
  },
  en: {
    skip: 'Skip to main content', navigation: 'Primary navigation', home: 'Home', prepare: 'Prepare meeting', people: 'People', organization: 'Organization', planning: 'Planning', administration: 'Administration', more: 'More', close: 'Close', workspaceLoading: 'Loading area…', privacy: 'Privacy first',
    agenda: 'Agenda', assignments: 'Assignments', prefs: 'Preferences',
    organizationPendingTitle: 'Organization is being consolidated into its own experience', organizationPendingBody: 'Households, groups and responsibilities remain available under People while this migration is completed.', organizationPendingAction: 'Open People',
    planningPendingTitle: 'Guided planning is being prepared', planningPendingBody: 'Agenda and Assignments remain functional under Prepare meeting. This area will only gain content when a distinct factual workflow exists.', planningPendingAction: 'Prepare meeting',
    administrationNote: 'Administrative tools will be consolidated here gradually. Personal preferences remain available without changing permissions or congregation data.',
    personal: 'Your choices', palette: 'Palette', theme: 'Color mode', density: 'Density', textSize: 'Text size', contrast: 'High contrast', motion: 'Reduce motion', transparency: 'Reduce transparency', language: 'Language', comfortable: 'Comfortable', compact: 'Compact',
    textSizes: { small: 'Small', default: 'Default', large: 'Large', 'extra-large': 'Extra large' }, themes: { light: 'Light', dark: 'Dark', system: 'System' }, palettes: ['Classic', 'Welcoming', 'Calm', 'Focus', 'Night', 'High contrast'],
  },
  es: {
    skip: 'Saltar al contenido principal', navigation: 'Navegación principal', home: 'Inicio', prepare: 'Preparar reunión', people: 'Personas', organization: 'Organización', planning: 'Planificación', administration: 'Administración', more: 'Más', close: 'Cerrar', workspaceLoading: 'Cargando área…', privacy: 'Privacidad primero',
    agenda: 'Agenda', assignments: 'Asignaciones', prefs: 'Preferencias',
    organizationPendingTitle: 'Organización se está reuniendo en una experiencia propia', organizationPendingBody: 'Los grupos familiares, grupos y responsabilidades siguen disponibles en Personas mientras se completa esta migración.', organizationPendingAction: 'Abrir Personas',
    planningPendingTitle: 'La planificación guiada se está preparando', planningPendingBody: 'Agenda y Asignaciones siguen funcionando en Preparar reunión. Esta área solo tendrá contenido cuando exista un flujo propio y factual.', planningPendingAction: 'Preparar reunión',
    administrationNote: 'Las herramientas administrativas se reunirán aquí gradualmente. Las preferencias personales siguen disponibles sin cambiar permisos ni datos de la congregación.',
    personal: 'Tus elecciones', palette: 'Paleta', theme: 'Modo de color', density: 'Densidad', textSize: 'Tamaño del texto', contrast: 'Contraste alto', motion: 'Reducir movimiento', transparency: 'Reducir transparencia', language: 'Idioma', comfortable: 'Cómoda', compact: 'Compacta',
    textSizes: { small: 'Pequeño', default: 'Predeterminado', large: 'Grande', 'extra-large': 'Extra grande' }, themes: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }, palettes: ['Clásica', 'Acogedora', 'Calma', 'Foco', 'Nocturna', 'Alto contraste'],
  },
} as const;

type AppCopy = (typeof copy)[keyof typeof copy];
const paletteIds = Object.keys(EUTAKTOS_PALETTES) as PaletteId[];
const textSizes: Preferences['textSize'][] = ['small', 'default', 'large', 'extra-large'];

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

function useDesktopShell(): boolean {
  const query = '(min-width: 900px)';
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return desktop;
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
  const [path, setPath] = useState(() => window.location.pathname);
  const [section, setSection] = useState<Section>(() => sectionFromPath(window.location.pathname));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const desktop = useDesktopShell();
  const text = copy[preferences.locale];
  const prepareView = prepareMeetingViewFromPath(path);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSection(sectionFromPath(window.location.pathname));
      setMoreOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const normalized = normalizeAppPath(path);
    let label: string = text[section];
    if (section === 'prepare') {
      label = normalized === '/preparar-reuniao' || normalized === '/prepare-meeting'
        ? text.prepare
        : prepareView === 'assignments' ? text.assignments : text.agenda;
    } else if (section === 'administration' && (normalized === '/preferencias' || normalized === '/preferences')) {
      label = text.prefs;
    }
    document.title = `Eutaktos — ${label}`;
  }, [path, prepareView, section, text]);

  const focusMain = () => window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  const closeMore = () => {
    setMoreOpen(false);
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  };
  const goToPath = (nextPath: string) => {
    if (window.location.pathname !== nextPath || window.location.search || window.location.hash) window.history.pushState({ section: sectionFromPath(nextPath) }, '', nextPath);
    setPath(nextPath);
    setSection(sectionFromPath(nextPath));
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    focusMain();
  };
  const goToSection = (next: Section) => goToPath(SECTION_PATHS[next]);

  const icons: Record<Section, React.ReactNode> = {
    home: <HomeOutlined />,
    prepare: <CalendarOutlined />,
    people: <TeamOutlined />,
    organization: <ApartmentOutlined />,
    planning: <ProjectOutlined />,
    administration: <SafetyCertificateOutlined />,
  };
  const desktopItems = (['home', 'prepare', 'people', 'organization', 'planning', 'administration'] as const).map(key => ({ key, icon: icons[key], label: text[key] }));
  const moreSections: readonly Section[] = ['organization', 'planning', 'administration'];

  return (
    <Layout className="eutaktos-task-shell">
      <AntButton className="skip-link" href="#main" type="primary" size="small">{text.skip}</AntButton>

      {desktop ? <Sider width={264} theme="light" className="eutaktos-task-sider" aria-label={text.navigation}>
        <div className="eutaktos-task-brand">
          <div className="eutaktos-task-mark" aria-hidden="true">E</div>
          <div><AntTitle level={4}>Eutaktos</AntTitle><AntText type="secondary"><LockOutlined aria-hidden="true" /> {text.privacy}</AntText></div>
        </div>
        <Menu aria-label={text.navigation} mode="inline" selectedKeys={[section]} items={desktopItems} onClick={({ key }) => goToSection(key as Section)} />
      </Sider> : null}

      {!desktop ? <nav className="eutaktos-mobile-nav" aria-label={text.navigation}>
        {(['home', 'prepare', 'people'] as const).map(key => <AntButton key={key} type="text" className="eutaktos-mobile-nav-button" aria-current={section === key ? 'page' : undefined} onClick={() => goToSection(key)}><span aria-hidden="true">{icons[key]}</span><span>{text[key]}</span></AntButton>)}
        <AntButton ref={moreButtonRef} type="text" className="eutaktos-mobile-nav-button" aria-current={moreSections.includes(section) ? 'page' : undefined} onClick={() => setMoreOpen(true)}><MoreOutlined aria-hidden="true" /><span>{text.more}</span></AntButton>
      </nav> : null}

      <AntDrawer title={text.more} placement="bottom" open={moreOpen} onClose={closeMore} closeIcon={false} extra={<AntButton onClick={closeMore}>{text.close}</AntButton>} height="auto" className="eutaktos-more-drawer">
        <Space direction="vertical" size="small" style={{ display: 'flex' }}>
          {moreSections.map(key => <AntButton key={key} type={section === key ? 'primary' : 'default'} icon={icons[key]} block onClick={() => goToSection(key)}>{text[key]}</AntButton>)}
        </Space>
      </AntDrawer>

      <Layout className={desktop ? 'eutaktos-task-main-layout eutaktos-task-main-layout--desktop' : 'eutaktos-task-main-layout'}>
        <Content component="main" id="main" tabIndex={-1} className="eutaktos-task-content">
          {section === 'home' ? <HomeDashboard text={text} preferences={preferences} update={update} /> : null}
          {section === 'prepare' ? <PrepareMeetingArea text={text} locale={preferences.locale} active={prepareView} onChange={view => goToPath(PREPARE_PATHS[view])} /> : null}
          {section === 'people' ? <Suspense fallback={<WorkspaceLoading label={text.workspaceLoading} />}><SectionWorkspace locale={preferences.locale} section="people" /></Suspense> : null}
          {section === 'organization' ? <MigrationArea title={text.organizationPendingTitle} body={text.organizationPendingBody} action={text.organizationPendingAction} onAction={() => goToSection('people')} /> : null}
          {section === 'planning' ? <MigrationArea title={text.planningPendingTitle} body={text.planningPendingBody} action={text.planningPendingAction} onAction={() => goToSection('prepare')} /> : null}
          {section === 'administration' ? <AdministrationArea text={text} preferences={preferences} update={update} /> : null}
        </Content>
      </Layout>
    </Layout>
  );
}

function PrepareMeetingArea({ text, locale, active, onChange }: { text: AppCopy; locale: Preferences['locale']; active: 'agenda' | 'assignments'; onChange: (view: 'agenda' | 'assignments') => void }) {
  return <div className="eutaktos-prepare-area">
    <Tabs activeKey={active} onChange={key => onChange(key as 'agenda' | 'assignments')} items={[{ key: 'agenda', label: text.agenda }, { key: 'assignments', label: text.assignments }]} />
    <Suspense fallback={<WorkspaceLoading label={text.workspaceLoading} />}><SectionWorkspace locale={locale} section={active} /></Suspense>
  </div>;
}

function MigrationArea({ title, body, action, onAction }: { title: string; body: string; action: string; onAction: () => void }) {
  return <Result status="info" title={title} subTitle={body} extra={<AntButton type="primary" onClick={onAction}>{action}</AntButton>} />;
}

function AdministrationArea(props: PreferenceProps) {
  return <div className="eutaktos-administration-area"><AntText type="secondary">{props.text.administrationNote}</AntText><PreferencesPanel {...props} /></div>;
}

function WorkspaceLoading({ label }: { label: string }) { return <div role="status" aria-live="polite" className="eutaktos-workspace-loading"><AntText type="secondary">{label}</AntText></div>; }

function HomeDashboard({ text, preferences, update }: { text: AppCopy; preferences: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void }) {
  return <Stack spacing={2.5}>
    <ProductionDashboard locale={preferences.locale} />
    <Box sx={{ maxWidth: 640 }}><PreferencesCard text={text} preferences={preferences} update={update} /></Box>
  </Stack>;
}

function PreferencesCard(props: PreferenceProps) { return <Card><CardContent><Typography variant="overline" color="text.secondary">{props.text.personal}</Typography><Typography variant="h4" sx={{ mb: 2 }}>{props.text.prefs}</Typography><PreferenceControls {...props} compact /></CardContent></Card>; }
function PreferencesPanel(props: PreferenceProps) { return <Paper sx={{ p: { xs: 2, sm: 3 }, maxWidth: 980, borderRadius: 3, mt: 2 }}><Typography variant="overline" color="primary.main">{props.text.personal}</Typography><Typography variant="h3" sx={{ mb: 0.5 }}>{props.text.prefs}</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>{props.text.personal}</Typography><PreferenceControls {...props} /></Paper>; }

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