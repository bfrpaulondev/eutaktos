import { describe, it, expect } from 'vitest';
import {
  createTalkOutline,
  updateTalkOutline,
  deactivateTalkOutline,
  activateTalkOutline,
  assertOutlineTenant,
  filterOutlinesByTenant,
  filterActiveOutlines,
  filterOutlinesByLanguage,
  validateTalkOutline,
  normalizeLanguageTag,
} from './talk-outline';
import type { TalkOutline, TalkOutlineInput, TalkOutlineChanges } from './talk-outline';

const NOW = '2026-08-21T12:00:00.000Z';
const LATER = '2026-09-01T00:00:00Z';
const T1 = 'tenant-aaa';
const T2 = 'tenant-bbb';

function makeOutline(overrides?: Partial<TalkOutlineInput>): TalkOutline {
  return createTalkOutline(
    {
      id: 'pt-23-01',
      tenantId: T1,
      title: 'The Kingdom of God',
      language: 'pt',
      ...overrides,
    },
    NOW,
  );
}

// ---- normalizeLanguageTag ----

describe('normalizeLanguageTag', () => {
  it('lowercases a tag', () => {
    expect(normalizeLanguageTag('PT')).toBe('pt');
  });

  it('trims whitespace', () => {
    expect(normalizeLanguageTag('  en  ')).toBe('en');
  });

  it('normalizes region subtags', () => {
    expect(normalizeLanguageTag('en-US')).toBe('en-us');
  });

  it('normalizes complex BCP 47 tags', () => {
    expect(normalizeLanguageTag('zh-Hant-TW')).toBe('zh-hant-tw');
  });

  it('throws on non-string', () => {
    expect(() => normalizeLanguageTag(42 as unknown as string)).toThrow('language must be a string');
  });

  it('throws on empty string', () => {
    expect(() => normalizeLanguageTag('')).toThrow('language is required');
  });

  it('throws on whitespace-only string', () => {
    expect(() => normalizeLanguageTag('   ')).toThrow('language is required');
  });
});

// ---- createTalkOutline ----

