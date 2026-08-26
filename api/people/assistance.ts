import {
  affectedAssignmentsByAvailability,
  completedAssignmentHistoryFromScheduling,
  type ActiveAssignmentEvidence,
  type AssignmentWorkloadEvidence,
} from '@eutaktos/application';
import {
  createAccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { runEndpoint } from '../_endpoint';
import { meetingStartInstant } from '../_midweek-uow';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import { buildAuthorizedMidweekRecommendation } from './recommendation-adapter';

type TenantEntity = { readonly id: string; readonly tenantId: string };
type Unavailable = Readonly<{ status: 'unavailable' }>;
type TargetKind = 'student-primary' | 'student-assistant' | 'non-student';

type AssignedTarget = Readonly<{
  assignmentId: string;
  personId: string;
  meetingId: string;
  slotId: string;
  meetingDate: string;
  kind: TargetKind;
}>;

type OpenTarget = Readonly<{
  meetingId: string;
  slotId: string;
  meetingDate: string;
  startsAt: string;
}>;

const MAX_ITEMS = 20;

function unavailable(): Unavailable {
  return Object.freeze({ status: 'unavailable' });
}

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored assistance entity');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored assistance entity identity');
  return Object.freeze(structuredClone(data)) as Readonly<T>;
}

function slotWindow(meeting: Readonly<MidweekMeeting>, slotId: string): Readonly<{ startsAt: string; endsAt: string }> {
  const slot = meeting.slots.find(item => item.id === slotId);
  if (!slot) throw new Error('Assignment references a missing slot');
  const precedingMinutes = meeting.slots
    .filter(item => item.position < slot.position)
    .reduce((total, item) => total + item.durationMinutes, 0);
  const startsAtMs = meetingStartInstant(meeting) + precedingMinutes * 60_000;
  return Object.freeze({
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(startsAtMs + slot.durationMinutes * 60_000).toISOString(),
  });
}

function schedulingEvidence(
  tenantId: string,
  meetings: readonly Readonly<MidweekMeeting>[],
  students: readonly Readonly<StudentAssignment>[],
  nonStudents: readonly Readonly<NonStudentAssignment>[],
): Readonly<{
  active: readonly ActiveAssignmentEvidence[];
  workload: readonly AssignmentWorkloadEvidence[];
  targets: readonly AssignedTarget[];
}> {
  const meetingsById = new Map(meetings.map(meeting => [meeting.id, meeting] as const));
  const active: ActiveAssignmentEvidence[] = [];
  const workload: AssignmentWorkloadEvidence[] = [];
  const targets: AssignedTarget[] = [];

  const push = (
    assignmentId: string,
    personId: string,
    meeting: Readonly<MidweekMeeting>,
    slotId: string,
    kind: TargetKind,
  ): void => {
    const window = slotWindow(meeting, slotId);
    active.push(Object.freeze({ tenantId, assignmentId, personId, state: 'assigned', ...window }));
    workload.push(Object.freeze({ tenantId, assignmentId, personId, meetingDate: meeting.date, state: 'assigned' }));
    targets.push(Object.freeze({ assignmentId, personId, meetingId: meeting.id, slotId, meetingDate: meeting.date, kind }));
  };

  for (const assignment of students) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assigned student record references a missing meeting');
    push(`${assignment.id}:student`, assignment.studentId, meeting, assignment.slotId, 'student-primary');
    if (assignment.assistantId) push(`${assignment.id}:assistant`, assignment.assistantId, meeting, assignment.slotId, 'student-assistant');
  }

  for (const assignment of nonStudents) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assigned non-student record references a missing meeting');
    push(assignment.id, assignment.personId, meeting, assignment.slotId, 'non-student');
  }

  return Object.freeze({
    active: Object.freeze(active),
    workload: Object.freeze(workload),
    targets: Object.freeze(targets),
  });
}

