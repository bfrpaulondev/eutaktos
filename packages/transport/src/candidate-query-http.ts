import type { CandidateQueryService, ScheduleViewService } from '@eutaktos/application';
import {
  createAccessContext,
  type CandidateProfile,
  type CandidateRole,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

// ─── DTOs ───────────────────────────────────────────────────────────────────

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
  /**
   * NEVER exposed as a "human rank" — only `reasons` and optional `hint`
   * should be displayed in the UI. The score is included for telemetry/debug
   * but the UI must not surface it as "ranking X of N".
   */
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
  readonly studentDisplayName: string | null;
  readonly assistantDisplayName: string | null;
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

// ─── Helpers ───────────────────────────────────────────────────────────────

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

function toContext(principal: VerifiedPrincipal | undefined): Readonly<Parameters<CandidateQueryService['listCandidates']>[0]> | undefined {
  if (!principal) return undefined;
  // The principal's tenant/actor/capabilities are server-derived and trusted.
  // We construct the AccessContext in the API layer (not in the transport).
  return undefined;
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

// ─── Transport ────────────────────────────────────────────────────────────

/**
 * HTTP transport for read-only candidate queries.
 *
 * All inputs are validated. Errors return stable HTTP status codes:
 *   - 401: missing principal
 *   - 403: missing capability or cross-tenant
 *   - 400: invalid request shape
 *   - 404: meeting/slot not found
 */
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
    const b = body as Readonly<Record<string, unknown>>;

    const slotId = typeof b.slotId === 'string' ? b.slotId.trim() : '';
    if (!slotId) return badRequest('slotId is required');

    const roleRaw = typeof b.role === 'string' ? b.role.trim() : '';
    if (roleRaw !== 'student' && roleRaw !== 'assistant' && roleRaw !== 'non-student') {
      return badRequest('role must be student, assistant or non-student');
    }

    // For non-student role, `assignmentTypeId` (the role string) is required in the body.
    let assignmentTypeId: string | undefined;
    if (roleRaw === 'non-student') {
      assignmentTypeId = typeof b.assignmentTypeId === 'string' ? b.assignmentTypeId.trim() : '';
      if (!assignmentTypeId) return badRequest('assignmentTypeId is required for non-student role');
    }

    // Optional excludePersonIds (array of strings).
    let excludePersonIds: readonly string[] | undefined;
    if (b.excludePersonIds !== undefined) {
      if (!Array.isArray(b.excludePersonIds)) return badRequest('excludePersonIds must be an array');
      excludePersonIds = b.excludePersonIds.filter((v): v is string => typeof v === 'string');
    }

    // Reject unknown fields to avoid silent parameter drift.
    const allowedKeys = new Set(['slotId', 'role', 'excludePersonIds', 'assignmentTypeId']);
    const unknown = Object.keys(b).filter(k => !allowedKeys.has(k));
    if (unknown.length > 0) return badRequest(`Unknown fields: ${unknown.sort().join(', ')}`);

    // Construct the trusted AccessContext from the principal.
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

/**
 * HTTP transport for the read-only schedule view.
 */
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

// Stub usage to keep the imported types "in use" for toolchains that warn.
void toContext;
