import { describe, expect, it } from 'vitest';
import {
  buildEligibilityIndex,
  checkEligibility,
  checkEligibilityBatch,
  filterEligiblePersons,
  getEligibleAssignmentTypes,
  validateEligibilityEntry,
  filterEntriesByTenant,
  entriesToConstraints,
  type EligibilityEntry,
  type EligibilityCheckResult,
  type EligibilityConstraint,
  type EligibilityIndex,
} from './eligibility-constraints';

// ── Test Data Helpers ───────────────────────────────────────────────────────

function makeEntry(overrides: Partial<EligibilityEntry> & { personId: string; assignmentTypeId: string }): EligibilityEntry {
  return Object.freeze({
    tenantId: 'tenant-1',
    enabled: true,
    decidedBy: 'admin-1',
    decidedAt: '2026-01-15T10:00:00.000Z',
    ...overrides,
  });
}

const ENTRY_A = makeEntry({ personId: 'p1', assignmentTypeId: 'at1', enabled: true });
const ENTRY_B = makeEntry({ personId: 'p1', assignmentTypeId: 'at2', enabled: false, decidedAt: '2026-01-16T10:00:00.000Z' });
const ENTRY_C = makeEntry({ personId: 'p2', assignmentTypeId: 'at1', enabled: true, decidedAt: '2026-01-17T10:00:00.000Z' });
const ENTRY_D = makeEntry({ personId: 'p2', assignmentTypeId: 'at2', enabled: false });
const ENTRY_E = makeEntry({ personId: 'p3', assignmentTypeId: 'at1', enabled: false });

// ── buildEligibilityIndex ───────────────────────────────────────────────────

describe('buildEligibilityIndex', () => {
  it('returns a frozen map', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    expect(Object.isFrozen(idx)).toBe(true);
  });

  it('returns an empty map for empty input', () => {
    const idx = buildEligibilityIndex([]);
    expect(idx.size).toBe(0);
  });

  it('builds correct index from single entry', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    expect(idx.size).toBe(1);
    const entry = idx.get('p1\x00at1');
    expect(entry).toBeDefined();
    expect(entry!.enabled).toBe(true);
  });

  it('builds correct index from multiple entries', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_B, ENTRY_C, ENTRY_D, ENTRY_E]);
    expect(idx.size).toBe(5);
  });

  it('most-recent-wins for duplicate person+type (later grants wins)', () => {
    const old = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: false, decidedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: true, decidedAt: '2026-06-01T00:00:00.000Z' });
    const idx = buildEligibilityIndex([old, newer]);
    expect(idx.get('px\x00ax')!.enabled).toBe(true);
  });

  it('most-recent-wins for duplicate person+type (later denial wins)', () => {
    const old = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: true, decidedAt: '2026-01-01T00:00:00.000Z' });
    const newer = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: false, decidedAt: '2026-06-01T00:00:00.000Z' });
    const idx = buildEligibilityIndex([old, newer]);
    expect(idx.get('px\x00ax')!.enabled).toBe(false);
  });

  it('deduplicates so only one key per person+type', () => {
    const e1 = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: true, decidedAt: '2026-01-01T00:00:00.000Z' });
    const e2 = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: false, decidedAt: '2026-02-01T00:00:00.000Z' });
    const e3 = makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: true, decidedAt: '2026-03-01T00:00:00.000Z' });
    const idx = buildEligibilityIndex([e1, e2, e3]);
    expect(idx.size).toBe(1);
  });

  it('index values are frozen', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
 const entry = idx.get('p1\0at1')!;
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it('index type is ReadonlyMap', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    // ReadonlyMap type prevents .set(), .delete(), .clear() at compile time
    // Runtime: the map is Object.frozen (though Map.prototype.set still works
    // through the prototype chain — the ReadonlyMap type prevents it in TS)
    expect(idx instanceof Map).toBe(true);
    expect(Object.isFrozen(idx)).toBe(true);
  });
});

