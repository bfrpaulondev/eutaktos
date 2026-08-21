import { describe, it, expect } from 'vitest';
import {
  createImportantNotice,
  createNoticeAcknowledgement,
  markNoticeRead,
  acknowledgeNotice,
  isNoticeRead,
  isNoticeAcknowledged,
  assertNoticeTenant,
  assertAckTenant,
  filterAcksByTenant,
  findAckForPerson,
  normalizeImportantNotice,
  normalizeNoticeAcknowledgement,
} from './notice-acknowledgement';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';

describe('createImportantNotice', () => {
  it('creates a valid notice', () => {
    const n = createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'Emergency', body: 'Content here', publishedAt: NOW });
    expect(n.id).toBe('n1');
    expect(Object.isFrozen(n)).toBe(true);
  });

  it('throws on empty fields', () => {
    expect(() => createImportantNotice({ id: '', tenantId: TENANT_A, title: 'T', body: 'B', publishedAt: NOW })).toThrow('noticeId is required');
    expect(() => createImportantNotice({ id: 'n1', tenantId: '', title: 'T', body: 'B', publishedAt: NOW })).toThrow('tenantId is required');
  });

  it('throws on too long fields', () => {
    expect(() => createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'x'.repeat(501), body: 'B', publishedAt: NOW })).toThrow('title is too long');
    expect(() => createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'T', body: 'x'.repeat(10001), publishedAt: NOW })).toThrow('body is too long');
  });

  it('throws on invalid date', () => {
    expect(() => createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'T', body: 'B', publishedAt: 'bad' })).toThrow('Invalid ISO date');
  });
});

describe('createNoticeAcknowledgement', () => {
  it('creates with null read/ack', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    expect(a.readAt).toBeNull();
    expect(a.acknowledgedAt).toBeNull();
    expect(Object.isFrozen(a)).toBe(true);
  });
});

describe('markNoticeRead', () => {
  it('sets readAt', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    const read = markNoticeRead(a, '2026-08-21T13:00:00.000Z');
    expect(read.readAt).toBe('2026-08-21T13:00:00.000Z');
  });

  it('is idempotent', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    const r1 = markNoticeRead(a, '2026-08-21T13:00:00.000Z');
    const r2 = markNoticeRead(r1, '2026-08-21T14:00:00.000Z');
    expect(r2.readAt).toBe('2026-08-21T13:00:00.000Z');
  });

  it('does not mutate original', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    markNoticeRead(a, NOW);
    expect(a.readAt).toBeNull();
  });
});

describe('acknowledgeNotice', () => {
  it('sets acknowledgedAt and readAt', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    const acked = acknowledgeNotice(a, '2026-08-21T13:00:00.000Z');
    expect(acked.acknowledgedAt).toBe('2026-08-21T13:00:00.000Z');
    expect(acked.readAt).toBe('2026-08-21T13:00:00.000Z');
  });

  it('preserves existing readAt when acknowledging', () => {
    let a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    a = markNoticeRead(a, '2026-08-21T12:00:00.000Z');
    a = acknowledgeNotice(a, '2026-08-21T13:00:00.000Z');
    expect(a.readAt).toBe('2026-08-21T12:00:00.000Z');
  });

  it('is idempotent', () => {
    let a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    a = acknowledgeNotice(a, '2026-08-21T13:00:00.000Z');
    const a2 = acknowledgeNotice(a, '2026-08-21T14:00:00.000Z');
    expect(a2.acknowledgedAt).toBe('2026-08-21T13:00:00.000Z');
  });
});

describe('isNoticeRead / isNoticeAcknowledged', () => {
  it('initial state', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    expect(isNoticeRead(a)).toBe(false);
    expect(isNoticeAcknowledged(a)).toBe(false);
  });

  it('after read', () => {
    const a = markNoticeRead(createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW }), NOW);
    expect(isNoticeRead(a)).toBe(true);
    expect(isNoticeAcknowledged(a)).toBe(false);
  });

  it('after acknowledge', () => {
    const a = acknowledgeNotice(createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW }), NOW);
    expect(isNoticeRead(a)).toBe(true);
    expect(isNoticeAcknowledged(a)).toBe(true);
  });
});

describe('tenant isolation', () => {
  it('assertNoticeTenant', () => {
    const n = createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'T', body: 'B', publishedAt: NOW });
    expect(() => assertNoticeTenant(n, TENANT_A)).not.toThrow();
    expect(() => assertNoticeTenant(n, TENANT_B)).toThrow('Cross-tenant');
  });

  it('filterAcksByTenant', () => {
    const a1 = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    const a2 = createNoticeAcknowledgement({ id: 'a2', tenantId: TENANT_B, noticeId: 'n1', personId: 'p1', now: NOW });
    expect(filterAcksByTenant([a1, a2], TENANT_A)).toHaveLength(1);
  });

  it('findAckForPerson cross-tenant safe', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_B, noticeId: 'n1', personId: 'p1', now: NOW });
    expect(findAckForPerson([a], TENANT_A, 'n1', 'p1')).toBeUndefined();
  });
});

describe('normalizeImportantNotice', () => {
  it('normalizes valid', () => {
    const n = createImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'T', body: 'B', publishedAt: NOW });
    expect(normalizeImportantNotice(n).id).toBe('n1');
  });

  it('throws on invalid', () => {
    expect(() => normalizeImportantNotice({ id: 'n1', tenantId: TENANT_A, title: 'T', body: 'B', publishedAt: 'bad' } as any)).toThrow('Invalid ISO date');
  });
});

describe('normalizeNoticeAcknowledgement', () => {
  it('normalizes valid', () => {
    const a = createNoticeAcknowledgement({ id: 'a1', tenantId: TENANT_A, noticeId: 'n1', personId: 'p1', now: NOW });
    expect(normalizeNoticeAcknowledgement(a).id).toBe('a1');
  });
});
