/**
 * The end-of-period wrap-up: a finished budget period reduced to one card's
 * worth of numbers, already turned into the words the card and the share sheet
 * print. Pure functions over integer pence; nothing here knows about React.
 */
import type { Category } from '@/db/types';

import type { CategorySpend } from './budget';
import { describeChange, describeDifference, movers } from './compare';
import { formatDate, type IsoDate } from './dates';
import { formatPence, formatPenceShort } from './money';
import { breakdown } from './summary';

/** At most this many categories get a slice of the ring. */
export const MAX_SLICES = 5;
/** At most this many "what changed" lines fit on the card. */
export const MAX_MOVERS = 3;
/** The card has room for this many stats. */
export const MAX_STATS = 4;

export interface WrappedInput {
  periodLabel: string; // "September 2026"
  noun: string; // "month" | "period"
  totalPence: number;
  limitPence: number | null;
  /** What this period rolled into savings; negative means it came back out. */
  carryPence: number | null;
  /** Same point in the period before, for the comparison line. */
  lastPeriodPence: number | null;
  spending: CategorySpend[]; // from src/domain/budget.ts
  lastSpending: CategorySpend[];
  categories: Category[]; // from src/db/types.ts
  dayCount: number; // days in the period
  busiestDay: { date: IsoDate; totalPence: number } | null;
}

export interface WrappedStat {
  label: string;
  value: string;
  detail?: string;
}

export interface Wrapped {
  periodLabel: string;
  /** One sentence, e.g. "£1,240.50 spent, £181 saved." */
  headline: string;
  stats: WrappedStat[]; // 3 or 4, already formatted for display
  /**
   * Biggest categories first, at most 5, with their share 0–1. A share is of
   * everything spent, so once the list is capped the shares add up to less than
   * 1 and the card leaves the rest of the ring as its own track.
   */
  slices: { name: string; color: string; pence: number; share: number }[];
  /** "Eating out £70 less than last month" — at most 3, biggest change first. */
  movers: string[];
  /** The closing line, e.g. "Your quietest month since May." or a nudge. */
  footer: string | null;
}

export function buildWrapped(input: WrappedInput): Wrapped {
  return {
    periodLabel: input.periodLabel,
    headline: headlineOf(input),
    stats: statsOf(input),
    slices: topSlices(input.categories, input.spending),
    movers: moversOf(input),
    footer: footerOf(input),
  };
}

/** The plain-text version for the share sheet when an image is not wanted. */
export function wrappedText(wrapped: Wrapped): string {
  const lines = [wrapped.periodLabel, wrapped.headline];

  lines.push('', ...wrapped.stats.map(statLine));

  if (wrapped.slices.length > 0) {
    lines.push(
      '',
      ...wrapped.slices.map(
        (slice) =>
          `${slice.name} ${formatPenceShort(slice.pence)} · ${Math.round(slice.share * 100)}%`,
      ),
    );
  }
  if (wrapped.movers.length > 0) lines.push('', ...wrapped.movers);
  if (wrapped.footer !== null) lines.push('', wrapped.footer);

  return lines.join('\n');
}

function statLine(stat: WrappedStat): string {
  return stat.detail === undefined
    ? `${stat.label}: ${stat.value}`
    : `${stat.label}: ${stat.value} (${stat.detail})`;
}

/**
 * "£1,240.50 spent, £181 saved." The carry is the second half of the sentence
 * when there is a budget to measure against; without one it is only what was
 * spent, because "saved" would be a number nobody asked for.
 */
function headlineOf({ totalPence, limitPence, carryPence }: WrappedInput): string {
  const spent = totalPence === 0 ? 'Nothing spent' : `${formatPenceShort(totalPence)} spent`;
  if (carryPence === null) {
    return limitPence === null ? `${spent}.` : `${spent} of ${formatPenceShort(limitPence)}.`;
  }
  if (carryPence > 0) return `${spent}, ${formatPenceShort(carryPence)} saved.`;
  if (carryPence < 0) return `${spent}, ${formatPenceShort(-carryPence)} over.`;
  return `${spent}, exactly on budget.`;
}

