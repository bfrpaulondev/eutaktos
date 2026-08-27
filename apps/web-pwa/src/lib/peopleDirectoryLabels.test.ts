import { describe, expect, it } from 'vitest';
import { filterPeopleDirectory, peopleDirectorySearchWithFilters, type PeopleDirectoryFilters } from './peopleDirectoryFilters';
import type { PeopleDirectoryPersonDto } from './peopleDirectoryApi';

function person(id: string, labels: readonly string[]): PeopleDirectoryPersonDto {
  return {
    id, displayName: id, active: true, labels, groups: [],
    availability: { status: 'unavailable' }, eligibility: { status: 'unavailable' },
    responsibilities: { status: 'unavailable' }, assignmentHistory: { status: 'unavailable' },
  };
}

describe('People Directory label filter', () => {
  it('filters by explicit label', () => {
    const filters: PeopleDirectoryFilters = { status: 'all', availability: 'all', label: 'Visita' };
    expect(filterPeopleDirectory([person('Ana', ['Visita']), person('Rui', ['Apoio'])], '', filters, 'pt-PT').map(item => item.id)).toEqual(['Ana']);
  });

  it('never serializes label names into the Directory URL', () => {
    const search = peopleDirectorySearchWithFilters('?keep=yes', { status: 'active', availability: 'all', label: 'Visita confidencial' });
    expect(search).toContain('keep=yes');
    expect(search).toContain('pf_status=active');
    expect(search).not.toContain('Visita');
    expect(search).not.toContain('label');
  });
});