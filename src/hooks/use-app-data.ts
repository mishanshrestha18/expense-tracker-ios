/** Typed data hooks for screens. Each wraps one repository call. */
import { listBudgets } from '@/db/budgets';
import { listCategories } from '@/db/categories';
import {
  getExpense,
  listExpensesInMonth,
  monthlyTotals,
  spendingByCategory,
  totalBetween,
} from '@/db/expenses';
import type { Category } from '@/db/types';
import type { IsoDate, MonthKey } from '@/domain/dates';

import { useDbQuery } from './use-db-query';

export function useCategories() {
  const { data, error } = useDbQuery('categories', listCategories);
  const categories = data ?? [];
  const byId = new Map<number, Category>(categories.map((c) => [c.id, c]));
  return { categories, byId, loaded: data !== undefined, error };
}

export function useMonthExpenses(month: MonthKey) {
  return useDbQuery(`expenses:${month}`, (db) => listExpensesInMonth(db, month));
}

export function useMonthSpending(month: MonthKey) {
  return useDbQuery(`spending:${month}`, (db) => spendingByCategory(db, month));
}

export function useBudgets() {
  return useDbQuery('budgets', listBudgets);
}

export function useMonthlyTotals(first: MonthKey, last: MonthKey) {
  return useDbQuery(`totals:${first}:${last}`, (db) => monthlyTotals(db, first, last));
}

export function useTotalBetween(start: IsoDate, end: IsoDate) {
  return useDbQuery(`total:${start}:${end}`, (db) => totalBetween(db, start, end));
}

export function useExpense(id: number) {
  return useDbQuery(`expense:${id}`, (db) => getExpense(db, id));
}
