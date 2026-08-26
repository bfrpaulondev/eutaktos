import type { Locale } from './lib/preferences';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

export type PersonWizardMode = 'create' | 'edit';
export type PersonWizardMutationState = 'idle' | 'validating' | 'submitting' | 'success' | 'validation-error' | 'unauthenticated' | 'permission-error' | 'retryable-error';
export type PersonWizardResourceState = 'loading' | 'ready' | 'error' | 'forbidden' | 'unauthenticated';
export type EligibilityChoice = 'unchanged' | 'enabled' | 'disabled';

export interface PersonWizardDraft {
  displayName: string;
  preferredLocale: string;
  active: boolean;
  householdIds: readonly string[];
  serviceGroupIds: readonly string[];
  eligibility: Readonly<Record<string, EligibilityChoice>>;
}

export function createPersonWizardDraft(locale: Locale, person?: PersonProfileDto): PersonWizardDraft {
  return {
    displayName: person?.displayName ?? '',
    preferredLocale: person?.preferredLocale ?? locale,
    active: person?.active ?? true,
    householdIds: [],
    serviceGroupIds: [],
    eligibility: {},
  };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const leftValues = [...left].sort();
  const rightValues = [...right].sort();
  return leftValues.length === rightValues.length && leftValues.every((value, index) => value === rightValues[index]);
}

export function personWizardOrganizationChanged(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return !sameStrings(initial.householdIds, draft.householdIds) || !sameStrings(initial.serviceGroupIds, draft.serviceGroupIds);
}

export function personWizardEligibilityChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): readonly Readonly<{ assignmentTypeId: string; choice: Exclude<EligibilityChoice, 'unchanged'> }>[] {
  return Object.freeze(Object.entries(draft.eligibility)
    .filter(([, choice]) => choice !== 'unchanged')
    .filter(([id, choice]) => choice !== (initial.eligibility[id] ?? 'unchanged'))
    .map(([assignmentTypeId, choice]) => Object.freeze({ assignmentTypeId, choice: choice as Exclude<EligibilityChoice, 'unchanged'> })));
}

export function personWizardHasChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return initial.displayName.trim() !== draft.displayName.trim()
    || initial.preferredLocale !== draft.preferredLocale
    || initial.active !== draft.active
    || personWizardOrganizationChanged(initial, draft)
    || personWizardEligibilityChanges(initial, draft).length > 0;
}

export function personProfileHasChanges(person: PersonProfileDto, draft: PersonWizardDraft): boolean {
  return person.displayName !== draft.displayName.trim()
    || (person.preferredLocale ?? '') !== draft.preferredLocale
    || person.active !== draft.active;
}

export function memberIdsWithPerson(memberIds: readonly string[], personId: string, selected: boolean): string[] {
  const members = memberIds.filter(id => id !== personId);
  if (selected) members.push(personId);
  return members;
}

export function wizardErrorState(error: unknown): Exclude<PersonWizardMutationState, 'idle' | 'validating' | 'submitting' | 'success'> {
  const message = error instanceof Error ? error.message : '';
  const status = Number(/\((\d{3})\)$/.exec(message)?.[1]);
  if (status === 401 || /unauthorized|sign-in|sessão|sesión/i.test(message)) return 'unauthenticated';
  if (status === 403 || /forbidden|access denied|permission|permissão|permiso/i.test(message)) return 'permission-error';
  if (
    status === 400 || status === 409 || status === 422 ||
    /required|\bmust\b|too long|not allowed|already exists|duplicate|conflict|unknown (?:assignment|person|household|group)|invalid (?:display|preferred|locale|assignment|person|household|group)/i.test(message)
  ) return 'validation-error';
  return 'retryable-error';
}

export function wizardResourceState(error: unknown): Exclude<PersonWizardResourceState, 'loading' | 'ready'> {
  const state = wizardErrorState(error);
  if (state === 'unauthenticated') return 'unauthenticated';
  if (state === 'permission-error') return 'forbidden';
  return 'error';
}

export function shouldInitializeRelatedBaseline(preserveDraft: boolean, initialized: boolean): boolean {
  return !preserveDraft || !initialized;
}

export function isAmbiguousCreateOutcome(mode: PersonWizardMode, state: PersonWizardMutationState, hasConfirmedCore: boolean): boolean {
  return mode === 'create' && state === 'retryable-error' && !hasConfirmedCore;
}

export function supportedLocaleOptions(current: string): readonly string[] {
  return [...new Set(['pt-PT', 'en', 'es', ...(current && !['pt-PT', 'en', 'es'].includes(current) ? [current] : [])])];
}

export function personWizardStep(current: number, action: 'next' | 'previous'): number {
  return Math.max(0, Math.min(4, current + (action === 'next' ? 1 : -1)));
}

export function personWizardDisplayNameValid(displayName: string): boolean {
  return displayName.trim().length > 0;
}

export function createPersonWizardMutationGuard() {
  let active = false;
  return async <T>(mutation: () => Promise<T>): Promise<T | undefined> => {
    if (active) return undefined;
    active = true;
    try { return await mutation(); }
    finally { active = false; }
  };
}

