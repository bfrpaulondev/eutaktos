import { describe, expect, it, vi } from 'vitest';
import { createMidweekMeeting, createStudentAssignment } from '@eutaktos/domain';
import { MidweekSchedulingHttpTransport, type MidweekSchedulingApplication } from './midweek-scheduling-http';

const principal = {
  tenantId: 'trusted-tenant',
  actorId: 'trusted-actor',
  capabilities: ['schedule.write', 'eligibility.read', 'availability.read'] as const,
};

function app(overrides: Partial<MidweekSchedulingApplication> = {}): MidweekSchedulingApplication {
  const meeting = createMidweekMeeting({ id: 'm1', tenantId: 'trusted-tenant', date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon', now: '2026-08-20T10:00:00.000Z' });
  const student = createStudentAssignment({ id: 'a1', tenantId: 'trusted-tenant', meetingId: 'm1', slotId: 's1', studentId: 'p1', assistantIsRequired: false, now: '2026-08-20T10:00:00.000Z' });
  return {
    createDraftMeeting: vi.fn(() => meeting),
    addSlot: vi.fn(() => meeting),
    removeSlot: vi.fn(() => meeting),
    updateMeeting: vi.fn(() => meeting),
    assignStudent: vi.fn(() => student),
    assignNonStudent: vi.fn(() => ({ id: 'n1', tenantId: 'trusted-tenant', meetingId: 'm1', slotId: 's1', personId: 'p2', role: 'chairman', state: 'assigned', assignedAt: '2026-08-20T10:00:00.000Z', cancelledAt: null, completedAt: null })),
    cancelStudentAssignment: vi.fn(() => ({ ...student, state: 'cancelled' as const, cancelledAt: '2026-08-21T10:00:00.000Z' })),
    cancelNonStudentAssignment: vi.fn(() => ({ id: 'n1', tenantId: 'trusted-tenant', meetingId: 'm1', slotId: 's1', personId: 'p2', role: 'chairman', state: 'cancelled', assignedAt: '2026-08-20T10:00:00.000Z', cancelledAt: '2026-08-21T10:00:00.000Z', completedAt: null })),
    publishMeeting: vi.fn(() => ({ ...meeting, state: 'published' as const })),
    archiveMeeting: vi.fn(() => ({ ...meeting, state: 'archived' as const })),
    ...overrides,
  } as MidweekSchedulingApplication;
}

describe('MidweekSchedulingHttpTransport', () => {
  it('requires an authenticated verified principal', () => {
    const transport = new MidweekSchedulingHttpTransport(app());
    expect(transport.createMeeting({ body: {} })).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('derives tenant and actor only from the verified principal', () => {
    const createDraftMeeting = vi.fn((context, _input) => createMidweekMeeting({ id: 'm1', tenantId: context.tenantId, date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon', now: '2026-08-20T10:00:00.000Z' }));
    const transport = new MidweekSchedulingHttpTransport(app({ createDraftMeeting }));
    const response = transport.createMeeting({ principal, body: { date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon' } });
    expect(response.status).toBe(201);
    expect(createDraftMeeting.mock.calls[0][0].tenantId).toBe('trusted-tenant');
    expect(createDraftMeeting.mock.calls[0][0].actorId).toBe('trusted-actor');
  });

  it('rejects attempts to inject tenant, actor or capabilities through the body', () => {
    const transport = new MidweekSchedulingHttpTransport(app());
    const response = transport.createMeeting({ principal, body: { date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon', tenantId: 'evil', actorId: 'evil', capabilities: ['tenant.manage'] } });
    expect(response.status).toBe(400);
    expect((response.body as { error: string }).error).toContain('Unknown request fields');
  });

  it('rejects identity injection on assignment writes too', () => {
    const transport = new MidweekSchedulingHttpTransport(app());
    const response = transport.assignStudent({ principal, params: { meetingId: 'm1' }, body: { slotId: 's1', studentId: 'p1', tenantId: 'evil' } });
    expect(response.status).toBe(400);
  });

  it('does not serialize tenantId, audit metadata or availability in meeting DTOs', () => {
    const transport = new MidweekSchedulingHttpTransport(app());
    const response = transport.createMeeting({ principal, body: { date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon' } });
    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty('tenantId');
    expect(response.body).not.toHaveProperty('createdAt');
    expect(response.body).not.toHaveProperty('updatedAt');
  });

  it('maps authorization failures to a generic 403', () => {
    const failing = vi.fn(() => { throw new Error('Access denied: missing capability schedule.write'); });
    const transport = new MidweekSchedulingHttpTransport(app({ createDraftMeeting: failing }));
    const response = transport.createMeeting({ principal, body: { date: '2026-08-21', localTime: '19:00', timezone: 'Europe/Lisbon' } });
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('maps conflict details to a generic 409 without leaking internal scheduling data', () => {
    const failing = vi.fn(() => { throw new Error('Scheduling conflict detected against assignment secret-42'); });
    const transport = new MidweekSchedulingHttpTransport(app({ assignStudent: failing }));
    const response = transport.assignStudent({ principal, params: { meetingId: 'm1' }, body: { slotId: 's1', studentId: 'p1' } });
    expect(response).toEqual({ status: 409, body: { error: 'Scheduling operation cannot be completed' } });
  });

  it('validates route params before invoking the application service', () => {
    const application = app();
    const transport = new MidweekSchedulingHttpTransport(application);
    const response = transport.publishMeeting({ principal, params: {} });
    expect(response).toEqual({ status: 400, body: { error: 'meetingId is required' } });
    expect(application.publishMeeting).not.toHaveBeenCalled();
  });
});
