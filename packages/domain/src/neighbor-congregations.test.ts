import { describe, it, expect } from 'vitest';
import {
  createNeighborCongregation,
  updateNeighborCongregation,
  deactivateNeighborCongregation,
  activateNeighborCongregation,
  assertNeighborCongregationTenant,
  filterNeighborCongregationsByTenant,
  filterActiveNeighborCongregations,
  filterByKind,
  filterByLanguage,
  orderByName,
  validateNeighborCongregation,
  NEIGHBOR_KINDS,
} from './neighbor-congregations';
import type { NeighborCongregation, NeighborCongregationInput } from './neighbor-congregations';

const NOW = '2026-08-21T12:00:00.000Z';
const T1 = 'tenant-aaa';
const T2 = 'tenant-bbb';

function make(overrides?: Partial<NeighborCongregationInput>): Readonly<NeighborCongregation> {
  return createNeighborCongregation({
    id: 'nc-1',
    tenantId: T1,
    name: 'Bethel Congregation',
    meetingDay: 0,
    meetingTime: '10:00',
    timezone: 'America/New_York',
    language: 'en',
    kind: 'nearby',
    now: NOW,
    ...overrides,
  });
}

// ── NEIGHBOR_KINDS constant ─────────────────────────────────────────────

describe('NEIGHBOR_KINDS constant', () => {
  it('contains exactly three kinds', () => {
    expect(NEIGHBOR_KINDS).toHaveLength(3);
  });
  it('is frozen', () => {
    expect(Object.isFrozen(NEIGHBOR_KINDS)).toBe(true);
  });
  it('contains the expected values', () => {
    expect(NEIGHBOR_KINDS).toEqual(['nearby', 'regional', 'long-distance']);
  });
});

// ── createNeighborCongregation ───────────────────────────────────────────

