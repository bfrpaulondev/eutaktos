import type { Locale } from './lib/preferences';
import { getWorkspaceCopy, type WorkspaceSection } from './lib/sectionData';

interface SectionWorkspaceProps {
  locale: Locale;
  section: WorkspaceSection;
}

export function SectionWorkspace({ locale, section }: SectionWorkspaceProps) {
  const content = getWorkspaceCopy(locale, section);

  return (
    <section className="section-workspace" aria-labelledby={`section-${section}-title`}>
      <div className="glass-surface section-intro">
        <div>
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id={`section-${section}-title`}>{content.title}</h2>
          <p>{content.subtitle}</p>
        </div>
        <span className="prototype-badge">Preview</span>
      </div>

      <div className="section-card-grid">
        {content.cards.map((card, index) => (
          <article className="glass-surface section-detail-card" key={`${section}-${index}`}>
            <div className="section-detail-head">
              <div>
                <p className="section-meta">{card.meta}</p>
                <h3>{card.title}</h3>
              </div>
              {card.status ? <span className="status-chip">{card.status}</span> : null}
            </div>
            <p>{card.detail}</p>
            <button className="quiet-action" type="button">
              <span>{locale === 'pt-PT' ? 'Ver detalhes' : locale === 'es' ? 'Ver detalles' : 'View details'}</span>
              <span aria-hidden="true">→</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
