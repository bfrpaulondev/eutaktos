import type { AvailabilityApi, AvailabilityPeriodDto, AvailabilityReasonCode } from './lib/availabilityApi';
import type { EligibilityApi } from './lib/eligibilityApi';
import type { HouseholdDto, HouseholdsApi } from './lib/householdsApi';
import type { OrdinaryContactApi, OrdinaryContactDto } from './lib/ordinaryContactApi';
import type { PeopleApi, PersonProfileDto, UpdatePersonPayload } from './lib/peopleApi';
import type { Locale } from './lib/preferences';
import type { ResponsibilitiesApi, ResponsibilityDto } from './lib/responsibilitiesApi';
import type { ServiceGroupDto, ServiceGroupsApi } from './lib/serviceGroupsApi';

export type PersonWizardMode = 'create' | 'edit';
export type PersonWizardMutationState = 'idle' | 'validating' | 'submitting' | 'success' | 'validation-error' | 'unauthenticated' | 'permission-error' | 'retryable-error';
export type PersonWizardResourceState = 'loading' | 'ready' | 'error' | 'forbidden' | 'unauthenticated';
export type EligibilityChoice = 'unchanged' | 'enabled' | 'disabled';
export type PersonWizardResponsibilityStatus = 'scheduled' | 'active' | 'ended' | 'invalid';

export interface PersonWizardResponsibilityDraft {
  readonly responsibilityKey: string;
  readonly startsAt: string;
  readonly endsAt?: string;
}

export interface PersonWizardResponsibilityEndDraft {
  readonly id: string;
  readonly endsAt: string;
}

export interface PersonWizardAvailabilityDraft {
  readonly startsAt: string;
  readonly endsAt: string;
  readonly reasonCode?: AvailabilityReasonCode;
}

export interface PersonWizardAvailabilityRemovalDraft {
  readonly id: string;
}

export interface PersonWizardDraft {
  displayName: string;
  preferredLocale: string;
  active: boolean;
  contact: OrdinaryContactDto;
  householdIds: readonly string[];
  serviceGroupIds: readonly string[];
  eligibility: Readonly<Record<string, EligibilityChoice>>;
  responsibilities: readonly PersonWizardResponsibilityDraft[];
  responsibilityEnds: readonly PersonWizardResponsibilityEndDraft[];
  availabilityPeriods: readonly PersonWizardAvailabilityDraft[];
  availabilityRemovals: readonly PersonWizardAvailabilityRemovalDraft[];
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
  try {
    return new Intl.Locale(candidate).toString();
  } catch {
    return candidate;
  }
}

export function normalizePersonWizardContact(value: OrdinaryContactDto): OrdinaryContactDto {
  const phone = value.phone?.trim().replace(/\s+/g, ' ');
  const email = value.email?.trim();
  const address = value.address?.trim().replace(/\s+/g, ' ');
  return {
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(address ? { address } : {}),
  };
}

export function personWizardContactValidation(value: OrdinaryContactDto): readonly ('phone' | 'email' | 'address')[] {
  const contact = normalizePersonWizardContact(value);
  const errors: ('phone' | 'email' | 'address')[] = [];
  if (contact.phone && contact.phone.length > 40) errors.push('phone');
  if (contact.email && (contact.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email))) errors.push('email');
  if (contact.address && contact.address.length > 500) errors.push('address');
  return errors;
}

function sameContact(left: OrdinaryContactDto, right: OrdinaryContactDto): boolean {
  const a = normalizePersonWizardContact(left);
  const b = normalizePersonWizardContact(right);
  return a.phone === b.phone && a.email === b.email && a.address === b.address;
}

