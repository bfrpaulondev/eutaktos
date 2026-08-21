/**
 * K33 — Midweek Secure HTTP Transport
 *
 * HTTP transport boundary for midweek meeting scheduling.
 * Since K21–K32 are not yet merged, all domain/application types
 * are defined locally in this file to keep the transport self-contained.
 */
import {
  createAccessContext,
  type AccessContext,
  type Capability,
} from '@eutaktos/domain';
import type { VerifiedPrincipal, TransportRequest, TransportResponse } from './people-http';

// ────────────────────────────────────────────────────────────
// Local domain types (replace with imports once K21–K32 merge)
// ────────────────────────────────────────────────────────────

export type MeetingStatus = 'draft' | 'published' | 'archived';
export type AssignmentStatus = 'assigned' | 'cancelled';

export interface LocalSlot {
  id: string;
  meetingId: string;
  assignmentTypeId: string;
  label?: string;
  order: number;
  assignment?: LocalAssignment;
}

export interface LocalAssignment {
  id: string;
  meetingId: string;
  slotId: string;
  personId: string;
  role: 'student' | 'assistant' | 'non-student';
  assistantId?: string;
  status: AssignmentStatus;
  assignedBy: string;
  assignedAt: string;
  /** Internal audit — never returned in DTOs */
  tenantId: string;
}

