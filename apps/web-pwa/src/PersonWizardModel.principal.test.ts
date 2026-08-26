import { describe, expect, it, vi } from 'vitest';
import {
  createPersonWizardDraft,
  normalizePersonWizardDisplayName,
  personProfileHasChanges,
  personWizardDisplayNameValid,
  savePersonWizard,
  type PersonWizardDraft,
} from './PersonWizardModel';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupsApi } from './lib/serviceGroupsApi';

const noHouseholds: HouseholdsApi = {
  list: vi.fn(async () => []), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};
const noGroups: ServiceGroupsApi = {
  list: vi.fn(async () => []), get: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
};
const noEligibility: EligibilityApi = {
  list: vi.fn(async () => []), set: vi.fn(),
};

function draft(displayName: string): PersonWizardDraft {
  return { ...createPersonWizardDraft('pt-PT'), displayName };
}

describe('Principal PX6 identity corrections', () => {
  it('matches the domain display-name normalization and minimum length', () => {
    expect(normalizePersonWizardDisplayName('  Ana   Maria  ')).toBe('Ana Maria');
    expect(personWizardDisplayNameValid(' A ')).toBe(false);
    expect(personWizardDisplayNameValid(' A B ')).toBe(true);
  });

  it('does not repeat a confirmed core write only because the draft has equivalent whitespace', () => {
    const confirmed: PersonProfileDto = { id: 'person-1', displayName: 'Ana Maria', preferredLocale: 'pt-PT', active: true };
    expect(personProfileHasChanges(confirmed, draft('  Ana   Maria  '))).toBe(false);
  });

  it('persists normalized identity and verifies the server-confirmed response rather than raw client text', async () => {
    let stored: PersonProfileDto | undefined;
    const people: PeopleApi = {
      create: vi.fn(async input => {
        stored = { id: 'person-1', displayName: input.displayName, preferredLocale: input.preferredLocale, active: input.active ?? true };
        return stored;
      }),
      update: vi.fn(),
      list: vi.fn(async () => stored ? [stored] : []),
    };
    const value = draft('  Ana   Maria  ');
    const result = await savePersonWizard({
      mode: 'create', draft: value, initial: draft(''), households: [], groups: [],
      canReadEligibility: true, canWriteEligibility: true,
      apis: { people, households: noHouseholds, serviceGroups: noGroups, eligibility: noEligibility },
    });
    expect(people.create).toHaveBeenCalledWith({ displayName: 'Ana Maria', preferredLocale: 'pt-PT', active: true });
    expect(result.displayName).toBe('Ana Maria');
  });
});
