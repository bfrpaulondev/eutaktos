import {
  createAccessContext,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { BadRequestError, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';
import {
  buildAuthorizedMidweekRecommendation,
  type MidweekRecommendationTarget,
} from './recommendation-adapter';

type TenantEntity = { readonly id: string; readonly tenantId: string };

function storedEntity<T extends TenantEntity>(row: EntityRow, tenantId: string): Readonly<T> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) {
    throw new Error('Invalid stored recommendation entity');
  }
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored recommendation entity identity');
  return Object.freeze(structuredClone(data)) as Readonly<T>;
}

function opaqueReference(value: string | string[] | undefined, field: string): string {
  if (Array.isArray(value)) throw new BadRequestError(`${field} must be supplied once`);
  if (typeof value !== 'string') throw new BadRequestError(`${field} is required`);
  const normalized = value.trim();
  if (!normalized || normalized.length > 200 || /[\s/?#&=\u0000-\u001f\u007f]/.test(normalized)) {
    throw new BadRequestError(`${field} is invalid`);
  }
  return normalized;
}

/**
 * The public request contract intentionally accepts resource identity only.
 * Authority-bearing or recommendation-fact fields are rejected instead of
 * ignored so a caller can never believe they influenced server evidence.
 */
export function recommendationTargetFromRequest(request: Pick<ApiRequest, 'query' | 'body'>): MidweekRecommendationTarget {
  if (request.body !== undefined && request.body !== null) throw new BadRequestError('Recommendation GET does not accept a request body');
  const allowed = new Set(['meetingId', 'slotId']);
  if (Object.keys(request.query).some(key => !allowed.has(key))) {
    throw new BadRequestError('Unknown recommendation query field');
  }
  return Object.freeze({
    meetingId: opaqueReference(request.query.meetingId, 'meetingId'),
    slotId: opaqueReference(request.query.slotId, 'slotId'),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  await runEndpoint(request, response, async database => {
    const target = recommendationTargetFromRequest(request);
    const principal = await resolvePrincipal(request, database);

    // PX7 needs all four evidence families. Fail before loading any tenant data
    // when one of them is not authorized.
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
    const recommendation = buildAuthorizedMidweekRecommendation(context, target, {
      people: Object.freeze(peopleRows.map(row => storedEntity<CongregationPerson>(row, principal.tenantId))),
      meetings: Object.freeze(meetingRows.map(row => storedEntity<MidweekMeeting>(row, principal.tenantId))),
      studentAssignments: Object.freeze(studentRows.map(row => storedEntity<StudentAssignment>(row, principal.tenantId))),
      nonStudentAssignments: Object.freeze(nonStudentRows.map(row => storedEntity<NonStudentAssignment>(row, principal.tenantId))),
    });

    json(response, 200, recommendation);
  });
};

export default handler;
