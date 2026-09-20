import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { setBudget, setOverallBudget } from '@/db/budgets';
import { listCategoryCarry } from '@/db/envelopes';
import { addExpense } from '@/db/expenses';
import { listSavingsEntries } from '@/db/savings';
import { getSavingsAnchor, setEnvelopes, setSavingsAnchor } from '@/db/settings';
import type { Db } from '@/db/types';
import { CALENDAR_MONTHS } from '@/domain/period';

import { closeFinishedPeriods } from '../close-periods';

let db: Db & { close(): void };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  db.close();
});

const spend = (amountPence: number, spentOn: string) =>
  addExpense(db, { amountPence, categoryId: 1, note: '', spentOn });

/** Carries oldest first, whichever way the rows come back. */
const carries = async () =>
  (await listSavingsEntries(db))
    .filter((entry) => entry.kind === 'carry')
    .map((entry) => [entry.periodKey, entry.amountPence] as const)
    .sort((a, b) => (a[0]! < b[0]! ? -1 : 1));

describe('closeFinishedPeriods', () => {
  it('does nothing without a budget to measure against', async () => {
    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 8, 20))).toBe(0);
    expect(await getSavingsAnchor(db)).toBeNull();
  });

  it('starts savings at the period the first budget was set in', async () => {
    await setOverallBudget(db, 160000);
    // Months of history from before there was a budget.
    await spend(2000, '2026-05-04');
    await spend(3000, '2026-07-19');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 8, 20))).toBe(0);
    expect(await getSavingsAnchor(db)).toBe('2026-09');
    expect(await carries()).toEqual([]);
  });

  it('carries what the budget had left once the period ends', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-09');
    await spend(120000, '2026-09-10');
    await spend(18000, '2026-09-28');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1))).toBe(1);
    expect(await carries()).toEqual([['2026-09', 22000]]);
  });

  it('takes an overspend back out', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-09');
    await spend(191000, '2026-09-10');

    await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1));
    expect(await carries()).toEqual([['2026-09', -31000]]);
  });

  it('closes a period only once, however often the app opens', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-09');
    await spend(100000, '2026-09-10');

    const today = new Date(2026, 9, 1);
    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, today)).toBe(1);
    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, today)).toBe(0);
    expect(await carries()).toHaveLength(1);
  });

  it('catches up on a phone left shut for two months, oldest first', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-09');
    await spend(150000, '2026-09-10');
    await spend(170000, '2026-10-10');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 10, 3))).toBe(2);
    expect(await carries()).toEqual([
      ['2026-09', 10000],
      ['2026-10', -10000],
    ]);
  });

  it('leaves periods from before the anchor alone', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-10');
    await spend(150000, '2026-09-10');
    await spend(140000, '2026-10-10');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 10, 3))).toBe(1);
    expect(await carries()).toEqual([['2026-10', 20000]]);
  });
});

/** Spending filed under a category other than the default one. */
const spendIn = (categoryId: number, amountPence: number, spentOn: string) =>
  addExpense(db, { amountPence, categoryId, note: '', spentOn });

/** One category's envelope chain as `[period, carried out]` pairs, oldest first. */
const envelopeCarry = async (categoryId: number) =>
  (await listCategoryCarry(db, categoryId)).map((row) => [row.periodKey, row.amountPence] as const);

const envelopeRows = async () =>
  (await db.getAllAsync<{ total: number }>('SELECT COUNT(*) AS total FROM category_carry', []))[0]
    .total;

/** Groceries with a £200 limit, from the period the anchor opens. */
const withEnvelopes = async (limitPence = 20000) => {
  await setOverallBudget(db, 160000);
  await setSavingsAnchor(db, '2026-09');
  await setEnvelopes(db, true);
  await setBudget(db, 1, limitPence);
};

describe('closeFinishedPeriods with envelope budgeting on', () => {
  it('hands what a category did not spend to the next period', async () => {
    await withEnvelopes();
    await spendIn(1, 17000, '2026-09-10');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1))).toBe(1);
    expect(await envelopeCarry(1)).toEqual([['2026-09', 3000]]);
    // The savings pot still sees the whole period, untouched by envelopes.
    expect(await carries()).toEqual([['2026-09', 143000]]);
  });

  it('takes an overspend off the next period', async () => {
    await withEnvelopes();
    await spendIn(1, 23000, '2026-09-10');

    await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1));
    expect(await envelopeCarry(1)).toEqual([['2026-09', -3000]]);
  });

  it('chains each period on to what the one before carried', async () => {
    await withEnvelopes();
    await spendIn(1, 17000, '2026-09-10');
    await spendIn(1, 15000, '2026-10-10');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 10, 3))).toBe(2);
    // £200 limit: £30 left in September, and October starts with £230.
    expect(await envelopeCarry(1)).toEqual([
      ['2026-09', 3000],
      ['2026-10', 8000],
    ]);
  });

  it('carries a debt forward until the budget has paid it off', async () => {
    await withEnvelopes();
    await spendIn(1, 45000, '2026-09-10');

    await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 10, 3));
    expect(await envelopeCarry(1)).toEqual([
      ['2026-09', -25000],
      ['2026-10', -5000],
    ]);
  });

  it('gives a category without a budget nothing to carry', async () => {
    await withEnvelopes();
    await spendIn(2, 9000, '2026-09-12');

    await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1));
    expect(await envelopeCarry(2)).toEqual([]);
    expect(await envelopeCarry(1)).toEqual([['2026-09', 20000]]);
  });

  it('closes an envelope once, however often the app opens', async () => {
    await withEnvelopes();
    await spendIn(1, 17000, '2026-09-10');

    const today = new Date(2026, 9, 1);
    await closeFinishedPeriods(db, CALENDAR_MONTHS, today);
    await closeFinishedPeriods(db, CALENDAR_MONTHS, today);
    expect(await envelopeCarry(1)).toEqual([['2026-09', 3000]]);
  });
});

describe('closeFinishedPeriods with envelope budgeting off', () => {
  it('writes no carry at all, however the categories did', async () => {
    await setOverallBudget(db, 160000);
    await setSavingsAnchor(db, '2026-09');
    await setBudget(db, 1, 20000);
    await spendIn(1, 17000, '2026-09-10');
    await spendIn(2, 23000, '2026-09-11');

    expect(await closeFinishedPeriods(db, CALENDAR_MONTHS, new Date(2026, 9, 1))).toBe(1);
    expect(await envelopeRows()).toBe(0);
    expect(await carries()).toEqual([['2026-09', 120000]]);
  });
});
