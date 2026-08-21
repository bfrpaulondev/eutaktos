import { describe, it, expect } from 'vitest';
import {
  createAnnouncement, classifyAnnouncement, archiveAnnouncement,
  assertAnnouncementTenant, normalizeAnnouncement,
} from './information-board';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createAnnouncement>[0]>) {
  return createAnnouncement({ id: 'ann-1', tenantId: T, title: 'Notice', body: 'Body text', audienceKey: 'all', now: NOW, ...overrides });
}

describe('createAnnouncement', () => {
  it('creates draft with no dates', () => { const a = make(); expect(a.status).toBe('draft'); expect(Object.isFrozen(a)).toBe(true); });
  it('creates active when displayFrom in past', () => { const a = make({ displayFrom: '2026-08-01T00:00:00Z' }); expect(a.status).toBe('active'); });
  it('creates scheduled when displayFrom in future', () => { const a = make({ displayFrom: '2026-09-01T00:00:00Z' }); expect(a.status).toBe('scheduled'); });
  it('creates expired when expiresAt in past', () => { const a = make({ displayFrom: '2026-07-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z' }); expect(a.status).toBe('expired'); });
  it('throws on title too long', () => { expect(() => make({ title: 'x'.repeat(301) })).toThrow('title is too long'); });
  it('throws on body too long', () => { expect(() => make({ body: 'x'.repeat(10001) })).toThrow('body is too long'); });
});

describe('classifyAnnouncement', () => {
  it('scheduled at point before displayFrom', () => { const a = make({ displayFrom: '2026-09-01T00:00:00Z' }); expect(classifyAnnouncement(a, '2026-08-25T00:00:00Z')).toBe('scheduled'); });
  it('active at point within window', () => { const a = make({ displayFrom: '2026-08-01T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z' }); expect(classifyAnnouncement(a, '2026-09-01T00:00:00Z')).toBe('active'); });
  it('expired at point after expiresAt', () => { const a = make({ displayFrom: '2026-08-01T00:00:00Z', expiresAt: '2026-08-15T00:00:00Z' }); expect(classifyAnnouncement(a, '2026-08-20T00:00:00Z')).toBe('expired'); });
  it('draft stays draft', () => { expect(classifyAnnouncement(make())).toBe('draft'); });
  it('archived stays archived', () => { expect(classifyAnnouncement(archiveAnnouncement(make()))).toBe('archived'); });
});

describe('archiveAnnouncement', () => {
  it('sets archived', () => { expect(archiveAnnouncement(make()).status).toBe('archived'); });
});

describe('tenant isolation', () => {
  it('assertAnnouncementTenant', () => { expect(() => assertAnnouncementTenant(make(), T)).not.toThrow(); expect(() => assertAnnouncementTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeAnnouncement', () => {
  it('normalizes valid', () => { expect(normalizeAnnouncement(make()).id).toBe('ann-1'); });
  it('throws on invalid status', () => { expect(() => normalizeAnnouncement({ ...make(), status: 'x' } as any)).toThrow('Invalid status'); });
});
