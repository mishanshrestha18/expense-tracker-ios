/**
 * Closing the books. When a budget period ends, whatever the budget had left
 * becomes savings, and an overspend comes back out of it. This runs whenever
 * the app opens, so a phone left shut for two months catches up in order, and
 * a period is only ever closed once.
 */
import { getOverallBudget, listBudgets } from '@/db/budgets';
import { carriedInto, recordCategoryCarry } from '@/db/envelopes';
import { spendingByCategoryBetween, totalBetween } from '@/db/expenses';
import { listCarriedPeriods, recordCarry } from '@/db/savings';
import { getEnvelopes, getSavingsAnchor, setSavingsAnchor } from '@/db/settings';
import type { Budget, Db } from '@/db/types';
import { nextCarry } from '@/domain/envelopes';
import { currentPeriodKey, type PaydayRule, type Period } from '@/domain/period';
import { carryPence, periodsToClose } from '@/domain/savings';

/** Returns how many periods were closed. */
export async function closeFinishedPeriods(
  db: Db,
  rule: PaydayRule,
  today: Date = new Date(),
): Promise<number> {
  // Without a budget there is nothing for a period to have left over.
  const limitPence = await getOverallBudget(db);
  if (limitPence === null) return 0;

  // Savings start the moment a budget exists. Without this, the first run
  // would hand back a full budget for every month before the app was here.
  const anchor = await getSavingsAnchor(db);
  if (anchor === null) {
    await setSavingsAnchor(db, currentPeriodKey(rule, today));
    return 0;
  }

  // Envelopes close alongside savings, on the same pass over the same
  // periods, so a period is closed once for both or not at all.
  const envelopes = await getEnvelopes(db);
  const budgets = envelopes ? await listBudgets(db) : [];

  const periods = periodsToClose(await listCarriedPeriods(db), rule, today).filter(
    (period) => period.key >= anchor,
  );
  let closed = 0;
  for (const period of periods) {
    const spentPence = await totalBetween(db, period.start, period.end);
    const carry = carryPence(limitPence, spentPence);
    if (carry === null) continue;
    await recordCarry(db, period.key, carry);
    if (envelopes) await closeEnvelopes(db, budgets, period, rule);
    closed++;
  }
  return closed;
}

/**
 * Hands each budgeted category whatever its envelope has left, as one row
 * against the period just closed. Because the row is cumulative, the period
 * before it is all this has to read, and closing periods oldest first chains
 * each one on to the last. A category without a budget has no envelope, so it
 * gets no row.
 */
async function closeEnvelopes(
  db: Db,
  budgets: readonly Budget[],
  period: Period,
  rule: PaydayRule,
): Promise<void> {
  if (budgets.length === 0) return;
  const carriedIn = await carriedInto(db, period.key, rule);
  const spending = await spendingByCategoryBetween(db, period.start, period.end);
  const spentBy = new Map(spending.map((row) => [row.categoryId, row.totalPence]));

  for (const budget of budgets) {
    const carry = nextCarry(
      budget.monthlyLimitPence,
      carriedIn.get(budget.categoryId) ?? 0,
      spentBy.get(budget.categoryId) ?? 0,
    );
    if (carry === null) continue;
    await recordCategoryCarry(db, budget.categoryId, period.key, carry);
  }
}