describe('createNeighborCongregation', () => {
  it('creates a valid congregation with all required fields', () => {
    const nc = make();
    expect(nc.id).toBe('nc-1');
    expect(nc.tenantId).toBe(T1);
    expect(nc.name).toBe('Bethel Congregation');
    expect(nc.meetingDay).toBe(0);
    expect(nc.meetingTime).toBe('10:00');
    expect(nc.timezone).toBe('America/New_York');
    expect(nc.language).toBe('en');
    expect(nc.kind).toBe('nearby');
    expect(nc.active).toBe(true);
    expect(nc.createdAt).toBe(NOW);
    expect(nc.updatedAt).toBe(NOW);
  });

  it('defaults optional fields to null/empty', () => {
    const nc = make();
    expect(nc.externalReferenceId).toBeNull();
    expect(nc.meetingLocation).toBeNull();
    expect(nc.contactPersonId).toBeNull();
    expect(nc.notes).toBe('');
  });

  it('accepts optional fields', () => {
    const nc = make({
      externalReferenceId: 'ext-42',
      meetingLocation: '123 Main St, Springfield',
      contactPersonId: 'person-1',
      notes: 'Preferred for Spanish talks',
    });
    expect(nc.externalReferenceId).toBe('ext-42');
    expect(nc.meetingLocation).toBe('123 Main St, Springfield');
    expect(nc.contactPersonId).toBe('person-1');
    expect(nc.notes).toBe('Preferred for Spanish talks');
  });

  it('normalizes whitespace in name', () => {
    const nc = make({ name: '  Bethel   Congregation  ' });
    expect(nc.name).toBe('Bethel Congregation');
  });

  it('normalizes whitespace in meetingLocation', () => {
    const nc = make({ meetingLocation: '  123   Main   St  ' });
    expect(nc.meetingLocation).toBe('123 Main St');
  });

  it('returns a frozen object', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('trims empty meetingLocation to null', () => {
    const nc = make({ meetingLocation: '   ' });
    expect(nc.meetingLocation).toBeNull();
  });

  it('trims empty externalReferenceId to null', () => {
    const nc = make({ externalReferenceId: '   ' });
    expect(nc.externalReferenceId).toBeNull();
  });

  it('trims empty contactPersonId to null', () => {
    const nc = make({ contactPersonId: '   ' });
    expect(nc.contactPersonId).toBeNull();
  });
});

// ── Validation errors on creation ───────────────────────────────────────

describe('createNeighborCongregation - validation errors', () => {
  it('throws on missing id', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws on missing tenantId', () => {
    expect(() => make({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on missing name', () => {
    expect(() => make({ name: '' })).toThrow('name is required');
  });

  it('throws on non-string name', () => {
    expect(() => make({ name: 42 as any })).toThrow('name must be a string');
  });

  it('throws on invalid meetingDay (< 0)', () => {
    expect(() => make({ meetingDay: -1 as any })).toThrow('meetingDay must be between 0 and 6');
  });

  it('throws on invalid meetingDay (> 6)', () => {
    expect(() => make({ meetingDay: 7 as any })).toThrow('meetingDay must be between 0 and 6');
  });

  it('throws on non-integer meetingDay', () => {
    expect(() => make({ meetingDay: 2.5 as any })).toThrow('meetingDay must be between 0 and 6');
  });

  it('throws on invalid meetingTime format', () => {
    expect(() => make({ meetingTime: '10:00:00' })).toThrow('HH:mm format');
  });

  it('throws on invalid meetingTime hour', () => {
    expect(() => make({ meetingTime: '25:00' })).toThrow('HH:mm format');
  });

  it('throws on invalid timezone', () => {
    expect(() => make({ timezone: 'Invalid/Zone' })).toThrow('valid IANA timezone');
  });

  it('throws on invalid language', () => {
    expect(() => make({ language: '!!!' })).toThrow('valid BCP 47');
  });

  it('throws on invalid kind', () => {
    expect(() => make({ kind: 'unknown' as any })).toThrow('kind must be one of');
  });

  it('throws on notes exceeding 500 characters', () => {
    expect(() => make({ notes: 'a'.repeat(501) })).toThrow('at most 500 characters');
  });

  it('throws on meetingLocation exceeding 300 characters', () => {
    expect(() => make({ meetingLocation: 'a'.repeat(301) })).toThrow('at most 300 characters');
  });

  it('throws on invalid now', () => {
    expect(() => make({ now: 'not-a-date' })).toThrow('Invalid ISO date');
  });

  it('accepts notes at exactly 500 characters', () => {
    const nc = make({ notes: 'a'.repeat(500) });
    expect(nc.notes).toBe('a'.repeat(500));
  });
});

// ── validateNeighborCongregation (standalone) ────────────────────────────

describe('validateNeighborCongregation', () => {
  it('does not throw on valid input', () => {
    const input: NeighborCongregationInput = {
      id: 'nc-1', tenantId: T1, name: 'Bethel Congregation', meetingDay: 0,
      meetingTime: '10:00', timezone: 'America/New_York', language: 'en',
      kind: 'nearby', now: NOW,
    };
    expect(() => validateNeighborCongregation(input)).not.toThrow();
  });

  it('throws on missing field', () => {
    expect(() => validateNeighborCongregation({ id: '', tenantId: T1, name: 'X', meetingDay: 0, meetingTime: '10:00', timezone: 'UTC', language: 'en', kind: 'nearby', now: NOW } as any)).toThrow();
  });
});

// ── updateNeighborCongregation ──────────────────────────────────────────

describe('updateNeighborCongregation', () => {
  it('updates name', () => {
    const updated = updateNeighborCongregation(make(), { name: 'New Name' }, NOW);
    expect(updated.name).toBe('New Name');
  });

  it('updates multiple fields', () => {
    const updated = updateNeighborCongregation(make(), {
      name: 'Updated',
      meetingDay: 6,
      meetingTime: '14:30',
      kind: 'regional',
      notes: 'new notes',
    }, NOW);
    expect(updated.name).toBe('Updated');
    expect(updated.meetingDay).toBe(6);
    expect(updated.meetingTime).toBe('14:30');
    expect(updated.kind).toBe('regional');
    expect(updated.notes).toBe('new notes');
  });

  it('updates updatedAt', () => {
    const updated = updateNeighborCongregation(make(), { name: 'Updated' }, '2026-08-22T08:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-08-22T08:00:00.000Z');
  });

  it('preserves unchanged fields', () => {
    const nc = make({ notes: 'original', meetingDay: 3 });
    const updated = updateNeighborCongregation(nc, { name: 'Changed' }, NOW);
    expect(updated.notes).toBe('original');
    expect(updated.meetingDay).toBe(3);
    expect(updated.tenantId).toBe(T1);
    expect(updated.id).toBe('nc-1');
    expect(updated.createdAt).toBe(NOW);
  });

  it('returns a frozen object', () => {
    const updated = updateNeighborCongregation(make(), { name: 'X' }, NOW);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('validates updated fields', () => {
    expect(() => updateNeighborCongregation(make(), { meetingTime: 'bad' } as any, NOW)).toThrow('HH:mm format');
  });

  it('validates now parameter', () => {
    expect(() => updateNeighborCongregation(make(), { name: 'X' }, 'invalid')).toThrow('Invalid ISO date');
  });

  it('can clear meetingLocation by setting null', () => {
    const nc = make({ meetingLocation: '123 Main St' });
    const updated = updateNeighborCongregation(nc, { meetingLocation: null }, NOW);
    expect(updated.meetingLocation).toBeNull();
  });

  it('can clear contactPersonId by setting null', () => {
    const nc = make({ contactPersonId: 'person-1' });
    const updated = updateNeighborCongregation(nc, { contactPersonId: null }, NOW);
    expect(updated.contactPersonId).toBeNull();
  });

  it('can clear externalReferenceId by setting null', () => {
    const nc = make({ externalReferenceId: 'ext-1' });
    const updated = updateNeighborCongregation(nc, { externalReferenceId: null }, NOW);
    expect(updated.externalReferenceId).toBeNull();
  });

  it('validates timezone on update', () => {
    expect(() => updateNeighborCongregation(make(), { timezone: 'Bad/Zone' }, NOW)).toThrow('IANA');
  });

  it('validates language on update', () => {
    expect(() => updateNeighborCongregation(make(), { language: '!!!' }, NOW)).toThrow('BCP 47');
  });

  it('validates kind on update', () => {
    expect(() => updateNeighborCongregation(make(), { kind: 'invalid' as any }, NOW)).toThrow('kind must be one of');
  });

  it('validates notes length on update', () => {
    expect(() => updateNeighborCongregation(make(), { notes: 'x'.repeat(501) }, NOW)).toThrow('500 characters');
  });

  it('does not mutate the original', () => {
    const original = make();
    updateNeighborCongregation(original, { name: 'Mutated?' }, NOW);
    expect(original.name).toBe('Bethel Congregation');
  });
});

// ── deactivateNeighborCongregation ──────────────────────────────────────

describe('deactivateNeighborCongregation', () => {
  it('sets active to false', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    expect(deactivated.active).toBe(false);
  });

  it('updates updatedAt', () => {
    const deactivated = deactivateNeighborCongregation(make(), '2026-09-01T00:00:00.000Z');
    expect(deactivated.updatedAt).toBe('2026-09-01T00:00:00.000Z');
  });

  it('is idempotent (already inactive returns same ref)', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    const again = deactivateNeighborCongregation(deactivated, '2026-09-02T00:00:00.000Z');
    expect(again).toBe(deactivated);
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(deactivateNeighborCongregation(make(), NOW))).toBe(true);
  });

  it('validates now', () => {
    expect(() => deactivateNeighborCongregation(make(), 'bad')).toThrow('Invalid ISO date');
  });
});

// ── activateNeighborCongregation ────────────────────────────────────────

describe('activateNeighborCongregation', () => {
  it('sets active to true', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    const activated = activateNeighborCongregation(deactivated, NOW);
    expect(activated.active).toBe(true);
  });

  it('updates updatedAt', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    const activated = activateNeighborCongregation(deactivated, '2026-10-01T00:00:00.000Z');
    expect(activated.updatedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('is idempotent (already active returns same ref)', () => {
    const nc = make();
    const activated = activateNeighborCongregation(nc, '2026-09-02T00:00:00.000Z');
    expect(activated).toBe(nc);
  });

  it('returns frozen object', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    expect(Object.isFrozen(activateNeighborCongregation(deactivated, NOW))).toBe(true);
  });

  it('validates now', () => {
    const deactivated = deactivateNeighborCongregation(make(), NOW);
    expect(() => activateNeighborCongregation(deactivated, 'bad')).toThrow('Invalid ISO date');
  });
});

// ── assertNeighborCongregationTenant ────────────────────────────────────

describe('assertNeighborCongregationTenant', () => {
  it('does not throw for matching tenant', () => {
    expect(() => assertNeighborCongregationTenant(make(), T1)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    expect(() => assertNeighborCongregationTenant(make(), T2)).toThrow('Cross-tenant');
  });
});

// ── filterNeighborCongregationsByTenant ──────────────────────────────────

describe('filterNeighborCongregationsByTenant', () => {
  it('filters by tenant', () => {
    const list = [
      make({ id: 'nc-1', tenantId: T1 }),
      make({ id: 'nc-2', tenantId: T2, name: 'Other Congregation' }),
      make({ id: 'nc-3', tenantId: T1, name: 'Third Congregation' }),
    ];
    const filtered = filterNeighborCongregationsByTenant(list, T1);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(c => c.tenantId === T1)).toBe(true);
  });

  it('returns empty for no match', () => {
    const list = [make()];
    const filtered = filterNeighborCongregationsByTenant(list, T2);
    expect(filtered).toHaveLength(0);
  });
});

// ── filterActiveNeighborCongregations ────────────────────────────────────

describe('filterActiveNeighborCongregations', () => {
  it('filters only active', () => {
    const nc1 = make({ id: 'nc-1' });
    const nc2 = deactivateNeighborCongregation(make({ id: 'nc-2', name: 'Inactive' }), NOW);
    const nc3 = make({ id: 'nc-3', name: 'Also Active' });
    const filtered = filterActiveNeighborCongregations([nc1, nc2, nc3]);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(c => c.active)).toBe(true);
  });

  it('returns empty if all inactive', () => {
    const nc1 = deactivateNeighborCongregation(make({ id: 'nc-1' }), NOW);
    const nc2 = deactivateNeighborCongregation(make({ id: 'nc-2', name: 'B' }), NOW);
    expect(filterActiveNeighborCongregations([nc1, nc2])).toHaveLength(0);
  });
});

// ── filterByKind ─────────────────────────────────────────────────────────

describe('filterByKind', () => {
  it('filters by kind', () => {
    const list = [
      make({ id: 'nc-1', kind: 'nearby' }),
      make({ id: 'nc-2', kind: 'regional', name: 'Regional' }),
      make({ id: 'nc-3', kind: 'nearby', name: 'Nearby 2' }),
    ];
    const filtered = filterByKind(list, 'nearby');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(c => c.kind === 'nearby')).toBe(true);
  });

  it('returns empty for no match', () => {
    const list = [make({ kind: 'nearby' })];
    expect(filterByKind(list, 'long-distance')).toHaveLength(0);
  });
});

