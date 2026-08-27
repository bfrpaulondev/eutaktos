import { describe, expect, it } from 'vitest';
import {
  peopleWorkspaceProfileRefFromSearch,
  peopleWorkspaceSearchForProfile,
  peopleWorkspaceSearchForView,
  peopleWorkspaceViewFromSearch,
} from './peopleWorkspaceRoute';

describe('People workspace route state', () => {
  it('defaults to Overview and restores Directory from an addressable URL', () => {
    expect(peopleWorkspaceViewFromSearch('')).toBe('overview');
    expect(peopleWorkspaceViewFromSearch('?view=directory')).toBe('directory');
    expect(peopleWorkspaceViewFromSearch('?view=map')).toBe('map');
    expect(peopleWorkspaceViewFromSearch('?view=unknown')).toBe('overview');
  });

  it('restores a profile only from a valid opaque internal reference', () => {
    expect(peopleWorkspaceViewFromSearch('?view=profile&person=person-123')).toBe('profile');
    expect(peopleWorkspaceProfileRefFromSearch('?view=profile&person=person-123')).toBe('person-123');
    expect(peopleWorkspaceViewFromSearch('?view=profile')).toBe('overview');
    expect(peopleWorkspaceViewFromSearch('?view=profile&person=Ana%20Martins')).toBe('overview');
    expect(peopleWorkspaceProfileRefFromSearch('?view=profile&person=ana%40example.com')).toBeUndefined();
  });

  it('preserves organization deep links without confusing them with Directory or Profile', () => {
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=households')).toBe('households');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=groups')).toBe('groups');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=responsibilities')).toBe('responsibilities');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=directory')).toBe('households');
    expect(peopleWorkspaceViewFromSearch('?area=organization&view=profile&person=person-1')).toBe('households');
  });

  it('creates reversible, non-sensitive URLs for Overview, Directory and Map', () => {
    expect(peopleWorkspaceSearchForView('', 'directory')).toBe('?view=directory');
    expect(peopleWorkspaceSearchForView('', 'map')).toBe('?view=map');
    expect(peopleWorkspaceSearchForView('?view=map&status=active', 'directory')).toBe('?view=directory&status=active');
    expect(peopleWorkspaceSearchForView('?view=directory', 'overview')).toBe('');
    expect(peopleWorkspaceSearchForView('?foo=bar', 'directory')).toBe('?foo=bar&view=directory');
    expect(peopleWorkspaceSearchForView('?foo=bar&view=directory', 'overview')).toBe('?foo=bar');
  });

  it('keeps Directory filters while entering and leaving an opaque profile deep link', () => {
    const profile = peopleWorkspaceSearchForProfile('?view=directory&status=active&group=group-1', 'person_42');
    expect(profile).toBe('?view=profile&status=active&group=group-1&person=person_42');
    expect(peopleWorkspaceProfileRefFromSearch(profile)).toBe('person_42');
    expect(peopleWorkspaceSearchForView(profile, 'directory')).toBe('?view=directory&status=active&group=group-1');
  });

  it('rejects human-readable or malformed profile references instead of putting them in URL state', () => {
    expect(() => peopleWorkspaceSearchForProfile('', 'Ana Martins')).toThrow('person profile reference is invalid');
    expect(() => peopleWorkspaceSearchForProfile('', 'ana@example.com')).toThrow('person profile reference is invalid');
    expect(() => peopleWorkspaceSearchForProfile('', '../person')).toThrow('person profile reference is invalid');
  });

  it('removes opaque person references when moving to Map', () => {
    const map = peopleWorkspaceSearchForView('?view=profile&person=person_42&status=active&latitude=38.72&longitude=-9.14', 'map');
    expect(map).toBe('?view=map&status=active');
    expect(map).not.toContain('person_42');
    expect(map).not.toContain('latitude');
    expect(map).not.toContain('longitude');
  });

  it('keeps organization navigation URL-safe and returns cleanly to Directory', () => {
    expect(peopleWorkspaceSearchForView('?view=directory', 'groups')).toBe('?view=groups&area=organization');
    expect(peopleWorkspaceSearchForView('?area=organization&view=groups', 'directory')).toBe('?view=directory');
  });
});
