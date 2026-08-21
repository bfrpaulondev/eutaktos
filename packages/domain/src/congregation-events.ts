import type { TenantId } from './people';

export type CongregationEventId = string;
export interface CongregationEvent {
  readonly id: CongregationEventId; readonly tenantId: TenantId; readonly title: string;
  readonly description: string; readonly startsAt: string; readonly endsAt: string;
  readonly location: string; readonly url: string | null; readonly visibilityFrom: string | null;
  readonly createdAt: string;
}
function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function normalizeUrl(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  try {
    const url = new URL(value);
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password) throw new Error('invalid');
    return url.toString();
  } catch { throw new Error('Invalid URL: must be credential-free http/https'); }
}
function validateText(title: string, description: string, location: string): void {
  if (title.length > 300) throw new Error('title is too long (max 300)');
  if (description.length > 5000) throw new Error('description is too long (max 5000)');
  if (location.length > 500) throw new Error('location is too long (max 500)');
}
function normalizeVisibility(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  validateInstant(value); return value;
}
function validateWindow(startsAt: string, endsAt: string): void {
  validateInstant(startsAt); validateInstant(endsAt);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('endsAt must be after startsAt');
}
export function createCongregationEvent(input: {
  id: CongregationEventId; tenantId: TenantId; title: string; description: string;
  startsAt: string; endsAt: string; location: string; url?: string | null;
  visibilityFrom?: string | null; now: string;
}): Readonly<CongregationEvent> {
  validateInstant(input.now); validateWindow(input.startsAt, input.endsAt);
  const title = required(input.title, 'title'); const description = required(input.description, 'description');
  const location = required(input.location, 'location'); validateText(title, description, location);
  return Object.freeze({
    id: required(input.id, 'eventId'), tenantId: required(input.tenantId, 'tenantId'), title, description,
    startsAt: input.startsAt, endsAt: input.endsAt, location, url: normalizeUrl(input.url),
    visibilityFrom: normalizeVisibility(input.visibilityFrom), createdAt: input.now,
  });
}
export function assertCongregationEventTenant(event: Readonly<CongregationEvent>, tenantId: TenantId): void {
  if (event.tenantId !== tenantId) throw new Error('Cross-tenant event access denied');
}
export function normalizeCongregationEvent(input: CongregationEvent): Readonly<CongregationEvent> {
  const id = required(input.id, 'eventId'); const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title'); const description = required(input.description, 'description');
  const location = required(input.location, 'location'); validateText(title, description, location);
  validateWindow(input.startsAt, input.endsAt); validateInstant(input.createdAt);
  const visibilityFrom = normalizeVisibility(input.visibilityFrom); const url = normalizeUrl(input.url);
  return Object.freeze({ ...input, id, tenantId, title, description, location, url, visibilityFrom });
}
