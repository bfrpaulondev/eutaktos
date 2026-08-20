import {
  createAccessContext,
  type AccessContext,
  type CongregationProfile,
  type Weekday,
  type WeeklyMeetingTime,
} from '@eutaktos/domain';
import type {
  RequestMetadata,
  SaveCongregationSettingsInput,
} from '@eutaktos/application';
import type { TransportRequest, TransportResponse, VerifiedPrincipal } from './people-http';

export interface CongregationSettingsDto {
  name: string;
  timezone: string;
  defaultLocale: string;
  midweekMeeting: WeeklyMeetingTime;
  weekendMeeting: WeeklyMeetingTime;
}

export interface CongregationSettingsPort {
  get(context: AccessContext): CongregationProfile | undefined;
  save(
    context: AccessContext,
    input: SaveCongregationSettingsInput,
    metadata?: RequestMetadata,
  ): CongregationProfile;
}

function unauthorized(): TransportResponse<{ error: string }> {
  return { status: 401, body: { error: 'Unauthorized' } };
}

function toContext(principal: VerifiedPrincipal | undefined): Readonly<AccessContext> | undefined {
  if (!principal) return undefined;
  return createAccessContext({
    tenantId: principal.tenantId,
    actorId: principal.actorId,
    capabilities: principal.capabilities,
  });
}

function objectBody(value: unknown, field = 'Request body'): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function rejectUnknownKeys(
  body: Readonly<Record<string, unknown>>,
  allowed: readonly string[],
  field = 'request',
): void {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(body).filter(key => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`Unknown ${field} fields: ${unknown.sort().join(', ')}`);
}

function requiredString(body: Readonly<Record<string, unknown>>, key: string): string {
  const value = body[key];
  if (typeof value !== 'string') throw new Error(`${key} must be a string`);
  return value;
}

function parseMeeting(value: unknown, field: string): WeeklyMeetingTime {
  const body = objectBody(value, field);
  rejectUnknownKeys(body, ['weekday', 'localTime'], field);
  if (!Number.isInteger(body.weekday)) throw new Error(`${field}.weekday must be an integer`);
  if (typeof body.localTime !== 'string') throw new Error(`${field}.localTime must be a string`);
  return {
    weekday: body.weekday as Weekday,
    localTime: body.localTime,
  };
}

function parseSettings(value: unknown): SaveCongregationSettingsInput {
  const body = objectBody(value);
  rejectUnknownKeys(body, ['name', 'timezone', 'defaultLocale', 'midweekMeeting', 'weekendMeeting']);
  return {
    name: requiredString(body, 'name'),
    timezone: requiredString(body, 'timezone'),
    defaultLocale: requiredString(body, 'defaultLocale'),
    midweekMeeting: parseMeeting(body.midweekMeeting, 'midweekMeeting'),
    weekendMeeting: parseMeeting(body.weekendMeeting, 'weekendMeeting'),
  };
}

function metadata(request: TransportRequest): RequestMetadata {
  return request.correlationId ? { correlationId: request.correlationId } : {};
}

function safeError(error: unknown): TransportResponse<{ error: string }> {
  const message = error instanceof Error ? error.message : 'Unexpected error';
  if (message.startsWith('Access denied:')) return { status: 403, body: { error: 'Forbidden' } };
  if (
    message.includes('must be') ||
    message.includes('is required') ||
    message.includes('cannot occupy') ||
    message.startsWith('Unknown ')
  ) {
    return { status: 400, body: { error: message } };
  }
  return { status: 500, body: { error: 'Internal server error' } };
}

export function toCongregationSettingsDto(profile: CongregationProfile): CongregationSettingsDto {
  return {
    name: profile.name,
    timezone: profile.timezone,
    defaultLocale: profile.defaultLocale,
    midweekMeeting: { ...profile.midweekMeeting },
    weekendMeeting: { ...profile.weekendMeeting },
  };
}

export class CongregationSettingsHttpTransport {
  readonly #settings: CongregationSettingsPort;

  constructor(settings: CongregationSettingsPort) {
    this.#settings = settings;
  }

  get(request: TransportRequest): TransportResponse<CongregationSettingsDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();

    try {
      const profile = this.#settings.get(context);
      return profile
        ? { status: 200, body: toCongregationSettingsDto(profile) }
        : { status: 404, body: { error: 'Congregation settings not found' } };
    } catch (error) {
      return safeError(error);
    }
  }

  save(request: TransportRequest): TransportResponse<CongregationSettingsDto | { error: string }> {
    const context = toContext(request.principal);
    if (!context) return unauthorized();

    try {
      const profile = this.#settings.save(context, parseSettings(request.body), metadata(request));
      return { status: 200, body: toCongregationSettingsDto(profile) };
    } catch (error) {
      return safeError(error);
    }
  }
}
