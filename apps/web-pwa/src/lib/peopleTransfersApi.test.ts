import { describe, expect, it, vi } from 'vitest';
import { createPeopleTransfersApi, parsePeopleTransferPreview, parsePeopleTransferSend, parsePeopleTransfers, PeopleTransfersApiError } from './peopleTransfersApi';

const code = 'A'.repeat(43);

describe('People Transfers API client', () => {
  it('parses outbound history without accepting Contact values or old codes', () => {
    const value = { contractVersion: 'people-transfers-v1', transfers: [{ transferId: 'people-transfer-1', status: 'pending', createdAt: '2026-08-27T12:00:00.000Z', expiresAt: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] }] };
    expect(parsePeopleTransfers(value).transfers[0]?.people).toEqual([{ displayName: 'Ana' }]);
    expect(() => parsePeopleTransfers({ ...value, transfers: [{ ...value.transfers[0], code }] })).toThrow('Invalid People Transfers API response');
    expect(() => parsePeopleTransfers({ ...value, transfers: [{ ...value.transfers[0], people: [{ displayName: 'Ana', phone: '+351' }] }] })).toThrow('Invalid People Transfers API response');
  });

  it('accepts a one-time send code only in the immediate send response', () => {
    expect(parsePeopleTransferSend({ contractVersion: 'people-transfer-send-v1', transferId: 'people-transfer-1', code, expiresAt: '2026-08-30T12:00:00.000Z', people: [{ personId: 'p1', displayName: 'Ana' }] }).code).toBe(code);
    expect(parsePeopleTransferPreview({ contractVersion: 'people-transfer-preview-v1', transferId: 'people-transfer-1', expiresAt: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] })).not.toHaveProperty('code');
  });

  it('keeps receive codes in POST bodies and never in URLs', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ contractVersion: 'people-transfer-preview-v1', transferId: 'people-transfer-1', expiresAt: '2026-08-30T12:00:00.000Z', people: [{ displayName: 'Ana' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ contractVersion: 'people-transfer-claim-v1', transferId: 'people-transfer-1', outcome: 'claimed', people: [{ personId: 'p1', displayName: 'Ana' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleTransfersApi(fetcher);
    await api.preview(code);
    await api.claim(code);
    expect(fetcher.mock.calls[0]?.[0]).toBe('/api/people/transfers/preview');
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toBe(JSON.stringify({ code }));
    expect(fetcher.mock.calls[1]?.[0]).toBe('/api/people/transfers/claim');
    expect(String(fetcher.mock.calls[1]?.[1]?.body)).toBe(JSON.stringify({ code }));
  });

  it('preserves authorization status without exposing server error detail', async () => {
    const api = createPeopleTransfersApi(async () => new Response(JSON.stringify({ error: 'sensitive' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.list()).rejects.toBeInstanceOf(PeopleTransfersApiError);
    await expect(api.list()).rejects.toMatchObject({ status: 403, message: 'People transfer request failed (403)' });
  });
});