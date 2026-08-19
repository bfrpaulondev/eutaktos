import { useEffect, useMemo, useState } from 'react';
import { SectionWorkspace } from './SectionWorkspace';
import { DEFAULT_PREFERENCES, normalizePreferences, type Preferences } from './lib/preferences';

const STORAGE_KEY = 'eutaktos.preferences.v1';

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
    personal: 'Só para ti', theme: 'Tema', density: 'Densidade', contrast: 'Contraste elevado', motion: 'Reduzir movimento', transparency: 'Reduzir transparência', language: 'Idioma', system: 'Sistema', light: 'Claro', dark: 'Escuro', comfortable: 'Confortável', compact: 'Compacta',
  },
  en: {
    skip: 'Skip to main content', home: 'Home', agenda: 'Agenda', assignments: 'Assignments', people: 'People', prefs: 'Preferences',
    eyebrow: 'Wednesday, 19 August', title: 'Everything in good order.', subtitle: 'What needs your attention comes first, without noise or tiring menus.',
    privacy: 'Privacy first', prepare: 'Prepare next meeting', focus: 'Now', nextAssignment: 'Next assignment', gems: 'Spiritual Gems', midweek: 'Midweek meeting · 20:00', confirmed: 'Confirmed',
    pending: 'Awaiting confirmation', pendingSub: 'assignments', openRoles: 'Unfilled', openRolesSub: 'role this week', reports: 'Missing reports', reportsSub: 'current month',
    smart: 'Smart Assign', balance: 'School balance', fairnessText: 'Some eligible brothers have gone significantly longer without a reading. The system shows transparent reasons; the responsible brother decides.',
    candidate: 'Eligible for reading', days: 'days', generate: 'Generate balanced proposal', human: 'Objective recommendation. Human decision.',
    ready: 'Meeting coverage', almostReady: 'Almost ready', sound: 'Sound', video: 'Video', microphone: 'Microphone 1', attendant: 'Attendant 2', missing: 'Not assigned yet',
    personal: 'Just for you', theme: 'Theme', density: 'Density', contrast: 'High contrast', motion: 'Reduce motion', transparency: 'Reduce transparency', language: 'Language', system: 'System', light: 'Light', dark: 'Dark', comfortable: 'Comfortable', compact: 'Compact',
  },
  es: {
    skip: 'Saltar al contenido principal', home: 'Inicio', agenda: 'Agenda', assignments: 'Asignaciones', people: 'Personas', prefs: 'Preferencias',
    eyebrow: 'Miércoles, 19 de agosto', title: 'Todo en buen orden.', subtitle: 'Lo que necesita tu atención aparece primero, sin ruido ni menús agotadores.',
    privacy: 'Privacidad primero', prepare: 'Preparar próxima reunión', focus: 'Ahora', nextAssignment: 'Próxima asignación', gems: 'Perlas espirituales', midweek: 'Reunión de entre semana · 20:00', confirmed: 'Confirmada',
    pending: 'Por confirmar', pendingSub: 'asignaciones', openRoles: 'Sin asignar', openRolesSub: 'función esta semana', reports: 'Informes pendientes', reportsSub: 'mes actual',
    smart: 'Smart Assign', balance: 'Equilibrio de la Escuela', fairnessText: 'Hay hermanos elegibles que llevan mucho más tiempo sin una lectura. El sistema muestra razones transparentes; el responsable decide.',
    candidate: 'Elegible para lectura', days: 'días', generate: 'Generar propuesta equilibrada', human: 'Recomendación objetiva. Decisión humana.',
    ready: 'Cobertura de la reunión', almostReady: 'Casi lista', sound: 'Sonido', video: 'Vídeo', microphone: 'Micrófono 1', attendant: 'Acomodador 2', missing: 'Aún sin asignar',
    personal: 'Solo para ti', theme: 'Tema', density: 'Densidad', contrast: 'Contraste alto', motion: 'Reducir movimiento', transparency: 'Reducir transparencia', language: 'Idioma', system: 'Sistema', light: 'Claro', dark: 'Oscuro', comfortable: 'Cómoda', compact: 'Compacta',
  },
} as const;

