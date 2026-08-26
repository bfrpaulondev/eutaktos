import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import Form from 'antd/es/form';
import { personWizardCopy } from './PersonWizard';
import { PersonWizardContactStep } from './PersonWizardContactStep';
import { PersonWizardIdentityStep } from './PersonWizardIdentityStep';
import { PersonWizardOrganizationStep } from './PersonWizardOrganizationStep';
import { PersonWizardParticipationStep } from './PersonWizardParticipationStep';
import { PersonWizardReviewStep } from './PersonWizardReviewStep';
import {
  createPersonWizardDraft,
  createPersonWizardMutationGuard,
  isAmbiguousCreateOutcome,
  isPersonWizardTemporalRangeValid,
  personWizardContactValidation,
  personWizardDisplayNameValid,
  personWizardHasChanges,
  personWizardResponsibilityStatus,
  personWizardStep,
  savePersonWizard,
  shouldInitializeRelatedBaseline,
  wizardErrorState,
  wizardResourceState,
  type PersonWizardDraft,
} from './PersonWizardModel';
import type { AvailabilityApi, AvailabilityPeriodDto } from './lib/availabilityApi';
import type { EligibilityApi, EligibilityDecisionDto } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { OrdinaryContactApi, OrdinaryContactDto } from './lib/ordinaryContactApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ResponsibilitiesApi, ResponsibilityDto } from './lib/responsibilitiesApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

function fixture() {
  let people: PersonProfileDto[] = [];
  let households: HouseholdDto[] = [{ id: 'house-1', name: 'North home', memberIds: [] }];
  let groups: ServiceGroupDto[] = [{ id: 'group-1', name: 'Group 1', memberIds: [] }];
  let decisions: EligibilityDecisionDto[] = [];
  let contact: OrdinaryContactDto = {};
  let responsibilities: ResponsibilityDto[] = [];
  let availability: AvailabilityPeriodDto[] = [];
  const calls = {
    create: 0,
    update: 0,
    contactUpdate: 0,
    householdUpdate: 0,
    groupUpdate: 0,
    eligibilitySet: 0,
    responsibilityAssign: 0,
    responsibilityEnd: 0,
    availabilityAdd: 0,
    availabilityRemove: 0,
  };

  const peopleApi: PeopleApi = {
    list: vi.fn(async () => people.map(item => ({ ...item }))),
    create: vi.fn(async input => {
      calls.create += 1;
      const value: PersonProfileDto = { id: 'person-1', displayName: input.displayName, ...(input.preferredLocale ? { preferredLocale: input.preferredLocale } : {}), active: input.active ?? true };
      people = [value];
      return value;
    }),
    update: vi.fn(async (id, input) => {
      calls.update += 1;
      const current = people.find(item => item.id === id)!;
      const value = { ...current, ...input, preferredLocale: input.preferredLocale === null ? undefined : input.preferredLocale ?? current.preferredLocale } as PersonProfileDto;
      people = [value];
      return value;
    }),
  };
  const householdsApi: HouseholdsApi = {
    list: vi.fn(async () => households.map(item => ({ ...item, memberIds: [...item.memberIds] }))),
    get: vi.fn(async id => households.find(item => item.id === id)!), create: vi.fn(), delete: vi.fn(),
    update: vi.fn(async (id, input) => {
      calls.householdUpdate += 1;
      households = households.map(item => item.id === id ? { ...item, ...input, memberIds: input.memberIds ?? item.memberIds } : item);
      return households.find(item => item.id === id)!;
    }),
  };
  const serviceGroupsApi: ServiceGroupsApi = {
    list: vi.fn(async () => groups.map(item => ({ ...item, memberIds: [...item.memberIds] }))),
    get: vi.fn(async id => groups.find(item => item.id === id)!), create: vi.fn(), delete: vi.fn(),
    update: vi.fn(async (id, input) => {
      calls.groupUpdate += 1;
      groups = groups.map(item => item.id === id ? { ...item, ...input, memberIds: input.memberIds ?? item.memberIds } as ServiceGroupDto : item);
      return groups.find(item => item.id === id)!;
    }),
  };
  const eligibilityApi: EligibilityApi = {
    list: vi.fn(async () => decisions.map(item => ({ ...item }))),
    set: vi.fn(async (_id, input) => {
      calls.eligibilitySet += 1;
      const value = { ...input, decidedAt: '2026-08-26T10:00:00.000Z' };
      decisions = [...decisions.filter(item => item.assignmentTypeId !== input.assignmentTypeId), value];
      return value;
    }),
  };
  const contactApi: OrdinaryContactApi = {
    get: vi.fn(async () => ({ ...contact })),
    update: vi.fn(async (_id, input) => {
      calls.contactUpdate += 1;
      contact = { ...input };
      return { ...contact };
    }),
  };
  const responsibilitiesApi: ResponsibilitiesApi = {
    list: vi.fn(async () => responsibilities.map(item => ({ ...item }))),
    get: vi.fn(async id => responsibilities.find(item => item.id === id)!),
    assign: vi.fn(async input => {
      calls.responsibilityAssign += 1;
      const value = { id: `responsibility-${calls.responsibilityAssign}`, ...input };
      responsibilities = [...responsibilities, value];
      return value;
    }),
    end: vi.fn(async (id, input) => {
      calls.responsibilityEnd += 1;
      responsibilities = responsibilities.map(item => item.id === id ? { ...item, endsAt: input.endsAt } : item);
      return responsibilities.find(item => item.id === id)!;
    }),
  };
  const availabilityApi: AvailabilityApi = {
    list: vi.fn(async () => availability.map(item => ({ ...item }))),
    add: vi.fn(async (_personId, input) => {
      calls.availabilityAdd += 1;
      const value = { id: `availability-${calls.availabilityAdd}`, ...input };
      availability = [...availability, value];
      return value;
    }),
    remove: vi.fn(async (_personId, id) => {
      calls.availabilityRemove += 1;
      availability = availability.filter(item => item.id !== id);
    }),
  };

  return {
    calls,
    apis: { people: peopleApi, households: householdsApi, serviceGroups: serviceGroupsApi, eligibility: eligibilityApi, contact: contactApi, responsibilities: responsibilitiesApi, availability: availabilityApi },
    seedPeople(value: PersonProfileDto[]) { people = value; },
    seedContact(value: OrdinaryContactDto) { contact = value; },
    seedResponsibilities(value: ResponsibilityDto[]) { responsibilities = value; },
    seedAvailability(value: AvailabilityPeriodDto[]) { availability = value; },
  };
}

