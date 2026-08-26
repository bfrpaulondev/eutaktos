import { describe, expect, it } from 'vitest';
import { personProfileCopy } from './PersonProfile';

describe('PersonProfile participation copy', () => {
  it.each([
    ['pt-PT', 'não é inferida', 'por si só confirma disponibilidade', 'garante uma recomendação'],
    ['en', 'not inferred', 'does not itself establish availability', 'guarantee a recommendation'],
    ['es', 'no se infiere', 'por sí sola establece la disponibilidad', 'garantiza una recomendación'],
  ] as const)('states the authorized eligibility boundary in %s', (locale, inferenceBoundary, availabilityBoundary, recommendationBoundary) => {
    const explanation = personProfileCopy[locale].eligibilityExplanation.toLocaleLowerCase();

    expect(explanation).toContain(inferenceBoundary);
    expect(explanation).toContain(availabilityBoundary);
    expect(explanation).toContain(recommendationBoundary);
    expect(explanation).not.toMatch(/suitable|unsuitable|fit for|inadequad|apto|não apto|not fit/i);
  });

  it.each(['pt-PT', 'en', 'es'] as const)('describes enabled and disabled records as explicit decisions in %s', locale => {
    const labels = personProfileCopy[locale];
    expect(labels.enabledExplanation).toMatch(/explícita|explicit|explícita/i);
    expect(labels.disabledExplanation).toMatch(/explícita|explicit|explícita/i);
  });
});