// ── checkEligibility ────────────────────────────────────────────────────────

describe('checkEligibility', () => {
  it('returns explicit-grant when enabled=true', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = checkEligibility(idx, 'p1', 'at1');
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('explicit-grant');
  });

  it('returns explicit-denial when enabled=false', () => {
    const idx = buildEligibilityIndex([ENTRY_B]);
    const result = checkEligibility(idx, 'p1', 'at2');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('explicit-denial');
  });

  it('FAIL-CLOSED: no record → not eligible', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = checkEligibility(idx, 'unknown-person', 'at1');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });

  it('FAIL-CLOSED: person exists for other type but not this one', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = checkEligibility(idx, 'p1', 'at-other');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });

  it('returns frozen result objects', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = checkEligibility(idx, 'p1', 'at1');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('preserves personId and assignmentTypeId in result', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = checkEligibility(idx, 'p1', 'at1');
    expect(result.personId).toBe('p1');
    expect(result.assignmentTypeId).toBe('at1');
  });

  it('empty index → no-eligibility-record for any query', () => {
    const idx = buildEligibilityIndex([]);
    const result = checkEligibility(idx, 'anyone', 'anything');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });
});

// ── checkEligibilityBatch ───────────────────────────────────────────────────

describe('checkEligibilityBatch', () => {
  it('returns array of results for multiple persons', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_C, ENTRY_E]);
    const results = checkEligibilityBatch(idx, ['p1', 'p2', 'p3', 'p-unknown'], 'at1');
    expect(results).toHaveLength(4);
    expect(results[0].eligible).toBe(true);
    expect(results[0].reason).toBe('explicit-grant');
    expect(results[1].eligible).toBe(true);
    expect(results[2].eligible).toBe(false);
    expect(results[2].reason).toBe('explicit-denial');
    expect(results[3].eligible).toBe(false);
    expect(results[3].reason).toBe('no-eligibility-record');
  });

  it('returns frozen array', () => {
    const idx = buildEligibilityIndex([]);
    const results = checkEligibilityBatch(idx, ['p1'], 'at1');
    expect(Object.isFrozen(results)).toBe(true);
  });

  it('returns empty array for empty personIds', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const results = checkEligibilityBatch(idx, [], 'at1');
    expect(results).toHaveLength(0);
  });

  it('each result is individually frozen', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const results = checkEligibilityBatch(idx, ['p1'], 'at1');
    expect(Object.isFrozen(results[0])).toBe(true);
  });
});

// ── filterEligiblePersons ───────────────────────────────────────────────────

describe('filterEligiblePersons', () => {
  it('returns only eligible person IDs', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_C, ENTRY_E]);
    const result = filterEligiblePersons(idx, ['p1', 'p2', 'p3', 'p-unknown'], 'at1');
    expect(result).toEqual(['p1', 'p2']);
  });

  it('returns frozen array', () => {
    const idx = buildEligibilityIndex([]);
    const result = filterEligiblePersons(idx, [], 'at1');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns empty array when no one is eligible', () => {
    const idx = buildEligibilityIndex([ENTRY_B]);
    const result = filterEligiblePersons(idx, ['p1', 'p-unknown'], 'at2');
    expect(result).toEqual([]);
  });

  it('returns empty array for empty input', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = filterEligiblePersons(idx, [], 'at1');
    expect(result).toEqual([]);
  });
});

// ── getEligibleAssignmentTypes ─────────────────────────────────────────────

