import { describe, expect, it, vi } from 'vitest';
import { createPersonWizardDraft, personWizardContactNeedsPersistence, savePersonWizard } from './PersonWizardModel';
import type { OrdinaryContactDto } from './lib/ordinaryContactApi';
import type { PersonProfileDto } from './lib/peopleApi';

describe('PersonWizard create Contact persistence', () => {
  it('treats every non-empty create Contact as pending even if a transient baseline matches it', () => {
    const contact = { phone: '+351 210 000 000', email: 'qa@example.test', address: 'QA Street' };
    const base = createPersonWizardDraft('pt-PT');
    const draft = { ...base, displayName: 'QA Contact Create', contact };
    const unexpectedMatchingBaseline = { ...base, contact };

    expect(personWizardContactNeedsPersistence('create', unexpectedMatchingBaseline, draft)).toBe(true);
    expect(personWizardContactNeedsPersistence('create', base, { ...draft, contact: {} })).toBe(false);
  });

  it('creates the person, writes Contact once and verifies it authoritatively', async () => {
    const base = createPersonWizardDraft('pt-PT');
    const desired: OrdinaryContactDto = { phone: '+351 210 000 000', email: 'qa@example.test', address: 'QA Street' };
    const draft = { ...base, displayName: 'QA Contact Create', contact: desired };
    let storedPerson: PersonProfileDto | undefined;
    let storedContact: OrdinaryContactDto = {};

    const people = {
      create: vi.fn(async (input: { displayName: string; preferredLocale?: string; active?: boolean }) => {
        storedPerson = { id: 'person-create-contact', displayName: input.displayName, preferredLocale: input.preferredLocale, active: input.active ?? true };
        return storedPerson;
      }),
      update: vi.fn(),
      list: vi.fn(async () => storedPerson ? [storedPerson] : []),
    };
    const contact = {
      get: vi.fn(async () => ({ ...storedContact })),
      update: vi.fn(async (_personId: string, input: OrdinaryContactDto) => {
        storedContact = { ...input };
        return { ...storedContact };
      }),
    };

    await expect(savePersonWizard({
      mode: 'create',
      draft,
      initial: base,
      households: [],
      groups: [],
      canReadContact: true,
      canWriteContact: true,
      canReadEligibility: true,
      canWriteEligibility: true,
      apis: {
        people: people as never,
        contact: contact as never,
        households: {} as never,
        serviceGroups: {} as never,
        eligibility: {} as never,
      },
    })).resolves.toMatchObject({ id: 'person-create-contact', displayName: 'QA Contact Create' });

    expect(people.create).toHaveBeenCalledTimes(1);
    expect(contact.update).toHaveBeenCalledTimes(1);
    expect(contact.update).toHaveBeenCalledWith('person-create-contact', desired);
    expect(contact.get).toHaveBeenCalledTimes(2);
    expect(storedContact).toEqual(desired);
  });
});
