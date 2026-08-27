import { lazy, Suspense, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import ApartmentOutlined from '@ant-design/icons/es/icons/ApartmentOutlined';
import CalendarOutlined from '@ant-design/icons/es/icons/CalendarOutlined';
import CloseOutlined from '@ant-design/icons/es/icons/CloseOutlined';
import HomeOutlined from '@ant-design/icons/es/icons/HomeOutlined';
import MoreOutlined from '@ant-design/icons/es/icons/MoreOutlined';
import ScheduleOutlined from '@ant-design/icons/es/icons/ScheduleOutlined';
import SettingOutlined from '@ant-design/icons/es/icons/SettingOutlined';
import TeamOutlined from '@ant-design/icons/es/icons/TeamOutlined';
import AntAvatar from 'antd/es/avatar';
import AntButton from 'antd/es/button';
import AntCard from 'antd/es/card';
import AntDrawer from 'antd/es/drawer';
import AntSelect from 'antd/es/select';
import AntSwitch from 'antd/es/switch';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Space from 'antd/es/space';
import AntTypography from 'antd/es/typography';
import type { MenuProps } from 'antd/es/menu';
import { ProductionDashboard } from './ProductionDashboard';
import { sectionFromPath, type AppSection as Section } from './lib/navigation';
import { type PaletteId, type Preferences } from './lib/preferences';
import { taskNavFromLocation, taskNavTarget, type TaskNavKey } from './lib/taskNavigation';
import { EUTAKTOS_PALETTES } from './theme';

const SectionWorkspace = lazy(async () => {
  const module = await import('./SectionWorkspace');
  return { default: module.SectionWorkspace };
});

const { Content, Sider } = Layout;
const { Text: AntText, Title: AntTitle, Paragraph: AntParagraph } = AntTypography;

const copy = {
  'pt-PT': {
    skip: 'Saltar para o conteúdo principal', navigation: 'Navegação principal', home: 'Início', agenda: 'Agenda', assignments: 'Designações', people: 'Pessoas', prefs: 'Preferências', prepare: 'Preparar reunião', organization: 'Organização', planning: 'Planeamento', admin: 'Administração', more: 'Mais', close: 'Fechar', workspaceLoading: 'A carregar área…',
    eyebrow: 'O teu espaço de organização', title: 'Tudo em boa ordem.', subtitle: 'Encontra primeiro o que pede atenção, com contexto claro e sem ruído.', privacy: 'Privacidade primeiro', viewAgenda: 'Preparar reunião',
    personal: 'As tuas escolhas', palette: 'Paleta', theme: 'Modo de cor', density: 'Densidade', textSize: 'Tamanho do texto', contrast: 'Contraste elevado', motion: 'Reduzir movimento', transparency: 'Reduzir transparência', language: 'Idioma', comfortable: 'Confortável', compact: 'Compacta',
    textSizes: { small: 'Pequeno', default: 'Padrão', large: 'Grande', 'extra-large': 'Muito grande' }, themes: { light: 'Claro', dark: 'Escuro', system: 'Sistema' }, palettes: ['Clássica', 'Acolhedora', 'Calma', 'Foco', 'Noturna', 'Alto contraste'],
  },
  en: {
    skip: 'Skip to main content', navigation: 'Primary navigation', home: 'Home', agenda: 'Agenda', assignments: 'Assignments', people: 'People', prefs: 'Preferences', prepare: 'Prepare meeting', organization: 'Organization', planning: 'Planning', admin: 'Administration', more: 'More', close: 'Close', workspaceLoading: 'Loading area…',
    eyebrow: 'Your organization space', title: 'Everything in good order.', subtitle: 'Find what needs attention first, with clear context and no noise.', privacy: 'Privacy first', viewAgenda: 'Prepare meeting',
    personal: 'Your choices', palette: 'Palette', theme: 'Color mode', density: 'Density', textSize: 'Text size', contrast: 'High contrast', motion: 'Reduce motion', transparency: 'Reduce transparency', language: 'Language', comfortable: 'Comfortable', compact: 'Compact',
    textSizes: { small: 'Small', default: 'Default', large: 'Large', 'extra-large': 'Extra large' }, themes: { light: 'Light', dark: 'Dark', system: 'System' }, palettes: ['Classic', 'Welcoming', 'Calm', 'Focus', 'Night', 'High contrast'],
  },
  es: {
    skip: 'Saltar al contenido principal', navigation: 'Navegación principal', home: 'Inicio', agenda: 'Agenda', assignments: 'Asignaciones', people: 'Personas', prefs: 'Preferencias', prepare: 'Preparar reunión', organization: 'Organización', planning: 'Planificación', admin: 'Administración', more: 'Más', close: 'Cerrar', workspaceLoading: 'Cargando área…',
    eyebrow: 'Tu espacio de organización', title: 'Todo en buen orden.', subtitle: 'Encuentra primero lo que necesita atención, con contexto claro y sin ruido.', privacy: 'Privacidad primero', viewAgenda: 'Preparar reunión',
    personal: 'Tus elecciones', palette: 'Paleta', theme: 'Modo de color', density: 'Densidad', textSize: 'Tamaño del texto', contrast: 'Contraste alto', motion: 'Reducir movimiento', transparency: 'Reducir transparencia', language: 'Idioma', comfortable: 'Cómoda', compact: 'Compacta',
    textSizes: { small: 'Pequeño', default: 'Predeterminado', large: 'Grande', 'extra-large': 'Extra grande' }, themes: { light: 'Claro', dark: 'Oscuro', system: 'Sistema' }, palettes: ['Clásica', 'Acogedora', 'Calma', 'Foco', 'Nocturna', 'Alto contraste'],
  },
} as const;

type AppCopy = (typeof copy)[keyof typeof copy];
const paletteIds = Object.keys(EUTAKTOS_PALETTES) as PaletteId[];
const textSizes: Preferences['textSize'][] = ['small', 'default', 'large', 'extra-large'];
const desktopNav: readonly TaskNavKey[] = ['home', 'prepare', 'people', 'organization', 'planning', 'admin'];
const mobileNav: readonly TaskNavKey[] = ['home', 'prepare', 'people'];
const moreNav: readonly TaskNavKey[] = ['organization', 'planning', 'admin'];

function taskLabel(text: AppCopy, key: TaskNavKey): string {
  if (key === 'home') return text.home;
  if (key === 'prepare') return text.prepare;
  if (key === 'people') return text.people;
  if (key === 'organization') return text.organization;
  if (key === 'planning') return text.planning;
  return text.admin;
}

function taskIcon(key: TaskNavKey) {
  if (key === 'home') return <HomeOutlined />;
  if (key === 'prepare') return <CalendarOutlined />;
  if (key === 'people') return <TeamOutlined />;
  if (key === 'organization') return <ApartmentOutlined />;
  if (key === 'planning') return <ScheduleOutlined />;
  return <SettingOutlined />;
}

function useDesktopQuery(): boolean {
  const query = '(min-width:900px)';
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return matches;
}

export interface TaskShellProps {
  readonly preferences: Preferences;
  readonly setPreferences: Dispatch<SetStateAction<Preferences>>;
}

export default function TaskShell({ preferences, setPreferences }: TaskShellProps) {
  const [section, setSection] = useState<Section>(() => sectionFromPath(window.location.pathname));
  const [locationKey, setLocationKey] = useState(() => `${window.location.pathname}${window.location.search}${window.location.hash}`);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement | null>(null);
  const desktop = useDesktopQuery();
  const text = copy[preferences.locale];
  const activeTask = taskNavFromLocation(window.location.pathname, window.location.search);
  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const onPopState = () => {
      setSection(sectionFromPath(window.location.pathname));
      setLocationKey(`${window.location.pathname}${window.location.search}${window.location.hash}`);
      setMoreOpen(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    document.title = `Eutaktos — ${taskLabel(text, activeTask)}`;
  }, [activeTask, locationKey, text]);

  const closeMore = () => {
    setMoreOpen(false);
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  };

  const goToTask = (next: TaskNavKey) => {
    const target = taskNavTarget(next);
    const nextLocation = `${target.pathname}${target.search}`;
    if (`${window.location.pathname}${window.location.search}` !== nextLocation || window.location.hash) window.history.pushState({ task: next }, '', nextLocation);
    setSection(target.section);
    setLocationKey(nextLocation);
    setMoreOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  };

  const menuItems: MenuProps['items'] = desktopNav.map(key => ({ key, icon: taskIcon(key), label: taskLabel(text, key) }));

  return <Layout style={{ minHeight: '100dvh', background: 'transparent' }}>
    <AntButton className="skip-link" href="#main" type="primary" size="small">{text.skip}</AntButton>

    {desktop ? <Sider width={264} theme="light" aria-label={text.navigation} style={{ position: 'fixed', insetBlock: 16, insetInlineStart: 16, height: 'calc(100dvh - 32px)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--ant-color-border-secondary)', background: 'var(--ant-color-bg-container)', zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px 12px' }}>
        <AntAvatar size={42} style={{ background: 'var(--ant-color-primary)', fontWeight: 800 }}>E</AntAvatar>
        <div><AntText strong>Eutaktos</AntText><br /><AntText type="secondary" style={{ fontSize: 12 }}>{text.privacy}</AntText></div>
      </div>
      <Menu mode="inline" selectedKeys={[activeTask]} items={menuItems} onClick={({ key }) => goToTask(key as TaskNavKey)} style={{ borderInlineEnd: 0, paddingInline: 8, background: 'transparent' }} />
      <div style={{ position: 'absolute', insetInline: 16, bottom: 16, padding: 12, borderRadius: 12, border: '1px solid var(--ant-color-border-secondary)' }}><AntText type="secondary" style={{ fontSize: 12 }}>{text.privacy}</AntText></div>
    </Sider> : null}

    {!desktop ? <nav aria-label={text.navigation} style={{ position: 'fixed', zIndex: 20, left: 8, right: 8, bottom: 'max(8px, env(safe-area-inset-bottom))', padding: 6, borderRadius: 16, border: '1px solid var(--ant-color-border-secondary)', background: 'var(--ant-color-bg-container)', boxShadow: 'var(--ant-box-shadow-secondary)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 4 }}>
        {mobileNav.map(key => <AntButton key={key} type={activeTask === key ? 'primary' : 'text'} aria-current={activeTask === key ? 'page' : undefined} icon={taskIcon(key)} onClick={() => goToTask(key)} style={{ minWidth: 0, height: 52, paddingInline: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>{taskLabel(text, key)}</AntButton>)}
        <AntButton ref={moreButtonRef} type={moreNav.includes(activeTask) ? 'primary' : 'text'} aria-current={moreNav.includes(activeTask) ? 'page' : undefined} icon={<MoreOutlined />} onClick={() => setMoreOpen(true)} style={{ minWidth: 0, height: 52, paddingInline: 4, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11 }}>{text.more}</AntButton>
      </div>
    </nav> : null}

    <AntDrawer placement="bottom" open={moreOpen} onClose={closeMore} height="auto" title={text.more} extra={<AntButton type="text" icon={<CloseOutlined />} onClick={closeMore}>{text.close}</AntButton>} styles={{ body: { paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' } }}>
      <Space orientation="vertical" size="small" style={{ display: 'flex', maxWidth: 560, marginInline: 'auto' }}>
        {moreNav.map(key => <AntButton key={key} type={activeTask === key ? 'primary' : 'default'} icon={taskIcon(key)} onClick={() => goToTask(key)} block style={{ justifyContent: 'flex-start' }}>{taskLabel(text, key)}</AntButton>)}
      </Space>
    </AntDrawer>

    <Content id="main" tabIndex={-1} style={{ marginInlineStart: desktop ? 296 : 0, width: desktop ? 'calc(100% - 296px)' : '100%', maxWidth: 1640, padding: desktop ? '16px 32px 32px' : '12px 12px calc(84px + env(safe-area-inset-bottom))', outline: 'none' }}>
      {section === 'home' ? <><Header text={text} onAgenda={() => goToTask('prepare')} /><HomeDashboard text={text} preferences={preferences} update={update} /></> : section === 'preferences' ? <PreferencesPanel text={text} preferences={preferences} update={update} /> : <Suspense fallback={<WorkspaceLoading label={text.workspaceLoading} />}><SectionWorkspace key={locationKey} locale={preferences.locale} section={section} /></Suspense>}
    </Content>
  </Layout>;
}

function WorkspaceLoading({ label }: { label: string }) {
  return <div role="status" aria-live="polite" style={{ paddingBlock: 40, textAlign: 'center' }}><AntText type="secondary">{label}</AntText></div>;
}

function Header({ text, onAgenda }: { text: AppCopy; onAgenda: () => void }) {
  return <AntCard component="header" style={{ marginBottom: 20, borderRadius: 20 }} styles={{ body: { padding: 'clamp(18px, 4vw, 36px)' } }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 28, flexWrap: 'wrap' }}>
      <div style={{ maxWidth: 760, flex: '1 1 520px' }}>
        <AntText type="secondary" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{text.eyebrow}</AntText>
        <AntTitle level={1} style={{ margin: '8px 0 0', fontSize: 'clamp(2.2rem, 6vw, 4rem)', lineHeight: 1.05 }}>{text.title}</AntTitle>
        <AntParagraph type="secondary" style={{ margin: '12px 0 0', maxWidth: 680, fontSize: '1.05rem' }}>{text.subtitle}</AntParagraph>
      </div>
      <AntButton type="primary" size="large" onClick={onAgenda} style={{ minWidth: 210 }}>{text.viewAgenda}</AntButton>
    </div>
  </AntCard>;
}

function HomeDashboard({ text, preferences, update }: { text: AppCopy; preferences: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void }) {
  return <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
    <ProductionDashboard locale={preferences.locale} />
    <div style={{ maxWidth: 640 }}><PreferencesCard text={text} preferences={preferences} update={update} /></div>
  </Space>;
}

function PreferencesCard(props: PreferenceProps) {
  return <AntCard>
    <AntText type="secondary" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{props.text.personal}</AntText>
    <AntTitle level={4} style={{ margin: '6px 0 16px' }}>{props.text.prefs}</AntTitle>
    <PreferenceControls {...props} compact />
  </AntCard>;
}

function PreferencesPanel(props: PreferenceProps) {
  return <AntCard component="section" aria-labelledby="preferences-title" style={{ maxWidth: 980, borderRadius: 16 }}>
    <AntText type="secondary" style={{ textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700 }}>{props.text.personal}</AntText>
    <AntTitle id="preferences-title" level={1} style={{ margin: '6px 0 4px' }}>{props.text.prefs}</AntTitle>
    <AntParagraph type="secondary" style={{ marginBottom: 24 }}>{props.text.personal}</AntParagraph>
    <PreferenceControls {...props} />
  </AntCard>;
}

type PreferenceProps = { text: AppCopy; preferences: Preferences; update: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void; compact?: boolean };

function PreferenceField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: 'grid', gap: 6 }}><AntText strong>{label}</AntText>{children}</label>;
}

function PreferenceControls({ text, preferences, update, compact = false }: PreferenceProps) {
  const size = compact ? 'small' : 'middle';
  return <Space orientation="vertical" size="large" style={{ display: 'flex' }}>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
      <PreferenceField label={text.language}><AntSelect aria-label={text.language} size={size} value={preferences.locale} onChange={value => update('locale', value as Preferences['locale'])} options={[{ value: 'pt-PT', label: 'Português' }, { value: 'en', label: 'English' }, { value: 'es', label: 'Español' }]} /></PreferenceField>
      <PreferenceField label={text.theme}><AntSelect aria-label={text.theme} size={size} value={preferences.colorMode} onChange={value => update('colorMode', value as Preferences['colorMode'])} options={(['light', 'dark', 'system'] as const).map(mode => ({ value: mode, label: text.themes[mode] }))} /></PreferenceField>
      <PreferenceField label={text.palette}><AntSelect aria-label={text.palette} size={size} value={preferences.paletteId} onChange={value => update('paletteId', value as PaletteId)} options={paletteIds.map((id, index) => ({ value: id, label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><span aria-hidden="true" style={{ display: 'inline-flex', gap: 3 }}>{EUTAKTOS_PALETTES[id].colors.map(color => <span key={color} style={{ width: 10, height: 10, borderRadius: '50%', background: color, border: '1px solid var(--ant-color-border)' }} />)}</span>{index + 1}. {text.palettes[index]}</span> }))} /></PreferenceField>
      <PreferenceField label={text.density}><AntSelect aria-label={text.density} size={size} value={preferences.density} onChange={value => update('density', value as Preferences['density'])} options={[{ value: 'comfortable', label: text.comfortable }, { value: 'compact', label: text.compact }]} /></PreferenceField>
      <PreferenceField label={text.textSize}><AntSelect aria-label={text.textSize} size={size} value={preferences.textSize} onChange={value => update('textSize', value as Preferences['textSize'])} options={textSizes.map(value => ({ value, label: text.textSizes[value] }))} /></PreferenceField>
    </div>
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AntSwitch checked={preferences.highContrast} onChange={checked => update('highContrast', checked)} /><AntText>{text.contrast}</AntText></label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AntSwitch checked={preferences.reducedMotion} onChange={checked => update('reducedMotion', checked)} /><AntText>{text.motion}</AntText></label>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><AntSwitch checked={preferences.reducedTransparency} onChange={checked => update('reducedTransparency', checked)} /><AntText>{text.transparency}</AntText></label>
    </div>
  </Space>;
}
