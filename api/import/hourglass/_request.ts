import { inspectHourglassJsonExport, type HourglassImportInspection } from '@eutaktos/application';
import { BadRequestError, exactKeys, requestBody, requiredString } from '../../_endpoint';
import type { ApiRequest } from '../../_types';

export interface HourglassPrepareRequest {
  readonly inspection: Readonly<HourglassImportInspection>;
  readonly mutationId: string;
}

export interface HourglassExecuteRequest {
  readonly inspection: Readonly<HourglassImportInspection>;
  readonly executionId: string;
}

function inspection(body: Readonly<Record<string, unknown>>): Readonly<HourglassImportInspection> {
  if (body.source !== 'json') throw new BadRequestError('Only the proven Hourglass JSON source supports execution');
  if (!body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload)) throw new BadRequestError('Hourglass JSON payload is required');
  const bytes = new TextEncoder().encode(JSON.stringify(body.payload)).byteLength;
  try { return inspectHourglassJsonExport(body.payload, bytes); }
  catch (error) { throw new BadRequestError(error instanceof Error ? error.message : 'Invalid Hourglass JSON payload'); }
}

function opaque(value: string, name: string, pattern: RegExp): string {
  if (!pattern.test(value)) throw new BadRequestError(`${name} is invalid`);
  return value;
}

export function parseHourglassPrepareRequest(request: Pick<ApiRequest, 'query' | 'body'>): Readonly<HourglassPrepareRequest> {
  if (Object.keys(request.query).length) throw new BadRequestError('Hourglass prepare does not accept query fields');
  const body = requestBody(request.body);
  exactKeys(body, ['source', 'payload', 'mutationId']);
  const mutationId = opaque(requiredString(body, 'mutationId', 120), 'mutationId', /^[A-Za-z0-9._~-]{8,120}$/);
  return Object.freeze({ inspection: inspection(body), mutationId });
}

export function parseHourglassExecuteRequest(request: Pick<ApiRequest, 'query' | 'body'>): Readonly<HourglassExecuteRequest> {
  if (Object.keys(request.query).length) throw new BadRequestError('Hourglass execute does not accept query fields');
  const body = requestBody(request.body);
  exactKeys(body, ['source', 'payload', 'executionId']);
  const executionId = opaque(requiredString(body, 'executionId', 80), 'executionId', /^hourglass-execution-[0-9a-f]{32}$/);
  return Object.freeze({ inspection: inspection(body), executionId });
}

export function parseHourglassRollbackRequest(request: Pick<ApiRequest, 'query' | 'body'>): string {
  if (Object.keys(request.query).length) throw new BadRequestError('Hourglass rollback does not accept query fields');
  const body = requestBody(request.body);
  exactKeys(body, ['migrationId']);
  return opaque(requiredString(body, 'migrationId', 80), 'migrationId', /^hourglass-migration-[0-9a-f]{32}$/);
}
