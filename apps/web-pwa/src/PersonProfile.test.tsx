import { describe, expect, it } from 'vitest';
import { ordinaryContactFieldErrorsFor, personProfileCopy, validateOrdinaryContactDraft } from './PersonProfile';

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

describe('PersonProfile ordinary contact validation', () => {
  const text = personProfileCopy['pt-PT'];

  it('validates canonical normalized limits and email structure before a PUT is attempted', () => {
    expect(validateOrdinaryContactDraft({ phone: 'x'.repeat(41) }, text)).toEqual({ phone: text.contactPhoneTooLong });
    expect(validateOrdinaryContactDraft({ email: 'invalid' }, text)).toEqual({ email: text.contactEmailInvalid });
    expect(validateOrdinaryContactDraft({ email: `a@${'x'.repeat(252)}.pt` }, text)).toEqual({ email: text.contactEmailTooLong });
    expect(validateOrdinaryContactDraft({ address: 'x'.repeat(501) }, text)).toEqual({ address: text.contactAddressTooLong });
    expect(validateOrdinaryContactDraft({ phone: ' +351  900 000 000 ', email: ' person@example.test ', address: ' Rua  Um ' }, text)).toEqual({});
  });

  it('maps only known 400 server validation errors to the matching field', () => {
    expect(ordinaryContactFieldErrorsFor(new Error('ordinaryContactEmail is invalid (400)'), text)).toEqual({ email: text.contactEmailInvalid });
    expect(ordinaryContactFieldErrorsFor(new Error('ordinaryContactAddress is too long (400)'), text)).toEqual({ address: text.contactAddressTooLong });
    expect(ordinaryContactFieldErrorsFor(new Error('Forbidden (403)'), text)).toEqual({});
    expect(ordinaryContactFieldErrorsFor(new Error('Unknown request fields: tenantId (400)'), text)).toEqual({});
  });
});
