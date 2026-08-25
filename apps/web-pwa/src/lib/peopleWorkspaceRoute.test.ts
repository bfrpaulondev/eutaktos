import { describe, expect, it } from 'vitest';
import { peopleWorkspaceSearchForView, peopleWorkspaceViewFromSearch } from './peopleWorkspaceRoute';

describe('People workspace route state', () => {
  it('defaults to Overview and restores Directory from an addressable URL', () => {
    expect(peopleWorkspaceViewFromSearch('')).toBe('overview');
    expect(peopleWorkspaceViewFromSearch('?view=directory')).toBe('directory');
    expect(peopleWorkspaceViewFromSearch('?view=unknown')).toBe('overview');
  });

  it('preserves organization deep links without confusing them with Directory', () => {
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=households')).toBe('households');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=groups')).toBe('groups');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=responsibilities')).toBe('responsibilities');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=directory')).toBe('households');
  });

  it('creates reversible, non-sensitive URLs for Overview and Directory', () => {
    expect(peopleWorkspaceSearchForView('', 'directory')).toBe('?view=directory');
    expect(peopleWorkspaceSearchForView('?view=directory', 'overview')).toBe('');
    expect(peopleWorkspaceSearchForView('?foo=bar', 'directory')).toBe('?foo=bar&view=directory');
    expect(peopleWorkspaceSearchForView('?foo=bar&view=directory', 'overview')).toBe('?foo=bar');
  });

  it('keeps organization navigation URL-safe and returns cleanly to Directory', () => {
    expect(peopleWorkspaceSearchForView('?view=directory', 'groups')).toBe('?view=groups&area=organization');
    expect(peopleWorkspaceSearchForView('?area=organization&view=groups', 'directory')).toBe('?view=directory');
  });
});
