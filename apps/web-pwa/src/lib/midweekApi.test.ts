import { describe, expect, it, vi } from 'vitest';
import { createMidweekApi, parseMidweekOverview } from './midweekApi';

const meeting = { id: 'm1', date: '2026-08-24', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft', slots: [{ id: 's1', position: 0, durationMinutes: 5, titleKey: 'opening' }] };
const overview = {
  meetings: [meeting],
  studentAssignments: [{ id: 'a1', meetingId: 'm1', slotId: 's1', studentId: 'p1', studentDisplayName: 'Person One', assistantId: null, assistantDisplayName: null, state: 'assigned' }],
  nonStudentAssignments: [],
};

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('midweekApi', () => {
  it('parses a real overview without injecting tenant or demo fields', () => {
    const parsed = parseMidweekOverview(overview);
    expect(parsed.meetings[0]).toMatchObject({ id: 'm1', timezone: 'Europe/Lisbon', state: 'draft' });
    expect(parsed.studentAssignments[0].studentDisplayName).toBe('Person One');
    expect('tenantId' in parsed.meetings[0]).toBe(false);
  });

  it('rejects malformed assignment state instead of coercing it', () => {
    expect(() => parseMidweekOverview({ ...overview, studentAssignments: [{ ...overview.studentAssignments[0], state: 'yes' }] })).toThrow('assignment state');
  });

  it('uses same-origin credentials and returns the parsed overview', async () => {
    let credentials: RequestCredentials | undefined;
    const api = createMidweekApi(async (_input, init) => {
      credentials = init?.credentials;
      return json(overview);
    });
    expect((await api.overview()).meetings).toHaveLength(1);
    expect(credentials).toBe('same-origin');
  });

  it('turns an overview deadline into a retryable error instead of an endless spinner', async () => {
    vi.useFakeTimers();
    try {
      const api = createMidweekApi((_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
      }));
      const expectation = expect(api.overview()).rejects.toThrow('Midweek API request timed out');
      await vi.advanceTimersByTimeAsync(15_000);
      await expectation;
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates meetings and parts using the server scheduling contract', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input) === '/api/midweek') {
        expect(init?.method).toBe('POST');
        expect(init?.credentials).toBe('same-origin');
        expect(JSON.parse(String(init?.body))).toEqual({ date: '2026-08-31', localTime: '19:30', timezone: 'Europe/Lisbon' });
        return json({ ...meeting, id: 'm2', date: '2026-08-31', slots: [] }, 201);
      }
      expect(String(input)).toBe('/api/midweek/meetings/m1/slots');
      expect(JSON.parse(String(init?.body))).toEqual({ position: 1, durationMinutes: 10, titleKey: 'gems' });
      return json({ ...meeting, slots: [...meeting.slots, { id: 's2', position: 1, durationMinutes: 10, titleKey: 'gems' }] });
    });
    const api = createMidweekApi(fetcher);
    await expect(api.createMeeting({ date: '2026-08-31', localTime: '19:30', timezone: 'Europe/Lisbon' })).resolves.toMatchObject({ id: 'm2' });
    await expect(api.addSlot('m1', { position: 1, durationMinutes: 10, titleKey: 'gems' })).resolves.toMatchObject({ slots: expect.arrayContaining([expect.objectContaining({ id: 's2' })]) });
  });

  it('minimizes assignment and replacement mutation payloads', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/student-assignments')) {
        expect(JSON.parse(String(init?.body))).toEqual({ slotId: 's1', studentId: 'p1', assistantId: null });
      } else if (url.endsWith('/non-student-assignments/a2/replace')) {
        expect(JSON.parse(String(init?.body))).toEqual({ personId: 'p2' });
      }
      return json({ id: 'ignored' });
    });
    const api = createMidweekApi(fetcher);
    await api.assignStudent('m1', { slotId: 's1', studentId: 'p1', assistantId: null, tenantId: 'evil' } as never);
    await api.replaceNonStudent('a2', 'p2');
  });

  it('publishes and removes a slot with no caller-controlled identity fields', async () => {
    const fetcher = vi.fn<typeof fetch>(async (input, init) => {
      expect(init?.credentials).toBe('same-origin');
      expect(init?.body).toBeUndefined();
      const url = String(input);
      if (url.endsWith('/publish')) return json({ ...meeting, state: 'published' });
      expect(url).toBe('/api/midweek/meetings/m1/slots/s1');
      expect(init?.method).toBe('DELETE');
      return json({ ...meeting, slots: [] });
    });
    const api = createMidweekApi(fetcher);
    await expect(api.publishMeeting('m1')).resolves.toMatchObject({ state: 'published' });
    await expect(api.removeSlot('m1', 's1')).resolves.toMatchObject({ slots: [] });
  });

  it('surfaces the safe server error without fabricating fallback data', async () => {
    const api = createMidweekApi(async () => json({ error: 'Forbidden' }, 403));
    await expect(api.overview()).rejects.toThrow('Forbidden');
  });

  it('does not expose 5xx server details', async () => {
    const api = createMidweekApi(async () => json({ error: 'database secret' }, 500));
    await expect(api.publishMeeting('m1')).rejects.toThrow('Midweek API request failed (500)');
  });
});