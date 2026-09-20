/** Typed data hooks for screens. Each wraps one repository call. */
import { getOverallBudget, listBudgets } from '@/db/budgets';
import { listCategories } from '@/db/categories';
import {
  dailyTotals,
  getExpense,
  listExpensesBetween,
  paidWithTotals,
  spendingByCategoryBetween,
  totalBetween,
} from '@/db/expenses';
import { listMerchantRules } from '@/db/merchant-rules';
import { listIgnoredRecurring } from '@/db/recurring';
import type { Category } from '@/db/types';
import type { IsoDate } from '@/domain/dates';
import { matchersWithRules } from '@/domain/merchant';
import type { Period } from '@/domain/period';

import { useDbQuery } from './use-db-query';

export function useCategories() {
  const { data, error } = useDbQuery('categories', listCategories);
  const categories = data ?? [];
  const byId = new Map<number, Category>(categories.map((c) => [c.id, c]));
  return { categories, byId, loaded: data !== undefined, error };
}

/** Shops the person has filed by hand, used before the built-in word lists. */
export function useMerchantRules() {
  return useDbQuery('merchant-rules', listMerchantRules);
}

/**
 * Categories for the quick-add parser, including everything the app has
 * learned, so typing "pret" files itself the way you filed it last time.
 */
export function useCategoryMatchers(): Category[] {
  const { categories } = useCategories();
  const rules = useMerchantRules().data ?? [];
  return matchersWithRules(categories, rules);
}

export function usePeriodExpenses(period: Period) {
  return useDbQuery(`expenses:${period.start}:${period.end}`, (db) =>
    listExpensesBetween(db, period.start, period.end),
  );
}

export function usePeriodSpending(period: Period) {
  return useDbQuery(`spending:${period.start}:${period.end}`, (db) =>
    spendingByCategoryBetween(db, period.start, period.end),
  );
}

export function usePaidWithTotals(period: Period) {
  return useDbQuery(`paid-with:${period.start}:${period.end}`, (db) =>
    paidWithTotals(db, period.start, period.end),
  );
}

export function useBudgets() {
  return useDbQuery('budgets', listBudgets);
}

/** The overall monthly budget in pence; `data` is `null` when none is set. */
export function useOverallBudget() {
  return useDbQuery('overall-budget', getOverallBudget);
}

/** Day-by-day totals, which the trend chart buckets into periods. */
export function useDailyTotals(start: IsoDate, end: IsoDate) {
  return useDbQuery(`daily:${start}:${end}`, (db) => dailyTotals(db, start, end));
}

/** Spending by category over any stretch of days, for comparisons. */
export function useSpendingBetween(start: IsoDate, end: IsoDate) {
  return useDbQuery(`spending-between:${start}:${end}`, (db) =>
    spendingByCategoryBetween(db, start, end),
  );
}

export function useTotalBetween(start: IsoDate, end: IsoDate) {
  return useDbQuery(`total:${start}:${end}`, (db) => totalBetween(db, start, end));
}

export function useExpense(id: number) {
  return useDbQuery(`expense:${id}`, (db) => getExpense(db, id));
}

/** Expenses of the last `months` months, for spotting recurring payments. */
export function useExpenseHistory(start: IsoDate, end: IsoDate) {
  return useDbQuery(`history:${start}:${end}`, (db) => listExpensesBetween(db, start, end));
}

export function useIgnoredRecurring() {
  return useDbQuery('recurring-ignored', listIgnoredRecurring);
}
