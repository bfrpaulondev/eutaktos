import { describe, it, expect } from 'vitest';
import {
  createNotificationPreferences,
  normalizeNotificationPreferences,
  getChannelConfig,
  isChannelActive,
  getActiveChannels,
  updateChannel,
  setPreferredChannel,
  resolvePreferredChannel,
  assertNotificationPreferenceTenant,
  filterByTenant,
  findByPerson,
  optIn,
  optOut,
  DEFAULT_CHANNEL_CONFIGS,
  NOTIFICATION_CHANNELS,
} from './notification-preferences';
import type { NotificationPreferences } from './notification-preferences';

const NOW = '2026-08-21T12:00:00.000Z';
const TENANT_A = 'tenant-aaa';
const TENANT_B = 'tenant-bbb';
const PERSON_1 = 'person-001';
const PERSON_2 = 'person-002';
const MALFORMED_BOOLEAN_VALUES: readonly unknown[] = Object.freeze([
  1,
  0,
  'true',
  'false',
  '',
  null,
  undefined,
  {},
  [],
]);

// ── createNotificationPreferences ───────────────────────────────────────

describe('createNotificationPreferences', () => {
  it('creates preferences with safe defaults', () => {
    const prefs = createNotificationPreferences({
      id: 'np-1',
      tenantId: TENANT_A,
      personId: PERSON_1,
      now: NOW,
    });

    expect(prefs.id).toBe('np-1');
    expect(prefs.tenantId).toBe(TENANT_A);
    expect(prefs.personId).toBe(PERSON_1);
    expect(prefs.updatedAt).toBe(NOW);
    expect(prefs.channels).toHaveLength(4);
    expect(prefs.preferredChannel).toBe('in-app');
  });

  it('freezes the returned object', () => {
    const prefs = createNotificationPreferences({
      id: 'np-2',
      tenantId: TENANT_A,
      personId: PERSON_1,
      now: NOW,
    });

    expect(Object.isFrozen(prefs)).toBe(true);
    expect(Object.isFrozen(prefs.channels)).toBe(true);
  });

  it('only enables in-app by default', () => {
    const prefs = createNotificationPreferences({
      id: 'np-3',
      tenantId: TENANT_A,
      personId: PERSON_1,
      now: NOW,
    });

    for (const cfg of prefs.channels) {
      if (cfg.channel === 'in-app') {
        expect(cfg.enabled).toBe(true);
        expect(cfg.optedIn).toBe(true);
      } else {
        expect(cfg.enabled).toBe(false);
        expect(cfg.optedIn).toBe(false);
      }
    }
  });

  it('throws on empty id', () => {
    expect(() =>
      createNotificationPreferences({
        id: '  ',
        tenantId: TENANT_A,
        personId: PERSON_1,
        now: NOW,
      }),
    ).toThrow('notificationPreferenceId is required');
  });

  it('throws on empty tenantId', () => {
    expect(() =>
      createNotificationPreferences({
        id: 'np-x',
        tenantId: '',
        personId: PERSON_1,
        now: NOW,
      }),
    ).toThrow('tenantId is required');
  });

  it('throws on empty personId', () => {
    expect(() =>
      createNotificationPreferences({
        id: 'np-x',
        tenantId: TENANT_A,
        personId: '   ',
        now: NOW,
      }),
    ).toThrow('personId is required');
  });

  it('throws on invalid date', () => {
    expect(() =>
      createNotificationPreferences({
        id: 'np-x',
        tenantId: TENANT_A,
        personId: PERSON_1,
        now: 'not-a-date',
      }),
    ).toThrow('Invalid ISO date');
  });
});

// ── normalizeNotificationPreferences ────────────────────────────────────

