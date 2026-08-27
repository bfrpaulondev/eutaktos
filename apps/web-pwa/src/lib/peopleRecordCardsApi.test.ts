import { describe, expect, it, vi } from 'vitest';
import { createPeopleRecordCardsApi, parsePeopleRecordCards, PeopleRecordCardsApiError } from './peopleRecordCardsApi';

const valid = {
  contractVersion: 'people-record-cards-v1',
  generatedAt: '2026-08-27T12:00:00.000Z',
  period: { from: '2026-01-01', to: '2026-12-31' },
  cards: [{ personId: 'p1', displayName: 'Ana', records: [{ meetingDate: '2026-03-10', partType: 'reading' }] }],
} as const;

describe('People Record Cards API client', () => {
  it('parses the minimal reviewed report projection and rejects widened records', () => {
    expect(parsePeopleRecordCards(valid).cards[0]).toEqual(valid.cards[0]);
    expect(() => parsePeopleRecordCards({ ...valid, cards: [{ ...valid.cards[0], phone: '+351' }] })).toThrow('Invalid Record Cards API response');
    expect(() => parsePeopleRecordCards({ ...valid, cards: [{ ...valid.cards[0], records: [{ ...valid.cards[0].records[0], meetingId: 'm1' }] }] })).toThrow('Invalid Record Cards API response');
  });

  it('sends only period selectors with same-origin credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(valid), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const api = createPeopleRecordCardsApi(fetcher);
    await api.get({ year: '2026' });
    expect(fetcher).toHaveBeenCalledWith('/api/people/record-cards?year=2026', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }));
  });

  it('preserves authorization status without exposing server error detail', async () => {
    const api = createPeopleRecordCardsApi(async () => new Response(JSON.stringify({ error: 'sensitive detail' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.get({ year: '2026' })).rejects.toBeInstanceOf(PeopleRecordCardsApiError);
    await expect(api.get({ year: '2026' })).rejects.toMatchObject({ status: 403, message: 'Record cards request failed (403)' });
  });
});