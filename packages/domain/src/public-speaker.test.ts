import { describe, it, expect } from 'vitest';
import {
  createPublicSpeaker,
  updatePublicSpeaker,
  deactivatePublicSpeaker,
  activatePublicSpeaker,
  assertSpeakerTenant,
  filterSpeakersByTenant,
  filterActiveSpeakers,
  filterVisitingSpeakers,
  filterLocalSpeakers,
  validatePublicSpeaker,
} from './public-speaker';
import type { PublicSpeaker, PublicSpeakerInput } from './public-speaker';

const NOW = '2026-08-21T12:00:00.000Z';
const T1 = 'tenant-aaa';
const T2 = 'tenant-bbb';
const CONG_A = 'cong-1';
const CONG_B = 'cong-2';

function makeLocal(overrides?: Partial<PublicSpeakerInput>): PublicSpeaker {
  return createPublicSpeaker(
    {
      id: 'spk-1',
      tenantId: T1,
      personId: 'person-1',
      name: 'John Doe',
      congregationId: CONG_A,
      isVisiting: false,
      ...overrides,
    },
    NOW,
  );
}

function makeVisiting(overrides?: Partial<PublicSpeakerInput>): PublicSpeaker {
  return createPublicSpeaker(
    {
      id: 'spk-2',
      tenantId: T1,
      name: 'Jane Smith',
      congregationId: CONG_B,
      isVisiting: true,
      ...overrides,
    },
    NOW,
  );
}

// ---- Creation and Validation ----