describe('normalizeNotificationPreferences', () => {
  const validPrefs: NotificationPreferences = {
    id: 'np-n1',
    tenantId: TENANT_A,
    personId: PERSON_1,
    channels: [
      { channel: 'in-app', enabled: true, optedIn: true },
      { channel: 'push', enabled: true, optedIn: true },
      { channel: 'email', enabled: false, optedIn: false },
      { channel: 'whatsapp', enabled: false, optedIn: false },
    ],
    preferredChannel: 'push',
    updatedAt: NOW,
  };

  it('normalizes a valid input', () => {
    const result = normalizeNotificationPreferences(validPrefs);
    expect(result.id).toBe('np-n1');
    expect(result.preferredChannel).toBe('push');
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws on duplicate channel', () => {
    const dup = {
      ...validPrefs,
      channels: [
        { channel: 'in-app', enabled: true, optedIn: true },
        { channel: 'in-app', enabled: false, optedIn: false },
        { channel: 'push', enabled: false, optedIn: false },
        { channel: 'email', enabled: false, optedIn: false },
      ],
    };
    expect(() => normalizeNotificationPreferences(dup as NotificationPreferences)).toThrow(
      'Duplicate channel config',
    );
  });

  it('throws on missing channel', () => {
    const missing = {
      ...validPrefs,
      channels: [
        { channel: 'in-app', enabled: true, optedIn: true },
        { channel: 'push', enabled: false, optedIn: false },
        { channel: 'email', enabled: false, optedIn: false },
      ],
    };
    expect(() => normalizeNotificationPreferences(missing as NotificationPreferences)).toThrow(
      'Missing channel config',
    );
  });

  it('throws on unknown channel', () => {
    const unknown = {
      ...validPrefs,
      channels: [
        { channel: 'in-app', enabled: true, optedIn: true },
        { channel: 'push', enabled: false, optedIn: false },
        { channel: 'email', enabled: false, optedIn: false },
        { channel: 'sms', enabled: false, optedIn: false },
      ],
    };
    expect(() => normalizeNotificationPreferences(unknown as NotificationPreferences)).toThrow(
      'Unknown notification channel',
    );
  });

  it('accepts null preferredChannel', () => {
    const result = normalizeNotificationPreferences({
      ...validPrefs,
      preferredChannel: null,
    });
    expect(result.preferredChannel).toBeNull();
  });

  it.each(MALFORMED_BOOLEAN_VALUES)(
    'rejects malformed enabled value %p during normalization without coercion',
    malformedValue => {
      expect(() => normalizeNotificationPreferences({
        ...validPrefs,
        channels: [
          { channel: 'in-app', enabled: malformedValue as boolean, optedIn: false },
          { channel: 'push', enabled: false, optedIn: false },
          { channel: 'email', enabled: false, optedIn: false },
          { channel: 'whatsapp', enabled: false, optedIn: false },
        ],
      } as NotificationPreferences)).toThrow('channels[0].enabled must be a boolean');
    },
  );

  it.each(MALFORMED_BOOLEAN_VALUES)(
    'rejects malformed optedIn value %p during normalization without granting consent',
    malformedValue => {
      expect(() => normalizeNotificationPreferences({
        ...validPrefs,
        channels: [
          { channel: 'in-app', enabled: false, optedIn: malformedValue as boolean },
          { channel: 'push', enabled: false, optedIn: false },
          { channel: 'email', enabled: false, optedIn: false },
          { channel: 'whatsapp', enabled: false, optedIn: false },
        ],
      } as NotificationPreferences)).toThrow('channels[0].optedIn must be a boolean');
    },
  );

  it('trims id/tenantId/personId', () => {
    const result = normalizeNotificationPreferences({
      ...validPrefs,
      id: '  np-trim  ',
      tenantId: '  t-1  ',
      personId: '  p-1  ',
    });
    expect(result.id).toBe('np-trim');
    expect(result.tenantId).toBe('t-1');
    expect(result.personId).toBe('p-1');
  });
});

// ── getChannelConfig ────────────────────────────────────────────────────

describe('getChannelConfig', () => {
  const prefs = createNotificationPreferences({ id: 'np-gcc', tenantId: TENANT_A, personId: PERSON_1, now: NOW });

  it('returns config for existing channel', () => {
    const cfg = getChannelConfig(prefs, 'in-app');
    expect(cfg).toBeDefined();
    expect(cfg?.channel).toBe('in-app');
  });

  it('returns undefined for unknown channel', () => {
    expect(() => getChannelConfig(prefs, 'sms' as any)).toThrow('Unknown notification channel');
  });
});

// ── isChannelActive ─────────────────────────────────────────────────────