describe('createTalkOutline', () => {
  it('creates an outline with all fields', () => {
    const o = makeOutline({
      number: 23,
      category: 'doctrinal',
    });
    expect(o.id).toBe('pt-23-01');
    expect(o.tenantId).toBe(T1);
    expect(o.title).toBe('The Kingdom of God');
    expect(o.language).toBe('pt');
    expect(o.active).toBe(true);
    expect(o.number).toBe(23);
    expect(o.category).toBe('doctrinal');
    expect(o.createdAt).toBe(NOW);
    expect(o.updatedAt).toBe(NOW);
  });

  it('defaults active to true', () => {
    const o = makeOutline({ active: undefined });
    expect(o.active).toBe(true);
  });

  it('allows explicitly setting active to false', () => {
    const o = makeOutline({ active: false });
    expect(o.active).toBe(false);
  });

  it('defaults number and category to undefined', () => {
    const o = makeOutline();
    expect(o.number).toBeUndefined();
    expect(o.category).toBeUndefined();
  });

  it('normalizes language tag to lowercase', () => {
    const o = makeOutline({ language: 'EN' });
    expect(o.language).toBe('en');
  });

  it('normalizes whitespace in title', () => {
    const o = makeOutline({ title: '  The Kingdom   of God  ' });
    expect(o.title).toBe('The Kingdom of God');
  });

  it('normalizes whitespace in category', () => {
    const o = makeOutline({ category: '  doctrinal  ' });
    expect(o.category).toBe('doctrinal');
  });

  it('returns frozen object', () => {
    expect(Object.isFrozen(makeOutline())).toBe(true);
  });

  it('throws on empty id', () => {
    expect(() => makeOutline({ id: '  ' })).toThrow('id is required');
  });

  it('throws on empty tenantId', () => {
    expect(() => makeOutline({ tenantId: '' })).toThrow('tenantId is required');
  });

  it('throws on empty title', () => {
    expect(() => makeOutline({ title: '  ' })).toThrow('title is required');
  });

  it('throws on title exceeding max length', () => {
    expect(() => makeOutline({ title: 'x'.repeat(301) })).toThrow('title is too long');
  });

  it('throws on invalid language tag', () => {
    expect(() => makeOutline({ language: 'not valid!' })).toThrow('Invalid BCP 47 language tag');
  });

  it('throws on invalid now timestamp', () => {
    expect(() => createTalkOutline(
      { id: 'pt-23-01', tenantId: T1, title: 'Test', language: 'pt' },
      'not-a-date',
    )).toThrow('Invalid ISO date');
  });

  it('throws when active is not boolean', () => {
    expect(() => createTalkOutline(
      { id: 'pt-23-01', tenantId: T1, title: 'Test', language: 'pt', active: 'yes' as unknown as boolean },
      NOW,
    )).toThrow('active must be a boolean');
  });

  it('throws on category exceeding max length', () => {
    expect(() => makeOutline({ category: 'x'.repeat(101) })).toThrow('category is too long');
  });

  it('throws on invalid number (NaN)', () => {
    expect(() => makeOutline({ number: NaN })).toThrow('number must be a finite number');
  });

  it('throws on invalid number (Infinity)', () => {
    expect(() => makeOutline({ number: Infinity })).toThrow('number must be a finite number');
  });

  it('accepts number zero', () => {
    const o = makeOutline({ number: 0 });
    expect(o.number).toBe(0);
  });

  it('accepts negative numbers', () => {
    const o = makeOutline({ number: -1 });
    expect(o.number).toBe(-1);
  });

  it('accepts BCP 47 tags with region', () => {
    const o = makeOutline({ language: 'pt-BR' });
    expect(o.language).toBe('pt-br');
  });

  it('accepts BCP 47 tags with script', () => {
    const o = makeOutline({ language: 'zh-Hans' });
    expect(o.language).toBe('zh-hans');
  });
});

// ---- validateTalkOutline ----

describe('validateTalkOutline', () => {
  it('does not throw for valid input', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: 'Test', language: 'pt',
    })).not.toThrow();
  });

  it('throws on missing required fields', () => {
    expect(() => validateTalkOutline({
      id: '', tenantId: T1, title: 'Test', language: 'pt',
    })).toThrow('id is required');
  });

  it('accepts optional fields being undefined', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: 'Test', language: 'pt',
      number: undefined, category: undefined,
    })).not.toThrow();
  });

  it('throws on non-string id', () => {
    expect(() => validateTalkOutline({
      id: 42 as unknown as string, tenantId: T1, title: 'Test', language: 'pt',
    })).toThrow('id must be a string');
  });

  it('throws on non-string tenantId', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: null as unknown as string, title: 'Test', language: 'pt',
    })).toThrow('tenantId must be a string');
  });

  it('throws on non-string title', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: undefined as unknown as string, language: 'pt',
    })).toThrow('title must be a string');
  });

  it('throws on non-string language', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: 'Test', language: 123 as unknown as string,
    })).toThrow('language must be a string');
  });
});

// ---- updateTalkOutline ----