export interface LocalMeeting {
  id: string;
  tenantId: string;
  date: string;
  status: MeetingStatus;
  note?: string;
  slots: readonly LocalSlot[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ────────────────────────────────────────────────────────────
// Response DTOs (minimized — no internal audit data)
// ────────────────────────────────────────────────────────────

export interface AssignmentResponse {
  id: string;
  slotId: string;
  personId: string;
  role: 'student' | 'assistant' | 'non-student';
  assistantId?: string;
  status: AssignmentStatus;
}

export interface SlotResponse {
  id: string;
  assignmentTypeId: string;
  label?: string;
  order: number;
  assignment?: AssignmentResponse;
}

export interface MeetingResponse {
  id: string;
  date: string;
  status: MeetingStatus;
  note?: string;
  slots: readonly SlotResponse[];
}

export interface ErrorResponseBody {
  error: string;
}

// ────────────────────────────────────────────────────────────
// Port interface for the application service
// ────────────────────────────────────────────────────────────

export interface MidweekSchedulingPort {
  createMeeting(
    context: AccessContext,
    input: { date: string; note?: string },
    metadata?: RequestMeta,
  ): LocalMeeting;

  getMeeting(context: AccessContext, meetingId: string): LocalMeeting | undefined;

  listMeetings(context: AccessContext): readonly LocalMeeting[];

  addSlot(
    context: AccessContext,
    meetingId: string,
    input: { assignmentTypeId: string; label?: string; order?: number },
    metadata?: RequestMeta,
  ): LocalMeeting;

  removeSlot(
    context: AccessContext,
    meetingId: string,
    slotId: string,
    metadata?: RequestMeta,
  ): LocalMeeting;

  assignStudent(
    context: AccessContext,
    meetingId: string,
    input: { personId: string; slotId: string; assistantId?: string },
    metadata?: RequestMeta,
  ): LocalAssignment;

  assignNonStudent(
    context: AccessContext,
    meetingId: string,
    input: { personId: string; slotId: string; role?: string },
    metadata?: RequestMeta,
  ): LocalAssignment;

  cancelAssignment(
    context: AccessContext,
    assignmentId: string,
    metadata?: RequestMeta,
  ): LocalAssignment;

  publishMeeting(
    context: AccessContext,
    meetingId: string,
    metadata?: RequestMeta,
  ): LocalMeeting;

  archiveMeeting(
    context: AccessContext,
    meetingId: string,
    metadata?: RequestMeta,
  ): LocalMeeting;

  updateMeeting(
    context: AccessContext,
    meetingId: string,
    input: { date?: string; note?: string },
    metadata?: RequestMeta,
  ): LocalMeeting;
}

interface RequestMeta {
  correlationId?: string;
}

// ────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────

function unauthorized(): TransportResponse<ErrorResponseBody> {
  return { status: 401, body: { error: 'Unauthorized' } };
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

function meta(request: TransportRequest): RequestMeta {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Request body must be an object');
  }
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(
  body: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
): void {
  const allowedSet = new Set(allowed);
  const unknown = Object.keys(body).filter(k => !allowedSet.has(k));
  if (unknown.length > 0) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
}

function requiredString(body: Readonly<Record<string, unknown>>, key: string): string {
  const v = body[key];
  if (typeof v !== 'string' || v.length === 0) throw new Error(`${key} must be a non-empty string`);
  return v;
}

function optionalString(body: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new Error(`${key} must be a string`);
  return v;
}

function optionalNumber(body: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const v = body[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${key} must be a number`);
  return v;
}

// ────────────────────────────────────────────────────────────
// Request body parsers
// ────────────────────────────────────────────────────────────

function parseCreateMeetingBody(value: unknown): { date: string; note?: string } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['date', 'note']);
  const date = requiredString(body, 'date');
  const note = optionalString(body, 'note');
  return { date, ...(note !== undefined ? { note } : {}) };
}

function parseAddSlotBody(value: unknown): { assignmentTypeId: string; label?: string; order?: number } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['assignmentTypeId', 'label', 'order']);
  const assignmentTypeId = requiredString(body, 'assignmentTypeId');
  const label = optionalString(body, 'label');
  const order = optionalNumber(body, 'order');
  return { assignmentTypeId, ...(label !== undefined ? { label } : {}), ...(order !== undefined ? { order } : {}) };
}

function parseAssignStudentBody(value: unknown): { personId: string; slotId: string; assistantId?: string } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['personId', 'slotId', 'assistantId']);
  const personId = requiredString(body, 'personId');
  const slotId = requiredString(body, 'slotId');
  const assistantId = optionalString(body, 'assistantId');
  return { personId, slotId, ...(assistantId !== undefined ? { assistantId } : {}) };
}

function parseAssignNonStudentBody(value: unknown): { personId: string; slotId: string; role?: string } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['personId', 'slotId', 'role']);
  const personId = requiredString(body, 'personId');
  const slotId = requiredString(body, 'slotId');
  const role = optionalString(body, 'role');
  return { personId, slotId, ...(role !== undefined ? { role } : {}) };
}

function parseUpdateMeetingBody(value: unknown): { date?: string; note?: string } {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['date', 'note']);
  const date = optionalString(body, 'date');
  const note = optionalString(body, 'note');
  if (date === undefined && note === undefined) {
    throw new Error('At least one of date or note is required');
  }
  return { ...(date !== undefined ? { date } : {}), ...(note !== undefined ? { note } : {}) };
}

// ────────────────────────────────────────────────────────────
// DTO mappers
// ────────────────────────────────────────────────────────────

function toAssignmentDto(a: LocalAssignment): AssignmentResponse {
  return {
    id: a.id,
    slotId: a.slotId,
    personId: a.personId,
    role: a.role,
    ...(a.assistantId ? { assistantId: a.assistantId } : {}),
    status: a.status,
  };
}

function toSlotDto(s: LocalSlot): SlotResponse {
  return {
    id: s.id,
    assignmentTypeId: s.assignmentTypeId,
    ...(s.label ? { label: s.label } : {}),
    order: s.order,
    ...(s.assignment ? { assignment: toAssignmentDto(s.assignment) } : {}),
  };
}

export function toMeetingDto(m: LocalMeeting): MeetingResponse {
  return {
    id: m.id,
    date: m.date,
    status: m.status,
    ...(m.note ? { note: m.note } : {}),
    slots: m.slots.map(toSlotDto),
  };
}

// ────────────────────────────────────────────────────────────
// Safe error mapping
// ────────────────────────────────────────────────────────────

function safeError(error: unknown): TransportResponse<ErrorResponseBody> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (message === 'Meeting not found') return { status: 404, body: { error: 'Meeting not found' } };
  if (message === 'Assignment not found') return { status: 404, body: { error: 'Assignment not found' } };
  if (message === 'Slot not found') return { status: 404, body: { error: 'Slot not found' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('too long') ||
    message.includes('At least one') ||
    message.startsWith('Unknown request fields:')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

// ────────────────────────────────────────────────────────────
// Handler functions
// ────────────────────────────────────────────────────────────

export function handleCreateMeeting(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  body: unknown,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  try {
    const parsed = parseCreateMeetingBody(body);
    const meeting = port.createMeeting(context, parsed, { correlationId });
    return { status: 201, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleGetMeeting(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const id = meetingId?.trim();
  if (!id) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const meeting = port.getMeeting(context, id);
    return meeting
      ? { status: 200, body: toMeetingDto(meeting) }
      : { status: 404, body: { error: 'Meeting not found' } };
  } catch (error) {
    return safeError(error);
  }
}

export function handleListMeetings(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
): TransportResponse<readonly MeetingResponse[] | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  try {
    return { status: 200, body: port.listMeetings(context).map(toMeetingDto) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleAddSlot(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  body: unknown,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const id = meetingId?.trim();
  if (!id) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const parsed = parseAddSlotBody(body);
    const meeting = port.addSlot(context, id, parsed, { correlationId });
    return { status: 200, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleRemoveSlot(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  slotId: string | undefined,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const mid = meetingId?.trim();
  if (!mid) return { status: 400, body: { error: 'meetingId is required' } };
  const sid = slotId?.trim();
  if (!sid) return { status: 400, body: { error: 'slotId is required' } };
  try {
    const meeting = port.removeSlot(context, mid, sid, { correlationId });
    return { status: 200, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleAssignStudent(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  body: unknown,
  correlationId?: string,
): TransportResponse<AssignmentResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const mid = meetingId?.trim();
  if (!mid) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const parsed = parseAssignStudentBody(body);
    const assignment = port.assignStudent(context, mid, parsed, { correlationId });
    return { status: 201, body: toAssignmentDto(assignment) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleAssignNonStudent(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  body: unknown,
  correlationId?: string,
): TransportResponse<AssignmentResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const mid = meetingId?.trim();
  if (!mid) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const parsed = parseAssignNonStudentBody(body);
    const assignment = port.assignNonStudent(context, mid, parsed, { correlationId });
    return { status: 201, body: toAssignmentDto(assignment) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleCancelAssignment(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  assignmentId: string | undefined,
  correlationId?: string,
): TransportResponse<AssignmentResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const aid = assignmentId?.trim();
  if (!aid) return { status: 400, body: { error: 'assignmentId is required' } };
  try {
    const assignment = port.cancelAssignment(context, aid, { correlationId });
    return { status: 200, body: toAssignmentDto(assignment) };
  } catch (error) {
    return safeError(error);
  }
}

export function handlePublishMeeting(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const id = meetingId?.trim();
  if (!id) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const meeting = port.publishMeeting(context, id, { correlationId });
    return { status: 200, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleArchiveMeeting(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const id = meetingId?.trim();
  if (!id) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const meeting = port.archiveMeeting(context, id, { correlationId });
    return { status: 200, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}

export function handleUpdateMeeting(
  ctx: VerifiedPrincipal | undefined,
  port: MidweekSchedulingPort,
  meetingId: string | undefined,
  body: unknown,
  correlationId?: string,
): TransportResponse<MeetingResponse | ErrorResponseBody> {
  const context = toContext(ctx);
  if (!context) return unauthorized();
  const id = meetingId?.trim();
  if (!id) return { status: 400, body: { error: 'meetingId is required' } };
  try {
    const parsed = parseUpdateMeetingBody(body);
    const meeting = port.updateMeeting(context, id, parsed, { correlationId });
    return { status: 200, body: toMeetingDto(meeting) };
  } catch (error) {
    return safeError(error);
  }
}