describe('isChannelActive', () => {
  it('returns true only when both enabled and optedIn', () => {
    const prefs = createNotificationPreferences({ id: 'np-ica', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    expect(isChannelActive(prefs, 'in-app')).toBe(true);  // default: enabled+opted
    expect(isChannelActive(prefs, 'push')).toBe(false);    // default: disabled+not opted
  });

  it('returns false when enabled but not opted-in', () => {
    const prefs = updateChannel(
      createNotificationPreferences({ id: 'np-icb', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
      'push',
      { enabled: true },
      NOW,
    );
    expect(isChannelActive(prefs, 'push')).toBe(false);
  });
});

// ── getActiveChannels ───────────────────────────────────────────────────

describe('getActiveChannels', () => {
  it('returns only active channels in canonical order', () => {
    const prefs = createNotificationPreferences({ id: 'np-gac', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const active = getActiveChannels(prefs);
    expect(active).toEqual(['in-app']);
  });

  it('returns empty array when no channels are active', () => {
    let prefs = createNotificationPreferences({ id: 'np-gac2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    prefs = optOut(prefs, 'in-app', NOW);
    expect(getActiveChannels(prefs)).toEqual([]);
  });
});

// ── updateChannel ───────────────────────────────────────────────────────

describe('updateChannel', () => {
  it('updates enabled state', () => {
    const base = createNotificationPreferences({ id: 'np-uc', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = updateChannel(base, 'push', { enabled: true }, '2026-08-21T13:00:00.000Z');

    const pushCfg = getChannelConfig(updated, 'push');
    expect(pushCfg?.enabled).toBe(true);
    expect(pushCfg?.optedIn).toBe(false); // unchanged
    expect(updated.updatedAt).toBe('2026-08-21T13:00:00.000Z');
  });

  it('updates optedIn state', () => {
    const base = createNotificationPreferences({ id: 'np-uc2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = updateChannel(base, 'email', { optedIn: true }, NOW);

    const emailCfg = getChannelConfig(updated, 'email');
    expect(emailCfg?.optedIn).toBe(true);
    expect(emailCfg?.enabled).toBe(false); // unchanged
  });

  it('does not mutate the original', () => {
    const base = createNotificationPreferences({ id: 'np-uc3', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    updateChannel(base, 'push', { enabled: true }, NOW);

    const pushCfg = getChannelConfig(base, 'push');
    expect(pushCfg?.enabled).toBe(false);
  });

  it('throws on invalid channel', () => {
    const base = createNotificationPreferences({ id: 'np-uc4', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    expect(() => updateChannel(base, 'sms' as any, { enabled: true }, NOW)).toThrow(
      'Unknown notification channel',
    );
  });

  it('throws on invalid date', () => {
    const base = createNotificationPreferences({ id: 'np-uc5', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    expect(() => updateChannel(base, 'push', { enabled: true }, 'bad')).toThrow('Invalid ISO date');
  });

  it.each(MALFORMED_BOOLEAN_VALUES)(
    'rejects malformed enabled patch value %p without coercion',
    malformedValue => {
      const base = createNotificationPreferences({ id: 'np-uc-enabled', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
      expect(() => updateChannel(
        base,
        'push',
        { enabled: malformedValue } as unknown as { enabled?: boolean; optedIn?: boolean },
        NOW,
      )).toThrow('patch.enabled must be a boolean');
      expect(getChannelConfig(base, 'push')?.enabled).toBe(false);
    },
  );

  it.each(MALFORMED_BOOLEAN_VALUES)(
    'rejects malformed optedIn patch value %p without granting consent',
    malformedValue => {
      const base = createNotificationPreferences({ id: 'np-uc-opted-in', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
      expect(() => updateChannel(
        base,
        'push',
        { optedIn: malformedValue } as unknown as { enabled?: boolean; optedIn?: boolean },
        NOW,
      )).toThrow('patch.optedIn must be a boolean');
      expect(getChannelConfig(base, 'push')?.optedIn).toBe(false);
    },
  );
});

// ── setPreferredChannel ─────────────────────────────────────────────────

describe('setPreferredChannel', () => {
  it('sets a valid preferred channel', () => {
    const base = createNotificationPreferences({ id: 'np-spc', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = setPreferredChannel(base, 'push', NOW);
    expect(updated.preferredChannel).toBe('push');
  });

  it('clears preferred channel with null', () => {
    const base = createNotificationPreferences({ id: 'np-spc2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = setPreferredChannel(base, null, NOW);
    expect(updated.preferredChannel).toBeNull();
  });

  it('throws on unknown channel', () => {
    const base = createNotificationPreferences({ id: 'np-spc3', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    expect(() => setPreferredChannel(base, 'telegram' as any, NOW)).toThrow(
      'Unknown notification channel',
    );
  });
});

// ── resolvePreferredChannel ─────────────────────────────────────────────

describe('resolvePreferredChannel', () => {
  it('returns preferred channel if active', () => {
    let prefs = createNotificationPreferences({ id: 'np-rpc', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    prefs = updateChannel(prefs, 'push', { enabled: true, optedIn: true }, NOW);
    prefs = setPreferredChannel(prefs, 'push', NOW);

    expect(resolvePreferredChannel(prefs)).toBe('push');
  });

  it('falls back to first active channel if preferred is inactive', () => {
    let prefs = createNotificationPreferences({ id: 'np-rpc2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    prefs = setPreferredChannel(prefs, 'push', NOW); // push is not active

    // in-app is still active, so it should be the fallback
    expect(resolvePreferredChannel(prefs)).toBe('in-app');
  });

  it('returns null when no channel is active', () => {
    let prefs = createNotificationPreferences({ id: 'np-rpc3', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    prefs = optOut(prefs, 'in-app', NOW);
    prefs = setPreferredChannel(prefs, null, NOW);

    expect(resolvePreferredChannel(prefs)).toBeNull();
  });
});

// ── Tenant isolation ────────────────────────────────────────────────────

describe('assertNotificationPreferenceTenant', () => {
  const prefs = createNotificationPreferences({ id: 'np-ti', tenantId: TENANT_A, personId: PERSON_1, now: NOW });

  it('passes for matching tenant', () => {
    expect(() => assertNotificationPreferenceTenant(prefs, TENANT_A)).not.toThrow();
  });

  it('throws for different tenant', () => {
    expect(() => assertNotificationPreferenceTenant(prefs, TENANT_B)).toThrow(
      'Cross-tenant notification preference access denied',
    );
  });
});

describe('filterByTenant', () => {
  it('returns only matching tenant preferences', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-fb1', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
      createNotificationPreferences({ id: 'np-fb2', tenantId: TENANT_B, personId: PERSON_2, now: NOW }),
      createNotificationPreferences({ id: 'np-fb3', tenantId: TENANT_A, personId: PERSON_2, now: NOW }),
    ];

    const filtered = filterByTenant(prefs, TENANT_A);
    expect(filtered).toHaveLength(2);
    expect(filtered.every(p => p.tenantId === TENANT_A)).toBe(true);
  });

  it('returns empty array for non-matching tenant', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-fb4', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
    ];

    expect(filterByTenant(prefs, TENANT_B)).toEqual([]);
  });
});

describe('findByPerson', () => {
  it('finds preferences for a person in the correct tenant', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-fp1', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
      createNotificationPreferences({ id: 'np-fp2', tenantId: TENANT_A, personId: PERSON_2, now: NOW }),
      createNotificationPreferences({ id: 'np-fp3', tenantId: TENANT_B, personId: PERSON_1, now: NOW }),
    ];

    const found = findByPerson(prefs, TENANT_A, PERSON_1);
    expect(found?.id).toBe('np-fp1');
  });

  it('returns undefined when person not found in tenant', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-fp4', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
    ];

    expect(findByPerson(prefs, TENANT_A, PERSON_2)).toBeUndefined();
  });

  it('does not return prefs from another tenant even if person matches', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-fp5', tenantId: TENANT_B, personId: PERSON_1, now: NOW }),
    ];

    expect(findByPerson(prefs, TENANT_A, PERSON_1)).toBeUndefined();
  });
});

// ── optIn / optOut ──────────────────────────────────────────────────────

describe('optIn', () => {
  it('marks a channel as opted-in without enabling it', () => {
    const base = createNotificationPreferences({ id: 'np-oi', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = optIn(base, 'email', NOW);

    const cfg = getChannelConfig(updated, 'email');
    expect(cfg?.optedIn).toBe(true);
    expect(cfg?.enabled).toBe(false);
  });

  it('is idempotent', () => {
    const base = createNotificationPreferences({ id: 'np-oi2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const first = optIn(base, 'email', NOW);
    const second = optIn(first, 'email', NOW);

    expect(getChannelConfig(first, 'email')?.optedIn).toBe(true);
    expect(getChannelConfig(second, 'email')?.optedIn).toBe(true);
  });
});

describe('optOut', () => {
  it('disables and opts-out a channel', () => {
    let base = createNotificationPreferences({ id: 'np-oo', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    base = updateChannel(base, 'push', { enabled: true, optedIn: true }, NOW);
    const updated = optOut(base, 'push', NOW);

    const cfg = getChannelConfig(updated, 'push');
    expect(cfg?.optedIn).toBe(false);
    expect(cfg?.enabled).toBe(false);
  });

  it('is idempotent', () => {
    let base = createNotificationPreferences({ id: 'np-oo2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    base = updateChannel(base, 'push', { enabled: true, optedIn: true }, NOW);
    const first = optOut(base, 'push', NOW);
    const second = optOut(first, 'push', NOW);

    expect(getChannelConfig(first, 'push')?.enabled).toBe(false);
    expect(getChannelConfig(second, 'push')?.enabled).toBe(false);
  });

  it('opt-out on already-disabled channel is safe', () => {
    const base = createNotificationPreferences({ id: 'np-oo3', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = optOut(base, 'push', NOW); // push was already disabled

    const cfg = getChannelConfig(updated, 'push');
    expect(cfg?.enabled).toBe(false);
    expect(cfg?.optedIn).toBe(false);
  });
});

// ── DEFAULT_CHANNEL_CONFIGS ─────────────────────────────────────────────

describe('DEFAULT_CHANNEL_CONFIGS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_CHANNEL_CONFIGS)).toBe(true);
  });

  it('contains exactly the known channels', () => {
    const channels = DEFAULT_CHANNEL_CONFIGS.map(c => c.channel);
    expect(channels).toEqual([...NOTIFICATION_CHANNELS]);
  });

  it('each entry is frozen', () => {
    for (const cfg of DEFAULT_CHANNEL_CONFIGS) {
      expect(Object.isFrozen(cfg)).toBe(true);
    }
  });
});

// ── NOTIFICATION_CHANNELS ───────────────────────────────────────────────

describe('NOTIFICATION_CHANNELS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(NOTIFICATION_CHANNELS)).toBe(true);
  });

  it('contains the four supported channels', () => {
    expect(NOTIFICATION_CHANNELS).toEqual(['in-app', 'push', 'email', 'whatsapp']);
  });
});

// ── Immutability ────────────────────────────────────────────────────────

describe('immutability', () => {
  it('createNotificationPreferences returns deeply frozen object', () => {
    const prefs = createNotificationPreferences({ id: 'np-imm', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    expect(Object.isFrozen(prefs)).toBe(true);
    expect(Object.isFrozen(prefs.channels)).toBe(true);
    for (const cfg of prefs.channels) {
      expect(Object.isFrozen(cfg)).toBe(true);
    }
  });

  it('updateChannel returns deeply frozen object', () => {
    const base = createNotificationPreferences({ id: 'np-imm2', tenantId: TENANT_A, personId: PERSON_1, now: NOW });
    const updated = updateChannel(base, 'push', { enabled: true }, NOW);
    expect(Object.isFrozen(updated)).toBe(true);
    expect(Object.isFrozen(updated.channels)).toBe(true);
  });

  it('normalizeNotificationPreferences returns deeply frozen object', () => {
    const result = normalizeNotificationPreferences({
      id: 'np-imm3',
      tenantId: TENANT_A,
      personId: PERSON_1,
      channels: [
        { channel: 'in-app', enabled: true, optedIn: true },
        { channel: 'push', enabled: false, optedIn: false },
        { channel: 'email', enabled: false, optedIn: false },
        { channel: 'whatsapp', enabled: false, optedIn: false },
      ],
      preferredChannel: null,
      updatedAt: NOW,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.channels)).toBe(true);
    for (const cfg of result.channels) {
      expect(Object.isFrozen(cfg)).toBe(true);
    }
  });
});

// ── Cross-tenant safety ─────────────────────────────────────────────────

describe('cross-tenant safety', () => {
  it('cannot access prefs from different tenant via findByPerson', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-ct1', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
    ];

    // Same person ID but different tenant — must not be found
    expect(findByPerson(prefs, TENANT_B, PERSON_1)).toBeUndefined();
  });

  it('filterByTenant never leaks other tenants', () => {
    const prefs = [
      createNotificationPreferences({ id: 'np-ct2', tenantId: TENANT_A, personId: PERSON_1, now: NOW }),
      createNotificationPreferences({ id: 'np-ct3', tenantId: TENANT_B, personId: PERSON_1, now: NOW }),
    ];

    const tenantA = filterByTenant(prefs, TENANT_A);
    expect(tenantA).toHaveLength(1);
    expect(tenantA[0].tenantId).toBe(TENANT_A);

    const tenantB = filterByTenant(prefs, TENANT_B);
    expect(tenantB).toHaveLength(1);
    expect(tenantB[0].tenantId).toBe(TENANT_B);
  });
});
