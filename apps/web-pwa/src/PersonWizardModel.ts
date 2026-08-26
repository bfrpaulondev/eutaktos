import type { Locale } from './lib/preferences';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto, UpdatePersonPayload } from './lib/peopleApi';
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

export interface PersonWizardMembershipChange {
  id: string;
  selected: boolean;
}

export function normalizePersonWizardDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizePersonWizardLocale(value: string): string {
  const candidate = value.trim();
  if (!candidate) return '';
  try { return new Intl.Locale(candidate).toString(); }
  catch { return candidate; }
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

export function personWizardMembershipChanges(initialIds: readonly string[], draftIds: readonly string[]): readonly Readonly<PersonWizardMembershipChange>[] {
  const ids = [...new Set([...initialIds, ...draftIds])].sort();
  return Object.freeze(ids
    .filter(id => initialIds.includes(id) !== draftIds.includes(id))
    .map(id => Object.freeze({ id, selected: draftIds.includes(id) })));
}

export function personWizardOrganizationChanged(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return personWizardMembershipChanges(initial.householdIds, draft.householdIds).length > 0
    || personWizardMembershipChanges(initial.serviceGroupIds, draft.serviceGroupIds).length > 0;
}

export function personWizardEligibilityChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): readonly Readonly<{ assignmentTypeId: string; choice: Exclude<EligibilityChoice, 'unchanged'> }>[] {
  return Object.freeze(Object.entries(draft.eligibility)
    .filter(([, choice]) => choice !== 'unchanged')
    .filter(([id, choice]) => choice !== (initial.eligibility[id] ?? 'unchanged'))
    .map(([assignmentTypeId, choice]) => Object.freeze({ assignmentTypeId, choice: choice as Exclude<EligibilityChoice, 'unchanged'> })));
}

export function personWizardCoreChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): UpdatePersonPayload {
  const changes: UpdatePersonPayload = {};
  const initialName = normalizePersonWizardDisplayName(initial.displayName);
  const nextName = normalizePersonWizardDisplayName(draft.displayName);
  const initialLocale = normalizePersonWizardLocale(initial.preferredLocale);
  const nextLocale = normalizePersonWizardLocale(draft.preferredLocale);
  if (initialName !== nextName) changes.displayName = nextName;
  if (initialLocale !== nextLocale) changes.preferredLocale = nextLocale || null;
  if (initial.active !== draft.active) changes.active = draft.active;
  return changes;
}

export function personWizardHasChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return Object.keys(personWizardCoreChanges(initial, draft)).length > 0
    || personWizardOrganizationChanged(initial, draft)
    || personWizardEligibilityChanges(initial, draft).length > 0;
}

