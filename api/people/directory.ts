import { completedAssignmentHistoryFromScheduling } from '@eutaktos/application';
import {
  createAccessContext,
  isResponsibilityActiveAt,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type ResponsibilityAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { serviceGroupDto } from '../_entity-read';
import { runEndpoint } from '../_endpoint';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

type TenantEntity = { readonly id: string; readonly tenantId: string };
type EvidenceUnavailable = Readonly<{ status: 'unavailable' }>;
type AvailabilityReady = Readonly<{
  status: 'ready';
  current: 'available' | 'unavailable';
  currentReasonCodes: readonly ('away' | 'unavailable' | 'other')[];
  nextPeriod?: Readonly<{ startsAt: string; endsAt: string; reasonCode?: 'away' | 'unavailable' | 'other' }>;
}>;
type EligibilityReady = Readonly<{ status: 'ready'; enabledAssignmentTypeIds: readonly string[] }>;
type ResponsibilitiesReady = Readonly<{ status: 'ready'; keys: readonly string[] }>;

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored directory entity');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored directory entity identity');
  return Object.freeze(structuredClone(data)) as Readonly<T>;
}

function unavailable(): EvidenceUnavailable {
  return Object.freeze({ status: 'unavailable' });
}

function instant(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field}`);
  return parsed;
}

function availabilityFor(person: Readonly<CongregationPerson>, nowMs: number): AvailabilityReady {
  const current = person.availability
    .filter(period => instant(period.startsAt, 'availability startsAt') <= nowMs && nowMs < instant(period.endsAt, 'availability endsAt'));
  const next = person.availability
    .filter(period => instant(period.startsAt, 'availability startsAt') > nowMs)
    .sort((left, right) => instant(left.startsAt, 'availability startsAt') - instant(right.startsAt, 'availability startsAt'))[0];
  const reasonCodes = [...new Set(current.map(period => period.reasonCode).filter((value): value is 'away' | 'unavailable' | 'other' => value !== undefined))].sort();
  return Object.freeze({
    status: 'ready',
    current: current.length ? 'unavailable' : 'available',
    currentReasonCodes: Object.freeze(reasonCodes),
    ...(next ? { nextPeriod: Object.freeze({ startsAt: next.startsAt, endsAt: next.endsAt, ...(next.reasonCode ? { reasonCode: next.reasonCode } : {}) }) } : {}),
  });
}

function eligibilityFor(person: Readonly<CongregationPerson>): EligibilityReady {
  const latest = new Map<string, Readonly<CongregationPerson['eligibility'][number]>>();
  for (const decision of person.eligibility) {
    const existing = latest.get(decision.assignmentTypeId);
    if (!existing || instant(existing.decidedAt, 'eligibility decidedAt') <= instant(decision.decidedAt, 'eligibility decidedAt')) {
      latest.set(decision.assignmentTypeId, decision);
    }
  }
  return Object.freeze({
    status: 'ready',
    enabledAssignmentTypeIds: Object.freeze([...latest.values()].filter(decision => decision.enabled).map(decision => decision.assignmentTypeId).sort()),
  });
}

function activeResponsibilitiesFor(
  personId: string,
  responsibilities: readonly Readonly<ResponsibilityAssignment>[],
  nowIso: string,
): ResponsibilitiesReady {
  return Object.freeze({
    status: 'ready',
    keys: Object.freeze(responsibilities
      .filter(item => item.personId === personId && isResponsibilityActiveAt(item, nowIso))
      .map(item => item.responsibilityKey)
      .sort()),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');

    const canWritePeople = principal.capabilities.includes('people.write');
    const canReadAvailability = principal.capabilities.includes('availability.read');
    const canReadEligibility = principal.capabilities.includes('eligibility.read');
    const canReadResponsibilities = principal.capabilities.includes('responsibilities.read');
    const canReadSchedule = principal.capabilities.includes('schedule.read');
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });

    const [peopleRows, groupRows, responsibilityRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'service-group'),
      canReadResponsibilities ? database.entities(principal.tenantId, 'responsibility') : Promise.resolve([]),
    ]);
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
    const groups = Object.freeze(groupRows.map(row => serviceGroupDto(row, principal.tenantId)));
    const responsibilities = Object.freeze(responsibilityRows.map(row => storedEntity<ResponsibilityAssignment>(row, principal.tenantId)));

    let historyByPersonId = new Map<string, string>();
    if (canReadSchedule) {
      const [meetingRows, studentRows, nonStudentRows] = await Promise.all([
        database.entities(principal.tenantId, 'midweek-meeting'),
        database.entities(principal.tenantId, 'student-assignment'),
        database.entities(principal.tenantId, 'non-student-assignment'),
      ]);
      const history = completedAssignmentHistoryFromScheduling(context, {
        meetings: meetingRows.map(row => storedEntity<MidweekMeeting>(row, principal.tenantId)),
        studentAssignments: studentRows.map(row => storedEntity<StudentAssignment>(row, principal.tenantId)),
        nonStudentAssignments: nonStudentRows.map(row => storedEntity<NonStudentAssignment>(row, principal.tenantId)),
      });
      historyByPersonId = new Map();
      for (const item of history) {
        const previous = historyByPersonId.get(item.personId);
        if (!previous || previous < item.meetingDate) historyByPersonId.set(item.personId, item.meetingDate);
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const peopleProjection = people
      .map(person => {
        const groupMemberships = groups
          .filter(group => group.memberIds.includes(person.id))
          .map(group => Object.freeze({ id: group.id, name: group.name }))
          .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id));
        const lastCompletedMeetingDate = historyByPersonId.get(person.id);
        return Object.freeze({
          id: person.id,
          displayName: person.displayName,
          ...(person.preferredLocale ? { preferredLocale: person.preferredLocale } : {}),
          active: person.active,
          groups: Object.freeze(groupMemberships),
          availability: canReadAvailability ? availabilityFor(person, now.getTime()) : unavailable(),
          eligibility: canReadEligibility ? eligibilityFor(person) : unavailable(),
          responsibilities: canReadResponsibilities ? activeResponsibilitiesFor(person.id, responsibilities, nowIso) : unavailable(),
          assignmentHistory: canReadSchedule
            ? Object.freeze({ status: 'ready' as const, ...(lastCompletedMeetingDate ? { lastCompletedMeetingDate } : {}) })
            : unavailable(),
        });
      })
      .sort((left, right) => left.displayName.localeCompare(right.displayName) || left.id.localeCompare(right.id));

    const responsibilityKeys = canReadResponsibilities
      ? [...new Set(responsibilities.filter(item => isResponsibilityActiveAt(item, nowIso)).map(item => item.responsibilityKey))].sort()
      : [];
    const assignmentTypeIds = canReadEligibility
      ? [...new Set(people.flatMap(person => eligibilityFor(person).enabledAssignmentTypeIds))].sort()
      : [];

    json(response, 200, Object.freeze({
      contractVersion: 'people-directory-v1',
      generatedAt: nowIso,
      capabilities: Object.freeze({
        writePeople: canWritePeople,
        availability: canReadAvailability,
        eligibility: canReadEligibility,
        responsibilities: canReadResponsibilities,
        schedule: canReadSchedule,
      }),
      filters: Object.freeze({
        groups: Object.freeze(groups.map(group => Object.freeze({ id: group.id, name: group.name })).sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))),
        responsibilityKeys: Object.freeze(responsibilityKeys),
        assignmentTypeIds: Object.freeze(assignmentTypeIds),
      }),
      people: Object.freeze(peopleProjection),
    }));
  });
};

export default handler;
