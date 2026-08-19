import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_PREFERENCES, normalizePreferences, type Preferences } from './lib/preferences';

const STORAGE_KEY = 'eutaktos.preferences.v1';

const copy = {
  'pt-PT': { title: 'Tudo em boa ordem.', subtitle: 'A fundação real da PWA começou.', prefs: 'Preferências', theme: 'Tema', density: 'Densidade', contrast: 'Contraste elevado', motion: 'Reduzir movimento', language: 'Idioma', status: 'Fundação PWA', statusText: 'React + TypeScript + Vite com preferências acessíveis e persistentes.', system: 'Sistema', light: 'Claro', dark: 'Escuro', comfortable: 'Confortável', compact: 'Compacta' },
  en: { title: 'Everything in good order.', subtitle: 'The production PWA foundation has started.', prefs: 'Preferences', theme: 'Theme', density: 'Density', contrast: 'High contrast', motion: 'Reduce motion', language: 'Language', status: 'PWA foundation', statusText: 'React + TypeScript + Vite with accessible persistent preferences.', system: 'System', light: 'Light', dark: 'Dark', comfortable: 'Comfortable', compact: 'Compact' },
  es: { title: 'Todo en buen orden.', subtitle: 'La base real de la PWA ha comenzado.', prefs: 'Preferencias', theme: 'Tema', density: 'Densidad', contrast: 'Contraste alto', motion: 'Reducir movimiento', language: 'Idioma', status: 'Base PWA', statusText: 'React + TypeScript + Vite con preferencias accesibles y persistentes.', system: 'Sistema', light: 'Claro', dark: 'Oscuro', comfortable: 'Cómoda', compact: 'Compacta' },
} as const;

function loadPreferences(): Preferences {
  try { return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')); }
  catch { return DEFAULT_PREFERENCES; }
}

export default function App() {
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const text = useMemo(() => copy[preferences.locale], [preferences.locale]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    const root = document.documentElement;
    root.lang = preferences.locale;
    root.dataset.theme = preferences.theme;
    root.dataset.density = preferences.density;
    root.dataset.contrast = preferences.highContrast ? 'high' : 'normal';
    root.dataset.motion = preferences.reducedMotion ? 'reduced' : 'full';
  }, [preferences]);

  const update = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences(current => ({ ...current, [key]: value }));

  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="topbar"><strong>Eutaktos</strong><span aria-label="Development status">v0.1</span></header>
    <main id="main" className="shell">
      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">{text.status}</p><h1 id="hero-title">{text.title}</h1><p>{text.subtitle}</p>
      </section>
      <section className="card" aria-labelledby="status-title"><h2 id="status-title">{text.status}</h2><p>{text.statusText}</p></section>
      <section className="card" aria-labelledby="prefs-title">
        <h2 id="prefs-title">{text.prefs}</h2>
        <div className="grid">
          <label>{text.language}<select value={preferences.locale} onChange={e => update('locale', e.target.value as Preferences['locale'])}><option value="pt-PT">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
          <label>{text.theme}<select value={preferences.theme} onChange={e => update('theme', e.target.value as Preferences['theme'])}><option value="system">{text.system}</option><option value="light">{text.light}</option><option value="dark">{text.dark}</option></select></label>
          <label>{text.density}<select value={preferences.density} onChange={e => update('density', e.target.value as Preferences['density'])}><option value="comfortable">{text.comfortable}</option><option value="compact">{text.compact}</option></select></label>
          <label className="check"><input type="checkbox" checked={preferences.highContrast} onChange={e => update('highContrast', e.target.checked)} />{text.contrast}</label>
          <label className="check"><input type="checkbox" checked={preferences.reducedMotion} onChange={e => update('reducedMotion', e.target.checked)} />{text.motion}</label>
        </div>
      </section>
    </main>
  </>;
}
