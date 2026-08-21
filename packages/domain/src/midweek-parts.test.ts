import { describe, it, expect } from 'vitest';
import {
  createMidweekPartDefinition,
  normalizeMidweekPartDefinition,
  applyTenantOverride,
  resolveEffectiveDuration,
  removeTenantOverride,
  assertMidweekPartTenantScope,
  sortByPosition,
  filterByType,
  BUILTIN_MIDWEEK_PARTS,
  MIDWEEK_PART_TYPES,
  VALID_ASSISTANT_REQUIREMENTS,
} from './midweek-parts';

const T = 'tenant-aaa';
const T2 = 'tenant-bbb';

function make(overrides?: Partial<Parameters<typeof createMidweekPartDefinition>[0]>) {
  return createMidweekPartDefinition({
    id: 'part-1', type: 'opening-remarks', titleKey: 'midweek.parts.openingRemarks',
    durationMinutes: 5, position: 1, studentNeeded: false, assistantRequirement: 'none',
    ...overrides,
  });
}

// ── Creation / validation ──────────────────────────────────────────────────

describe('createMidweekPartDefinition', () => {
  it('creates a valid part definition', () => {
    const part = make();
    expect(part.id).toBe('part-1');
    expect(part.type).toBe('opening-remarks');
    expect(part.titleKey).toBe('midweek.parts.openingRemarks');
    expect(part.durationMinutes).toBe(5);
    expect(part.position).toBe(1);
    expect(part.studentNeeded).toBe(false);
    expect(part.assistantRequirement).toBe('none');
    expect(part.tenantOverrides).toEqual([]);
  });

  it('creates with all required fields populated', () => {
    const part = make({
      id: 'part-full', type: 'living-as-christians', titleKey: 'midweek.parts.livingAsChristians',
      durationMinutes: 30, position: 4, studentNeeded: true, assistantRequirement: 'required',
    });
    expect(part.studentNeeded).toBe(true);
    expect(part.assistantRequirement).toBe('required');
  });

  it('creates with tenant overrides', () => {
    const part = make({
      tenantOverrides: [{ tenantId: T, durationMinutes: 8 }],
    });
    expect(part.tenantOverrides).toHaveLength(1);
    expect(part.tenantOverrides[0].durationMinutes).toBe(8);
  });

  it('throws on negative duration', () => {
    expect(() => make({ durationMinutes: -1 })).toThrow('durationMinutes must be at least 1');
  });

  it('throws on zero duration', () => {
    expect(() => make({ durationMinutes: 0 })).toThrow('durationMinutes must be at least 1');
  });

  it('throws on non-integer duration', () => {
    expect(() => make({ durationMinutes: 5.5 })).toThrow('durationMinutes must be an integer');
  });

  it('throws on duration exceeding max', () => {
    expect(() => make({ durationMinutes: 1000 })).toThrow('durationMinutes must be at most 999');
  });

  it('throws on empty titleKey', () => {
    expect(() => make({ titleKey: '' })).toThrow('titleKey is required');
  });

  it('throws on whitespace-only titleKey', () => {
    expect(() => make({ titleKey: '   ' })).toThrow('titleKey is required');
  });

  it('throws on titleKey too long', () => {
    expect(() => make({ titleKey: 'x'.repeat(201) })).toThrow('titleKey is too long');
  });

  it('throws on empty id', () => {
    expect(() => make({ id: '' })).toThrow('id is required');
  });

  it('throws on invalid type', () => {
    expect(() => make({ type: 'invalid-type' as any })).toThrow('Unknown midweek part type');
  });

  it('throws on invalid assistantRequirement', () => {
    expect(() => make({ assistantRequirement: 'maybe' as any })).toThrow('Invalid assistantRequirement');
  });

  it('throws on position zero', () => {
    expect(() => make({ position: 0 })).toThrow('position must be at least 1');
  });

  it('throws on negative position', () => {
    expect(() => make({ position: -1 })).toThrow('position must be at least 1');
  });

  it('throws on position exceeding max', () => {
    expect(() => make({ position: 101 })).toThrow('position must be at most 100');
  });

  it('throws on non-integer position', () => {
    expect(() => make({ position: 2.5 })).toThrow('position must be an integer');
  });

  it('throws on non-boolean studentNeeded', () => {
    expect(() => make({ studentNeeded: 'yes' as any })).toThrow('studentNeeded must be a boolean');
  });

  it('throws on duplicate tenant overrides', () => {
    expect(() => make({
      tenantOverrides: [
        { tenantId: T, durationMinutes: 5 },
        { tenantId: T, durationMinutes: 10 },
      ],
    })).toThrow('Duplicate tenant override');
  });

  it('allows optional assistantRequirement', () => {
    const part = make({ assistantRequirement: 'optional' });
    expect(part.assistantRequirement).toBe('optional');
  });
});

