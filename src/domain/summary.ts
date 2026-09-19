/** Aggregations that turn raw rows into what the screens and charts show. */
import type { IsoDate, MonthKey } from './dates';
import type { Period } from './period';

export interface MonthTotal {
  month: MonthKey;
  totalPence: number;
}

/**
 * Day totals summed into budget periods, in the order given and with `0` for
 * periods without spending. Periods do not have to be calendar months, so the
 * database returns days and the bucketing happens here.
 */
export function bucketByPeriod(
  days: readonly { day: IsoDate; totalPence: number }[],
  periods: readonly Period[],
): MonthTotal[] {
  return periods.map((period) => ({
    month: period.key,
    totalPence: days
      .filter((d) => d.day >= period.start && d.day < period.end)
      .reduce((sum, d) => sum + d.totalPence, 0),
  }));
}

export interface BreakdownItem<T> {
  item: T;
  totalPence: number;
  /** Share of the grand total, 0–1. */
  share: number;
}

/** Largest first, zero totals dropped, shares that add up to 1. */
export function breakdown<T>(rows: readonly { item: T; totalPence: number }[]): BreakdownItem<T>[] {
  const nonZero = rows.filter((r) => r.totalPence > 0);
  const total = nonZero.reduce((sum, r) => sum + r.totalPence, 0);
  return nonZero
    .map((r) => ({ ...r, share: total === 0 ? 0 : r.totalPence / total }))
    .sort((a, b) => b.totalPence - a.totalPence);
}

/** Relative change, e.g. `0.12` for +12%. `null` when there is nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

/** Mean of the periods that had any spending, so a brand-new app is not dragged down by zeros. */
export function averageOfActiveMonths(totals: readonly MonthTotal[]): number {
  const active = totals.filter((t) => t.totalPence > 0);
  if (active.length === 0) return 0;
  return Math.round(active.reduce((sum, t) => sum + t.totalPence, 0) / active.length);
}

export interface DayGroup<T> {
  date: IsoDate;
  totalPence: number;
  items: T[];
}

/** Groups items by day, newest day first, keeping the incoming order within a day. */
export function groupByDay<T extends { spentOn: IsoDate; amountPence: number }>(
  items: readonly T[],
): DayGroup<T>[] {
  const groups = new Map<IsoDate, DayGroup<T>>();
  for (const item of items) {
    const group = groups.get(item.spentOn) ?? { date: item.spentOn, totalPence: 0, items: [] };
    group.items.push(item);
    group.totalPence += item.amountPence;
    groups.set(item.spentOn, group);
  }
  return [...groups.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
