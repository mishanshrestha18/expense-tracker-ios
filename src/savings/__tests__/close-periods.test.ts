import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { setOverallBudget } from '@/db/budgets';
import { addExpense } from '@/db/expenses';
import { listSavingsEntries } from '@/db/savings';
import { getSavingsAnchor, setSavingsAnchor } from '@/db/settings';
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
