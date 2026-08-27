import { describe, expect, it } from 'vitest';
import type { PeopleMapPointDto } from './peopleMapApi';
import type { ServiceGroupDto } from './serviceGroupsApi';
import { filterPeopleMapPoints, PEOPLE_MAP_UNGROUPED, peopleMapGroupLegend, peopleMapUngroupedCount } from './peopleMapGroups';

const points: readonly PeopleMapPointDto[] = [
  { personId: 'person-a', displayName: 'Ana', latitude: 38.72, longitude: -9.14 },
  { personId: 'person-b', displayName: 'Bruno', latitude: 40.21, longitude: -8.41 },
  { personId: 'person-c', displayName: 'Carla', latitude: 41.15, longitude: -8.61 },
];

const groups: readonly ServiceGroupDto[] = [
  { id: 'group-b', name: 'Grupo B', memberIds: ['person-b', 'person-c'] },
  { id: 'group-a', name: 'Grupo A', memberIds: ['person-a'] },
  { id: 'group-empty', name: 'Grupo vazio', memberIds: ['person-not-mapped'] },
];

describe('People Map local group projection', () => {
  it('builds a deterministic legend only from groups represented by mapped People', () => {
    expect(peopleMapGroupLegend(points, groups)).toEqual([
      { id: 'group-a', name: 'Grupo A', count: 1 },
      { id: 'group-b', name: 'Grupo B', count: 2 },
    ]);
  });

  it('filters the already-authorized map projection locally without widening its DTO', () => {
    expect(filterPeopleMapPoints(points, groups, 'group-b').map(point => point.personId)).toEqual(['person-b', 'person-c']);
    expect(filterPeopleMapPoints(points, groups).map(point => point.personId)).toEqual(['person-a', 'person-b', 'person-c']);
    expect(filterPeopleMapPoints(points, groups, 'unknown')).toEqual([]);
  });

  it('keeps an explicit ungrouped bucket when mapped People are not in any service group', () => {
    const partiallyGrouped = groups.filter(group => group.id !== 'group-b');
    expect(peopleMapUngroupedCount(points, partiallyGrouped)).toBe(2);
    expect(filterPeopleMapPoints(points, partiallyGrouped, PEOPLE_MAP_UNGROUPED).map(point => point.personId)).toEqual(['person-b', 'person-c']);
  });
});
