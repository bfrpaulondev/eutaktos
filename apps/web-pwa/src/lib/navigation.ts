export type AppSection = 'home' | 'agenda' | 'assignments' | 'schedule' | 'people' | 'preferences';

export const SECTION_PATHS: Readonly<Record<AppSection, string>> = Object.freeze({
  home: '/',
  agenda: '/agenda',
  assignments: '/designacoes',
  schedule: '/programacao',
  people: '/pessoas',
  preferences: '/preferencias',
});

const PATH_SECTIONS: Readonly<Record<string, AppSection>> = Object.freeze({
  '/': 'home',
  '/agenda': 'agenda',
  '/designacoes': 'assignments',
  '/assignments': 'assignments',
  '/programacao': 'schedule',
  '/schedule': 'schedule',
  '/pessoas': 'people',
  '/people': 'people',
  '/preferencias': 'preferences',
  '/preferences': 'preferences',
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
