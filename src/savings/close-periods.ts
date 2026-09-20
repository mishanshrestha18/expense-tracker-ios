/**
 * Closing the books. When a budget period ends, whatever the budget had left
 * becomes savings, and an overspend comes back out of it. This runs whenever
 * the app opens, so a phone left shut for two months catches up in order, and
 * a period is only ever closed once.
 */
import { getOverallBudget } from '@/db/budgets';
import { totalBetween } from '@/db/expenses';
import { listCarriedPeriods, recordCarry } from '@/db/savings';
import { getSavingsAnchor, setSavingsAnchor } from '@/db/settings';
import type { Db } from '@/db/types';
import { currentPeriodKey, type PaydayRule } from '@/domain/period';
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

  const periods = periodsToClose(await listCarriedPeriods(db), rule, today).filter(
    (period) => period.key >= anchor,
  );
  let closed = 0;
  for (const period of periods) {
    const spentPence = await totalBetween(db, period.start, period.end);
    const carry = carryPence(limitPence, spentPence);
    if (carry === null) continue;
    await recordCarry(db, period.key, carry);
    closed++;
  }
  return closed;
}
