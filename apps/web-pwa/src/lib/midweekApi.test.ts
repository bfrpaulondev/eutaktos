import { describe, expect, it } from 'vitest';
import { createMidweekApi, parseMidweekOverview } from './midweekApi';

const overview = {
  meetings: [{ id: 'm1', date: '2026-08-24', localTime: '19:30', timezone: 'Europe/Lisbon', state: 'draft', slots: [{ id: 's1', position: 0, durationMinutes: 5, titleKey: 'opening' }] }],
  studentAssignments: [{ id: 'a1', meetingId: 'm1', slotId: 's1', studentId: 'p1', studentDisplayName: 'Person One', assistantId: null, assistantDisplayName: null, state: 'assigned' }],
  nonStudentAssignments: [],
};

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
      return new Response(JSON.stringify(overview), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    expect((await api.overview()).meetings).toHaveLength(1);
    expect(credentials).toBe('same-origin');
  });

  it('surfaces the safe server error without fabricating fallback data', async () => {
    const api = createMidweekApi(async () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.overview()).rejects.toThrow('Forbidden');
  });
});
