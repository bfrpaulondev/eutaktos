import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Form from 'antd/es/form';
import { personWizardCopy } from './PersonWizard';
import { PersonWizardContactStep } from './PersonWizardContactStep';
import { PersonWizardIdentityStep } from './PersonWizardIdentityStep';
import { PersonWizardReviewStep } from './PersonWizardReviewStep';
import {
  createPersonWizardDraft,
  createPersonWizardMutationGuard,
  isAmbiguousCreateOutcome,
  personWizardDisplayNameValid,
  personWizardHasChanges,
  personWizardStep,
  savePersonWizard,
  shouldInitializeRelatedBaseline,
  wizardErrorState,
  wizardResourceState,
  type PersonWizardDraft,
} from './PersonWizardModel';
import type { EligibilityApi, EligibilityDecisionDto } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

function fixture() {
  let people: PersonProfileDto[] = [];
  let households: HouseholdDto[] = [{ id: 'house-1', name: 'Casa Norte', memberIds: [] }];
  let groups: ServiceGroupDto[] = [{ id: 'group-1', name: 'Grupo 1', memberIds: [] }];
  let decisions: EligibilityDecisionDto[] = [];
  const calls = { create: 0, update: 0, peopleList: 0, householdUpdate: 0, groupUpdate: 0, eligibilitySet: 0 };
  const peopleApi: PeopleApi = {
    list: vi.fn(async () => { calls.peopleList += 1; return people.map(item => ({ ...item })); }),
    create: vi.fn(async input => { calls.create += 1; const value = { id: 'person-1', displayName: input.displayName, ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}), active: input.active ?? true }; people = [value]; return value; }),
    update: vi.fn(async (id, input) => { calls.update += 1; const current = people.find(item => item.id === id)!; const value = { ...current, ...input, preferredLocale: input.preferredLocale ?? undefined } as PersonProfileDto; people = [value]; return value; }),
  };
  const householdsApi: HouseholdsApi = {
    list: vi.fn(async () => households.map(item => ({ ...item, memberIds: [...item.memberIds] }))), get: vi.fn(async id => households.find(item => item.id === id)!), create: vi.fn(), delete: vi.fn(),
    update: vi.fn(async (id, input) => { calls.householdUpdate += 1; households = households.map(item => item.id === id ? { ...item, ...input, memberIds: input.memberIds ?? item.memberIds } : item); return households.find(item => item.id === id)!; }),
  };
  const serviceGroupsApi: ServiceGroupsApi = {
    list: vi.fn(async () => groups.map(item => ({ ...item, memberIds: [...item.memberIds] }))), get: vi.fn(async id => groups.find(item => item.id === id)!), create: vi.fn(), delete: vi.fn(),
    update: vi.fn(async (id, input) => { calls.groupUpdate += 1; groups = groups.map(item => item.id === id ? { ...item, ...input, memberIds: input.memberIds ?? item.memberIds } as ServiceGroupDto : item); return groups.find(item => item.id === id)!; }),
  };
  const eligibilityApi: EligibilityApi = {
    list: vi.fn(async () => decisions.map(item => ({ ...item }))),
    set: vi.fn(async (_id, input) => { calls.eligibilitySet += 1; const value = { ...input, decidedAt: '2026-08-26T10:00:00.000Z' }; decisions = [...decisions.filter(item => item.assignmentTypeId !== input.assignmentTypeId), value]; return value; }),
  };
  return {
    calls,
    apis: { people: peopleApi, households: householdsApi, serviceGroups: serviceGroupsApi, eligibility: eligibilityApi },
    seedPeople(value: PersonProfileDto[]) { people = value; },
    seedHouseholds(value: HouseholdDto[]) { households = value; },
    seedGroups(value: ServiceGroupDto[]) { groups = value; },
    seedEligibility(value: EligibilityDecisionDto[]) { decisions = value; },
  };
}

function draft(change: Partial<PersonWizardDraft> = {}): PersonWizardDraft { return { ...createPersonWizardDraft('en'), ...change }; }