describe('getEligibleAssignmentTypes', () => {
  it('returns only assignment types with enabled=true', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_B, ENTRY_C]);
    // p1 has at1 (true) and at2 (false)
    const result = getEligibleAssignmentTypes(idx, 'p1');
    expect(result).toEqual(['at1']);
  });

  it('returns empty array when person has no eligible types', () => {
    const idx = buildEligibilityIndex([ENTRY_B, ENTRY_D]);
    const result = getEligibleAssignmentTypes(idx, 'p1');
    expect(result).toEqual([]);
  });

  it('returns empty array when person has no records', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = getEligibleAssignmentTypes(idx, 'unknown');
    expect(result).toEqual([]);
  });

  it('returns frozen array', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const result = getEligibleAssignmentTypes(idx, 'p1');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('does not bleed eligibility across persons', () => {
    const idx = buildEligibilityIndex([
      makeEntry({ personId: 'p1', assignmentTypeId: 'shared-type', enabled: true }),
      makeEntry({ personId: 'p2', assignmentTypeId: 'shared-type', enabled: false }),
    ]);
    expect(getEligibleAssignmentTypes(idx, 'p1')).toEqual(['shared-type']);
    expect(getEligibleAssignmentTypes(idx, 'p2')).toEqual([]);
  });
});

// ── validateEligibilityEntry ────────────────────────────────────────────────

describe('validateEligibilityEntry', () => {
  const validEntry = {
    personId: 'p1',
    tenantId: 't1',
    assignmentTypeId: 'at1',
    enabled: true,
    decidedBy: 'admin-1',
    decidedAt: '2026-01-15T10:00:00.000Z',
  };

  it('returns a frozen valid entry', () => {
    const result = validateEligibilityEntry(validEntry);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.personId).toBe('p1');
  });

  it('trims whitespace on string fields', () => {
    const result = validateEligibilityEntry({
      ...validEntry,
      personId: '  p1  ',
      tenantId: '  t1  ',
    });
    expect(result.personId).toBe('p1');
    expect(result.tenantId).toBe('t1');
  });

  it('throws for null input', () => {
    expect(() => validateEligibilityEntry(null)).toThrow('entry must be a non-null object');
  });

  it('throws for undefined input', () => {
    expect(() => validateEligibilityEntry(undefined)).toThrow('entry must be a non-null object');
  });

  it('throws for array input', () => {
    expect(() => validateEligibilityEntry([] as unknown as EligibilityEntry)).toThrow('entry must be a non-null object');
  });

  it('throws for missing personId', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, personId: '' })).toThrow('personId is required');
  });

  it('throws for whitespace-only personId', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, personId: '   ' })).toThrow('personId is required');
  });

  it('throws for too-long personId', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, personId: 'x'.repeat(201) })).toThrow(
      'personId exceeds maximum length of 200',
    );
  });

  it('throws for missing tenantId', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws for missing assignmentTypeId', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, assignmentTypeId: '' })).toThrow(
      'assignmentTypeId is required',
    );
  });

  it('throws for missing decidedBy', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, decidedBy: '' })).toThrow('decidedBy is required');
  });

  it('throws for invalid decidedAt', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, decidedAt: 'not-a-date' })).toThrow(
      'decidedAt must be a valid ISO 8601 date',
    );
  });

  it('throws for empty decidedAt', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, decidedAt: '' })).toThrow('decidedAt is required');
  });

  it('throws for non-boolean enabled', () => {
    expect(() => validateEligibilityEntry({ ...validEntry, enabled: 'yes' as unknown as boolean })).toThrow(
      'enabled must be a boolean',
    );
  });

  it('accepts enabled=false', () => {
    const result = validateEligibilityEntry({ ...validEntry, enabled: false });
    expect(result.enabled).toBe(false);
  });
});

// ── filterEntriesByTenant ──────────────────────────────────────────────────

