/**
 * Fees that are still expected this period, worked out from what has been
 * logged before. The budget screens set this money aside before promising a
 * daily allowance.
 */
import { ignoreRecurring } from '@/db/recurring';
import type { Commitment } from '@/db/types';
import { shiftMonth } from '@/domain/dates';
import type { Period } from '@/domain/period';
import { phraseWords } from '@/domain/quick-add';
import {
  detectRecurring,
  totalUpcomingPence,
  type UpcomingFee,
  upcomingFees,
} from '@/domain/recurring';

import { useExpenseHistory, useIgnoredRecurring } from './use-app-data';
import { useDbMutation } from './use-db-query';

/** Enough history to see a year of a monthly fee, plus the month in hand. */
const HISTORY_MONTHS = 13;

export interface UpcomingFeesResult {
  fees: UpcomingFee[];
  totalPence: number;
  /** Stops treating a series as recurring, for good. */
  ignore: (key: string) => void;
}

export function useUpcomingFees(
  period: Period,
  commitments: readonly Commitment[] = [],
): UpcomingFeesResult {
  const mutate = useDbMutation();
  const historyStart = `${shiftMonth(period.key, -HISTORY_MONTHS)}-01`;
  const history = useExpenseHistory(historyStart, period.end).data ?? [];
  const ignored = new Set(useIgnoredRecurring().data ?? []);

  // Anything set up as a bill is already counted; two warnings for one rent
  // would be worse than none.
  const committedNames = commitments.map((c) => phraseWords(c.name).join(' ')).filter(Boolean);
  const series = detectRecurring(history)
    .filter((s) => !ignored.has(s.key))
    .filter((s) => {
      const label = phraseWords(s.label).join(' ');
      return !committedNames.some((name) => label.includes(name) || name.includes(label));
    });
  const fees = upcomingFees(series, history, period);

  return {
    fees,
    totalPence: totalUpcomingPence(fees),
    ignore: (key: string) => void mutate((db) => ignoreRecurring(db, key)),
  };
}
