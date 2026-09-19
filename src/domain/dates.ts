/**
 * Calendar helpers. Expenses are stored against a local calendar date
 * (`YYYY-MM-DD`) rather than a timestamp, so "what did I spend in September"
 * never shifts with time zones or daylight saving.
 */

/** A calendar month such as `"2026-09"`. */
export type MonthKey = string;
/** A local calendar date such as `"2026-09-19"`. */
export type IsoDate = string;

const pad = (value: number) => String(value).padStart(2, '0');

export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses `YYYY-MM-DD` as a local date (never UTC, unlike `new Date(string)`). */
export function fromIsoDate(iso: IsoDate): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function monthKeyOf(iso: IsoDate): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(now: Date = new Date()): MonthKey {
  return monthKeyOf(toIsoDate(now));
}

export function isMonthKey(value: string): value is MonthKey {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function shiftMonth(key: MonthKey, delta: number): MonthKey {
  const [year, month] = key.split('-').map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

/** First day of the month and first day of the next month (exclusive end). */
export function monthRange(key: MonthKey): { start: IsoDate; end: IsoDate } {
  return { start: `${key}-01`, end: `${shiftMonth(key, 1)}-01` };
}

export function daysInMonth(key: MonthKey): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month, 0).getDate();
}

/** The `count` months ending with `key`, oldest first. */
export function monthsEndingAt(key: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(key, i - count + 1));
}

/**
 * The matching stretch of last month for a month-to-date comparison: on 19 Sept that is
 * 1–19 Aug. Clamped to shorter months (31 Mar → 1–28 Feb). `end` is exclusive.
 */
export function samePeriodLastMonth(today: Date = new Date()): { start: IsoDate; end: IsoDate } {
  const previous = shiftMonth(currentMonthKey(today), -1);
  const day = Math.min(today.getDate(), daysInMonth(previous));
  return { start: `${previous}-01`, end: addDays(`${previous}-${pad(day)}`, 1) };
}

/**
 * Days left in the month including today, for "per day" budget allowances.
 * `null` for past months, the full month for future months.
 */
export function daysRemainingInMonth(key: MonthKey, today: Date = new Date()): number | null {
  const current = currentMonthKey(today);
  if (key < current) return null;
  if (key > current) return daysInMonth(key);
  return daysInMonth(key) - today.getDate() + 1;
}

const monthLong = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const monthNameOnly = new Intl.DateTimeFormat('en-GB', { month: 'long' });
const weekdayDayMonth = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dayMonthYear = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const firstOfMonth = (key: MonthKey) => fromIsoDate(`${key}-01`);

/** `"2026-09"` → `"September 2026"` */
export function formatMonth(key: MonthKey): string {
  return monthLong.format(firstOfMonth(key));
}

/** `"2026-09"` → `"September"` */
export function formatMonthName(key: MonthKey): string {
  return monthNameOnly.format(firstOfMonth(key));
}

/** `"2026-09"` → `"Sep"` */
export function formatMonthShort(key: MonthKey): string {
  return monthShort.format(firstOfMonth(key));
}

/** Section heading for a day: "Today", "Yesterday", or e.g. "Mon 15 Sept". */
export function formatDayHeading(iso: IsoDate, today: Date = new Date()): string {
  const todayIso = toIsoDate(today);
  if (iso === todayIso) return 'Today';
  if (iso === addDays(todayIso, -1)) return 'Yesterday';
  return weekdayDayMonth.format(fromIsoDate(iso));
}

/** `"2026-09-19"` → `"19 Sept 2026"` */
export function formatDate(iso: IsoDate): string {
  return dayMonthYear.format(fromIsoDate(iso));
}
