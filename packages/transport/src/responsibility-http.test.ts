import { describe, expect, it, vi } from 'vitest';
import type { AccessContext, Capability, ResponsibilityAssignment } from '@eutaktos/domain';
import type { RequestMetadata, AssignResponsibilityInput, EndResponsibilityInput } from '@eutaktos/application';
import type { VerifiedPrincipal } from './people-http';
import { ResponsibilityHttpTransport, type ResponsibilityPort, toResponsibilityDto } from './responsibility-http';

function makeAssignment(overrides: Partial<ResponsibilityAssignment> = {}): ResponsibilityAssignment {
  return {
    tenantId: 'tenant-a',
    id: 'resp-1',
    personId: 'p-1',
    responsibilityKey: 'elder',
    startsAt: '2024-01-01T00:00:00Z',
    assignedBy: 'admin-1',
    assignedAt: '2023-12-31T00:00:00Z',
    ...overrides,
  } as ResponsibilityAssignment;
}

function principal(capabilities: readonly Capability[] = ['responsibilities.read']): VerifiedPrincipal {
  return { tenantId: 'tenant-a', actorId: 'admin-1', capabilities };
}

function fakePort(overrides: Partial<ResponsibilityPort> = {}): ResponsibilityPort {
  return {
    listResponsibilities: () => [makeAssignment()],
    getResponsibility: (_ctx: AccessContext, id: string) =>
      id === 'resp-1' ? makeAssignment() : undefined,
    assignResponsibility: (_ctx: AccessContext, input: AssignResponsibilityInput) =>
      makeAssignment({ id: input.id, personId: input.personId, responsibilityKey: input.responsibilityKey, startsAt: input.startsAt, endsAt: input.endsAt }),
    endResponsibility: (_ctx: AccessContext, input: EndResponsibilityInput) =>
      makeAssignment({ id: input.id, endsAt: input.endsAt }),
    ...overrides,
  };
}

describe('ResponsibilityHttpTransport', () => {
  it('rejects anonymous requests with 401', () => {
    const transport = new ResponsibilityHttpTransport(fakePort());

    expect(transport.list({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.get({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.assign({ body: { personId: 'p-1', responsibilityKey: 'elder', startsAt: '2024-01-01' } })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
    expect(transport.end({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('lists responsibilities omitting tenant and assignedBy from DTOs', () => {
    const transport = new ResponsibilityHttpTransport(fakePort());
    const response = transport.list({ principal: principal() });

    expect(response.status).toBe(200);
    if (!Array.isArray(response.body)) throw new Error('Expected array');
    expect(response.body[0]).toEqual({
      id: 'resp-1',
      personId: 'p-1',
      responsibilityKey: 'elder',
      startsAt: '2024-01-01T00:00:00Z',
    });
    expect(response.body[0]).not.toHaveProperty('tenantId');
    expect(response.body[0]).not.toHaveProperty('assignedBy');
  });

  it('returns 404 for a missing responsibility', () => {
    const transport = new ResponsibilityHttpTransport(fakePort());
    const response = transport.get({ principal: principal(), params: { responsibilityId: 'resp-999' } });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Responsibility not found' });
  });

  it('rejects mass-assignment fields like id, tenantId, assignedBy on assign', () => {
    const assignSpy = vi.fn((_ctx: AccessContext, _input: AssignResponsibilityInput) => makeAssignment());
    const transport = new ResponsibilityHttpTransport(fakePort({ assignResponsibility: assignSpy }));

    const response = transport.assign({
      principal: principal(['responsibilities.write']),
      body: { personId: 'p-1', responsibilityKey: 'elder', startsAt: '2024-01-01', id: 'evil', tenantId: 'other' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown request fields: id, tenantId' });
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it('maps Access denied to 403 without leaking details', () => {
    const transport = new ResponsibilityHttpTransport(fakePort({
      listResponsibilities: () => { throw new Error('Access denied: missing capability responsibilities.read'); },
      assignResponsibility: () => { throw new Error('Access denied: missing capability responsibilities.write'); },
    }));

    expect(transport.list({ principal: principal() })).toEqual({ status: 403, body: { error: 'Forbidden' } });
    expect(transport.assign({
      principal: principal(['responsibilities.read']),
      body: { personId: 'p-1', responsibilityKey: 'elder', startsAt: '2024-01-01' },
    })).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('passes correlation ID to the port via metadata', () => {
    let seenMetadata: RequestMetadata | undefined;
    const assignSpy = vi.fn((_ctx: AccessContext, input: AssignResponsibilityInput, meta?: RequestMetadata) => {
      seenMetadata = meta;
      return makeAssignment({ id: input.id, personId: input.personId, responsibilityKey: input.responsibilityKey, startsAt: input.startsAt });
    });
    const transport = new ResponsibilityHttpTransport(fakePort({ assignResponsibility: assignSpy }));

    transport.assign({
      principal: principal(['responsibilities.write']),
      correlationId: 'corr-99',
      body: { personId: 'p-1', responsibilityKey: 'elder', startsAt: '2024-01-01T00:00:00Z' },
    });

    expect(seenMetadata).toEqual({ correlationId: 'corr-99' });
  });

  it('assigns a responsibility with 201 and returns DTO', () => {
    const transport = new ResponsibilityHttpTransport(fakePort());
    const response = transport.assign({
      principal: principal(['responsibilities.write']),
      body: { personId: 'p-2', responsibilityKey: 'ministerial-servant', startsAt: '2024-06-01T00:00:00Z', endsAt: '2025-06-01T00:00:00Z' },
    });

    expect(response.status).toBe(201);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected ResponsibilityDto');
    }
    expect(response.body.personId).toBe('p-2');
    expect(response.body.responsibilityKey).toBe('ministerial-servant');
    expect(response.body.endsAt).toBe('2025-06-01T00:00:00Z');
    expect(response.body).not.toHaveProperty('tenantId');
    expect(response.body).not.toHaveProperty('assignedBy');
  });

  it('ends a responsibility with 200 and includes endsAt in DTO', () => {
    const transport = new ResponsibilityHttpTransport(fakePort());
    const response = transport.end({
      principal: principal(['responsibilities.write']),
      params: { responsibilityId: 'resp-1' },
      body: { endsAt: '2024-12-31T00:00:00Z' },
    });

    expect(response.status).toBe(200);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected ResponsibilityDto');
    }
    expect(response.body.id).toBe('resp-1');
    expect(response.body.endsAt).toBe('2024-12-31T00:00:00Z');
  });

  it('maps Responsibility not found to 404 on end', () => {
    const transport = new ResponsibilityHttpTransport(fakePort({
      endResponsibility: () => { throw new Error('Responsibility not found'); },
    }));

    const response = transport.end({
      principal: principal(['responsibilities.write']),
      params: { responsibilityId: 'resp-missing' },
      body: { endsAt: '2024-12-31T00:00:00Z' },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Responsibility not found' });
  });
});
