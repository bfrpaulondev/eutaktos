import type { PeopleDirectoryDto, PeopleDirectoryPersonDto } from './peopleDirectoryApi';
import type { Locale } from './preferences';

export type DirectoryStatusFilter = 'all' | 'active' | 'inactive';
export type DirectoryAvailabilityFilter = 'all' | 'available' | 'unavailable';

export interface PeopleDirectoryFilters {
  readonly status: DirectoryStatusFilter;
  readonly availability: DirectoryAvailabilityFilter;
  readonly groupId?: string;
  readonly eligibilityTypeId?: string;
  readonly responsibilityKey?: string;
  /** Label names are deliberately local-only and are never serialized into the URL. */
  readonly label?: string;
}

export const DEFAULT_PEOPLE_DIRECTORY_FILTERS: PeopleDirectoryFilters = Object.freeze({ status: 'all', availability: 'all' });

const urlKeys = Object.freeze({ status: 'pf_status', availability: 'pf_availability', group: 'pf_group', eligibility: 'pf_eligibility', responsibility: 'pf_responsibility' });
function safeOpaqueFilter(value: string | null): string | undefined { if (!value || value.length > 160 || /[\r\n]/.test(value)) return undefined; return value; }

export function peopleDirectoryFiltersFromSearch(search: string): PeopleDirectoryFilters {
  const params = new URLSearchParams(search); const status = params.get(urlKeys.status); const availability = params.get(urlKeys.availability);
  return Object.freeze({
    status: status === 'active' || status === 'inactive' ? status : 'all',
    availability: availability === 'available' || availability === 'unavailable' ? availability : 'all',
    ...(safeOpaqueFilter(params.get(urlKeys.group)) ? { groupId: safeOpaqueFilter(params.get(urlKeys.group)) } : {}),
    ...(safeOpaqueFilter(params.get(urlKeys.eligibility)) ? { eligibilityTypeId: safeOpaqueFilter(params.get(urlKeys.eligibility)) } : {}),
    ...(safeOpaqueFilter(params.get(urlKeys.responsibility)) ? { responsibilityKey: safeOpaqueFilter(params.get(urlKeys.responsibility)) } : {}),
  });
}

export function peopleDirectorySearchWithFilters(currentSearch: string, filters: PeopleDirectoryFilters): string {
  const params = new URLSearchParams(currentSearch); Object.values(urlKeys).forEach(key => params.delete(key));
  if (filters.status !== 'all') params.set(urlKeys.status, filters.status);
  if (filters.availability !== 'all') params.set(urlKeys.availability, filters.availability);
  if (filters.groupId) params.set(urlKeys.group, filters.groupId);
  if (filters.eligibilityTypeId) params.set(urlKeys.eligibility, filters.eligibilityTypeId);
  if (filters.responsibilityKey) params.set(urlKeys.responsibility, filters.responsibilityKey);
  const value = params.toString(); return value ? `?${value}` : '';
}

export function sanitizePeopleDirectoryFilters(filters: PeopleDirectoryFilters, directory: PeopleDirectoryDto): PeopleDirectoryFilters {
  const validGroupIds = new Set(directory.filters.groups.map(group => group.id));
  const validEligibility = new Set(directory.filters.assignmentTypeIds);
  const validResponsibilities = new Set(directory.filters.responsibilityKeys);
  const validLabels = new Set(directory.filters.labels);
  const sanitized = Object.freeze({
    status: filters.status,
    availability: directory.capabilities.availability ? filters.availability : 'all',
    ...(filters.groupId && validGroupIds.has(filters.groupId) ? { groupId: filters.groupId } : {}),
    ...(directory.capabilities.eligibility && filters.eligibilityTypeId && validEligibility.has(filters.eligibilityTypeId) ? { eligibilityTypeId: filters.eligibilityTypeId } : {}),
    ...(directory.capabilities.responsibilities && filters.responsibilityKey && validResponsibilities.has(filters.responsibilityKey) ? { responsibilityKey: filters.responsibilityKey } : {}),
    ...(filters.label && validLabels.has(filters.label) ? { label: filters.label } : {}),
  });
  const unchanged = sanitized.status === filters.status && sanitized.availability === filters.availability && sanitized.groupId === filters.groupId && sanitized.eligibilityTypeId === filters.eligibilityTypeId && sanitized.responsibilityKey === filters.responsibilityKey && sanitized.label === filters.label;
  return unchanged && Object.isFrozen(filters) ? filters : sanitized;
}

export function filterPeopleDirectory(people: readonly PeopleDirectoryPersonDto[], query: string, filters: PeopleDirectoryFilters, locale: Locale): readonly PeopleDirectoryPersonDto[] {
  const needle = query.trim().toLocaleLowerCase(locale);
  return people.filter(person => {
    if (needle && !person.displayName.toLocaleLowerCase(locale).includes(needle) && !person.preferredLocale?.toLocaleLowerCase(locale).includes(needle)) return false;
    if (filters.status === 'active' && !person.active) return false;
    if (filters.status === 'inactive' && person.active) return false;
    if (filters.groupId && !person.groups.some(group => group.id === filters.groupId)) return false;
    if (filters.label && !person.labels.includes(filters.label)) return false;
    if (filters.availability !== 'all' && (person.availability.status !== 'ready' || person.availability.current !== filters.availability)) return false;
    if (filters.eligibilityTypeId && (person.eligibility.status !== 'ready' || !person.eligibility.enabledAssignmentTypeIds.includes(filters.eligibilityTypeId))) return false;
    if (filters.responsibilityKey && (person.responsibilities.status !== 'ready' || !person.responsibilities.keys.includes(filters.responsibilityKey))) return false;
    return true;
  });
}

export function hasPeopleDirectoryFilters(query: string, filters: PeopleDirectoryFilters): boolean {
  return Boolean(query.trim()) || filters.status !== 'all' || filters.availability !== 'all' || Boolean(filters.groupId || filters.eligibilityTypeId || filters.responsibilityKey || filters.label);
}