function loadPreferences(): Preferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return DEFAULT_PREFERENCES; }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [section, setSection] = useState<Section>('home');
  const text = useMemo(() => copy[preferences.locale], [preferences.locale]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    const root = document.documentElement;
    root.lang = preferences.locale;
    root.dataset.theme = preferences.theme;
    root.dataset.density = preferences.density;
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal';
    root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
    root.dataset.transparency = preferences.reducedTransparency ? 'reduced' : 'full';
  }, [preferences]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(current => ({ ...current, [key]: value }));
  const nav: Array<[Section, string, string]> = [
    ['home', text.home, '⌂'], ['agenda', text.agenda, '▦'], ['assignments', text.assignments, '✓'], ['people', text.people, '◌'], ['preferences', text.prefs, '⚙'],
  ];

  const goToSection = (next: Section) => {
    setSection(next);
    window.requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
  };

  return <div className="app-frame">
    <div className="ambient ambient-a" aria-hidden="true" /><div className="ambient ambient-b" aria-hidden="true" /><div className="ambient ambient-c" aria-hidden="true" />
    <a className="skip-link" href="#main">{text.skip}</a>

    <aside className="glass-rail" aria-label="Navegação principal">
      <div className="brand"><span className="brand-orb" aria-hidden="true"><span>E</span></span><div><strong>Eutaktos</strong><small>Everything in good order.</small></div></div>
      <nav className="rail-nav">
        {nav.map(([key, label, icon]) => <button key={key} className={section === key ? 'rail-item is-active' : 'rail-item'} aria-current={section === key ? 'page' : undefined} onClick={() => goToSection(key)}><span className="rail-icon" aria-hidden="true">{icon}</span><span>{label}</span></button>)}
      </nav>
      <div className="rail-foot"><span className="privacy-dot" aria-hidden="true" />{text.privacy}</div>
    </aside>

    <main id="main" className="workspace" tabIndex={-1}>
      <header className="hero glass-surface glass-strong">
        <div className="hero-copy"><p className="eyebrow">{text.eyebrow}</p><h1>{text.title}</h1><p className="hero-subtitle">{text.subtitle}</p></div>
        <div className="hero-actions"><span className="privacy-chip"><span aria-hidden="true">●</span>{text.privacy}</span><button className="primary-action"><span>{text.prepare}</span><span aria-hidden="true">→</span></button></div>
      </header>

      {section === 'home' ? <>
        <section className="metric-grid" aria-label={text.focus}>
          <article className="glass-surface metric-card"><span className="metric-kicker">{text.pending}</span><strong>2</strong><small>{text.pendingSub}</small></article>
          <article className="glass-surface metric-card"><span className="metric-kicker">{text.openRoles}</span><strong>1</strong><small>{text.openRolesSub}</small></article>
          <article className="glass-surface metric-card"><span className="metric-kicker">{text.reports}</span><strong>3</strong><small>{text.reportsSub}</small></article>
        </section>

        <section className="dashboard-grid">
          <article className="glass-surface feature-card assignment-card">
            <div className="section-heading"><div><p className="eyebrow">{text.nextAssignment}</p><h2>{text.gems}</h2></div><span className="status-chip">{text.confirmed}</span></div>
            <p>{text.midweek}</p>
            <div className="date-orb" aria-hidden="true"><span>20</span><small>AGO</small></div>
            <div className="soft-rule" />
            <button className="quiet-action" onClick={() => goToSection('agenda')}>{text.agenda}<span aria-hidden="true">→</span></button>
          </article>

          <article className="glass-surface feature-card smart-card">
            <div className="section-heading"><div><p className="eyebrow">{text.smart}</p><h2>{text.balance}</h2></div><span className="signal" aria-label="92%">92%</span></div>
            <p>{text.fairnessText}</p>
            <div className="candidate-list" aria-label={text.candidate}>
              <div className="candidate"><span><span className="avatar" aria-hidden="true">C</span>Carlos</span><strong>126 {text.days}</strong></div>
              <div className="candidate"><span><span className="avatar" aria-hidden="true">A</span>André</span><strong>98 {text.days}</strong></div>
            </div>
            <button className="primary-action compact-action" onClick={() => goToSection('assignments')}>{text.generate}<span aria-hidden="true">↗</span></button>
            <small className="human-note">{text.human}</small>
          </article>

          <article className="glass-surface feature-card coverage-card">
            <div className="section-heading"><div><p className="eyebrow">{text.ready}</p><h2>{text.almostReady}</h2></div><span className="progress-ring" aria-label="75%"><span>75</span></span></div>
            <ul className="coverage-list"><li><span>{text.sound}</span><strong>Bruno</strong></li><li><span>{text.video}</span><strong>Carlos</strong></li><li><span>{text.microphone}</span><strong>André</strong></li><li className="is-missing"><span>{text.attendant}</span><strong>{text.missing}</strong></li></ul>
          </article>

          <article className="glass-surface feature-card preferences-card">
            <div><p className="eyebrow">{text.personal}</p><h2>{text.prefs}</h2></div>
            <div className="preference-grid">
              <label>{text.language}<select value={preferences.locale} onChange={e => update('locale', e.target.value as Preferences['locale'])}><option value="pt-PT">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
              <label>{text.theme}<select value={preferences.theme} onChange={e => update('theme', e.target.value as Preferences['theme'])}><option value="system">{text.system}</option><option value="light">{text.light}</option><option value="dark">{text.dark}</option></select></label>
              <label>{text.density}<select value={preferences.density} onChange={e => update('density', e.target.value as Preferences['density'])}><option value="comfortable">{text.comfortable}</option><option value="compact">{text.compact}</option></select></label>
              <label className="toggle-row"><input type="checkbox" checked={preferences.highContrast} onChange={e => update('highContrast', e.target.checked)} /><span>{text.contrast}</span></label>
              <label className="toggle-row"><input type="checkbox" checked={preferences.reducedMotion} onChange={e => update('reducedMotion', e.target.checked)} /><span>{text.motion}</span></label>
              <label className="toggle-row"><input type="checkbox" checked={preferences.reducedTransparency} onChange={e => update('reducedTransparency', e.target.checked)} /><span>{text.transparency}</span></label>
            </div>
          </article>
        </section>
      </> : <SectionWorkspace locale={preferences.locale} section={section} />}
    </main>
  </div>;
}
