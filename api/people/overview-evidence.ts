import {
  PROFILE_COMPLETENESS,
  RECENT_AVAILABILITY_CHANGES,
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
import { runEndpoint } from '../_endpoint';
import { meetingStartInstant } from '../_midweek-uow';
import { PeopleSnapshotUnitOfWork } from '../_uow';
import { json, methodNotAllowed, type ApiHandler } from '../_types';

type TenantEntity = { readonly id: string; readonly tenantId: string };

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

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'eligibility.read');
    requireCapability(principal, 'availability.read');
    requireCapability(principal, 'schedule.read');

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
    const history = completedAssignmentHistoryFromScheduling(context, { meetings, studentAssignments: students, nonStudentAssignments: nonStudents });
    const assignmentEvidence = assignedEvidence(principal.tenantId, meetings, students, nonStudents);
    const targets = upcomingOpenStudentTargets(meetings, students, new Date());
    const longIntervalPeople = new Set<string>();
    let affectedOpenAssignments = 0;

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
      const longCandidates = recommendation.candidates.filter(candidate => candidate.reasons.some(reason => reason.code === 'LONGER_SINCE_LAST_ASSIGNMENT'));
      if (longCandidates.length === 0) continue;
      affectedOpenAssignments += 1;
      longCandidates.forEach(candidate => longIntervalPeople.add(candidate.personId));
    }

    json(response, 200, Object.freeze({
      contractVersion: 'people-overview-evidence-v1',
      longInterval: Object.freeze({
        status: 'ready',
        candidateCount: longIntervalPeople.size,
        openAssignmentCount: affectedOpenAssignments,
        evaluatedOpenStudentAssignments: targets.length,
      }),
      profileCompleteness: PROFILE_COMPLETENESS,
      recentAvailabilityChanges: RECENT_AVAILABILITY_CHANGES,
    }));
  });
};

export default handler;