function draft(change: Partial<PersonWizardDraft> = {}): PersonWizardDraft {
  return { ...createPersonWizardDraft('en'), ...change };
}

const writableRelated = {
  canReadContact: true,
  canWriteContact: true,
  canReadEligibility: true,
  canWriteEligibility: true,
  canReadResponsibilities: true,
  canWriteResponsibilities: true,
  canReadAvailability: true,
  canWriteAvailability: true,
} as const;

describe('PersonWizard complete PX6 contract', () => {
  it('starts with the complete optional draft contract', () => {
    expect(createPersonWizardDraft('pt-PT')).toEqual({
      displayName: '', preferredLocale: 'pt-PT', active: true, contact: {}, householdIds: [], serviceGroupIds: [], eligibility: {}, responsibilities: [], responsibilityEnds: [], availabilityPeriods: [], availabilityRemovals: [],
    });
  });

  it('preserves navigation and identity validation', () => {
    expect(personWizardStep(0, 'next')).toBe(1);
    expect(personWizardStep(4, 'next')).toBe(4);
    expect(personWizardDisplayNameValid('   ')).toBe(false);
    expect(personWizardDisplayNameValid('Ana Costa')).toBe(true);
  });

  it('validates ordinary contact locally without making it required', () => {
    expect(personWizardContactValidation({})).toEqual([]);
    expect(personWizardContactValidation({ email: 'bad' })).toEqual(['email']);
    expect(personWizardContactValidation({ email: 'ana@example.org' })).toEqual([]);
    expect(personWizardContactValidation({ phone: 'x'.repeat(41), address: 'x'.repeat(501) })).toEqual(['phone', 'address']);
  });

  it('persists Contact through the canonical full replacement and authoritatively re-reads it', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    f.seedPeople([person]);
    f.seedContact({ phone: '111' });
    const initial = draft({ displayName: 'Ana', contact: { phone: '111' } });
    const value = { ...initial, contact: { email: 'ana@example.org' } };
    await savePersonWizard({ mode: 'edit', person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis });
    expect(f.apis.contact.update).toHaveBeenCalledWith('person-1', { email: 'ana@example.org' });
    expect(f.calls.contactUpdate).toBe(1);
  });

  it('does not repeat a Contact PUT after it persisted but a later refetch failed', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', preferredLocale: 'en', active: true };
    f.seedPeople([person]);
    f.seedContact({ phone: '111' });
    const initial = draft({ displayName: 'Ana', contact: { phone: '111' } });
    const value = { ...initial, contact: { phone: '222' } };
    const realPeopleList = f.apis.people.list;
    f.apis.people.list = vi.fn().mockRejectedValueOnce(new Error('Temporary refetch failure (503)')).mockImplementation(realPeopleList) as PeopleApi['list'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis };
    await expect(savePersonWizard(input)).rejects.toThrow('Temporary refetch failure');
    await expect(savePersonWizard(input)).resolves.toMatchObject({ id: 'person-1' });
    expect(f.calls.contactUpdate).toBe(1);
  });

  it('fails before person creation when changed Contact is not writable', async () => {
    const f = fixture();
    await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana', contact: { email: 'ana@example.org' } }), initial: draft(), households: [], groups: [], canReadContact: true, canWriteContact: false, canReadEligibility: true, canWriteEligibility: true, apis: f.apis })).rejects.toThrow('Forbidden');
    expect(f.calls.create).toBe(0);
  });

  it('keeps identity-only persistence independent from optional related APIs', async () => {
    const f = fixture();
    f.apis.households.list = vi.fn(async () => { throw new Error('Households API request failed (503)'); });
    f.apis.eligibility.list = vi.fn(async () => { throw new Error('Eligibility API request failed (503)'); });
    await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana' }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, apis: f.apis })).resolves.toMatchObject({ displayName: 'Ana' });
  });

  it('assigns responsibility and verifies it', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', active: true };
    f.seedPeople([person]);
    const initial = draft({ displayName: 'Ana' });
    const value = { ...initial, responsibilities: [{ responsibilityKey: 'sound', startsAt: '2026-08-01T00:00:00.000Z' }] };
    await savePersonWizard({ mode: 'edit', person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis });
    expect(f.calls.responsibilityAssign).toBe(1);
  });

  it('ends an active responsibility with [startsAt, endsAt) semantics and verifies it', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', active: true };
    f.seedPeople([person]);
    f.seedResponsibilities([{ id: 'r1', personId: 'person-1', responsibilityKey: 'sound', startsAt: '2026-01-01T00:00:00.000Z' }]);
    const initial = draft({ displayName: 'Ana' });
    const value = { ...initial, responsibilityEnds: [{ id: 'r1', endsAt: '2026-08-26T12:00:00.000Z' }] };
    await savePersonWizard({ mode: 'edit', person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis });
    expect(f.calls.responsibilityEnd).toBe(1);
  });

  it('does not issue a duplicate responsibility end on retry after persistence', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', active: true };
    f.seedPeople([person]);
    f.seedResponsibilities([{ id: 'r1', personId: 'person-1', responsibilityKey: 'sound', startsAt: '2026-01-01T00:00:00.000Z' }]);
    const initial = draft({ displayName: 'Ana' });
    const value = { ...initial, responsibilityEnds: [{ id: 'r1', endsAt: '2026-08-26T12:00:00.000Z' }] };
    const realPeopleList = f.apis.people.list;
    f.apis.people.list = vi.fn().mockRejectedValueOnce(new Error('Temporary refetch failure (503)')).mockImplementation(realPeopleList) as PeopleApi['list'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis };
    await expect(savePersonWizard(input)).rejects.toThrow();
    await expect(savePersonWizard(input)).resolves.toMatchObject({ id: 'person-1' });
    expect(f.calls.responsibilityEnd).toBe(1);
  });

  it('classifies scheduled, active, ended and invalid responsibilities correctly', () => {
    const now = new Date('2026-08-26T12:00:00.000Z');
    expect(personWizardResponsibilityStatus({ startsAt: '2026-08-27T00:00:00.000Z' }, now)).toBe('scheduled');
    expect(personWizardResponsibilityStatus({ startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-27T00:00:00.000Z' }, now)).toBe('active');
    expect(personWizardResponsibilityStatus({ startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-26T12:00:00.000Z' }, now)).toBe('ended');
    expect(personWizardResponsibilityStatus({ startsAt: 'bad' }, now)).toBe('invalid');
  });

  it('rejects invalid responsibility intervals before the core write', async () => {
    const f = fixture();
    const value = draft({ displayName: 'Ana', responsibilities: [{ responsibilityKey: 'sound', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-01T00:00:00.000Z' }] });
    expect(isPersonWizardTemporalRangeValid('2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z')).toBe(false);
    await expect(savePersonWizard({ mode: 'create', draft: value, initial: draft(), households: [], groups: [], ...writableRelated, apis: f.apis })).rejects.toThrow('Invalid responsibility');
    expect(f.calls.create).toBe(0);
  });

  it('adds and removes dated availability using canonical contracts', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', active: true };
    f.seedPeople([person]);
    f.seedAvailability([{ id: 'a-old', startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-02T00:00:00.000Z', reasonCode: 'away' }]);
    const initial = draft({ displayName: 'Ana' });
    const value = { ...initial, availabilityRemovals: [{ id: 'a-old' }], availabilityPeriods: [{ startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-03T00:00:00.000Z', reasonCode: 'other' as const }] };
    await savePersonWizard({ mode: 'edit', person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis });
    expect(f.calls.availabilityRemove).toBe(1);
    expect(f.calls.availabilityAdd).toBe(1);
  });

  it('does not duplicate remove/add operations when retrying after a later failure', async () => {
    const f = fixture();
    const person: PersonProfileDto = { id: 'person-1', displayName: 'Ana', active: true };
    f.seedPeople([person]);
    f.seedAvailability([{ id: 'a-old', startsAt: '2026-08-01T00:00:00.000Z', endsAt: '2026-08-02T00:00:00.000Z', reasonCode: 'away' }]);
    const initial = draft({ displayName: 'Ana' });
    const value = { ...initial, availabilityRemovals: [{ id: 'a-old' }], availabilityPeriods: [{ startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-03T00:00:00.000Z', reasonCode: 'other' as const }] };
    const realPeopleList = f.apis.people.list;
    f.apis.people.list = vi.fn().mockRejectedValueOnce(new Error('Temporary refetch failure (503)')).mockImplementation(realPeopleList) as PeopleApi['list'];
    const input = { mode: 'edit' as const, person, draft: value, initial, households: [], groups: [], ...writableRelated, apis: f.apis };
    await expect(savePersonWizard(input)).rejects.toThrow();
    await expect(savePersonWizard(input)).resolves.toMatchObject({ id: 'person-1' });
    expect(f.calls.availabilityRemove).toBe(1);
    expect(f.calls.availabilityAdd).toBe(1);
  });

  it('fails closed on related write capability gaps before creation', async () => {
    const f = fixture();
    await expect(savePersonWizard({ mode: 'create', draft: draft({ displayName: 'Ana', availabilityPeriods: [{ startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-02T00:00:00.000Z' }] }), initial: draft(), households: [], groups: [], canReadEligibility: true, canWriteEligibility: true, canReadAvailability: true, canWriteAvailability: false, apis: f.apis })).rejects.toThrow('Forbidden');
    expect(f.calls.create).toBe(0);
  });

  it('keeps eligibility 403 independent from a ready availability surface', () => {
    const value = draft();
    const markup = renderToStaticMarkup(<PersonWizardParticipationStep locale="en" draft={value} periods={[{ id: 'a1', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-02T00:00:00.000Z', reasonCode: 'away' }]} eligibilityState="forbidden" availabilityState="ready" canWriteEligibility={false} canWriteAvailability labels={personWizardCopy.en.participation} onChange={() => undefined} onRetryEligibility={() => undefined} onRetryAvailability={() => undefined} />);
    expect(markup).toContain('unavailable with the current permissions');
    expect(markup).toContain('2026-09-01');
    expect(markup).toContain('Correct');
  });

  it('keeps eligibility 500 independent from a ready availability surface', () => {
    const markup = renderToStaticMarkup(<PersonWizardParticipationStep locale="en" draft={draft()} periods={[]} eligibilityState="error" availabilityState="ready" canWriteEligibility={false} canWriteAvailability labels={personWizardCopy.en.participation} onChange={() => undefined} onRetryEligibility={() => undefined} onRetryAvailability={() => undefined} />);
    expect(markup).toContain('could not be loaded');
    expect(markup).toContain('Availability and absences');
  });

  it('keeps membership failure independent from a ready responsibilities surface', () => {
    const markup = renderToStaticMarkup(<PersonWizardOrganizationStep draft={draft()} households={[]} groups={[]} responsibilities={[{ id: 'r1', personId: 'p1', responsibilityKey: 'sound', startsAt: '2026-01-01T00:00:00.000Z' }]} membershipState="error" responsibilityState="ready" canWriteMembership={false} canWriteResponsibilities labels={personWizardCopy.en.organization} onChange={() => undefined} onRetryMembership={() => undefined} onRetryResponsibilities={() => undefined} />);
    expect(markup).toContain('could not be loaded');
    expect(markup).toContain('sound');
    expect(markup).toContain('End');
  });

  it('renders authorized Contact fields and localized validation', () => {
    const markup = renderToStaticMarkup(<PersonWizardContactStep contact={{ email: 'bad' }} state="ready" canWrite labels={personWizardCopy.en.contact} errors={{ email: personWizardCopy.en.contact.emailInvalid }} onChange={() => undefined} onRetry={() => undefined} />);
    expect(markup).toContain('type="email"');
    expect(markup).toContain('Enter a valid email');
  });

  it('renders Contact 401 and 403 distinctly', () => {
    const unauthorized = renderToStaticMarkup(<PersonWizardContactStep contact={{}} state="unauthenticated" canWrite={false} labels={personWizardCopy.en.contact} errors={{}} onChange={() => undefined} onRetry={() => undefined} />);
    const forbidden = renderToStaticMarkup(<PersonWizardContactStep contact={{}} state="forbidden" canWrite={false} labels={personWizardCopy.en.contact} errors={{}} onChange={() => undefined} onRetry={() => undefined} />);
    expect(unauthorized).toContain('session ended');
    expect(forbidden).toContain('permission');
  });

  it('reviews human-readable changes without technical person/tenant/resource IDs', () => {
    const initial = draft({ displayName: 'Ana', contact: { phone: '111' } });
    const value = { ...initial, displayName: 'Ana Maria', contact: { email: 'ana@example.org' }, responsibilityEnds: [{ id: 'r1', endsAt: '2026-08-26T12:00:00.000Z' }], availabilityRemovals: [{ id: 'a1' }] };
    const markup = renderToStaticMarkup(<PersonWizardReviewStep mode="edit" locale="en" draft={value} initial={initial} households={[]} groups={[]} responsibilities={[{ id: 'r1', personId: 'person-1', responsibilityKey: 'sound', startsAt: '2026-01-01T00:00:00.000Z' }]} periods={[{ id: 'a1', startsAt: '2026-09-01T00:00:00.000Z', endsAt: '2026-09-02T00:00:00.000Z', reasonCode: 'away' }]} labels={personWizardCopy.en.review} />);
    expect(markup).toContain('Ana → Ana Maria');
    expect(markup).toContain('ana@example.org');
    expect(markup).toContain('sound');
    expect(markup).not.toContain('person-1');
    expect(markup).not.toContain('tenant');
    expect(markup).not.toContain('r1');
    expect(markup).not.toContain('a1');
  });

  it('guards double submit and preserves ambiguous-create semantics', async () => {
    const guard = createPersonWizardMutationGuard();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const mutation = vi.fn(async () => pending);
    const first = guard(mutation);
    const second = guard(mutation);
    expect(mutation).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(isAmbiguousCreateOutcome('create', 'retryable-error', false)).toBe(true);
    expect(isAmbiguousCreateOutcome('create', 'retryable-error', true)).toBe(false);
  });

  it('preserves explicit 401/403/retryable classification and baseline ownership', () => {
    expect(wizardErrorState(new Error('Unauthorized (401)'))).toBe('unauthenticated');
    expect(wizardResourceState(new Error('Forbidden (403)'))).toBe('forbidden');
    expect(wizardErrorState(new Error('API request failed (503)'))).toBe('retryable-error');
    expect(shouldInitializeRelatedBaseline(true, false)).toBe(true);
    expect(shouldInitializeRelatedBaseline(true, true)).toBe(false);
  });

  it('preserves pt-PT/en/es guided flow copy', () => {
    expect(personWizardCopy['pt-PT'].steps).toEqual(['Identidade', 'Contacto', 'Organização', 'Participação', 'Rever']);
    expect(personWizardCopy.en.steps[4]).toBe('Review');
    expect(personWizardCopy.es.contact.email).toBe('Email');
  });

  it('keeps the keyboard form path and unsaved-change detection', () => {
    const value = draft();
    const markup = renderToStaticMarkup(<Form><PersonWizardIdentityStep draft={value} labels={personWizardCopy.en.identity} onChange={() => undefined} /><button type="submit">Next</button></Form>);
    expect(markup).toContain('<input');
    expect(markup).toContain('type="submit"');
    expect(personWizardHasChanges(value, value)).toBe(false);
    expect(personWizardHasChanges(value, { ...value, contact: { phone: '123' } })).toBe(true);
  });
});
