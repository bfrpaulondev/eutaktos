import { describe, expect, it } from 'vitest';
import { classifyBoardDocument, createBoardDocument, normalizeBoardDocument } from './board-documents';

const NOW = '2026-08-21T12:00:00.000Z';

function internal(overrides: Partial<Parameters<typeof createBoardDocument>[0]> = {}) {
  return createBoardDocument({
    id: 'd1', tenantId: 'tenant-a', title: 'Guide', mimeType: 'application/pdf',
    resourceType: 'internal', resourceReference: 'storage/docs/guide.pdf', now: NOW,
    ...overrides,
  });
}

describe('information board documents', () => {
  it('creates internal metadata without exposing an external URL', () => {
    const document = internal();
    expect(document.url).toBeNull();
    expect(document.mimeType).toBe('application/pdf');
  });

  it('requires a credential-free HTTP(S) URL for external resources', () => {
    expect(createBoardDocument({
      id: 'd2', tenantId: 'tenant-a', title: 'Link', mimeType: 'text/html',
      resourceType: 'external', resourceReference: 'public-link', url: 'https://example.com/info', now: NOW,
    }).url).toContain('https://example.com/info');
    expect(() => createBoardDocument({
      id: 'd3', tenantId: 'tenant-a', title: 'Link', mimeType: 'text/html',
      resourceType: 'external', resourceReference: 'public-link', url: 'https://user:pass@example.com', now: NOW,
    })).toThrow('Invalid URL');
  });

  it('rejects malformed MIME types and control-character injection', () => {
    expect(() => internal({ mimeType: 'application/' })).toThrow('Invalid MIME type');
    expect(() => internal({ mimeType: 'application/pdf\nX-Test: bad' })).toThrow('Invalid MIME type');
  });

  it('uses the shared validated display window', () => {
    expect(() => internal({ displayFrom: '2026-12-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z' }))
      .toThrow('expiresAt must be after displayFrom');
    expect(classifyBoardDocument(internal({ displayFrom: '2030-01-01T00:00:00Z' }), NOW)).toBe('upcoming');
  });

  it('revalidates persisted resource and display metadata', () => {
    const document = internal();
    expect(() => normalizeBoardDocument({ ...document, resourceType: 'external', url: null })).toThrow('require a URL');
  });
});
