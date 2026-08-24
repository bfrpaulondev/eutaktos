export type ZonedLocalTimeResolution = Readonly<{ instant: string; ambiguous: boolean }>;

function required(value: string, field: string): string {
  if (typeof value !== 'string') throw new Error(`${field} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function localParts(epochMs: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epochMs));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function offsetMinutes(epochMs: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(epochMs));
  const values = Object.fromEntries(parts.map(part => [part.type, Number(part.value)]));
  const asUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return Math.round((asUtc - epochMs) / 60000);
}

export function resolveZonedLocalTime(dateInput: string, localTimeInput: string, timezoneInput: string): ZonedLocalTimeResolution {
  const date = required(dateInput, 'date');
  const localTime = required(localTimeInput, 'localTime');
  const timezone = required(timezoneInput, 'timezone');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must use YYYY-MM-DD format');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) throw new Error('localTime must use 24-hour HH:mm format');
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(new Date(0)); } catch { throw new Error('timezone must be a valid IANA timezone'); }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = localTime.split(':').map(Number);
  const baseUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const target = `${date}T${localTime}`;
  const candidateEpochs = new Set<number>();

  for (let deltaHours = -48; deltaHours <= 48; deltaHours += 6) {
    const sample = baseUtc + deltaHours * 3_600_000;
    candidateEpochs.add(baseUtc - offsetMinutes(sample, timezone) * 60_000);
  }

  const matches = [...candidateEpochs].filter(epochMs => localParts(epochMs, timezone) === target).sort((a, b) => a - b);
  if (matches.length === 0) throw new Error('localTime does not exist in the selected timezone');
  return Object.freeze({ instant: new Date(matches[0]).toISOString(), ambiguous: matches.length > 1 });
}
