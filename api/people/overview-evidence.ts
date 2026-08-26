import {
  affectedAssignmentsByAvailability,
  completedAssignmentHistoryFromScheduling,
  deterministicRecommendationEvidence,
  type ActiveAssignmentEvidence,
  type AssignmentWorkloadEvidence,
} from '@eutaktos/application';
import {
  createAccessContext,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { DomainEventReader, type DomainEventProjectionRow } from '../_domain-event-reader';
import { runEndpoint } from '../_endpoint';
import { meetingStartInstant } from '../_midweek-uow';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';
import {
  RECENT_AVAILABILITY_WINDOW_DAYS,
  profileCompletenessEvidence,
  recentAvailabilityChangesEvidence,
  type ReadyRecentAvailabilityChangesEvidence,
} from './overview-attention';

type TenantEntity = { readonly id: string; readonly tenantId: string };

type ReadyAffectedAssignments = Readonly<{
  status: 'ready';
  affectedPeopleCount: number;
  affectedAssignmentCount: number;
}>;

type ReadyLongInterval = Readonly<{
  status: 'ready';
  candidateCount: number;
  openAssignmentCount: number;
  evaluatedOpenStudentAssignments: number;
}>;

type UnavailableEvidence = Readonly<{ status: 'unavailable' }>;

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored evidence entity');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored evidence entity identity');
  return Object.freeze(structuredClone(data)) as Readonly<T>;
}

function slotWindow(meeting: Readonly<MidweekMeeting>, slotId: string): Readonly<{ startsAt: string; endsAt: string }> {
  const slot = meeting.slots.find(item => item.id === slotId);
  if (!slot) throw new Error('Assignment references a missing slot');
  const precedingMinutes = meeting.slots
    .filter(item => item.position < slot.position)
    .reduce((total, item) => total + item.durationMinutes, 0);
  const startsAtMs = meetingStartInstant(meeting) + precedingMinutes * 60_000;
  const endsAtMs = startsAtMs + slot.durationMinutes * 60_000;
  return Object.freeze({ startsAt: new Date(startsAtMs).toISOString(), endsAt: new Date(endsAtMs).toISOString() });
}

function assignedEvidence(
  tenantId: string,
  meetings: readonly Readonly<MidweekMeeting>[],
  students: readonly Readonly<StudentAssignment>[],
  nonStudents: readonly Readonly<NonStudentAssignment>[],
): Readonly<{ active: readonly ActiveAssignmentEvidence[]; workload: readonly AssignmentWorkloadEvidence[] }> {
  const meetingsById = new Map(meetings.map(meeting => [meeting.id, meeting] as const));
  const active: ActiveAssignmentEvidence[] = [];
  const workload: AssignmentWorkloadEvidence[] = [];

  for (const assignment of students) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assignment references a missing meeting');
    const window = slotWindow(meeting, assignment.slotId);
    active.push(Object.freeze({ tenantId, assignmentId: `${assignment.id}:student`, personId: assignment.studentId, state: 'assigned', ...window }));
    workload.push(Object.freeze({ tenantId, assignmentId: `${assignment.id}:student`, personId: assignment.studentId, meetingDate: meeting.date, state: 'assigned' }));
    if (assignment.assistantId) {
      active.push(Object.freeze({ tenantId, assignmentId: `${assignment.id}:assistant`, personId: assignment.assistantId, state: 'assigned', ...window }));
      workload.push(Object.freeze({ tenantId, assignmentId: `${assignment.id}:assistant`, personId: assignment.assistantId, meetingDate: meeting.date, state: 'assigned' }));
    }
  }

  for (const assignment of nonStudents) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assignment references a missing meeting');
    const window = slotWindow(meeting, assignment.slotId);
    active.push(Object.freeze({ tenantId, assignmentId: assignment.id, personId: assignment.personId, state: 'assigned', ...window }));
    workload.push(Object.freeze({ tenantId, assignmentId: assignment.id, personId: assignment.personId, meetingDate: meeting.date, state: 'assigned' }));
  }

  return Object.freeze({ active: Object.freeze(active), workload: Object.freeze(workload) });
}

function upcomingOpenStudentTargets(
  meetings: readonly Readonly<MidweekMeeting>[],
  assignments: readonly Readonly<StudentAssignment>[],
  now: Date,
): readonly Readonly<{ meeting: Readonly<MidweekMeeting>; slotId: string; assignmentTypeId: string; startsAt: string; endsAt: string }>[] {
  const occupied = new Set(assignments
    .filter(assignment => assignment.state === 'assigned' || assignment.state === 'completed')
    .map(assignment => `${assignment.meetingId}:${assignment.slotId}`));
  const targets: Array<Readonly<{ meeting: Readonly<MidweekMeeting>; slotId: string; assignmentTypeId: string; startsAt: string; endsAt: string }>> = [];

  for (const meeting of meetings) {
    if (meeting.state !== 'draft' && meeting.state !== 'published') continue;
    if (meetingStartInstant(meeting) < now.getTime()) continue;
    for (const slot of meeting.slots) {
      if (!slot.partDefinitionId || occupied.has(`${meeting.id}:${slot.id}`)) continue;
      const window = slotWindow(meeting, slot.id);
      targets.push(Object.freeze({ meeting, slotId: slot.id, assignmentTypeId: slot.partDefinitionId, ...window }));
    }
  }

  return Object.freeze(targets.sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt) ||
    left.meeting.id.localeCompare(right.meeting.id) ||
    left.slotId.localeCompare(right.slotId),
  ));
}

