/**
 * Budget periods. A period is a calendar month by default, but UK salaries
 * usually land on the same day each month, so a period can instead run from
 * payday to the day before the next one. A period is keyed by the calendar
 * month it starts in, which keeps month navigation and the existing
 * `MonthKey` type unchanged.
 */
import {
  addDays,
  daysInMonth,
  fromIsoDate,
  type IsoDate,
  type MonthKey,
  monthKeyOf,
  shiftMonth,
  toIsoDate,
} from './dates';

export type PaydayRule =
  | { kind: 'calendar' }
  /** Paid on the same date each month, e.g. the 25th. */
  | { kind: 'day'; day: number; weekendAdjust: boolean }
  /** Paid on the last working day of the month. */
  | { kind: 'lastWorkingDay' };

export const CALENDAR_MONTHS: PaydayRule = { kind: 'calendar' };

export interface Period {
  /** The calendar month the period starts in, e.g. `"2026-09"`. */
  key: MonthKey;
  start: IsoDate;
  /** Exclusive: the day the next period starts. */
  end: IsoDate;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const pad = (value: number) => String(value).padStart(2, '0');

/** Whole days from `start` to `end`; rounded so daylight saving cannot shift it. */
function daysBetween(start: IsoDate, end: IsoDate): number {
  return Math.round((fromIsoDate(end).getTime() - fromIsoDate(start).getTime()) / MS_PER_DAY);
}

/** Saturdays and Sundays move back to the Friday before, the way UK payroll does. */
function previousWeekday(iso: IsoDate): IsoDate {
  const weekday = fromIsoDate(iso).getDay();
  if (weekday === 6) return addDays(iso, -1);
  if (weekday === 0) return addDays(iso, -2);
  return iso;
}

/** The day the period keyed `key` starts. */
export function periodStart(key: MonthKey, rule: PaydayRule): IsoDate {
  if (rule.kind === 'calendar') return `${key}-01`;
  const lastDay = daysInMonth(key);
  // A payday after the end of a short month lands on its last day (the 31st in February is the 28th).
  const day = rule.kind === 'lastWorkingDay' ? lastDay : Math.min(Math.max(rule.day, 1), lastDay);
  const payday = `${key}-${pad(day)}`;
  return rule.kind === 'lastWorkingDay' || rule.weekendAdjust ? previousWeekday(payday) : payday;
}

export function periodFor(key: MonthKey, rule: PaydayRule): Period {
  return { key, start: periodStart(key, rule), end: periodStart(shiftMonth(key, 1), rule) };
}

/** The period a date falls in. */
export function periodKeyOf(iso: IsoDate, rule: PaydayRule): MonthKey {
  const month = monthKeyOf(iso);
  return iso < periodStart(month, rule) ? shiftMonth(month, -1) : month;
}

export function currentPeriodKey(rule: PaydayRule, today: Date = new Date()): MonthKey {
  return periodKeyOf(toIsoDate(today), rule);
}

export function daysInPeriod(period: Period): number {
  return daysBetween(period.start, period.end);
}

/**
 * Days left in the period including today, for "per day" allowances.
 * `null` once the period is over; the whole period before it starts.
 */
export function daysRemainingInPeriod(period: Period, today: Date = new Date()): number | null {
  const iso = toIsoDate(today);
  if (iso >= period.end) return null;
  if (iso < period.start) return daysInPeriod(period);
  return daysBetween(iso, period.end);
}

/** Share of the period gone, counting today (0–1). `null` outside the period. */
export function periodElapsed(period: Period, today: Date = new Date()): number | null {
  const iso = toIsoDate(today);
  if (iso < period.start || iso >= period.end) return null;
  return (daysBetween(period.start, iso) + 1) / daysInPeriod(period);
}

/**
 * The matching stretch of an earlier period, for a like-for-like comparison:
 * five days into this period, that is the first five days of the one
 * `periodsBack` ago. `end` is exclusive.
 */
export function samePointPeriodsAgo(
  key: MonthKey,
  rule: PaydayRule,
  periodsBack: number,
  today: Date = new Date(),
): { start: IsoDate; end: IsoDate } {
  const earlier = periodFor(shiftMonth(key, -periodsBack), rule);
  const elapsed = daysBetween(periodStart(key, rule), toIsoDate(today)) + 1;
  const days = Math.max(0, Math.min(elapsed, daysInPeriod(earlier)));
  return { start: earlier.start, end: addDays(earlier.start, days) };
}

/** The same stretch of the period before this one. */
export function samePointLastPeriod(
  key: MonthKey,
  rule: PaydayRule,
  today: Date = new Date(),
): { start: IsoDate; end: IsoDate } {
  return samePointPeriodsAgo(key, rule, 1, today);
}

/** The same stretch of the period a year ago. */
export function samePointLastYear(
  key: MonthKey,
  rule: PaydayRule,
  today: Date = new Date(),
): { start: IsoDate; end: IsoDate } {
  return samePointPeriodsAgo(key, rule, 12, today);
}

/** The `count` periods ending with `key`, oldest first. */
export function periodsEndingAt(key: MonthKey, count: number, rule: PaydayRule): Period[] {
  return Array.from({ length: count }, (_, i) => periodFor(shiftMonth(key, i - count + 1), rule));
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** `"25 Sep – 24 Oct"`, naming the last day of the period rather than the exclusive end. */
export function formatPeriodRange(period: Period): string {
  const lastDay = addDays(period.end, -1);
  return `${dayMonth.format(fromIsoDate(period.start))} – ${dayMonth.format(fromIsoDate(lastDay))}`;
}

/** What to call a period in the interface: "month" until payday moves it. */
export function periodNoun(rule: PaydayRule): string {
  return rule.kind === 'calendar' ? 'month' : 'period';
}

/** Plain-English description of a rule, for settings and accessibility labels. */
export function describePaydayRule(rule: PaydayRule): string {
  if (rule.kind === 'calendar') return 'Calendar months';
  if (rule.kind === 'lastWorkingDay') return 'From the last working day of the month';
  return `From the ${ordinal(rule.day)} of the month`;
}

export function ordinal(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return `${day}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${day}${suffix}`;
}
