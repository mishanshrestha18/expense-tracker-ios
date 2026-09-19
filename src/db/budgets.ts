import type { Budget, Db } from './types';

export async function listBudgets(db: Db): Promise<Budget[]> {
  return db.getAllAsync<Budget>(
    'SELECT category_id AS categoryId, monthly_limit_pence AS monthlyLimitPence FROM budgets',
    [],
  );
}

/** Creates or replaces the monthly limit for a category. */
export async function setBudget(
  db: Db,
  categoryId: number,
  monthlyLimitPence: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO budgets (category_id, monthly_limit_pence) VALUES (?, ?)
     ON CONFLICT (category_id) DO UPDATE SET monthly_limit_pence = excluded.monthly_limit_pence`,
    [categoryId, monthlyLimitPence],
  );
}

export async function removeBudget(db: Db, categoryId: number): Promise<void> {
  await db.runAsync('DELETE FROM budgets WHERE category_id = ?', [categoryId]);
}

/** The overall monthly budget across all categories, or `null` when none is set. */
export async function getOverallBudget(db: Db): Promise<number | null> {
  const row = await db.getFirstAsync<{ monthlyLimitPence: number }>(
    'SELECT monthly_limit_pence AS monthlyLimitPence FROM overall_budget WHERE id = 1',
    [],
  );
  return row?.monthlyLimitPence ?? null;
}

/** Creates or replaces the overall monthly budget. */
export async function setOverallBudget(db: Db, monthlyLimitPence: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO overall_budget (id, monthly_limit_pence) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET monthly_limit_pence = excluded.monthly_limit_pence`,
    [monthlyLimitPence],
  );
}

export async function removeOverallBudget(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM overall_budget', []);
}
