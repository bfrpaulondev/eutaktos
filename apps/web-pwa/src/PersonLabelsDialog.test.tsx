import { describe, expect, it } from 'vitest';
import { labelsDraftValid } from './PersonLabelsDialog';

describe('PersonLabelsDialog', () => {
  it('accepts the canonical label limits', () => {
    expect(labelsDraftValid(['Visita', 'Apoio local'])).toBe(true);
    expect(labelsDraftValid(Array.from({ length: 20 }, (_, index) => `Label ${index}`))).toBe(true);
  });

  it('fails closed on invalid label drafts before mutation', () => {
    expect(labelsDraftValid(['x'.repeat(41)])).toBe(false);
    expect(labelsDraftValid(['bad\u0000label'])).toBe(false);
    expect(labelsDraftValid(Array.from({ length: 21 }, (_, index) => `Label ${index}`))).toBe(false);
  });
});