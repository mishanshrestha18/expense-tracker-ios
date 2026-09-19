/** Budget maths for a single month. Pure functions over integer pence. */

export type BudgetStatus = 'none' | 'ok' | 'warning' | 'over';

/** Spending at or above this share of the limit shows a warning. */
export const WARNING_RATIO = 0.8;

export interface BudgetProgress {
  spentPence: number;
  limitPence: number | null;
  /** Negative when over budget. `null` without a budget. */
  remainingPence: number | null;
  /** Spent ÷ limit, unclamped (1.25 = 25% over). `null` without a budget. */
  ratio: number | null;
  status: BudgetStatus;
}

export function budgetProgress(spentPence: number, limitPence: number | null): BudgetProgress {
  if (limitPence === null || limitPence <= 0) {
    return { spentPence, limitPence: null, remainingPence: null, ratio: null, status: 'none' };
  }
  const ratio = spentPence / limitPence;
  const status: BudgetStatus = ratio > 1 ? 'over' : ratio >= WARNING_RATIO ? 'warning' : 'ok';
  return { spentPence, limitPence, remainingPence: limitPence - spentPence, ratio, status };
}

/**
 * How much can still be spent per day to stay within the limit.
 * `null` when there is no budget, nothing left, or no days remain.
 */
export function dailyAllowancePence(
  remainingPence: number | null,
  daysRemaining: number | null,
): number | null {
  if (remainingPence === null || remainingPence <= 0) return null;
  if (daysRemaining === null || daysRemaining <= 0) return null;
  return Math.floor(remainingPence / daysRemaining);
}

export interface CategorySpend {
  categoryId: number;
  totalPence: number;
}

export interface CategoryBudget {
  categoryId: number;
  monthlyLimitPence: number;
}

export interface BudgetOverview {
  /** Sum of all category limits. `0` when no budgets are set. */
  totalLimitPence: number;
  /** Spending in categories that have a budget. */
  budgetedSpentPence: number;
  /** Spending in categories without a budget. */
  unbudgetedSpentPence: number;
  progress: BudgetProgress;
}

export function budgetOverview(
  spending: readonly CategorySpend[],
  budgets: readonly CategoryBudget[],
): BudgetOverview {
  const limits = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  let budgetedSpentPence = 0;
  let unbudgetedSpentPence = 0;
  for (const { categoryId, totalPence } of spending) {
    if (limits.has(categoryId)) budgetedSpentPence += totalPence;
    else unbudgetedSpentPence += totalPence;
  }
  const totalLimitPence = budgets.reduce((sum, b) => sum + b.monthlyLimitPence, 0);
  return {
    totalLimitPence,
    budgetedSpentPence,
    unbudgetedSpentPence,
    progress: budgetProgress(budgetedSpentPence, totalLimitPence > 0 ? totalLimitPence : null),
  };
}
