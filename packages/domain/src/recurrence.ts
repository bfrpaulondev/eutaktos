export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';
export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = Object.freeze(['weekly', 'monthly', 'yearly'] as const);
export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency; readonly interval: number;
  readonly dayOfMonth?: number; readonly dayOfWeek?: number; readonly monthOfYear?: number;
}
export interface RecurrenceWindow { readonly from: string; readonly until: string; }
const MAX_EXPANSION = 500;

function validateInstant(value: string): void {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${String(value)}`);
}
export function createRecurrenceRule(rule: RecurrenceRule): Readonly<RecurrenceRule> {
  if (!RECURRENCE_FREQUENCIES.includes(rule.frequency)) throw new Error(`Invalid frequency: ${rule.frequency}`);
  if (!Number.isInteger(rule.interval) || rule.interval < 1) throw new Error('interval must be a positive integer');
  if (rule.interval > 99) throw new Error('interval is too large (max 99)');
  if (rule.frequency === 'weekly') {
    if (rule.dayOfWeek === undefined) throw new Error('dayOfWeek is required for weekly recurrence');
    if (!Number.isInteger(rule.dayOfWeek) || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) throw new Error('dayOfWeek must be 0-6');
  }
  if (rule.frequency === 'monthly') {
    if (rule.dayOfMonth === undefined) throw new Error('dayOfMonth is required for monthly recurrence');
    if (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) throw new Error('dayOfMonth must be 1-31');
  }
  if (rule.frequency === 'yearly') {
    if (rule.monthOfYear === undefined) throw new Error('monthOfYear is required for yearly recurrence');
    if (rule.dayOfMonth === undefined) throw new Error('dayOfMonth is required for yearly recurrence');
    if (!Number.isInteger(rule.monthOfYear) || rule.monthOfYear < 1 || rule.monthOfYear > 12) throw new Error('monthOfYear must be 1-12');
    if (!Number.isInteger(rule.dayOfMonth) || rule.dayOfMonth < 1 || rule.dayOfMonth > 31) throw new Error('dayOfMonth must be 1-31');
  }
  return Object.freeze({ ...rule });
}

export function expandRecurrence(rule: Readonly<RecurrenceRule>, window: RecurrenceWindow): readonly string[] {
  validateInstant(window.from); validateInstant(window.until);
  const fromMs = Date.parse(window.from); const untilMs = Date.parse(window.until);
  if (fromMs > untilMs) throw new Error('Window from must be before until');
  if (fromMs === untilMs) return Object.freeze([]);
  const normalized = createRecurrenceRule(rule);
  const dates: string[] = []; const from = new Date(fromMs); const until = new Date(untilMs);
  if (normalized.frequency === 'weekly') expandWeekly(normalized, from, until, dates);
  else if (normalized.frequency === 'monthly') expandMonthly(normalized, from, until, dates);
  else expandYearly(normalized, from, until, dates);
  return Object.freeze(dates);
}

function toIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}
function clampedUtcDate(year: number, month: number, targetDay: number): Date {
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(targetDay, maxDay), 0, 0, 0));
}
function expandWeekly(rule: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  const current = new Date(from);
  const diff = (rule.dayOfWeek! - current.getUTCDay() + 7) % 7;
  current.setUTCDate(current.getUTCDate() + diff); current.setUTCHours(0, 0, 0, 0);
  const intervalMs = rule.interval * 7 * 24 * 60 * 60 * 1000;
  while (current.getTime() <= until.getTime()) {
    if (current.getTime() >= from.getTime()) {
      dates.push(toIsoDate(current)); if (dates.length >= MAX_EXPANSION) break;
    }
    current.setTime(current.getTime() + intervalMs);
  }
}
function expandMonthly(rule: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  let year = from.getUTCFullYear(); let month = from.getUTCMonth();
  while (true) {
    const occurrence = clampedUtcDate(year, month, rule.dayOfMonth!);
    if (occurrence.getTime() > until.getTime()) break;
    if (occurrence.getTime() >= from.getTime()) {
      dates.push(toIsoDate(occurrence)); if (dates.length >= MAX_EXPANSION) break;
    }
    month += rule.interval;
    while (month > 11) { month -= 12; year += 1; }
  }
}
function expandYearly(rule: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  const month = rule.monthOfYear! - 1; let year = from.getUTCFullYear();
  let occurrence = clampedUtcDate(year, month, rule.dayOfMonth!);
  if (occurrence.getTime() < from.getTime()) { year += rule.interval; occurrence = clampedUtcDate(year, month, rule.dayOfMonth!); }
  while (occurrence.getTime() <= until.getTime()) {
    dates.push(toIsoDate(occurrence)); if (dates.length >= MAX_EXPANSION) break;
    year += rule.interval; occurrence = clampedUtcDate(year, month, rule.dayOfMonth!);
  }
}
