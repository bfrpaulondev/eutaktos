import { describe, expect, it } from 'vitest';
import { matchNetlifyApiRoute } from '../../_netlify';

/**
 * PX9.9 safety regression: production supports the read-only Hourglass preview,
 * but must not expose execute/rollback routes until an atomic durable migration
 * log + rollback-plan persistence boundary exists.
 */
describe('PX9.9 Hourglass recovery boundary', () => {
  it('keeps the server-authoritative dry-run route available', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/preview')).toEqual({ key: 'hourglass-preview', params: {} });
  });

  it('does not expose unsafe per-request execute or rollback routes', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/execute')).toBeUndefined();
    expect(matchNetlifyApiRoute('/import/hourglass/rollback')).toBeUndefined();
    expect(matchNetlifyApiRoute('/import/hourglass/migrations/migration-1/rollback')).toBeUndefined();
  });
});
