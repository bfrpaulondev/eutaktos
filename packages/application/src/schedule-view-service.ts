import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork, SchedulingWindow } from './midweek-scheduling-service';
import type { RequestMetadata } from './people-service';

export type SlotAssignmentState = 'filled' | 'vacant' | 'conflict';

export interface ScheduleSlotView {
  readonly slotId: string;
  readonly position: number;
  readonly titleKey: string;
  readonly durationMinutes: number;
  readonly partDefinitionId?: string;
  readonly studentAssignmentId: string | null;
  readonly studentId: string | null;
  readonly studentDisplayName: string | null;
  readonly assistantId: string | null;
  readonly assistantDisplayName: string | null;
  readonly nonStudentAssignmentId: string | null;
  readonly nonStudentPersonId: string | null;
  readonly nonStudentDisplayName: string | null;
  readonly nonStudentRole: string | null;
  readonly hasConflict: boolean;
  readonly state: SlotAssignmentState;
}

export interface ScheduleMeetingView {
  readonly meetingId: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId?: string;
  readonly state: MidweekMeeting['state'];
  readonly slots: readonly ScheduleSlotView[];
  readonly totalSlots: number;
  readonly filledSlots: number;
  readonly vacantSlots: number;
  readonly conflictedSlots: number;
}

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > 200) throw new Error(`${field} is too long`);
  return trimmed;
}

export class ScheduleViewService {
  readonly #uow: MidweekSchedulingUnitOfWork;

  constructor(uow: MidweekSchedulingUnitOfWork) {
    this.#uow = uow;
  }

  #assertRead(context: AccessContext): void {
    assertCapability(context, 'schedule.read');
  }

  #meeting(context: AccessContext, meetingIdInput: string): Readonly<MidweekMeeting> {
    const meeting = this.#uow.findMeeting(context, required(meetingIdInput, 'meetingId'));
    if (!meeting) throw new Error('Meeting not found');
    assertResourceTenant(context, meeting);
    return meeting;
  }

  viewMeeting(
    context: AccessContext,
    meetingIdInput: string,
    _metadata: RequestMetadata = {},
  ): Readonly<ScheduleMeetingView> {
    this.#assertRead(context);

    const meeting = this.#meeting(context, meetingIdInput);
    const studentAssignments = this.#uow.listStudentAssignments(context, meeting.id);
    const nonStudentAssignments = this.#uow.listNonStudentAssignments(context, meeting.id);
    const people = this.#uow.listPeople(context);
    const nameById = new Map(people.map(person => [person.id, person.displayName] as const));
    const allAssignments = this.#uow.listConflictAssignments(context, people.map(person => person.id));

    const activeStudentBySlot = new Map<string, StudentAssignment>();
    for (const assignment of studentAssignments) {
      if (assignment.state === 'assigned') activeStudentBySlot.set(assignment.slotId, assignment);
    }
    const activeNonStudentBySlot = new Map<string, NonStudentAssignment>();
    for (const assignment of nonStudentAssignments) {
      if (assignment.state === 'assigned') activeNonStudentBySlot.set(assignment.slotId, assignment);
    }

    const slots: ScheduleSlotView[] = meeting.slots.map(slot => {
      const studentAssignment = activeStudentBySlot.get(slot.id);
      const nonStudentAssignment = activeNonStudentBySlot.get(slot.id);
      let hasConflict = false;
      let slotWindow: SchedulingWindow | undefined;
      try {
        slotWindow = this.#uow.resolveSlotWindow(context, meeting, slot.id);
      } catch {
        slotWindow = undefined;
      }

      if (slotWindow) {
        const hasOverlapWith = (personId: string): boolean => allAssignments.some(assignment => {
          if (assignment.personId !== personId) return false;
          if (assignment.assignmentId === `${studentAssignment?.id ?? ''}:student`) return false;
          if (assignment.assignmentId === `${studentAssignment?.id ?? ''}:assistant`) return false;
          if (assignment.assignmentId === nonStudentAssignment?.id) return false;
          const assignmentStart = Date.parse(assignment.startsAt);
          const assignmentEnd = Date.parse(assignment.endsAt);
          const slotStart = Date.parse(slotWindow!.startsAt);
          const slotEnd = Date.parse(slotWindow!.endsAt);
          return assignmentStart < slotEnd && slotStart < assignmentEnd;
        });

        if (studentAssignment) {
          if (hasOverlapWith(studentAssignment.studentId)) hasConflict = true;
          if (studentAssignment.assistantId && hasOverlapWith(studentAssignment.assistantId)) hasConflict = true;
        }
        if (nonStudentAssignment && hasOverlapWith(nonStudentAssignment.personId)) hasConflict = true;
      }

      const isFilled = Boolean(studentAssignment ?? nonStudentAssignment);
      const state: SlotAssignmentState = hasConflict ? 'conflict' : isFilled ? 'filled' : 'vacant';

      return Object.freeze({
        slotId: slot.id,
        position: slot.position,
        titleKey: slot.titleKey,
        durationMinutes: slot.durationMinutes,
        ...(slot.partDefinitionId ? { partDefinitionId: slot.partDefinitionId } : {}),
        studentAssignmentId: studentAssignment?.id ?? null,
        studentId: studentAssignment?.studentId ?? null,
        studentDisplayName: studentAssignment ? (nameById.get(studentAssignment.studentId) ?? studentAssignment.studentId) : null,
        assistantId: studentAssignment?.assistantId ?? null,
        assistantDisplayName: studentAssignment?.assistantId ? (nameById.get(studentAssignment.assistantId) ?? studentAssignment.assistantId) : null,
        nonStudentAssignmentId: nonStudentAssignment?.id ?? null,
        nonStudentPersonId: nonStudentAssignment?.personId ?? null,
        nonStudentDisplayName: nonStudentAssignment ? (nameById.get(nonStudentAssignment.personId) ?? nonStudentAssignment.personId) : null,
        nonStudentRole: nonStudentAssignment?.role ?? null,
        hasConflict,
        state,
      });
    });

    const sortedSlots = Object.freeze([...slots].sort((left, right) => left.position - right.position));
    const totalSlots = sortedSlots.length;
    const filledSlots = sortedSlots.filter(slot => slot.state === 'filled').length;
    const vacantSlots = sortedSlots.filter(slot => slot.state === 'vacant').length;
    const conflictedSlots = sortedSlots.filter(slot => slot.state === 'conflict').length;

    return Object.freeze({
      meetingId: meeting.id,
      date: meeting.date,
      localTime: meeting.localTime,
      timezone: meeting.timezone,
      ...(meeting.locationId ? { locationId: meeting.locationId } : {}),
      state: meeting.state,
      slots: sortedSlots,
      totalSlots,
      filledSlots,
      vacantSlots,
      conflictedSlots,
    });
  }
}