export function createPersonWizardDraft(locale: Locale, person?: PersonProfileDto): PersonWizardDraft {
  return {
    displayName: person?.displayName ?? '',
    preferredLocale: person?.preferredLocale ?? locale,
    active: person?.active ?? true,
    contact: {},
    householdIds: [],
    serviceGroupIds: [],
    eligibility: {},
    responsibilities: [],
    responsibilityEnds: [],
    availabilityPeriods: [],
    availabilityRemovals: [],
  };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function personWizardMembershipChanges(initialIds: readonly string[], draftIds: readonly string[]): readonly Readonly<PersonWizardMembershipChange>[] {
  const ids = [...new Set([...initialIds, ...draftIds])].sort();
  return Object.freeze(ids
    .filter(id => initialIds.includes(id) !== draftIds.includes(id))
    .map(id => Object.freeze({ id, selected: draftIds.includes(id) })));
}

export function personWizardContactChanged(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return !sameContact(initial.contact, draft.contact);
}

export function personWizardContactNeedsPersistence(mode: PersonWizardMode, initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  if (mode === 'create') return Object.keys(normalizePersonWizardContact(draft.contact)).length > 0;
  return personWizardContactChanged(initial, draft);
}

export function personWizardOrganizationChanged(initial: PersonWizardDraft, draft: PersonWizardDraft): boolean {
  return personWizardMembershipChanges(initial.householdIds, draft.householdIds).length > 0
    || personWizardMembershipChanges(initial.serviceGroupIds, draft.serviceGroupIds).length > 0
    || draft.responsibilities.length > 0
    || draft.responsibilityEnds.length > 0;
}

export function personWizardEligibilityChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): readonly Readonly<{ assignmentTypeId: string; choice: Exclude<EligibilityChoice, 'unchanged'> }>[] {
  return Object.freeze(Object.entries(draft.eligibility)
    .filter(([, choice]) => choice !== 'unchanged')
    .filter(([id, choice]) => choice !== (initial.eligibility[id] ?? 'unchanged'))
    .map(([assignmentTypeId, choice]) => Object.freeze({ assignmentTypeId, choice: choice as Exclude<EligibilityChoice, 'unchanged'> })));
}

export function isPersonWizardTemporalRangeValid(startsAt: string, endsAt: string | undefined, endRequired = false): boolean {
  const start = Date.parse(startsAt);
  if (!startsAt || !Number.isFinite(start)) return false;
  if (!endsAt) return !endRequired;
  const end = Date.parse(endsAt);
  return Number.isFinite(end) && end > start;
}

export function personWizardResponsibilityStatus(item: Pick<ResponsibilityDto, 'startsAt' | 'endsAt'>, now = new Date()): PersonWizardResponsibilityStatus {
  const current = now.getTime();
  const start = Date.parse(item.startsAt);
  const end = item.endsAt === undefined ? undefined : Date.parse(item.endsAt);
  if (!Number.isFinite(current) || !Number.isFinite(start) || (end !== undefined && !Number.isFinite(end))) return 'invalid';
  if (end !== undefined && end <= start) return 'invalid';
  if (current < start) return 'scheduled';
  if (end !== undefined && current >= end) return 'ended';
  return 'active';
}

export function personWizardAvailabilityChanges(initial: PersonWizardDraft, draft: PersonWizardDraft): readonly PersonWizardAvailabilityDraft[] {
  return Object.freeze(draft.availabilityPeriods.filter(period => !initial.availabilityPeriods.some(previous =>
    previous.startsAt === period.startsAt
    && previous.endsAt === period.endsAt
    && previous.reasonCode === period.reasonCode)));
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
    || personWizardContactChanged(initial, draft)
    || personWizardOrganizationChanged(initial, draft)
    || personWizardEligibilityChanges(initial, draft).length > 0
    || personWizardAvailabilityChanges(initial, draft).length > 0
    || draft.availabilityRemovals.length > 0;
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
    status === 400 || status === 409 || status === 422
    || /required|\bmust\b|too long|not allowed|already exists|duplicate|conflict|unknown (?:assignment|person|household|group)|invalid (?:availability|responsibility|date|contact)|end after/i.test(message)
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
    try {
      return await mutation();
    } finally {
      active = false;
    }
  };
}

