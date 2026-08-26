import type { Locale } from './lib/preferences';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

export type PersonWizardMode = 'create' | 'edit';
export type PersonWizardMutationState = 'idle' | 'validating' | 'submitting' | 'success' | 'validation-error' | 'unauthenticated' | 'permission-error' | 'retryable-error';
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
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

export function personWizardHasChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return initial.displayName.trim() !== draft.displayName.trim()
    || initial.preferredLocale !== draft.preferredLocale
    || initial.active !== draft.active
    || !sameStrings(initial.householdIds, draft.householdIds)
    || !sameStrings(initial.serviceGroupIds, draft.serviceGroupIds)
    || Object.keys(draft.eligibility).some(key => draft.eligibility[key] !== (initial.eligibility[key] ?? 'unchanged'));
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
  if (status === 400 || status === 409 || status === 422 || /required|invalid|validation/i.test(message)) return 'validation-error';
  return 'retryable-error';
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
  households: readonly HouseholdDto[];
  groups: readonly ServiceGroupDto[];
  canReadEligibility: boolean;
  canWriteEligibility: boolean;
  onCorePersisted?: (person: PersonProfileDto) => void;
  apis: Readonly<{ people: PeopleApi; households: HouseholdsApi; serviceGroups: ServiceGroupsApi; eligibility: EligibilityApi }>;
}

function selectedMembership<T extends { id: string; memberIds: readonly string[] }>(items: readonly T[], personId: string): string[] {
  return items.filter(item => item.memberIds.includes(personId)).map(item => item.id);
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every(value => right.includes(value));
}

export async function savePersonWizard(input: SavePersonWizardInput): Promise<PersonProfileDto> {
  const { mode, person, draft, initial, canReadEligibility, canWriteEligibility, apis } = input;
  const eligibilityChanged = Object.entries(draft.eligibility).some(([id, choice]) => choice !== 'unchanged' && choice !== (initial.eligibility[id] ?? 'unchanged'));
  if (eligibilityChanged && !canWriteEligibility) throw new Error('Forbidden (403)');
  let saved = person;
  if (mode === 'create' && !person) saved = await apis.people.create({ displayName: draft.displayName.trim(), ...(draft.preferredLocale ? { preferredLocale: draft.preferredLocale } : {}), active: draft.active });
  else if (person && personProfileHasChanges(person, draft)) saved = await apis.people.update(person.id, { displayName: draft.displayName.trim(), preferredLocale: draft.preferredLocale || null, active: draft.active });
  if (!saved) throw new Error('Missing person for edit');
  input.onCorePersisted?.(saved);

  const personId = saved.id;
  // Membership endpoints replace complete arrays, so merge against the freshest authorized read.
  const [freshHouseholds, freshGroups] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
  const organizationWrites: Promise<unknown>[] = [];
  for (const item of freshHouseholds) {
    const wasSelected = initial.householdIds.includes(item.id); const selected = draft.householdIds.includes(item.id);
    if (wasSelected !== selected) organizationWrites.push(apis.households.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, selected) }));
  }
  for (const item of freshGroups) {
    const wasSelected = initial.serviceGroupIds.includes(item.id); const selected = draft.serviceGroupIds.includes(item.id);
    if (wasSelected !== selected) organizationWrites.push(apis.serviceGroups.update(item.id, { memberIds: memberIdsWithPerson(item.memberIds, personId, selected) }));
  }
  await Promise.all(organizationWrites);

  await Promise.all(Object.entries(draft.eligibility)
    .filter(([id, choice]) => choice !== 'unchanged' && choice !== (initial.eligibility[id] ?? 'unchanged'))
    .map(([assignmentTypeId, choice]) => apis.eligibility.set(personId, { assignmentTypeId, enabled: choice === 'enabled' })));

  const [peopleValue, householdValue, groupValue, eligibilityValue] = await Promise.all([
    apis.people.list(), apis.households.list(), apis.serviceGroups.list(), canReadEligibility ? apis.eligibility.list(personId) : Promise.resolve([]),
  ]);
  const authoritative = peopleValue.find(item => item.id === personId);
  if (!authoritative || authoritative.displayName !== draft.displayName.trim() || (authoritative.preferredLocale ?? '') !== draft.preferredLocale || authoritative.active !== draft.active) throw new Error('Authoritative People refetch mismatch');
  if (!sameSet(selectedMembership(householdValue, personId), draft.householdIds) || !sameSet(selectedMembership(groupValue, personId), draft.serviceGroupIds)) throw new Error('Authoritative organization refetch mismatch');
  for (const [id, choice] of Object.entries(draft.eligibility)) {
    if (choice === 'unchanged') continue;
    if (eligibilityValue.find(item => item.assignmentTypeId === id)?.enabled !== (choice === 'enabled')) throw new Error('Authoritative eligibility refetch mismatch');
  }
  return authoritative;
}
