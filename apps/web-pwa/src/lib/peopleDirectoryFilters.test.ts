import { describe, expect, it } from 'vitest';
import type { PeopleDirectoryDto } from './peopleDirectoryApi';
import {
  filterPeopleDirectory,
  peopleDirectoryFiltersFromSearch,
  peopleDirectorySearchWithFilters,
  sanitizePeopleDirectoryFilters,
} from './peopleDirectoryFilters';

const directory: PeopleDirectoryDto = {
  contractVersion: 'people-directory-v1',
  generatedAt: '2026-08-25T17:00:00.000Z',
  capabilities: { availability: true, eligibility: true, responsibilities: true, schedule: true },
  filters: {
    groups: [{ id: 'group-1', name: 'Group 1' }],
    responsibilityKeys: ['secretary'],
    assignmentTypeIds: ['builtin:reading'],
  },
  people: [
    {
      id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true,
      groups: [{ id: 'group-1', name: 'Group 1' }],
      availability: { status: 'ready', current: 'available', currentReasonCodes: [] },
      eligibility: { status: 'ready', enabledAssignmentTypeIds: ['builtin:reading'] },
      responsibilities: { status: 'ready', keys: ['secretary'] },
      assignmentHistory: { status: 'ready', lastCompletedMeetingDate: '2026-08-01' },
    },
    {
      id: 'person-2', displayName: 'Bruno Silva', active: false,
      groups: [],
      availability: { status: 'ready', current: 'unavailable', currentReasonCodes: ['other'] },
      eligibility: { status: 'ready', enabledAssignmentTypeIds: [] },
      responsibilities: { status: 'ready', keys: [] },
      assignmentHistory: { status: 'ready' },
    },
  ],
};

describe('People Directory filters', () => {
  it('combines search, state, group, availability, eligibility and responsibility facts', () => {
    expect(filterPeopleDirectory(directory.people, 'ana', {
      status: 'active', availability: 'available', groupId: 'group-1', eligibilityTypeId: 'builtin:reading', responsibilityKey: 'secretary',
    }, 'pt-PT')).toEqual([directory.people[0]]);
    expect(filterPeopleDirectory(directory.people, '', { status: 'inactive', availability: 'unavailable' }, 'pt-PT')).toEqual([directory.people[1]]);
  });

  it('keeps search terms out of the URL while making non-sensitive filters shareable', () => {
    const search = peopleDirectorySearchWithFilters('?view=directory&foo=bar', {
      status: 'active', availability: 'available', groupId: 'group-1', eligibilityTypeId: 'builtin:reading', responsibilityKey: 'secretary',
    });
    expect(search).toContain('view=directory');
    expect(search).toContain('pf_group=group-1');
    expect(search).not.toContain('Ana');
    expect(peopleDirectoryFiltersFromSearch(search)).toEqual({
      status: 'active', availability: 'available', groupId: 'group-1', eligibilityTypeId: 'builtin:reading', responsibilityKey: 'secretary',
    });
  });

  it('drops unsupported or unknown URL filters instead of turning unavailable evidence into zero results', () => {
    const limited: PeopleDirectoryDto = {
      ...directory,
      capabilities: { availability: false, eligibility: false, responsibilities: false, schedule: false },
      filters: { groups: directory.filters.groups, responsibilityKeys: [], assignmentTypeIds: [] },
    };
    expect(sanitizePeopleDirectoryFilters({
      status: 'active', availability: 'unavailable', groupId: 'unknown', eligibilityTypeId: 'unknown', responsibilityKey: 'unknown',
    }, limited)).toEqual({ status: 'active', availability: 'all' });
  });
});
