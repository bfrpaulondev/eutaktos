import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  createNotificationPreferences,
  normalizeNotificationPreferences,
  resolvePreferredChannel,
} from '@eutaktos/domain';

const migrationUrl = new URL('../supabase/migrations/20260827084500_notification_preferences_safe_defaults.sql', import.meta.url);

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

  it('backfills existing people and provisions future people without adding any external opt-in', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toContain("where person.entity_type = 'person'");
    expect(sql).toContain("after insert on public.eutaktos_entities");
    expect(sql).toContain("when (new.entity_type = 'person')");
    expect(sql).toContain("'channel', 'in-app', 'enabled', true, 'optedIn', true");
    for (const channel of ['push', 'email', 'whatsapp']) {
      expect(sql).toContain(`'channel', '${channel}', 'enabled', false, 'optedIn', false`);
    }
    expect(sql).toContain("where entity_type = 'notification-preferences'");
    expect(sql).toContain("existing.data->>'personId' = new.entity_id");
    expect(sql).toContain('on conflict do nothing');
  });

  it('does not create an HTTP mutation surface that could consent for another person', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    expect(sql).not.toMatch(/email[^\n]*optedIn[^\n]*true/i);
    expect(sql).not.toMatch(/whatsapp[^\n]*optedIn[^\n]*true/i);
    expect(sql).not.toMatch(/push[^\n]*optedIn[^\n]*true/i);
    expect(sql).not.toContain('grant execute');
  });
});
