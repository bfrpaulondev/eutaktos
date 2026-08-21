/**
 * K32 — Midweek Atomic Persistence
 *
 * In-memory Unit of Work for midweek scheduling.
 * Since K21-K31 aren't merged to main, all domain types are defined locally.
 * Follows the exact patterns from household-memory.ts.
 */

import {
  assertCapability,
  assertResourceTenant,
  type AccessContext,
} from '@eutaktos/domain';

// ---- Local domain types (K21-K31 not yet merged) ----

export interface MidweekMeeting {
  id: string;
  tenantId: string;
 date: string;
  weekNumber?: number;
  chairmanId?: string;
  openingPrayer?: string;
  closingPrayer?: string;
  isCancelled: boolean;
}

export interface StudentAssignment {
  id: string;
  tenantId: string;
  meetingId: string;
  personId: string;
  assignmentType: string;
  sort_order?: number;
}

export interface NonStudentAssignment {
  id: string;
  tenantId: string;
  meetingId: string;
  personId: string;
  assignmentType: string;
}

export interface AuditEvent {
  id: string;
  tenantId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  actorId: string;
  occurredAt: string;
  changedFields: readonly string[];
}

export interface DomainEvent {
  id: string;
  tenantId: string;
  type: string;
  aggregateId: string;
  actorId: string;
  occurredAt: string;
  schemaVersion: number;
  correlationId?: string;
}

// ---- Unit of Work interface ----

export interface MidweekUnitOfWork {
  // Meetings
  saveMeeting(ctx: AccessContext, meeting: MidweekMeeting): void;
  findMeetingById(ctx: AccessContext, id: string): MidweekMeeting | undefined;
  listMeetings(ctx: AccessContext): readonly MidweekMeeting[];
  deleteMeeting(ctx: AccessContext, id: string): boolean;

  // Student Assignments
  saveStudentAssignment(ctx: AccessContext, assignment: StudentAssignment): void;
  findStudentAssignmentsByMeeting(ctx: AccessContext, meetingId: string): readonly StudentAssignment[];
  findStudentAssignmentsByPerson(ctx: AccessContext, personId: string): readonly StudentAssignment[];
  listStudentAssignments(ctx: AccessContext): readonly StudentAssignment[];

  // Non-Student Assignments
  saveNonStudentAssignment(ctx: AccessContext, assignment: NonStudentAssignment): void;
  findNonStudentAssignmentsByMeeting(ctx: AccessContext, meetingId: string): readonly NonStudentAssignment[];
  findNonStudentAssignmentsByPerson(ctx: AccessContext, personId: string): readonly NonStudentAssignment[];
  listNonStudentAssignments(ctx: AccessContext): readonly NonStudentAssignment[];

  // Audit
  recordAudit(ctx: AccessContext, event: AuditEvent): void;
  listAudit(ctx: AccessContext): readonly AuditEvent[];

  // Outbox
  emitEvent(ctx: AccessContext, event: DomainEvent): void;
  listOutbox(ctx: AccessContext): readonly DomainEvent[];
}

// ---- Helpers ----

function key(tenantId: string, id: string): string {
  return `${tenantId}\u0000${id}`;
}

function cloneMeeting(m: MidweekMeeting): MidweekMeeting {
  return structuredClone(m);
}

function cloneStudentAssignment(a: StudentAssignment): StudentAssignment {
  return structuredClone(a);
}

function cloneNonStudentAssignment(a: NonStudentAssignment): NonStudentAssignment {
  return structuredClone(a);
}

// ---- Implementation ----

export class InMemoryMidweekUnitOfWork implements MidweekUnitOfWork {
  readonly #meetings = new Map<string, MidweekMeeting>();
  readonly #studentAssignments = new Map<string, StudentAssignment>();
  readonly #nonStudentAssignments = new Map<string, NonStudentAssignment>();
  readonly #audit = new Map<string, Readonly<AuditEvent>>();
  readonly #outbox = new Map<string, Readonly<DomainEvent>>();

