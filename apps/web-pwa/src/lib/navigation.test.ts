import { describe, expect, it } from 'vitest';
import { normalizeAppPath, prepareMeetingViewFromPath, sectionFromPath, SECTION_PATHS, type AppSection } from './navigation';

describe('application navigation', () => {
  it('maps every task-oriented section to a stable production path', () => {
    expect(SECTION_PATHS).toEqual({
      home: '/',
      prepare: '/preparar-reuniao',
      people: '/pessoas',
      organization: '/organizacao',
      planning: '/planeamento',
      administration: '/administracao',
    });
  });

  it('normalizes trailing and duplicate slashes', () => {
    expect(normalizeAppPath('//pessoas///')).toBe('/pessoas');
    expect(sectionFromPath('/agenda/')).toBe('prepare');
  });

  it('resolves canonical paths, aliases and preserved legacy deep links', () => {
    const paths: ReadonlyArray<readonly [string, AppSection]> = [
      ['/', 'home'], ['/?source=nav#top', 'home'],
      ['/preparar-reuniao', 'prepare'], ['/prepare-meeting', 'prepare'], ['/agenda', 'prepare'], ['/designacoes', 'prepare'], ['/assignments', 'prepare'],
      ['/pessoas', 'people'], ['/people', 'people'], ['/people/?source=deep-link#contacts', 'people'],
      ['/organizacao', 'organization'], ['/organization', 'organization'],
      ['/planeamento', 'planning'], ['/planning', 'planning'],
      ['/administracao', 'administration'], ['/administration', 'administration'], ['/preferencias', 'administration'], ['/preferences', 'administration'],
    ];
    for (const [path, section] of paths) expect(sectionFromPath(path)).toBe(section);
  });

  it('preserves Agenda vs Designações inside Preparar reunião', () => {
    expect(prepareMeetingViewFromPath('/preparar-reuniao')).toBe('agenda');
    expect(prepareMeetingViewFromPath('/agenda?week=2026-01-01')).toBe('agenda');
    expect(prepareMeetingViewFromPath('/designacoes')).toBe('assignments');
    expect(prepareMeetingViewFromPath('/assignments/?source=legacy')).toBe('assignments');
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