// ── filterByLanguage ─────────────────────────────────────────────────────

describe('filterByLanguage', () => {
  it('filters by language', () => {
    const list = [
      make({ id: 'nc-1', language: 'en' }),
      make({ id: 'nc-2', language: 'es', name: 'Spanish Cong' }),
      make({ id: 'nc-3', language: 'en', name: 'English 2' }),
    ];
    const filtered = filterByLanguage(list, 'en');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(c => c.language === 'en')).toBe(true);
  });

  it('returns empty for no match', () => {
    const list = [make({ language: 'en' })];
    expect(filterByLanguage(list, 'fr')).toHaveLength(0);
  });
});

// ── orderByName ──────────────────────────────────────────────────────────

describe('orderByName', () => {
  it('sorts alphabetically', () => {
    const list = [
      make({ id: 'nc-1', name: 'Zion Congregation' }),
      make({ id: 'nc-2', name: 'Alpha Congregation' }),
      make({ id: 'nc-3', name: 'Middle Congregation' }),
    ];
    const sorted = orderByName(list);
    expect(sorted.map(c => c.name)).toEqual(['Alpha Congregation', 'Middle Congregation', 'Zion Congregation']);
  });

  it('is case-insensitive', () => {
    const list = [
      make({ id: 'nc-1', name: 'beta' }),
      make({ id: 'nc-2', name: 'Alpha' }),
    ];
    const sorted = orderByName(list);
    expect(sorted[0].name).toBe('Alpha');
  });

  it('returns a new array (does not mutate)', () => {
    const list = [make()];
    const sorted = orderByName(list);
    expect(sorted).not.toBe(list);
  });
});

