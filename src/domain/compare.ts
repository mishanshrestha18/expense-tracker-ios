/**
 * "Am I spending more than last month?" — the same stretch of an earlier
 * period against this one, for the whole budget and category by category.
 */
import type { CategorySpend } from './budget';
import { formatPenceShort } from './money';

export interface Change {
  currentPence: number;
  previousPence: number;
  /** Current minus previous; negative means less was spent. */
  differencePence: number;
  /** Relative change, e.g. `0.12` for 12% more. `null` with nothing to compare against. */
  ratio: number | null;
}

export function change(currentPence: number, previousPence: number): Change {
  return {
    currentPence,
    previousPence,
    differencePence: currentPence - previousPence,
    ratio: previousPence <= 0 ? null : (currentPence - previousPence) / previousPence,
  };
}

export interface CategoryChange<T> extends Change {
  item: T;
}

/**
 * Categories sorted by how much the spending moved, biggest first, dropping
 * anything that barely moved. Useful for "what is actually different this
 * month" rather than a table of every category.
 */
export function movers<T extends { id: number }>(
  items: readonly T[],
  current: readonly CategorySpend[],
  previous: readonly CategorySpend[],
  minimumPence = 500,
): CategoryChange<T>[] {
  const currentBy = new Map(current.map((s) => [s.categoryId, s.totalPence]));
  const previousBy = new Map(previous.map((s) => [s.categoryId, s.totalPence]));

  return items
    .map((item) => ({ item, ...change(currentBy.get(item.id) ?? 0, previousBy.get(item.id) ?? 0) }))
    .filter((row) => Math.abs(row.differencePence) >= minimumPence)
    .sort((a, b) => Math.abs(b.differencePence) - Math.abs(a.differencePence));
}

/**
 * "£120 more" / "about the same". `within` is how close counts as the same, so
 * a few pounds either way is not a headline.
 */
export function describeDifference(difference: number, within = 500): string {
  if (Math.abs(difference) < within) return 'about the same';
  const amount = formatPenceShort(Math.abs(difference));
  return difference > 0 ? `${amount} more` : `${amount} less`;
}

/** The same, said against something: "£120 more than last month". */
export function describeChange(difference: number, label: string, within = 500): string {
  const difference_ = describeDifference(difference, within);
  return difference_ === 'about the same'
    ? `about the same as ${label}`
    : `${difference_} than ${label}`;
}
