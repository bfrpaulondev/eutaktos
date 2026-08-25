import { sectionFromPath, type AppSection } from './navigation';

export type TaskNavKey = 'home' | 'prepare' | 'people' | 'organization' | 'planning' | 'admin';

export interface TaskNavTarget {
  readonly pathname: string;
  readonly search: string;
  readonly section: AppSection;
}

export const TASK_NAV_TARGETS: Readonly<Record<TaskNavKey, TaskNavTarget>> = Object.freeze({
  home: Object.freeze({ pathname: '/', search: '', section: 'home' }),
  prepare: Object.freeze({ pathname: '/agenda', search: '', section: 'agenda' }),
  people: Object.freeze({ pathname: '/pessoas', search: '', section: 'people' }),
  organization: Object.freeze({ pathname: '/pessoas', search: '?area=organization', section: 'people' }),
  planning: Object.freeze({ pathname: '/designacoes', search: '', section: 'assignments' }),
  admin: Object.freeze({ pathname: '/preferencias', search: '', section: 'preferences' }),
});

export function taskNavFromLocation(pathname: string, search = ''): TaskNavKey {
  const section = sectionFromPath(pathname);
  if (section === 'people') {
    const params = new URLSearchParams(search);
    return params.get('area') === 'organization' ? 'organization' : 'people';
  }
  if (section === 'agenda') return 'prepare';
  if (section === 'assignments') return 'planning';
  if (section === 'preferences') return 'admin';
  return 'home';
}

export function taskNavTarget(key: TaskNavKey): TaskNavTarget {
  return TASK_NAV_TARGETS[key];
}
