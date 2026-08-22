import type {
  AddMidweekSlotInput,
  AssignNonStudentInput,
  AssignStudentInput,
  CreateMidweekMeetingInput,
  MidweekSchedulingService,
  RequestMetadata,
} from '@eutaktos/application';
import {
  createAccessContext,
  type AccessContext,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export type MidweekSchedulingApplication = Pick<
  MidweekSchedulingService,
  | 'createDraftMeeting'
  | 'addSlot'
  | 'removeSlot'
  | 'updateMeeting'
  | 'assignStudent'
  | 'assignNonStudent'
  | 'cancelStudentAssignment'
  | 'cancelNonStudentAssignment'
  | 'publishMeeting'
  | 'cancelMeeting'
  | 'archiveMeeting'
>;

export interface MidweekMeetingDto {
  id: string;
  date: string;
  localTime: string;
  timezone: string;
  locationId?: string;
  state: MidweekMeeting['state'];
  slots: readonly {
    id: string;
    position: number;
    durationMinutes: number;
    titleKey: string;
    partDefinitionId?: string;
  }[];
}

export interface StudentAssignmentDto {
  id: string;
  meetingId: string;
  slotId: string;
  studentId: string;
  assistantId: string | null;
  state: StudentAssignment['state'];
}

export interface NonStudentAssignmentDto {
  id: string;
  meetingId: string;
  slotId: string;
  personId: string;
  role: string;
  state: NonStudentAssignment['state'];
}

function unauthorized(): TransportResponse<{ error: string }> {
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

function metadata(request: TransportRequest): RequestMetadata {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function requiredParam(request: TransportRequest, key: string): string | undefined {
  const value = request.params?.[key];
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function objectBody(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Request body must be an object');
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  const unknown = Object.keys(body).filter(key => !set.has(key));
  if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
}

function requiredString(body: Readonly<Record<string, unknown>>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function optionalString(body: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function optionalNullableString(body: Readonly<Record<string, unknown>>, key: string): string | null | undefined {
  const value = body[key];
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') throw new Error(`${key} must be a string or null`);
  return value;
}

function requiredInteger(body: Readonly<Record<string, unknown>>, key: string): number {
  const value = body[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new Error(`${key} must be an integer`);
  return value;
}

function parseCreateMeeting(value: unknown): CreateMidweekMeetingInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['date', 'localTime', 'timezone', 'locationId']);
  const locationId = optionalString(body, 'locationId');
  return {
    date: requiredString(body, 'date'),
    localTime: requiredString(body, 'localTime'),
    timezone: requiredString(body, 'timezone'),
    ...(locationId !== undefined ? { locationId } : {}),
  };
}

function parseAddSlot(value: unknown): AddMidweekSlotInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['position', 'durationMinutes', 'titleKey', 'partDefinitionId']);
  const partDefinitionId = optionalString(body, 'partDefinitionId');
  return {
    position: requiredInteger(body, 'position'),
    durationMinutes: requiredInteger(body, 'durationMinutes'),
    titleKey: requiredString(body, 'titleKey'),
    ...(partDefinitionId !== undefined ? { partDefinitionId } : {}),
  };
}

function parseUpdateMeeting(value: unknown): Parameters<MidweekSchedulingApplication['updateMeeting']>[2] {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['date', 'localTime', 'timezone', 'locationId']);
  const date = optionalString(body, 'date');
  const localTime = optionalString(body, 'localTime');
  const timezone = optionalString(body, 'timezone');
  const locationId = optionalNullableString(body, 'locationId');
  return {
    ...(date !== undefined ? { date } : {}),
    ...(localTime !== undefined ? { localTime } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
  };
}

function parseStudent(meetingId: string, value: unknown): AssignStudentInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['slotId', 'studentId', 'assistantId']);
  const assistantId = optionalNullableString(body, 'assistantId');
  return {
    meetingId,
    slotId: requiredString(body, 'slotId'),
    studentId: requiredString(body, 'studentId'),
    ...(assistantId !== undefined ? { assistantId } : {}),
  };
}

function parseNonStudent(meetingId: string, value: unknown): AssignNonStudentInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['slotId', 'personId', 'role']);
  return {
    meetingId,
    slotId: requiredString(body, 'slotId'),
    personId: requiredString(body, 'personId'),
    role: requiredString(body, 'role'),
  };
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:') || message.startsWith('Cross-tenant')) return { status: 403, body: { error: 'Forbidden' } };
  if (message.endsWith('not found') || message === 'Meeting not found' || message === 'Slot not found') return { status: 404, body: { error: 'Not found' } };
  if (
    message.includes('conflict') ||
    message.startsWith('Cannot ') ||
    message.includes('only be changed') ||
    message.includes('not explicitly eligible') ||
    message.includes('Inactive person') ||
    message.includes('does not accept') ||
    message.includes('Assistant is')
  ) return { status: 409, body: { error: 'Scheduling operation cannot be completed' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('Invalid ') ||
    message.startsWith('Unknown request fields:') ||
    message.includes('too long')
  ) return { status: 400, body: { error: message } };
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toMidweekMeetingDto(meeting: Readonly<MidweekMeeting>): MidweekMeetingDto {
  return {
    id: meeting.id,
    date: meeting.date,
    localTime: meeting.localTime,
    timezone: meeting.timezone,
    ...(meeting.locationId ? { locationId: meeting.locationId } : {}),
    state: meeting.state,
    slots: meeting.slots.map(slot => ({
      id: slot.id,
      position: slot.position,
      durationMinutes: slot.durationMinutes,
      titleKey: slot.titleKey,
      ...(slot.partDefinitionId ? { partDefinitionId: slot.partDefinitionId } : {}),
    })),
  };
}

function toStudentDto(value: Readonly<StudentAssignment>): StudentAssignmentDto {
  return { id: value.id, meetingId: value.meetingId, slotId: value.slotId, studentId: value.studentId, assistantId: value.assistantId, state: value.state };
}

function toNonStudentDto(value: Readonly<NonStudentAssignment>): NonStudentAssignmentDto {
  return { id: value.id, meetingId: value.meetingId, slotId: value.slotId, personId: value.personId, role: value.role, state: value.state };
}

export class MidweekSchedulingHttpTransport {
  readonly #app: MidweekSchedulingApplication;

  constructor(app: MidweekSchedulingApplication) {
    this.#app = app;
  }

  createMeeting(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    try { return { status: 201, body: toMidweekMeetingDto(this.#app.createDraftMeeting(context, parseCreateMeeting(request.body), metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  addSlot(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); if (!meetingId) return { status: 400, body: { error: 'meetingId is required' } };
    try { return { status: 200, body: toMidweekMeetingDto(this.#app.addSlot(context, meetingId, parseAddSlot(request.body), metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  removeSlot(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); const slotId = requiredParam(request, 'slotId');
    if (!meetingId || !slotId) return { status: 400, body: { error: !meetingId ? 'meetingId is required' : 'slotId is required' } };
    try { return { status: 200, body: toMidweekMeetingDto(this.#app.removeSlot(context, meetingId, slotId, metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  updateMeeting(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); if (!meetingId) return { status: 400, body: { error: 'meetingId is required' } };
    try { return { status: 200, body: toMidweekMeetingDto(this.#app.updateMeeting(context, meetingId, parseUpdateMeeting(request.body), metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  assignStudent(request: TransportRequest): TransportResponse<StudentAssignmentDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); if (!meetingId) return { status: 400, body: { error: 'meetingId is required' } };
    try { return { status: 201, body: toStudentDto(this.#app.assignStudent(context, parseStudent(meetingId, request.body), metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  assignNonStudent(request: TransportRequest): TransportResponse<NonStudentAssignmentDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); if (!meetingId) return { status: 400, body: { error: 'meetingId is required' } };
    try { return { status: 201, body: toNonStudentDto(this.#app.assignNonStudent(context, parseNonStudent(meetingId, request.body), metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  cancelStudent(request: TransportRequest): TransportResponse<StudentAssignmentDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const assignmentId = requiredParam(request, 'assignmentId'); if (!assignmentId) return { status: 400, body: { error: 'assignmentId is required' } };
    try { return { status: 200, body: toStudentDto(this.#app.cancelStudentAssignment(context, assignmentId, metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  cancelNonStudent(request: TransportRequest): TransportResponse<NonStudentAssignmentDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const assignmentId = requiredParam(request, 'assignmentId'); if (!assignmentId) return { status: 400, body: { error: 'assignmentId is required' } };
    try { return { status: 200, body: toNonStudentDto(this.#app.cancelNonStudentAssignment(context, assignmentId, metadata(request))) }; }
    catch (error) { return safeError(error); }
  }

  publishMeeting(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    return this.#meetingTransition(request, (context, meetingId) => this.#app.publishMeeting(context, meetingId, metadata(request)));
  }

  cancelMeeting(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    return this.#meetingTransition(request, (context, meetingId) => this.#app.cancelMeeting(context, meetingId, metadata(request)));
  }

  archiveMeeting(request: TransportRequest): TransportResponse<MidweekMeetingDto | { error: string }> {
    return this.#meetingTransition(request, (context, meetingId) => this.#app.archiveMeeting(context, meetingId, metadata(request)));
  }

  #meetingTransition(
    request: TransportRequest,
    operation: (context: Readonly<AccessContext>, meetingId: string) => Readonly<MidweekMeeting>,
  ): TransportResponse<MidweekMeetingDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const meetingId = requiredParam(request, 'meetingId'); if (!meetingId) return { status: 400, body: { error: 'meetingId is required' } };
    try { return { status: 200, body: toMidweekMeetingDto(operation(context, meetingId)) }; }
    catch (error) { return safeError(error); }
  }
}
