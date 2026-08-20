import type { PersonId, TenantId } from './people';

// ── Types ──────────────────────────────────────────────────────────────────

export type NotificationPreferenceId = string;

/**
 * Supported notification channels. New channels (e.g. whatsapp) must be added
 * here first. The domain layer never integrates providers — it only models the
 * preference and consent state.
 */
export type NotificationChannel = 'in-app' | 'push' | 'email' | 'whatsapp';

export const NOTIFICATION_CHANNELS: readonly NotificationChannel[] = Object.freeze([
  'in-app',
  'push',
  'email',
  'whatsapp',
] as const);

export interface NotificationChannelConfig {
  readonly channel: NotificationChannel;
  readonly enabled: boolean;
  readonly optedIn: boolean;
}

export interface NotificationPreferences {
  readonly id: NotificationPreferenceId;
  readonly tenantId: TenantId;
  readonly personId: PersonId;
  readonly channels: readonly NotificationChannelConfig[];
  readonly preferredChannel: NotificationChannel | null;
  readonly updatedAt: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function required(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
}

function assertValidChannel(channel: string): NotificationChannel {
  if (!NOTIFICATION_CHANNELS.includes(channel as NotificationChannel)) {
    throw new Error(`Unknown notification channel: ${channel}`);
  }
  return channel as NotificationChannel;
}

// ── Safe defaults ──────────────────────────────────────────────────────────

/**
 * In-app is the only channel enabled and opted-in by default because it
 * requires no external provider and has no privacy implications.
 * All other channels are disabled and not opted-in, requiring explicit consent.
 */
export const DEFAULT_CHANNEL_CONFIGS: ReadonlyArray<NotificationChannelConfig> = Object.freeze([
  Object.freeze({ channel: 'in-app', enabled: true, optedIn: true }),
  Object.freeze({ channel: 'push', enabled: false, optedIn: false }),
  Object.freeze({ channel: 'email', enabled: false, optedIn: false }),
  Object.freeze({ channel: 'whatsapp', enabled: false, optedIn: false }),
]);

// ── Construction ───────────────────────────────────────────────────────────

/**
 * Creates a fresh NotificationPreferences with safe defaults.
 * preferredChannel defaults to 'in-app' since it is always enabled.
 */
export function createNotificationPreferences(input: {
  id: NotificationPreferenceId;
  tenantId: TenantId;
  personId: PersonId;
  now: string;
}): Readonly<NotificationPreferences> {
  const id = required(input.id, 'notificationPreferenceId');
  const tenantId = required(input.tenantId, 'tenantId');
  const personId = required(input.personId, 'personId');
  validateInstant(input.now);

  return Object.freeze({
    id,
    tenantId,
    personId,
    channels: DEFAULT_CHANNEL_CONFIGS,
    preferredChannel: 'in-app',
    updatedAt: input.now,
  });
}

// ── Normalization ──────────────────────────────────────────────────────────

/**
 * Validates and normalizes a raw preference object into an immutable
 * NotificationPreferences. Throws on invalid data so that bad state never
 * enters the domain.
 */
export function normalizeNotificationPreferences(
  input: NotificationPreferences,
): Readonly<NotificationPreferences> {
  const id = required(input.id, 'notificationPreferenceId');
  const tenantId = required(input.tenantId, 'tenantId');
  const personId = required(input.personId, 'personId');
  validateInstant(input.updatedAt);

  // Validate channels — exactly one config per known channel, no duplicates
  const seen = new Set<NotificationChannel>();
  const channels = input.channels.map((cfg, i) => {
    const channel = assertValidChannel(cfg.channel);
    if (seen.has(channel)) throw new Error(`Duplicate channel config at index ${i}: ${channel}`);
    seen.add(channel);
    return Object.freeze({
      channel,
      enabled: Boolean(cfg.enabled),
      optedIn: Boolean(cfg.optedIn),
    });
  });

  // Every known channel must have a config entry
  for (const ch of NOTIFICATION_CHANNELS) {
    if (!seen.has(ch)) throw new Error(`Missing channel config: ${ch}`);
  }

  // Validate preferredChannel
  let preferredChannel: NotificationChannel | null = null;
  if (input.preferredChannel !== null && input.preferredChannel !== undefined) {
    preferredChannel = assertValidChannel(input.preferredChannel);
  }

  return Object.freeze({
    id,
    tenantId,
    personId,
    channels: Object.freeze(channels),
    preferredChannel,
    updatedAt: input.updatedAt,
  });
}

// ── Channel operations ─────────────────────────────────────────────────────

/**
 * Returns the config for a specific channel, or undefined if not found.
 */
export function getChannelConfig(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel,
): Readonly<NotificationChannelConfig> | undefined {
  assertValidChannel(channel);
  return prefs.channels.find(c => c.channel === channel);
}

/**
 * Checks whether a channel is both enabled AND opted-in.
 */
export function isChannelActive(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel,
): boolean {
  const cfg = getChannelConfig(prefs, channel);
  return cfg?.enabled === true && cfg?.optedIn === true;
}

/**
 * Returns all channels that are both enabled and opted-in.
 */
export function getActiveChannels(
  prefs: Readonly<NotificationPreferences>,
): readonly NotificationChannel[] {
  return prefs.channels
    .filter(c => c.enabled && c.optedIn)
    .map(c => c.channel);
}

/**
 * Updates a single channel's enabled and optedIn state.
 * Returns a new frozen NotificationPreferences with the updated channel.
 */
export function updateChannel(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel,
  patch: { enabled?: boolean; optedIn?: boolean },
  now: string,
): Readonly<NotificationPreferences> {
  assertValidChannel(channel);
  validateInstant(now);

  const newChannels = prefs.channels.map(cfg => {
    if (cfg.channel !== channel) return cfg;
    return Object.freeze({
      channel,
      enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : cfg.enabled,
      optedIn: patch.optedIn !== undefined ? Boolean(patch.optedIn) : cfg.optedIn,
    });
  });

  return Object.freeze({
    ...prefs,
    channels: Object.freeze(newChannels),
    updatedAt: now,
  });
}

/**
 * Sets the preferred notification channel. The channel must be a valid
 * channel type. Setting it to null clears the preference.
 */
export function setPreferredChannel(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel | null,
  now: string,
): Readonly<NotificationPreferences> {
  validateInstant(now);

  let preferredChannel: NotificationChannel | null = null;
  if (channel !== null && channel !== undefined) {
    preferredChannel = assertValidChannel(channel);
  }

  return Object.freeze({
    ...prefs,
    preferredChannel,
    updatedAt: now,
  });
}

/**
 * Returns the preferred channel if it is active (enabled + opted-in),
 * otherwise falls back to the first active channel.
 * Returns null if no channel is active.
 */
export function resolvePreferredChannel(
  prefs: Readonly<NotificationPreferences>,
): NotificationChannel | null {
  // If preferred channel is set and active, use it
  if (prefs.preferredChannel && isChannelActive(prefs, prefs.preferredChannel)) {
    return prefs.preferredChannel;
  }

  // Fallback: first active channel in canonical order
  const active = getActiveChannels(prefs);
  return active.length > 0 ? active[0] : null;
}

// ── Tenant isolation ───────────────────────────────────────────────────────

/**
 * Asserts that the preferences belong to the given tenant.
 * Throws if tenant IDs do not match.
 */
export function assertNotificationPreferenceTenant(
  prefs: Readonly<NotificationPreferences>,
  tenantId: TenantId,
): void {
  if (prefs.tenantId !== tenantId) {
    throw new Error('Cross-tenant notification preference access denied');
  }
}

/**
 * Filters a list of preferences to only those belonging to the given tenant.
 */
export function filterByTenant(
  prefs: readonly Readonly<NotificationPreferences>[],
  tenantId: TenantId,
): readonly Readonly<NotificationPreferences>[] {
  return prefs.filter(p => p.tenantId === tenantId);
}

/**
 * Finds preferences by person ID within a tenant-scoped list.
 */
export function findByPerson(
  prefs: readonly Readonly<NotificationPreferences>[],
  tenantId: TenantId,
  personId: PersonId,
): Readonly<NotificationPreferences> | undefined {
  return prefs.find(p => p.tenantId === tenantId && p.personId === personId);
}

// ── Opt-in / Opt-out semantics ─────────────────────────────────────────────

/**
 * Marks a channel as opted-in. This represents explicit user consent.
 * Does NOT automatically enable the channel — that is a separate concern.
 */
export function optIn(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel,
  now: string,
): Readonly<NotificationPreferences> {
  return updateChannel(prefs, channel, { optedIn: true }, now);
}

/**
 * Marks a channel as opted-out and disabled.
 * Opting out always disables the channel as a safety measure.
 */
export function optOut(
  prefs: Readonly<NotificationPreferences>,
  channel: NotificationChannel,
  now: string,
): Readonly<NotificationPreferences> {
  return updateChannel(prefs, channel, { optedIn: false, enabled: false }, now);
}
