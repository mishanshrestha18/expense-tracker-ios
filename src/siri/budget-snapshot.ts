/**
 * A small JSON summary of the budget for the App Intents to read. Siri answers
 * "what's left for eating out" and the Apple Pay action says what a tap leaves
 * behind, all without opening the app or a second copy of SQLite in the same
 * process (see native/LogExpenseIntent.swift).
 */
import { getOverallBudget, listBudgets } from '@/db/budgets';
import { listCommitments, listSettlements } from '@/db/commitments';
import { listCategories } from '@/db/categories';
import { listExpensesBetween, spendingByCategoryBetween, totalBetween } from '@/db/expenses';
import { listMerchantRules, type MerchantRule } from '@/db/merchant-rules';
import { listSavingsEntries } from '@/db/savings';
import { listIgnoredRecurring } from '@/db/recurring';
import { getPaymentAlerts } from '@/db/settings';
import type { Category, Commitment, Db, Expense } from '@/db/types';
import { type CategorySpend, forecast } from '@/domain/budget';
import {
  type CommittedTotals,
  committedTotals,
  nextAmountChange,
  occurrencesIn,
} from '@/domain/commitments';
import {
  addDays,
  formatDate,
  formatMonthName,
  fromIsoDate,
  type IsoDate,
  shiftMonth,
  toIsoDate,
} from '@/domain/dates';
import type { ScheduledAlert } from '@/native/expenses-native';
import { matchPhrasesFor } from '@/domain/merchant';
import { formatPence } from '@/domain/money';
import {
  daysInPeriod,
  daysRemainingInPeriod,
  type PaydayRule,
  type Period,
  periodFor,
  periodKeyOf,
  periodNoun,
  samePointLastPeriod,
  samePointLastYear,
} from '@/domain/period';
import { phraseWords } from '@/domain/quick-add';
import { detectRecurring, totalUpcomingPence, upcomingFees } from '@/domain/recurring';
import { summariseSavings } from '@/domain/savings';

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

export interface SnapshotChange {
  name: string;
  effectiveFrom: IsoDate;
  fromPence: number;
  toPence: number;
}