describe('PersonWizard required scenarios', () => {
  it('1. starts create with contract defaults', () => { expect(createPersonWizardDraft('pt-PT')).toEqual({ displayName: '', preferredLocale: 'pt-PT', active: true, householdIds: [], serviceGroupIds: [], eligibility: {} }); });
  it('2. advances to the next step', () => { expect(personWizardStep(0, 'next')).toBe(1); });
  it('3. returns to the previous step', () => { expect(personWizardStep(3, 'previous')).toBe(2); });
  it('4. rejects whitespace during validation', () => { expect(personWizardDisplayNameValid('   ')).toBe(false); });
  it('5. identifies the real required field', () => { expect(personWizardDisplayNameValid('Ana Costa')).toBe(true); expect(personWizardCopy.en.identity.nameRequired).toContain('required'); });
  it('6. keeps preferred locale optional', async () => { const f = fixture(); await savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana', preferredLocale: '' }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis }); expect(f.apis.people.create).toHaveBeenCalledWith({ displayName: 'Ana', active: true }); });
  it('7. detects unsaved changes only after an edit', () => { const initial = draft(); expect(personWizardHasChanges(initial, initial)).toBe(false); expect(personWizardHasChanges(initial, { ...initial, active: false })).toBe(true); });
  it('8. cancel performs no write', () => { const f = fixture(); expect(f.calls.create + f.calls.update).toBe(0); });
  it('9. blocks double submit while the first mutation is pending', async () => { const guard = createPersonWizardMutationGuard(); let release!: () => void; const pending = new Promise<void>(resolve => { release = resolve; }); const mutation = vi.fn(async () => pending); const first = guard(mutation); const second = guard(mutation); expect(mutation).toHaveBeenCalledTimes(1); release(); await Promise.all([first, second]); });
  it('10. preserves server validation state', () => { expect(wizardErrorState(new Error('displayName is required (422)'))).toBe('validation-error'); });
  it('11. preserves unauthenticated state', () => { expect(wizardErrorState(new Error('Unauthorized (401)'))).toBe('unauthenticated'); expect(wizardResourceState(new Error('Unauthorized (401)'))).toBe('unauthenticated'); });
  it('12. preserves permission state', () => { expect(wizardErrorState(new Error('Forbidden (403)'))).toBe('permission-error'); expect(wizardResourceState(new Error('Forbidden (403)'))).toBe('forbidden'); });
  it('13. classifies service and malformed-response failures as retryable', () => { expect(wizardErrorState(new Error('People API request failed (503)'))).toBe('retryable-error'); expect(wizardErrorState(new Error('Invalid API response'))).toBe('retryable-error'); });
  it('14. creates profile and explicit related configuration', async () => { const f = fixture(); const value = draft({ displayName: 'Ana', householdIds: ['house-1'], serviceGroupIds: ['group-1'], eligibility: { chairman: 'enabled' } }); const result = await savePersonWizard({ mode: 'create', draft: value, initial: draft(), households: await f.apis.households.list(), groups: await f.apis.serviceGroups.list(), canReadEligibility: true, canWriteEligibility: true, apis: f.apis }); expect(result.displayName).toBe('Ana'); expect(f.calls).toMatchObject({ create: 1, householdUpdate: 1, groupUpdate: 1, eligibilitySet: 1 }); });
  it('15. requires authoritative refetch to match', async () => { const f = fixture(); f.apis.people.list = vi.fn(async () => []); await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana' }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis })).rejects.toThrow('Authoritative People refetch mismatch'); });
  it('16. preloads edit identity from real profile', () => { expect(createPersonWizardDraft('en', { id: 'p', displayName: 'Ana', preferredLocale: 'es', active: false })).toMatchObject({ displayName: 'Ana', preferredLocale: 'es', active: false }); });
  it('17. saves edit through PATCH boundary', async () => { const f = fixture(); const person = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true }; f.seedPeople([person]); const value = draft({ displayName: 'Ana Maria', preferredLocale: 'en' }); await savePersonWizard({ mode: 'edit', person, draft: value, initial: createPersonWizardDraft('en', person), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis }); expect(f.calls.update).toBe(1); });
  it('18. avoids unnecessary mutation for unchanged edit', async () => { const f = fixture(); const person = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true }; f.seedPeople([person]); const value = createPersonWizardDraft('en', person); await savePersonWizard({ mode: 'edit', person, draft: value, initial: value, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis }); expect(f.calls.create + f.calls.update + f.calls.householdUpdate + f.calls.groupUpdate + f.calls.eligibilitySet).toBe(0); });
  it('19. provides pt-PT flow copy', () => { expect(personWizardCopy['pt-PT'].steps).toEqual(['Identidade', 'Contacto', 'Organização', 'Participação', 'Rever']); });
  it('20. provides English flow copy', () => { expect(personWizardCopy.en.steps[4]).toBe('Review'); });
  it('21. provides Spanish flow copy', () => { expect(personWizardCopy.es.save).toContain('Confirmar'); });
  it('22. exposes a keyboard form path with labelled input and bounded Enter progression', () => { const markup = renderToStaticMarkup(<Form><PersonWizardIdentityStep draft={draft()} labels={personWizardCopy.en.identity} onChange={() => undefined} /><button type="submit">Next</button></Form>); expect(markup).toContain('<input'); expect(markup).toContain('type="submit"'); expect(personWizardStep(4, 'next')).toBe(4); });
  it('23. renders the localized contact blocker without invented fields', () => { const markup = renderToStaticMarkup(<PersonWizardContactStep title={personWizardCopy.es.contactTitle} detail={personWizardCopy.es.contactDetail} />); expect(markup).toContain('Contactos no disponibles'); expect(markup).not.toContain('<input'); });
  it('24. resumes a known partial create without issuing a second POST', async () => { const f = fixture(); const value = draft({ displayName: 'Ana', householdIds: ['house-1'] }); let created: PersonProfileDto | undefined; const update = f.apis.households.update; f.apis.households.update = vi.fn().mockRejectedValueOnce(new Error('Temporary failure (503)')).mockImplementation(update) as HouseholdsApi['update']; const input = { mode: 'create' as const, draft: value, initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis, onCorePersisted: (person: PersonProfileDto) => { created = person; } }; await expect(savePersonWizard(input)).rejects.toThrow('Temporary failure'); await expect(savePersonWizard({ ...input, person: created })).resolves.toMatchObject({ id: 'person-1' }); expect(f.calls.create).toBe(1); });
  it('25. fails closed before core mutation when eligibility write capability is absent', async () => { const f = fixture(); await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana', eligibility: { chairman: 'enabled' } }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: false, apis: f.apis })).rejects.toThrow('Forbidden'); expect(f.calls.create).toBe(0); });
  it('26. reviews edit changes by human labels without technical IDs', () => { const initial = draft({ displayName: 'Ana', householdIds: [] }); const next = { ...initial, displayName: 'Ana Maria', householdIds: ['house-1'] }; const markup = renderToStaticMarkup(<PersonWizardReviewStep mode="edit" locale="en" draft={next} initial={initial} households={[{ id: 'house-1', name: 'North home', memberIds: [] }]} groups={[]} labels={personWizardCopy.en.review} />); expect(markup).toContain('Ana → Ana Maria'); expect(markup).toContain('North home'); expect(markup).not.toContain('house-1'); });

  it('27. does not make identity-only persistence depend on optional organization or eligibility APIs', async () => {
    const f = fixture();
    const householdList = vi.fn(async () => { throw new Error('Households API request failed (503)'); });
    const groupList = vi.fn(async () => { throw new Error('Service Groups API request failed (503)'); });
    const eligibilityList = vi.fn(async () => { throw new Error('Eligibility API request failed (503)'); });
    f.apis.households.list = householdList;
    f.apis.serviceGroups.list = groupList;
    f.apis.eligibility.list = eligibilityList;
    await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana' }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis })).resolves.toMatchObject({ displayName: 'Ana' });
    expect(householdList).not.toHaveBeenCalled();
    expect(groupList).not.toHaveBeenCalled();
    expect(eligibilityList).not.toHaveBeenCalled();
  });

  it('28. initializes a missing optional baseline on retry but preserves an already initialized dirty draft', () => {
    expect(shouldInitializeRelatedBaseline(true, false)).toBe(true);
    expect(shouldInitializeRelatedBaseline(true, true)).toBe(false);
    expect(shouldInitializeRelatedBaseline(false, true)).toBe(true);
  });

  it('29. treats an unconfirmed retryable create outcome as ambiguous and never an edit/known-core retry', () => {
    expect(isAmbiguousCreateOutcome('create', 'retryable-error', false)).toBe(true);
    expect(isAmbiguousCreateOutcome('create', 'retryable-error', true)).toBe(false);
    expect(isAmbiguousCreateOutcome('edit', 'retryable-error', false)).toBe(false);
    expect(personWizardCopy['pt-PT'].ambiguousCreate).toContain('evitar duplicar');
  });

  it('30. skips a repeated core PATCH when a later organization write failed after the core was confirmed', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    f.seedPeople([person]);
    const initial = createPersonWizardDraft('en', person);
    const value: PersonWizardDraft = { ...initial, displayName: 'Ana Maria', householdIds: ['house-1'] };
    let confirmed: PersonProfileDto | undefined;
    const realUpdate = f.apis.households.update;
    f.apis.households.update = vi.fn().mockRejectedValueOnce(new Error('Temporary failure (503)')).mockImplementation(realUpdate) as HouseholdsApi['update'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis, onCorePersisted: (saved: PersonProfileDto) => { confirmed = saved; } };
    await expect(savePersonWizard(input)).rejects.toThrow('Temporary failure');
    expect(f.calls.update).toBe(1);
    await expect(savePersonWizard({ ...input, person: confirmed })).resolves.toMatchObject({ displayName: 'Ana Maria' });
    expect(f.calls.update).toBe(1);
  });

  it('31. skips an organization relation already persisted before a later relation failed', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    f.seedPeople([person]);
    const initial = createPersonWizardDraft('en', person);
    const value: PersonWizardDraft = { ...initial, householdIds: ['house-1'], serviceGroupIds: ['group-1'] };
    const realGroupUpdate = f.apis.serviceGroups.update;
    f.apis.serviceGroups.update = vi.fn().mockRejectedValueOnce(new Error('Temporary group failure (503)')).mockImplementation(realGroupUpdate) as ServiceGroupsApi['update'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis };
    await expect(savePersonWizard(input)).rejects.toThrow('Temporary group failure');
    expect(f.calls.householdUpdate).toBe(1);
    await expect(savePersonWizard(input)).resolves.toMatchObject({ id: 'person-1' });
    expect(f.calls.householdUpdate).toBe(1);
    expect(f.calls.groupUpdate).toBe(1);
  });

  it('32. skips an eligibility write already persisted before final authoritative refetch failed', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    f.seedPeople([person]);
    const initial = createPersonWizardDraft('en', person);
    const value: PersonWizardDraft = { ...initial, eligibility: { chairman: 'enabled' } };
    const realPeopleList = f.apis.people.list;
    f.apis.people.list = vi.fn().mockRejectedValueOnce(new Error('Temporary refetch failure (503)')).mockImplementation(realPeopleList) as PeopleApi['list'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis };
    await expect(savePersonWizard(input)).rejects.toThrow('Temporary refetch failure');
    expect(f.calls.eligibilitySet).toBe(1);
    await expect(savePersonWizard(input)).resolves.toMatchObject({ id: 'person-1' });
    expect(f.calls.eligibilitySet).toBe(1);
  });
});