export interface SavePersonWizardInput {
  mode: PersonWizardMode;
  person?: PersonProfileDto;
  draft: PersonWizardDraft;
  initial: PersonWizardDraft;
  /** Retained for call compatibility; fresh organization reads remain authoritative. */
  households: readonly HouseholdDto[];
  /** Retained for call compatibility; fresh organization reads remain authoritative. */
  groups: readonly ServiceGroupDto[];
  canReadContact?: boolean;
  canWriteContact?: boolean;
  canReadEligibility: boolean;
  canWriteEligibility: boolean;
  canReadResponsibilities?: boolean;
  canWriteResponsibilities?: boolean;
  canReadAvailability?: boolean;
  canWriteAvailability?: boolean;
  onCorePersisted?: (person: PersonProfileDto) => void;
  onMutationPersisted?: () => void;
  apis: Readonly<{
    people: PeopleApi;
    households: HouseholdsApi;
    serviceGroups: ServiceGroupsApi;
    eligibility: EligibilityApi;
    contact?: OrdinaryContactApi;
    responsibilities?: ResponsibilitiesApi;
    availability?: AvailabilityApi;
  }>;
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

function responsibilityMatches(item: ResponsibilityDto, personId: string, draft: PersonWizardResponsibilityDraft): boolean {
  return item.personId === personId
    && item.responsibilityKey === draft.responsibilityKey.trim()
    && item.startsAt === draft.startsAt
    && (item.endsAt ?? '') === (draft.endsAt ?? '');
}

function availabilityMatches(item: AvailabilityPeriodDto, draft: PersonWizardAvailabilityDraft): boolean {
  return item.startsAt === draft.startsAt
    && item.endsAt === draft.endsAt
    && item.reasonCode === draft.reasonCode;
}

export async function savePersonWizard(input: SavePersonWizardInput): Promise<PersonProfileDto> {
  const { mode, person, draft, initial, canReadEligibility, canWriteEligibility, apis } = input;
  const intendedCoreChanges = personWizardCoreChanges(initial, draft);
  const contactNeedsPersistence = personWizardContactNeedsPersistence(mode, initial, draft);
  const householdChanges = personWizardMembershipChanges(initial.householdIds, draft.householdIds);
  const groupChanges = personWizardMembershipChanges(initial.serviceGroupIds, draft.serviceGroupIds);
  const membershipChanged = householdChanges.length > 0 || groupChanges.length > 0;
  const eligibilityChanges = personWizardEligibilityChanges(initial, draft);
  const responsibilityAdds = draft.responsibilities;
  const responsibilityEnds = draft.responsibilityEnds;
  const availabilityAdds = personWizardAvailabilityChanges(initial, draft);
  const availabilityRemovals = draft.availabilityRemovals;
  const displayName = normalizePersonWizardDisplayName(draft.displayName);
  const preferredLocale = normalizePersonWizardLocale(draft.preferredLocale);

  if (personWizardContactValidation(draft.contact).length > 0) throw new Error('Invalid contact values (422)');
  if (contactNeedsPersistence && (!input.canReadContact || !input.canWriteContact || !apis.contact)) throw new Error('Forbidden (403)');
  if (eligibilityChanges.length > 0 && (!canReadEligibility || !canWriteEligibility)) throw new Error('Forbidden (403)');
  if ((responsibilityAdds.length > 0 || responsibilityEnds.length > 0) && (!input.canReadResponsibilities || !input.canWriteResponsibilities || !apis.responsibilities)) throw new Error('Forbidden (403)');
  if ((availabilityAdds.length > 0 || availabilityRemovals.length > 0) && (!input.canReadAvailability || !input.canWriteAvailability || !apis.availability)) throw new Error('Forbidden (403)');
  if (responsibilityAdds.some(item => !item.responsibilityKey.trim() || !isPersonWizardTemporalRangeValid(item.startsAt, item.endsAt))) throw new Error('Invalid responsibility values (422)');
  if (responsibilityEnds.some(item => !item.id || !Number.isFinite(Date.parse(item.endsAt)))) throw new Error('Invalid responsibility values (422)');
  if (availabilityAdds.some(item => !isPersonWizardTemporalRangeValid(item.startsAt, item.endsAt, true))) throw new Error('Invalid availability values (422)');

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

  if (contactNeedsPersistence) {
    const desiredContact = normalizePersonWizardContact(draft.contact);
    const currentContact = await apis.contact!.get(personId);
    if (!sameContact(currentContact, desiredContact)) {
      await apis.contact!.update(personId, desiredContact);
      input.onMutationPersisted?.();
    }
  }

  if (membershipChanged) {
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

  for (const ending of responsibilityEnds) {
    const current = await apis.responsibilities!.list();
    const item = current.find(candidate => candidate.id === ending.id);
    if (!item || item.personId !== personId) throw new Error('Responsibility no longer exists (409)');
    if (item.endsAt === ending.endsAt) continue;
    if (item.endsAt !== undefined) throw new Error('Responsibility changed concurrently (409)');
    if (Date.parse(ending.endsAt) <= Date.parse(item.startsAt)) throw new Error('Invalid responsibility values (422)');
    await apis.responsibilities!.end(item.id, { endsAt: ending.endsAt });
    input.onMutationPersisted?.();
  }

  for (const addition of responsibilityAdds) {
    const current = await apis.responsibilities!.list();
    if (current.some(item => responsibilityMatches(item, personId, addition))) continue;
    await apis.responsibilities!.assign({
      personId,
      responsibilityKey: addition.responsibilityKey.trim(),
      startsAt: addition.startsAt,
      ...(addition.endsAt ? { endsAt: addition.endsAt } : {}),
    });
    input.onMutationPersisted?.();
  }

  if (eligibilityChanges.length > 0) {
    const current = await apis.eligibility.list(personId);
    for (const change of eligibilityChanges) {
      const expected = desiredEligibility(change.choice);
      if (current.find(item => item.assignmentTypeId === change.assignmentTypeId)?.enabled === expected) continue;
      await apis.eligibility.set(personId, { assignmentTypeId: change.assignmentTypeId, enabled: expected });
      input.onMutationPersisted?.();
    }
  }

  for (const removal of availabilityRemovals) {
    const current = await apis.availability!.list(personId);
    if (!current.some(item => item.id === removal.id)) continue;
    await apis.availability!.remove(personId, removal.id);
    input.onMutationPersisted?.();
  }

  for (const addition of availabilityAdds) {
    const current = await apis.availability!.list(personId);
    if (current.some(item => availabilityMatches(item, addition))) continue;
    await apis.availability!.add(personId, {
      startsAt: addition.startsAt,
      endsAt: addition.endsAt,
      ...(addition.reasonCode ? { reasonCode: addition.reasonCode } : {}),
    });
    input.onMutationPersisted?.();
  }

  const peopleValue = await apis.people.list();
  const authoritative = peopleValue.find(item => item.id === personId);
  if (!authoritative) throw new Error('Authoritative People refetch mismatch');
  if (mode === 'create') {
    if (
      authoritative.displayName !== saved.displayName
      || normalizePersonWizardLocale(authoritative.preferredLocale ?? '') !== normalizePersonWizardLocale(saved.preferredLocale ?? '')
      || authoritative.active !== saved.active
    ) throw new Error('Authoritative People refetch mismatch');
  } else {
    if (intendedCoreChanges.displayName !== undefined && authoritative.displayName !== saved.displayName) throw new Error('Authoritative People refetch mismatch');
    if (intendedCoreChanges.preferredLocale !== undefined && normalizePersonWizardLocale(authoritative.preferredLocale ?? '') !== normalizePersonWizardLocale(saved.preferredLocale ?? '')) throw new Error('Authoritative People refetch mismatch');
    if (intendedCoreChanges.active !== undefined && authoritative.active !== saved.active) throw new Error('Authoritative People refetch mismatch');
  }

  if (contactNeedsPersistence) {
    const value = await apis.contact!.get(personId);
    if (!sameContact(value, draft.contact)) throw new Error('Authoritative contact refetch mismatch');
  }

  if (membershipChanged) {
    const [householdValue, groupValue] = await Promise.all([apis.households.list(), apis.serviceGroups.list()]);
    if (
      householdChanges.some(change => !membershipMatches(householdValue, personId, change))
      || groupChanges.some(change => !membershipMatches(groupValue, personId, change))
    ) throw new Error('Authoritative organization refetch mismatch');
  }

  if (responsibilityAdds.length > 0 || responsibilityEnds.length > 0) {
    const values = await apis.responsibilities!.list();
    if (responsibilityAdds.some(change => !values.some(item => responsibilityMatches(item, personId, change)))) throw new Error('Authoritative responsibility refetch mismatch');
    for (const ending of responsibilityEnds) {
      const item = values.find(candidate => candidate.id === ending.id);
      if (!item || item.personId !== personId || item.endsAt !== ending.endsAt) throw new Error('Authoritative responsibility refetch mismatch');
    }
  }

  if (eligibilityChanges.length > 0) {
    const values = await apis.eligibility.list(personId);
    for (const change of eligibilityChanges) {
      if (values.find(item => item.assignmentTypeId === change.assignmentTypeId)?.enabled !== desiredEligibility(change.choice)) throw new Error('Authoritative eligibility refetch mismatch');
    }
  }

  if (availabilityAdds.length > 0 || availabilityRemovals.length > 0) {
    const values = await apis.availability!.list(personId);
    if (availabilityAdds.some(change => !values.some(item => availabilityMatches(item, change)))) throw new Error('Authoritative availability refetch mismatch');
    if (availabilityRemovals.some(change => values.some(item => item.id === change.id))) throw new Error('Authoritative availability refetch mismatch');
  }

  return authoritative;
}