  constructor(seed: readonly MidweekMeeting[] = []) {
    for (const meeting of seed) {
      const storageKey = key(meeting.tenantId, meeting.id);
      if (this.#meetings.has(storageKey)) throw new Error('Duplicate tenant meeting id');
      this.#meetings.set(storageKey, cloneMeeting(meeting));
    }
  }

  // ---- Meetings ----

  saveMeeting(ctx: AccessContext, meeting: MidweekMeeting): void {
    assertCapability(ctx, 'schedule.write');
    assertResourceTenant(ctx, meeting);
    this.#meetings.set(key(ctx.tenantId, meeting.id), cloneMeeting(meeting));
  }

  findMeetingById(ctx: AccessContext, id: string): MidweekMeeting | undefined {
    assertCapability(ctx, 'schedule.read');
    const meeting = this.#meetings.get(key(ctx.tenantId, id));
    return meeting ? cloneMeeting(meeting) : undefined;
  }

  listMeetings(ctx: AccessContext): readonly MidweekMeeting[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#meetings.values()]
      .filter(m => m.tenantId === ctx.tenantId)
      .map(cloneMeeting);
  }

  deleteMeeting(ctx: AccessContext, id: string): boolean {
    assertCapability(ctx, 'schedule.write');
    const meetingKey = key(ctx.tenantId, id);
    const meeting = this.#meetings.get(meetingKey);
    if (!meeting) return false;

    // Collect associated assignment keys to remove atomically
    const studentKeysToRemove: string[] = [];
    const nonStudentKeysToRemove: string[] = [];

    for (const [k, a] of this.#studentAssignments) {
      if (a.tenantId === ctx.tenantId && a.meetingId === id) {
        studentKeysToRemove.push(k);
      }
    }
    for (const [k, a] of this.#nonStudentAssignments) {
      if (a.tenantId === ctx.tenantId && a.meetingId === id) {
        nonStudentKeysToRemove.push(k);
      }
    }

    // All-or-nothing mutation
    this.#meetings.delete(meetingKey);
    for (const k of studentKeysToRemove) this.#studentAssignments.delete(k);
    for (const k of nonStudentKeysToRemove) this.#nonStudentAssignments.delete(k);
    return true;
  }

  // ---- Student Assignments ----

  saveStudentAssignment(ctx: AccessContext, assignment: StudentAssignment): void {
    assertCapability(ctx, 'schedule.write');
    assertResourceTenant(ctx, assignment);
    this.#studentAssignments.set(
      key(ctx.tenantId, assignment.id),
      cloneStudentAssignment(assignment),
    );
  }

  findStudentAssignmentsByMeeting(ctx: AccessContext, meetingId: string): readonly StudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#studentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId && a.meetingId === meetingId)
      .map(cloneStudentAssignment);
  }

  findStudentAssignmentsByPerson(ctx: AccessContext, personId: string): readonly StudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#studentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId && a.personId === personId)
      .map(cloneStudentAssignment);
  }

  listStudentAssignments(ctx: AccessContext): readonly StudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#studentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId)
      .map(cloneStudentAssignment);
  }

  // ---- Non-Student Assignments ----

  saveNonStudentAssignment(ctx: AccessContext, assignment: NonStudentAssignment): void {
    assertCapability(ctx, 'schedule.write');
    assertResourceTenant(ctx, assignment);
    this.#nonStudentAssignments.set(
      key(ctx.tenantId, assignment.id),
      cloneNonStudentAssignment(assignment),
    );
  }

  findNonStudentAssignmentsByMeeting(ctx: AccessContext, meetingId: string): readonly NonStudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#nonStudentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId && a.meetingId === meetingId)
      .map(cloneNonStudentAssignment);
  }

  findNonStudentAssignmentsByPerson(ctx: AccessContext, personId: string): readonly NonStudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#nonStudentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId && a.personId === personId)
      .map(cloneNonStudentAssignment);
  }

  listNonStudentAssignments(ctx: AccessContext): readonly NonStudentAssignment[] {
    assertCapability(ctx, 'schedule.read');
    return [...this.#nonStudentAssignments.values()]
      .filter(a => a.tenantId === ctx.tenantId)
      .map(cloneNonStudentAssignment);
  }

  // ---- Audit ----

  recordAudit(ctx: AccessContext, event: AuditEvent): void {
    assertCapability(ctx, 'schedule.write');
    assertResourceTenant(ctx, event);
    const auditKey = key(ctx.tenantId, event.id);
    if (this.#audit.has(auditKey)) throw new Error('Duplicate audit event id');
    this.#audit.set(auditKey, Object.freeze(structuredClone(event)));
  }

  listAudit(ctx: AccessContext): readonly AuditEvent[] {
    assertCapability(ctx, 'audit.read');
    return [...this.#audit.values()]
      .filter(event => event.tenantId === ctx.tenantId)
      .map(event => Object.freeze(structuredClone(event)));
  }

  // ---- Outbox ----

  emitEvent(ctx: AccessContext, event: DomainEvent): void {
    assertCapability(ctx, 'schedule.write');
    assertResourceTenant(ctx, event);
    const eventKey = key(ctx.tenantId, event.id);
    if (this.#outbox.has(eventKey)) throw new Error('Duplicate domain event id');
    this.#outbox.set(eventKey, Object.freeze(structuredClone(event)));
  }

  listOutbox(ctx: AccessContext): readonly DomainEvent[] {
    assertCapability(ctx, 'tenant.manage');
    return [...this.#outbox.values()]
      .filter(event => event.tenantId === ctx.tenantId)
      .map(event => Object.freeze(structuredClone(event)));
  }
}
