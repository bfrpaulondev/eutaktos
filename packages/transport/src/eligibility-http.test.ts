import { describe, expect, it } from 'vitest';
import type { AccessContext, CongregationPerson } from '@eutaktos/domain';
import type { RequestMetadata, SetEligibilityInput } from '@eutaktos/application';
import { EligibilityHttpTransport, type EligibilityPort } from './eligibility-http';
import type { TransportRequest } from './people-http';

class FakeEligibilityPort implements EligibilityPort {
  lastContext?: AccessContext;
  lastInput?: SetEligibilityInput;
  lastMetadata?: RequestMetadata;

  setEligibility(
    context: AccessContext,
    input: SetEligibilityInput,
    metadata?: RequestMetadata,
  ): CongregationPerson {
    this.lastContext = context;
    this.lastInput = input;
    this.lastMetadata = metadata;
    if (!context.capabilities.includes('people.read')) throw new Error('Access denied: missing capability people.read');
    if (!context.capabilities.includes('eligibility.write')) throw new Error('Access denied: missing capability eligibility.write');
    if (input.personId === 'missing') throw new Error('Person not found');
    const assignmentTypeId = input.assignmentTypeId.trim();
    if (!assignmentTypeId) throw new Error('assignmentTypeId is required');
    if (assignmentTypeId.length > 100) throw new Error('assignmentTypeId is too long');
    return {
      id: input.personId,
      tenantId: context.tenantId,
      displayName: 'Sensitive Name',
      active: true,
      availability: [],
      eligibility: [{
        assignmentTypeId,
        enabled: input.enabled,
        decidedBy: context.actorId,
        decidedAt: '2026-08-20T14:00:00.000Z',
      }],
    };
  }
}

function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    principal: {
      tenantId: 'tenant-a',
      actorId: 'elder-1',
      capabilities: ['people.read', 'eligibility.write'],
    },
    params: { personId: 'person-1' },
    body: { assignmentTypeId: 'bible-reading', enabled: true },
    ...overrides,
  };
}

describe('EligibilityHttpTransport', () => {
  it('rejects anonymous access', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    expect(transport.set(request({ principal: undefined }))).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('derives tenant actor and capabilities only from the verified principal', () => {
    const port = new FakeEligibilityPort();
    const transport = new EligibilityHttpTransport(port);
    const response = transport.set(request({
      correlationId: 'eligibility-42',
    }));

    expect(response).toEqual({
      status: 200,
      body: {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        decidedAt: '2026-08-20T14:00:00.000Z',
      },
    });
    expect(port.lastContext).toMatchObject({ tenantId: 'tenant-a', actorId: 'elder-1' });
    expect(port.lastMetadata).toEqual({ correlationId: 'eligibility-42' });
  });

  it('does not let people.write substitute for eligibility.write', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    const response = transport.set(request({
      principal: {
        tenantId: 'tenant-a',
        actorId: 'elder-1',
        capabilities: ['people.read', 'people.write'],
      },
    }));
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('rejects mass-assignment of tenant actor person identity and decision metadata', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    const response = transport.set(request({
      body: {
        assignmentTypeId: 'bible-reading',
        enabled: true,
        tenantId: 'tenant-b',
        actorId: 'other',
        personId: 'other-person',
        decidedBy: 'other',
        decidedAt: '2020-01-01T00:00:00Z',
      },
    }));
    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Unknown request fields: actorId, decidedAt, decidedBy, personId, tenantId',
    });
  });

  it('requires a boolean enabled flag', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    expect(transport.set(request({ body: { assignmentTypeId: 'bible-reading', enabled: 'yes' } }))).toEqual({
      status: 400,
      body: { error: 'enabled must be a boolean' },
    });
  });

  it('returns a minimized DTO without person name or deciding actor', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    const response = transport.set(request());
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('Sensitive Name');
    expect(serialized).not.toContain('elder-1');
    expect(serialized).not.toContain('decidedBy');
  });

  it('maps missing people without leaking persistence details', () => {
    const transport = new EligibilityHttpTransport(new FakeEligibilityPort());
    expect(transport.set(request({ params: { personId: 'missing' } }))).toEqual({
      status: 404,
      body: { error: 'Person not found' },
    });
  });
});
