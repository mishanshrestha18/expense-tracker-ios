/**
 * Fees that are still expected this period, worked out from what has been
 * logged before. The budget screens set this money aside before promising a
 * daily allowance.
 */
import { ignoreRecurring } from '@/db/recurring';
import { shiftMonth } from '@/domain/dates';
import type { Period } from '@/domain/period';
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

export function useUpcomingFees(period: Period): UpcomingFeesResult {
  const mutate = useDbMutation();
  const historyStart = `${shiftMonth(period.key, -HISTORY_MONTHS)}-01`;
  const history = useExpenseHistory(historyStart, period.end).data ?? [];
  const ignored = new Set(useIgnoredRecurring().data ?? []);

  const series = detectRecurring(history).filter((s) => !ignored.has(s.key));
  const fees = upcomingFees(series, history, period);

  return {
    fees,
    totalPence: totalUpcomingPence(fees),
    ignore: (key: string) => void mutate((db) => ignoreRecurring(db, key)),
  };
}
