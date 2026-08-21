import type { TenantId } from './people';
// Display window classification is inlined here — M17 display-window.ts provides the shared utility.
// The import below is used only for type reference.
// The actual classification logic for announcements uses classifyStatus/classifyAnnouncement below.

export type AnnouncementId = string;

export type AnnouncementStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'archived';

export const ANNOUNCEMENT_STATUSES: readonly AnnouncementStatus[] = Object.freeze([
  'draft', 'scheduled', 'active', 'expired', 'archived',] as const);

export interface Announcement {
  readonly id: AnnouncementId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly body: string;
  readonly audienceKey: string;
  readonly displayFrom: string | null;
  readonly expiresAt: string | null;
  readonly status: AnnouncementStatus;
  readonly createdAt: string;
}

function required(v: string, f: string): string { const n = v.trim(); if (!n) throw new Error(`${f} is required`); return n; }
function validateInstant(v: string): void { if (!Number.isFinite(Date.parse(v))) throw new Error(`Invalid ISO date: ${v}`); }

export function createAnnouncement(input: {
  id: AnnouncementId; tenantId: TenantId; title: string; body: string;
  audienceKey: string; displayFrom?: string | null; expiresAt?: string | null; now: string;
}): Readonly<Announcement> {
  validateInstant(input.now);
  const title = required(input.title, 'title');
  if (title.length > 300) throw new Error('title is too long (max 300)');
  const body = required(input.body, 'body');
  if (body.length > 10000) throw new Error('body is too long (max 10000)');
  let displayFrom: string | null = null;
  if (input.displayFrom != null && input.displayFrom !== '') { validateInstant(input.displayFrom); displayFrom = input.displayFrom; }
  let expiresAt: string | null = null;
  if (input.expiresAt != null && input.expiresAt !== '') { validateInstant(input.expiresAt); expiresAt = input.expiresAt; }

  const status = classifyStatus(displayFrom, expiresAt);

  return Object.freeze({
    id: required(input.id, 'announcementId'), tenantId: required(input.tenantId, 'tenantId'),
    title, body, audienceKey: required(input.audienceKey, 'audienceKey'),
    displayFrom, expiresAt, status, createdAt: input.now,
  });
}

function classifyStatus(displayFrom: string | null, expiresAt: string | null): AnnouncementStatus {
  const now = Date.now();
  if (displayFrom === null && expiresAt === null) return 'draft';
  if (displayFrom !== null && Date.parse(displayFrom) > now) return 'scheduled';
  if (displayFrom !== null && expiresAt !== null && Date.parse(expiresAt) <= now) return 'expired';
  return 'active';
}

export function classifyAnnouncement(
  announcement: Readonly<Announcement>,
  at?: string,
): AnnouncementStatus {
  if (announcement.status === 'draft' || announcement.status === 'archived') return announcement.status;
  const ts = at ? Date.parse(at) : Date.now();
  const df = announcement.displayFrom;
  const ex = announcement.expiresAt;
  if (df !== null && Date.parse(df) > ts) return 'scheduled';
  if (ex !== null && Date.parse(ex) <= ts) return 'expired';
  return 'active';
}

export function archiveAnnouncement(
  announcement: Readonly<Announcement>,
): Readonly<Announcement> {
  return Object.freeze({ ...announcement, status: 'archived' });
}

export function assertAnnouncementTenant(a: Readonly<Announcement>, tenantId: TenantId): void {
  if (a.tenantId !== tenantId) throw new Error('Cross-tenant announcement access denied');
}

export function normalizeAnnouncement(input: Announcement): Readonly<Announcement> {
  required(input.id, 'announcementId'); required(input.tenantId, 'tenantId');
  required(input.title, 'title'); required(input.body, 'body');
  validateInstant(input.createdAt);
  if (!ANNOUNCEMENT_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
 if (input.displayFrom !== null) validateInstant(input.displayFrom);
  if (input.expiresAt !== null) validateInstant(input.expiresAt);
  return Object.freeze({ ...input });
}
