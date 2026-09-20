/**
 * A small JSON summary of the budget for the App Intents to read. Siri answers
 * "what's left for eating out" and the Apple Pay action says what a tap leaves
 * behind, all without opening the app or a second copy of SQLite in the same
 * process (see native/LogExpenseIntent.swift).
 */
import { getOverallBudget, listBudgets } from '@/db/budgets';
import { listCategories } from '@/db/categories';
import { listExpensesBetween, spendingByCategoryBetween } from '@/db/expenses';
import { listMerchantRules, type MerchantRule } from '@/db/merchant-rules';
import { listIgnoredRecurring } from '@/db/recurring';
import { getPaymentAlerts } from '@/db/settings';
import type { Category, Db, Expense } from '@/db/types';
import { type CategorySpend, forecast } from '@/domain/budget';
import {
  addDays,
  formatMonthName,
  fromIsoDate,
  type IsoDate,
  shiftMonth,
  toIsoDate,
} from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { matchPhrasesFor } from '@/domain/merchant';
import {
  daysInPeriod,
  daysRemainingInPeriod,
  type PaydayRule,
  type Period,
  periodFor,
  periodKeyOf,
  periodNoun,
} from '@/domain/period';
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
  /** Shops filed here by hand. Checked before `phrases`. */
  learned: string[][];
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
  /** Where the period is heading at this pace, or `null` before day one is out. */
  forecastPence: number | null;
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
  rules: readonly MerchantRule[];
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
  rules,
  today,
}: SnapshotInput): BudgetSnapshot {
  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  const learnedBy = new Map<number, string[][]>();
  for (const rule of rules) {
    const words = rule.words.split(' ');
    learnedBy.set(rule.categoryId, [...(learnedBy.get(rule.categoryId) ?? []), words]);
  }

  const spentPence = spending.reduce((sum, s) => sum + s.totalPence, 0);
  const daysLeft = daysRemainingInPeriod(period, today);
  const projected =
    daysLeft === null
      ? null
      : forecast(
          spentPence,
          upcomingPence,
          daysInPeriod(period) - daysLeft + 1,
          daysLeft - 1,
          monthlyLimitPence,
        );

  return {
    version: SNAPSHOT_VERSION,
    generatedAt: new Date(today).toISOString(),
    today: toIsoDate(today),
    noun: periodNoun(rule),
    period: describe(period),
    next: describe(next),
    monthlyLimitPence,
    spentPence,
    upcomingPence,
    paymentAlerts,
    forecastPence: projected?.projectedPence ?? null,
    categories: categories.map((category) => ({
      name: category.name,
      limitPence: limitBy.get(category.id) ?? null,
      spentPence: spentBy.get(category.id) ?? 0,
      phrases: matchPhrasesFor(category)
        .map(phraseWords)
        .filter((words) => words.length > 0),
      learned: learnedBy.get(category.id) ?? [],
    })),
  };
}

/** Days before the period ends to warn that it is heading over. */
const NUDGE_DAYS_BEFORE = 3;
/** Late enough to be up, early enough to still change the weekend. */
const NUDGE_HOUR = 10;

export interface BudgetNudge {
  body: string;
  at: Date;
}

/**
 * The one notification worth sending: a few days before the period ends, when
 * the pace says it will finish over. `null` when there is nothing to warn
 * about, or the person has notifications turned off.
 */
export function forecastNudge(snapshot: BudgetSnapshot): BudgetNudge | null {
  if (!snapshot.paymentAlerts) return null;
  if (snapshot.monthlyLimitPence === null || snapshot.forecastPence === null) return null;

  const over = snapshot.forecastPence - snapshot.monthlyLimitPence;
  if (over <= 0) return null;

  // `end` is exclusive, so the last day of the period is the day before it.
  const at = fromIsoDate(addDays(snapshot.period.end, -(NUDGE_DAYS_BEFORE + 1)));
  at.setHours(NUDGE_HOUR, 0, 0, 0);
  if (at.getTime() <= Date.parse(snapshot.generatedAt)) return null;

  const fees =
    snapshot.upcomingPence > 0
      ? `, with ${formatPence(snapshot.upcomingPence)} of fees still to come out`
      : '';
  return { body: `On pace to finish ${formatPence(over)} over${fees}.`, at };
}

/** Reads everything the snapshot needs out of the database. */
export async function readBudgetSnapshot(
  db: Db,
  rule: PaydayRule,
  today: Date = new Date(),
): Promise<BudgetSnapshot> {
  const period = periodFor(periodKeyOf(toIsoDate(today), rule), rule);
  const next = periodFor(shiftMonth(period.key, 1), rule);

  const [categories, budgets, monthlyLimitPence, spending, ignored, paymentAlerts, rules] =
    await Promise.all([
      listCategories(db),
      listBudgets(db),
      getOverallBudget(db),
      spendingByCategoryBetween(db, period.start, period.end),
      listIgnoredRecurring(db),
      getPaymentAlerts(db),
      listMerchantRules(db),
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
    rules,
    today,
  });
}