// ── Immutability ───────────────────────────────────────────────────────────

describe('immutability', () => {
  it('returned object is frozen', () => {
    const part = make();
    expect(Object.isFrozen(part)).toBe(true);
  });

  it('tenantOverrides array is frozen', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 10 }] });
    expect(Object.isFrozen(part.tenantOverrides)).toBe(true);
  });

  it('individual tenant override objects are frozen', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 10 }] });
    expect(Object.isFrozen(part.tenantOverrides[0])).toBe(true);
  });

  it('mutation attempts on frozen object fail silently (strict mode throws)', () => {
    const part = make();
    expect(() => { (part as any).durationMinutes = 99; }).toThrow();
  });
});

// ── Built-in defaults ──────────────────────────────────────────────────────

describe('BUILTIN_MIDWEEK_PARTS', () => {
  it('contains exactly 4 default parts', () => {
    expect(BUILTIN_MIDWEEK_PARTS).toHaveLength(4);
  });

  it('all built-in parts have valid types from the canonical list', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(MIDWEEK_PART_TYPES).toContain(part.type);
    }
  });

  it('all built-in parts have non-empty titleKeys', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(part.titleKey.trim().length).toBeGreaterThan(0);
    }
  });

  it('titleKeys are localization-safe (dot-separated keys, no UI text)', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(part.titleKey).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
    }
  });

  it('all built-in parts have positive durations', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(part.durationMinutes).toBeGreaterThanOrEqual(1);
    }
  });

  it('all built-in parts have positions 1-4', () => {
    const positions = BUILTIN_MIDWEEK_PARTS.map(p => p.position);
    expect(positions).toContain(1);
    expect(positions).toContain(2);
    expect(positions).toContain(3);
    expect(positions).toContain(4);
  });

  it('covers all four standard part types', () => {
    const types = BUILTIN_MIDWEEK_PARTS.map(p => p.type);
    for (const t of MIDWEEK_PART_TYPES) {
      expect(types).toContain(t);
    }
  });

  it('list itself is frozen', () => {
    expect(Object.isFrozen(BUILTIN_MIDWEEK_PARTS)).toBe(true);
  });

  it('individual built-in parts are frozen', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(Object.isFrozen(part)).toBe(true);
    }
  });

  it('no built-in part has tenant overrides', () => {
    for (const part of BUILTIN_MIDWEEK_PARTS) {
      expect(part.tenantOverrides).toHaveLength(0);
    }
  });

  it('opening-remarks has no student and no assistant', () => {
    const part = BUILTIN_MIDWEEK_PARTS.find(p => p.type === 'opening-remarks')!;
    expect(part.studentNeeded).toBe(false);
    expect(part.assistantRequirement).toBe('none');
  });
});

// ── Tenant customization ───────────────────────────────────────────────────

