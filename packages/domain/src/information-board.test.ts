import { describe, expect, it } from 'vitest';
import {
  archiveAnnouncement,
  classifyAnnouncement,
  createAnnouncement,
  normalizeAnnouncement,
} from './information-board';

const NOW = '2026-08-21T12:00:00.000Z';

function make(overrides: Partial<Parameters<typeof createAnnouncement>[0]> = {}) {
  return createAnnouncement({
    id: 'a1', tenantId: 'tenant-a', title: 'Notice', body: 'Body', audienceKey: 'all', now: NOW,
    ...overrides,
  });
}

describe('information board announcements', () => {
  it('is deterministic from the supplied creation instant', () => {
    expect(make({ displayFrom: '2026-09-01T00:00:00Z' }).status).toBe('scheduled');
    expect(make({ displayFrom: '2026-01-01T00:00:00Z', expiresAt: '2026-12-31T00:00:00Z' }).status).toBe('active');
  });

  it('uses the shared display-window invariant', () => {
    expect(() => make({ displayFrom: '2026-12-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z' }))
      .toThrow('expiresAt must be after displayFrom');
  });

  it('classifies scheduled, active and expired windows at a requested instant', () => {
    const announcement = make({ displayFrom: '2026-09-01T00:00:00Z', expiresAt: '2026-12-01T00:00:00Z' });
    expect(classifyAnnouncement(announcement, '2026-08-25T00:00:00Z')).toBe('scheduled');
    expect(classifyAnnouncement(announcement, '2026-10-01T00:00:00Z')).toBe('active');
    expect(classifyAnnouncement(announcement, '2026-12-01T00:00:00Z')).toBe('expired');
  });

  it('preserves archived as a terminal display state', () => {
    const archived = archiveAnnouncement(make());
    expect(classifyAnnouncement(archived, '2030-01-01T00:00:00Z')).toBe('archived');
  });

  it('rejects corrupted persisted draft windows', () => {
    const active = make({ displayFrom: '2026-01-01T00:00:00Z' });
    expect(() => normalizeAnnouncement({ ...active, status: 'draft' })).toThrow('draft announcements');
  });
});
