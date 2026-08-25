import { describe, expect, it } from 'vitest';
import { normalizePersonContactDetails } from './people';

describe('ordinary person contact details', () => {
  it('normalizes phone, email and structured postal address without inventing missing fields', () => {
    expect(normalizePersonContactDetails({
      phone: '  +351 912 345 678  ',
      email: ' Bruno.Example@Example.COM ',
      address: { line1: ' Rua Exemplo 1 ', postalCode: ' 2900-000 ', locality: ' Setúbal ', countryCode: 'pt' },
    })).toEqual({
      phone: '+351 912 345 678',
      email: 'bruno.example@example.com',
      address: { line1: 'Rua Exemplo 1', postalCode: '2900-000', locality: 'Setúbal', countryCode: 'PT' },
    });
    expect(normalizePersonContactDetails({ phone: ' ', email: '', address: {} })).toBeUndefined();
  });

  it('rejects malformed email, country and control characters', () => {
    expect(() => normalizePersonContactDetails({ email: 'not-an-email' })).toThrow('contactEmail must be a valid email address');
    expect(() => normalizePersonContactDetails({ address: { countryCode: 'Portugal' } })).toThrow('contactCountryCode is too long');
    expect(() => normalizePersonContactDetails({ phone: '+351\nsecret' })).toThrow('contactPhone contains control characters');
  });
});
