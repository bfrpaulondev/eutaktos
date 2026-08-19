import { useMemo, useState } from 'react';
import { locales, type Locale } from './i18n';
import { loadPreferences, savePreferences, type Preferences, type Theme } from './preferences';

const navKeys = ['home', 'agenda', 'assignments', 'people', 'preferences'] as const;

export function App() {
  const [preferences, setPreferences] = useState<Preferences>(() => loadPreferences());
  const [active, setActive] = useState<(typeof navKeys)[number]>('home');
  const t = useMemo(() => locales[preferences.locale], [preferences.locale]);

  const update = (patch: Partial<Preferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    savePreferences(next);
  };

  return (
    <div className={`app theme-${preferences.theme} ${preferences.highContrast ? 'high-contrast' : ''} ${preferences.reducedMotion ? 'reduce-motion' : ''}`}>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand"><span className="brand-mark" aria-hidden="true">E</span><strong>Eutaktos</strong></div>
        <nav className="nav-list">
          {navKeys.map((key) => (
            <button key={key} className={active === key ? 'nav-item active' : 'nav-item'} aria-current={active === key ? 'page' : undefined} onClick={() => setActive(key)}>{t[key]}</button>
          ))}
        </nav>
      </aside>
      <main id="main-content" className="main" tabIndex={-1}>
        <header className="topbar"><div><span className="eyebrow">{t.today}</span><h1>{t.greeting}</h1><p>{t.subtitle}</p></div><span className="privacy-badge">Privacy first</span></header>
        <section className="metrics" aria-label="Resumo">
          <article className="metric"><strong>2</strong><span>{t.pending}</span></article>
          <article className="metric"><strong>1</strong><span>{t.openRoles}</span></article>
          <article className="metric good"><strong>92%</strong><span>{t.fairness}</span></article>
        </section>
        <section className="grid">
          <article className="card">
            <span className="eyebrow">{t.nextAssignment}</span><h2>{t.spiritualGems}</h2><p>{t.midweek} · 20:00</p><span className="status">{t.confirmed}</span>
          </article>
          <article className="card smart">
            <span className="eyebrow">{t.smartAssign}</span><h2>{t.fairness}</h2><p>{t.fairnessText}</p>
            <div className="candidate"><span>Carlos</span><strong>126 dias</strong></div><div className="candidate"><span>André</span><strong>98 dias</strong></div>
          </article>
        </section>
        <section className="card settings" aria-labelledby="preferences-heading">
          <h2 id="preferences-heading">{t.preferences}</h2>
          <label>{t.language}<select value={preferences.locale} onChange={(e) => update({ locale: e.target.value as Locale })}><option value="pt-PT">Português</option><option value="en">English</option><option value="es">Español</option></select></label>
          <label>{t.theme}<select value={preferences.theme} onChange={(e) => update({ theme: e.target.value as Theme })}><option value="system">{t.system}</option><option value="light">{t.light}</option><option value="dark">{t.dark}</option></select></label>
          <label className="check"><input type="checkbox" checked={preferences.highContrast} onChange={(e) => update({ highContrast: e.target.checked })} /> Alto contraste</label>
          <label className="check"><input type="checkbox" checked={preferences.reducedMotion} onChange={(e) => update({ reducedMotion: e.target.checked })} /> Reduzir movimento</label>
        </section>
      </main>
    </div>
  );
}
