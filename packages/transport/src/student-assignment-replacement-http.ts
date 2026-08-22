import type { RequestMetadata, StudentAssignmentReplacementService } from '@eutaktos/application';
import { createAccessContext, type AccessContext, type StudentAssignment } from '@eutaktos/domain';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export type StudentAssignmentReplacementApplication = Pick<StudentAssignmentReplacementService, 'replace'>;

export interface StudentReplacementDto {
  readonly id: string;
  readonly meetingId: string;
  readonly slotId: string;
  readonly studentId: string;
  readonly assistantId: string | null;
  readonly state: StudentAssignment['state'];
}

function unauthorized(): TransportResponse<{ error: string }> { return { status: 401, body: { error: 'Unauthorized' } }; }
function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  return principal ? createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities }) : undefined;
}
function metadata(request: TransportRequest): RequestMetadata { return request.correlationId ? { correlationId: request.correlationId } : {}; }
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
function parseBody(value: unknown): { studentId: string; assistantId?: string | null } {
  const body = objectBody(value);
  const unknown = Object.keys(body).filter(key => key !== 'studentId' && key !== 'assistantId');
  if (unknown.length) throw new Error(`Unknown request fields: ${unknown.sort().join(', ')}`);
  if (typeof body.studentId !== 'string' || !body.studentId.trim()) throw new Error('studentId is required');
  if (body.assistantId !== undefined && body.assistantId !== null && typeof body.assistantId !== 'string') throw new Error('assistantId must be a string or null');
  return {
    studentId: body.studentId,
    ...(body.assistantId !== undefined ? { assistantId: body.assistantId as string | null } : {}),
  };
}
function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:') || message.startsWith('Cross-tenant')) return { status: 403, body: { error: 'Forbidden' } };
  if (message.endsWith('not found')) return { status: 404, body: { error: 'Not found' } };
  if (message.includes('conflict') || message.startsWith('Only ') || message.includes('only be changed') || message.includes('not explicitly eligible') || message.includes('Inactive person') || message.includes('Assistant is')) return { status: 409, body: { error: 'Scheduling operation cannot be completed' } };
  if (message.includes('must be') || message.includes('is required') || message.includes('too long') || message.startsWith('Unknown request fields:')) return { status: 400, body: { error: message } };
  return { status: 500, body: { error: 'Internal server error' } };
}
function dto(value: Readonly<StudentAssignment>): StudentReplacementDto {
  return Object.freeze({ id: value.id, meetingId: value.meetingId, slotId: value.slotId, studentId: value.studentId, assistantId: value.assistantId, state: value.state });
}

export class StudentAssignmentReplacementHttpTransport {
  readonly #app: StudentAssignmentReplacementApplication;
  constructor(app: StudentAssignmentReplacementApplication) { this.#app = app; }

  replace(request: TransportRequest): TransportResponse<StudentReplacementDto | { error: string }> {
    const context = toContext(request.principal); if (!context) return unauthorized();
    const assignmentId = requiredParam(request, 'assignmentId');
    if (!assignmentId) return { status: 400, body: { error: 'assignmentId is required' } };
    try { return { status: 200, body: dto(this.#app.replace(context, { assignmentId, ...parseBody(request.body) }, metadata(request))) }; }
    catch (error) { return safeError(error); }
  }
}
