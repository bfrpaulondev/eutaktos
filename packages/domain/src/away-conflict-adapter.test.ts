import { describe, expect, it } from 'vitest';
import { unavailableIntervalsForPeople, unavailableIntervalsForPerson } from './away-conflict-adapter';
import type { CongregationPerson } from './people';

function person(tenantId = 'tenant-a'): CongregationPerson {
  return {
    id: 'p1', tenantId, displayName: 'Person One', active: true, eligibility: [],
    availability: [{ id: 'away-1', startsAt: '2026-08-21T00:00:00.000Z', endsAt: '2026-08-22T00:00:00.000Z', reasonCode: 'away' }],
  };
}

describe('away conflict adapter', () => {
  it('preserves tenant and person ids', () => {
    expect(unavailableIntervalsForPerson(person(), 'tenant-a')).toEqual([{
      tenantId: 'tenant-a', personId: 'p1', sourceId: 'away-1',
      startsAt: '2026-08-21T00:00:00.000Z', endsAt: '2026-08-22T00:00:00.000Z',
    }]);
  });

  it('rejects cross-tenant person access', () => {
    expect(() => unavailableIntervalsForPerson(person('tenant-b'), 'tenant-a')).toThrow('Cross-tenant person access denied');
  });

  it('filters a mixed collection to the requested tenant', () => {
    const a = person('tenant-a');
    const b = { ...person('tenant-b'), id: 'p2' };
    expect(unavailableIntervalsForPeople([a, b], 'tenant-a')).toHaveLength(1);
    expect(unavailableIntervalsForPeople([a, b], 'tenant-a')[0].tenantId).toBe('tenant-a');
  });

  it('uses a deterministic legacy source id when availability id is absent', () => {
    const value = person();
    value.availability = [{ startsAt: '2026-08-21T00:00:00.000Z', endsAt: '2026-08-22T00:00:00.000Z' }];
    expect(unavailableIntervalsForPerson(value, 'tenant-a')[0].sourceId).toBe('legacy:p1:0');
  });

  it('rejects invalid periods', () => {
    const value = person();
    value.availability = [{ startsAt: '2026-08-22T00:00:00.000Z', endsAt: '2026-08-21T00:00:00.000Z' }];
    expect(() => unavailableIntervalsForPerson(value, 'tenant-a')).toThrow('must end after');
  });
});
