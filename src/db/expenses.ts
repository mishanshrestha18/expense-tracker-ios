import type { CategorySpend } from '@/domain/budget';
import type { IsoDate } from '@/domain/dates';

import type { Db, Expense, ExpenseInput, PaidWith } from './types';

interface ExpenseRow {
  id: number;
  amount_pence: number;
  category_id: number;
  note: string;
  spent_on: string;
  paid_with: string;
  created_at: string;
}

const COLUMNS = 'id, amount_pence, category_id, note, spent_on, paid_with, created_at';

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amountPence: row.amount_pence,
  categoryId: row.category_id,
  note: row.note,
  spentOn: row.spent_on,
  paidWith: row.paid_with as PaidWith,
  createdAt: row.created_at,
});

export async function addExpense(db: Db, input: ExpenseInput): Promise<number> {
  const result = await db.runAsync(
    'INSERT INTO expenses (amount_pence, category_id, note, spent_on, paid_with) VALUES (?, ?, ?, ?, ?)',
    [input.amountPence, input.categoryId, input.note.trim(), input.spentOn, input.paidWith ?? ''],
  );
  return result.lastInsertRowId;
}

export async function updateExpense(db: Db, id: number, input: ExpenseInput): Promise<void> {
  await db.runAsync(
    'UPDATE expenses SET amount_pence = ?, category_id = ?, note = ?, spent_on = ?, paid_with = ? WHERE id = ?',
    [
      input.amountPence,
      input.categoryId,
      input.note.trim(),
      input.spentOn,
      input.paidWith ?? '',
      id,
    ],
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

/**
 * Expenses from `start` (inclusive) to `end` (exclusive), newest first, with
 * expenses on the same day in the order they were added (latest on top).
 */
export async function listExpensesBetween(
  db: Db,
  start: IsoDate,
  end: IsoDate,
): Promise<Expense[]> {
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT ${COLUMNS} FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     ORDER BY spent_on DESC, id DESC`,
    [start, end],
  );
  return rows.map(toExpense);
}

export async function spendingByCategoryBetween(
  db: Db,
  start: IsoDate,
  end: IsoDate,
): Promise<CategorySpend[]> {
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

export interface DayTotal {
  day: IsoDate;
  totalPence: number;
}

/**
 * One row per day with spending. Budget periods do not have to line up with
 * calendar months, so the trend chart buckets these days itself.
 */
export async function dailyTotals(db: Db, start: IsoDate, end: IsoDate): Promise<DayTotal[]> {
  return db.getAllAsync<DayTotal>(
    `SELECT spent_on AS day, SUM(amount_pence) AS totalPence
     FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     GROUP BY day
     ORDER BY day`,
    [start, end],
  );
}

export interface PaidWithTotal {
  paidWith: PaidWith;
  totalPence: number;
}

/** How the spending in a period was paid for, for the cash-versus-card split. */
export async function paidWithTotals(
  db: Db,
  start: IsoDate,
  end: IsoDate,
): Promise<PaidWithTotal[]> {
  return db.getAllAsync<PaidWithTotal>(
    `SELECT paid_with AS paidWith, SUM(amount_pence) AS totalPence
     FROM expenses
     WHERE spent_on >= ? AND spent_on < ?
     GROUP BY paid_with`,
    [start, end],
  );
}
