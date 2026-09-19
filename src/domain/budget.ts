/** Budget maths for a single budget period. Pure functions over integer pence. */
import { toIsoDate } from './dates';
import { type Period, periodElapsed } from './period';

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
 * - `on-track`: spending is at or below a straight-line pace through the month
 * - `fast`: noticeably ahead of that pace, though still within the limit
 * - `over`: the limit is already exceeded
 * - `under`: a finished month that stayed within the limit
 * - `upcoming`: a month that has not started
 */
export type PaceStatus = 'on-track' | 'fast' | 'over' | 'under' | 'upcoming';

export interface BudgetPace {
  status: PaceStatus;
  /** Share of the period gone (counting today), 0–1. `null` outside the current period. */
  elapsed: number | null;
}

/**
 * Slack before "spending fast", as a share of the limit, so one early bill
 * (rent on the 1st) does not immediately raise the alarm.
 */
export const PACE_CUSHION = 0.1;

/** Compares spending with an even spread of the limit across the period. */
export function budgetPace(
  spentPence: number,
  limitPence: number,
  period: Period,
  today: Date = new Date(),
): BudgetPace {
  if (toIsoDate(today) < period.start) return { status: 'upcoming', elapsed: null };

  const elapsed = periodElapsed(period, today);
  if (spentPence > limitPence) return { status: 'over', elapsed };
  if (elapsed === null) return { status: 'under', elapsed };

  const expectedPence = limitPence * elapsed;
  const status = spentPence - expectedPence > limitPence * PACE_CUSHION ? 'fast' : 'on-track';
  return { status, elapsed };
}

/**
 * What is left once the fees still expected this period are set aside, so the
 * daily allowance does not promise money that rent is about to take.
 */
export function safeToSpendPence(
  remainingPence: number | null,
  upcomingPence: number,
): number | null {
  return remainingPence === null ? null : remainingPence - upcomingPence;
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

/**
 * What the headline budget figure measures:
 * - `monthly`: all spending against the overall monthly budget
 * - `categories`: spending in budgeted categories against their combined limits
 * - `none`: no budgets at all
 */
export type BudgetBasis = 'monthly' | 'categories' | 'none';

export interface BudgetOverview {
  /** Everything spent in the month, budgeted or not. */
  totalSpentPence: number;
  /** The overall monthly budget, or `null` when not set. */
  monthlyLimitPence: number | null;
  /** Sum of all category limits. `0` when none are set. */
  categoryLimitsPence: number;
  /** Spending in categories that have their own budget. */
  budgetedSpentPence: number;
  /** Spending in categories without their own budget. */
  unbudgetedSpentPence: number;
  basis: BudgetBasis;
  /** The headline figure, measured against `basis`. */
  progress: BudgetProgress;
  /**
   * Monthly budget left after category limits; negative when the categories add
   * up to more than the monthly budget. `null` without a monthly budget.
   */
  unallocatedPence: number | null;
}

/**
 * Combines the overall monthly budget with per-category limits. The monthly
 * budget, when set, is the headline because it covers every category; category
 * limits are then sub-budgets within it.
 */
export function budgetOverview(
  spending: readonly CategorySpend[],
  budgets: readonly CategoryBudget[],
  monthlyLimitPence: number | null = null,
): BudgetOverview {
  const limits = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  let budgetedSpentPence = 0;
  let unbudgetedSpentPence = 0;
  for (const { categoryId, totalPence } of spending) {
    if (limits.has(categoryId)) budgetedSpentPence += totalPence;
    else unbudgetedSpentPence += totalPence;
  }
  const totalSpentPence = budgetedSpentPence + unbudgetedSpentPence;
  const categoryLimitsPence = budgets.reduce((sum, b) => sum + b.monthlyLimitPence, 0);
  const monthly = monthlyLimitPence !== null && monthlyLimitPence > 0 ? monthlyLimitPence : null;

  const basis: BudgetBasis =
    monthly !== null ? 'monthly' : categoryLimitsPence > 0 ? 'categories' : 'none';
  const progress =
    basis === 'monthly'
      ? budgetProgress(totalSpentPence, monthly)
      : basis === 'categories'
        ? budgetProgress(budgetedSpentPence, categoryLimitsPence)
        : budgetProgress(totalSpentPence, null);

  return {
    totalSpentPence,
    monthlyLimitPence: monthly,
    categoryLimitsPence,
    budgetedSpentPence,
    unbudgetedSpentPence,
    basis,
    progress,
    unallocatedPence: monthly === null ? null : monthly - categoryLimitsPence,
  };
}
