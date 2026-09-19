import type { CategorySpend } from '@/domain/budget';
import { type IsoDate, type MonthKey, monthRange } from '@/domain/dates';
import type { MonthTotal } from '@/domain/summary';

import type { Db, Expense, ExpenseInput } from './types';

interface ExpenseRow {
  id: number;
  amount_pence: number;
  category_id: number;
  note: string;
  spent_on: string;
  created_at: string;
}

const COLUMNS = 'id, amount_pence, category_id, note, spent_on, created_at';

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amountPence: row.amount_pence,
  categoryId: row.category_id,
  note: row.note,
  spentOn: row.spent_on,
  createdAt: row.created_at,
});

export async function addExpense(db: Db, input: ExpenseInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO expenses (amount_pence, category_id, note, spent_on) VALUES (?, ?, ?, ?)',
    [input.amountPence, input.categoryId, input.note.trim(), input.spentOn],
  );
  return result.lastInsertRowId;
}

export async function updateExpense(db: Db, id: number, input: ExpenseInput): Promise<void> {
  await db.runAsync(
    'UPDATE expenses SET amount_pence = ?, category_id = ?, note = ?, spent_on = ? WHERE id = ?',
    [input.amountPence, input.categoryId, input.note.trim(), input.spentOn, id],
  );
}

export async function deleteExpense(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
}

export async function getExpense(db: Db, id: number): Promise<Expense | null> {
  const row = await db.getFirstAsync<ExpenseRow>(`SELECT ${COLUMNS} FROM expenses WHERE id = ?`, [
    id,
  ]);
  return row && toExpense(row);
}

/** Newest first; expenses on the same day in the order they were added (latest on top). */
export async function listExpensesInMonth(db: Db, month: MonthKey): Promise<Expense[]> {
  const { start, end } = monthRange(month);
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT ${COLUMNS} FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     ORDER BY spent_on DESC, id DESC`,
    [start, end],
  );
  return rows.map(toExpense);
}

export async function spendingByCategory(db: Db, month: MonthKey): Promise<CategorySpend[]> {
  const { start, end } = monthRange(month);
  return db.getAllAsync<CategorySpend>(
    `SELECT category_id AS categoryId, SUM(amount_pence) AS totalPence
     FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     GROUP BY category_id`,
    [start, end],
  );
}

/** Total spent on days from `start` (inclusive) to `end` (exclusive). */
export async function totalBetween(db: Db, start: IsoDate, end: IsoDate): Promise<number> {
  const row = await db.getFirstAsync<{ totalPence: number | null }>(
    'SELECT SUM(amount_pence) AS totalPence FROM expenses WHERE spent_on >= ? AND spent_on < ?',
    [start, end],
  );
  return row?.totalPence ?? 0;
}

/** Totals for months from `first` to `last` inclusive. Months without spending are omitted. */
export async function monthlyTotals(
  db: Db,
  first: MonthKey,
  last: MonthKey,
): Promise<MonthTotal[]> {
  return db.getAllAsync<MonthTotal>(
    `SELECT substr(spent_on, 1, 7) AS month, SUM(amount_pence) AS totalPence
     FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     GROUP BY month
     ORDER BY month`,
    [monthRange(first).start, monthRange(last).end],
  );
}