describe('updateTalkOutline', () => {
  it('updates title', () => {
    const o = makeOutline();
    const updated = updateTalkOutline(o, { title: 'New Title' }, LATER);
    expect(updated.title).toBe('New Title');
    expect(updated.updatedAt).toBe(LATER);
  });

  it('updates language', () => {
    const o = makeOutline();
    const updated = updateTalkOutline(o, { language: 'es' }, LATER);
    expect(updated.language).toBe('es');
  });

  it('updates multiple fields at once', () => {
    const o = makeOutline();
    const updated = updateTalkOutline(o, {
      title: 'Updated Title',
      language: 'en',
      number: 42,
      category: 'practical',
    }, LATER);
    expect(updated.title).toBe('Updated Title');
    expect(updated.language).toBe('en');
    expect(updated.number).toBe(42);
    expect(updated.category).toBe('practical');
    expect(updated.id).toBe('pt-23-01'); // unchanged
  });

  it('returns frozen object', () => {
    const updated = updateTalkOutline(makeOutline(), { title: 'X' }, LATER);
    expect(Object.isFrozen(updated)).toBe(true);
  });

  it('does not mutate original', () => {
    const original = makeOutline();
    updateTalkOutline(original, { title: 'Changed' }, LATER);
    expect(original.title).toBe('The Kingdom of God');
  });

  it('throws on invalid now', () => {
    expect(() => updateTalkOutline(makeOutline(), {}, 'bad')).toThrow('Invalid ISO date');
  });

  it('throws on empty title in changes', () => {
    expect(() => updateTalkOutline(makeOutline(), { title: '  ' }, LATER)).toThrow('title is required');
  });

  it('throws on invalid language in changes', () => {
    expect(() => updateTalkOutline(makeOutline(), { language: '!!!' }, LATER)).toThrow('Invalid BCP 47 language tag');
  });

  it('passing undefined for number means no change', () => {
    const o = makeOutline({ number: 23 });
    const updated = updateTalkOutline(o, { number: undefined }, LATER);
    expect(updated.number).toBe(23);
  });

  it('passing undefined for category means no change', () => {
    const o = makeOutline({ category: 'doctrinal' });
    const updated = updateTalkOutline(o, { category: undefined }, LATER);
    expect(updated.category).toBe('doctrinal');
  });

  it('can set category to undefined explicitly to clear it', () => {
    const o = makeOutline({ category: 'doctrinal' });
    const updated = updateTalkOutline(o, { category: '' }, LATER);
    expect(updated.category).toBeUndefined();
  });

  it('updating with empty changes returns equivalent outline with new timestamp', () => {
    const o = makeOutline();
    const updated = updateTalkOutline(o, {}, LATER);
    expect(updated.id).toBe(o.id);
    expect(updated.title).toBe(o.title);
    expect(updated.updatedAt).toBe(LATER);
  });
});

// ---- deactivateTalkOutline ----

describe('deactivateTalkOutline', () => {
  it('sets active to false', () => {
    const o = makeOutline();
    const deactivated = deactivateTalkOutline(o, LATER);
    expect(deactivated.active).toBe(false);
    expect(deactivated.updatedAt).toBe(LATER);
  });

  it('returns same reference when already inactive (idempotent)', () => {
    const inactive = makeOutline({ active: false });
    const result = deactivateTalkOutline(inactive, LATER);
    expect(result).toBe(inactive);
  });

  it('returns frozen object', () => {
    const deactivated = deactivateTalkOutline(makeOutline(), LATER);
    expect(Object.isFrozen(deactivated)).toBe(true);
  });

  it('throws on invalid now', () => {
    expect(() => deactivateTalkOutline(makeOutline(), 'bad')).toThrow('Invalid ISO date');
  });

  it('does not mutate original', () => {
    const original = makeOutline();
    deactivateTalkOutline(original, LATER);
    expect(original.active).toBe(true);
  });
});

// ---- activateTalkOutline ----

describe('activateTalkOutline', () => {
  it('sets active to true', () => {
    const o = makeOutline({ active: false });
    const activated = activateTalkOutline(o, LATER);
    expect(activated.active).toBe(true);
    expect(activated.updatedAt).toBe(LATER);
  });

  it('returns same reference when already active (idempotent)', () => {
    const active = makeOutline();
    const result = activateTalkOutline(active, LATER);
    expect(result).toBe(active);
  });

  it('returns frozen object', () => {
    const activated = activateTalkOutline(makeOutline({ active: false }), LATER);
    expect(Object.isFrozen(activated)).toBe(true);
  });

  it('throws on invalid now', () => {
    expect(() => activateTalkOutline(makeOutline({ active: false }), 'bad')).toThrow('Invalid ISO date');
  });
});

