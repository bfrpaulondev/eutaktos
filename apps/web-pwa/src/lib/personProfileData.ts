import type { AuditHistoryDto } from './auditHistoryApi';
import { auditHistoryApi } from './auditHistoryApi';
import type { AvailabilityPeriodDto } from './availabilityApi';
import { availabilityApi } from './availabilityApi';
import type { EligibilityDecisionDto } from './eligibilityApi';
import { eligibilityApi } from './eligibilityApi';
import type { EmergencyContactDto } from './emergencyContactsApi';
import { emergencyContactsApi } from './emergencyContactsApi';
import type { HouseholdDto } from './householdsApi';
import { householdsApi } from './householdsApi';
import type { MidweekOverviewDto } from './midweekApi';
import { midweekApi } from './midweekApi';
import type { PersonProfileDto } from './peopleApi';
import { peopleApi } from './peopleApi';
import type { ResponsibilityDto } from './responsibilitiesApi';
import { responsibilitiesApi } from './responsibilitiesApi';
import type { ServiceGroupDto } from './serviceGroupsApi';
import { serviceGroupsApi } from './serviceGroupsApi';
import type { CurrentSessionDto } from './sessionApi';
import { sessionApi } from './sessionApi';

export type PersonProfileSectionStatus = 'ready' | 'blocked' | 'unavailable';

export interface PersonProfileSection<T> {
  readonly status: PersonProfileSectionStatus;
  readonly value?: T;
  readonly reason?: 'unauthenticated' | 'forbidden' | 'unavailable';
}

export interface PersonProfileData {
  readonly person: PersonProfileDto;
  readonly session: CurrentSessionDto;
  readonly availability: PersonProfileSection<readonly AvailabilityPeriodDto[]>;
  readonly eligibility: PersonProfileSection<readonly EligibilityDecisionDto[]>;
  readonly contacts: PersonProfileSection<readonly EmergencyContactDto[]>;
  readonly groups: PersonProfileSection<readonly ServiceGroupDto[]>;
  readonly households: PersonProfileSection<readonly HouseholdDto[]>;
  readonly responsibilities: PersonProfileSection<readonly ResponsibilityDto[]>;
  readonly assignments: PersonProfileSection<MidweekOverviewDto>;
  readonly history: PersonProfileSection<readonly AuditHistoryDto[]>;
}

export interface PersonProfileDataApi {
  load(personId: string, signal?: AbortSignal): Promise<PersonProfileData>;
}

export interface PersonProfileDataDependencies {
  readonly people: Pick<typeof peopleApi, 'list'>;
  readonly session: Pick<typeof sessionApi, 'current'>;
  readonly availability: Pick<typeof availabilityApi, 'list'>;
  readonly eligibility: Pick<typeof eligibilityApi, 'list'>;
  readonly contacts: Pick<typeof emergencyContactsApi, 'list'>;
  readonly groups: Pick<typeof serviceGroupsApi, 'list'>;
  readonly households: Pick<typeof householdsApi, 'list'>;
  readonly responsibilities: Pick<typeof responsibilitiesApi, 'list'>;
  readonly assignments: Pick<typeof midweekApi, 'overview'>;
  readonly history: Pick<typeof auditHistoryApi, 'list'>;
}

const defaultDependencies: PersonProfileDataDependencies = Object.freeze({
  people: peopleApi,
  session: sessionApi,
  availability: availabilityApi,
  eligibility: eligibilityApi,
  contacts: emergencyContactsApi,
  groups: serviceGroupsApi,
  households: householdsApi,
  responsibilities: responsibilitiesApi,
  assignments: midweekApi,
  history: auditHistoryApi,
});

export type PersonProfileLoadErrorKind = 'unauthenticated' | 'forbidden' | 'not-found' | 'retryable' | 'invalid';

export class PersonProfileLoadError extends Error {
  constructor(readonly kind: PersonProfileLoadErrorKind, message: string) {
    super(message);
    this.name = 'PersonProfileLoadError';
  }
}

function statusFromError(error: unknown): number | undefined {
  const message = error instanceof Error ? error.message : '';
  const numeric = /\((\d{3})\)/.exec(message);
  if (numeric) return Number(numeric[1]);
  if (/^Unauthorized$/i.test(message)) return 401;
  if (/^Forbidden$/i.test(message)) return 403;
  return undefined;
}

function sectionFromSettled<T>(result: PromiseSettledResult<T>): PersonProfileSection<T> {
  if (result.status === 'fulfilled') return Object.freeze({ status: 'ready', value: result.value });
  if (result.reason instanceof PersonProfileLoadError) {
    if (result.reason.kind === 'unauthenticated') return Object.freeze({ status: 'blocked', reason: 'unauthenticated' });
    if (result.reason.kind === 'forbidden') return Object.freeze({ status: 'blocked', reason: 'forbidden' });
  }
  const status = statusFromError(result.reason);
  if (status === 401) return Object.freeze({ status: 'blocked', reason: 'unauthenticated' });
  if (status === 403) return Object.freeze({ status: 'blocked', reason: 'forbidden' });
  return Object.freeze({ status: 'unavailable', reason: 'unavailable' });
}

function primaryError(error: unknown): PersonProfileLoadError {
  const status = statusFromError(error);
  if (status === 401) return new PersonProfileLoadError('unauthenticated', 'Person profile requires authentication');
  if (status === 403) return new PersonProfileLoadError('forbidden', 'Person profile is forbidden');
  if (status === 404) return new PersonProfileLoadError('not-found', 'Person profile was not found');
  if (error instanceof PersonProfileLoadError) return error;
  return new PersonProfileLoadError('retryable', 'Person profile could not be loaded');
}

