import { describe, expect, it, vi } from 'vitest';
import type { AccessContext, Capability, Household } from '@eutaktos/domain';
import type { RequestMetadata, CreateHouseholdInput, UpdateHouseholdInput } from '@eutaktos/application';
import type { VerifiedPrincipal } from './people-http';
import { HouseholdHttpTransport, type HouseholdPort, toHouseholdDto } from './household-http';

function makeHousehold(overrides: Partial<Household> = {}): Household {
  return {
    tenantId: 'tenant-a',
    name: 'Smith Family',
    memberIds: ['p-1', 'p-2'],
    ...overrides,
  } as Household;
}

function principal(capabilities: readonly Capability[] = ['people.read']): VerifiedPrincipal {
  return { tenantId: 'tenant-a', actorId: 'admin-1', capabilities };
}

function fakePort(overrides: Partial<HouseholdPort> = {}): HouseholdPort {
  return {
    listHouseholds: () => [makeHousehold({ id: 'hh-1' })],
    getHousehold: (_ctx: AccessContext, id: string) => (id === 'hh-1' ? makeHousehold({ id: 'hh-1' }) : undefined),
    createHousehold: (_ctx: AccessContext, input: CreateHouseholdInput) =>
      makeHousehold({ id: input.id, name: input.name, memberIds: [...input.memberIds] }),
    updateHousehold: (_ctx: AccessContext, input: UpdateHouseholdInput) =>
      makeHousehold({ id: input.id, name: input.name ?? 'Smith Family', memberIds: input.memberIds ?? ['p-1', 'p-2'] }),
    deleteHousehold: () => true,
    ...overrides,
  };
}

describe('HouseholdHttpTransport', () => {
  it('rejects anonymous requests with 401', () => {
    const transport = new HouseholdHttpTransport(fakePort());

    expect(transport.list({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.get({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.create({ body: { name: 'Test', memberIds: [] } })).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
    expect(transport.update({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.delete({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('lists households and omits tenant/actor metadata from DTOs', () => {
    const transport = new HouseholdHttpTransport(fakePort());
    const response = transport.list({ principal: principal() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual([{
      id: 'hh-1',
      name: 'Smith Family',
      memberIds: ['p-1', 'p-2'],
    }]);
    expect(Array.isArray(response.body) && response.body[0]).not.toHaveProperty('tenantId');
  });

  it('returns 404 for a missing household', () => {
    const transport = new HouseholdHttpTransport(fakePort());
    const response = transport.get({ principal: principal(), params: { householdId: 'hh-999' } });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Household not found' });
  });

  it('rejects mass-assignment fields like id and tenantId on create', () => {
    const createSpy = vi.fn((_ctx: AccessContext, _input: CreateHouseholdInput) => makeHousehold({ id: 'hh-x' }));
    const transport = new HouseholdHttpTransport(fakePort({ createHousehold: createSpy }));

    const response = transport.create({
      principal: principal(['people.write']),
      body: { name: 'Hacked', memberIds: ['p-1'], id: 'evil', tenantId: 'other-tenant' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown request fields: id, tenantId' });
    expect(createSpy).not.toHaveBeenCalled();
  });

  it('maps Access denied to 403 without leaking details', () => {
    const transport = new HouseholdHttpTransport(fakePort({
      listHouseholds: () => { throw new Error('Access denied: missing capability people.read'); },
      createHousehold: () => { throw new Error('Access denied: missing capability people.write'); },
    }));

    expect(transport.list({ principal: principal() })).toEqual({ status: 403, body: { error: 'Forbidden' } });
    expect(transport.create({
      principal: principal(['people.read']),
      body: { name: 'Test', memberIds: [] },
    })).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('derives tenant and actor from the verified principal and passes correlation ID', () => {
    let seenContext: AccessContext | undefined;
    let seenMetadata: RequestMetadata | undefined;
    const createSpy = vi.fn((context: AccessContext, input: CreateHouseholdInput, meta?: RequestMetadata) => {
      seenContext = context;
      seenMetadata = meta;
      return makeHousehold({ id: input.id, name: input.name, memberIds: [...input.memberIds] });
    });
    const transport = new HouseholdHttpTransport(fakePort({ createHousehold: createSpy }));

    const response = transport.create({
      principal: principal(['people.write']),
      correlationId: 'corr-42',
      body: { name: 'New Household', memberIds: ['p-3'] },
    });

    expect(response.status).toBe(201);
    expect(seenContext).toMatchObject({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      capabilities: ['people.write'],
    });
    expect(seenMetadata).toEqual({ correlationId: 'corr-42' });
  });

  it('creates a household with 201 and returns DTO', () => {
    const transport = new HouseholdHttpTransport(fakePort());
    const response = transport.create({
      principal: principal(['people.write']),
      body: { name: 'Jones Family', memberIds: ['p-4', 'p-5'] },
    });

    expect(response.status).toBe(201);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected HouseholdDto');
    }
    expect(response.body.name).toBe('Jones Family');
    expect(response.body.memberIds).toEqual(['p-4', 'p-5']);
    expect(response.body).not.toHaveProperty('tenantId');
  });

  it('deletes a household returning { deleted: true } on 200', () => {
    const deleteSpy = vi.fn(() => true);
    const transport = new HouseholdHttpTransport(fakePort({ deleteHousehold: deleteSpy }));

    const response = transport.delete({
      principal: principal(['people.write']),
      params: { householdId: 'hh-1' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ deleted: true });
    expect(deleteSpy).toHaveBeenCalled();
  });

  it('maps Household not found to 404 on delete', () => {
    const transport = new HouseholdHttpTransport(fakePort({
      deleteHousehold: () => { throw new Error('Household not found'); },
    }));

    const response = transport.delete({
      principal: principal(['people.write']),
      params: { householdId: 'hh-missing' },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Household not found' });
  });

  it('updates a household with 200 and returns DTO', () => {
    const transport = new HouseholdHttpTransport(fakePort());
    const response = transport.update({
      principal: principal(['people.read', 'people.write']),
      params: { householdId: 'hh-1' },
      body: { name: 'Updated Name' },
    });

    expect(response.status).toBe(200);
    if (typeof response.body !== 'object' || response.body === null || 'error' in response.body) {
      throw new Error('Expected HouseholdDto');
    }
    expect(response.body.name).toBe('Updated Name');
  });
});