export interface SavePersonWizardInput {
  mode: PersonWizardMode;
  person?: PersonProfileDto;
  draft: PersonWizardDraft;
  initial: PersonWizardDraft;
  /** Retained for worker-call compatibility; fresh organization reads remain authoritative. */
  households: readonly HouseholdDto[];
  /** Retained for worker-call compatibility; fresh organization reads remain authoritative. */
  groups: readonly ServiceGroupDto[];
  canReadEligibility: boolean;
  canWriteEligibility: boolean;
  /** Receives the authoritative core person so a retry never needs another create/update for an already-confirmed core write. */
  onCorePersisted?: (person: PersonProfileDto) => void;
  /** Called after each successful mutation so the UI can disclose possible partial persistence if a later step fails. */
  onMutationPersisted?: () => void;
  apis: Readonly<{ people: PeopleApi; households: HouseholdsApi; serviceGroups: ServiceGroupsApi; eligibility: EligibilityApi }>;
}

function selectedMembership<T extends { id: string; memberIds: readonly string[] }>(items: readonly T[], personId: string): string[] {
  return items.filter(item => item.memberIds.includes(personId)).map(item => item.id);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return sameStrings(left, right);
}

function desiredEligibility(choice: Exclude<EligibilityChoice, 'unchanged'>): boolean {
  return choice === 'enabled';
}

export async function savePersonWizard(input: SavePersonWizardInput): Promise<PersonProfileDto> {
  const { mode, person, draft, initial, canReadEligibility, canWriteEligibility, apis } = input;
  const organizationChanged = personWizardOrganizationChanged(initial, draft);
  const eligibilityChanges = personWizardEligibilityChanges(initial, draft);

  // Eligibility changes require both explicit write authority and a readable
  // authoritative baseline. Fail before the core mutation so capability gaps do
  // not create avoidable partial saves.
  if (eligibilityChanges.length > 0 && (!canReadEligibility || !canWriteEligibility)) throw new Error('Forbidden (403)');

  let saved = person;
  let coreMutated = false;
  if (mode === 'create' && !person) {
    saved = await apis.people.create({ displayName: draft.displayName.trim(), ...(draft.preferredLocale ? { preferredLocale: draft.preferredLocale } : {}), active: draft.active });
    coreMutated = true;
  } else if (person && personProfileHasChanges(person, draft)) {
    saved = await apis.people.update(person.id, { displayName: draft.displayName.trim(), preferredLocale: draft.preferredLocale || null, active: draft.active });
    coreMutated = true;
  }
  if (!saved) throw new Error('Missing person for edit');
  input.onCorePersisted?.(saved);
  if (coreMutated) input.onMutationPersisted?.();

  const personId = saved.id;

  // Organization is optional. Do not make an identity-only save depend on these
  // APIs. When it did change, compare against fresh state before every write so a
  // retry skips relations that were already persisted by a previous partial run.
  if (organizationChanged) {
    const [freshHouseholds, freshGroups] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
    for (const item of freshHouseholds) {
      const selected = draft.householdIds.includes(item.id);
      if (item.memberIds.includes(personId) === selected) continue;
      await apis.households.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, selected) });
      input.onMutationPersisted?.();
    }
    for (const item of freshGroups) {
      const selected = draft.serviceGroupIds.includes(item.id);
      if (item.memberIds.includes(personId) === selected) continue;
      await apis.serviceGroups.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, selected) });
      input.onMutationPersisted?.();
    }
  }

  // The eligibility service is already idempotent, but skip an already-applied
  // decision here as well so retries do not generate unnecessary network work.
  if (eligibilityChanges.length > 0) {
    const current = await apis.eligibility.list(personId);
    for (const change of eligibilityChanges) {
      const expected = desiredEligibility(change.choice);
      if (current.find(item => item.assignmentTypeId === change.assignmentTypeId)?.enabled === expected) continue;
      await apis.eligibility.set(personId, { assignmentTypeId: change.assignmentTypeId, enabled: expected });
      input.onMutationPersisted?.();
    }
  }

  // The core person is always re-read before success. Optional sections are
  // re-read only if this save actually attempted to change them.
  const peopleValue = await apis.people.list();
  const authoritative = peopleValue.find(item => item.id === personId);
  if (!authoritative || authoritative.displayName !== draft.displayName.trim() || (authoritative.preferredLocale ?? '') !== draft.preferredLocale || authoritative.active !== draft.active) throw new Error('Authoritative People refetch mismatch');

  if (organizationChanged) {
    const [householdValue, groupValue] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
    if (!sameSet(selectedMembership(householdValue, personId), draft.householdIds) || !sameSet(selectedMembership(groupValue, personId), draft.serviceGroupIds)) throw new Error('Authoritative organization refetch mismatch');
  }

  if (eligibilityChanges.length > 0) {
    const eligibilityValue = await apis.eligibility.list(personId);
    for (const change of eligibilityChanges) {
      if (eligibilityValue.find(item => item.assignmentTypeId === change.assignmentTypeId)?.enabled !== desiredEligibility(change.choice)) throw new Error('Authoritative eligibility refetch mismatch');
    }
  }

  return authoritative;
}
