import { describe, expect, it } from 'vitest';
import { SECTION_PATHS, normalizeAppPath, prepareMeetingViewFromPath, sectionFromPath, type AppSection } from './navigation';

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
    ['/preparar-reuniao', 'prepare'],
    ['/agenda', 'prepare'],
    ['/designacoes', 'prepare'],
    ['/assignments', 'prepare'],
    ['/pessoas', 'people'],
    ['/people', 'people'],
    ['/organizacao', 'organization'],
    ['/organization', 'organization'],
    ['/planeamento', 'planning'],
    ['/planning', 'planning'],
    ['/administracao', 'administration'],
    ['/preferencias', 'administration'],
    ['/preferences', 'administration'],
    ['/unknown-route', 'home'],
    ['/auth/confirm', 'home'],
    ['/pessoas?pilot=20260823', 'people'],
    ['/agenda#weekly', 'prepare'],
  ] as const)('maps %s to %s', (path, expected) => {
    expect(sectionFromPath(path)).toBe(expected);
  });
});

describe('Navigation: canonical paths are absolute', () => {
  const sections: AppSection[] = ['home', 'prepare', 'people', 'organization', 'planning', 'administration'];

  it('defines an absolute canonical path for every top-level product area', () => {
    for (const section of sections) {
      expect(SECTION_PATHS[section]).toBeDefined();
      expect(SECTION_PATHS[section].startsWith('/')).toBe(true);
      expect(SECTION_PATHS[section]).not.toMatch(/^\.\//);
    }
  });

  it('keeps the target product information architecture', () => {
    expect(SECTION_PATHS).toEqual({
      home: '/',
      prepare: '/preparar-reuniao',
      people: '/pessoas',
      organization: '/organizacao',
      planning: '/planeamento',
      administration: '/administracao',
    });
  });

  it('keeps legacy meeting deep links semantically distinct inside Preparar reunião', () => {
    expect(prepareMeetingViewFromPath('/agenda')).toBe('agenda');
    expect(prepareMeetingViewFromPath('/designacoes')).toBe('assignments');
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