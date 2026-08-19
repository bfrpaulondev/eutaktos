import { describe, expect, it } from 'vitest';
import {
  createCongregationProfile,
  createDelegation,
  isDelegationActiveAt,
} from './congregation';

describe('congregation profile', () => {
  it('normalizes profile fields and validates weekly meeting slots', () => {
    const profile = createCongregationProfile({
      tenantId: 'tenant-a',
      name: '  Lisboa   Centro  ',
      timezone: 'Europe/Lisbon',
      defaultLocale: 'pt-pt',
      midweekMeeting: { weekday: 3, localTime: '20:00' },
      weekendMeeting: { weekday: 0, localTime: '10:00' },
    });

    expect(profile.name).toBe('Lisboa Centro');
    expect(profile.defaultLocale).toBe('pt-PT');
    expect(profile.timezone).toBe('Europe/Lisbon');
  });

  it('rejects invalid timezones, local times and duplicate meeting slots', () => {
    expect(() => createCongregationProfile({
      tenantId: 'tenant-a', name: 'A', timezone: 'Not/AZone', defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 3, localTime: '20:00' }, weekendMeeting: { weekday: 0, localTime: '10:00' },
    })).toThrow('valid IANA timezone');

    expect(() => createCongregationProfile({
      tenantId: 'tenant-a', name: 'A', timezone: 'Europe/Lisbon', defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 3, localTime: '8pm' }, weekendMeeting: { weekday: 0, localTime: '10:00' },
    })).toThrow('24-hour HH:mm');

    expect(() => createCongregationProfile({
      tenantId: 'tenant-a', name: 'A', timezone: 'Europe/Lisbon', defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 3, localTime: '20:00' }, weekendMeeting: { weekday: 3, localTime: '20:00' },
    })).toThrow('same weekly slot');
  });
});

describe('delegation', () => {
  const delegation = {
    tenantId: 'tenant-a',
    grantorId: 'person-a',
    delegateId: 'person-b',
    scopes: ['reports.submit', 'availability.submit', 'reports.submit'] as const,
    startsAt: '2026-08-01T00:00:00Z',
    endsAt: '2026-09-01T00:00:00Z',
    grantedAt: '2026-07-31T12:00:00Z',
  };

  it('deduplicates scopes and evaluates half-open validity windows', () => {
    const created = createDelegation(delegation);
    expect(created.scopes).toEqual(['availability.submit', 'reports.submit']);
    expect(isDelegationActiveAt(created, '2026-08-20T10:00:00Z', 'reports.submit')).toBe(true);
    expect(isDelegationActiveAt(created, '2026-09-01T00:00:00Z', 'reports.submit')).toBe(false);
    expect(isDelegationActiveAt(created, '2026-08-20T10:00:00Z', 'requests.submit')).toBe(false);
  });

  it('rejects self delegation and invalid windows', () => {
    expect(() => createDelegation({ ...delegation, delegateId: 'person-a' })).toThrow('delegate to themselves');
    expect(() => createDelegation({ ...delegation, endsAt: delegation.startsAt })).toThrow('end after it starts');
    expect(() => createDelegation({ ...delegation, scopes: [] })).toThrow('at least one scope');
  });
});