function openStudentTargets(
  meetings: readonly Readonly<MidweekMeeting>[],
  assignments: readonly Readonly<StudentAssignment>[],
  now: Date,
): readonly OpenTarget[] {
  const occupied = new Set(assignments
    .filter(assignment => assignment.state === 'assigned' || assignment.state === 'completed')
    .map(assignment => `${assignment.meetingId}:${assignment.slotId}`));
  const targets: OpenTarget[] = [];
  for (const meeting of meetings) {
    if (meeting.state !== 'draft' && meeting.state !== 'published') continue;
    if (meetingStartInstant(meeting) < now.getTime()) continue;
    for (const slot of meeting.slots) {
      if (!slot.partDefinitionId || occupied.has(`${meeting.id}:${slot.id}`)) continue;
      targets.push(Object.freeze({
        meetingId: meeting.id,
        slotId: slot.id,
        meetingDate: meeting.date,
        startsAt: slotWindow(meeting, slot.id).startsAt,
      }));
    }
  }
  return Object.freeze(targets.sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt)
    || left.meetingId.localeCompare(right.meetingId)
    || left.slotId.localeCompare(right.slotId),
  ));
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');

    const canReadSchedule = principal.capabilities.includes('schedule.read');
    const canReadAvailability = principal.capabilities.includes('availability.read');
    const canReadEligibility = principal.capabilities.includes('eligibility.read');
    if (!canReadSchedule) {
      json(response, 200, Object.freeze({
        contractVersion: 'people-assistance-v1',
        affectedAssignments: unavailable(),
        incompleteMeetings: unavailable(),
        workloadImbalance: unavailable(),
        longInterval: unavailable(),
      }));
      return;
    }

    const [peopleRows, meetingRows, studentRows, nonStudentRows] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'midweek-meeting'),
      database.entities(principal.tenantId, 'student-assignment'),
      database.entities(principal.tenantId, 'non-student-assignment'),
    ]);
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
    const meetings = Object.freeze(meetingRows.map(row => storedEntity<MidweekMeeting>(row, principal.tenantId)));
    const students = Object.freeze(studentRows.map(row => storedEntity<StudentAssignment>(row, principal.tenantId)));
    const nonStudents = Object.freeze(nonStudentRows.map(row => storedEntity<NonStudentAssignment>(row, principal.tenantId)));
    const source = Object.freeze({ people, meetings, studentAssignments: students, nonStudentAssignments: nonStudents });
    const scheduling = schedulingEvidence(principal.tenantId, meetings, students, nonStudents);
    const peopleById = new Map<string, Readonly<CongregationPerson>>(people.map(person => [person.id, person] as const));
    const now = new Date();

    let affectedAssignments: unknown = unavailable();
    if (canReadAvailability) {
      const affected = affectedAssignmentsByAvailability(context, { people, activeAssignments: scheduling.active });
      const items = affected
        .map(value => {
          const target = scheduling.targets.find(item => item.assignmentId === value.assignmentId && item.personId === value.personId);
          const person = peopleById.get(value.personId);
          if (!target || !person) throw new Error('Affected assignment references unknown assistance evidence');
          let suggestionStatus: 'ready' | 'unavailable' = 'unavailable';
          let topCandidates: readonly Readonly<{ rank: number; displayName: string }>[] = Object.freeze([]);
          if (canReadEligibility && target.kind === 'student-primary') {
            const recommendation = buildAuthorizedMidweekRecommendation(context, { meetingId: target.meetingId, slotId: target.slotId }, source);
            suggestionStatus = 'ready';
            topCandidates = Object.freeze(recommendation.candidates
              .filter(candidate => candidate.status === 'candidate' && candidate.rank !== undefined)
              .slice(0, 3)
              .map(candidate => Object.freeze({ rank: candidate.rank!, displayName: candidate.displayName })));
          }
          return Object.freeze({
            meetingId: target.meetingId,
            slotId: target.slotId,
            meetingDate: target.meetingDate,
            affectedDisplayName: person.displayName,
            suggestionStatus,
            topCandidates,
          });
        })
        .sort((left, right) => left.meetingDate.localeCompare(right.meetingDate) || left.affectedDisplayName.localeCompare(right.affectedDisplayName));
      affectedAssignments = Object.freeze({
        status: 'ready',
        totalCount: items.length,
        truncated: items.length > MAX_ITEMS,
        items: Object.freeze(items.slice(0, MAX_ITEMS)),
      });
    }

    let incompleteMeetings: unknown = unavailable();
    let workloadImbalance: unknown = unavailable();
    let longInterval: unknown = unavailable();
    if (canReadAvailability && canReadEligibility) {
      const history = completedAssignmentHistoryFromScheduling(context, {
        meetings,
        studentAssignments: students,
        nonStudentAssignments: nonStudents,
      });
      const targets = openStudentTargets(meetings, students, now);
      const meetingSummaries = new Map<string, { meetingId: string; meetingDate: string; openPartCount: number; partsWithCandidates: number }>();
      const workloadItems: Array<Readonly<{ meetingId: string; slotId: string; meetingDate: string; displayName: string; sameWeekAssignmentCount: number; lowerWorkloadAlternativeCount: number }>> = [];
      const longItems: Array<Readonly<{ meetingId: string; slotId: string; meetingDate: string; displayName: string; daysSinceLastCompletedAssignment: number }>> = [];

      for (const target of targets) {
        const recommendation = buildAuthorizedMidweekRecommendation(context, { meetingId: target.meetingId, slotId: target.slotId }, source);
        const candidates = recommendation.candidates.filter(candidate => candidate.status === 'candidate' && candidate.rank !== undefined);
        const summary = meetingSummaries.get(target.meetingId) ?? {
          meetingId: target.meetingId,
          meetingDate: target.meetingDate,
          openPartCount: 0,
          partsWithCandidates: 0,
        };
        summary.openPartCount += 1;
        if (candidates.length > 0) summary.partsWithCandidates += 1;
        meetingSummaries.set(target.meetingId, summary);

        if (candidates.length > 1) {
          const minimum = Math.min(...candidates.map(candidate => candidate.sameWeekAssignmentCount));
          for (const candidate of candidates) {
            if (candidate.sameWeekAssignmentCount <= minimum) continue;
            workloadItems.push(Object.freeze({
              meetingId: target.meetingId,
              slotId: target.slotId,
              meetingDate: target.meetingDate,
              displayName: candidate.displayName,
              sameWeekAssignmentCount: candidate.sameWeekAssignmentCount,
              lowerWorkloadAlternativeCount: candidates.filter(other => other.sameWeekAssignmentCount < candidate.sameWeekAssignmentCount).length,
            }));
          }
        }

        for (const candidate of candidates) {
          if (!candidate.reasons.some(reason => reason.code === 'LONGER_SINCE_LAST_ASSIGNMENT')) continue;
          const days = candidate.history.daysSinceLastCompletedAssignment;
          if (days === undefined) continue;
          longItems.push(Object.freeze({
            meetingId: target.meetingId,
            slotId: target.slotId,
            meetingDate: target.meetingDate,
            displayName: candidate.displayName,
            daysSinceLastCompletedAssignment: days,
          }));
        }
      }

      const meetingsWithOpenParts = [...meetingSummaries.values()].sort((left, right) => left.meetingDate.localeCompare(right.meetingDate) || left.meetingId.localeCompare(right.meetingId));
      incompleteMeetings = Object.freeze({
        status: 'ready',
        meetingCount: meetingsWithOpenParts.length,
        openPartCount: meetingsWithOpenParts.reduce((total, value) => total + value.openPartCount, 0),
        items: Object.freeze(meetingsWithOpenParts.slice(0, MAX_ITEMS).map(value => Object.freeze(value))),
        truncated: meetingsWithOpenParts.length > MAX_ITEMS,
      });

      const workloadSorted = workloadItems.sort((left, right) =>
        left.meetingDate.localeCompare(right.meetingDate)
        || right.sameWeekAssignmentCount - left.sameWeekAssignmentCount
        || left.displayName.localeCompare(right.displayName),
      );
      workloadImbalance = Object.freeze({
        status: 'ready',
        itemCount: workloadSorted.length,
        items: Object.freeze(workloadSorted.slice(0, MAX_ITEMS)),
        truncated: workloadSorted.length > MAX_ITEMS,
      });

      const longSorted = longItems.sort((left, right) =>
        right.daysSinceLastCompletedAssignment - left.daysSinceLastCompletedAssignment
        || left.meetingDate.localeCompare(right.meetingDate)
        || left.displayName.localeCompare(right.displayName),
      );
      longInterval = Object.freeze({
        status: 'ready',
        itemCount: longSorted.length,
        items: Object.freeze(longSorted.slice(0, MAX_ITEMS)),
        truncated: longSorted.length > MAX_ITEMS,
      });
    }

    json(response, 200, Object.freeze({
      contractVersion: 'people-assistance-v1',
      affectedAssignments,
      incompleteMeetings,
      workloadImbalance,
      longInterval,
    }));
  });
};

export default handler;
