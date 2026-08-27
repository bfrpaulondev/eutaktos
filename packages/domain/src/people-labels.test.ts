import { describe, expect, it } from 'vitest';
import { labelsOf, normalizePersonLabels, type CongregationPerson } from './people';

describe('person labels', () => {
  it('normalizes, de-duplicates case-insensitively and orders explicit labels', () => {
    expect(normalizePersonLabels(['  Visita  ', 'urgente', 'VISITA', 'Apoio local'])).toEqual([
      'Apoio local',
      'urgente',
      'Visita',
    ]);
  });

  it('fails closed on oversized, empty and control-character labels', () => {
    expect(() => normalizePersonLabels([''])).toThrow('label is required');
    expect(() => normalizePersonLabels(['x'.repeat(41)])).toThrow('label is too long');
    expect(() => normalizePersonLabels(['safe\u0000unsafe'])).toThrow('control characters');
    expect(() => normalizePersonLabels(Array.from({ length: 21 }, (_, index) => `label-${index}`))).toThrow('cannot exceed 20');
  });

  it('treats legacy people without labels as an empty label set', () => {
    const person: CongregationPerson = {
      id: 'p1', tenantId: 't1', displayName: 'Ana', active: true,
      availability: [], eligibility: [],
    };
    expect(labelsOf(person)).toEqual([]);
  });
});