import { describe, expect, it } from 'vitest';
import { SECTION_PATHS, normalizeAppPath, sectionFromPath, type AppSection } from './navigation';

describe('Navigation: route normalization', () => {
  it.each([
    ['/', '/'],
    ['/pessoas?foo=bar', '/pessoas'],
    ['/agenda#section', '/agenda'],
    ['/pessoas?q=1#frag', '/pessoas'],
    ['pessoas', '/pessoas'],
    ['//pessoas', '/pessoas'],
    ['/pessoas//', '/pessoas'],
    ['/pessoas/', '/pessoas'],
    ['', '/'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeAppPath(input)).toBe(expected);
  });
});

describe('Navigation: section from path', () => {
  it.each([
    ['/', 'home'],
    ['/agenda', 'agenda'],
    ['/pessoas', 'people'],
    ['/people', 'people'],
    ['/designacoes', 'assignments'],
    ['/assignments', 'assignments'],
    ['/preferencias', 'preferences'],
    ['/preferences', 'preferences'],
    ['/unknown-route', 'home'],
    ['/auth/confirm', 'home'],
    ['/pessoas?pilot=20260823', 'people'],
    ['/agenda#weekly', 'agenda'],
  ] as const)('maps %s to %s', (path, expected) => {
    expect(sectionFromPath(path)).toBe(expected);
  });
});

describe('Navigation: canonical paths are absolute', () => {
  const sections: AppSection[] = ['home', 'agenda', 'assignments', 'people', 'preferences'];

  it('defines an absolute canonical path for every section', () => {
    for (const section of sections) {
      expect(SECTION_PATHS[section]).toBeDefined();
      expect(SECTION_PATHS[section].startsWith('/')).toBe(true);
      expect(SECTION_PATHS[section]).not.toMatch(/^\.\//);
    }
  });

  it('keeps the expected canonical routes', () => {
    expect(SECTION_PATHS).toEqual({
      home: '/',
      agenda: '/agenda',
      assignments: '/designacoes',
      people: '/pessoas',
      preferences: '/preferencias',
    });
  });
});

describe('Navigation: deep-link routing contract', () => {
  it('does not let auth callback query/hash fragments change the app section', () => {
    expect(normalizeAppPath('/auth/confirm?token_hash=redacted&type=email#ignored')).toBe('/auth/confirm');
    expect(sectionFromPath('/auth/confirm?token_hash=redacted&type=email#ignored')).toBe('home');
  });

  it('keeps unknown routes on the factual home fallback', () => {
    expect(sectionFromPath('/nonexistent')).toBe('home');
  });
});