/**
 * Three or four tiles, the most telling first; the rest are dropped. The
 * average and the category count are always available, so even a period with
 * nothing in it fills the row rather than leaving a gap.
 */
function statsOf(input: WrappedInput): WrappedStat[] {
  const { totalPence, limitPence, carryPence, lastPeriodPence, dayCount, busiestDay, noun } = input;
  const days = `${dayCount} ${dayCount === 1 ? 'day' : 'days'}`;

  const pool: WrappedStat[] = [
    {
      label: 'Spent',
      value: formatPenceShort(totalPence),
      detail: limitPence === null ? `over ${days}` : `of ${formatPenceShort(limitPence)}`,
    },
  ];

  if (carryPence !== null) {
    pool.push(
      carryPence >= 0
        ? { label: 'Saved', value: formatPenceShort(carryPence), detail: 'into savings' }
        : { label: 'Over by', value: formatPenceShort(-carryPence), detail: 'out of savings' },
    );
  }
  if (busiestDay !== null) {
    pool.push({
      label: 'Busiest day',
      value: formatPenceShort(busiestDay.totalPence),
      detail: formatDate(busiestDay.date),
    });
  }
  pool.push({
    label: 'A day',
    // A period with no days at all is nonsense rather than zero, so say nothing.
    value: dayCount > 0 ? formatPence(Math.round(totalPence / dayCount)) : '—',
    detail: dayCount > 0 ? `across ${days}` : undefined,
  });
  if (lastPeriodPence !== null) {
    pool.push({
      label: `vs last ${noun}`,
      value: describeDifference(totalPence - lastPeriodPence),
      detail: lastPeriodPence === 0 ? 'nothing then' : `${formatPenceShort(lastPeriodPence)} then`,
    });
  }
  pool.push({
    label: 'Categories',
    value: String(input.spending.filter((row) => row.totalPence > 0).length),
    detail: 'with spending',
  });

  return pool.slice(0, MAX_STATS);
}

/** Biggest categories first, each with its share of everything spent. */
function topSlices(categories: Category[], spending: CategorySpend[]): Wrapped['slices'] {
  const spentBy = new Map(spending.map((row) => [row.categoryId, row.totalPence]));
  return breakdown(categories.map((item) => ({ item, totalPence: spentBy.get(item.id) ?? 0 })))
    .slice(0, MAX_SLICES)
    .map(({ item, totalPence, share }) => ({
      name: item.name,
      color: item.color,
      pence: totalPence,
      share,
    }));
}

/** "Eating out £70 less than last month", biggest move first. */
function moversOf({ categories, spending, lastSpending, noun }: WrappedInput): string[] {
  return movers(categories, spending, lastSpending)
    .slice(0, MAX_MOVERS)
    .map((row) => `${row.item.name} ${describeChange(row.differencePence, `last ${noun}`)}`);
}

/** The closing line: what the period left behind, or a reason to come back. */
function footerOf({
  totalPence,
  limitPence,
  carryPence,
  lastPeriodPence,
  noun,
}: WrappedInput): string {
  if (totalPence === 0) {
    return limitPence === null
      ? `Nothing recorded this ${noun}.`
      : `Nothing spent — the whole ${formatPenceShort(limitPence)} is still there.`;
  }
  if (carryPence !== null) {
    if (carryPence > 0) return `${formatPenceShort(carryPence)} went to savings.`;
    if (carryPence < 0) return `${formatPenceShort(-carryPence)} came back out of savings.`;
    return 'Spent the budget to the penny.';
  }
  if (lastPeriodPence !== null) {
    return capitalise(`${describeChange(totalPence - lastPeriodPence, `last ${noun}`)}.`);
  }
  return `Set a budget and next ${noun} counts what you saved.`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
