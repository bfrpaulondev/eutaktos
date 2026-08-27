import { describe, expect, it } from 'vitest';
import type { CongregationPerson } from '@eutaktos/domain';
import { buildAuthorizedHourglassIndex } from './hourglass-index-model';

function person(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-1',
    displayName: 'Ana Exemplo',
    active: true,
    externalIds: ['hourglass:publisher:10', 'other:legacy:10'],
    availability: [{ id: 'away-1', startsAt: '2030-01-01T00:00:00.000Z', endsAt: '2030-01-02T00:00:00.000Z', reasonCode: 'away' }],
    eligibility: [
      { assignmentTypeId: 'hourglass:Oração', enabled: true, decidedBy: 'actor-1', decidedAt: '2026-01-01T00:00:00.000Z' },
      { assignmentTypeId: 'hourglass:Vídeo', enabled: true, decidedBy: 'actor-1', decidedAt: '2026-01-01T00:00:00.000Z' },
      { assignmentTypeId: 'hourglass:Vídeo', enabled: false, decidedBy: 'actor-2', decidedAt: '2026-02-01T00:00:00.000Z' },
      { assignmentTypeId: 'reading', enabled: true, decidedBy: 'actor-1', decidedAt: '2026-01-01T00:00:00.000Z' },
    ],
    ordinaryContact: { phone: '+351000000000', email: 'private@example.invalid', address: 'Private address' },
    emergencyContacts: [{ id: 'ec-1', name: 'Private contact', phone: '+351111111111' }],
    ...overrides,
  };
}

describe('authorized Hourglass identity index', () => {
  it('exports only linked Hourglass identity and currently enabled Hourglass eligibility', () => {
    const value = buildAuthorizedHourglassIndex([person()]);
    expect(value).toEqual([{
      externalId: 'hourglass:publisher:10',
      personId: 'person-1',
      displayName: 'Ana Exemplo',
      active: true,
      explicitAssignmentTypeIds: ['hourglass:Oração'],
    }]);
    expect(JSON.stringify(value)).not.toContain('private@example.invalid');
    expect(JSON.stringify(value)).not.toContain('+351');
    expect(JSON.stringify(value)).not.toContain('tenant-1');
    expect(JSON.stringify(value)).not.toContain('away-1');
    expect(JSON.stringify(value)).not.toContain('reading');
  });

  it('fails closed when two persisted people claim the same stable Hourglass id', () => {
    expect(() => buildAuthorizedHourglassIndex([
      person(),
      person({ id: 'person-2', displayName: 'Outra pessoa', externalIds: ['hourglass:publisher:10'] }),
    ])).toThrow('Duplicate existing Hourglass external id');
  });
});
