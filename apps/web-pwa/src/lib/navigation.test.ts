import { describe, expect, it } from 'vitest';
import { normalizeAppPath, sectionFromPath, SECTION_PATHS } from './navigation';

describe('application navigation', () => {
  it('maps every primary section to a stable production path', () => {
    expect(SECTION_PATHS).toEqual({
      home: '/',
      agenda: '/agenda',
      assignments: '/designacoes',
      people: '/pessoas',
      preferences: '/preferencias',
    });
  });

  it('normalizes trailing and duplicate slashes', () => {
    expect(normalizeAppPath('//pessoas///')).toBe('/pessoas');
    expect(sectionFromPath('/agenda/')).toBe('agenda');
  });

  it('supports canonical Portuguese routes and safe English aliases', () => {
    expect(sectionFromPath('/designacoes')).toBe('assignments');
    expect(sectionFromPath('/assignments')).toBe('assignments');
    expect(sectionFromPath('/people')).toBe('people');
    expect(sectionFromPath('/preferences')).toBe('preferences');
  });

  it('falls back to home for an unknown path', () => {
    expect(sectionFromPath('/nao-existe')).toBe('home');
  });
});
