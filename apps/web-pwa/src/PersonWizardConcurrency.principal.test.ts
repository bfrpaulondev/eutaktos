import { describe, expect, it, vi } from 'vitest';
import { createPersonWizardDraft, savePersonWizard, type PersonWizardDraft } from './PersonWizardModel';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

const eligibility: EligibilityApi = { list: vi.fn(async () => []), set: vi.fn() };

function initialDraft(person: PersonProfileDto): PersonWizardDraft {
  return createPersonWizardDraft('en', person);
}

describe('Principal PX6 concurrency corrections', () => {
  it('patches only the core field the user changed and preserves a concurrent active-state change', async () => {
    const baseline: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    let stored: PersonProfileDto = { ...baseline, active: false };
    const people: PeopleApi = {
      list: vi.fn(async () => [{ ...stored }]),
      create: vi.fn(),
      update: vi.fn(async (_id, patch) => { stored = { ...stored, ...patch, preferredLocale: patch.preferredLocale === null ? undefined : patch.preferredLocale ?? stored.preferredLocale }; return { ...stored }; }),
    };
    const households: HouseholdsApi = { list: vi.fn(async () => []), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const groups: ServiceGroupsApi = { list: vi.fn(async () => []), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() };
    const initial = initialDraft(baseline);
    const draft: PersonWizardDraft = { ...initial, displayName: 'Ana Maria' };

    const result = await savePersonWizard({ mode: 'edit', person: baseline, draft, initial, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: { people, households, serviceGroups: groups, eligibility } });

    expect(people.update).toHaveBeenCalledWith('person-1', { displayName: 'Ana Maria' });
    expect(result).toMatchObject({ displayName: 'Ana Maria', active: false });
  });

  it('changes only memberships selected by the user and preserves a concurrent unrelated group membership', async () => {
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    let householdRows: HouseholdDto[] = [{ id: 'house-1', name: 'Casa', memberIds: [] }];
    let groupRows: ServiceGroupDto[] = [{ id: 'group-1', name: 'Grupo', memberIds: ['person-1'] }];
    const people: PeopleApi = { list: vi.fn(async () => [person]), create: vi.fn(), update: vi.fn() };
    const households: HouseholdsApi = {
      list: vi.fn(async () => householdRows.map(item => ({ ...item, memberIds: [...item.memberIds] }))), get: vi.fn(), create: vi.fn(), delete: vi.fn(),
      update: vi.fn(async (id, patch) => { householdRows = householdRows.map(item => item.id === id ? { ...item, memberIds: patch.memberIds ?? item.memberIds } : item); return householdRows.find(item => item.id === id)!; }),
    };
    const groups: ServiceGroupsApi = {
      list: vi.fn(async () => groupRows.map(item => ({ ...item, memberIds: [...item.memberIds] }))), get: vi.fn(), create: vi.fn(), delete: vi.fn(),
      update: vi.fn(async (id, patch) => { groupRows = groupRows.map(item => item.id === id ? { ...item, memberIds: patch.memberIds ?? item.memberIds } : item); return groupRows.find(item => item.id === id)!; }),
    };
    const initial = initialDraft(person);
    const draft: PersonWizardDraft = { ...initial, householdIds: ['house-1'] };

    await savePersonWizard({ mode: 'edit', person, draft, initial, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: { people, households, serviceGroups: groups, eligibility } });

    expect(households.update).toHaveBeenCalledTimes(1);
    expect(groups.update).not.toHaveBeenCalled();
    expect((await groups.list())[0]?.memberIds).toContain('person-1');
  });
});
