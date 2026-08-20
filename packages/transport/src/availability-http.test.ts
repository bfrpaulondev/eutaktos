import { describe, expect, it } from 'vitest';
import type { AccessContext, AvailabilityPeriod } from '@eutaktos/domain';
import type { RequestMetadata } from '@eutaktos/application';
import { AvailabilityHttpTransport, type AvailabilityPort } from './availability-http';
import type { TransportRequest } from './people-http';

class FakeAvailabilityPort implements AvailabilityPort {
  periods: AvailabilityPeriod[] = [{
    id: 'availability-1',
    startsAt: '2026-09-12T00:00:00Z',
    endsAt: '2026-09-22T00:00:00Z',
    reasonCode: 'away',
  }];
  lastContext?: AccessContext;
  lastMetadata?: RequestMetadata;

  list(context: AccessContext): readonly AvailabilityPeriod[] {
    this.lastContext = context;
    if (!context.capabilities.includes('availability.read')) {
      throw new Error('Access denied: missing capability availability.read');
    }
    return this.periods;
  }

  addUnavailability(
    context: AccessContext,
    input: { personId: string; startsAt: string; endsAt: string; reasonCode?: AvailabilityPeriod['reasonCode'] },
    metadata?: RequestMetadata,
  ): { availability: readonly AvailabilityPeriod[] } {
    this.lastContext = context;
    this.lastMetadata = metadata;
    if (!context.capabilities.includes('availability.write')) {
      throw new Error('Access denied: missing capability availability.write');
    }
    const period: AvailabilityPeriod = {
      id: 'availability-2',
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      ...(input.reasonCode ? { reasonCode: input.reasonCode } : {}),
    };
    this.periods = [...this.periods, period];
    return { availability: this.periods };
  }

  removeUnavailability(
    context: AccessContext,
    input: { personId: string; availabilityPeriodId: string },
    metadata?: RequestMetadata,
  ): { availability: readonly AvailabilityPeriod[] } {
    this.lastContext = context;
    this.lastMetadata = metadata;
    if (!context.capabilities.includes('availability.write')) {
      throw new Error('Access denied: missing capability availability.write');
    }
    if (!this.periods.some(period => period.id === input.availabilityPeriodId)) {
      throw new Error('Unavailability period not found');
    }
    this.periods = this.periods.filter(period => period.id !== input.availabilityPeriodId);
    return { availability: this.periods };
  }
}

function request(overrides: Partial<TransportRequest> = {}): TransportRequest {
  return {
    principal: {
      tenantId: 'tenant-a',
      actorId: 'elder-1',
      capabilities: ['people.read', 'availability.read', 'availability.write'],
    },
    params: { personId: 'person-1' },
    ...overrides,
  };
}

describe('AvailabilityHttpTransport', () => {
  it('rejects anonymous access', () => {
    const transport = new AvailabilityHttpTransport(new FakeAvailabilityPort());
    expect(transport.list(request({ principal: undefined }))).toEqual({
      status: 401,
      body: { error: 'Unauthorized' },
    });
  });

  it('derives tenant and actor only from the verified principal', () => {
    const port = new FakeAvailabilityPort();
    const transport = new AvailabilityHttpTransport(port);

    expect(transport.list(request())).toMatchObject({ status: 200 });
    expect(port.lastContext).toMatchObject({ tenantId: 'tenant-a', actorId: 'elder-1' });
  });

  it('requires dedicated availability.read capability for listing', () => {
    const transport = new AvailabilityHttpTransport(new FakeAvailabilityPort());
    const response = transport.list(request({
      principal: {
        tenantId: 'tenant-a',
        actorId: 'elder-1',
        capabilities: ['people.read'],
      },
    }));
    expect(response).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('creates only allowlisted availability fields and preserves correlation metadata', () => {
    const port = new FakeAvailabilityPort();
    const transport = new AvailabilityHttpTransport(port);
    const response = transport.create(request({
      correlationId: 'request-42',
      body: {
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-04T00:00:00Z',
        reasonCode: 'unavailable',
      },
    }));

    expect(response).toEqual({
      status: 201,
      body: {
        id: 'availability-2',
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-04T00:00:00Z',
        reasonCode: 'unavailable',
      },
    });
    expect(port.lastMetadata).toEqual({ correlationId: 'request-42' });
  });

  it('rejects mass-assignment fields including tenant and person identity', () => {
    const transport = new AvailabilityHttpTransport(new FakeAvailabilityPort());
    const response = transport.create(request({
      body: {
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-04T00:00:00Z',
        tenantId: 'tenant-b',
        personId: 'other-person',
      },
    }));

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown request fields: personId, tenantId' });
  });

  it('rejects invalid reason codes at the transport boundary', () => {
    const transport = new AvailabilityHttpTransport(new FakeAvailabilityPort());
    const response = transport.create(request({
      body: {
        startsAt: '2026-10-01T00:00:00Z',
        endsAt: '2026-10-04T00:00:00Z',
        reasonCode: 'vacation',
      },
    }));

    expect(response).toEqual({
      status: 400,
      body: { error: 'reasonCode must be away, unavailable or other' },
    });
  });

  it('removes a specific period and maps unknown ids without leaking internals', () => {
    const port = new FakeAvailabilityPort();
    const transport = new AvailabilityHttpTransport(port);

    expect(transport.remove(request({
      params: { personId: 'person-1', availabilityPeriodId: 'availability-1' },
    }))).toEqual({ status: 204, body: null });

    expect(transport.remove(request({
      params: { personId: 'person-1', availabilityPeriodId: 'missing' },
    }))).toEqual({ status: 404, body: { error: 'Unavailability period not found' } });
  });
});
