import type { IsoDate, MonthKey } from '@/domain/dates';
import type { PaidWith } from '@/domain/paid-with';

export type { PaidWith };

export type SqlValue = string | number | null;

/**
 * The subset of `expo-sqlite`'s `SQLiteDatabase` the app relies on.
 * Repositories depend on this interface rather than the concrete class so
 * they can run against an in-memory SQLite (sql.js) in unit tests.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params: SqlValue[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface Category {
  id: number;
  name: string;
  /** Key into the category icon map (see `components/category-icon`). */
  icon: string;
  color: string;
  aliases: string[];
  sortOrder: number;
}

export interface Expense {
  id: number;
  amountPence: number;
  categoryId: number;
  note: string;
  spentOn: IsoDate;
  paidWith: PaidWith;
  createdAt: string;
}

export type ExpenseInput = Pick<Expense, 'amountPence' | 'categoryId' | 'note' | 'spentOn'> & {
  paidWith?: PaidWith;
};

export interface Budget {
  categoryId: number;
  monthlyLimitPence: number;
}

/**
 * A cost that repeats whether or not anyone opens the app: rent, the car, a
 * subscription. `fixed` means the amount only changes on a date we know about;
 * `variable` means it moves every time (energy, water), so the amount is an
 * estimate and never nags.
 */
export type CommitmentKind = 'fixed' | 'variable';

export interface CommitmentAmount {
  /** The first day this amount applies, `YYYY-MM-DD`. */
  effectiveFrom: IsoDate;
  amountPence: number;
}

export interface Commitment {
  id: number;
  name: string;
  categoryId: number;
  kind: CommitmentKind;
  /** 1–31, clamped to the length of each month. */
  dueDay: number;
  /** 1 monthly, 3 quarterly, 12 annual. */
  everyMonths: number;
  /** The month a payment lands in, which anchors anything not monthly. */
  anchorMonth: MonthKey;
  /** Set when the commitment has stopped; no occurrences after this date. */
  endedOn: IsoDate | null;
  /** The timeline of amounts, oldest first. Read it with `amountOn`. */
  amounts: CommitmentAmount[];
}

export type CommitmentInput = Omit<Commitment, 'id' | 'amounts'>;

/**
 * Money that rolled into savings. A `carry` is what a finished period had
 * left over, written once when the period closes; a negative one is an
 * overspend eating into the balance. An `adjustment` is a person moving
 * money in or out by hand.
 */
export type SavingsEntryKind = 'carry' | 'adjustment';

export interface SavingsEntry {
  id: number;
  kind: SavingsEntryKind;
  /** The period a carry came from, e.g. `"2026-09"`; `null` for adjustments. */
  periodKey: MonthKey | null;
  /** Positive adds to savings, negative takes from it. */
  amountPence: number;
  note: string;
  createdAt: string;
}

/**
 * What the savings are being kept for. Goals are filled from the savings
 * balance in order: the first goal takes what it needs, the next takes what is
 * left, so nothing has to be moved between pots by hand.
 */
export interface SavingsGoal {
  id: number;
  name: string;
  targetPence: number;
  /** When the money is wanted for, `YYYY-MM-DD`; `null` for "no rush". */
  targetDate: IsoDate | null;
  note: string;
  sortOrder: number;
  createdAt: string;
}

export type SavingsGoalInput = Pick<SavingsGoal, 'name' | 'targetPence' | 'targetDate' | 'note'>;

/**
 * What one category has carried into the period after `periodKey`, signed and
 * cumulative: last period's carry plus this period's limit, less what was
 * spent. Only written when envelope budgeting is switched on.
 */
export interface CategoryCarry {
  categoryId: number;
  periodKey: MonthKey;
  amountPence: number;
}

/** What happened to one occurrence of a commitment. */
export interface CommitmentSettlement {
  commitmentId: number;
  /** The occurrence this settles, by its due date. */
  dueOn: IsoDate;
  status: 'paid' | 'skipped';
  /** The expense that paid it, when there is one. */
  expenseId: number | null;
}
