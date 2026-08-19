import { describe, expect, it } from 'vitest';
import {
  assertTenantScope,
  isExplicitlyEligible,
  isPersonAvailableAt,
  normalizeDisplayName,
  recordEligibilityDecision,
  type CongregationPerson,
} from './people';

const basePerson: CongregationPerson = {
  id: 'person-1',
  tenantId: 'congregation-1',
  displayName: 'Carlos Silva',
  active: true,
  availability: [],
  eligibility: [],
};

describe('people domain', () => {
  it('requires explicit eligibility instead of inferring suitability', () => {
    expect(isExplicitlyEligible(basePerson, 'bible-reading')).toBe(false);

    const enabled = recordEligibilityDecision(basePerson, {
      assignmentTypeId: 'bible-reading',
      enabled: true,
      decidedBy: 'elder-1',
      decidedAt: '2026-08-19T20:00:00Z',
    });

    expect(isExplicitlyEligible(enabled, 'bible-reading')).toBe(true);
    expect(isExplicitlyEligible(enabled, 'public-talk-away')).toBe(false);
  });

  it('uses the latest authorized eligibility decision', () => {
    const enabled = recordEligibilityDecision(basePerson, {
      assignmentTypeId: 'bible-reading', enabled: true, decidedBy: 'elder-1', decidedAt: '2026-08-01T10:00:00Z',
    });
    const revoked = recordEligibilityDecision(enabled, {
      assignmentTypeId: 'bible-reading', enabled: false, decidedBy: 'elder-2', decidedAt: '2026-08-15T10:00:00Z',
    });

    expect(isExplicitlyEligible(revoked, 'bible-reading')).toBe(false);
  });

  it('treats away periods as unavailable using an exclusive end boundary', () => {
    const person = {
      ...basePerson,
      availability: [{ startsAt: '2026-09-12T00:00:00Z', endsAt: '2026-09-22T00:00:00Z', reasonCode: 'away' as const }],
    };

    expect(isPersonAvailableAt(person, '2026-09-11T23:59:59Z')).toBe(true);
    expect(isPersonAvailableAt(person, '2026-09-12T00:00:00Z')).toBe(false);
    expect(isPersonAvailableAt(person, '2026-09-21T23:59:59Z')).toBe(false);
    expect(isPersonAvailableAt(person, '2026-09-22T00:00:00Z')).toBe(true);
  });

  it('blocks inactive people regardless of absence data', () => {
    expect(isPersonAvailableAt({ ...basePerson, active: false }, '2026-08-19T20:00:00Z')).toBe(false);
  });

  it('rejects cross-tenant access', () => {
    expect(() => assertTenantScope(basePerson, 'congregation-2')).toThrow('Cross-tenant person access denied');
    expect(() => assertTenantScope(basePerson, 'congregation-1')).not.toThrow();
  });

  it('normalizes safe display names without changing identity data semantics', () => {
    expect(normalizeDisplayName('  Carlos   Silva  ')).toBe('Carlos Silva');
    expect(() => normalizeDisplayName(' ')).toThrow();
  });
});
