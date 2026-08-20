import type { TenantId, PersonId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type NoticeId = string;
export type NoticeAcknowledgementId = string;

export interface ImportantNotice {
  readonly id: NoticeId;
  readonly tenantId: TenantId;
  readonly title: string;
  readonly body: string;
  readonly publishedAt: string;
}

export interface NoticeAcknowledgement {
  readonly id: NoticeAcknowledgementId;
  readonly tenantId: TenantId;
  readonly noticeId: NoticeId;
  readonly personId: PersonId;
  readonly readAt: string | null;
  readonly acknowledgedAt: string | null;
  readonly createdAt: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

// ── Construction ───────────────────────────────────────────────────────────

export function createImportantNotice(input: {
  id: NoticeId;
  tenantId: TenantId;
  title: string;
  body: string;
  publishedAt: string;
}): Readonly<ImportantNotice> {
  const id = required(input.id, 'noticeId');
  const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title');
  const body = required(input.body, 'body');
  validateInstant(input.publishedAt);

  if (title.length > 500) throw new Error('title is too long (max 500)');
  if (body.length > 10000) throw new Error('body is too long (max 10000)');

  return Object.freeze({ id, tenantId, title, body, publishedAt: input.publishedAt });
}

export function createNoticeAcknowledgement(input: {
  id: NoticeAcknowledgementId;
  tenantId: TenantId;
  noticeId: NoticeId;
  personId: PersonId;
  now: string;
}): Readonly<NoticeAcknowledgement> {
  return Object.freeze({
    id: required(input.id, 'ackId'),
    tenantId: required(input.tenantId, 'tenantId'),
    noticeId: required(input.noticeId, 'noticeId'),
    personId: required(input.personId, 'personId'),
    readAt: null,
    acknowledgedAt: null,
    createdAt: input.now,
  });
}

// ── Read / Ack (idempotent) ────────────────────────────────────────────────

export function markNoticeRead(
  ack: Readonly<NoticeAcknowledgement>,
  now: string,
): Readonly<NoticeAcknowledgement> {
  validateInstant(now);
  // Idempotent: if already read, return unchanged
  if (ack.readAt !== null) return ack;
  return Object.freeze({ ...ack, readAt: now });
}

export function acknowledgeNotice(
  ack: Readonly<NoticeAcknowledgement>,
  now: string,
): Readonly<NoticeAcknowledgement> {
  validateInstant(now);
  // Idempotent: if already acknowledged, return unchanged
  if (ack.acknowledgedAt !== null) return ack;
  // Acknowledging implies reading
  return Object.freeze({ ...ack, readAt: ack.readAt ?? now, acknowledgedAt: now });
}

// ── Queries ────────────────────────────────────────────────────────────────

export function isNoticeRead(ack: Readonly<NoticeAcknowledgement>): boolean {
  return ack.readAt !== null;
}

export function isNoticeAcknowledged(ack: Readonly<NoticeAcknowledgement>): boolean {
  return ack.acknowledgedAt !== null;
}

// ── Tenant isolation ───────────────────────────────────────────────────────

export function assertNoticeTenant(notice: Readonly<ImportantNotice>, tenantId: TenantId): void {
  if (notice.tenantId !== tenantId) throw new Error('Cross-tenant notice access denied');
}

export function assertAckTenant(ack: Readonly<NoticeAcknowledgement>, tenantId: TenantId): void {
  if (ack.tenantId !== tenantId) throw new Error('Cross-tenant acknowledgement access denied');
}

export function filterAcksByTenant(
  acks: readonly Readonly<NoticeAcknowledgement>[],
  tenantId: TenantId,
): readonly Readonly<NoticeAcknowledgement>[] {
  return acks.filter(a => a.tenantId === tenantId);
}

export function findAckForPerson(
  acks: readonly Readonly<NoticeAcknowledgement>[],
  tenantId: TenantId,
  noticeId: NoticeId,
  personId: PersonId,
): Readonly<NoticeAcknowledgement> | undefined {
  return acks.find(a =>
    a.tenantId === tenantId && a.noticeId === noticeId && a.personId === personId,
  );
}

// ── Normalization ──────────────────────────────────────────────────────────

export function normalizeImportantNotice(input: ImportantNotice): Readonly<ImportantNotice> {
  required(input.id, 'noticeId');
  required(input.tenantId, 'tenantId');
  required(input.title, 'title');
  required(input.body, 'body');
  validateInstant(input.publishedAt);
  if (input.title.length > 500) throw new Error('title is too long (max 500)');
  if (input.body.length > 10000) throw new Error('body is too long (max 10000)');
  return Object.freeze({ ...input });
}

export function normalizeNoticeAcknowledgement(input: NoticeAcknowledgement): Readonly<NoticeAcknowledgement> {
  required(input.id, 'ackId');
  required(input.tenantId, 'tenantId');
  required(input.noticeId, 'noticeId');
  required(input.personId, 'personId');
  validateInstant(input.createdAt);
  if (input.readAt !== null) validateInstant(input.readAt);
  if (input.acknowledgedAt !== null) validateInstant(input.acknowledgedAt);
  return Object.freeze({ ...input });
}