export function personProfileHasChanges(person: PersonProfileDto, draft: PersonWizardDraft): boolean {
  return person.displayName !== normalizePersonWizardDisplayName(draft.displayName)
    || normalizePersonWizardLocale(person.preferredLocale ?? '') !== normalizePersonWizardLocale(draft.preferredLocale)
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
    /required|\bmust\b|too long|not allowed|already exists|duplicate|conflict|unknown (?:assignment|person|household|group)/i.test(message)
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
  const normalized = normalizePersonWizardDisplayName(displayName);
  return normalized.length >= 2 && normalized.length <= 120;
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

function desiredEligibility(choice: Exclude<EligibilityChoice, 'unchanged'>): boolean {
  return choice === 'enabled';
}

function pendingCoreChanges(person: PersonProfileDto, intended: UpdatePersonPayload): UpdatePersonPayload {
  const pending: UpdatePersonPayload = {};
  if (intended.displayName !== undefined && person.displayName !== intended.displayName) pending.displayName = intended.displayName;
  if (intended.preferredLocale !== undefined) {
    const expected = intended.preferredLocale === null ? '' : normalizePersonWizardLocale(intended.preferredLocale);
    if (normalizePersonWizardLocale(person.preferredLocale ?? '') !== expected) pending.preferredLocale = intended.preferredLocale;
  }
  if (intended.active !== undefined && person.active !== intended.active) pending.active = intended.active;
  return pending;
}

function membershipMatches<T extends { id: string; memberIds: readonly string[] }>(items: readonly T[], personId: string, change: PersonWizardMembershipChange): boolean {
  const item = items.find(candidate => candidate.id === change.id);
  if (!item) return !change.selected;
  return item.memberIds.includes(personId) === change.selected;
}

export async function savePersonWizard(input: SavePersonWizardInput): Promise<PersonProfileDto> {
  const { mode, person, draft, initial, canReadEligibility, canWriteEligibility, apis } = input;
  const intendedCoreChanges = personWizardCoreChanges(initial, draft);
  const householdChanges = personWizardMembershipChanges(initial.householdIds, draft.householdIds);
  const groupChanges = personWizardMembershipChanges(initial.serviceGroupIds, draft.serviceGroupIds);
  const organizationChanged = householdChanges.length > 0 || groupChanges.length > 0;
  const eligibilityChanges = personWizardEligibilityChanges(initial, draft);
  const displayName = normalizePersonWizardDisplayName(draft.displayName);
  const preferredLocale = normalizePersonWizardLocale(draft.preferredLocale);

  // Eligibility changes require both explicit write authority and a readable
  // authoritative baseline. Fail before the core mutation so capability gaps do
  // not create avoidable partial saves.
  if (eligibilityChanges.length > 0 && (!canReadEligibility || !canWriteEligibility)) throw new Error('Forbidden (403)');

  let saved = person;
  let coreMutated = false;
  if (mode === 'create' && !person) {
    saved = await apis.people.create({ displayName, ...(preferredLocale ? { preferredLocale } : {}), active: draft.active });
    coreMutated = true;
  } else if (person) {
    const pending = pendingCoreChanges(person, intendedCoreChanges);
    if (Object.keys(pending).length > 0) {
      saved = await apis.people.update(person.id, pending);
      coreMutated = true;
    }
  }
  if (!saved) throw new Error('Missing person for edit');
  input.onCorePersisted?.(saved);
  if (coreMutated) input.onMutationPersisted?.();

  const personId = saved.id;

  // Organization changes are deltas, not a stale full replacement. Fresh reads
  // protect other users' unrelated membership changes and also make known retries
  // idempotent.
  if (organizationChanged) {
    const [freshHouseholds, freshGroups] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
    if (householdChanges.some(change => change.selected && !freshHouseholds.some(item => item.id === change.id))) throw new Error('Selected household no longer exists');
    if (groupChanges.some(change => change.selected && !freshGroups.some(item => item.id === change.id))) throw new Error('Selected service group no longer exists');

    for (const change of householdChanges) {
      const item = freshHouseholds.find(candidate => candidate.id === change.id);
      if (!item || item.memberIds.includes(personId) === change.selected) continue;
      await apis.households.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, change.selected) });
      input.onMutationPersisted?.();
    }
    for (const change of groupChanges) {
      const item = freshGroups.find(candidate => candidate.id === change.id);
      if (!item || item.memberIds.includes(personId) === change.selected) continue;
      await apis.serviceGroups.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, change.selected) });
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

  // Always re-read the person before success. For edits, verify only the fields
  // the user intended to change so concurrent unrelated edits are preserved.
  const peopleValue = await apis.people.list();
  const authoritative = peopleValue.find(item => item.id === personId);
  if (!authoritative) throw new Error('Authoritative People refetch mismatch');
  if (mode === 'create') {
    if (authoritative.displayName !== saved.displayName || normalizePersonWizardLocale(authoritative.preferredLocale ?? '') !== normalizePersonWizardLocale(saved.preferredLocale ?? '') || authoritative.active !== saved.active) throw new Error('Authoritative People refetch mismatch');
  } else {
    if (intendedCoreChanges.displayName !== undefined && authoritative.displayName !== saved.displayName) throw new Error('Authoritative People refetch mismatch');
    if (intendedCoreChanges.preferredLocale !== undefined && normalizePersonWizardLocale(authoritative.preferredLocale ?? '') !== normalizePersonWizardLocale(saved.preferredLocale ?? '')) throw new Error('Authoritative People refetch mismatch');
    if (intendedCoreChanges.active !== undefined && authoritative.active !== saved.active) throw new Error('Authoritative People refetch mismatch');
  }

  if (organizationChanged) {
    const [householdValue, groupValue] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
    if (householdChanges.some(change => !membershipMatches(householdValue, personId, change)) || groupChanges.some(change => !membershipMatches(groupValue, personId, change))) throw new Error('Authoritative organization refetch mismatch');
  }

  if (eligibilityChanges.length > 0) {
    const eligibilityValue = await apis.eligibility.list(personId);
    for (const change of eligibilityChanges) {
      if (eligibilityValue.find(item => item.assignmentTypeId === change.assignmentTypeId)?.enabled !== desiredEligibility(change.choice)) throw new Error('Authoritative eligibility refetch mismatch');
    }
  }

  return authoritative;
}
