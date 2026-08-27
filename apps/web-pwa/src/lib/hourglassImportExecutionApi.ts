import { parseHourglassPreviewResponse, type HourglassPreviewDto } from './hourglassImportPreviewApi';

export interface HourglassPreparedExecutionDto {
  readonly executionId: string;
  readonly expiresAt: string;
  readonly confirmationDigest: string;
  readonly counts: Readonly<Record<'create' | 'unchanged' | 'conflict', number>>;
  readonly canExecute: boolean;
  readonly preview: HourglassPreviewDto;
}

export interface HourglassExecutionResultDto {
  readonly outcome: 'applied' | 'already-applied';
  readonly migrationId?: string;
  readonly createdCount: number;
  readonly unchangedCount: number;
}

export interface HourglassRollbackResultDto {
  readonly outcome: 'rolled-back' | 'already-rolled-back';
  readonly migrationId: string;
  readonly removedCount: number;
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Hourglass execution response');
  return value as Readonly<Record<string, unknown>>;
}
function exact(value: unknown, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error('Invalid Hourglass execution response');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid Hourglass execution response');
  return value;
}

export function parseHourglassPreparedExecutionResponse(value: unknown): HourglassPreparedExecutionDto {
  const root = record(value);
  if (root.contractVersion !== 'hourglass-execution-prepare-v1' || typeof root.canExecute !== 'boolean') throw new Error('Invalid Hourglass execution response');
  const counts = record(root.counts);
  const prepared = Object.freeze({
    executionId: exact(root.executionId, /^hourglass-execution-[0-9a-f]{32}$/),
    expiresAt: exact(root.expiresAt, /^\d{4}-\d{2}-\d{2}T/),
    confirmationDigest: exact(root.confirmationDigest, /^[0-9a-f]{64}$/),
    counts: Object.freeze({ create: count(counts.create), unchanged: count(counts.unchanged), conflict: count(counts.conflict) }),
    canExecute: root.canExecute,
    preview: parseHourglassPreviewResponse(root.preview),
  });
  if (prepared.canExecute !== (prepared.counts.conflict === 0)) throw new Error('Invalid Hourglass execution response');
  return prepared;
}

export function parseHourglassExecutionResultResponse(value: unknown): HourglassExecutionResultDto {
  const root = record(value);
  if (root.contractVersion !== 'hourglass-execution-result-v1' || (root.outcome !== 'applied' && root.outcome !== 'already-applied')) throw new Error('Invalid Hourglass execution response');
  const migrationId = root.migrationId === undefined ? undefined : exact(root.migrationId, /^hourglass-migration-[0-9a-f]{32}$/);
  return Object.freeze({ outcome: root.outcome, ...(migrationId ? { migrationId } : {}), createdCount: count(root.createdCount), unchangedCount: count(root.unchangedCount) });
}

export function parseHourglassRollbackResultResponse(value: unknown): HourglassRollbackResultDto {
  const root = record(value);
  if (root.contractVersion !== 'hourglass-rollback-result-v1' || (root.outcome !== 'rolled-back' && root.outcome !== 'already-rolled-back')) throw new Error('Invalid Hourglass execution response');
  return Object.freeze({ outcome: root.outcome, migrationId: exact(root.migrationId, /^hourglass-migration-[0-9a-f]{32}$/), removedCount: count(root.removedCount) });
}

export class HourglassExecutionApiError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Hourglass execution request failed (${status})`);
    this.name = 'HourglassExecutionApiError';
    this.status = status;
  }
}

async function post(fetcher: typeof fetch, path: string, body: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<unknown> {
  const response = await fetcher(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('Invalid Hourglass execution response'); }
  if (!response.ok) throw new HourglassExecutionApiError(response.status);
  return value;
}

export function createHourglassImportExecutionApi(fetcher: typeof fetch = fetch) {
  return Object.freeze({
    async prepare(payload: unknown, mutationId: string, signal?: AbortSignal): Promise<HourglassPreparedExecutionDto> {
      return parseHourglassPreparedExecutionResponse(await post(fetcher, '/api/import/hourglass/prepare', { source: 'json', payload, mutationId }, signal));
    },
    async execute(payload: unknown, executionId: string, confirmationDigest: string, signal?: AbortSignal): Promise<HourglassExecutionResultDto> {
      return parseHourglassExecutionResultResponse(await post(fetcher, '/api/import/hourglass/execute', { source: 'json', payload, executionId, confirmationDigest }, signal));
    },
    async rollback(migrationId: string, signal?: AbortSignal): Promise<HourglassRollbackResultDto> {
      return parseHourglassRollbackResultResponse(await post(fetcher, '/api/import/hourglass/rollback', { migrationId }, signal));
    },
  });
}

export const hourglassImportExecutionApi = Object.freeze({
  prepare(payload: unknown, mutationId: string, signal?: AbortSignal): Promise<HourglassPreparedExecutionDto> {
    return createHourglassImportExecutionApi(globalThis.fetch.bind(globalThis)).prepare(payload, mutationId, signal);
  },
  execute(payload: unknown, executionId: string, confirmationDigest: string, signal?: AbortSignal): Promise<HourglassExecutionResultDto> {
    return createHourglassImportExecutionApi(globalThis.fetch.bind(globalThis)).execute(payload, executionId, confirmationDigest, signal);
  },
  rollback(migrationId: string, signal?: AbortSignal): Promise<HourglassRollbackResultDto> {
    return createHourglassImportExecutionApi(globalThis.fetch.bind(globalThis)).rollback(migrationId, signal);
  },
});
