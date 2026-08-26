import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PeopleAssistancePanel } from './PeopleAssistancePanel';

// Static rendering intentionally covers only the stable product contract/copy.
// Async fetch, stale ownership and retry are covered by the API/client contract and browser gate.
describe('PeopleAssistancePanel product contract', () => {
  it('keeps the assistance surface non-judgmental and explicitly human-controlled in every locale', () => {
    for (const locale of ['pt-PT', 'en', 'es'] as const) {
      const markup = renderToStaticMarkup(<PeopleAssistancePanel locale={locale} />);
      expect(markup).toContain('people-assistance-title');
      expect(markup).not.toMatch(/spiritual|espiritual|worth|valor pessoal|valor personal/i);
      if (locale === 'pt-PT') expect(markup).toContain('não faz designações nem toma decisões por si');
      if (locale === 'en') expect(markup).toContain('does not assign people or make decisions for you');
      if (locale === 'es') expect(markup).toContain('no asigna personas ni toma decisiones por usted');
    }
  });

  it('starts in an explicit loading state rather than inventing zero assistance', () => {
    const markup = renderToStaticMarkup(<PeopleAssistancePanel locale="en" />);
    expect(markup).toContain('Reviewing operational conditions');
    expect(markup).not.toContain('There are no additional operational prompts');
  });
});
