import { describe, expect, it } from 'vitest';
import type { AccessContext } from '@eutaktos/domain';
import type {
  DelegationRecord,
  GrantDelegationInput,
  RequestMetadata,
} from '@eutaktos/application';
import {
  DelegationHttpTransport,
  type DelegationPort,
} from './delegation-http';

const record: DelegationRecord = {
  id: 'delegation-1',
  tenantId: 'tenant-a',
  grantorId: 'person-a',
  delegateId: 'person-b',
  scopes: ['availability.submit', 'reports.submit'],
  startsAt: '2026-08-21T00:00:00.000Z',
  endsAt: '2026-09-21T00:00:00.000Z',
  grantedAt: '2026-08-20T17:00:00.000Z',
};

class FakePort implements DelegationPort {
  context?: AccessContext;
  grantInput?: GrantDelegationInput;
  metadata?: RequestMetadata;
  revokedId?: string;

  list(context: AccessContext): readonly DelegationRecord[] {
    this.context = context;
    return [record];
  }

  grant(context: AccessContext, input: GrantDelegationInput, metadata?: RequestMetadata): DelegationRecord {
    this.context = context;
    this.grantInput = input;
    this.metadata = metadata;
    return record;
  }

  revoke(context: AccessContext, delegationId: string, metadata?: RequestMetadata): DelegationRecord {
    this.context = context;
    this.revokedId = delegationId;
    this.metadata = metadata;
    return { ...record, revokedAt: '2026-08-20T18:00:00.000Z' };
  }
}

const principal = {
  tenantId: 'tenant-a',
  actorId: 'admin-1',
  capabilities: ['delegations.read', 'delegations.write'] as const,
};

describe('DelegationHttpTransport', () => {
  it('requires a verified principal and minimizes list DTOs', () => {
    const port = new FakePort();
    const transport = new DelegationHttpTransport(port);

    expect(transport.list({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    const response = transport.list({ principal });

    expect(response).toEqual({
      status: 200,
      body: [{
        id: 'delegation-1',
        grantorId: 'person-a',
        delegateId: 'person-b',
        scopes: ['availability.submit', 'reports.submit'],
        startsAt: '2026-08-21T00:00:00.000Z',
        endsAt: '2026-09-21T00:00:00.000Z',
        grantedAt: '2026-08-20T17:00:00.000Z',
      }],
    });
    expect(response.body).not.toHaveProperty('tenantId');
    expect(port.context).toMatchObject({ tenantId: 'tenant-a', actorId: 'admin-1' });
  });

  it('accepts only business delegation fields and propagates correlation metadata', () => {
    const port = new FakePort();
    const transport = new DelegationHttpTransport(port);
    const response = transport.grant({
      principal,
      correlationId: 'request-1',
      body: {
        grantorId: 'person-a',
        delegateId: 'person-b',
        scopes: ['reports.submit'],
        startsAt: '2026-08-21T00:00:00.000Z',
      },
    });

    expect(response.status).toBe(201);
    expect(port.grantInput).toEqual({
      grantorId: 'person-a',
      delegateId: 'person-b',
      scopes: ['reports.submit'],
      startsAt: '2026-08-21T00:00:00.000Z',
    });
    expect(port.metadata).toEqual({ correlationId: 'request-1' });
  });

  it('rejects tenant actor capability mass-assignment and unsupported scopes', () => {
    const transport = new DelegationHttpTransport(new FakePort());

    expect(transport.grant({
      principal,
      body: {
        tenantId: 'tenant-b',
        grantorId: 'person-a',
        delegateId: 'person-b',
        scopes: ['reports.submit'],
        startsAt: '2026-08-21T00:00:00.000Z',
      },
    })).toMatchObject({ status: 400 });

    expect(transport.grant({
      principal,
      body: {
        grantorId: 'person-a',
        delegateId: 'person-b',
        scopes: ['admin.submit'],
        startsAt: '2026-08-21T00:00:00.000Z',
      },
    })).toEqual({ status: 400, body: { error: 'Unsupported delegation scope: admin.submit' } });
  });

  it('revokes by route identifier, rejects body fields and propagates correlation metadata', () => {
    const port = new FakePort();
    const transport = new DelegationHttpTransport(port);

    expect(transport.revoke({ principal, params: { delegationId: 'delegation-1' }, body: { actorId: 'evil' } })).toMatchObject({ status: 400 });

    const response = transport.revoke({
      principal,
      params: { delegationId: ' delegation-1 ' },
      correlationId: 'revoke-1',
    });
    expect(response.status).toBe(200);
    expect(port.revokedId).toBe('delegation-1');
    expect(port.metadata).toEqual({ correlationId: 'revoke-1' });
  });
});
