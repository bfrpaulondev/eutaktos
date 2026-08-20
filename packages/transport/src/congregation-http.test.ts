import { describe, expect, it, vi } from 'vitest';
import type {
  AccessContext,
  CongregationProfile,
} from '@eutaktos/domain';
import type {
  RequestMetadata,
  SaveCongregationSettingsInput,
} from '@eutaktos/application';
import {
  CongregationSettingsHttpTransport,
  type CongregationSettingsPort,
} from './congregation-http';

function profile(): CongregationProfile {
  return {
    tenantId: 'tenant-a',
    name: 'Central Congregation',
    timezone: 'Europe/Lisbon',
    defaultLocale: 'pt-PT',
    midweekMeeting: { weekday: 2, localTime: '19:30' },
    weekendMeeting: { weekday: 0, localTime: '10:00' },
  };
}

function principal(capabilities: AccessContext['capabilities'] = ['tenant.manage']) {
  return {
    tenantId: 'tenant-a',
    actorId: 'admin-1',
    capabilities,
  } as const;
}

function validBody() {
  return {
    name: 'Central Congregation',
    timezone: 'Europe/Lisbon',
    defaultLocale: 'pt-PT',
    midweekMeeting: { weekday: 2, localTime: '19:30' },
    weekendMeeting: { weekday: 0, localTime: '10:00' },
  };
}

function port(overrides: Partial<CongregationSettingsPort> = {}): CongregationSettingsPort {
  return {
    get: () => profile(),
    save: () => profile(),
    ...overrides,
  };
}

describe('CongregationSettingsHttpTransport', () => {
  it('rejects anonymous reads and writes', () => {
    const transport = new CongregationSettingsHttpTransport(port());

    expect(transport.get({})).toEqual({ status: 401, body: { error: 'Unauthorized' } });
    expect(transport.save({ body: validBody() })).toEqual({ status: 401, body: { error: 'Unauthorized' } });
  });

  it('returns a minimized settings DTO without tenant or actor metadata', () => {
    const transport = new CongregationSettingsHttpTransport(port());

    const response = transport.get({ principal: principal() });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(validBody());
    expect(response.body).not.toHaveProperty('tenantId');
    expect(response.body).not.toHaveProperty('actorId');
  });

  it('derives tenant actor and capabilities only from the verified principal', () => {
    let seenContext: AccessContext | undefined;
    let seenInput: SaveCongregationSettingsInput | undefined;
    let seenMetadata: RequestMetadata | undefined;
    const save = vi.fn((context: AccessContext, input: SaveCongregationSettingsInput, metadata?: RequestMetadata) => {
      seenContext = context;
      seenInput = input;
      seenMetadata = metadata;
      return profile();
    });
    const transport = new CongregationSettingsHttpTransport(port({ save }));

    const response = transport.save({
      principal: principal(),
      correlationId: 'request-44',
      body: validBody(),
    });

    expect(response.status).toBe(200);
    expect(seenContext).toMatchObject({
      tenantId: 'tenant-a',
      actorId: 'admin-1',
      capabilities: ['tenant.manage'],
    });
    expect(seenInput).toEqual(validBody());
    expect(seenMetadata).toEqual({ correlationId: 'request-44' });
  });

  it('rejects top-level mass assignment before calling application code', () => {
    const save = vi.fn(() => profile());
    const transport = new CongregationSettingsHttpTransport(port({ save }));

    const response = transport.save({
      principal: principal(),
      body: {
        ...validBody(),
        tenantId: 'tenant-b',
        actorId: 'attacker',
        capabilities: ['tenant.manage'],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Unknown request fields: actorId, capabilities, tenantId',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects unknown nested meeting fields and malformed types', () => {
    const save = vi.fn(() => profile());
    const transport = new CongregationSettingsHttpTransport(port({ save }));

    expect(transport.save({
      principal: principal(),
      body: {
        ...validBody(),
        midweekMeeting: { weekday: 2, localTime: '19:30', tenantId: 'tenant-b' },
      },
    })).toEqual({ status: 400, body: { error: 'Unknown midweekMeeting fields: tenantId' } });

    expect(transport.save({
      principal: principal(),
      body: { ...validBody(), weekendMeeting: { weekday: '0', localTime: '10:00' } },
    })).toEqual({ status: 400, body: { error: 'weekendMeeting.weekday must be an integer' } });

    expect(save).not.toHaveBeenCalled();
  });

  it('maps capability denial without leaking internal authorization details', () => {
    const transport = new CongregationSettingsHttpTransport(port({
      get: () => { throw new Error('Access denied: missing capability tenant.manage'); },
      save: () => { throw new Error('Access denied: missing capability tenant.manage'); },
    }));

    expect(transport.get({ principal: principal([]) })).toEqual({ status: 403, body: { error: 'Forbidden' } });
    expect(transport.save({ principal: principal([]), body: validBody() })).toEqual({ status: 403, body: { error: 'Forbidden' } });
  });

  it('returns 404 when settings are not initialized for the verified tenant', () => {
    const transport = new CongregationSettingsHttpTransport(port({ get: () => undefined }));

    expect(transport.get({ principal: principal() })).toEqual({
      status: 404,
      body: { error: 'Congregation settings not found' },
    });
  });
});