// ---- Tenant Isolation ----

describe('assertOutlineTenant', () => {
  it('does not throw for matching tenant', () => {
    expect(() => assertOutlineTenant(makeOutline(), T1)).not.toThrow();
  });

  it('throws for mismatched tenant', () => {
    expect(() => assertOutlineTenant(makeOutline(), T2)).toThrow('Cross-tenant outline access denied');
  });

  it('throws for empty tenant', () => {
    expect(() => assertOutlineTenant(makeOutline(), '')).toThrow('Cross-tenant outline access denied');
  });
});

describe('filterOutlinesByTenant', () => {
  it('returns only outlines of the given tenant', () => {
    const outlines = [
      makeOutline({ id: 'o1', tenantId: T1 }),
      makeOutline({ id: 'o2', tenantId: T2 }),
      makeOutline({ id: 'o3', tenantId: T1 }),
    ];
    const filtered = filterOutlinesByTenant(outlines, T1);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(o => o.tenantId === T1)).toBe(true);
  });

  it('returns empty for unknown tenant', () => {
    const outlines = [makeOutline()];
    expect(filterOutlinesByTenant(outlines, 'unknown')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterOutlinesByTenant([], T1)).toHaveLength(0);
  });
});

// ---- Filtering ----

describe('filterActiveOutlines', () => {
  it('returns only active outlines', () => {
    const outlines = [
      makeOutline({ id: 'o1', active: true }),
      makeOutline({ id: 'o2', active: false }),
      makeOutline({ id: 'o3', active: true }),
    ];
    const filtered = filterActiveOutlines(outlines);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(o => o.active)).toBe(true);
  });

  it('returns empty if none active', () => {
    const outlines = [makeOutline({ id: 'o1', active: false })];
    expect(filterActiveOutlines(outlines)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterActiveOutlines([])).toHaveLength(0);
  });
});

describe('filterOutlinesByLanguage', () => {
  it('filters by language case-insensitively', () => {
    const outlines = [
      makeOutline({ id: 'o1', language: 'pt' }),
      makeOutline({ id: 'o2', language: 'en' }),
      makeOutline({ id: 'o3', language: 'es' }),
    ];
    const filtered = filterOutlinesByLanguage(outlines, 'PT');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('o1');
  });

  it('returns empty for unknown language', () => {
    const outlines = [makeOutline({ language: 'pt' })];
    expect(filterOutlinesByLanguage(outlines, 'fr')).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(filterOutlinesByLanguage([], 'pt')).toHaveLength(0);
  });

  it('filters by BCP 47 tag with region', () => {
    const outlines = [
      makeOutline({ id: 'o1', language: 'pt-br' }),
      makeOutline({ id: 'o2', language: 'pt' }),
    ];
    const filtered = filterOutlinesByLanguage(outlines, 'pt-BR');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('o1');
  });
});

// ---- Immutability ----

describe('immutability', () => {
  it('outline properties are not writable', () => {
    const o = makeOutline();
    expect(() => {
      (o as unknown as Record<string, unknown>).title = 'Hacked';
    }).toThrow();
  });

  it('original is unchanged after update', () => {
    const original = makeOutline();
    const _updated = updateTalkOutline(original, { title: 'Changed' }, LATER);
    expect(original.title).toBe('The Kingdom of God');
    expect(original.updatedAt).toBe(NOW);
  });

  it('original is unchanged after deactivate', () => {
    const original = makeOutline();
    const _deactivated = deactivateTalkOutline(original, LATER);
    expect(original.active).toBe(true);
  });

  it('original is unchanged after activate', () => {
    const original = makeOutline({ active: false });
    const _activated = activateTalkOutline(original, LATER);
    expect(original.active).toBe(false);
  });

  it('no nested objects — all fields are primitives or undefined', () => {
    const o = makeOutline({ number: 1, category: 'test' });
    for (const val of Object.values(o)) {
      if (val !== null && typeof val === 'object') {
        expect(Object.isFrozen(val)).toBe(true);
      }
    }
  });
});

