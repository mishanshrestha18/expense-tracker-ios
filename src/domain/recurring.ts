/**
 * Finds the payments that repeat every month (subscriptions, rent, the gym) in
 * what has already been logged, and works out which of them are still to come
 * out this budget period. Pure: no database, and no clock beyond the `today`
 * callers pass in.
 */
import type { Expense } from '@/db/types';

import {
  addDays,
  daysInMonth,
  fromIsoDate,
  type IsoDate,
  monthKeyOf,
  shiftMonth,
  toIsoDate,
} from './dates';

/** Payments needed before a note counts as a series rather than a coincidence. */
export const MIN_OCCURRENCES = 3;
/** ...spread over this many calendar months, so one busy fortnight is not a subscription. */
export const MIN_MONTHS = 3;
/** A typical gap in this range reads as "once a month", allowing for weekend drift. */
export const MIN_GAP_DAYS = 25;
export const MAX_GAP_DAYS = 35;
/** How far one payment may sit from the typical amount, as a share of it. */
export const AMOUNT_TOLERANCE = 0.25;
/** Nothing logged for this long means the subscription was cancelled. */
export const STALE_AFTER_DAYS = 70;

export interface RecurringSeries {
  /** Stable identity of the series, safe to store in a database. */
  key: string;
  /** Nicest human label, e.g. "Netflix". */
  label: string;
  categoryId: number;
  /** Typical amount (median of occurrences). */
  amountPence: number;
  /** Typical day of the month it lands on (1-31). */
  dayOfMonth: number;
  lastSeenOn: IsoDate;
  occurrences: number;
}

export interface UpcomingFee {
  key: string;
  label: string;
  categoryId: number;
  amountPence: number;
  dueOn: IsoDate;
  /** True when the due date has passed but nothing matching has been logged. */
  overdue: boolean;
}

const DAY_MS = 86_400_000;

const pad = (value: number) => String(value).padStart(2, '0');

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Whole days from `from` to `to`, rounded so a daylight saving change cannot shift a gap. */
function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((fromIsoDate(to).getTime() - fromIsoDate(from).getTime()) / DAY_MS);
}

/**
 * The part of a note that identifies the payee: "Netflix", "netflix!" and
 * "Netflix 09/26" all reduce to `"netflix"`. Empty when the note has no words,
 * which is how unlabelled spending drops out of the grouping.
 */
function normaliseNote(note: string): string {
  return note
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // "Caffe Nero" with and without the accent is one series
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ') // digits, punctuation and runs of spaces all just separate words
    .trim();
}

/** Stable across runs and safe to store: the category plus the normalised note. */
function seriesKey(categoryId: number, normalisedNote: string): string {
  return `${categoryId}:${normalisedNote}`;
}

/** Middle value, or the rounded mean of the middle two when the count is even. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle];
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

/** The spelling used most often; the most recent one wins a tie. */
function pickLabel(occurrences: readonly Expense[]): string {
  const counts = new Map<string, number>();
  const lastSeen = new Map<string, IsoDate>();
  for (const { note, spentOn } of occurrences) {
    const label = note.trim();
    counts.set(label, (counts.get(label) ?? 0) + 1);
    if (spentOn > (lastSeen.get(label) ?? '')) lastSeen.set(label, spentOn);
  }

  let best = '';
  let bestCount = 0;
  let bestSeen = '';
  for (const [label, count] of counts) {
    const seen = lastSeen.get(label) ?? '';
    if (count > bestCount || (count === bestCount && seen > bestSeen)) {
      best = label;
      bestCount = count;
      bestSeen = seen;
    }
  }
  return best;
}

