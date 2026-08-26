import {
  completedAssignmentHistoryFromScheduling,
  deterministicRecommendationEvidence,
  type ActiveAssignmentEvidence,
  type AssignmentWorkloadEvidence,
  type RecommendationCandidateEvidence,
} from '@eutaktos/application';
import {
  findSlotById,
  type AccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { meetingStartInstant } from '../_midweek-uow';

export interface MidweekRecommendationTarget {
  readonly meetingId: string;
  readonly slotId: string;
}

export interface MidweekRecommendationSource {
  readonly people: readonly Readonly<CongregationPerson>[];
  readonly meetings: readonly Readonly<MidweekMeeting>[];
  readonly studentAssignments: readonly Readonly<StudentAssignment>[];
  readonly nonStudentAssignments: readonly Readonly<NonStudentAssignment>[];
}

export interface RecommendationPersonEvidence extends RecommendationCandidateEvidence {
  readonly displayName: string;
}

export interface AuthorizedMidweekRecommendation {
  readonly contractVersion: 'people-recommendation-v1';
  readonly evidenceContractVersion: 'px7-evidence-v1';
  readonly inputContractVersion: 'px7-recommendation-input-v1';
  readonly target: Readonly<{
    meetingId: string;
    slotId: string;
    assignmentTypeId: string;
    meetingDate: string;
    startsAt: string;
    endsAt: string;
  }>;
  readonly candidates: readonly Readonly<RecommendationPersonEvidence>[];
  readonly excluded: readonly Readonly<RecommendationPersonEvidence>[];
}

function targetWindow(meeting: Readonly<MidweekMeeting>, slotId: string): Readonly<{ startsAt: string; endsAt: string }> {
  const slot = findSlotById(meeting, slotId);
  if (!slot) throw new Error('Recommendation target slot was not found');
  const precedingMinutes = meeting.slots
    .filter(item => item.position < slot.position)
    .reduce((total, item) => total + item.durationMinutes, 0);
  const startsAtMs = meetingStartInstant(meeting) + precedingMinutes * 60_000;
  const endsAtMs = startsAtMs + slot.durationMinutes * 60_000;
  return Object.freeze({ startsAt: new Date(startsAtMs).toISOString(), endsAt: new Date(endsAtMs).toISOString() });
}

function schedulingEvidence(
  tenantId: string,
  meetings: readonly Readonly<MidweekMeeting>[],
  students: readonly Readonly<StudentAssignment>[],
  nonStudents: readonly Readonly<NonStudentAssignment>[],
): Readonly<{ active: readonly ActiveAssignmentEvidence[]; workload: readonly AssignmentWorkloadEvidence[] }> {
  const meetingsById = new Map(meetings.filter(meeting => meeting.tenantId === tenantId).map(meeting => [meeting.id, meeting] as const));
  const active: ActiveAssignmentEvidence[] = [];
  const workload: AssignmentWorkloadEvidence[] = [];

  const push = (assignmentId: string, personId: string, meeting: Readonly<MidweekMeeting>, slotId: string): void => {
    const window = targetWindow(meeting, slotId);
    active.push(Object.freeze({ tenantId, assignmentId, personId, state: 'assigned', ...window }));
    workload.push(Object.freeze({ tenantId, assignmentId, personId, meetingDate: meeting.date, state: 'assigned' }));
  };

  for (const assignment of students) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assigned student record references a missing tenant meeting');
    push(`${assignment.id}:student`, assignment.studentId, meeting, assignment.slotId);
    if (assignment.assistantId) push(`${assignment.id}:assistant`, assignment.assistantId, meeting, assignment.slotId);
  }

  for (const assignment of nonStudents) {
    if (assignment.tenantId !== tenantId || assignment.state !== 'assigned') continue;
    const meeting = meetingsById.get(assignment.meetingId);
    if (!meeting) throw new Error('Assigned non-student record references a missing tenant meeting');
    push(assignment.id, assignment.personId, meeting, assignment.slotId);
  }

  return Object.freeze({
    active: Object.freeze(active.sort((left, right) => left.personId.localeCompare(right.personId) || left.assignmentId.localeCompare(right.assignmentId))),
    workload: Object.freeze(workload.sort((left, right) => left.personId.localeCompare(right.personId) || left.assignmentId.localeCompare(right.assignmentId))),
  });
}

function personEvidence(
  values: readonly RecommendationCandidateEvidence[],
  names: ReadonlyMap<string, string>,
): readonly Readonly<RecommendationPersonEvidence>[] {
  return Object.freeze(values.map(value => {
    const displayName = names.get(value.personId);
    if (!displayName) throw new Error('Recommendation evidence references a person outside the authorized tenant projection');
    return Object.freeze({ ...value, displayName });
  }));
}

/**
 * Builds PX7 evidence only from facts already loaded for the authenticated tenant.
 * The target carries opaque resource identifiers only. Assignment type, meeting
 * date/time, people, eligibility, availability, history and workload are all
 * derived from the authorized server-side source.
 */
export function buildAuthorizedMidweekRecommendation(
  context: AccessContext,
  target: MidweekRecommendationTarget,
  source: MidweekRecommendationSource,
): AuthorizedMidweekRecommendation {
  const meeting = source.meetings.find(item => item.tenantId === context.tenantId && item.id === target.meetingId);
  if (!meeting) throw new Error('Recommendation target meeting was not found');
  if (meeting.state !== 'draft' && meeting.state !== 'published') throw new Error('Recommendation target meeting is not assignable');

  const slot = findSlotById(meeting, target.slotId);
  if (!slot) throw new Error('Recommendation target slot was not found');
  const assignmentTypeId = slot.partDefinitionId?.trim();
  if (!assignmentTypeId) throw new Error('Recommendation target slot has no explicit assignment type');
  const window = targetWindow(meeting, target.slotId);

  const tenantPeople = Object.freeze(source.people.filter(person => person.tenantId === context.tenantId));
  const tenantMeetings = Object.freeze(source.meetings.filter(item => item.tenantId === context.tenantId));
  const tenantStudents = Object.freeze(source.studentAssignments.filter(item => item.tenantId === context.tenantId));
  const tenantNonStudents = Object.freeze(source.nonStudentAssignments.filter(item => item.tenantId === context.tenantId));
  const history = completedAssignmentHistoryFromScheduling(context, {
    meetings: tenantMeetings,
    studentAssignments: tenantStudents,
    nonStudentAssignments: tenantNonStudents,
  });
  const assignments = schedulingEvidence(context.tenantId, tenantMeetings, tenantStudents, tenantNonStudents);

  const evidence = deterministicRecommendationEvidence(context, {
    inputContractVersion: 'px7-recommendation-input-v1',
    assignmentTypeId,
    partType: assignmentTypeId,
    targetMeetingDate: meeting.date,
    referenceDate: meeting.date,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    people: tenantPeople,
    history,
    activeAssignments: assignments.active,
    workloadAssignments: assignments.workload,
  });

  const names = new Map(tenantPeople.map(person => [person.id, person.displayName] as const));
  return Object.freeze({
    contractVersion: 'people-recommendation-v1',
    evidenceContractVersion: evidence.contractVersion,
    inputContractVersion: evidence.inputContractVersion,
    target: Object.freeze({
      meetingId: meeting.id,
      slotId: slot.id,
      assignmentTypeId,
      meetingDate: meeting.date,
      startsAt: window.startsAt,
      endsAt: window.endsAt,
    }),
    candidates: personEvidence(evidence.candidates, names),
    excluded: personEvidence(evidence.excluded, names),
  });
}
