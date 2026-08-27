import { describe, expect, it } from 'vitest';
import { matchNetlifyApiRoute } from '../../_netlify';

describe('PX9.9 Hourglass recovery boundary', () => {
  it('keeps the server-authoritative dry-run route available', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/preview')).toEqual({ key: 'hourglass-preview', params: {} });
  });

  it('exposes the reviewed server-owned prepare, execute and create-only rollback boundaries', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/prepare')).toEqual({ key: 'hourglass-prepare', params: {} });
    expect(matchNetlifyApiRoute('/import/hourglass/execute')).toEqual({ key: 'hourglass-execute', params: {} });
    expect(matchNetlifyApiRoute('/import/hourglass/rollback')).toEqual({ key: 'hourglass-rollback', params: {} });
  });

  it('does not expose alternate rollback routes that bypass the reviewed boundary', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/migrations/migration-1/rollback')).toBeUndefined();
  });
});
