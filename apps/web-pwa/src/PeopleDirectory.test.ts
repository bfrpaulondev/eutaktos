import { describe, expect, it } from 'vitest';
import { canSubmitPerson, filterPeople, hasPersonProfileChanges, hasUnsavedPersonDraft } from './PeopleDirectory';
import type { PersonProfileDto } from './lib/peopleApi';

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

describe('PeopleDirectory submission guard', () => {
  it('requires a non-empty name and rejects a second submission while saving', () => {
    expect(canSubmitPerson('  ', false)).toBe(false);
    expect(canSubmitPerson('Ana Martins', true)).toBe(false);
    expect(canSubmitPerson('Ana Martins', false)).toBe(true);
  });
});

describe('PeopleDirectory unsaved create draft guard', () => {
  it('only permits silent close when the create form still has its initial values', () => {
    expect(hasUnsavedPersonDraft('', 'pt-PT', true, 'pt-PT')).toBe(false);
    expect(hasUnsavedPersonDraft('   ', 'pt-PT', true, 'pt-PT')).toBe(false);
    expect(hasUnsavedPersonDraft('Ana Martins', 'pt-PT', true, 'pt-PT')).toBe(true);
    expect(hasUnsavedPersonDraft('', 'en', true, 'pt-PT')).toBe(true);
    expect(hasUnsavedPersonDraft('', 'pt-PT', false, 'pt-PT')).toBe(true);
  });
});

describe('PeopleDirectory edit guard', () => {
  it('detects name, locale and active-state changes without inventing profile fields', () => {
    const person = people[0]!;
    expect(hasPersonProfileChanges(person, 'Ana Martins', 'pt-PT', true)).toBe(false);
    expect(hasPersonProfileChanges(person, ' Ana Martins ', 'pt-PT', true)).toBe(false);
    expect(hasPersonProfileChanges(person, 'Ana M.', 'pt-PT', true)).toBe(true);
    expect(hasPersonProfileChanges(person, 'Ana Martins', 'en', true)).toBe(true);
    expect(hasPersonProfileChanges(person, 'Ana Martins', 'pt-PT', false)).toBe(true);
  });
});