describe('createPublicSpeaker', () => {
  it('creates a local speaker with all fields', () => {
    const s = makeLocal();
    expect(s.id).toBe('spk-1');
    expect(s.tenantId).toBe(T1);
    expect(s.personId).toBe('person-1');
    expect(s.name).toBe('John Doe');
    expect(s.congregationId).toBe(CONG_A);
    expect(s.isVisiting).toBe(false);
    expect(s.active).toBe(true);
    expect(s.notes).toBe('');
    expect(s.preferredLanguage).toBeUndefined();
    expect(s.createdAt).toBe(NOW);
    expect(s.updatedAt).toBe(NOW);
  });

  it('creates a visiting speaker without personId', () => {
    const s = makeVisiting();
    expect(s.id).toBe('spk-2');
    expect(s.personId).toBeUndefined();
    expect(s.isVisiting).toBe(true);
    expect(s.name).toBe('Jane Smith');
  });

  it('defaults active to true', () => {
    const s = makeLocal({ active: undefined });
    expect(s.active).toBe(true);
  });

  it('allows explicitly setting active to false', () => {
    const s = makeLocal({ active: false });
    expect(s.active).toBe(false);
  });

  it('normalizes whitespace in name', () => {
    const s = makeLocal({ name: '  John   Doe  ' });
    expect(s.name).toBe('John Doe');
  });

  it('stores notes and preferredLanguage when provided', () => {
    const s = makeLocal({ notes: '  Some notes  ', preferredLanguage: 'en' });
    expect(s.notes).toBe('Some notes');
    expect(s.preferredLanguage).toBe('en');
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(makeLocal())).toBe(true);
  });

  it('throws on empty id', () => {
    expect(() => makeLocal({ id: '  ' })).toThrow('id is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => makeLocal({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on empty name', () => {
    expect(() => makeLocal({ name: '  ' })).toThrow('name is required');
  });

  it('throws on name exceeding max length', () => {
    expect(() => makeLocal({ name: 'x'.repeat(201) })).toThrow('name is too long');
  });

  it('throws on empty congregationId', () => {
    expect(() => makeLocal({ congregationId: '' })).toThrow('congregationId is required');
  });

  it('throws on invalid now timestamp', () => {
    expect(() => createPublicSpeaker(
      { id: 's1', tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: false },
      'not-a-date',
    )).toThrow('Invalid ISO date');
  });

  it('throws when isVisiting is not boolean', () => {
    expect(() => createPublicSpeaker(
      { id: 's1', tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: 'yes' as unknown as boolean },
      NOW,
    )).toThrow('isVisiting must be a boolean');
  });

  it('throws when active is not boolean', () => {
    expect(() => createPublicSpeaker(
      { id: 's1', tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: false, active: 'true' as unknown as boolean },
      NOW,
    )).toThrow('active must be a boolean');
  });

  it('throws on notes exceeding max length', () => {
    expect(() => makeLocal({ notes: 'x'.repeat(1001) })).toThrow('notes is too long');
  });

  it('throws on preferredLanguage exceeding max length', () => {
    expect(() => makeLocal({ preferredLanguage: 'x'.repeat(51) })).toThrow('preferredLanguage is too long');
  });
});

describe('validatePublicSpeaker', () => {
  it('does not throw for valid input', () => {
    expect(() => validatePublicSpeaker({
      id: 's1', tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: false,
    })).not.toThrow();
  });

  it('throws on missing required fields', () => {
    expect(() => validatePublicSpeaker({
      id: '', tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: false,
    })).toThrow('id is required');
  });

  it('accepts optional personId being undefined', () => {
    expect(() => validatePublicSpeaker({
      id: 's1', tenantId: T1, personId: undefined, name: 'Test', congregationId: CONG_A, isVisiting: true,
    })).not.toThrow();
  });
});

// ---- Updates ----

describe('updatePublicSpeaker', () => {
  it('updates name', () => {
    const s = makeLocal();
    const updated = updatePublicSpeaker(s, { name: 'New Name' }, NOW);
    expect(updated.name).toBe('New Name');
    expect(updated.updatedAt).toBe(NOW);
  });

  it('updates multiple fields at once', () => {
    const s = makeLocal();
    const updated = updatePublicSpeaker(s, {
      name: 'Updated Name',
      notes: 'Updated notes',
      preferredLanguage: 'pt',
    }, NOW);
    expect(updated.name).toBe('Updated Name');
    expect(updated.notes).toBe('Updated notes');
    expect(updated.preferredLanguage).toBe('pt');
    expect(updated.personId).toBe('person-1'); // unchanged
  });

  it('returns frozen object', () => {
    const updated = updatePublicSpeaker(makeLocal(), { name: 'X' }, NOW);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('does not mutate original', () => {
    const original = makeLocal();
    updatePublicSpeaker(original, { name: 'Changed' }, NOW);
    expect(original.name).toBe('John Doe');
  });

  it('throws on invalid now', () => {
    expect(() => updatePublicSpeaker(makeLocal(), {}, 'bad')).toThrow('Invalid ISO date');
  });

  it('throws on empty name in changes', () => {
    expect(() => updatePublicSpeaker(makeLocal(), { name: '  ' }, NOW)).toThrow('name is required');
  });

  it('passing undefined for preferredLanguage means no change', () => {
    const s = makeLocal({ preferredLanguage: 'en' });
    const updated = updatePublicSpeaker(s, { preferredLanguage: undefined }, NOW);
    expect(updated.preferredLanguage).toBe('en');
  });

  it('passing undefined for notes means no change', () => {
    const s = makeLocal({ notes: 'Some notes' });
    const updated = updatePublicSpeaker(s, { notes: undefined }, NOW);
    expect(updated.notes).toBe('Some notes');
  });
});

// ---- Activate / Deactivate ----

describe('deactivatePublicSpeaker', () => {
  it('sets active to false', () => {
    const s = makeLocal();
    const deactivated = deactivatePublicSpeaker(s, NOW);
    expect(deactivated.active).toBe(false);
    expect(deactivated.updatedAt).toBe(NOW);
  });

  it('returns same reference when already inactive (idempotent)', () => {
    const inactive = makeLocal({ active: false });
    const result = deactivatePublicSpeaker(inactive, NOW);
    expect(result).toBe(inactive);
  });

  it('returns frozen object', () => {
    const deactivated = deactivatePublicSpeaker(makeLocal(), NOW);
    expect(Object.isFrozen(deactivated)).toBe(true);
  });

  it('throws on invalid now', () => {
    expect(() => deactivatePublicSpeaker(makeLocal(), 'bad')).toThrow('Invalid ISO date');
  });
});

describe('activatePublicSpeaker', () => {
  it('sets active to true', () => {
    const s = makeLocal({ active: false });
    const activated = activatePublicSpeaker(s, NOW);
    expect(activated.active).toBe(true);
    expect(activated.updatedAt).toBe(NOW);
  });

  it('returns same reference when already active (idempotent)', () => {
    const active = makeLocal();
    const result = activatePublicSpeaker(active, NOW);
    expect(result).toBe(active);
  });

  it('returns frozen object', () => {
    const activated = activatePublicSpeaker(makeLocal({ active: false }), NOW);
    expect(Object.isFrozen(activated)).toBe(true);
  });

  it('throws on invalid now', () => {
    expect(() => activatePublicSpeaker(makeLocal({ active: false }), 'bad')).toThrow('Invalid ISO date');
  });
});

// ---- Tenant Isolation ----

describe('assertSpeakerTenant', () => {
  it('does not throw for matching tenant', () => {
    expect(() => assertSpeakerTenant(makeLocal(), T1)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    expect(() => assertSpeakerTenant(makeLocal(), T2)).toThrow('Cross-tenant speaker access denied');
  });

  it('throws for empty tenant', () => {
    expect(() => assertSpeakerTenant(makeLocal(), '')).toThrow('Cross-tenant speaker access denied');
  });
});

describe('filterSpeakersByTenant', () => {
  it('returns only speakers of the given tenant', () => {
    const speakers = [
      makeLocal({ id: 's1', tenantId: T1 }),
      makeLocal({ id: 's2', tenantId: T2 }),
      makeVisiting({ id: 's3', tenantId: T1 }),
    ];
    const filtered = filterSpeakersByTenant(speakers, T1);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(s => s.tenantId === T1)).toBe(true);
  });

  it('returns empty for unknown tenant', () => {
    const speakers = [makeLocal()];
    expect(filterSpeakersByTenant(speakers, 'unknown')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterSpeakersByTenant([], T1)).toHaveLength(0);
  });
});

// ---- Filtering ----

describe('filterActiveSpeakers', () => {
  it('returns only active speakers', () => {
    const speakers = [
      makeLocal({ id: 's1', active: true }),
      makeLocal({ id: 's2', active: false }),
      makeVisiting({ id: 's3', active: true }),
    ];
    const filtered = filterActiveSpeakers(speakers);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(s => s.active)).toBe(true);
  });

  it('returns empty if none active', () => {
    const speakers = [makeLocal({ id: 's1', active: false })];
    expect(filterActiveSpeakers(speakers)).toHaveLength(0);
  });
});

describe('filterVisitingSpeakers', () => {
  it('returns only visiting speakers', () => {
    const speakers = [
      makeLocal({ id: 's1' }),
      makeVisiting({ id: 's2' }),
      makeLocal({ id: 's3' }),
    ];
    const filtered = filterVisitingSpeakers(speakers);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('s2');
  });
});

describe('filterLocalSpeakers', () => {
  it('returns only local speakers', () => {
    const speakers = [
      makeLocal({ id: 's1' }),
      makeVisiting({ id: 's2' }),
      makeLocal({ id: 's3' }),
    ];
    const filtered = filterLocalSpeakers(speakers);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(s => !s.isVisiting)).toBe(true);
  });
});

// ---- Immutability ----

describe('immutability', () => {
  it('speaker properties are not writable', () => {
    const s = makeLocal();
    expect(() => {
      (s as unknown as Record<string, unknown>).name = 'Hacked';
    }).toThrow();
  });

  it('original is unchanged after update', () => {
    const original = makeLocal();
    const _updated = updatePublicSpeaker(original, { name: 'Changed' }, '2026-09-01T00:00:00Z');
    expect(original.name).toBe('John Doe');
    expect(original.updatedAt).toBe(NOW);
  });

  it('original is unchanged after deactivate', () => {
    const original = makeLocal();
    const _deactivated = deactivatePublicSpeaker(original, '2026-09-01T00:00:00Z');
    expect(original.active).toBe(true);
  });
});

// ---- Local vs Visiting ----

describe('local vs visiting distinction', () => {
  it('local speaker has personId', () => {
    const s = makeLocal();
    expect(s.personId).toBe('person-1');
    expect(s.isVisiting).toBe(false);
  });

  it('visiting speaker may not have personId', () => {
    const s = makeVisiting();
    expect(s.personId).toBeUndefined();
    expect(s.isVisiting).toBe(true);
  });

  it('visiting speaker can have personId if known', () => {
    const s = makeVisiting({ personId: 'ext-person-1' });
    expect(s.personId).toBe('ext-person-1');
    expect(s.isVisiting).toBe(true);
  });

  it('filterVisitingSpeakers + filterLocalSpeakers partition the set', () => {
    const speakers = [
      makeLocal({ id: 's1' }),
      makeVisiting({ id: 's2' }),
      makeLocal({ id: 's3', active: false }),
    ];
    const visiting = filterVisitingSpeakers(speakers);
    const local = filterLocalSpeakers(speakers);
    expect(visiting.length + local.length).toBe(speakers.length);
    expect(visiting.some(s => local.includes(s))).toBe(false);
  });
});

// ---- Malformed Inputs ----

describe('malformed inputs', () => {
  it('throws when id is not a string', () => {
    expect(() => validatePublicSpeaker({
      id: 42 as unknown as string, tenantId: T1, name: 'Test', congregationId: CONG_A, isVisiting: false,
    })).toThrow('id must be a string');
  });

  it('throws when tenantId is not a string', () => {
    expect(() => validatePublicSpeaker({
      id: 's1', tenantId: null as unknown as string, name: 'Test', congregationId: CONG_A, isVisiting: false,
    })).toThrow('tenantId must be a string');
  });

  it('throws when name is not a string', () => {
    expect(() => validatePublicSpeaker({
      id: 's1', tenantId: T1, name: undefined as unknown as string, congregationId: CONG_A, isVisiting: false,
    })).toThrow('name must be a string');
  });

  it('throws when congregationId is not a string', () => {
    expect(() => validatePublicSpeaker({
      id: 's1', tenantId: T1, name: 'Test', congregationId: 99 as unknown as string, isVisiting: false,
    })).toThrow('congregationId must be a string');
  });

  it('throws when personId is not a string when provided', () => {
    expect(() => createPublicSpeaker({
      id: 's1', tenantId: T1, personId: 123 as unknown as string, name: 'Test', congregationId: CONG_A, isVisiting: false,
    }, NOW)).toThrow('personId must be a string');
  });

  it('rejects empty personId string', () => {
    expect(() => makeLocal({ personId: '  ' })).toThrow('personId is required');
  });
});

// ---- Adversarial Tests ----

describe('adversarial tests', () => {
  it('cannot create speaker with no name (external speakers need names)', () => {
    expect(() => makeVisiting({ name: '' })).toThrow('name is required');
  });

  it('cannot create speaker with whitespace-only name', () => {
    expect(() => makeVisiting({ name: '   \t  ' })).toThrow('name is required');
  });

  it('cannot set name to empty string via update', () => {
    expect(() => updatePublicSpeaker(makeLocal(), { name: '' }, NOW)).toThrow('name is required');
  });

  it('name with only special chars is still valid if trimmed result is non-empty', () => {
    const s = makeLocal({ name: 'José María García-López' });
    expect(s.name).toBe('José María García-López');
  });

  it('updating with empty changes returns equivalent speaker with new timestamp', () => {
    const s = makeLocal();
    const later = '2026-09-01T00:00:00Z';
    const updated = updatePublicSpeaker(s, {}, later);
    expect(updated.id).toBe(s.id);
    expect(updated.name).toBe(s.name);
    expect(updated.updatedAt).toBe(later);
  });

  it('objects from different tenants cannot be conflated', () => {
    const s1 = makeLocal({ id: 's1', tenantId: T1 });
    const s2 = makeLocal({ id: 's1', tenantId: T2 });
    expect(s1.tenantId).not.toBe(s2.tenantId);
    assertSpeakerTenant(s1, T1);
    assertSpeakerTenant(s2, T2);
  });

  it('no spiritual ranking or suitability score exists on the model', () => {
    const s = makeLocal();
    const keys = Object.keys(s);
    expect(keys).not.toContain('rank');
    expect(keys).not.toContain('score');
    expect(keys).not.toContain('suitability');
    expect(keys).not.toContain('qualification');
    expect(keys).not.toContain('spiritual');
    expect(keys).not.toContain('aiInferred');
  });

  it('freeze is deep — nested objects are not present so no concern', () => {
    const s = makeLocal();
    expect(Object.isFrozen(s)).toBe(true);
    // All fields are primitives or undefined
    for (const val of Object.values(s)) {
      if (val !== null && typeof val === 'object') {
        expect(Object.isFrozen(val)).toBe(true);
      }
    }
  });
});
