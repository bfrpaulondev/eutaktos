import { describe, expect, it, vi } from 'vitest';
import type { AccessContext, Capability, ServiceGroup } from '@eutaktos/domain';
import type { RequestMetadata, CreateServiceGroupInput, UpdateServiceGroupInput } from '@eutaktos/application';
import type { VerifiedPrincipal } from './people-http';
import { ServiceGroupHttpTransport, type ServiceGroupPort, toServiceGroupDto } from './service-group-http';

function makeGroup(overrides: Partial<ServiceGroup> = {}): ServiceGroup {
  return {
    tenantId: 'tenant-a',
    name: 'Group A',
    memberIds: ['p-1', 'p-2'],
    ...overrides,
  } as ServiceGroup;
}

function principal(capabilities: readonly Capability[] = ['people.read']): VerifiedPrincipal {
  return { tenantId: 'tenant-a', actorId: 'admin-1', capabilities };
}

function fakePort(overrides: Partial<ServiceGroupPort> = {}): ServiceGroupPort {
  return {
    listServiceGroups: () => [makeGroup({ id: 'sg-1' })],
    getServiceGroup: (_ctx: AccessContext, id: string) => (id === 'sg-1' ? makeGroup({ id: 'sg-1' }) : undefined),
    createServiceGroup: (_ctx: AccessContext, input: CreateServiceGroupInput) =>
      makeGroup({ id: input.id, name: input.name, memberIds: [...input.memberIds], overseerId: input.overseerId, assistantId: input.assistantId }),
    updateServiceGroup: (_ctx: AccessContext, input: UpdateServiceGroupInput) =>
      makeGroup({ id: input.id, name: input.name ?? 'Group A', memberIds: input.memberIds ?? ['p-1', 'p-2'], overseerId: input.overseerId ?? undefined, assistantId: input.assistantId ?? undefined }),
    deleteServiceGroup: () => true,
    ...overrides,
  };
}

describe('ServiceGroupHttpTransport', () => {
  it('rejects anonymous requests with 401', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());

    expect(transport.list({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.get({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.create({ body: { name: 'G', memberIds: [] } })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
    expect(transport.update({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.delete({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('lists service groups without leaking tenant metadata', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());
    const response = transport.list({ principal: principal() });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body) && response.body[0]).not.toHaveProperty('tenantId');
  });

  it('returns 404 for a missing service group', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());
    const response = transport.get({ principal: principal(), params: { serviceGroupId: 'sg-999' } });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Service group not found' });
  });

  it('rejects mass-assignment fields on create', () => {
    const createSpy = vi.fn((_ctx: AccessContext, _input: CreateServiceGroupInput) => makeGroup({ id: 'sg-x' }));
    const transport = new ServiceGroupHttpTransport(fakePort({ createServiceGroup: createSpy }));

    const response = transport.create({
      principal: principal(['people.write']),
      body: { name: 'G', memberIds: [], id: 'evil', tenantId: 'other' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown request fields: id, tenantId' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('maps Access denied to 403 without leaking details', () => {
    const transport = new ServiceGroupHttpTransport(fakePort({
      listServiceGroups: () => { throw new Error('Access denied: missing capability people.read'); },
      createServiceGroup: () => { throw new Error('Access denied: missing capability people.write'); },
    }));

    expect(transport.list({ principal: principal() })).toEqual({ status: 403, body: { error: 'Forbidden' } });
    expect(transport.create({
      principal: principal(['people.read']),
      body: { name: 'G', memberIds: [] },
    })).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('passes correlation ID to the port via metadata', () => {
    let seenMetadata: RequestMetadata | undefined;
    const createSpy = vi.fn((_ctx: AccessContext, input: CreateServiceGroupInput, meta?: RequestMetadata) => {
      seenMetadata = meta;
      return makeGroup({ id: input.id, name: input.name, memberIds: [...input.memberIds] });
    });
    const transport = new ServiceGroupHttpTransport(fakePort({ createServiceGroup: createSpy }));

    transport.create({
      principal: principal(['people.write']),
      correlationId: 'corr-7',
      body: { name: 'G', memberIds: ['p-1'] },
    });

    expect(seenMetadata).toEqual({ correlationId: 'corr-7' });
  });

  it('creates a service group with 201 including optional leaders', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());
    const response = transport.create({
      principal: principal(['people.write']),
      body: { name: 'Group B', memberIds: ['p-3', 'p-4'], overseerId: 'p-3', assistantId: 'p-4' },
    });

    expect(response.status).toBe(201);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected ServiceGroupDto');
    }
    expect(response.body.name).toBe('Group B');
    expect(response.body.overseerId).toBe('p-3');
    expect(response.body.assistantId).toBe('p-4');
    expect(response.body).not.toHaveProperty('tenantId');
  });

  it('updates a service group and returns 200', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());
    const response = transport.update({
      principal: principal(['people.read', 'people.write']),
      params: { serviceGroupId: 'sg-1' },
      body: { name: 'Renamed' },
    });

    expect(response.status).toBe(200);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected ServiceGroupDto');
    }
    expect(response.body.name).toBe('Renamed');
  });

  it('deletes a service group returning { deleted: true }', () => {
    const transport = new ServiceGroupHttpTransport(fakePort());
    const response = transport.delete({
      principal: principal(['people.write']),
      params: { serviceGroupId: 'sg-1' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true });
  });

  it('maps Service group not found to 404 on delete', () => {
    const transport = new ServiceGroupHttpTransport(fakePort({
      deleteServiceGroup: () => { throw new Error('Service group not found'); },
    }));

    const response = transport.delete({
      principal: principal(['people.write']),
      params: { serviceGroupId: 'sg-missing' },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Service group not found' });
  });
});
