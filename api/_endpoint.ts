declare const process: { env: Record<string, string | undefined> };

import { AuthenticationError, AuthorizationError } from './_auth';
import { DatabaseNotConfiguredError, DatabaseRequestError, SupabaseRestDatabase } from './_db';
import { attachCorrelationId, logRequestFailure, logRequestSuccess } from './_observability';
import { header, json, type ApiRequest, type ApiResponse } from './_types';

export class BadRequestError extends Error {}
export class CsrfError extends Error {}
export class PayloadTooLargeError extends Error {}

const DEFAULT_MAX_BODY_BYTES = 64 * 1024;
const ABSOLUTE_MAX_BODY_BYTES = 6 * 1024 * 1024;

export interface RequestEnvelopeOptions { readonly maxBodyBytes?: number }

function bodyBytes(value: unknown): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'string') return new TextEncoder().encode(value).byteLength;
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength; }
  catch { throw new BadRequestError('Invalid request body'); }
}

function bodyLimit(options: RequestEnvelopeOptions): number {
  const value = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  if (!Number.isSafeInteger(value) || value <= 0 || value > ABSOLUTE_MAX_BODY_BYTES) throw new Error('Invalid request body limit');
  return value;
}

export function assertRequestEnvelope(request: ApiRequest, options: RequestEnvelopeOptions = {}): void {
  const maxBodyBytes = bodyLimit(options);
  const rawLength = header(request, 'content-length');
  if (rawLength !== undefined) {
    if (!/^\d{1,10}$/.test(rawLength)) throw new BadRequestError('Invalid Content-Length');
    const contentLength = Number(rawLength);
    if (!Number.isSafeInteger(contentLength)) throw new BadRequestError('Invalid Content-Length');
    if (contentLength > maxBodyBytes) throw new PayloadTooLargeError('Request body too large');
  }
  if (bodyBytes(request.body) > maxBodyBytes) throw new PayloadTooLargeError('Request body too large');
}

export function requestBody(value: unknown): Readonly<Record<string, unknown>> {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); }
    catch { throw new BadRequestError('Invalid JSON body'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new BadRequestError('Request body must be an object');
  return parsed as Readonly<Record<string, unknown>>;
}

export function exactKeys(body: Readonly<Record<string, unknown>>, allowed: readonly string[]): void {
  const set = new Set(allowed);
  if (Object.keys(body).some(key => !set.has(key))) throw new BadRequestError('Unknown request field');
}

export function requiredString(body: Readonly<Record<string, unknown>>, name: string, maxLength = 250): string {
  const value = body[name];
  if (typeof value !== 'string') throw new BadRequestError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new BadRequestError(`${name} is required`);
  if (normalized.length > maxLength) throw new BadRequestError(`${name} is too long`);
  return normalized;
}

export function optionalString(body: Readonly<Record<string, unknown>>, name: string, maxLength = 250): string | undefined {
  if (body[name] === undefined) return undefined;
  return requiredString(body, name, maxLength);
}

export function stringArray(body: Readonly<Record<string, unknown>>, name: string, maxItems = 1000): readonly string[] {
  const value = body[name];
  if (!Array.isArray(value) || value.length > maxItems) throw new BadRequestError(`${name} must be an array`);
  const items = value.map((item, index) => {
    if (typeof item !== 'string') throw new BadRequestError(`${name}[${index}] must be a string`);
    const normalized = item.trim();
    if (!normalized || normalized.length > 200) throw new BadRequestError(`${name}[${index}] is invalid`);
    return normalized;
  });
  if (new Set(items).size !== items.length) throw new BadRequestError(`${name} contains duplicates`);
  return Object.freeze(items);
}

export function assertTrustedMutation(request: ApiRequest): void {
  const configured = process.env.EUTAKTOS_PUBLIC_ORIGIN?.trim();
  if (!configured) throw new DatabaseNotConfiguredError();
  let trusted: URL;
  try { trusted = new URL(configured); }
  catch { throw new DatabaseNotConfiguredError(); }
  if (trusted.protocol !== 'https:') throw new DatabaseNotConfiguredError();

  const origin = header(request, 'origin');
  const secFetchSite = header(request, 'sec-fetch-site');
  if (!origin || secFetchSite !== 'same-origin') throw new CsrfError('Forbidden');
  let received: URL;
  try { received = new URL(origin); }
  catch { throw new CsrfError('Forbidden'); }
  if (received.origin !== trusted.origin) throw new CsrfError('Forbidden');
}

export async function runEndpoint(
  request: ApiRequest,
  response: ApiResponse,
  operation: (database: SupabaseRestDatabase) => Promise<void>,
  options: RequestEnvelopeOptions = {},
): Promise<void> {
  const startedAt = Date.now();
  const correlationId = attachCorrelationId(request, response);
  const database = new SupabaseRestDatabase();
  try {
    assertRequestEnvelope(request, options);
    await operation(database);
    logRequestSuccess(request, correlationId, startedAt);
  } catch (error) {
    let status = 500;
    let body: Readonly<Record<string, string>> = { error: 'Internal server error' };
    if (error instanceof AuthenticationError) {
      status = 401; body = { error: 'Unauthorized' };
    } else if (error instanceof AuthorizationError || error instanceof CsrfError) {
      status = 403; body = { error: 'Forbidden' };
    } else if (error instanceof PayloadTooLargeError) {
      status = 413; body = { error: 'Request body too large' };
    } else if (error instanceof BadRequestError) {
      status = 400; body = { error: error.message };
    } else if (error instanceof DatabaseNotConfiguredError) {
      status = 503; body = { error: 'Service unavailable' };
    } else if (error instanceof DatabaseRequestError) {
      status = 503; body = { error: 'Service temporarily unavailable' };
    }
    logRequestFailure(request, correlationId, startedAt, error, status);
    json(response, status, body);
  }
}
