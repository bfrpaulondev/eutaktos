import { describe, expect, it } from 'vitest';
import {
  createNotificationPreferences,
  normalizeNotificationPreferences,
  resolvePreferredChannel,
} from '@eutaktos/domain';

describe('PX9 notification preference safe-default provisioning', () => {
  it('keeps the canonical default strictly in-app and never implies external consent', () => {
    const value = createNotificationPreferences({
      id: 'notification-preferences:person-1',
      tenantId: 'tenant-a',
      personId: 'person-1',
      now: '2026-08-27T08:45:00.000Z',
    });
    const normalized = normalizeNotificationPreferences(value);

    expect(resolvePreferredChannel(normalized)).toBe('in-app');
    expect(normalized.channels).toEqual([
      { channel: 'in-app', enabled: true, optedIn: true },
      { channel: 'push', enabled: false, optedIn: false },
      { channel: 'email', enabled: false, optedIn: false },
      { channel: 'whatsapp', enabled: false, optedIn: false },
    ]);
  });

  it('keeps external channels inactive even when the preferred channel is changed without consent', () => {
    const value = createNotificationPreferences({
      id: 'notification-preferences:person-2',
      tenantId: 'tenant-a',
      personId: 'person-2',
      now: '2026-08-27T08:45:00.000Z',
    });

    expect(value.channels.filter(channel => channel.channel !== 'in-app').every(channel => !channel.enabled && !channel.optedIn)).toBe(true);
    expect(resolvePreferredChannel(value)).toBe('in-app');
  });
});