describe('applyTenantOverride', () => {
  it('adds a new tenant override', () => {
    const part = make();
    const updated = applyTenantOverride(part, T, 8);
    expect(updated.tenantOverrides).toHaveLength(1);
    expect(updated.tenantOverrides[0].durationMinutes).toBe(8);
    expect(updated.tenantOverrides[0].tenantId).toBe(T);
  });

  it('replaces an existing tenant override', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 8 }] });
    const updated = applyTenantOverride(part, T, 12);
    expect(updated.tenantOverrides).toHaveLength(1);
    expect(updated.tenantOverrides[0].durationMinutes).toBe(12);
  });

  it('preserves overrides for other tenants', () => {
    const part = make({ tenantOverrides: [{ tenantId: T2, durationMinutes: 15 }] });
    const updated = applyTenantOverride(part, T, 10);
    expect(updated.tenantOverrides).toHaveLength(2);
  });

  it('returns frozen object', () => {
    const updated = applyTenantOverride(make(), T, 8);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('does not mutate original', () => {
    const original = make();
    applyTenantOverride(original, T, 8);
    expect(original.tenantOverrides).toHaveLength(0);
  });

  it('throws on invalid override duration', () => {
    expect(() => applyTenantOverride(make(), T, 0)).toThrow('overrideDurationMinutes must be at least 1');
  });

  it('throws on empty tenantId', () => {
    expect(() => applyTenantOverride(make(), '', 5)).toThrow('tenantId is required');
  });
});

describe('resolveEffectiveDuration', () => {
  it('returns default duration when no override', () => {
    const part = make({ durationMinutes: 5 });
    expect(resolveEffectiveDuration(part, T)).toBe(5);
  });

  it('returns overridden duration when override exists', () => {
    const part = make({
      durationMinutes: 5,
      tenantOverrides: [{ tenantId: T, durationMinutes: 12 }],
    });
    expect(resolveEffectiveDuration(part, T)).toBe(12);
  });

  it('returns default duration for a tenant without override', () => {
    const part = make({
      durationMinutes: 5,
      tenantOverrides: [{ tenantId: T, durationMinutes: 12 }],
    });
    expect(resolveEffectiveDuration(part, T2)).toBe(5);
  });
});

describe('removeTenantOverride', () => {
  it('removes existing tenant override', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 8 }] });
    const updated = removeTenantOverride(part, T);
    expect(updated.tenantOverrides).toHaveLength(0);
  });

  it('returns same reference when no override to remove', () => {
    const part = make();
    const updated = removeTenantOverride(part, T);
    expect(updated).toBe(part);
  });

  it('preserves other tenant overrides', () => {
    const part = make({
      tenantOverrides: [
        { tenantId: T, durationMinutes: 8 },
        { tenantId: T2, durationMinutes: 15 },
      ],
    });
    const updated = removeTenantOverride(part, T);
    expect(updated.tenantOverrides).toHaveLength(1);
    expect(updated.tenantOverrides[0].tenantId).toBe(T2);
  });
});

// ── Tenant isolation ───────────────────────────────────────────────────────

describe('tenant isolation', () => {
  it('assertMidweekPartTenantScope passes for matching tenant', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 8 }] });
    expect(() => assertMidweekPartTenantScope(part, T)).not.toThrow();
  });

  it('assertMidweekPartTenantScope throws for cross-tenant override', () => {
    const part = make({ tenantOverrides: [{ tenantId: T, durationMinutes: 8 }] });
    expect(() => assertMidweekPartTenantScope(part, T2)).toThrow('Cross-tenant');
  });

  it('assertMidweekPartTenantScope passes for no overrides', () => {
    expect(() => assertMidweekPartTenantScope(make(), T)).not.toThrow();
  });

  it('assertMidweekPartTenantScope throws on empty tenantId', () => {
    expect(() => assertMidweekPartTenantScope(make(), '')).toThrow('tenantId is required');
  });
});

// ── Normalization ──────────────────────────────────────────────────────────

