import type { TenantId, PersonId } from './people';

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

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}
function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
function validateNoticeContent(title: string, body: string): void {
  if (title.length > 500) throw new Error('title is too long (max 500)');
  if (body.length > 10000) throw new Error('body is too long (max 10000)');
}
function assertNotBeforeCreated(ack: Readonly<NoticeAcknowledgement>, now: string): void {
  if (Date.parse(now) < Date.parse(ack.createdAt)) throw new Error('acknowledgement timestamp cannot be before createdAt');
}

export function createImportantNotice(input: {
  id: NoticeId; tenantId: TenantId; title: string; body: string; publishedAt: string;
}): Readonly<ImportantNotice> {
  const title = required(input.title, 'title');
  const body = required(input.body, 'body');
  validateNoticeContent(title, body); validateInstant(input.publishedAt);
  return Object.freeze({
    id: required(input.id, 'noticeId'), tenantId: required(input.tenantId, 'tenantId'),
    title, body, publishedAt: input.publishedAt,
  });
}

export function createNoticeAcknowledgement(input: {
  id: NoticeAcknowledgementId; tenantId: TenantId; noticeId: NoticeId; personId: PersonId; now: string;
}): Readonly<NoticeAcknowledgement> {
  validateInstant(input.now);
  return Object.freeze({
    id: required(input.id, 'ackId'), tenantId: required(input.tenantId, 'tenantId'),
    noticeId: required(input.noticeId, 'noticeId'), personId: required(input.personId, 'personId'),
    readAt: null, acknowledgedAt: null, createdAt: input.now,
  });
}

export function markNoticeRead(ack: Readonly<NoticeAcknowledgement>, now: string): Readonly<NoticeAcknowledgement> {
  validateInstant(now); assertNotBeforeCreated(ack, now);
  if (ack.readAt !== null) return ack;
  return Object.freeze({ ...ack, readAt: now });
}

export function acknowledgeNotice(ack: Readonly<NoticeAcknowledgement>, now: string): Readonly<NoticeAcknowledgement> {
  validateInstant(now); assertNotBeforeCreated(ack, now);
  if (ack.acknowledgedAt !== null) return ack;
  if (ack.readAt !== null && Date.parse(now) < Date.parse(ack.readAt)) throw new Error('acknowledgedAt cannot be before readAt');
  return Object.freeze({ ...ack, readAt: ack.readAt ?? now, acknowledgedAt: now });
}

export function isNoticeRead(ack: Readonly<NoticeAcknowledgement>): boolean { return ack.readAt !== null; }
export function isNoticeAcknowledged(ack: Readonly<NoticeAcknowledgement>): boolean { return ack.acknowledgedAt !== null; }
export function assertNoticeTenant(notice: Readonly<ImportantNotice>, tenantId: TenantId): void {
  if (notice.tenantId !== tenantId) throw new Error('Cross-tenant notice access denied');
}
export function assertAckTenant(ack: Readonly<NoticeAcknowledgement>, tenantId: TenantId): void {
  if (ack.tenantId !== tenantId) throw new Error('Cross-tenant acknowledgement access denied');
}
export function filterAcksByTenant(acks: readonly Readonly<NoticeAcknowledgement>[], tenantId: TenantId) {
  return acks.filter((ack) => ack.tenantId === tenantId);
}
export function findAckForPerson(
  acks: readonly Readonly<NoticeAcknowledgement>[], tenantId: TenantId, noticeId: NoticeId, personId: PersonId,
) {
  return acks.find((ack) => ack.tenantId === tenantId && ack.noticeId === noticeId && ack.personId === personId);
}

export function normalizeImportantNotice(input: ImportantNotice): Readonly<ImportantNotice> {
  const id = required(input.id, 'noticeId'); const tenantId = required(input.tenantId, 'tenantId');
  const title = required(input.title, 'title'); const body = required(input.body, 'body');
  validateNoticeContent(title, body); validateInstant(input.publishedAt);
  return Object.freeze({ id, tenantId, title, body, publishedAt: input.publishedAt });
}

export function normalizeNoticeAcknowledgement(input: NoticeAcknowledgement): Readonly<NoticeAcknowledgement> {
  const id = required(input.id, 'ackId'); const tenantId = required(input.tenantId, 'tenantId');
  const noticeId = required(input.noticeId, 'noticeId'); const personId = required(input.personId, 'personId');
  validateInstant(input.createdAt);
  if (input.readAt !== null) validateInstant(input.readAt);
  if (input.acknowledgedAt !== null) validateInstant(input.acknowledgedAt);
  const created = Date.parse(input.createdAt);
  if (input.readAt !== null && Date.parse(input.readAt) < created) throw new Error('readAt cannot be before createdAt');
  if (input.acknowledgedAt !== null) {
    if (input.readAt === null) throw new Error('acknowledged notice must also be read');
    if (Date.parse(input.acknowledgedAt) < created) throw new Error('acknowledgedAt cannot be before createdAt');
    if (Date.parse(input.acknowledgedAt) < Date.parse(input.readAt)) throw new Error('acknowledgedAt cannot be before readAt');
  }
  return Object.freeze({ id, tenantId, noticeId, personId, readAt: input.readAt, acknowledgedAt: input.acknowledgedAt, createdAt: input.createdAt });
}
