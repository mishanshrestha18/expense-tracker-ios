/**
 * Savings goals: what the one savings balance is being kept for. A goal holds
 * only a name, a target and when it is wanted for — no money of its own. The
 * balance is shared out across them in `sort_order` (see
 * `src/domain/goals.ts`), so the order of these rows is what decides which
 * goal fills first.
 */
import type { Db, SavingsGoal, SavingsGoalInput } from './types';

interface GoalRow {
  id: number;
  name: string;
  target_pence: number;
  target_date: string | null;
  note: string;
  sort_order: number;
  created_at: string;
}

const COLUMNS = 'id, name, target_pence, target_date, note, sort_order, created_at';

const toGoal = (row: GoalRow): SavingsGoal => ({
  id: row.id,
  name: row.name,
  targetPence: row.target_pence,
  targetDate: row.target_date,
  note: row.note,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

const params = (input: SavingsGoalInput) => [
  input.name.trim(),
  input.targetPence,
  input.targetDate,
  input.note.trim(),
];

/** Every goal in the order they are filled. */
export async function listGoals(db: Db): Promise<SavingsGoal[]> {
  const rows = await db.getAllAsync<GoalRow>(
    `SELECT ${COLUMNS} FROM savings_goals ORDER BY sort_order, id`,
    [],
  );
  return rows.map(toGoal);
}

/** Adds a goal at the end of the queue, behind everything already saved for. */
export async function addGoal(db: Db, input: SavingsGoalInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO savings_goals (name, target_pence, target_date, note, sort_order)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order) + 1, 0) FROM savings_goals))`,
    params(input),
  );
  return result.lastInsertRowId;
}

export async function getGoal(db: Db, id: number): Promise<SavingsGoal | null> {
  const row = await db.getFirstAsync<GoalRow>(`SELECT ${COLUMNS} FROM savings_goals WHERE id = ?`, [
    id,
  ]);
  return row ? toGoal(row) : null;
}

/** Changes the goal itself; its place in the queue is set by `reorderGoals`. */
export async function updateGoal(db: Db, id: number, input: SavingsGoalInput): Promise<void> {
  await db.runAsync(
    `UPDATE savings_goals
     SET name = ?, target_pence = ?, target_date = ?, note = ?
     WHERE id = ?`,
    [...params(input), id],
  );
}

/** Removes the goal. The savings balance is untouched — only the plan for it goes. */
export async function deleteGoal(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM savings_goals WHERE id = ?', [id]);
}

/**
 * Rewrites `sort_order` to match `idsInOrder`, in one transaction so the
 * balance is never shared out against a half-written queue. Ids that are not
 * listed keep the order they had.
 */
export async function reorderGoals(db: Db, idsInOrder: readonly number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const [index, id] of idsInOrder.entries()) {
      await db.runAsync('UPDATE savings_goals SET sort_order = ? WHERE id = ?', [index, id]);
    }
  });
}
