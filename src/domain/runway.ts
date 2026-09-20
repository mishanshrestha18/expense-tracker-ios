/**
 * The runway: what the budget will be worth on every day still to come, not
 * what it has already been spent on.
 *
 * Every budget screen ever built looks backwards — a ring, a bar, a pie of
 * where the money went. This looks forward, because the app knows two things
 * most of them do not: the exact days the bills leave, and where the period
 * actually ends (payday, not the 31st). So the line slopes down at the pace
 * money is being spent, falls off a cliff on the day each bill goes out, and
 * says the date the money runs out — before it does.
 *
 * Pure maths over integer pence; the drawing is in `components/charts/runway`.
 */
import { addDays, formatDate, type IsoDate, toIsoDate } from './dates';
import { formatPenceShort } from './money';
import type { Period } from './period';

export interface ScheduledCost {
  /** The day it leaves the account. */
  dueOn: IsoDate;
  amountPence: number;
  label: string;
}

export interface RunwayInput {
  period: Period;
  today: Date;
  /** The budget for the whole period. Without one there is no runway. */
  limitPence: number | null;
  /** What has actually been spent, day by day, so far. */
  daily: readonly { day: IsoDate; totalPence: number }[];
  /** Bills still to leave: the paid ones are already in `daily`. */
  bills: readonly ScheduledCost[];
  /** Subscriptions and fees the app spotted in the history. */
  fees?: readonly ScheduledCost[];
}

export interface RunwayCliff extends ScheduledCost {
  kind: 'bill' | 'fee';
  /** What is left the moment after it goes out. */
  afterPence: number;
}

export interface RunwayDay {
  on: IsoDate;
  /** What the budget is worth at the end of this day. */
  balancePence: number;
  /** Days up to today are what happened; the rest is the projection. */
  past: boolean;
}

export interface Runway {
  days: RunwayDay[];
  cliffs: RunwayCliff[];
  /** The budget the period started with. */
  startPence: number;
  /** What is left now. */
  todayPence: number;
  /** What the projection says will be left on the last day. */
  endPence: number;
  /** The first day the projection goes below zero. */
  dryOn: IsoDate | null;
  /** Everyday spending per day so far, which is what the projection uses. */
  burnPence: number;
  /** The daily spend that would land exactly on zero, once bills are set aside. */
  levelPence: number;
  /** One sentence for under the chart. */
  headline: string;
}

/** Every day of the period, start inclusive, end exclusive. */
function daysOf(period: Period): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = period.start; day < period.end; day = addDays(day, 1)) days.push(day);
  return days;
}

const sum = (costs: readonly ScheduledCost[]) =>
  costs.reduce((total, cost) => total + cost.amountPence, 0);

/**
 * `null` when there is no budget to measure against — the screen shows the
 * plain "set a budget" prompt instead, rather than a chart of nothing.
 */
export function buildRunway({
  period,
  today,
  limitPence,
  daily,
  bills,
  fees = [],
}: RunwayInput): Runway | null {
  if (limitPence === null || limitPence <= 0) return null;

  const days = daysOf(period);
  if (days.length === 0) return null;

  const todayIso = toIsoDate(today);
  const spentOn = new Map(daily.map((entry) => [entry.day, entry.totalPence]));

  // Only what is still to come is a cliff: anything already paid is in `daily`.
  const ahead = [
    ...bills
      .filter((bill) => bill.dueOn >= todayIso)
      .map((bill) => ({ ...bill, kind: 'bill' as const })),
    ...fees.filter((fee) => fee.dueOn >= todayIso).map((fee) => ({ ...fee, kind: 'fee' as const })),
  ].sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));

  const elapsed = days.filter((day) => day <= todayIso).length;
  const spentSoFar = days
    .filter((day) => day <= todayIso)
    .reduce((total, day) => total + (spentOn.get(day) ?? 0), 0);

  // The pace that matters is everyday money: bills already paid are not a habit.
  const burnPence = elapsed > 0 ? Math.max(0, Math.round(spentSoFar / elapsed)) : 0;

  const cliffs: RunwayCliff[] = [];
  const timeline: RunwayDay[] = [];
  let balance = limitPence;
  let todayPence = limitPence;
  let dryOn: IsoDate | null = null;

  for (const day of days) {
    const past = day <= todayIso;
    balance -= past ? (spentOn.get(day) ?? 0) : burnPence;

    for (const cost of ahead.filter((item) => item.dueOn === day)) {
      balance -= cost.amountPence;
      cliffs.push({ ...cost, afterPence: balance });
    }

    if (dryOn === null && balance < 0) dryOn = day;
    if (day === todayIso) todayPence = balance;
    timeline.push({ on: day, balancePence: balance, past });
  }

  // Before the period starts, "now" is the whole budget.
  if (todayIso < period.start) todayPence = limitPence;

  const daysLeft = days.filter((day) => day > todayIso).length;
  const levelPence =
    daysLeft > 0 ? Math.max(0, Math.floor((todayPence - sum(ahead)) / daysLeft)) : 0;

  return {
    days: timeline,
    cliffs,
    startPence: limitPence,
    todayPence,
    endPence: balance,
    dryOn,
    burnPence,
    levelPence,
    headline: headlineFor({
      dryOn,
      cliffs,
      levelPence,
      endPence: balance,
      daysLeft,
      burnPence,
      todayIso,
      todayPence,
    }),
  };
}

function headlineFor({
  dryOn,
  cliffs,
  levelPence,
  endPence,
  daysLeft,
  burnPence,
  todayIso,
  todayPence,
}: {
  dryOn: IsoDate | null;
  cliffs: RunwayCliff[];
  levelPence: number;
  endPence: number;
  daysLeft: number;
  burnPence: number;
  todayIso: IsoDate;
  todayPence: number;
}): string {
  if (dryOn !== null) {
    const when = formatDate(dryOn);

    // A day that has already been and gone is not a forecast.
    if (dryOn <= todayIso) {
      return `The budget ran out on ${when} — you're ${formatPenceShort(Math.abs(todayPence))} past it.`;
    }

    // Name the thing that tips it over, when a bill lands on that very day.
    const culprit = cliffs.find((cliff) => cliff.dueOn === dryOn);
    if (culprit) return `${culprit.label} on ${when} is what tips it over.`;
    return `Carry on at ${formatPenceShort(burnPence)} a day and it runs out on ${when}.`;
  }

  if (daysLeft === 0) return `All done, with ${formatPenceShort(Math.max(endPence, 0))} left over.`;
  if (levelPence === 0) return `What is left is already spoken for by the bills still to come.`;
  return `${formatPenceShort(levelPence)} a day from here and you make it to the end.`;
}
