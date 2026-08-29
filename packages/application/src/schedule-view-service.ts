import {
  assertCapability,
  assertResourceTenant,
  findSlotById,
  type AccessContext,
  type MidweekMeeting,
  type MidweekPartDefinition,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { MidweekSchedulingUnitOfWork, SchedulingWindow } from './midweek-scheduling-service';
import type { RequestMetadata } from './people-service';

// ─── Public types ───────────────────────────────────────────────────────────

export type SlotAssignmentState = 'filled' | 'vacant' | 'conflict';

export interface ScheduleSlotView {
  readonly slotId: string;
  readonly position: number;
  readonly titleKey: string;
  readonly durationMinutes: number;
  readonly partDefinitionId?: string;
  /** Display name of student or null if vacant. */
  readonly studentDisplayName: string | null;
  /** Display name of assistant or null if not applicable/vacant. */
  readonly assistantDisplayName: string | null;
  /** Display name of non-student assignee or null if vacant. */
  readonly nonStudentDisplayName: string | null;
  readonly nonStudentRole: string | null;
  /** True if this slot has at least one active assignment with a blocking conflict. */
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
  /** Total number of slots that must be filled. */
  readonly totalSlots: number;
  /** Number of slots with at least one active assignment. */
  readonly filledSlots: number;
  /** Number of slots without any active assignment. */
  readonly vacantSlots: number;
  /** Number of slots with at least one blocking conflict. */
  readonly conflictedSlots: number;
}

// ─── Service ───────────────────────────────────────────────────────────────

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  if (trimmed.length > 200) throw new Error(`${field} is too long`);
  return trimmed;
}

/**
 * Read-only view service for the published/draft schedule.
 *
 * Used by:
 *   - The "view-only" UI for ordinary users (publisher asking "what is my assignment?")
 *   - The operational UI showing filled/vacant/conflicted slot counts
 *
 * Capabilities enforced:
 *   - `schedule.read` — required for any view
 *
 * The server is the authority; the frontend NEVER decides slot status.
 */
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

  /**
   * Build the schedule view for a single meeting, including all slots, their
   * assignment status, and a filled/vacant/conflict summary.
   */
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
    const nameById = new Map(people.map(p => [p.id, p.displayName] as const));

    // For conflict detection, gather all current person assignments and check overlaps.
    const allAssignments = this.#uow.listConflictAssignments(context, people.map(p => p.id));

    // Map slotId -> student assignment (active state only).
    const activeStudentBySlot = new Map<string, StudentAssignment>();
    for (const sa of studentAssignments) {
      if (sa.state === 'assigned') activeStudentBySlot.set(sa.slotId, sa);
    }
    const activeNonStudentBySlot = new Map<string, NonStudentAssignment>();
    for (const na of nonStudentAssignments) {
      if (na.state === 'assigned') activeNonStudentBySlot.set(na.slotId, na);
    }

    // For each slot, check if the assigned person has any conflict with another slot in this meeting.
    const slots: ScheduleSlotView[] = meeting.slots.map(slot => {
      const studentAssignment = activeStudentBySlot.get(slot.id);
      const nonStudentAssignment = activeNonStudentBySlot.get(slot.id);

      // Conflict: this person has another assignment with overlapping window.
      let hasConflict = false;
      const checkConflict = (personId: string | null): void => {
        if (!personId) return;
        const overlapping = allAssignments.filter(a =>
          a.personId === personId &&
          a.assignmentId !== `${studentAssignment?.id ?? ''}:student` &&
          a.assignmentId !== `${studentAssignment?.id ?? ''}:assistant` &&
          a.assignmentId !== nonStudentAssignment?.id,
        );
        // We need to compare window against the slot window — but we already have all
        // ConflictAssignments in the tenant. The slot window is computed below.
        void overlapping;
      };
      // We need the slot window to compare.
      // Since listConflictAssignments returns ConflictAssignments with their own startsAt/endsAt,
      // we need to compare against this slot's window.
      let slotWindow: SchedulingWindow | undefined;
      try {
        slotWindow = this.#uow.resolveSlotWindow(context, meeting, slot.id);
      } catch {
        slotWindow = undefined;
      }
      if (slotWindow) {
        const hasOverlapWith = (personId: string): boolean => {
          return allAssignments.some(a => {
            if (a.personId !== personId) return false;
            // Skip self-assignments in this same slot.
            if (a.assignmentId === `${studentAssignment?.id ?? ''}:student`) return false;
            if (a.assignmentId === `${studentAssignment?.id ?? ''}:assistant`) return false;
            if (a.assignmentId === nonStudentAssignment?.id) return false;
            const aStart = Date.parse(a.startsAt);
            const aEnd = Date.parse(a.endsAt);
            const sStart = Date.parse(slotWindow!.startsAt);
            const sEnd = Date.parse(slotWindow!.endsAt);
            return aStart < sEnd && sStart < aEnd;
          });
        };
        if (studentAssignment) {
          if (hasOverlapWith(studentAssignment.studentId)) hasConflict = true;
          if (studentAssignment.assistantId && hasOverlapWith(studentAssignment.assistantId)) hasConflict = true;
        }
        if (nonStudentAssignment) {
          if (hasOverlapWith(nonStudentAssignment.personId)) hasConflict = true;
        }
        void checkConflict;
      }

      const isFilled = Boolean(studentAssignment ?? nonStudentAssignment);
      const state: SlotAssignmentState = hasConflict ? 'conflict' : isFilled ? 'filled' : 'vacant';

      return Object.freeze({
        slotId: slot.id,
        position: slot.position,
        titleKey: slot.titleKey,
        durationMinutes: slot.durationMinutes,
        ...(slot.partDefinitionId ? { partDefinitionId: slot.partDefinitionId } : {}),
        studentDisplayName: studentAssignment ? (nameById.get(studentAssignment.studentId) ?? studentAssignment.studentId) : null,
        assistantDisplayName: studentAssignment?.assistantId ? (nameById.get(studentAssignment.assistantId) ?? studentAssignment.assistantId) : null,
        nonStudentDisplayName: nonStudentAssignment ? (nameById.get(nonStudentAssignment.personId) ?? nonStudentAssignment.personId) : null,
        nonStudentRole: nonStudentAssignment?.role ?? null,
        hasConflict,
        state,
      });
    });

    const sortedSlots = Object.freeze([...slots].sort((a, b) => a.position - b.position));
    const totalSlots = sortedSlots.length;
    const filledSlots = sortedSlots.filter(s => s.state === 'filled').length;
    const vacantSlots = sortedSlots.filter(s => s.state === 'vacant').length;
    const conflictedSlots = sortedSlots.filter(s => s.state === 'conflict').length;

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
