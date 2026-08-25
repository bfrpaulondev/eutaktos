export type AppSection = 'home' | 'prepare' | 'people' | 'organization' | 'planning' | 'administration';
export type PrepareMeetingView = 'agenda' | 'assignments';

export const SECTION_PATHS: Readonly<Record<AppSection, string>> = Object.freeze({
  home: '/',
  prepare: '/preparar-reuniao',
  people: '/pessoas',
  organization: '/organizacao',
  planning: '/planeamento',
  administration: '/administracao',
});

const PATH_SECTIONS: Readonly<Record<string, AppSection>> = Object.freeze({
  '/': 'home',
  '/preparar-reuniao': 'prepare',
  '/prepare-meeting': 'prepare',
  '/agenda': 'prepare',
  '/designacoes': 'prepare',
  '/assignments': 'prepare',
  '/pessoas': 'people',
  '/people': 'people',
  '/organizacao': 'organization',
  '/organization': 'organization',
  '/planeamento': 'planning',
  '/planning': 'planning',
  '/administracao': 'administration',
  '/administration': 'administration',
  '/preferencias': 'administration',
  '/preferences': 'administration',
});

export function normalizeAppPath(pathname: string): string {
  const withoutQueryOrHash = pathname.split(/[?#]/, 1)[0] || '/';
  const withLeadingSlash = withoutQueryOrHash.startsWith('/') ? withoutQueryOrHash : `/${withoutQueryOrHash}`;
  const normalized = withLeadingSlash.replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  return normalized || '/';
}

export function sectionFromPath(pathname: string): AppSection {
  return PATH_SECTIONS[normalizeAppPath(pathname)] ?? 'home';
}

/**
 * Legacy Agenda/Designações deep links remain first-class while the new top-level
 * information architecture groups both under "Preparar reunião".
 */
export function prepareMeetingViewFromPath(pathname: string): PrepareMeetingView {
  const path = normalizeAppPath(pathname);
  return path === '/designacoes' || path === '/assignments' ? 'assignments' : 'agenda';
}