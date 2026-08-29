import { describe, expect, it } from 'vitest';
import { normalizeAppPath, sectionFromPath, SECTION_PATHS, type AppSection } from './navigation';

describe('application navigation', () => {
  it('maps every primary section to a stable production path', () => {
    expect(SECTION_PATHS).toEqual({
      home: '/',
      agenda: '/agenda',
      assignments: '/designacoes',
      schedule: '/programacao',
      people: '/pessoas',
      preferences: '/preferencias',
    });
  });

  it('normalizes trailing and duplicate slashes', () => {
    expect(normalizeAppPath('//pessoas///')).toBe('/pessoas');
    expect(sectionFromPath('/agenda/')).toBe('agenda');
  });

  it('resolves every documented public path, alias and deep-link decoration', () => {
    const paths: ReadonlyArray<readonly [string, AppSection]> = [
      ['/', 'home'], ['/?source=nav#top', 'home'],
      ['/agenda', 'agenda'], ['/agenda/', 'agenda'], ['/agenda?week=2026-01-01#assignments', 'agenda'],
      ['/designacoes', 'assignments'], ['/designacoes/', 'assignments'], ['/assignments', 'assignments'], ['/assignments/?source=legacy', 'assignments'],
      ['/pessoas', 'people'], ['/pessoas/', 'people'], ['/people', 'people'], ['/people/?source=deep-link#contacts', 'people'],
      ['/preferencias', 'preferences'], ['/preferencias/', 'preferences'], ['/preferences', 'preferences'], ['/preferences?source=legacy', 'preferences'],
    ];
    for (const [path, section] of paths) expect(sectionFromPath(path)).toBe(section);
  });

  it('strips query and hash without changing the canonical deep-link path', () => {
    expect(normalizeAppPath('/people/?source=deep-link#contacts')).toBe('/people');
    expect(normalizeAppPath('agenda?view=week')).toBe('/agenda');
  });

  it('falls back to home for unknown or malformed public paths', () => {
    for (const path of ['/nao-existe', '/unknown-route?source=deep-link', '//evil.example/path', 'not-a-route']) {
      expect(sectionFromPath(path)).toBe('home');
    }
  });
});
