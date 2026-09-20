/**
 * Where each category's envelope stands. Closing a period writes one row per
 * budgeted category holding everything that category carries into the period
 * after it: signed, so a debt is a negative row, and cumulative, so the row
 * for the period before is the whole story however long the chain behind it.
 */
import { type MonthKey, shiftMonth } from '@/domain/dates';
import type { PaydayRule } from '@/domain/period';

import type { CategoryCarry, Db } from './types';

const COLUMNS = 'category_id AS categoryId, period_key AS periodKey, amount_pence AS amountPence';

/**
 * The carry each category brings into `periodKey`, by category id: the rows
 * stored against the period before it. Empty when nothing has been carried.
 *
 * `rule` says how period keys are laid out. Periods are keyed by month today,
 * so the previous key is `shiftMonth(-1)` whatever the payday rule does
 * inside them; taking the rule means callers need not change if that stops
 * being true.
 */
export async function carriedInto(
  db: Db,
  periodKey: MonthKey,
  rule: PaydayRule,
): Promise<Map<number, number>> {
  const rows = await db.getAllAsync<{ categoryId: number; amountPence: number }>(
    `SELECT category_id AS categoryId, amount_pence AS amountPence
     FROM category_carry WHERE period_key = ?`,
    [shiftMonth(periodKey, -1)],
  );
  return new Map(rows.map((row) => [row.categoryId, row.amountPence]));
}

/**
 * Records what a category carries out of `periodKey`. Closing a period again
 * replaces the answer rather than adding a second one.
 */
export async function recordCategoryCarry(
  db: Db,
  categoryId: number,
  periodKey: MonthKey,
  amountPence: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO category_carry (category_id, period_key, amount_pence) VALUES (?, ?, ?)
     ON CONFLICT (category_id, period_key) DO UPDATE SET amount_pence = excluded.amount_pence`,
    [categoryId, periodKey, amountPence],
  );
}

/** Every carry recorded for one category, oldest first. */
export async function listCategoryCarry(db: Db, categoryId: number): Promise<CategoryCarry[]> {
  return db.getAllAsync<CategoryCarry>(
    `SELECT ${COLUMNS} FROM category_carry WHERE category_id = ? ORDER BY period_key`,
    [categoryId],
  );
}

/**
 * Wipes every carry. Switching envelope budgeting off means the limits are
 * plain allowances again, and a chain kept while it was off would be wrong
 * the moment it came back on.
 */
export async function clearCategoryCarry(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM category_carry', []);
}
