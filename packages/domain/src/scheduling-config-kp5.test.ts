import { describe, expect, it } from 'vitest';
import { createCongregationProfile } from './congregation';
import { createMidweekMeeting } from './midweek-meeting';
import { resolveZonedLocalTime } from './scheduling-time';

describe('KP5 scheduling configuration validation', () => {
  it('accepts Europe/Lisbon and preserves explicit weekly configuration', () => {
    const profile = createCongregationProfile({
      tenantId: 'tenant-a', name: 'Test', timezone: 'Europe/Lisbon', defaultLocale: 'pt-PT',
      midweekMeeting: { weekday: 3, localTime: '19:30' },
      weekendMeeting: { weekday: 0, localTime: '10:00' },
    });
    expect(profile.timezone).toBe('Europe/Lisbon');
    expect(profile.midweekMeeting).toEqual({ weekday: 3, localTime: '19:30' });
  });

  it('rejects invalid or blank timezone, weekday and local time', () => {
    expect(() => createCongregationProfile({ tenantId: 't', name: 'Test', timezone: 'Not/AZone', defaultLocale: 'pt-PT', midweekMeeting: { weekday: 3, localTime: '19:30' }, weekendMeeting: { weekday: 0, localTime: '10:00' } })).toThrow('valid IANA timezone');
    expect(() => createCongregationProfile({ tenantId: 't', name: 'Test', timezone: '   ', defaultLocale: 'pt-PT', midweekMeeting: { weekday: 3, localTime: '19:30' }, weekendMeeting: { weekday: 0, localTime: '10:00' } })).toThrow('timezone is required');
    expect(() => createCongregationProfile({ tenantId: 't', name: 'Test', timezone: 'Europe/Lisbon', defaultLocale: 'pt-PT', midweekMeeting: { weekday: 7 as never, localTime: '19:30' }, weekendMeeting: { weekday: 0, localTime: '10:00' } })).toThrow('weekday must be between 0 and 6');
    expect(() => createMidweekMeeting({ id: 'm', tenantId: 't', date: '2026-08-26', localTime: '25:00', timezone: 'Europe/Lisbon', now: '2026-08-24T00:00:00Z' })).toThrow('24-hour HH:mm');
  });

  it('rejects Lisbon spring-forward nonexistent local times', () => {
    expect(() => resolveZonedLocalTime('2026-03-29', '01:30', 'Europe/Lisbon')).toThrow('does not exist');
  });

  it('resolves Lisbon normal winter and summer times deterministically', () => {
    const winter = resolveZonedLocalTime('2026-01-25', '19:30', 'Europe/Lisbon');
    const summer = resolveZonedLocalTime('2026-07-25', '19:30', 'Europe/Lisbon');
    expect(winter.ambiguous).toBe(false);
    expect(summer.ambiguous).toBe(false);
    expect(winter.instant).not.toBe(summer.instant);
  });

  it('chooses the earlier instant for an autumn ambiguous local time', () => {
    const resolved = resolveZonedLocalTime('2026-10-25', '01:30', 'Europe/Lisbon');
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.instant).toBe('2026-10-25T00:30:00.000Z');
  });
});