/** Applies the recurrence rules to one group of same-payee expenses, oldest first. */
function toSeries(
  key: string,
  occurrences: readonly Expense[],
  todayIso: IsoDate,
): RecurringSeries | null {
  if (occurrences.length < MIN_OCCURRENCES) return null;
  if (new Set(occurrences.map((e) => monthKeyOf(e.spentOn))).size < MIN_MONTHS) return null;

  const gaps = occurrences.slice(1).map((e, i) => daysBetween(occurrences[i].spentOn, e.spentOn));
  const typicalGap = median(gaps);
  if (typicalGap < MIN_GAP_DAYS || typicalGap > MAX_GAP_DAYS) return null;

  // The median shrugs off one odd month; every payment still has to stay near it.
  const amountPence = median(occurrences.map((e) => e.amountPence));
  const tolerance = amountPence * AMOUNT_TOLERANCE;
  if (occurrences.some((e) => Math.abs(e.amountPence - amountPence) > tolerance)) return null;

  const lastSeenOn = occurrences[occurrences.length - 1].spentOn;
  if (daysBetween(lastSeenOn, todayIso) > STALE_AFTER_DAYS) return null;

  return {
    key,
    label: pickLabel(occurrences),
    categoryId: occurrences[0].categoryId,
    amountPence,
    // A median day, so a payment clamped into a short February still reports the 31st.
    dayOfMonth: median(occurrences.map((e) => fromIsoDate(e.spentOn).getDate())),
    lastSeenOn,
    occurrences: occurrences.length,
  };
}

/** The recurring payments visible in `expenses`, dearest first. */
export function detectRecurring(
  expenses: readonly Expense[],
  today: Date = new Date(),
): RecurringSeries[] {
  const groups = new Map<string, Expense[]>();
  for (const expense of expenses) {
    const note = normaliseNote(expense.note);
    if (note === '') continue; // Unlabelled spending cannot be told apart.
    const key = seriesKey(expense.categoryId, note);
    const group = groups.get(key);
    if (group) group.push(expense);
    else groups.set(key, [expense]);
  }

  const todayIso = toIsoDate(today);
  const series: RecurringSeries[] = [];
  for (const [key, group] of groups) {
    const ordered = [...group].sort((a, b) => compare(a.spentOn, b.spentOn));
    const candidate = toSeries(key, ordered, todayIso);
    if (candidate) series.push(candidate);
  }
  return series.sort((a, b) => b.amountPence - a.amountPence || compare(a.label, b.label));
}

/**
 * When a series is expected to land inside the period, clamped to the length of
 * the month (a payment on the 31st comes out on the 30th in April). `null` when
 * no such date falls in the period. `period.end` is exclusive.
 */
function dueDateIn(period: { start: IsoDate; end: IsoDate }, dayOfMonth: number): IsoDate | null {
  if (period.end <= period.start) return null;
  // A period can straddle two months (a pay cycle running 25th to 25th), so try each.
  const lastMonth = monthKeyOf(addDays(period.end, -1));
  for (let month = monthKeyOf(period.start); month <= lastMonth; month = shiftMonth(month, 1)) {
    const dueOn = `${month}-${pad(Math.min(Math.max(dayOfMonth, 1), daysInMonth(month)))}`;
    if (dueOn >= period.start && dueOn < period.end) return dueOn;
  }
  return null;
}

/** What is still expected to come out in `period`, earliest first. */
export function upcomingFees(
  series: readonly RecurringSeries[],
  expenses: readonly Expense[],
  period: { start: IsoDate; end: IsoDate },
  today: Date = new Date(),
): UpcomingFee[] {
  const paid = new Set<string>();
  for (const expense of expenses) {
    if (expense.spentOn < period.start || expense.spentOn >= period.end) continue;
    const note = normaliseNote(expense.note);
    if (note !== '') paid.add(seriesKey(expense.categoryId, note));
  }

  const todayIso = toIsoDate(today);
  const fees: UpcomingFee[] = [];
  for (const entry of series) {
    if (paid.has(entry.key)) continue; // Already gone out this period.
    const dueOn = dueDateIn(period, entry.dayOfMonth);
    if (dueOn === null) continue;
    fees.push({
      key: entry.key,
      label: entry.label,
      categoryId: entry.categoryId,
      amountPence: entry.amountPence,
      dueOn,
      overdue: dueOn < todayIso,
    });
  }
  return fees.sort((a, b) => compare(a.dueOn, b.dueOn) || compare(a.label, b.label));
}

export function totalUpcomingPence(fees: readonly UpcomingFee[]): number {
  return fees.reduce((sum, fee) => sum + fee.amountPence, 0);
}
