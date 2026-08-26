import { describe, expect, it } from 'vitest';
import { canOpenPersonWizard, directoryPersonForWizard, filterPeople } from './PeopleDirectory';
import type { PersonProfileDto } from './lib/peopleApi';
import type { PeopleDirectoryPersonDto } from './lib/peopleDirectoryApi';

const people: readonly PersonProfileDto[] = [
  { id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true },
  { id: 'person-2', displayName: 'Bruno Silva', preferredLocale: 'es', active: false },
  { id: 'person-3', displayName: 'Carla Stone', preferredLocale: 'en', active: true },
];

describe('PeopleDirectory filters', () => {
  it('matches name and preferred locale without altering API data', () => {
    expect(filterPeople(people, 'ana', 'all', 'pt-PT')).toEqual([people[0]]);
    expect(filterPeople(people, 'EN', 'all', 'en')).toEqual([people[2]]);
    expect(people).toHaveLength(3);
  });

  it('combines the real active-status filter with a search query', () => {
    expect(filterPeople(people, '', 'active', 'pt-PT')).toEqual([people[0], people[2]]);
    expect(filterPeople(people, 'bruno', 'active', 'pt-PT')).toEqual([]);
    expect(filterPeople(people, 'bruno', 'inactive', 'pt-PT')).toEqual([people[1]]);
  });
});

describe('PeopleDirectory guided editor integration', () => {
  it('fails closed unless both the Directory projection and authenticated session allow People writes', () => {
    expect(canOpenPersonWizard(true, ['people.read', 'people.write'])).toBe(true);
    expect(canOpenPersonWizard(false, ['people.read', 'people.write'])).toBe(false);
    expect(canOpenPersonWizard(true, ['people.read'])).toBe(false);
    expect(canOpenPersonWizard(true, ['people.write'])).toBe(false);
    expect(canOpenPersonWizard(true, undefined)).toBe(false);
  });

  it('projects only the approved core person DTO into edit mode', () => {
    const directoryPerson: PeopleDirectoryPersonDto = {
      id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true,
      groups: [{ id: 'group-1', name: 'Group 1' }],
      availability: { status: 'ready', current: 'available', currentReasonCodes: [] },
      eligibility: { status: 'ready', enabledAssignmentTypeIds: ['reading'] },
      responsibilities: { status: 'ready', keys: ['coordinator'] },
      assignmentHistory: { status: 'ready', lastCompletedMeetingDate: '2032-06-01' },
    };

    expect(directoryPersonForWizard(directoryPerson)).toEqual({
      id: 'person-1', displayName: 'Ana Martins', preferredLocale: 'pt-PT', active: true,
    });
    expect(directoryPersonForWizard(directoryPerson)).not.toHaveProperty('groups');
    expect(directoryPersonForWizard(directoryPerson)).not.toHaveProperty('availability');
    expect(directoryPersonForWizard(directoryPerson)).not.toHaveProperty('eligibility');
    expect(directoryPersonForWizard(directoryPerson)).not.toHaveProperty('responsibilities');
  });
});
