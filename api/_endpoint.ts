declare const process: { env: Record<string, string | undefined> };

import { AuthenticationError, AuthorizationError } from './_auth';
import { DatabaseNotConfiguredError, DatabaseRequestError, SupabaseRestDatabase } from './_db';
import { header, json, type ApiRequest, type ApiResponse } from './_types';

export class BadRequestError extends Error {}
export class CsrfError extends Error {}

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
): Promise<void> {
  const database = new SupabaseRestDatabase();
  try {
    await operation(database);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      json(response, 401, { error: 'Unauthorized' });
      return;
    }
    if (error instanceof AuthorizationError || error instanceof CsrfError) {
      json(response, 403, { error: 'Forbidden' });
      return;
    }
    if (error instanceof BadRequestError) {
      json(response, 400, { error: error.message });
      return;
    }
    if (error instanceof DatabaseNotConfiguredError) {
      json(response, 503, { error: 'Service unavailable' });
      return;
    }
    if (error instanceof DatabaseRequestError) {
      json(response, 503, { error: 'Service temporarily unavailable' });
      return;
    }
    json(response, 500, { error: 'Internal server error' });
  }
}
