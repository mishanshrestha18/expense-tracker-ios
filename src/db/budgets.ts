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
