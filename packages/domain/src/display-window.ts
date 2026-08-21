export type DisplayWindowClassification = 'upcoming' | 'active' | 'expired';

export interface DisplayWindow {
  readonly displayFrom: string | null;
  readonly expiresAt: string | null;
}

function parseInstant(value: unknown, field: string): number {
  if (typeof value !== 'string') throw new Error(`${field} must be an ISO date string`);
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`Invalid ISO date: ${value}`);
  return timestamp;
}

function parseOptionalInstant(value: unknown, field: string): number | null {
  return value === null ? null : parseInstant(value, field);
}

function parseWindow(window: DisplayWindow): {
  readonly displayFrom: number | null;
  readonly expiresAt: number | null;
} {
  const displayFrom = parseOptionalInstant(window.displayFrom, 'displayFrom');
  const expiresAt = parseOptionalInstant(window.expiresAt, 'expiresAt');

  if (displayFrom !== null && expiresAt !== null && expiresAt <= displayFrom) {
    throw new Error('expiresAt must be after displayFrom');
  }

  return { displayFrom, expiresAt };
}

/**
 * Validates and classifies a display window. A window is upcoming before its
 * start, expired at or after its expiry, and active otherwise. Passing `at`
 * makes classification deterministic for tests and domain workflows.
 */
export function classifyDisplayWindow(
  window: DisplayWindow,
  at?: string,
): DisplayWindowClassification {
  const { displayFrom, expiresAt } = parseWindow(window);
  const timestamp = at === undefined ? Date.now() : parseInstant(at, 'at');

  if (displayFrom !== null && displayFrom > timestamp) return 'upcoming';
  if (expiresAt !== null && expiresAt <= timestamp) return 'expired';
  return 'active';
}

/**
 * Validates a display window. `displayFrom` and `expiresAt` may be null; when
 * both are supplied, expiry must be strictly after the start instant.
 */
export function validateDisplayWindow(window: DisplayWindow): void {
  parseWindow(window);
}

/** Creates an immutable, validated display window. */
export function createDisplayWindow(
  displayFrom: string | null,
  expiresAt: string | null,
): Readonly<DisplayWindow> {
  const window = { displayFrom, expiresAt };
  validateDisplayWindow(window);
  return Object.freeze(window);
}
