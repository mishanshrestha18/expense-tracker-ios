/**
 * What the search screen is looking for, and how to say it back in a line of
 * chips. Pure: the query that answers it lives in `src/db/search.ts`.
 */
import type { Category } from '@/db/types';

import { fromIsoDate, type IsoDate } from './dates';
import { formatPence, formatPenceShort } from './money';
import { type PaidWith, paidWithLabel } from './paid-with';

export interface ExpenseFilter {
  /** Matches the note, and the category name. Case-insensitive, trimmed. */
  text: string;
  /** Empty means every category. */
  categoryIds: number[];
  paidWith: PaidWith | null;
  minPence: number | null;
  /** Inclusive. */
  maxPence: number | null;
  from: IsoDate | null;
  /** Inclusive. */
  to: IsoDate | null;
}

const NO_CATEGORIES: number[] = [];
Object.freeze(NO_CATEGORIES);

/**
 * Nothing asked for yet: what the screen opens with. Frozen, so a filter is
 * always built by copying it (`{ ...EMPTY_FILTER, text }`) rather than by
 * editing the one every screen shares.
 */
export const EMPTY_FILTER: ExpenseFilter = Object.freeze({
  text: '',
  categoryIds: NO_CATEGORIES,
  paidWith: null,
  minPence: null,
  maxPence: null,
  from: null,
  to: null,
});

/** True when the filter would match everything, so the screen can prompt instead. */
export function isEmptyFilter(filter: ExpenseFilter): boolean {
  return (
    filter.text.trim() === '' &&
    filter.categoryIds.length === 0 &&
    filter.paidWith === null &&
    filter.minPence === null &&
    filter.maxPence === null &&
    filter.from === null &&
    filter.to === null
  );
}

/** Chips for the header, e.g. ["Tesco", "Groceries", "over £20", "since 1 Jun"]. */
export function describeFilter(filter: ExpenseFilter, categories: readonly Category[]): string[] {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const chips: string[] = [];

  const text = filter.text.trim();
  if (text !== '') chips.push(text);

  for (const id of filter.categoryIds) {
    const name = names.get(id);
    // A category that is no longer there says nothing useful, so it is left out.
    if (name !== undefined) chips.push(name);
  }

  if (filter.paidWith !== null) chips.push(paidWithLabel(filter.paidWith));

  const amount = describeAmount(filter.minPence, filter.maxPence);
  if (amount !== null) chips.push(amount);

  const dates = describeDates(filter.from, filter.to);
  if (dates !== null) chips.push(dates);

  return chips;
}

export interface ResultSummary {
  /** The headline amount: `"£412.30"`. */
  total: string;
  /** The line under it: `"9 payments · £45.81 each"`. */
  detail: string;
  /** Both in one line, for VoiceOver: `"£412.30 · 9 payments · £45.81 each"`. */
  spoken: string;
}

/** What the matches add up to, said three ways for the summary card. */
export function summariseResult(totalPence: number, count: number): ResultSummary {
  const total = formatPence(totalPence);
  if (count === 0) return { total, detail: 'No payments', spoken: 'No payments' };

  const payments = count === 1 ? '1 payment' : `${count} payments`;
  const detail =
    count === 1 ? payments : `${payments} · ${formatPence(Math.round(totalPence / count))} each`;
  return { total, detail, spoken: `${total} · ${detail}` };
}

const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/** `"2026-06-01"` → `"1 Jun"`; short enough for a chip. */
const shortDate = (iso: IsoDate) => dayMonth.format(fromIsoDate(iso));

function describeAmount(minPence: number | null, maxPence: number | null): string | null {
  if (minPence !== null && maxPence !== null) {
    return `${formatPenceShort(minPence)} – ${formatPenceShort(maxPence)}`;
  }
  if (minPence !== null) return `over ${formatPenceShort(minPence)}`;
  if (maxPence !== null) return `under ${formatPenceShort(maxPence)}`;
  return null;
}

function describeDates(from: IsoDate | null, to: IsoDate | null): string | null {
  if (from !== null && to !== null) return `${shortDate(from)} – ${shortDate(to)}`;
  if (from !== null) return `since ${shortDate(from)}`;
  if (to !== null) return `until ${shortDate(to)}`;
  return null;
}
