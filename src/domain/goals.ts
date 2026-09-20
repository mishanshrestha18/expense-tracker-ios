/**
 * What the savings are for. There is one savings balance and no second
 * ledger: goals are filled from it in `sortOrder`, so the first goal takes
 * what it needs and the next takes what is left. Pure functions over integer
 * pence.
 */
import type { SavingsEntry, SavingsGoal } from '@/db/types';

import { currentMonthKey, formatMonth, monthKeyOf, shiftMonth } from './dates';

/** How many closed periods the saving rate is averaged over by default. */
export const CARRY_PERIODS = 3;

export interface GoalProgress {
  goal: SavingsGoal;
  /** What the balance covers for this goal, after the goals above it. */
  allocatedPence: number;
  /** targetPence - allocatedPence, never negative. */
  remainingPence: number;
  /** allocated ÷ target, 0–1. */
  ratio: number;
  done: boolean;
  /** Periods until it is met at `perPeriodPence`; null when it never is. */
  periodsAway: number | null;
  /** The month it lands in, e.g. "March 2027"; null when unknown. */
  etaLabel: string | null;
  /** True when there is a target date and the ETA is after it. */
  behind: boolean;
}

/**
 * Splits the balance across the goals in order. A negative balance allocates
 * nothing: an overspent pot owes money to the first goal, not to all of them.
 *
 * `perPeriodPence` is what a period adds at the current rate (see
 * `averageCarryPence`). Null, zero or negative means there is nothing to
 * count forward with, so a goal that is not already met has no ETA.
 */
export function allocateGoals(
  goals: readonly SavingsGoal[],
  balancePence: number,
  perPeriodPence: number | null,
  today: Date = new Date(),
): GoalProgress[] {
  const rate = perPeriodPence !== null && perPeriodPence > 0 ? perPeriodPence : null;
  const thisMonth = currentMonthKey(today);
  let left = Math.max(balancePence, 0);

  return goals.map((goal) => {
    const targetPence = Math.max(goal.targetPence, 0);
    const allocatedPence = Math.min(targetPence, left);
    left -= allocatedPence;

    const remainingPence = targetPence - allocatedPence;
    const done = remainingPence === 0;
    // Whole periods, rounded up: half a period short is still a period away.
    const periodsAway = done ? 0 : rate === null ? null : Math.ceil(remainingPence / rate);
    const etaMonth = done || periodsAway === null ? null : shiftMonth(thisMonth, periodsAway);

    return {
      goal,
      allocatedPence,
      remainingPence,
      ratio: targetPence === 0 ? 1 : allocatedPence / targetPence,
      done,
      periodsAway,
      etaLabel: etaMonth === null ? null : formatMonth(etaMonth),
      behind:
        goal.targetDate !== null && etaMonth !== null && etaMonth > monthKeyOf(goal.targetDate),
    };
  });
}

/**
 * What a period puts into savings lately: the mean of the last `periods`
 * carries, newest first by the period they came from. Money moved by hand is
 * ignored, because a birthday cheque says nothing about the rate a budget
 * saves at. `null` until a period has been closed.
 */
export function averageCarryPence(
  entries: readonly SavingsEntry[],
  periods: number = CARRY_PERIODS,
): number | null {
  const recent = entries
    .filter((entry) => entry.kind === 'carry')
    .sort((a, b) => (b.periodKey ?? '').localeCompare(a.periodKey ?? ''))
    .slice(0, Math.max(periods, 0));

  if (recent.length === 0) return null;
  const total = recent.reduce((sum, entry) => sum + entry.amountPence, 0);
  return Math.round(total / recent.length);
}
