/**
 * The maths behind committed costs: bills that repeat monthly, quarterly or
 * annually, whose amount can change on a date known months in advance, and
 * each occurrence of which can be paid or skipped. Pure: no database, and no
 * clock beyond the `today` callers pass in. See `docs/design/committed-costs.md`.
 */
import type { Commitment, CommitmentAmount, CommitmentSettlement } from '@/db/types';

import {
  addDays,
  daysInMonth,
  type IsoDate,
  type MonthKey,
  monthKeyOf,
  shiftMonth,
  toIsoDate,
} from './dates';

export type OccurrenceStatus = 'paid' | 'skipped' | 'overdue' | 'due' | 'upcoming';

export interface Occurrence {
  commitmentId: number;
  dueOn: IsoDate;
  amountPence: number;
  status: OccurrenceStatus;
  /** The expense that paid it, when there is one. */
  expenseId: number | null;
}

const pad = (value: number) => String(value).padStart(2, '0');

const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Months since year zero, so two month keys can be subtracted. */
function monthIndex(key: MonthKey): number {
  const [year, month] = key.split('-').map(Number);
  return year * 12 + (month - 1);
}

/** Never less often than monthly, so bad data cannot divide by zero. */
const cycleOf = (commitment: Commitment) => Math.max(1, Math.round(commitment.everyMonths));

/** The amount in force on a date, or null before the first one starts. */
export function amountOn(commitment: Commitment, iso: IsoDate): number | null {
  let latest: CommitmentAmount | null = null;
  for (const amount of commitment.amounts) {
    if (amount.effectiveFrom > iso) continue;
    if (latest === null || amount.effectiveFrom > latest.effectiveFrom) latest = amount;
  }
  return latest === null ? null : latest.amountPence;
}

/** The first day the commitment has any amount at all; nothing occurs before it. */
function startsOn(commitment: Commitment): IsoDate | null {
  let earliest: IsoDate | null = null;
  for (const { effectiveFrom } of commitment.amounts) {
    if (earliest === null || effectiveFrom < earliest) earliest = effectiveFrom;
  }
  return earliest;
}

/** The day of `month` the payment lands on, clamped to the length of that month. */
function dueDayIn(commitment: Commitment, month: MonthKey): IsoDate {
  return `${month}-${pad(Math.min(Math.max(commitment.dueDay, 1), daysInMonth(month)))}`;
}

/** Due dates from `start` (inclusive) to `end` (exclusive), oldest first. */
export function dueDatesBetween(commitment: Commitment, start: IsoDate, end: IsoDate): IsoDate[] {
  if (end <= start) return [];
  const first = startsOn(commitment);
  if (first === null) return [];

  const cycle = cycleOf(commitment);
  const anchor = monthIndex(commitment.anchorMonth);
  const lastMonth = monthKeyOf(addDays(end, -1));
  const dates: IsoDate[] = [];
  // A range can straddle two months (a pay cycle running 25th to 25th), so try each.
  for (let month = monthKeyOf(start); month <= lastMonth; month = shiftMonth(month, 1)) {
    // Anchored, never counted forwards from today: a bill anchored to March and
    // repeating every 12 months falls in March whichever month is asked about.
    if ((monthIndex(month) - anchor) % cycle !== 0) continue;
    const dueOn = dueDayIn(commitment, month);
    if (dueOn < start || dueOn >= end) continue;
    if (dueOn < first) continue;
    if (commitment.endedOn !== null && dueOn >= commitment.endedOn) continue;
    dates.push(dueOn);
  }
  return dates;
}

const settlementKey = (commitmentId: number, dueOn: IsoDate) => `${commitmentId}:${dueOn}`;

/** What an unsettled occurrence looks like from today. */
function statusOn(dueOn: IsoDate, todayIso: IsoDate): OccurrenceStatus {
  if (dueOn < todayIso) return 'overdue';
  return dueOn === todayIso ? 'due' : 'upcoming';
}

