import type { CandidateQueryService, ScheduleViewService } from '@eutaktos/application';
import {
  createAccessContext,
  type CandidateProfile,
  type CandidateRole,
  type MidweekMeeting,
} from '@eutaktos/domain';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface CandidateReasonDto {
  readonly kind: string;
  readonly messageKey: string;
  readonly params: Readonly<Record<string, string | number>>;
}

export interface CandidateConflictInfoDto {
  readonly kind: 'assignment-overlap' | 'unavailable';
  readonly sourceId: string;
}

export interface CandidateProfileDto {
  readonly personId: string;
  readonly displayName: string;
  readonly role: CandidateRole;
  readonly eligible: boolean;
  readonly available: boolean;
  readonly inactive: boolean;
  readonly conflicts: readonly CandidateConflictInfoDto[];
  readonly lastAssignmentDate: string | null;
  readonly daysSinceLastAssignment: number | null;
  readonly recentAssignmentCount: number;
  readonly alreadyAssignedInMeeting: boolean;
  readonly reasons: readonly CandidateReasonDto[];
}

export interface CandidateQueryResultDto {
  readonly meetingId: string;
  readonly slotId: string;
  readonly role: CandidateRole;
  readonly assignmentTypeId: string;
  readonly window: { readonly startsAt: string; readonly endsAt: string };
  readonly candidates: readonly CandidateProfileDto[];
}

export interface ScheduleSlotViewDto {
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
  readonly state: 'filled' | 'vacant' | 'conflict';
}

export interface ScheduleMeetingViewDto {
  readonly meetingId: string;
  readonly date: string;
  readonly localTime: string;
  readonly timezone: string;
  readonly locationId?: string;
  readonly state: MidweekMeeting['state'];
  readonly slots: readonly ScheduleSlotViewDto[];
  readonly totalSlots: number;
  readonly filledSlots: number;
  readonly vacantSlots: number;
  readonly conflictedSlots: number;
}

function unauthorized(): TransportResponse<unknown> {
  return { status: 401, body: { error: 'Unauthorized' } };
}

function forbidden(): TransportResponse<unknown> {
  return { status: 403, body: { error: 'Forbidden' } };
}

function badRequest(message: string): TransportResponse<unknown> {
  return { status: 400, body: { error: message } };
}

function notFound(message: string): TransportResponse<unknown> {
  return { status: 404, body: { error: message } };
}

function ok<T>(body: T): TransportResponse<T> {
  return { status: 200, body };
}

function toCandidateDto(profile: Readonly<CandidateProfile>): CandidateProfileDto {
  return {
    personId: profile.personId,
    displayName: profile.displayName,
    role: profile.role,
    eligible: profile.eligible,
    available: profile.available,
    inactive: profile.inactive,
    conflicts: profile.conflicts,
    lastAssignmentDate: profile.lastAssignmentDate,
    daysSinceLastAssignment: profile.daysSinceLastAssignment,
    recentAssignmentCount: profile.recentAssignmentCount,
    alreadyAssignedInMeeting: profile.alreadyAssignedInMeeting,
    reasons: profile.reasons,
  };
}

export class CandidateQueryHttpTransport {
  readonly #service: CandidateQueryService;

  constructor(service: CandidateQueryService) {
    this.#service = service;
  }

  listCandidates(
    request: TransportRequest,
    principal: VerifiedPrincipal | undefined,
    params: { meetingId: string },
  ): TransportResponse<unknown> {
    if (!principal) return unauthorized();
    const body = request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Request body must be an object');
    const candidateBody = body as Readonly<Record<string, unknown>>;

    const slotId = typeof candidateBody.slotId === 'string' ? candidateBody.slotId.trim() : '';
    if (!slotId) return badRequest('slotId is required');

    const roleRaw = typeof candidateBody.role === 'string' ? candidateBody.role.trim() : '';
    if (roleRaw !== 'student' && roleRaw !== 'assistant' && roleRaw !== 'non-student') {
      return badRequest('role must be student, assistant or non-student');
    }

    let assignmentTypeId: string | undefined;
    if (roleRaw === 'non-student') {
      assignmentTypeId = typeof candidateBody.assignmentTypeId === 'string' ? candidateBody.assignmentTypeId.trim() : '';
      if (!assignmentTypeId) return badRequest('assignmentTypeId is required for non-student role');
    }

    let excludePersonIds: readonly string[] | undefined;
    if (candidateBody.excludePersonIds !== undefined) {
      if (!Array.isArray(candidateBody.excludePersonIds)) return badRequest('excludePersonIds must be an array');
      excludePersonIds = candidateBody.excludePersonIds.filter((value): value is string => typeof value === 'string');
    }

    const allowedKeys = new Set(['slotId', 'role', 'excludePersonIds', 'assignmentTypeId']);
    const unknown = Object.keys(candidateBody).filter(key => !allowedKeys.has(key));
    if (unknown.length > 0) return badRequest(`Unknown fields: ${unknown.sort().join(', ')}`);

    const capabilities = new Set(principal.capabilities);
    if (!capabilities.has('schedule.read')) return forbidden();
    if (!capabilities.has('eligibility.read')) return forbidden();
    if (!capabilities.has('availability.read')) return forbidden();
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });

    try {
      if (roleRaw === 'non-student') {
        const result = this.#service.listNonStudentCandidates(context, params.meetingId, slotId, assignmentTypeId as string);
        return ok({
          meetingId: result.meetingId,
          slotId: result.slotId,
          role: result.role,
          assignmentTypeId: result.assignmentTypeId,
          window: result.window,
          candidates: result.candidates.map(toCandidateDto),
        });
      }
      const result = this.#service.listCandidates(context, {
        meetingId: params.meetingId,
        slotId,
        role: roleRaw,
        ...(excludePersonIds ? { excludePersonIds } : {}),
      });
      return ok({
        meetingId: result.meetingId,
        slotId: result.slotId,
        role: result.role,
        assignmentTypeId: result.assignmentTypeId,
        window: result.window,
        candidates: result.candidates.map(toCandidateDto),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      if (message.includes('not found')) return notFound(message);
      if (message.startsWith('Access denied:') || message.startsWith('Cross-tenant')) return forbidden();
      return badRequest(message);
    }
  }
}

export class ScheduleViewHttpTransport {
  readonly #service: ScheduleViewService;

  constructor(service: ScheduleViewService) {
    this.#service = service;
  }

  viewMeeting(
    _request: TransportRequest,
    principal: VerifiedPrincipal | undefined,
    params: { meetingId: string },
  ): TransportResponse<unknown> {
    if (!principal) return unauthorized();
    const capabilities = new Set(principal.capabilities);
    if (!capabilities.has('schedule.read')) return forbidden();
    const context = createAccessContext({
      tenantId: principal.tenantId,
      actorId: principal.actorId,
      capabilities: principal.capabilities,
    });
    try {
      const view = this.#service.viewMeeting(context, params.meetingId);
      return ok({
        meetingId: view.meetingId,
        date: view.date,
        localTime: view.localTime,
        timezone: view.timezone,
        ...(view.locationId ? { locationId: view.locationId } : {}),
        state: view.state,
        slots: view.slots,
        totalSlots: view.totalSlots,
        filledSlots: view.filledSlots,
        vacantSlots: view.vacantSlots,
        conflictedSlots: view.conflictedSlots,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error';
      if (message.includes('not found')) return notFound(message);
      if (message.startsWith('Access denied:') || message.startsWith('Cross-tenant')) return forbidden();
      return badRequest(message);
    }
  }
}
