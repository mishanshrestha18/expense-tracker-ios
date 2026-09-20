/**
 * Savings: what budget periods leave behind. A period that ends under its
 * budget rolls the difference in, one that ends over takes money back out, and
 * a person can move money by hand on top. Pure functions over integer pence.
 */
import type { SavingsEntry } from '@/db/types';

import { type MonthKey, shiftMonth } from './dates';
import { currentPeriodKey, type PaydayRule, type Period, periodFor } from './period';

/** How many finished periods `periodsToClose` will offer at once. */
export const CLOSE_LIMIT = 24;

/**
 * What a finished period adds to (or takes from) savings.
 * `null` without a budget to measure against.
 */
export function carryPence(limitPence: number | null, spentPence: number): number | null {
  if (limitPence === null || limitPence <= 0) return null;
  return limitPence - spentPence;
}

export interface SavingsSummary {
  /** Everything, carries and adjustments together. */
  balancePence: number;
  /** The carries alone; negative once overspends outweigh what was saved. */
  carriedPence: number;
  /** Money put in by hand. */
  addedPence: number;
  /** Money taken out by hand, as a positive number. */
  takenPence: number;
  /** How many periods have been closed. */
  periodsCounted: number;
}

export function summariseSavings(entries: readonly SavingsEntry[]): SavingsSummary {
  const summary: SavingsSummary = {
    balancePence: 0,
    carriedPence: 0,
    addedPence: 0,
    takenPence: 0,
    periodsCounted: 0,
  };

  for (const entry of entries) {
    summary.balancePence += entry.amountPence;
    if (entry.kind === 'carry') {
      summary.carriedPence += entry.amountPence;
      summary.periodsCounted += 1;
    } else if (entry.amountPence < 0) {
      summary.takenPence -= entry.amountPence;
    } else {
      summary.addedPence += entry.amountPence;
    }
  }
  return summary;
}

/** Periods that have ended and have no carry yet, oldest first, at most `limit`. */
export function periodsToClose(
  closedKeys: readonly MonthKey[],
  rule: PaydayRule,
  today: Date = new Date(),
  limit: number = CLOSE_LIMIT,
): Period[] {
  const closed = new Set(closedKeys);
  const found: Period[] = [];

  // Walk back from the period before this one: the one in progress has nothing
  // to carry yet. The first closed period ends the run, because everything
  // older was closed alongside it.
  let key = shiftMonth(currentPeriodKey(rule, today), -1);
  while (found.length < limit && !closed.has(key)) {
    found.push(periodFor(key, rule));
    key = shiftMonth(key, -1);
  }
  return found.reverse();
}