/** Every occurrence of every commitment inside a period, oldest first. */
export function occurrencesIn(
  commitments: readonly Commitment[],
  settlements: readonly CommitmentSettlement[],
  period: { start: IsoDate; end: IsoDate },
  today: Date = new Date(),
): Occurrence[] {
  const settled = new Map<string, CommitmentSettlement>();
  for (const settlement of settlements) {
    settled.set(settlementKey(settlement.commitmentId, settlement.dueOn), settlement);
  }

  const todayIso = toIsoDate(today);
  const occurrences: Occurrence[] = [];
  for (const commitment of commitments) {
    for (const dueOn of dueDatesBetween(commitment, period.start, period.end)) {
      const amountPence = amountOn(commitment, dueOn);
      // `dueDatesBetween` never returns a date before the first amount; this keeps the type honest.
      if (amountPence === null) continue;
      const settlement = settled.get(settlementKey(commitment.id, dueOn));
      occurrences.push({
        commitmentId: commitment.id,
        dueOn,
        amountPence,
        status: settlement ? settlement.status : statusOn(dueOn, todayIso),
        expenseId: settlement ? settlement.expenseId : null,
      });
    }
  }
  return occurrences.sort((a, b) => compare(a.dueOn, b.dueOn) || a.commitmentId - b.commitmentId);
}

/**
 * What a non-monthly cost works out at per month, for setting money aside.
 * `0` before the commitment's first amount starts.
 */
export function monthlySetAsidePence(commitment: Commitment, iso: IsoDate): number {
  const amountPence = amountOn(commitment, iso);
  return amountPence === null ? 0 : Math.round(amountPence / cycleOf(commitment));
}

export interface CommittedTotals {
  /** Everything due in this period except skipped occurrences. */
  duePence: number;
  paidPence: number;
  /** Due but neither paid nor skipped. */
  outstandingPence: number;
  /** Outstanding occurrences whose due date has passed. */
  overduePence: number;
  /** Monthly share of commitments that are NOT due this period (annual insurance etc.). */
  setAsidePence: number;
}

export function committedTotals(
  commitments: readonly Commitment[],
  occurrences: readonly Occurrence[],
  today: Date = new Date(),
): CommittedTotals {
  const todayIso = toIsoDate(today);
  const dueThisPeriod = new Set<number>();
  let duePence = 0;
  let paidPence = 0;
  let outstandingPence = 0;
  let overduePence = 0;

  for (const occurrence of occurrences) {
    // Skipping is still a decision about this period, so nothing is set aside for it either.
    dueThisPeriod.add(occurrence.commitmentId);
    if (occurrence.status === 'skipped') continue;
    duePence += occurrence.amountPence;
    if (occurrence.status === 'paid') {
      paidPence += occurrence.amountPence;
      continue;
    }
    outstandingPence += occurrence.amountPence;
    if (occurrence.dueOn < todayIso) overduePence += occurrence.amountPence;
  }

  let setAsidePence = 0;
  for (const commitment of commitments) {
    if (dueThisPeriod.has(commitment.id)) continue;
    // An ended commitment is never coming back, so nothing needs saving for it.
    if (commitment.endedOn !== null && todayIso >= commitment.endedOn) continue;
    setAsidePence += monthlySetAsidePence(commitment, todayIso);
  }

  return { duePence, paidPence, outstandingPence, overduePence, setAsidePence };
}

export interface AmountChange {
  effectiveFrom: IsoDate;
  fromPence: number;
  toPence: number;
}

/** The next change to a fixed commitment's amount, for warning about it. */
export function nextAmountChange(
  commitment: Commitment,
  today: Date = new Date(),
): AmountChange | null {
  // A variable amount moves every time, so a change to one is not news.
  if (commitment.kind !== 'fixed') return null;

  const todayIso = toIsoDate(today);
  let next: CommitmentAmount | null = null;
  for (const amount of commitment.amounts) {
    if (amount.effectiveFrom <= todayIso) continue;
    // Nothing occurs once the commitment has ended, so a later amount never bites.
    if (commitment.endedOn !== null && amount.effectiveFrom >= commitment.endedOn) continue;
    if (next === null || amount.effectiveFrom < next.effectiveFrom) next = amount;
  }
  if (next === null) return null;

  const fromPence = amountOn(commitment, addDays(next.effectiveFrom, -1));
  // The first amount is where the bill starts, not a change to warn about.
  return fromPence === null
    ? null
    : { effectiveFrom: next.effectiveFrom, fromPence, toPence: next.amountPence };
}