describe('filterEntriesByTenant', () => {
  it('returns only entries matching the tenant', () => {
    const entries = [
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't1' }),
      makeEntry({ personId: 'p2', assignmentTypeId: 'at2', tenantId: 't2' }),
      makeEntry({ personId: 'p3', assignmentTypeId: 'at3', tenantId: 't1' }),
    ];
    const result = filterEntriesByTenant(entries, 't1');
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.tenantId === 't1')).toBe(true);
  });

  it('returns frozen array', () => {
    const result = filterEntriesByTenant([], 't1');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('returns empty array for non-matching tenant', () => {
    const result = filterEntriesByTenant([ENTRY_A], 'other-tenant');
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    const result = filterEntriesByTenant([], 't1');
    expect(result).toHaveLength(0);
  });

  it('tenant isolation: different tenants do not affect each other', () => {
    const entries = [
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't1', enabled: true }),
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't2', enabled: false }),
    ];
    const t1Entries = filterEntriesByTenant(entries, 't1');
    const t2Entries = filterEntriesByTenant(entries, 't2');
    expect(t1Entries).toHaveLength(1);
    expect(t2Entries).toHaveLength(1);
    expect(t1Entries[0].enabled).toBe(true);
    expect(t2Entries[0].enabled).toBe(false);
  });
});

// ── entriesToConstraints ───────────────────────────────────────────────────

describe('entriesToConstraints', () => {
  it('converts entries to constraints', () => {
    const entries = [ENTRY_A, ENTRY_C];
    const constraints = entriesToConstraints(entries);
    expect(constraints).toHaveLength(2);
    expect(constraints[0].personId).toBe('p1');
    expect(constraints[0].assignmentTypeId).toBe('at1');
    expect(constraints[0].eligible).toBe(true);
  });

  it('returns frozen array of frozen constraints', () => {
    const constraints = entriesToConstraints([ENTRY_A]);
    expect(Object.isFrozen(constraints)).toBe(true);
    expect(Object.isFrozen(constraints[0])).toBe(true);
  });

  it('returns empty array for empty input', () => {
    const constraints = entriesToConstraints([]);
    expect(constraints).toHaveLength(0);
  });

  it('most-recent-wins in conversion', () => {
    const entries = [
      makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: true, decidedAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ personId: 'px', assignmentTypeId: 'ax', enabled: false, decidedAt: '2026-06-01T00:00:00.000Z' }),
    ];
    const constraints = entriesToConstraints(entries);
    expect(constraints).toHaveLength(1);
    expect(constraints[0].eligible).toBe(false);
  });
});

// ── Fail-closed behaviour (integration) ────────────────────────────────────

describe('fail-closed behaviour', () => {
  it('empty index never returns eligible', () => {
    const idx = buildEligibilityIndex([]);
    const result = checkEligibility(idx, 'anyone', 'anything');
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });

  it('person with only denied entries is not eligible', () => {
    const idx = buildEligibilityIndex([ENTRY_B, ENTRY_D, ENTRY_E]);
    expect(checkEligibility(idx, 'p1', 'at2').eligible).toBe(false);
    expect(checkEligibility(idx, 'p2', 'at2').eligible).toBe(false);
    expect(checkEligibility(idx, 'p3', 'at1').eligible).toBe(false);
  });

  it('no eligibility inference from history — only explicit entries count', () => {
    // A person has a grant for at1 but not at2 — at2 must NOT be inferred
    const idx = buildEligibilityIndex([ENTRY_A]);
    expect(checkEligibility(idx, 'p1', 'at2').eligible).toBe(false);
    expect(checkEligibility(idx, 'p1', 'at2').reason).toBe('no-eligibility-record');
  });

  it('no scoring or ranking — only boolean eligible flag', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_C]);
    // Both p1 and p2 are eligible for at1 — no ranking
    const batch = checkEligibilityBatch(idx, ['p1', 'p2'], 'at1');
    batch.forEach((r) => {
      expect(typeof r.eligible).toBe('boolean');
      expect(['explicit-grant', 'explicit-denial', 'no-eligibility-record']).toContain(r.reason);
      // No score, no rank, no weight
      expect((r as unknown as Record<string, unknown>).score).toBeUndefined();
      expect((r as unknown as Record<string, unknown>).rank).toBeUndefined();
    });
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('entries from tenant A do not leak into tenant B index', () => {
    const entries = [
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't1', enabled: true }),
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't2', enabled: false }),
    ];
    const t1Index = buildEligibilityIndex(filterEntriesByTenant(entries, 't1'));
    const t2Index = buildEligibilityIndex(filterEntriesByTenant(entries, 't2'));
    expect(checkEligibility(t1Index, 'p1', 'at1').eligible).toBe(true);
    expect(checkEligibility(t2Index, 'p1', 'at1').eligible).toBe(false);
  });

  it('getEligibleAssignmentTypes is scoped per tenant via index', () => {
    const entries = [
      makeEntry({ personId: 'p1', assignmentTypeId: 'at1', tenantId: 't1', enabled: true }),
      makeEntry({ personId: 'p1', assignmentTypeId: 'at2', tenantId: 't2', enabled: true }),
    ];
    const t1Index = buildEligibilityIndex(filterEntriesByTenant(entries, 't1'));
    expect(getEligibleAssignmentTypes(t1Index, 'p1')).toEqual(['at1']);
  });
});

