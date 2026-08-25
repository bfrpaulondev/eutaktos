export type PeopleWorkspaceView = 'overview' | 'directory' | 'households' | 'groups' | 'responsibilities';

export function peopleWorkspaceViewFromSearch(search: string): PeopleWorkspaceView {
  const params = new URLSearchParams(search);
  const area = params.get('area');
  const view = params.get('view');

  if (area === 'organization') {
    if (view === 'groups' || view === 'responsibilities' || view === 'households') return view;
    return 'households';
  }

  if (view === 'directory') return 'directory';
  return 'overview';
}

export function peopleWorkspaceSearchForView(currentSearch: string, next: PeopleWorkspaceView): string {
  const params = new URLSearchParams(currentSearch);

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
