import {
  HOURGLASS_EXTERNAL_ID_PREFIX,
  HOURGLASS_IMPORT_LIMITS,
  inspectHourglassJsonExport,
  previewHourglassImport,
  type ExistingHourglassPerson,
  type HourglassImportInspection,
} from '@eutaktos/application';
import { latestEligibilityDecision, type CongregationPerson } from '@eutaktos/domain';
import { requireCapability, resolvePrincipal } from '../../_auth';
import type { EntityRow } from '../../_db';
import { BadRequestError, runEndpoint } from '../../_endpoint';
import { json, methodNotAllowed, type ApiHandler, type ApiRequest } from '../../_types';

export type HourglassPreviewReasonCode = 'DISPLAY_NAME_DIFFERS' | 'EXPLICIT_ELIGIBILITY_DIFFERS';

export interface HourglassPreviewResponsePerson {
  readonly displayName: string;
  readonly action: 'create' | 'unchanged' | 'conflict';
  readonly linked: boolean;
  readonly reasonCodes: readonly HourglassPreviewReasonCode[];
  readonly explicitAssignmentTypeIds: readonly string[];
}

export interface HourglassPreviewResponse {
  readonly matchingPolicy: 'tenant-scoped-external-id-only';
  readonly counts: Readonly<Record<'create' | 'unchanged' | 'conflict', number>>;
  readonly report: Readonly<HourglassImportInspection['report']>;
  readonly persons: readonly HourglassPreviewResponsePerson[];
}

function requestInspection(request: Pick<ApiRequest, 'body'>): Readonly<HourglassImportInspection> {
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestError('Hourglass preview body is required');
  const record = body as Readonly<Record<string, unknown>>;
  const allowed = new Set(['source', 'payload']);
  if (Object.keys(record).some(key => !allowed.has(key))) throw new BadRequestError('Unknown Hourglass preview field');
  if (record.source !== 'json') throw new BadRequestError('Only the proven Hourglass JSON source supports reconciliation preview');
  if (!record.payload || typeof record.payload !== 'object' || Array.isArray(record.payload)) throw new BadRequestError('Hourglass JSON payload is required');
  const serialized = JSON.stringify(record.payload);
  const bytes = new TextEncoder().encode(serialized).byteLength;
  try {
    return inspectHourglassJsonExport(record.payload, bytes);
  } catch (error) {
    throw new BadRequestError(error instanceof Error ? error.message : 'Invalid Hourglass JSON payload');
  }
}

function storedPerson(row: EntityRow, tenantId: string): Readonly<CongregationPerson> {
  if (row.tenant_id !== tenantId || !row.data || typeof row.data !== 'object' || Array.isArray(row.data)) throw new Error('Invalid stored Hourglass person');
  const data = row.data as Readonly<Record<string, unknown>>;
  if (data.id !== row.entity_id || data.tenantId !== tenantId) throw new Error('Invalid stored Hourglass person identity');
  return Object.freeze(structuredClone(data)) as Readonly<CongregationPerson>;
}

function explicitHourglassEligibility(person: Readonly<CongregationPerson>): readonly string[] {
  const ids = [...new Set(person.eligibility.map(decision => decision.assignmentTypeId).filter(id => id.startsWith('hourglass:')))];
  return Object.freeze(ids.filter(id => latestEligibilityDecision(person.eligibility, id)?.enabled === true).sort());
}

export function existingHourglassPeople(tenantId: string, people: readonly Readonly<CongregationPerson>[]): readonly ExistingHourglassPerson[] {
  const rows: ExistingHourglassPerson[] = [];
  for (const person of people) {
    if (person.tenantId !== tenantId) continue;
    for (const externalId of person.externalIds ?? []) {
      if (!externalId.startsWith(HOURGLASS_EXTERNAL_ID_PREFIX)) continue;
      rows.push(Object.freeze({
        tenantId,
        externalId,
        personId: person.id,
        displayName: person.displayName,
        active: person.active,
        explicitAssignmentTypeIds: explicitHourglassEligibility(person),
      }));
    }
  }
  return Object.freeze(rows);
}

function reasonCode(reason: string): HourglassPreviewReasonCode {
  if (reason === 'Display name differs from the existing Eutaktos person') return 'DISPLAY_NAME_DIFFERS';
  if (reason === 'Explicit eligibility differs from the Hourglass import') return 'EXPLICIT_ELIGIBILITY_DIFFERS';
  throw new Error('Unknown Hourglass preview reason');
}

export function buildHourglassPreviewResponse(
  inspection: Readonly<HourglassImportInspection>,
  tenantId: string,
  people: readonly Readonly<CongregationPerson>[],
): Readonly<HourglassPreviewResponse> {
  const preview = previewHourglassImport(inspection, tenantId, existingHourglassPeople(tenantId, people));
  return Object.freeze({
    matchingPolicy: 'tenant-scoped-external-id-only',
    counts: preview.counts,
    report: preview.report,
    persons: Object.freeze(preview.persons.map(person => Object.freeze({
      displayName: person.displayName,
      action: person.action,
      linked: Boolean(person.targetPersonId),
      reasonCodes: Object.freeze(person.reasons.map(reasonCode)),
      explicitAssignmentTypeIds: person.explicitAssignmentTypeIds,
    }))),
  });
}

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'POST') { methodNotAllowed(response, ['POST']); return; }
  await runEndpoint(request, response, async database => {
    const principal = await resolvePrincipal(request, database);
    requireCapability(principal, 'people.read');
    requireCapability(principal, 'eligibility.read');
    const inspection = requestInspection(request);
    const rows = await database.entities(principal.tenantId, 'person');
    const people = Object.freeze(rows.map(row => storedPerson(row, principal.tenantId)));
    json(response, 200, buildHourglassPreviewResponse(inspection, principal.tenantId, people));
  }, { maxBodyBytes: HOURGLASS_IMPORT_LIMITS.maxJsonBytes + 1024 });
};

export default handler;
