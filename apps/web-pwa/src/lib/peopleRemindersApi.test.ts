import { describe, expect, it, vi } from 'vitest';
import { createPeopleRemindersApi, parsePeopleReminders } from './peopleRemindersApi';

const response = {
  contractVersion: 'people-reminders-v1',
  items: [{
    responseId: 'response-1',
    assignmentId: 'assignment-1',
    recipientId: 'person-1',
    displayName: 'Ana Silva',
    reason: 'awaiting-response',
    pendingSince: '2026-08-27T06:00:00.000Z',
    lastReminderAt: '2026-08-27T07:00:00.000Z',
  }],
} as const;

describe('People reminders API', () => {
  it('parses the authoritative v1 reminder review contract without deriving browser facts', () => {
    expect(parsePeopleReminders(response)).toEqual(response);
    expect(parsePeopleReminders({
      ...response,
      items: [{ ...response.items[0], lastReminderAt: null }],
    }).items[0]?.lastReminderAt).toBeNull();
  });

  it('rejects unknown reason codes, unsafe identifiers and invalid timestamps', () => {
    expect(() => parsePeopleReminders({
      ...response,
      items: [{ ...response.items[0], reason: 'browser-guessed' }],
    })).toThrow('Invalid People reminders response');
    expect(() => parsePeopleReminders({
      ...response,
      items: [{ ...response.items[0], assignmentId: 'assignment/1' }],
    })).toThrow('Invalid People reminders response');
    expect(() => parsePeopleReminders({
      ...response,
      items: [{ ...response.items[0], pendingSince: 'soon' }],
    })).toThrow('Invalid People reminders response');
  });

  it('uses a no-store same-origin GET, forwards AbortSignal and preserves HTTP status', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }));
    const api = createPeopleRemindersApi(fetcher as unknown as typeof fetch);
    const controller = new AbortController();

    await expect(api.get(controller.signal)).rejects.toThrow('Forbidden (403)');
    expect(fetcher).toHaveBeenCalledWith('/api/people/reminders', expect.objectContaining({
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    }));
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.body).toBeUndefined();
  });
});
