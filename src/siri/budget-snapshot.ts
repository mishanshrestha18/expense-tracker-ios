/**
 * A small JSON summary of the budget for the App Intents to read. Siri answers
 * "what's left for eating out" and the Apple Pay action says what a tap leaves
 * behind, all without opening the app or a second copy of SQLite in the same
 * process (see native/LogExpenseIntent.swift).
 */
import { getOverallBudget, listBudgets } from '@/db/budgets';
import { listCategories } from '@/db/categories';
import { listExpensesBetween, spendingByCategoryBetween } from '@/db/expenses';
import { listIgnoredRecurring } from '@/db/recurring';
import { getPaymentAlerts } from '@/db/settings';
import type { Category, Db, Expense } from '@/db/types';
import type { CategorySpend } from '@/domain/budget';
import { formatMonthName, type IsoDate, shiftMonth, toIsoDate } from '@/domain/dates';
import { matchPhrasesFor } from '@/domain/merchant';
import { type PaydayRule, type Period, periodFor, periodKeyOf, periodNoun } from '@/domain/period';
import { phraseWords } from '@/domain/quick-add';
import { detectRecurring, totalUpcomingPence, upcomingFees } from '@/domain/recurring';

export const SNAPSHOT_VERSION = 1;

/** Enough history to see a year of a monthly fee, plus the period in hand. */
const HISTORY_MONTHS = 13;

export interface SnapshotPeriod {
  key: string;
  start: IsoDate;
  /** Exclusive. */
  end: IsoDate;
  /** e.g. "September". */
  label: string;
}

export interface SnapshotCategory {
  name: string;
  limitPence: number | null;
  spentPence: number;
  /** Words that point at this category, for matching a shop name in Swift. */
  phrases: string[][];
}

export interface BudgetSnapshot {
  version: number;
  generatedAt: string;
  today: IsoDate;
  /** "month" or "period", so Siri uses the same word as the app. */
  noun: string;
  period: SnapshotPeriod;
  /** The next period, so Siri still answers on the day the budget rolls over. */
  next: SnapshotPeriod;
  monthlyLimitPence: number | null;
  /** Everything spent in the period, budgeted or not. */
  spentPence: number;
  /** Fees expected before the period is out. */
  upcomingPence: number;
  /** Whether Apple Pay payments may announce themselves with a notification. */
  paymentAlerts: boolean;
  categories: SnapshotCategory[];
}

interface SnapshotInput {
  categories: readonly Category[];
  budgets: readonly { categoryId: number; monthlyLimitPence: number }[];
  monthlyLimitPence: number | null;
  spending: readonly CategorySpend[];
  period: Period;
  next: Period;
  rule: PaydayRule;
  upcomingPence: number;
  paymentAlerts: boolean;
  today: Date;
}

const describe = (period: Period): SnapshotPeriod => ({
  key: period.key,
  start: period.start,
  end: period.end,
  label: formatMonthName(period.key),
});

export function buildSnapshot({
  categories,
  budgets,
  monthlyLimitPence,
  spending,
  period,
  next,
  rule,
  upcomingPence,
  paymentAlerts,
  today,
}: SnapshotInput): BudgetSnapshot {
  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));

  return {
    version: SNAPSHOT_VERSION,
    generatedAt: new Date(today).toISOString(),
    today: toIsoDate(today),
    noun: periodNoun(rule),
    period: describe(period),
    next: describe(next),
    monthlyLimitPence,
    spentPence: spending.reduce((sum, s) => sum + s.totalPence, 0),
    upcomingPence,
    paymentAlerts,
    categories: categories.map((category) => ({
      name: category.name,
      limitPence: limitBy.get(category.id) ?? null,
      spentPence: spentBy.get(category.id) ?? 0,
      phrases: matchPhrasesFor(category)
        .map(phraseWords)
        .filter((words) => words.length > 0),
    })),
  };
}

/** Reads everything the snapshot needs out of the database. */
export async function readBudgetSnapshot(
  db: Db,
  rule: PaydayRule,
  today: Date = new Date(),
): Promise<BudgetSnapshot> {
  const period = periodFor(periodKeyOf(toIsoDate(today), rule), rule);
  const next = periodFor(shiftMonth(period.key, 1), rule);

  const [categories, budgets, monthlyLimitPence, spending, ignored, paymentAlerts] =
    await Promise.all([
      listCategories(db),
      listBudgets(db),
      getOverallBudget(db),
      spendingByCategoryBetween(db, period.start, period.end),
      listIgnoredRecurring(db),
      getPaymentAlerts(db),
    ]);

  const history: Expense[] = await listExpensesBetween(
    db,
    `${shiftMonth(period.key, -HISTORY_MONTHS)}-01`,
    period.end,
  );
  const ignoredKeys = new Set(ignored);
  const series = detectRecurring(history, today).filter((s) => !ignoredKeys.has(s.key));
  const upcomingPence = totalUpcomingPence(upcomingFees(series, history, period, today));

  return buildSnapshot({
    categories,
    budgets,
    monthlyLimitPence,
    spending,
    period,
    next,
    rule,
    upcomingPence,
    paymentAlerts,
    today,
  });
}
