export type PeopleWorkspaceView = 'overview' | 'directory' | 'profile' | 'households' | 'groups' | 'responsibilities';

const PROFILE_REF_PARAM = 'person';

function normalizedProfileRef(value: string | null): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  // The profile URL may contain only the internal opaque resource identifier.
  // Human-readable names/contact data never belong in workspace route state.
  if (!normalized || normalized.length > 160 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) return undefined;
  return normalized;
}

export function peopleWorkspaceProfileRefFromSearch(search: string): string | undefined {
  const params = new URLSearchParams(search);
  if (params.get('view') !== 'profile' || params.has('area')) return undefined;
  return normalizedProfileRef(params.get(PROFILE_REF_PARAM));
}

export function peopleWorkspaceViewFromSearch(search: string): PeopleWorkspaceView {
  const params = new URLSearchParams(search);
  const area = params.get('area');
  const view = params.get('view');

  if (area === 'organization') {
    if (view === 'groups' || view === 'responsibilities' || view === 'households') return view;
    return 'households';
  }

  if (view === 'profile' && peopleWorkspaceProfileRefFromSearch(search)) return 'profile';
  if (view === 'directory') return 'directory';
  return 'overview';
}

export function peopleWorkspaceSearchForView(currentSearch: string, next: Exclude<PeopleWorkspaceView, 'profile'>): string {
  const params = new URLSearchParams(currentSearch);
  params.delete(PROFILE_REF_PARAM);

  if (next === 'overview') {
    params.delete('area');
    params.delete('view');
  } else if (next === 'directory') {
    params.delete('area');
    params.set('view', 'directory');
  } else {
    params.set('area', 'organization');
    params.set('view', next);
  }

  const search = params.toString();
  return search ? `?${search}` : '';
}

export function peopleWorkspaceSearchForProfile(currentSearch: string, personRef: string): string {
  const normalized = normalizedProfileRef(personRef);
  if (!normalized) throw new Error('person profile reference is invalid');
  const params = new URLSearchParams(currentSearch);
  params.delete('area');
  params.set('view', 'profile');
  params.set(PROFILE_REF_PARAM, normalized);
  const search = params.toString();
  return search ? `?${search}` : '';
}
