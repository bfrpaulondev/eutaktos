import type { PeopleMapPointDto } from './peopleMapApi';
import type { ServiceGroupDto } from './serviceGroupsApi';

export const PEOPLE_MAP_UNGROUPED = '__eutaktos_ungrouped__';

export interface PeopleMapGroupLegendEntry {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

export function peopleMapGroupLegend(
  points: readonly PeopleMapPointDto[],
  groups: readonly ServiceGroupDto[],
): readonly PeopleMapGroupLegendEntry[] {
  const mappedPersonIds = new Set(points.map(point => point.personId));
  return Object.freeze(groups
    .map(group => Object.freeze({
      id: group.id,
      name: group.name,
      count: group.memberIds.filter(personId => mappedPersonIds.has(personId)).length,
    }))
    .filter(entry => entry.count > 0)
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)));
}

export function peopleMapUngroupedCount(
  points: readonly PeopleMapPointDto[],
  groups: readonly ServiceGroupDto[],
): number {
  const groupedPersonIds = new Set(groups.flatMap(group => [...group.memberIds]));
  return points.filter(point => !groupedPersonIds.has(point.personId)).length;
}

export function filterPeopleMapPoints(
  points: readonly PeopleMapPointDto[],
  groups: readonly ServiceGroupDto[],
  groupFilter?: string,
): readonly PeopleMapPointDto[] {
  if (!groupFilter) return points;
  if (groupFilter === PEOPLE_MAP_UNGROUPED) {
    const groupedPersonIds = new Set(groups.flatMap(group => [...group.memberIds]));
    return Object.freeze(points.filter(point => !groupedPersonIds.has(point.personId)));
  }
  const group = groups.find(candidate => candidate.id === groupFilter);
  if (!group) return Object.freeze([]);
  const memberIds = new Set(group.memberIds);
  return Object.freeze(points.filter(point => memberIds.has(point.personId)));
}
