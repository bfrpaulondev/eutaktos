import type { CongregationPerson, PersonId } from './people';

export type PersonArchiveAction = 'archived' | 'restored';

export interface PersonArchiveHistoryEntry {
  action: PersonArchiveAction;
  actorId: PersonId;
  occurredAt: string;
  reason?: string;
}

export interface PersonArchiveCurrent {
  actorId: PersonId;
  archivedAt: string;
  reason: string;
  previousActive: boolean;
}

export interface PersonArchiveState {
  current?: PersonArchiveCurrent;
  history: readonly PersonArchiveHistoryEntry[];
}

export type ArchiveAwarePerson = CongregationPerson & {
  publicationArchive?: PersonArchiveState;
};

function instant(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
  return value;
}

function actor(value: string): PersonId {
  const normalized = value.trim();
  if (!normalized) throw new Error('actorId is required');
  return normalized;
}

export function normalizePersonArchiveReason(value: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('archiveReason is required');
  if (normalized.length > 240) throw new Error('archiveReason is too long');
  if (/[\u0000-\u001F\u007F]/.test(normalized)) throw new Error('archiveReason contains control characters');
  return normalized;
}

export function personArchiveState(person: CongregationPerson): PersonArchiveState {
  const archive = (person as ArchiveAwarePerson).publicationArchive;
  return archive ?? Object.freeze({ history: Object.freeze([]) });
}

export function isPersonPublicationArchived(person: CongregationPerson): boolean {
  return personArchiveState(person).current !== undefined;
}

export function archivePersonPublication(
  person: CongregationPerson,
  input: Readonly<{ actorId: PersonId; occurredAt: string; reason: string }>,
): ArchiveAwarePerson {
  const state = personArchiveState(person);
  if (state.current) throw new Error('Person is already archived');
  const actorId = actor(input.actorId);
  const occurredAt = instant(input.occurredAt);
  const reason = normalizePersonArchiveReason(input.reason);
  const entry: PersonArchiveHistoryEntry = Object.freeze({ action: 'archived', actorId, occurredAt, reason });
  const current: PersonArchiveCurrent = Object.freeze({ actorId, archivedAt: occurredAt, reason, previousActive: person.active });
  return {
    ...person,
    active: false,
    publicationArchive: Object.freeze({ current, history: Object.freeze([...state.history, entry]) }),
  };
}

export function restorePersonPublication(
  person: CongregationPerson,
  input: Readonly<{ actorId: PersonId; occurredAt: string }>,
): ArchiveAwarePerson {
  const state = personArchiveState(person);
  if (!state.current) throw new Error('Person is not archived');
  const actorId = actor(input.actorId);
  const occurredAt = instant(input.occurredAt);
  const entry: PersonArchiveHistoryEntry = Object.freeze({ action: 'restored', actorId, occurredAt });
  return {
    ...person,
    active: state.current.previousActive,
    publicationArchive: Object.freeze({ history: Object.freeze([...state.history, entry]) }),
  };
}
