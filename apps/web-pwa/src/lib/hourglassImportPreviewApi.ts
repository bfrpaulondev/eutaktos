export type HourglassPreviewReasonCode = 'DISPLAY_NAME_DIFFERS' | 'EXPLICIT_ELIGIBILITY_DIFFERS';
export type HourglassPreviewAction = 'create' | 'unchanged' | 'conflict';

export interface HourglassPreviewPersonDto {
  readonly displayName: string;
  readonly action: HourglassPreviewAction;
  readonly linked: boolean;
  readonly reasonCodes: readonly HourglassPreviewReasonCode[];
  readonly explicitAssignmentTypeIds: readonly string[];
}

export interface HourglassPreviewDto {
  readonly matchingPolicy: 'tenant-scoped-external-id-only';
  readonly counts: Readonly<Record<HourglassPreviewAction, number>>;
  readonly report: Readonly<{
    format: 'hourglass-json-export-v1';
    publisherCount: number;
    groupCount: number;
    explicitPrivilegeCount: number;
    unknownTopLevelSections: readonly string[];
    unknownPublisherFields: readonly string[];
    unknownGroupFields: readonly string[];
    recognizedSections: readonly string[];
  }>;
  readonly persons: readonly HourglassPreviewPersonDto[];
}

const ACTIONS = new Set<HourglassPreviewAction>(['create', 'unchanged', 'conflict']);
const REASONS = new Set<HourglassPreviewReasonCode>(['DISPLAY_NAME_DIFFERS', 'EXPLICIT_ELIGIBILITY_DIFFERS']);

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Hourglass preview response');
  return value as Readonly<Record<string, unknown>>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid Hourglass preview response');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw new Error('Invalid Hourglass preview response');
  return value;
}
function strings(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) throw new Error('Invalid Hourglass preview response');
  return Object.freeze([...value]);
}

export function parseHourglassPreviewResponse(value: unknown): HourglassPreviewDto {
  const root = record(value);
  if (root.matchingPolicy !== 'tenant-scoped-external-id-only' || !Array.isArray(root.persons)) throw new Error('Invalid Hourglass preview response');
  const counts = record(root.counts);
  const report = record(root.report);
  if (report.format !== 'hourglass-json-export-v1') throw new Error('Invalid Hourglass preview response');
  const persons = root.persons.map(item => {
    const person = record(item);
    if (typeof person.action !== 'string' || !ACTIONS.has(person.action as HourglassPreviewAction) || typeof person.linked !== 'boolean' || !Array.isArray(person.reasonCodes)) throw new Error('Invalid Hourglass preview response');
    const reasonCodes = person.reasonCodes.map(code => {
      if (typeof code !== 'string' || !REASONS.has(code as HourglassPreviewReasonCode)) throw new Error('Invalid Hourglass preview response');
      return code as HourglassPreviewReasonCode;
    });
    return Object.freeze({ displayName: text(person.displayName), action: person.action as HourglassPreviewAction, linked: person.linked, reasonCodes: Object.freeze(reasonCodes), explicitAssignmentTypeIds: strings(person.explicitAssignmentTypeIds) });
  });
  const parsedCounts = Object.freeze({ create: count(counts.create), unchanged: count(counts.unchanged), conflict: count(counts.conflict) });
  if (parsedCounts.create + parsedCounts.unchanged + parsedCounts.conflict !== persons.length) throw new Error('Invalid Hourglass preview response');
  return Object.freeze({
    matchingPolicy: 'tenant-scoped-external-id-only',
    counts: parsedCounts,
    report: Object.freeze({
      format: 'hourglass-json-export-v1',
      publisherCount: count(report.publisherCount),
      groupCount: count(report.groupCount),
      explicitPrivilegeCount: count(report.explicitPrivilegeCount),
      unknownTopLevelSections: strings(report.unknownTopLevelSections),
      unknownPublisherFields: strings(report.unknownPublisherFields),
      unknownGroupFields: strings(report.unknownGroupFields),
      recognizedSections: strings(report.recognizedSections),
    }),
    persons: Object.freeze(persons),
  });
}

export class HourglassPreviewApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Hourglass preview request failed (${status})`);
    this.name = 'HourglassPreviewApiError';
    this.status = status;
  }
}

export function createHourglassImportPreviewApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async preview(payload: unknown, signal?: AbortSignal): Promise<HourglassPreviewDto> {
      const response = await fetcher('/api/import/hourglass/preview', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'json', payload }),
        signal,
      });
      let body: unknown;
      try { body = await response.json(); } catch { throw new Error('Invalid Hourglass preview response'); }
      if (!response.ok) throw new HourglassPreviewApiError(response.status);
      return parseHourglassPreviewResponse(body);
    },
  });
}

export const hourglassImportPreviewApi = createHourglassImportPreviewApi();
