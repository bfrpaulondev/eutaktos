import type { TenantId } from './people';
import { classifyDisplayWindow, validateDisplayWindow } from './display-window';

export type AnnouncementId = string;
export type AnnouncementStatus = 'draft' | 'scheduled' | 'active' | 'expired' | 'archived';

export const ANNOUNCEMENT_STATUSES: readonly AnnouncementStatus[] = Object.freeze([
  'draft', 'scheduled', 'active', 'expired', 'archived',
] as const);

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

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new Error(`Invalid ISO date: ${String(value)}`);
  }
}

function optionalInstant(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  validateInstant(value);
  return value;
}

function statusForWindow(
  displayFrom: string | null,
  expiresAt: string | null,
  at: string,
): AnnouncementStatus {
  if (displayFrom === null && expiresAt === null) return 'draft';
  const classification = classifyDisplayWindow({ displayFrom, expiresAt }, at);
  return classification === 'upcoming' ? 'scheduled' : classification;
}

function validateContent(title: string, body: string, audienceKey: string): void {
  if (title.length > 300) throw new Error('title is too long (max 300)');
  if (body.length > 10000) throw new Error('body is too long (max 10000)');
  if (audienceKey.length > 100) throw new Error('audienceKey is too long (max 100)');
}

export function createAnnouncement(input: {
  id: AnnouncementId;
  tenantId: TenantId;
  title: string;
  body: string;
  audienceKey: string;
  displayFrom?: string | null;
  expiresAt?: string | null;
  now: string;
}): Readonly<Announcement> {
  validateInstant(input.now);
  const title = required(input.title, 'title');
  const body = required(input.body, 'body');
  const audienceKey = required(input.audienceKey, 'audienceKey');
  validateContent(title, body, audienceKey);
  const displayFrom = optionalInstant(input.displayFrom, 'displayFrom');
  const expiresAt = optionalInstant(input.expiresAt, 'expiresAt');
  validateDisplayWindow({ displayFrom, expiresAt });

  return Object.freeze({
    id: required(input.id, 'announcementId'),
    tenantId: required(input.tenantId, 'tenantId'),
    title,
    body,
    audienceKey,
    displayFrom,
    expiresAt,
    status: statusForWindow(displayFrom, expiresAt, input.now),
    createdAt: input.now,
  });
}

export function classifyAnnouncement(
  announcement: Readonly<Announcement>,
  at?: string,
): AnnouncementStatus {
  if (announcement.status === 'archived') return 'archived';
  if (announcement.displayFrom === null && announcement.expiresAt === null) return 'draft';
  const effectiveAt = at ?? new Date().toISOString();
  validateInstant(effectiveAt);
  return statusForWindow(announcement.displayFrom, announcement.expiresAt, effectiveAt);
}

export function archiveAnnouncement(announcement: Readonly<Announcement>): Readonly<Announcement> {
  if (announcement.status === 'archived') return announcement;
  return Object.freeze({ ...announcement, status: 'archived' });
}

export function assertAnnouncementTenant(announcement: Readonly<Announcement>, tenantId: TenantId): void {
  if (announcement.tenantId !== tenantId) throw new Error('Cross-tenant announcement access denied');
}

export function normalizeAnnouncement(input: Announcement): Readonly<Announcement> {
  const id = required(input.id, 'announcementId');
  const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title');
  const body = required(input.body, 'body');
  const audienceKey = required(input.audienceKey, 'audienceKey');
  validateContent(title, body, audienceKey);
  validateInstant(input.createdAt);
  if (!ANNOUNCEMENT_STATUSES.includes(input.status)) throw new Error(`Invalid status: ${input.status}`);
  const displayFrom = optionalInstant(input.displayFrom, 'displayFrom');
  const expiresAt = optionalInstant(input.expiresAt, 'expiresAt');
  validateDisplayWindow({ displayFrom, expiresAt });
  if (input.status === 'draft' && (displayFrom !== null || expiresAt !== null)) {
    throw new Error('draft announcements cannot have an active display window');
  }
  return Object.freeze({ ...input, id, tenantId, title, body, audienceKey, displayFrom, expiresAt });
}
