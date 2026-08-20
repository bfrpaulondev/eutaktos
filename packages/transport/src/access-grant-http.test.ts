import { describe, expect, it, vi } from 'vitest';
import type { AccessContext, AccessGrant } from '@eutaktos/domain';
import type { GrantCapabilityInput, RequestMetadata } from '@eutaktos/application';
import { AccessGrantHttpTransport, type AccessGrantPort } from './access-grant-http';

const grant: Readonly<AccessGrant> = {
  id: 'grant-1',
  tenantId: 'tenant-a',
  subjectId: 'person-a',
  capability: 'people.read',
  grantedBy: 'admin-a',
  grantedAt: '2026-08-20T10:00:00.000Z',
};

function principal(capabilities: AccessContext['capabilities'] = ['access.manage']) {
  return { tenantId: 'tenant-a', actorId: 'admin-a', capabilities };
}

function port(): AccessGrantPort {
  return {
    listBySubject: vi.fn(() => [grant]),
    grant: vi.fn((_context: AccessContext, _input: GrantCapabilityInput, _metadata?: RequestMetadata) => grant),
    revoke: vi.fn(() => ({ ...grant, revokedAt: '2026-08-20T11:00:00.000Z' })),
  };
}

describe('AccessGrantHttpTransport', () => {
  it('requires authentication and never trusts tenant/actor from request bodies', () => {
    const grants = port();
    expect(new AccessGrantHttpTransport(grants).grant({ body: { subjectId: 'person-a', capability: 'people.read' } }).status).toBe(401);
    expect(grants.grant).not.toHaveBeenCalled();
  });

  it('passes only strict subject+capability input and verified principal context', () => {
    const grants = port();
    const response = new AccessGrantHttpTransport(grants).grant({
      principal: principal(),
      correlationId: 'request-1',
      body: { subjectId: 'person-a', capability: 'people.read' },
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: 'grant-1', subjectId: 'person-a', capability: 'people.read', grantedAt: '2026-08-20T10:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('tenant-a');
    expect(JSON.stringify(response.body)).not.toContain('admin-a');
    expect(grants.grant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a', actorId: 'admin-a', capabilities: ['access.manage'] }),
      { subjectId: 'person-a', capability: 'people.read' },
      { correlationId: 'request-1' },
    );
  });

  it('rejects mass assignment and unsupported capabilities', () => {
    const grants = port();
    const transport = new AccessGrantHttpTransport(grants);
    expect(transport.grant({
      principal: principal(),
      body: { subjectId: 'person-a', capability: 'people.read', tenantId: 'tenant-b' },
    })).toEqual({ status: 400, body: { error: 'Unknown request fields: tenantId' } });
    expect(transport.grant({ principal: principal(), body: { subjectId: 'person-a', capability: 'root.all' } }).status).toBe(400);
    expect(grants.grant).not.toHaveBeenCalled();
  });

  it('lists and revokes using path identifiers without request bodies', () => {
    const grants = port();
    const transport = new AccessGrantHttpTransport(grants);
    expect(transport.listBySubject({ principal: principal(), params: { subjectId: 'person-a' } }).status).toBe(200);
    expect(transport.revoke({ principal: principal(), params: { grantId: 'grant-1' } }).status).toBe(200);
    expect(grants.listBySubject).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a' }), 'person-a');
    expect(grants.revoke).toHaveBeenCalledWith(expect.objectContaining({ actorId: 'admin-a' }), 'grant-1', {});
  });

  it('maps access denial and not-found errors without leaking internals', () => {
    const denied = port();
    denied.listBySubject = () => { throw new Error('Access denied: missing capability access.manage'); };
    expect(new AccessGrantHttpTransport(denied).listBySubject({ principal: principal([]), params: { subjectId: 'person-a' } }))
      .toEqual({ status: 403, body: { error: 'Forbidden' } });

    const missing = port();
    missing.revoke = () => { throw new Error('Access grant not found'); };
    expect(new AccessGrantHttpTransport(missing).revoke({ principal: principal(), params: { grantId: 'foreign' } }))
      .toEqual({ status: 404, body: { error: 'Access grant not found' } });
  });
});