describe('normalizeMidweekPartDefinition', () => {
  it('normalizes a valid part definition', () => {
    const part = make();
    const normalized = normalizeMidweekPartDefinition(part);
    expect(normalized.id).toBe('part-1');
    expect(normalized.type).toBe('opening-remarks');
  });

  it('trims titleKey whitespace', () => {
    const part = make({ titleKey: '  midweek.parts.openingRemarks  ' });
    const normalized = normalizeMidweekPartDefinition(part);
    expect(normalized.titleKey).toBe('midweek.parts.openingRemarks');
  });

  it('throws on empty titleKey after trim', () => {
    const part = make();
    const raw = { ...part, titleKey: '   ' } as any;
    expect(() => normalizeMidweekPartDefinition(raw)).toThrow('titleKey is required');
  });

  it('returns frozen object', () => {
    const normalized = normalizeMidweekPartDefinition(make());
    expect(Object.isFrozen(normalized)).toBe(true);
  });
});

// ── Query helpers ──────────────────────────────────────────────────────────

describe('sortByPosition', () => {
  it('sorts parts by position ascending', () => {
    const parts = [make({ id: 'p3', position: 3 }), make({ id: 'p1', position: 1 }), make({ id: 'p2', position: 2 })];
    const sorted = sortByPosition(parts);
    expect(sorted.map(p => p.id)).toEqual(['p1', 'p2', 'p3']);
  });

  it('does not mutate original array', () => {
    const parts = [make({ id: 'p2', position: 2 }), make({ id: 'p1', position: 1 })];
    sortByPosition(parts);
    expect(parts[0].id).toBe('p2');
  });

  it('built-in parts are already sorted by position', () => {
    const sorted = sortByPosition(BUILTIN_MIDWEEK_PARTS);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].position).toBeGreaterThan(sorted[i - 1].position);
    }
  });
});

describe('filterByType', () => {
  it('filters parts by type', () => {
    const filtered = filterByType(BUILTIN_MIDWEEK_PARTS, 'opening-remarks');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].type).toBe('opening-remarks');
  });

  it('returns empty for non-matching type', () => {
    const filtered = filterByType(BUILTIN_MIDWEEK_PARTS, 'living-as-christians');
    expect(filtered).toHaveLength(1);
  });
});

// ── Determinism ────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('same inputs produce identical outputs', () => {
    const a = make({ id: 'det-1', titleKey: 'midweek.parts.openingRemarks' });
    const b = make({ id: 'det-1', titleKey: 'midweek.parts.openingRemarks' });
    expect(a).toEqual(b);
  });

  it('BUILTIN_MIDWEEK_PARTS is stable across multiple accesses', () => {
    const first = BUILTIN_MIDWEEK_PARTS.map(p => p.id);
    const second = BUILTIN_MIDWEEK_PARTS.map(p => p.id);
    expect(first).toEqual(second);
  });

  it('resolveEffectiveDuration is deterministic', () => {
    const part = make({ durationMinutes: 10, tenantOverrides: [{ tenantId: T, durationMinutes: 15 }] });
    expect(resolveEffectiveDuration(part, T)).toBe(15);
    expect(resolveEffectiveDuration(part, T)).toBe(15);
  });

  it('sortByPosition is deterministic for equal positions', () => {
    const parts = [make({ id: 'a', position: 1 }), make({ id: 'b', position: 1 })];
    const r1 = sortByPosition(parts).map(p => p.id);
    const r2 = sortByPosition(parts).map(p => p.id);
    expect(r1).toEqual(r2);
  });
});

// ── Constants ─────────────────────────────────────────────────────────────

describe('constants', () => {
  it('MIDWEEK_PART_TYPES contains all four types', () => {
    expect(MIDWEEK_PART_TYPES).toHaveLength(4);
  });

  it('MIDWEEK_PART_TYPES is frozen', () => {
    expect(Object.isFrozen(MIDWEEK_PART_TYPES)).toBe(true);
  });

  it('VALID_ASSISTANT_REQUIREMENTS contains three values', () => {
    expect(VALID_ASSISTANT_REQUIREMENTS).toHaveLength(3);
  });

  it('VALID_ASSISTANT_REQUIREMENTS is frozen', () => {
    expect(Object.isFrozen(VALID_ASSISTANT_REQUIREMENTS)).toBe(true);
  });
});
