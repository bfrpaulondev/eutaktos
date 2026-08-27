import {
  createAccessContext,
  findSlotById,
  type CongregationPerson,
  type MidweekMeeting,
  type NonStudentAssignment,
  type StudentAssignment,
} from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../_auth';
import type { EntityRow } from '../_db';
import { assertTrustedMutation, BadRequestError, exactKeys, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../_types';
import {
  buildAuthorizedMidweekRecommendation,
  RecommendationTargetError,
  type MidweekRecommendationTarget,
} from './recommendation-adapter';
import { changeManualRecommendationConstraint, loadManualRecommendationConstraints } from './recommendation-constraints';

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
  if (!normalized || normalized.length > 200 || /[\s/?#&=\u0000-\u001f\u007f]/.test(normalized)) throw new BadRequestError(`${field} is invalid`);
  return normalized;
}

export function recommendationTargetFromRequest(request: Pick<ApiRequest, 'query' | 'body'>): MidweekRecommendationTarget {
  if (request.body !== undefined && request.body !== null) throw new BadRequestError('Recommendation GET does not accept a request body');
  const allowed = new Set(['meetingId', 'slotId']);
  if (Object.keys(request.query).some(key => !allowed.has(key))) throw new BadRequestError('Unknown recommendation query field');
  return Object.freeze({ meetingId: opaqueReference(request.query.meetingId, 'meetingId'), slotId: opaqueReference(request.query.slotId, 'slotId') });
}

function constraintMutationFromRequest(request: Pick<ApiRequest, 'query' | 'body'>): Readonly<{ meetingId: string; slotId: string; personId: string; action: 'exclude' | 'allow' }> {
  if (Object.keys(request.query).length) throw new BadRequestError('Recommendation constraint mutation does not accept query fields');
  const body = requestBody(request.body);
  exactKeys(body, ['meetingId', 'slotId', 'personId', 'action']);
  const action = requiredString(body, 'action', 10);
  if (action !== 'exclude' && action !== 'allow') throw new BadRequestError('action is invalid');
  return Object.freeze({
    meetingId: opaqueReference(requiredString(body, 'meetingId', 200), 'meetingId'),
    slotId: opaqueReference(requiredString(body, 'slotId', 200), 'slotId'),
    personId: opaqueReference(requiredString(body, 'personId', 200), 'personId'),
    action,
  });
}

const handler: ApiHandler = async (request, response) => {
  if (!['GET', 'POST'].includes(request.method ?? '')) { methodNotAllowed(response, ['GET', 'POST']); return; }
  await runEndpoint(request, response, async database => {
    const target = request.method === 'GET' ? recommendationTargetFromRequest(request) : undefined;
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'schedule.read');

    if (request.method === 'POST') {
      assertTrustedMutation(request);
      requireCapability(principal, 'schedule.write');
      const input = constraintMutationFromRequest(request);
      const [meetingRow, personRow] = await Promise.all([
        database.entity(principal.tenantId, 'midweek-meeting', input.meetingId),
        database.entity(principal.tenantId, 'person', input.personId),
      ]);
      if (!meetingRow) throw new BadRequestError('Recommendation target meeting was not found');
      if (!personRow) throw new BadRequestError('Recommendation constraint person was not found');
      const meeting = storedEntity<MidweekMeeting>(meetingRow, principal.tenantId);
      if (meeting.state !== 'draft' && meeting.state !== 'published') throw new BadRequestError('Recommendation target meeting is not assignable');
      const slot = findSlotById(meeting, input.slotId);
      const assignmentTypeId = slot?.partDefinitionId?.trim();
      if (!slot || !assignmentTypeId) throw new BadRequestError('Recommendation target slot has no explicit assignment type');
      const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });
      const result = await changeManualRecommendationConstraint(database, context, input.personId, assignmentTypeId, input.action);
      json(response, 200, Object.freeze({
        contractVersion: 'people-manual-constraint-v1',
        target: Object.freeze({ meetingId: meeting.id, slotId: slot.id, assignmentTypeId }),
        personId: input.personId,
        excluded: result.excluded,
        changed: result.changed,
      }));
      return;
    }

    if (!target) throw new Error('Recommendation target was not resolved');
    requireCapability(principal, 'eligibility.read');
    requireCapability(principal, 'availability.read');
    const [peopleRows, meetingRows, studentRows, nonStudentRows, manualConstraints] = await Promise.all([
      database.entities(principal.tenantId, 'person'),
      database.entities(principal.tenantId, 'midweek-meeting'),
      database.entities(principal.tenantId, 'student-assignment'),
      database.entities(principal.tenantId, 'non-student-assignment'),
      loadManualRecommendationConstraints(database, principal.tenantId),
    ]);
    const context = createAccessContext({ tenantId: principal.tenantId, actorId: principal.actorId, capabilities: principal.capabilities });

    try {
      const recommendation = buildAuthorizedMidweekRecommendation(context, target, {
        people: Object.freeze(peopleRows.map(row => storedEntity<CongregationPerson>(row, principal.tenantId))),
        meetings: Object.freeze(meetingRows.map(row => storedEntity<MidweekMeeting>(row, principal.tenantId))),
        studentAssignments: Object.freeze(studentRows.map(row => storedEntity<StudentAssignment>(row, principal.tenantId))),
        nonStudentAssignments: Object.freeze(nonStudentRows.map(row => storedEntity<NonStudentAssignment>(row, principal.tenantId))),
        manualConstraints,
      });
      json(response, 200, Object.freeze({ ...recommendation, canManageManualConstraints: principal.capabilities.includes('schedule.write') }));
    } catch (error) {
      if (error instanceof RecommendationTargetError) throw new BadRequestError(error.message);
      throw error;
    }
  });
};

export default handler;