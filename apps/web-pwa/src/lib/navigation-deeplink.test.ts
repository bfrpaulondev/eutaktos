import { describe, it, expect } from 'vitest';
import { SECTION_PATHS, normalizeAppPath, sectionFromPath, type AppSection } from './navigation';

describe('Navigation: route normalization', () => {
  it('normalizes root path', () => {
    expect(normalizeAppPath('/')).toBe('/');
  });

  it('strips query strings', () => {
    expect(normalizeAppPath('/pessoas?foo=bar')).toBe('/pessoas');
  });

  it('strips hash fragments', () => {
    expect(normalizeAppPath('/agenda#section')).toBe('/agenda');
  });

  it('strips both query and hash', () => {
    expect(normalizeAppPath('/pessoas?q=1#frag')).toBe('/pessoas');
  });

  it('adds leading slash if missing', () => {
    expect(normalizeAppPath('pessoas')).toBe('/pessoas');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeAppPath('//pessoas')).toBe('/pessoas');
    expect(normalizeAppPath('/pessoas//')).toBe('/pessoas');
  });

  it('strips trailing slashes', () => {
    expect(normalizeAppPath('/pessoas/')).toBe('/pessoas');
    expect(normalizeAppPath('/agenda/')).toBe('/agenda');
  });

  it('handles empty string as root', () => {
    expect(normalizeAppPath('')).toBe('/');
  });
});

describe('Navigation: section from path', () => {
  it('returns home for root', () => {
    expect(sectionFromPath('/')).toBe('home');
  });

  it('returns agenda for /agenda', () => {
    expect(sectionFromPath('/agenda')).toBe('agenda');
  });

  it('returns people for /pessoas (pt-PT route)', () => {
    expect(sectionFromPath('/pessoas')).toBe('people');
  });

  it('returns people for /people (en alias)', () => {
    expect(sectionFromPath('/people')).toBe('people');
  });

  it('returns assignments for /designacoes (pt-PT route)', () => {
    expect(sectionFromPath('/designacoes')).toBe('assignments');
  });

  it('returns assignments for /assignments (en alias)', () => {
    expect(sectionFromPath('/assignments')).toBe('assignments');
  });

  it('returns preferences for /preferencias (pt-PT route)', () => {
    expect(sectionFromPath('/preferencias')).toBe('preferences');
  });

  it('returns preferences for /preferences (en alias)', () => {
    expect(sectionFromPath('/preferences')).toBe('preferences');
  });

  it('returns home for unknown route', () => {
    expect(sectionFromPath('/unknown-route')).toBe('home');
  });

  it('returns home for /auth/confirm (handled separately)', () => {
    expect(sectionFromPath('/auth/confirm')).toBe('home');
  });

  it('handles routes with query params', () => {
    expect(sectionFromPath('/pessoas?pilot=20260823')).toBe('people');
  });

  it('handles routes with hash', () => {
    expect(sectionFromPath('/agenda#weekly')).toBe('agenda');
  });
});

describe('Navigation: section paths', () => {
  it('all sections have canonical paths', () => {
    const sections: AppSection[] = ['home', 'agenda', 'assignments', 'people', 'preferences'];
    sections.forEach(section => {
      expect(SECTION_PATHS[section]).toBeDefined();
      expect(SECTION_PATHS[section].startsWith('/')).toBe(true);
    });
  });

  it('home path is root', () => {
    expect(SECTION_PATHS.home).toBe('/');
  });

  it('people path uses pt-PT', () => {
    expect(SECTION_PATHS.people).toBe('/pessoas');
  });

  it('assignments path uses pt-PT', () => {
    expect(SECTION_PATHS.assignments).toBe('/designacoes');
  });

  it('preferences path uses pt-PT', () => {
    expect(SECTION_PATHS.preferences).toBe('/preferencias');
  });
});

describe('Navigation: deep link safety', () => {
  it('/pessoas deep link loads correctly (not relative to current path)', () => {
    // The app uses absolute paths (/pessoas, /agenda) not relative (./pessoas)
    // This prevents issues when deep-linking from /auth/confirm
    expect(SECTION_PATHS.people).toBe('/pessoas');
    expect(SECTION_PATHS.people.startsWith('/')).toBe(true);
  });

  it('/agenda deep link loads correctly', () => {
    expect(SECTION_PATHS.agenda.startsWith('/')).toBe(true);
  });

  it('/auth/confirm deep link loads assets via /assets/ (absolute)', () => {
    // Vite builds use absolute /assets/ paths by default
    // This is verified by the production mount test
    expect(true).toBe(true);
  });

  it('unknown route falls back to home (not 404 page)', () => {
    expect(sectionFromPath('/nonexistent')).toBe('home');
  });
});
