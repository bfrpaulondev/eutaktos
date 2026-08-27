import { describe, expect, it } from 'vitest';
import { PeopleHttpTransport, type PeopleDirectoryPort } from './people-http';

const principal = {
  tenantId: 'tenant-1',
  actorId: 'actor-1',
  capabilities: ['people.read', 'people.write'] as const,
};

function port(): PeopleDirectoryPort {
  return {
    list: () => [],
    get: () => undefined,
    create: () => { throw new Error('not used'); },
    updateProfile: (_context, input) => ({
      id: input.personId,
      tenantId: 'tenant-1',
      displayName: 'Ana',
      active: true,
      labels: input.labels ?? [],
      availability: [],
      eligibility: [],
    }),
  };
}

describe('People labels HTTP contract', () => {
  it('accepts labels only through the authenticated People update contract', () => {
    const transport = new PeopleHttpTransport(port());
    const response = transport.update({
      principal,
      params: { personId: 'p1' },
      body: { labels: ['Visita', 'Apoio'] },
    });
    expect(response).toEqual({
      status: 200,
      body: { id: 'p1', displayName: 'Ana', active: true, labels: ['Visita', 'Apoio'] },
    });
  });

  it('rejects malformed label payloads before application mutation', () => {
    const transport = new PeopleHttpTransport(port());
    const response = transport.update({
      principal,
      params: { personId: 'p1' },
      body: { labels: ['ok', 7] },
    });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'labels must be an array of strings' });
  });

  it('never accepts tenant or capability authority in the body', () => {
    const transport = new PeopleHttpTransport(port());
    const response = transport.update({
      principal,
      params: { personId: 'p1' },
      body: { labels: ['Apoio'], tenantId: 'evil' },
    });
    expect(response.status).toBe(400);
  });
});