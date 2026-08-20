import { describe, expect, it, vi } from 'vitest';
import {
  createAccessContext,
  createAuditEvent,
  type AccessContext,
  type AuditEvent,
} from '@eutaktos/domain';
import type { AuditHistoryQuery } from '@eutaktos/application';
import { AuditHistoryHttpTransport, type AuditHistoryPort } from './audit-history-http';

function event(): Readonly<AuditEvent> {
  return createAuditEvent({
    id: 'audit-1',
    tenantId: 'tenant-a',
    resourceType: 'person',
    resourceId: 'person-1',
    action: 'update',
    actorId: 'actor-1',
    occurredAt: '2026-08-20T10:00:00.000Z',
    changedFields: ['displayName'],
  });
}

function principal(capabilities: AccessContext['capabilities'] = ['audit.read']) {
  return { tenantId: 'tenant-a', actorId: 'reviewer-a', capabilities };
}

describe('AuditHistoryHttpTransport', () => {
  it('requires an authenticated principal', () => {
    const port: AuditHistoryPort = { list: vi.fn(() => []) };
    const response = new AuditHistoryHttpTransport(port).list({});
    expect(response).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(port.list).not.toHaveBeenCalled();
  });

  it('passes verified principal context and strict filters to the application port', () => {
    const list = vi.fn((_context: AccessContext, _query?: AuditHistoryQuery) => [event()]);
    const response = new AuditHistoryHttpTransport({ list }).list({
      principal: principal(),
      query: {
        resourceType: 'person',
        resourceId: 'person-1',
        action: 'update',
        actorId: 'actor-1',
        from: '2026-08-20T00:00:00.000Z',
        to: '2026-08-21T00:00:00.000Z',
        limit: '25',
      },
    });

    expect(response).toEqual({
      status: 200,
      body: [{
        id: 'audit-1',
        resourceType: 'person',
        resourceId: 'person-1',
        action: 'update',
        actorId: 'actor-1',
        occurredAt: '2026-08-20T10:00:00.000Z',
        changedFields: ['displayName'],
      }],
    });
    const [context, query] = list.mock.calls[0] ?? [];
    expect(context).toMatchObject({ tenantId: 'tenant-a', actorId: 'reviewer-a', capabilities: ['audit.read'] });
    expect(query).toEqual({
      resourceType: 'person',
      resourceId: 'person-1',
      action: 'update',
      actorId: 'actor-1',
      from: '2026-08-20T00:00:00.000Z',
      to: '2026-08-21T00:00:00.000Z',
      limit: 25,
    });
  });

  it('does not expose tenantId in the audit DTO', () => {
    const response = new AuditHistoryHttpTransport({ list: () => [event()] }).list({ principal: principal() });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain('tenant-a');
    expect(response.body).not.toHaveProperty('tenantId');
  });

  it('rejects tenant/capability mass-assignment and unknown query fields', () => {
    const port: AuditHistoryPort = { list: vi.fn(() => []) };
    const transport = new AuditHistoryHttpTransport(port);

    const response = transport.list({
      principal: principal(),
      query: { tenantId: 'tenant-b', capabilities: 'tenant.manage' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Unknown query fields: capabilities, tenantId' });
    expect(port.list).not.toHaveBeenCalled();
  });

  it('rejects unsupported enums, non-string query values and request bodies', () => {
    const port: AuditHistoryPort = { list: vi.fn(() => []) };
    const transport = new AuditHistoryHttpTransport(port);

    expect(transport.list({ principal: principal(), query: { resourceType: 'secret' } }).status).toBe(400);
    expect(transport.list({ principal: principal(), query: { limit: 10 } }).status).toBe(400);
    expect(transport.list({ principal: principal(), body: {} }).status).toBe(400);
    expect(port.list).not.toHaveBeenCalled();
  });

  it('maps capability denial to 403 and hides internal/cross-tenant failures', () => {
    const forbidden = new AuditHistoryHttpTransport({
      list(context) {
        createAccessContext(context);
        throw new Error('Access denied: missing capability audit.read');
      },
    }).list({ principal: principal([]) });
    expect(forbidden).toEqual({ status: 403, body: { error: 'Forbidden' } });

    const hidden = new AuditHistoryHttpTransport({
      list() {
        throw new Error('Cross-tenant audit access denied: tenant-b');
      },
    }).list({ principal: principal() });
    expect(hidden).toEqual({ status: 500, body: { error: 'Internal server error' } });
    expect(JSON.stringify(hidden)).not.toContain('tenant-b');
  });
});
