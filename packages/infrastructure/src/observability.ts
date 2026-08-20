export type SafeLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface SafeLogMetadata {
  correlationId?: string;
  requestId?: string;
  routeTemplate?: string;
  httpMethod?: string;
  httpStatus?: number;
  durationMs?: number;
  errorName?: string;
  errorCode?: string;
  eventType?: string;
  resourceType?: string;
  operation?: string;
  retryCount?: number;
  queueDepth?: number;
  cacheState?: string;
  buildVersion?: string;
  success?: boolean;
}

export interface SafeLogEntry {
  level: SafeLogLevel;
  event: string;
  occurredAt: string;
  metadata: Readonly<SafeLogMetadata>;
}

export interface SafeLogSink {
  write(entry: Readonly<SafeLogEntry>): void;
}

export interface SafeLoggerClock {
  now(): string;
}

const TOKEN = /^[A-Za-z0-9._:-]+$/;
const EVENT = /^[a-z][a-z0-9_.:-]*$/;
const ROUTE_TEMPLATE = /^\/[A-Za-z0-9_./:{}-]*$/;
const HTTP_METHOD = /^[A-Z]{3,10}$/;

function safeToken(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || !TOKEN.test(normalized)) return undefined;
  return normalized;
}

function safeRouteTemplate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > 160 || !ROUTE_TEMPLATE.test(normalized)) return undefined;
  return normalized;
}

function safeMethod(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toUpperCase();
  return HTTP_METHOD.test(normalized) ? normalized : undefined;
}

function safeInteger(value: unknown, min: number, max: number): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
}

function safeDuration(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 86_400_000
    ? value
    : undefined;
}

function assignIfDefined<T extends keyof SafeLogMetadata>(
  target: SafeLogMetadata,
  key: T,
  value: SafeLogMetadata[T] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}

/**
 * Runtime allowlist for observability metadata. Unknown keys are discarded, not
 * copied or stringified. This deliberately excludes tenant/person identifiers,
 * names, contact data, request/response bodies, URLs, tokens, cookies, notes,
 * free-form messages and stack traces.
 */
export function sanitizeLogMetadata(input: unknown): Readonly<SafeLogMetadata> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return Object.freeze({});
  const source = input as Readonly<Record<string, unknown>>;
  const safe: SafeLogMetadata = {};

  assignIfDefined(safe, 'correlationId', safeToken(source.correlationId, 128));
  assignIfDefined(safe, 'requestId', safeToken(source.requestId, 128));
  assignIfDefined(safe, 'routeTemplate', safeRouteTemplate(source.routeTemplate));
  assignIfDefined(safe, 'httpMethod', safeMethod(source.httpMethod));
  assignIfDefined(safe, 'httpStatus', safeInteger(source.httpStatus, 100, 599));
  assignIfDefined(safe, 'durationMs', safeDuration(source.durationMs));
  assignIfDefined(safe, 'errorName', safeToken(source.errorName, 80));
  assignIfDefined(safe, 'errorCode', safeToken(source.errorCode, 80));
  assignIfDefined(safe, 'eventType', safeToken(source.eventType, 80));
  assignIfDefined(safe, 'resourceType', safeToken(source.resourceType, 80));
  assignIfDefined(safe, 'operation', safeToken(source.operation, 80));
  assignIfDefined(safe, 'retryCount', safeInteger(source.retryCount, 0, 1_000_000));
  assignIfDefined(safe, 'queueDepth', safeInteger(source.queueDepth, 0, 1_000_000));
  assignIfDefined(safe, 'cacheState', safeToken(source.cacheState, 40));
  assignIfDefined(safe, 'buildVersion', safeToken(source.buildVersion, 80));
  assignIfDefined(safe, 'success', typeof source.success === 'boolean' ? source.success : undefined);

  return Object.freeze(safe);
}

function safeEventName(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 80 && EVENT.test(normalized) ? normalized : 'invalid_event';
}

function safeInstant(value: string): string {
  return Number.isFinite(Date.parse(value)) ? value : '1970-01-01T00:00:00.000Z';
}

function safeErrorMetadata(error: unknown): Readonly<Pick<SafeLogMetadata, 'errorName' | 'errorCode'>> {
  if (!error || typeof error !== 'object') return Object.freeze({ errorName: 'Error' });
  const candidate = error as { name?: unknown; code?: unknown };
  return Object.freeze({
    errorName: safeToken(candidate.name, 80) ?? 'Error',
    ...(safeToken(candidate.code, 80) ? { errorCode: safeToken(candidate.code, 80) } : {}),
  });
}

/**
 * Privacy-minimized structured logger. The logger intentionally has no free-form
 * message API. Sink failures are swallowed so telemetry can never change business
 * behavior or turn an observability outage into an application outage.
 */
export class SafeLogger {
  readonly #sink: SafeLogSink;
  readonly #clock: SafeLoggerClock;

  constructor(sink: SafeLogSink, clock: SafeLoggerClock = { now: () => new Date().toISOString() }) {
    this.#sink = sink;
    this.#clock = clock;
  }

  log(level: SafeLogLevel, event: string, metadata: unknown = {}): void {
    const entry: Readonly<SafeLogEntry> = Object.freeze({
      level,
      event: safeEventName(event),
      occurredAt: safeInstant(this.#clock.now()),
      metadata: sanitizeLogMetadata(metadata),
    });

    try {
      this.#sink.write(entry);
    } catch {
      // Observability must be fail-safe and must not affect the application path.
    }
  }

  debug(event: string, metadata?: unknown): void { this.log('debug', event, metadata); }
  info(event: string, metadata?: unknown): void { this.log('info', event, metadata); }
  warn(event: string, metadata?: unknown): void { this.log('warn', event, metadata); }
  error(event: string, metadata?: unknown): void { this.log('error', event, metadata); }

  failure(event: string, error: unknown, metadata: unknown = {}): void {
    const merged = {
      ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? metadata as Readonly<Record<string, unknown>>
        : {}),
      ...safeErrorMetadata(error),
    };
    this.error(event, merged);
  }
}

export class InMemorySafeLogSink implements SafeLogSink {
  readonly #entries: Readonly<SafeLogEntry>[] = [];

  write(entry: Readonly<SafeLogEntry>): void {
    this.#entries.push(Object.freeze({ ...entry, metadata: Object.freeze({ ...entry.metadata }) }));
  }

  entries(): readonly Readonly<SafeLogEntry>[] {
    return Object.freeze([...this.#entries]);
  }
}