export interface SnapshotBill {
  name: string;
  dueOn: IsoDate;
  amountPence: number;
  overdue: boolean;
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
  /** The same stretch of earlier periods, for "am I spending more than last month". */
  lastPeriodPence: number;
  lastYearPence: number;
  /** What the bills take this period. */
  committed: CommittedTotals;
  /** The budget once bills are out of it; `null` without a monthly budget. */
  everydayLimitPence: number | null;
  /** Spending that was not one of the bills. */
  everydaySpentPence: number;
  /** Bills still waiting, soonest first. */
  bills: SnapshotBill[];
  /** What finished periods have rolled into savings, plus anything moved by hand. */
  savingsBalancePence: number;
  /** Price changes already pencilled in, soonest first. */
  changes: SnapshotChange[];
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
  lastPeriodPence: number;
  lastYearPence: number;
  committed: CommittedTotals;
  bills: SnapshotBill[];
  changes: SnapshotChange[];
  savingsBalancePence: number;
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
  lastPeriodPence,
  lastYearPence,
  committed,
  bills,
  changes,
  savingsBalancePence,
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
    lastPeriodPence,
    lastYearPence,
    committed,
    bills,
    changes,
    savingsBalancePence,
    everydayLimitPence:
      monthlyLimitPence === null
        ? null
        : Math.max(0, monthlyLimitPence - committed.duePence - committed.setAsidePence),
    everydaySpentPence: Math.max(0, spentPence - committed.paidPence),
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

/** The hour bills and changes are announced at. */
const BILL_ALERT_HOUR = 9;
const CHANGE_ALERT_HOUR = 10;

/**
 * Every reminder worth booking: a bill on the day it leaves, a price change a
 * week before it lands, and the nudge when the period is heading over. All of
 * it is off unless notifications are on, because one nagging app is one too
 * many.
 */
export function alertsFor(snapshot: BudgetSnapshot): ScheduledAlert[] {
  if (!snapshot.paymentAlerts) return [];
  const now = Date.parse(snapshot.generatedAt);
  const alerts: ScheduledAlert[] = [];

  for (const bill of snapshot.bills) {
    if (bill.overdue) continue; // The red banner in the app already says so.
    const at = fromIsoDate(bill.dueOn);
    at.setHours(BILL_ALERT_HOUR, 0, 0, 0);
    alerts.push({
      id: `bill-${bill.name}-${bill.dueOn}`,
      title: 'Bill due today',
      body: `${bill.name}, ${formatPence(bill.amountPence)}.`,
      at,
    });
  }

  for (const change of snapshot.changes) {
    const at = fromIsoDate(addDays(change.effectiveFrom, -CHANGE_NOTICE_DAYS));
    at.setHours(CHANGE_ALERT_HOUR, 0, 0, 0);
    alerts.push({
      id: `change-${change.name}-${change.effectiveFrom}`,
      title: 'Price change coming',
      body: `${change.name} goes from ${formatPence(change.fromPence)} to ${formatPence(
        change.toPence,
      )} on ${formatDate(change.effectiveFrom)}.`,
      at,
    });
  }

  const nudge = forecastNudge(snapshot);
  if (nudge) alerts.push({ id: 'forecast', title: 'Before payday', ...nudge });

  return alerts
    .filter((alert) => alert.at.getTime() > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Days ahead worth warning about a price change. */
const CHANGE_HORIZON_DAYS = 60;
/** Days before a change lands that the warning goes out. */
const CHANGE_NOTICE_DAYS = 7;

function upcomingChanges(commitments: readonly Commitment[], today: Date): SnapshotChange[] {
  const horizon = addDays(toIsoDate(today), CHANGE_HORIZON_DAYS);
  return commitments
    .map((commitment) => ({ commitment, change: nextAmountChange(commitment, today) }))
    .filter(({ change }) => change !== null && change.effectiveFrom <= horizon)
    .map(({ commitment, change }) => ({
      name: commitment.name,
      effectiveFrom: change!.effectiveFrom,
      fromPence: change!.fromPence,
      toPence: change!.toPence,
    }))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
}

/** Reads everything the snapshot needs out of the database. */
export async function readBudgetSnapshot(
  db: Db,
  rule: PaydayRule,
  today: Date = new Date(),
): Promise<BudgetSnapshot> {
  const period = periodFor(periodKeyOf(toIsoDate(today), rule), rule);
  const next = periodFor(shiftMonth(period.key, 1), rule);

  const [
    categories,
    budgets,
    monthlyLimitPence,
    spending,
    ignored,
    paymentAlerts,
    rules,
    commitments,
    settlements,
    savingsEntries,
  ] = await Promise.all([
    listCategories(db),
    listBudgets(db),
    getOverallBudget(db),
    spendingByCategoryBetween(db, period.start, period.end),
    listIgnoredRecurring(db),
    getPaymentAlerts(db),
    listMerchantRules(db),
    listCommitments(db),
    listSettlements(db, period.start, period.end),
    listSavingsEntries(db),
  ]);

  const occurrences = occurrencesIn(commitments, settlements, period, today);
  const committed = committedTotals(commitments, occurrences, today);
  const nameOf = new Map(commitments.map((c) => [c.id, c.name]));
  const bills = occurrences
    .filter((o) => o.status !== 'paid' && o.status !== 'skipped')
    .slice(0, 8)
    .map((o) => ({
      name: nameOf.get(o.commitmentId) ?? 'Bill',
      dueOn: o.dueOn,
      amountPence: o.amountPence,
      overdue: o.status === 'overdue',
    }));
  const changes = upcomingChanges(commitments, today);

  const history: Expense[] = await listExpensesBetween(
    db,
    `${shiftMonth(period.key, -HISTORY_MONTHS)}-01`,
    period.end,
  );
  const lastPeriod = samePointLastPeriod(period.key, rule, today);
  const lastYear = samePointLastYear(period.key, rule, today);
  const [lastPeriodPence, lastYearPence] = await Promise.all([
    totalBetween(db, lastPeriod.start, lastPeriod.end),
    totalBetween(db, lastYear.start, lastYear.end),
  ]);

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
    lastPeriodPence,
    lastYearPence,
    committed,
    bills,
    changes,
    savingsBalancePence: summariseSavings(savingsEntries).balancePence,
    today,
  });
}
