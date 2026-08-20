export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_FREQUENCIES: readonly RecurrenceFrequency[] = Object.freeze([
  'weekly', 'monthly', 'yearly',] as const);

export interface RecurrenceRule {
  readonly frequency: RecurrenceFrequency;
  readonly interval: number;
  /** For weekly: 0=Sun..6=Sat (ISO day). For monthly: day of month 1-31. For yearly: month 1-12 + day. */
  readonly dayOfMonth?: number;
  readonly dayOfWeek?: number;
  readonly monthOfYear?: number;
}

export interface RecurrenceWindow {
  readonly from: string;
  readonly until: string;
}

const MAX_EXPANSION = 500;

function validateInstant(value: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ISO date: ${value}`);
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

/**
 * Expands a recurrence rule within a window, producing deterministic ISO date strings.
 * The output is sorted ascending and deterministic.
 */
export function expandRecurrence(
  rule: Readonly<RecurrenceRule>,
  window: RecurrenceWindow,
): readonly string[] {
  validateInstant(window.from);
  validateInstant(window.until);
  const fromMs = Date.parse(window.from);
  const untilMs = Date.parse(window.until);
  if (fromMs > untilMs) throw new Error('Window from must be before until');

  const r = createRecurrenceRule(rule);
  const dates: string[] = [];
  const from = new Date(fromMs);
  const until = new Date(untilMs);

  if (r.frequency === 'weekly') {
    expandWeekly(r, from, until, dates);
  } else if (r.frequency === 'monthly') {
    expandMonthly(r, from, until, dates);
  } else {
    expandYearly(r, from, until, dates);
  }

  return Object.freeze(dates);
}

function toIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function expandWeekly(r: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  const targetDay = r.dayOfWeek!;
  const intervalMs = r.interval * 7 * 24 * 60 * 60 * 1000;
  
  // Find first occurrence on or after 'from'
  const current = new Date(from);
  const currentDay = current.getUTCDay();
  let diff = (targetDay - currentDay + 7) % 7;
  current.setUTCDate(current.getUTCDate() + diff);
  current.setUTCHours(0, 0, 0, 0);

  while (current.getTime() <= until.getTime()) {
    if (current.getTime() >= from.getTime()) {
      dates.push(toIsoDate(current));
      if (dates.length >= MAX_EXPANSION) break;
    }
    current.setTime(current.getTime() + intervalMs);
  }
}

function expandMonthly(r: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  const targetDay = r.dayOfMonth!;
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();

  while (true) {
    // Clamp day to actual month length
    const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(targetDay, maxDay);
    const occ = new Date(Date.UTC(year, month, day, 0, 0, 0));

    if (occ.getTime() > until.getTime()) break;
    if (occ.getTime() >= from.getTime()) {
      dates.push(toIsoDate(occ));
      if (dates.length >= MAX_EXPANSION) break;
    }

    // Advance by interval months
    month += r.interval;
    while (month > 11) { month -= 12; year++; }
  }
}

function expandYearly(r: RecurrenceRule, from: Date, until: Date, dates: string[]): void {
  const targetMonth = r.monthOfYear! - 1; // 0-based
  const targetDay = r.dayOfMonth!;
  let year = from.getUTCFullYear();

  // Start from the correct year
  if (new Date(Date.UTC(year, targetMonth, targetDay)).getTime() < from.getTime()) year++;

  while (true) {
    const maxDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(targetDay, maxDay);
    const occ = new Date(Date.UTC(year, targetMonth, day, 0, 0, 0));

    if (occ.getTime() > until.getTime()) break;
    dates.push(toIsoDate(occ));
    if (dates.length >= MAX_EXPANSION) break;

    year += r.interval;
  }
}