// ── Tenant isolation ─────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('congregations from different tenants never mix in filter', () => {
    const t1List = [
      make({ id: 'nc-1', tenantId: T1 }),
      make({ id: 'nc-2', tenantId: T1, name: 'B' }),
    ];
    const t2List = [
      make({ id: 'nc-3', tenantId: T2, name: 'C' }),
    ];
    const combined = [...t1List, ...t2List];
    expect(filterNeighborCongregationsByTenant(combined, T1)).toHaveLength(2);
    expect(filterNeighborCongregationsByTenant(combined, T2)).toHaveLength(1);
  });

  it('assert prevents cross-tenant access', () => {
    const nc = make({ tenantId: T1 });
    expect(() => assertNeighborCongregationTenant(nc, T2)).toThrow('Cross-tenant');
  });
});

// ── Immutability ─────────────────────────────────────────────────────────

describe('immutability', () => {
  it('create returns frozen', () => {
    expect(Object.isFrozen(make())).toBe(true);
  });

  it('update returns frozen', () => {
    expect(Object.isFrozen(updateNeighborCongregation(make(), { name: 'X' }, NOW))).toBe(true);
  });

  it('deactivate returns frozen', () => {
    expect(Object.isFrozen(deactivateNeighborCongregation(make(), NOW))).toBe(true);
  });

  it('activate returns frozen', () => {
    const d = deactivateNeighborCongregation(make(), NOW);
    expect(Object.isFrozen(activateNeighborCongregation(d, NOW))).toBe(true);
  });

  it('all properties are readonly', () => {
    const nc = make();
    expect(() => {
      (nc as any).name = 'hacked';
    }).toThrow();
  });

  it('update does not mutate original', () => {
    const original = make();
    updateNeighborCongregation(original, { name: 'Mutated' }, NOW);
    expect(original.name).toBe('Bethel Congregation');
  });

  it('deactivate does not mutate original', () => {
    const original = make();
    deactivateNeighborCongregation(original, NOW);
    expect(original.active).toBe(true);
  });
});

