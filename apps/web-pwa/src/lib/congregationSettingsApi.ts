export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyMeetingTimeDto {
  weekday: Weekday;
  localTime: string;
}

export interface CongregationSettingsDto {
  name: string;
  timezone: string;
  defaultLocale: string;
  midweekMeeting: WeeklyMeetingTimeDto;
  weekendMeeting: WeeklyMeetingTimeDto;
}

export type SaveCongregationSettingsPayload = CongregationSettingsDto;

export interface CongregationSettingsApi {
  get(signal?: AbortSignal): Promise<CongregationSettingsDto | null>;
  save(input: SaveCongregationSettingsPayload): Promise<CongregationSettingsDto>;
}

interface ErrorBody {
  error?: unknown;
}

function parseMeeting(value: unknown, field: string): WeeklyMeetingTimeDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Invalid congregation settings response: ${field}`);
  }
  const candidate = value as Record<string, unknown>;
  if (
    !Number.isInteger(candidate.weekday) ||
    (candidate.weekday as number) < 0 ||
    (candidate.weekday as number) > 6 ||
    typeof candidate.localTime !== 'string' ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(candidate.localTime)
  ) {
    throw new Error(`Invalid congregation settings response: ${field}`);
  }
  return {
    weekday: candidate.weekday as Weekday,
    localTime: candidate.localTime,
  };
}

export function parseCongregationSettingsResponse(value: unknown): CongregationSettingsDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid congregation settings API response');
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.name !== 'string' ||
    typeof candidate.timezone !== 'string' ||
    typeof candidate.defaultLocale !== 'string'
  ) {
    throw new Error('Invalid congregation settings API response');
  }
  return {
    name: candidate.name,
    timezone: candidate.timezone,
    defaultLocale: candidate.defaultLocale,
    midweekMeeting: parseMeeting(candidate.midweekMeeting, 'midweekMeeting'),
    weekendMeeting: parseMeeting(candidate.weekendMeeting, 'weekendMeeting'),
  };
}

function minimizePayload(input: SaveCongregationSettingsPayload): SaveCongregationSettingsPayload {
  return {
    name: input.name,
    timezone: input.timezone,
    defaultLocale: input.defaultLocale,
    midweekMeeting: {
      weekday: input.midweekMeeting.weekday,
      localTime: input.midweekMeeting.localTime,
    },
    weekendMeeting: {
      weekday: input.weekendMeeting.weekday,
      localTime: input.weekendMeeting.localTime,
    },
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error('Invalid API response');
  }
}

function apiError(status: number, body: unknown): Error {
  const message = body && typeof body === 'object' ? (body as ErrorBody).error : undefined;
  return new Error(typeof message === 'string' ? message : `Congregation settings request failed (${status})`);
}

export function createCongregationSettingsApi(fetcher: typeof fetch = fetch): CongregationSettingsApi {
  return {
    async get(signal) {
      const response = await fetcher('/api/congregation/settings', {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        signal,
      });
      if (response.status === 404) return null;
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseCongregationSettingsResponse(body);
    },

    async save(input) {
      const response = await fetcher('/api/congregation/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(minimizePayload(input)),
      });
      const body = await readJson(response);
      if (!response.ok) throw apiError(response.status, body);
      return parseCongregationSettingsResponse(body);
    },
  };
}

export const congregationSettingsApi = createCongregationSettingsApi();