export function hasCapability(session: CurrentSessionDto, capability: string): boolean {
  return session.capabilities.includes(capability as never);
}

export function createPersonProfileDataApi(dependencies: PersonProfileDataDependencies = defaultDependencies): PersonProfileDataApi {
  return {
    async load(personId, signal) {
      let people: readonly PersonProfileDto[];
      let session: CurrentSessionDto;
      try {
        [people, session] = await Promise.all([dependencies.people.list(signal), dependencies.session.current(signal)]);
      } catch (error) {
        throw primaryError(error);
      }

      const person = people.find(candidate => candidate.id === personId);
      if (!person) throw new PersonProfileLoadError('not-found', 'Person profile was not found');

      const historyRequest: Promise<readonly AuditHistoryDto[]> = hasCapability(session, 'audit.read')
        ? dependencies.history.list({ resourceType: 'person', resourceId: person.id, limit: 50 }, signal)
        : Promise.reject(new PersonProfileLoadError('forbidden', 'Audit history is not authorized'));

      const [availability, eligibility, contacts, groups, households, responsibilities, assignments, history] = await Promise.allSettled([
        dependencies.availability.list(person.id, signal),
        dependencies.eligibility.list(person.id, signal),
        dependencies.contacts.list(person.id, signal),
        dependencies.groups.list(signal),
        dependencies.households.list(signal),
        dependencies.responsibilities.list(signal),
        dependencies.assignments.overview(signal),
        historyRequest,
      ]);

      return Object.freeze({
        person,
        session,
        availability: sectionFromSettled(availability),
        eligibility: sectionFromSettled(eligibility),
        contacts: sectionFromSettled(contacts),
        groups: sectionFromSettled(groups),
        households: sectionFromSettled(households),
        responsibilities: sectionFromSettled(responsibilities),
        assignments: sectionFromSettled(assignments),
        history: sectionFromSettled(history),
      });
    },
  };
}

export const personProfileDataApi = createPersonProfileDataApi();

export function isCurrentProfileRequest(requestVersion: number, currentVersion: number, aborted: boolean): boolean {
  return requestVersion === currentVersion && !aborted;
}

export function isActiveResponsibility(value: ResponsibilityDto, now: Date): boolean {
  const startsAt = Date.parse(value.startsAt);
  const endsAt = value.endsAt ? Date.parse(value.endsAt) : undefined;
  if (!Number.isFinite(startsAt) || startsAt > now.getTime()) return false;
  return endsAt === undefined || !Number.isFinite(endsAt) || endsAt >= now.getTime();
}

export function currentAvailability(periods: readonly AvailabilityPeriodDto[], now: Date): AvailabilityPeriodDto | undefined {
  return periods.find(period => {
    const startsAt = Date.parse(period.startsAt);
    const endsAt = Date.parse(period.endsAt);
    return Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt <= now.getTime() && now.getTime() < endsAt;
  });
}

export function nextAvailability(periods: readonly AvailabilityPeriodDto[], now: Date): AvailabilityPeriodDto | undefined {
  return [...periods]
    .filter(period => Number.isFinite(Date.parse(period.startsAt)) && Date.parse(period.startsAt) > now.getTime())
    .sort((left, right) => Date.parse(left.startsAt) - Date.parse(right.startsAt))[0];
}

export function dateIsOnOrAfterToday(date: string, timezone: string, now: Date): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const today = `${values.year}-${values.month}-${values.day}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;
  } catch {
    return false;
  }
}

export interface PersonAssignmentEvidence {
  readonly id: string;
  readonly state: 'assigned' | 'cancelled' | 'completed';
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly role: string;
}

export function assignmentEvidenceForPerson(overview: MidweekOverviewDto, personId: string): readonly PersonAssignmentEvidence[] {
  const meetings = new Map(overview.meetings.map(meeting => [meeting.id, meeting] as const));
  const values: PersonAssignmentEvidence[] = [];

  for (const assignment of overview.studentAssignments) {
    if (assignment.studentId !== personId && assignment.assistantId !== personId) continue;
    const meeting = meetings.get(assignment.meetingId);
    if (!meeting) continue;
    values.push({ id: assignment.id, state: assignment.state, date: meeting.date, localTime: meeting.localTime, timezone: meeting.timezone, role: assignment.assistantId === personId ? 'assistant' : 'student' });
  }
  for (const assignment of overview.nonStudentAssignments) {
    if (assignment.personId !== personId) continue;
    const meeting = meetings.get(assignment.meetingId);
    if (!meeting) continue;
    values.push({ id: assignment.id, state: assignment.state, date: meeting.date, localTime: meeting.localTime, timezone: meeting.timezone, role: assignment.role });
  }

  return Object.freeze(values.sort((left, right) => `${left.date}T${left.localTime}`.localeCompare(`${right.date}T${right.localTime}`)));
}

export function sectionIsPartial(data: PersonProfileData): boolean {
  return [data.availability, data.eligibility, data.contacts, data.groups, data.households, data.responsibilities, data.assignments, data.history]
    .some(section => section.status !== 'ready');
}

export function sectionMessage(section: PersonProfileSection<unknown>): 'unauthenticated' | 'forbidden' | 'unavailable' {
  return section.reason ?? 'unavailable';
}