// ── Timezone validation ──────────────────────────────────────────────────

describe('timezone validation', () => {
  it('accepts America/New_York', () => {
    expect(() => make({ timezone: 'America/New_York' })).not.toThrow();
  });

  it('accepts Europe/London', () => {
    expect(() => make({ timezone: 'Europe/London' })).not.toThrow();
  });

  it('accepts UTC', () => {
    expect(() => make({ timezone: 'UTC' })).not.toThrow();
  });

  it('rejects nonsense timezone', () => {
    expect(() => make({ timezone: 'Foo/Bar/Baz' })).toThrow('IANA');
  });

  it('rejects empty timezone', () => {
    expect(() => make({ timezone: '' })).toThrow('timezone is required');
  });
});

// ── Language validation ──────────────────────────────────────────────────

describe('language validation', () => {
  it('accepts en', () => {
    expect(() => make({ language: 'en' })).not.toThrow();
  });

  it('accepts es', () => {
    expect(() => make({ language: 'es' })).not.toThrow();
  });

  it('accepts pt-BR', () => {
    expect(() => make({ language: 'pt-BR' })).not.toThrow();
  });

  it('accepts zh-Hans', () => {
    expect(() => make({ language: 'zh-Hans' })).not.toThrow();
  });

  it('rejects invalid language tag', () => {
    expect(() => make({ language: '!!!' })).toThrow('BCP 47');
  });

  it('rejects empty language', () => {
    expect(() => make({ language: '' })).toThrow('language is required');
  });
});

// ── Adversarial tests ────────────────────────────────────────────────────