function unavailable(): UnavailableEvidence {
  return Object.freeze({ status: 'unavailable' });
}

async function recentAvailabilityEvents(
  reader: DomainEventReader,
  tenantId: string,
  now: Date,
): Promise<readonly DomainEventProjectionRow[]> {
  const from = new Date(now.getTime() - RECENT_AVAILABILITY_WINDOW_DAYS * 86_400_000).toISOString();
  const pageSize = 500;
  const events: DomainEventProjectionRow[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await reader.list({ tenantId, eventType: 'AvailabilityChanged', from, limit: pageSize, offset });
    events.push(...page);
    if (page.length < pageSize) break;
  }
  return Object.freeze(events);
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');

    const peopleRows = await database.entities(principal.tenantId, 'person');
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });
    const people = new PeopleSnapshotUnitOfWork(principal.tenantId, peopleRows).list(context);
    const canReadSchedule = principal.capabilities.includes('schedule.read');
    const canReadAvailability = principal.capabilities.includes('availability.read');
    const canReadEligibility = principal.capabilities.includes('eligibility.read');
    const now = new Date();

    let affectedAssignments: ReadyAffectedAssignments | UnavailableEvidence = unavailable();
    let longInterval: ReadyLongInterval | UnavailableEvidence = unavailable();
    let recentAvailabilityChanges: ReadyRecentAvailabilityChangesEvidence | UnavailableEvidence = unavailable();

    if (canReadAvailability) {
      const events = await recentAvailabilityEvents(new DomainEventReader(), principal.tenantId, now);
      recentAvailabilityChanges = recentAvailabilityChangesEvidence(principal.tenantId, people, events, now);
    }

    if (canReadSchedule) {
      const [meetingRows, studentRows, nonStudentRows] = await Promise.all([
        database.entities(principal.tenantId, 'midweek-meeting'),
        database.entities(principal.tenantId, 'student-assignment'),
        database.entities(principal.tenantId, 'non-student-assignment'),
      ]);
      const meetings = Object.freeze(meetingRows.map(row => storedEntity<MidweekMeeting>(row, principal.tenantId)));
      const students = Object.freeze(studentRows.map(row => storedEntity<StudentAssignment>(row, principal.tenantId)));
      const nonStudents = Object.freeze(nonStudentRows.map(row => storedEntity<NonStudentAssignment>(row, principal.tenantId)));
      const assignmentEvidence = assignedEvidence(principal.tenantId, meetings, students, nonStudents);

      if (canReadAvailability) {
        const affected = affectedAssignmentsByAvailability(context, {
          people,
          activeAssignments: assignmentEvidence.active,
        });
        affectedAssignments = Object.freeze({
          status: 'ready',
          affectedPeopleCount: new Set(affected.map(item => item.personId)).size,
          affectedAssignmentCount: new Set(affected.map(item => item.assignmentId)).size,
        });
      }

      if (canReadAvailability && canReadEligibility) {
        const history = completedAssignmentHistoryFromScheduling(context, {
          meetings,
          studentAssignments: students,
          nonStudentAssignments: nonStudents,
        });
        const targets = upcomingOpenStudentTargets(meetings, students, now);
        const longIntervalPeople = new Set<string>();
        let openAssignmentCount = 0;

        for (const target of targets) {
          const recommendation = deterministicRecommendationEvidence(context, {
            assignmentTypeId: target.assignmentTypeId,
            partType: target.assignmentTypeId,
            targetMeetingDate: target.meeting.date,
            referenceDate: target.meeting.date,
            startsAt: target.startsAt,
            endsAt: target.endsAt,
            people,
            history,
            activeAssignments: assignmentEvidence.active,
            workloadAssignments: assignmentEvidence.workload,
          });
          const longCandidates = recommendation.candidates.filter(candidate =>
            candidate.reasons.some(reason => reason.code === 'LONGER_SINCE_LAST_ASSIGNMENT'),
          );
          if (longCandidates.length === 0) continue;
          openAssignmentCount += 1;
          longCandidates.forEach(candidate => longIntervalPeople.add(candidate.personId));
        }

        longInterval = Object.freeze({
          status: 'ready',
          candidateCount: longIntervalPeople.size,
          openAssignmentCount,
          evaluatedOpenStudentAssignments: targets.length,
        });
      }
    }

    json(response, 200, Object.freeze({
      contractVersion: 'people-overview-evidence-v2',
      affectedAssignments,
      longInterval,
      profileCompleteness: profileCompletenessEvidence(people),
      recentAvailabilityChanges,
    }));
  });
};

export default handler;