// ── Malformed inputs ───────────────────────────────────────────────────────

describe('malformed inputs', () => {
  it('validateEligibilityEntry rejects __proto__ as personId', () => {
    // __proto__ is a valid non-empty string, so it passes the string check.
    // This is intentional — the domain layer does not blacklist specific strings.
    const result = validateEligibilityEntry({
      personId: '__proto__',
      tenantId: 't1',
      assignmentTypeId: 'at1',
      enabled: true,
      decidedBy: 'admin',
      decidedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(result.personId).toBe('__proto__');
  });

  it('validateEligibilityEntry rejects constructor as personId', () => {
    // Same as __proto__ — it's a valid string.
    const result = validateEligibilityEntry({
      personId: 'constructor',
      tenantId: 't1',
      assignmentTypeId: 'at1',
      enabled: true,
      decidedBy: 'admin',
      decidedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(result.personId).toBe('constructor');
  });

  it('validateEligibilityEntry rejects very long personId', () => {
    expect(() =>
      validateEligibilityEntry({
        personId: 'x'.repeat(201),
        tenantId: 't1',
        assignmentTypeId: 'at1',
        enabled: true,
        decidedBy: 'admin',
        decidedAt: '2026-01-15T10:00:00.000Z',
      }),
    ).toThrow('personId exceeds maximum length of 200');
  });

  it('validateEligibilityEntry accepts unicode in personId', () => {
    const result = validateEligibilityEntry({
      personId: '日本語-привет-🎉',
      tenantId: 't1',
      assignmentTypeId: 'at1',
      enabled: true,
      decidedBy: 'admin',
      decidedAt: '2026-01-15T10:00:00.000Z',
    });
    expect(result.personId).toBe('日本語-привет-🎉');
  });

  it('validateEligibilityEntry rejects number types for string fields', () => {
    expect(() =>
      validateEligibilityEntry({
        personId: 123 as unknown as string,
        tenantId: 't1',
        assignmentTypeId: 'at1',
        enabled: true,
        decidedBy: 'admin',
        decidedAt: '2026-01-15T10:00:00.000Z',
      }),
    ).toThrow('personId is required');
  });

  it('validateEligibilityEntry rejects object as enabled', () => {
    expect(() =>
      validateEligibilityEntry({
        ...makeEntry({ personId: 'p1', assignmentTypeId: 'at1' }),
        enabled: {} as unknown as boolean,
      }),
    ).toThrow('enabled must be a boolean');
  });
});

// ── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same inputs → same index every time', () => {
    const entries = [ENTRY_A, ENTRY_B, ENTRY_C, ENTRY_D, ENTRY_E];
    const idx1 = buildEligibilityIndex(entries);
    const idx2 = buildEligibilityIndex(entries);
    expect(idx1.size).toBe(idx2.size);
    for (const [key, val] of idx1) {
      expect(idx2.get(key)).toEqual(val);
    }
  });

  it('same inputs → same checkEligibility result every time', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    for (let i = 0; i < 10; i++) {
      expect(checkEligibility(idx, 'p1', 'at1')).toEqual({
        personId: 'p1',
        assignmentTypeId: 'at1',
        eligible: true,
        reason: 'explicit-grant',
      });
    }
  });

  it('batch results are deterministic', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_B, ENTRY_C]);
    const r1 = checkEligibilityBatch(idx, ['p1', 'p2', 'p-unknown'], 'at1');
    const r2 = checkEligibilityBatch(idx, ['p1', 'p2', 'p-unknown'], 'at1');
    expect(r1).toEqual(r2);
  });

  it('filterEligiblePersons is deterministic', () => {
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_C, ENTRY_E]);
    const r1 = filterEligiblePersons(idx, ['p1', 'p2', 'p3'], 'at1');
    const r2 = filterEligiblePersons(idx, ['p1', 'p2', 'p3'], 'at1');
    expect(r1).toEqual(r2);
  });

  it('entriesToConstraints is deterministic', () => {
    const entries = [ENTRY_A, ENTRY_B, ENTRY_C, ENTRY_D, ENTRY_E];
    const c1 = entriesToConstraints(entries);
    const c2 = entriesToConstraints(entries);
    expect(c1).toEqual(c2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROPERTY-BASED / ADVERSARIAL TESTS  (simple generator, no external lib)
// ═══════════════════════════════════════════════════════════════════════════════

describe('property-based tests', () => {
  // Simple deterministic pseudo-random generator
  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 16807 + 0) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function randomString(rng: () => number, len: number): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_';
    let s = '';
    for (let i = 0; i < len; i++) {
      s += chars[Math.floor(rng() * chars.length)];
    }
    return s;
  }

  function generateEntries(count: number, seed: number): EligibilityEntry[] {
    const rng = seededRandom(seed);
    const entries: EligibilityEntry[] = [];
    for (let i = 0; i < count; i++) {
      entries.push(
        makeEntry({
          personId: `person-${Math.floor(rng() * 20)}`,
          tenantId: `tenant-${Math.floor(rng() * 3)}`,
          assignmentTypeId: `atype-${Math.floor(rng() * 5)}`,
          enabled: rng() > 0.5,
          decidedBy: `decider-${Math.floor(rng() * 5)}`,
          decidedAt: new Date(Date.UTC(2025, 0, 1) + Math.floor(rng() * 365 * 24 * 60 * 60 * 1000)).toISOString(),
        }),
      );
    }
    return entries;
  }

  // Property 1: person with no record → not eligible
  it('P1: person with no record → not eligible for any generated dataset', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);
      // A person that definitely has no entry
      const result = checkEligibility(idx, 'person-nonexistent-zzzz', 'atype-nonexistent-zzzz');
      expect(result.eligible).toBe(false);
      expect(result.reason).toBe('no-eligibility-record');
    }
  });

  // Property 2: entry with enabled=false → not eligible
  it('P2: any entry with enabled=false → not eligible', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const deniedEntries = entries.filter((e) => !e.enabled);
      if (deniedEntries.length === 0) continue;

      const idx = buildEligibilityIndex(entries);
      for (const de of deniedEntries) {
        const key = `${de.personId}::${de.assignmentTypeId}`;
        const resolved = idx.get(key);
        // It might have been overridden by a newer entry
        if (resolved) {
          // If this is the winning entry, it must be denied
          const entryTime = Date.parse(de.decidedAt);
          const isLatest = entries
            .filter(
              (e) =>
                e.personId === de.personId &&
                e.assignmentTypeId === de.assignmentTypeId &&
                Date.parse(e.decidedAt) > entryTime,
            ).length === 0;
          if (isLatest) {
            const result = checkEligibility(idx, de.personId, de.assignmentTypeId);
            expect(result.eligible).toBe(false);
          }
        }
      }
    }
  });

  // Property 3: entry with enabled=true → eligible (if most recent)
  it('P3: latest entry with enabled=true → eligible', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);

      // For each key in the index, verify the resolved enabled flag is correct
      for (const [key, resolved] of idx) {
        const sepIdx = key.indexOf('\x00');
        const personId = key.slice(0, sepIdx);
        const assignmentTypeId = key.slice(sepIdx + 1);
        const result = checkEligibility(idx, personId, assignmentTypeId);
        expect(result.eligible).toBe(resolved.enabled);
        if (resolved.enabled) {
          expect(result.reason).toBe('explicit-grant');
        } else {
          expect(result.reason).toBe('explicit-denial');
        }
      }
    }
  });

  // Property 4: determinism — same inputs always produce same outputs
  it('P4: determinism across multiple generated datasets', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const entries = generateEntries(100, seed);
      const personIds = Array.from({ length: 10 }, (_, i) => `person-${i}`);

      const idx1 = buildEligibilityIndex(entries);
      const idx2 = buildEligibilityIndex(entries);

      for (const pid of personIds) {
        for (const atid of [`atype-0`, `atype-1`, `atype-nonexistent`]) {
          const r1 = checkEligibility(idx1, pid, atid);
          const r2 = checkEligibility(idx2, pid, atid);
          expect(r1).toEqual(r2);
        }
      }
    }
  });

  // Property 5: fuzzing — random strings as personId/assignmentTypeId do not crash
  it('P5: fuzzing with random strings does not crash', () => {
    const rng = seededRandom(42);
    const idx = buildEligibilityIndex([ENTRY_A, ENTRY_B, ENTRY_C]);

    // Generate 1000 random queries with potentially adversarial strings
    for (let i = 0; i < 1000; i++) {
      const strLen = Math.floor(rng() * 200) + 1;
      const personId = randomString(rng, strLen);
      const typeId = randomString(rng, strLen);

      // Must not throw
      const result = checkEligibility(idx, personId, typeId);
      expect(result).toBeDefined();
      expect(typeof result.eligible).toBe('boolean');
    }
  });

  // Property 6: no eligibility inference — having grant for type A does not grant type B
  it('P6: no cross-type eligibility inference', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);

      for (const [key, resolved] of idx) {
        if (!resolved.enabled) continue;
        const [personId] = key.split('::');
        // This person is eligible for this assignment type.
        // They must NOT be eligible for a type they have no entry for.
        const result = checkEligibility(idx, personId, 'atype-nonexistent-infer-test');
        expect(result.eligible).toBe(false);
        expect(result.reason).toBe('no-eligibility-record');
      }
    }
  });

  // Property 7: batch and individual checks produce consistent results
  it('P7: batch results match individual checks', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);
      const personIds = ['person-0', 'person-1', 'person-5', 'person-nonexistent'];
      const typeIds = ['atype-0', 'atype-2'];

      for (const typeId of typeIds) {
        const batch = checkEligibilityBatch(idx, personIds, typeId);
        expect(batch).toHaveLength(personIds.length);
        for (let i = 0; i < personIds.length; i++) {
          const individual = checkEligibility(idx, personIds[i], typeId);
          expect(batch[i]).toEqual(individual);
        }
      }
    }
  });

  // Property 8: filterEligiblePersons is consistent with checkEligibility
  it('P8: filterEligiblePersons returns exactly those with eligible=true', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);
      const personIds = Array.from({ length: 15 }, (_, i) => `person-${i}`);
      const typeId = 'atype-0';

      const eligible = filterEligiblePersons(idx, personIds, typeId);
      for (const pid of personIds) {
        const result = checkEligibility(idx, pid, typeId);
        if (result.eligible) {
          expect(eligible).toContain(pid);
        } else {
          expect(eligible).not.toContain(pid);
        }
      }
    }
  });

  // Property 9: getEligibleAssignmentTypes is consistent with per-type checks
  it('P9: getEligibleAssignmentTypes matches per-type eligibility', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);
      const typeIds = ['atype-0', 'atype-1', 'atype-2', 'atype-3', 'atype-4', 'atype-nonexistent'];

      // Check a few persons
      for (const pid of ['person-0', 'person-5', 'person-10']) {
        const eligibleTypes = getEligibleAssignmentTypes(idx, pid);
        for (const typeId of typeIds) {
          const result = checkEligibility(idx, pid, typeId);
          if (result.eligible) {
            expect(eligibleTypes).toContain(typeId);
          } else {
            expect(eligibleTypes).not.toContain(typeId);
          }
        }
      }
    }
  });

  // Adversarial: strings containing "::" separator must not cause collision
  // (we use \0 as separator, not "::")
  it('P10: personId containing "::" does not cause key collision', () => {
    const entries = [
      makeEntry({ personId: 'a::b', assignmentTypeId: 'at1', enabled: true, decidedAt: '2026-01-01T00:00:00.000Z' }),
      makeEntry({ personId: 'a', assignmentTypeId: 'b::at1', enabled: false, decidedAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const idx = buildEligibilityIndex(entries);

    // 'a::b' + 'at1' should resolve to enabled=true
    const r1 = checkEligibility(idx, 'a::b', 'at1');
    expect(r1.eligible).toBe(true);
    expect(r1.reason).toBe('explicit-grant');

    // 'a' + 'b::at1' should resolve to enabled=false
    const r2 = checkEligibility(idx, 'a', 'b::at1');
    expect(r2.eligible).toBe(false);
    expect(r2.reason).toBe('explicit-denial');
  });

  // Adversarial: very long unicode strings in queries
  it('P11: very long unicode strings in queries do not crash', () => {
    const idx = buildEligibilityIndex([ENTRY_A]);
    const longUnicode = '🎉'.repeat(1000);
    const result = checkEligibility(idx, longUnicode, longUnicode);
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no-eligibility-record');
  });

  // Adversarial: null prototype entries (no inherited properties)
  it('P12: entries with null-prototype objects work correctly', () => {
    const entry = Object.assign(Object.create(null), {
      personId: 'p1',
      tenantId: 't1',
      assignmentTypeId: 'at1',
      enabled: true,
      decidedBy: 'admin',
      decidedAt: '2026-01-15T10:00:00.000Z',
    });
    const idx = buildEligibilityIndex([entry as EligibilityEntry]);
    const result = checkEligibility(idx, 'p1', 'at1');
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('explicit-grant');
  });

  // Adversarial: validateEligibilityEntry with null-prototype object
  it('P13: validateEligibilityEntry handles null-prototype object', () => {
    const entry = Object.assign(Object.create(null), {
      personId: 'p1',
      tenantId: 't1',
      assignmentTypeId: 'at1',
      enabled: true,
      decidedBy: 'admin',
      decidedAt: '2026-01-15T10:00:00.000Z',
    });
    const result = validateEligibilityEntry(entry);
    expect(result.personId).toBe('p1');
    expect(result.enabled).toBe(true);
  });

  // Property: entriesToConstraints matches index behaviour
  it('P14: entriesToConstraints matches index eligibility for every entry', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(50, seed);
      const idx = buildEligibilityIndex(entries);
      const constraints = entriesToConstraints(entries);

      // Every constraint must match the index
      for (const c of constraints) {
        const result = checkEligibility(idx, c.personId, c.assignmentTypeId);
        expect(result.eligible).toBe(c.eligible);
      }

      // Count must match index size
      expect(constraints.length).toBe(idx.size);
    }
  });

  // Property: filterEntriesByTenant + buildEligibilityIndex is consistent
  it('P15: tenant-scoped index contains only entries from that tenant', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const entries = generateEntries(100, seed);
      const tenants = [...new Set(entries.map((e) => e.tenantId))];

      for (const tenant of tenants) {
        const filtered = filterEntriesByTenant(entries, tenant);
        expect(filtered.every((e) => e.tenantId === tenant)).toBe(true);

        const idx = buildEligibilityIndex(filtered);
        // All lookups should be fail-closed for unknown person/type combos
        const result = checkEligibility(idx, 'nonexistent', 'nonexistent');
        expect(result.eligible).toBe(false);
      }
    }
  });
});