describe('adversarial tests', () => {
  it('rejects PII-like phone in notes (no enforcement, but notes is limited)', () => {
    // The model does NOT enforce PII scrubbing (that belongs to a separate layer)
    // But notes is capped at 500 chars
    expect(() => make({ notes: 'Call me at 555-1234' })).not.toThrow();
  });

  it('rejects object injection via id field', () => {
    expect(() => make({ id: { toString: () => 'nc-1' } as any })).toThrow('must be a string');
  });

  it('rejects array as name', () => {
    expect(() => make({ name: ['bad'] as any })).toThrow('must be a string');
  });

  it('handles undefined now gracefully', () => {
    expect(() => make({ now: undefined as any })).toThrow('Invalid ISO date');
  });

  it('handles null now gracefully', () => {
    expect(() => make({ now: null as any })).toThrow('Invalid ISO date');
  });

  it('handles numeric id gracefully', () => {
    expect(() => make({ id: 123 as any })).toThrow('must be a string');
  });

  it('handles prototype pollution attempt in notes', () => {
    const nc = make({ notes: '__proto__' });
    expect(nc.notes).toBe('__proto__');
  });

  it('update with empty changes returns new object with updated timestamp', () => {
    const nc = make();
    const updated = updateNeighborCongregation(nc, {}, '2026-09-01T00:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(updated).not.toBe(nc);
  });

  it('very long name is accepted if valid', () => {
    const longName = 'A'.repeat(300);
    const nc = make({ name: longName });
    expect(nc.name).toBe(longName);
  });
});

// ── Meeting time edge cases ─────────────────────────────────────────────

describe('meeting time edge cases', () => {
  it('accepts 00:00', () => {
    expect(() => make({ meetingTime: '00:00' })).not.toThrow();
  });

  it('accepts 23:59', () => {
    expect(() => make({ meetingTime: '23:59' })).not.toThrow();
  });

  it('rejects 24:00', () => {
    expect(() => make({ meetingTime: '24:00' })).toThrow('HH:mm format');
  });

  it('rejects 12:60', () => {
    expect(() => make({ meetingTime: '12:60' })).toThrow('HH:mm format');
  });

  it('rejects empty meetingTime', () => {
    expect(() => make({ meetingTime: '' })).toThrow('HH:mm format');
  });

  it('rejects non-string meetingTime', () => {
    expect(() => make({ meetingTime: 1000 as any })).toThrow('HH:mm format');
  });
});

// ── Weekday edge cases ──────────────────────────────────────────────────

describe('weekday edge cases', () => {
  for (let d = 0; d <= 6; d++) {
    it(`accepts weekday ${d}`, () => {
      expect(() => make({ meetingDay: d as any })).not.toThrow();
    });
  }
});

// ── Filter combinators ──────────────────────────────────────────────────

describe('filter combinators', () => {
  it('can chain active + tenant + kind filters', () => {
    const list = [
      make({ id: 'nc-1', tenantId: T1, kind: 'nearby' }),
      deactivateNeighborCongregation(make({ id: 'nc-2', tenantId: T1, kind: 'nearby', name: 'Inactive' }), NOW),
      make({ id: 'nc-3', tenantId: T1, kind: 'regional', name: 'Regional Active' }),
      make({ id: 'nc-4', tenantId: T2, kind: 'nearby', name: 'Other Tenant' }),
    ];
    const result = filterByKind(
      filterActiveNeighborCongregations(
        filterNeighborCongregationsByTenant(list, T1),
      ),
      'nearby',
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('nc-1');
  });

  it('can chain active + language + order', () => {
    const list = [
      make({ id: 'nc-1', language: 'es', name: 'Zaragoza' }),
      make({ id: 'nc-2', language: 'en', name: 'Alpha' }),
      deactivateNeighborCongregation(make({ id: 'nc-3', language: 'en', name: 'Bravo' }), NOW),
      make({ id: 'nc-4', language: 'en', name: 'Charlie' }),
    ];
    const result = orderByName(
      filterByLanguage(
        filterActiveNeighborCongregations(list),
        'en',
      ),
    );
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Alpha');
    expect(result[1].name).toBe('Charlie');
  });
});
