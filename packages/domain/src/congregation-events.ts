import type { TenantId } from './people';

export type CongregationEventId = string;

export interface CongregationEvent {
  readonly id: CongregationEventId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly description: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly location: string;
  readonly url: string | null;
  readonly visibilityFrom: string | null;
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

function isValidUrl(url: string): boolean {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
}

export function createCongregationEvent(input: {
  id: CongregationEventId; tenantId: TenantId; title: string; description: string;
  startsAt: string; endsAt: string; location: string; url?: string | null;
  visibilityFrom?: string | null; now: string;
}): Readonly<CongregationEvent> {
  validateInstant(input.now); validateInstant(input.startsAt); validateInstant(input.endsAt);
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error('endsAt must be after startsAt');
  const title = required(input.title, 'title');
  if (title.length > 300) throw new Error('title is too long (max 300)');
  const desc = required(input.description, 'description');
  if (desc.length > 5000) throw new Error('description is too long (max 5000)');
  const location = required(input.location, 'location');
  if (location.length > 500) throw new Error('location is too long (max 500)');
  let url: string | null = null;
  if (input.url !== undefined && input.url !== null && input.url !== '') {
    if (!isValidUrl(input.url)) throw new Error('Invalid URL: must be http/https');
    url = input.url;
  }
  let visibilityFrom: string | null = null;
  if (input.visibilityFrom !== undefined && input.visibilityFrom !== null && input.visibilityFrom !== '') {
    validateInstant(input.visibilityFrom);
    visibilityFrom = input.visibilityFrom;
  }

  return Object.freeze({
    id: required(input.id, 'eventId'), tenantId: required(input.tenantId, 'tenantId'),
    title, description: desc, startsAt: input.startsAt, endsAt: input.endsAt,
    location, url, visibilityFrom, createdAt: input.now,
  });
}

export function assertCongregationEventTenant(event: Readonly<CongregationEvent>, tenantId: TenantId): void {
  if (event.tenantId !== tenantId) throw new Error('Cross-tenant event access denied');
}

export function normalizeCongregationEvent(input: CongregationEvent): Readonly<CongregationEvent> {
  required(input.id, 'eventId'); required(input.tenantId, 'tenantId');
  required(input.title, 'title'); required(input.description, 'description');
  validateInstant(input.startsAt); validateInstant(input.endsAt); validateInstant(input.createdAt);
  if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) throw new Error('endsAt must be after startsAt');
  if (input.url !== null && !isValidUrl(input.url)) throw new Error('Invalid URL');
  return Object.freeze({ ...input });
}