// ---- Malformed Inputs ----

describe('malformed inputs', () => {
  it('throws when id is not a string', () => {
    expect(() => validateTalkOutline({
      id: 42 as unknown as string, tenantId: T1, title: 'Test', language: 'pt',
    })).toThrow('id must be a string');
  });

  it('throws when tenantId is not a string', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: null as unknown as string, title: 'Test', language: 'pt',
    })).toThrow('tenantId must be a string');
  });

  it('throws when title is not a string', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: 123 as unknown as string, language: 'pt',
    })).toThrow('title must be a string');
  });

  it('throws when language is not a string', () => {
    expect(() => validateTalkOutline({
      id: 'pt-23-01', tenantId: T1, title: 'Test', language: undefined as unknown as string,
    })).toThrow('language must be a string');
  });
});

// ---- Adversarial Tests ----

describe('adversarial tests', () => {
  it('cannot create outline with empty title', () => {
    expect(() => makeOutline({ title: '' })).toThrow('title is required');
  });

  it('cannot create outline with whitespace-only title', () => {
    expect(() => makeOutline({ title: '   \t  ' })).toThrow('title is required');
  });

  it('cannot create outline with very long title', () => {
    expect(() => makeOutline({ title: 'x'.repeat(1000) })).toThrow('title is too long');
  });

  it('cannot create outline with invalid language tag: special chars', () => {
    expect(() => makeOutline({ language: 'p@t' })).toThrow('Invalid BCP 47 language tag');
  });

  it('cannot create outline with invalid language tag: spaces', () => {
    expect(() => makeOutline({ language: 'pt BR' })).toThrow('Invalid BCP 47 language tag');
  });

  it('cannot create outline with invalid language tag: leading hyphen', () => {
    expect(() => makeOutline({ language: '-pt' })).toThrow('Invalid BCP 47 language tag');
  });

  it('cannot create outline with empty language', () => {
    expect(() => makeOutline({ language: '' })).toThrow('language is required');
  });

  it('cannot set title to empty string via update', () => {
    expect(() => updateTalkOutline(makeOutline(), { title: '' }, LATER)).toThrow('title is required');
  });

  it('objects from different tenants cannot be conflated', () => {
    const o1 = makeOutline({ id: 'o1', tenantId: T1 });
    const o2 = makeOutline({ id: 'o1', tenantId: T2 });
    expect(o1.tenantId).not.toBe(o2.tenantId);
    assertOutlineTenant(o1, T1);
    assertOutlineTenant(o2, T2);
  });

  it('no spiritual ranking or commentary exists on the model', () => {
    const o = makeOutline();
    const keys = Object.keys(o);
    expect(keys).not.toContain('rank');
    expect(keys).not.toContain('score');
    expect(keys).not.toContain('suitability');
    expect(keys).not.toContain('qualification');
    expect(keys).not.toContain('spiritual');
    expect(keys).not.toContain('aiInferred');
  });

  it('title at exactly max length is accepted', () => {
    const title = 'x'.repeat(300);
    const o = makeOutline({ title });
    expect(o.title).toBe(title);
  });

  it('title at max+1 is rejected', () => {
    expect(() => makeOutline({ title: 'x'.repeat(301) })).toThrow('title is too long');
  });

  it('outline id with whitespace is trimmed', () => {
    const o = makeOutline({ id: '  pt-23-01  ' });
    expect(o.id).toBe('pt-23-01');
  });

  it('tenant id with whitespace is trimmed', () => {
    const o = makeOutline({ tenantId: '  tenant-aaa  ' });
    expect(o.tenantId).toBe('tenant-aaa');
  });
});
