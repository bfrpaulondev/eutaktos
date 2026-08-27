import { describe, expect, it } from 'vitest';
import { matchNetlifyApiRoute } from '../../_netlify';

describe('PX9.9 Hourglass recovery boundary', () => {
  it('keeps the server-authoritative dry-run route available', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/preview')).toEqual({ key: 'hourglass-preview', params: {} });
  });

  it('exposes only the reviewed server-owned prepare and execute handshake routes', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/execution/prepare')).toEqual({ key: 'hourglass-execution-prepare', params: {} });
    expect(matchNetlifyApiRoute('/import/hourglass/execution/execute')).toEqual({ key: 'hourglass-execution-execute', params: {} });
    expect(matchNetlifyApiRoute('/import/hourglass/execute')).toBeUndefined();
  });

  it('keeps rollback closed until its separately authorized boundary is reviewed', () => {
    expect(matchNetlifyApiRoute('/import/hourglass/rollback')).toBeUndefined();
    expect(matchNetlifyApiRoute('/import/hourglass/migrations/migration-1/rollback')).toBeUndefined();
  });
});
