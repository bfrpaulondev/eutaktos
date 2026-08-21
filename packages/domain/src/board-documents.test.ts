import { describe, it, expect } from 'vitest';
import { createBoardDocument, classifyBoardDocument, assertBoardDocumentTenant, normalizeBoardDocument } from './board-documents';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: Partial<Parameters<typeof createBoardDocument>[0]>) {
  return createBoardDocument({
    id: 'bd-1', tenantId: T, title: 'PDF Guide', mimeType: 'application/pdf',
    resourceType: 'internal', resourceReference: 'storage/docs/guide.pdf', now: NOW, ...overrides,
  });
}

describe('createBoardDocument', () => {
  it('creates valid', () => { const d = make(); expect(d.mimeType).toBe('application/pdf'); expect(Object.isFrozen(d)).toBe(true); });
  it('rejects invalid MIME', () => { expect(() => make({ mimeType: 'bad/type' })).toThrow('Invalid MIME type'); });
  it('accepts valid URL', () => { expect(make({ resourceType: 'external', url: 'https://example.com/doc.pdf' }).url).toBe('https://example.com/doc.pdf'); });
  it('rejects invalid URL', () => { expect(() => make({ url: 'ftp://bad' })).toThrow('Invalid URL'); });
  it('rejects impossible display window', () => { expect(() => make({ displayFrom: '2026-12-01T00:00:00Z', expiresAt: '2026-08-01T00:00:00Z' })).toThrow('expiresAt must be after'); });
  it('accepts image MIME', () => { expect(() => make({ mimeType: 'image/png' })).not.toThrow(); });
  it('title too long', () => { expect(() => make({ title: 'x'.repeat(301) })).toThrow('title is too long'); });
});

describe('classifyBoardDocument', () => {
  it('active with no dates', () => { expect(classifyBoardDocument(make())).toBe('active'); });
  it('upcoming', () => { expect(classifyBoardDocument(make({ displayFrom: '2030-01-01T00:00:00Z' }), '2026-08-21T00:00:00Z')).toBe('upcoming'); });
  it('expired', () => { expect(classifyBoardDocument(make({ displayFrom: '2026-01-01T00:00:00Z', expiresAt: '2026-07-01T00:00:00Z' }), '2026-08-21T00:00:00Z')).toBe('expired'); });
});

describe('tenant isolation', () => {
  it('assertBoardDocumentTenant', () => { expect(() => assertBoardDocumentTenant(make(), T)).not.toThrow(); expect(() => assertBoardDocumentTenant(make(), 'other')).toThrow('Cross-tenant'); });
});

describe('normalizeBoardDocument', () => {
  it('normalizes valid', () => { expect(normalizeBoardDocument(make()).id).toBe('bd-1'); });
  it('throws on invalid MIME', () => { expect(() => normalizeBoardDocument({ ...make(), mimeType: 'bad' })).toThrow('Invalid MIME type'); });
});
