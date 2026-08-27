import { describe, expect, it } from 'vitest';
import { inspectHourglassJsonExport } from '@eutaktos/application';
import type { CongregationPerson } from '@eutaktos/domain';
import { buildHourglassPreviewResponse, existingHourglassPeople } from './preview';

function inspection(name = 'Ana Exemplo') {
  const [firstname, ...last] = name.split(' ');
  return inspectHourglassJsonExport({
    publishers: [{ id: 7, firstname, lastname: last.join(' ') || 'Exemplo' }],
    fsGroups: [],
    privileges: { reader: [7] },
  });
}

function person(overrides: Partial<CongregationPerson> = {}): CongregationPerson {
  return {
    id: 'person-1',
    tenantId: 'tenant-a',
    displayName: 'Ana Exemplo',
    active: true,
    externalIds: ['hourglass:publisher:7'],
    availability: [],
    eligibility: [{ assignmentTypeId: 'hourglass:reader', enabled: true, decidedBy: 'actor-1', decidedAt: '2026-08-27T00:00:00.000Z' }],
    emergencyContacts: [],
    ...overrides,
  };
}

describe('PX9.8 Hourglass server reconciliation preview', () => {
  it('matches only an explicitly linked external id inside the tenant', () => {
    const value = buildHourglassPreviewResponse(inspection(), 'tenant-a', [person()]);
    expect(value.counts).toEqual({ create: 0, unchanged: 1, conflict: 0 });
    expect(value.persons[0]).toMatchObject({ displayName: 'Ana Exemplo', action: 'unchanged', linked: true, reasonCodes: [] });
    expect(value.matchingPolicy).toBe('tenant-scoped-external-id-only');
  });

  it('does not match by display name when the stable external reference is absent', () => {
    const value = buildHourglassPreviewResponse(inspection(), 'tenant-a', [person({ externalIds: [] })]);
    expect(value.counts).toEqual({ create: 1, unchanged: 0, conflict: 0 });
    expect(value.persons[0]).toMatchObject({ displayName: 'Ana Exemplo', action: 'create', linked: false });
  });

  it('does not let another tenant own the same Hourglass external id', () => {
    expect(existingHourglassPeople('tenant-a', [person({ tenantId: 'tenant-b' })])).toEqual([]);
    const value = buildHourglassPreviewResponse(inspection(), 'tenant-a', [person({ tenantId: 'tenant-b' })]);
    expect(value.persons[0]?.action).toBe('create');
  });

  it('returns structured conflicts for name and explicit eligibility differences', () => {
    const value = buildHourglassPreviewResponse(inspection('Ana Atualizada'), 'tenant-a', [person({ eligibility: [] })]);
    expect(value.counts.conflict).toBe(1);
    expect(value.persons[0]?.reasonCodes).toEqual(['DISPLAY_NAME_DIFFERS', 'EXPLICIT_ELIGIBILITY_DIFFERS']);
  });

  it('does not expose internal person ids or external source ids in the public preview response', () => {
    const serialized = JSON.stringify(buildHourglassPreviewResponse(inspection(), 'tenant-a', [person()]));
    expect(serialized).not.toContain('person-1');
    expect(serialized).not.toContain('hourglass:publisher:7');
    expect(serialized).not.toContain('tenant-a');
  });
});
