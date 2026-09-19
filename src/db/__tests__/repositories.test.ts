import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { listBudgets, removeBudget, setBudget } from '../budgets';
import { listCategories } from '../categories';
import { clearAllData, loadDemoData } from '../demo-data';
import {
  addExpense,
  deleteExpense,
  getExpense,
  listExpensesInMonth,
  monthlyTotals,
  spendingByCategory,
  totalBetween,
  updateExpense,
} from '../expenses';
import { migrate } from '../migrate';
import { DEFAULT_CATEGORIES, MIGRATIONS } from '../schema';
import type { Db } from '../types';

let db: Db & { close(): void };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  db.close();
});

describe('migrations', () => {
  it('seeds the default categories in order', async () => {
    const categories = await listCategories(db);
    expect(categories.map((c) => c.name)).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
    expect(categories[0].aliases).toContain('tesco');
  });

  it('records the schema version and is safe to run again', async () => {
    await migrate(db);
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
    expect(row?.user_version).toBe(MIGRATIONS.length);
    expect(await listCategories(db)).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});

describe('expenses', () => {
  it('adds, reads, updates and deletes an expense', async () => {
    const id = await addExpense(db, {
      amountPence: 28500,
      categoryId: 1,
      note: '  Weekly shop  ',
      spentOn: '2026-09-19',
    });

    expect(await getExpense(db, id)).toMatchObject({
      id,
      amountPence: 28500,
      categoryId: 1,
      note: 'Weekly shop',
      spentOn: '2026-09-19',
    });

    await updateExpense(db, id, {
      amountPence: 30000,
      categoryId: 2,
      note: '',
      spentOn: '2026-09-18',
    });
    expect(await getExpense(db, id)).toMatchObject({ amountPence: 30000, categoryId: 2, note: '' });

    await deleteExpense(db, id);
    expect(await getExpense(db, id)).toBeNull();
  });

  it('rejects invalid rows at the database level', async () => {
    await expect(
      addExpense(db, { amountPence: 0, categoryId: 1, note: '', spentOn: '2026-09-19' }),
    ).rejects.toThrow();
    await expect(
      addExpense(db, { amountPence: 100, categoryId: 999, note: '', spentOn: '2026-09-19' }),
    ).rejects.toThrow();
    await expect(
      addExpense(db, { amountPence: 100, categoryId: 1, note: '', spentOn: '19/09/2026' }),
    ).rejects.toThrow();
  });

  it('lists a month newest first and aggregates spending', async () => {
    const add = (amountPence: number, categoryId: number, spentOn: string) =>
      addExpense(db, { amountPence, categoryId, note: '', spentOn });
    await add(1000, 1, '2026-08-31');
    await add(2000, 1, '2026-09-01');
    await add(500, 2, '2026-09-15');
    await add(700, 1, '2026-09-30');
    await add(9900, 3, '2026-10-01');

    const september = await listExpensesInMonth(db, '2026-09');
    expect(september.map((e) => e.spentOn)).toEqual(['2026-09-30', '2026-09-15', '2026-09-01']);

    const byCategory = await spendingByCategory(db, '2026-09');
    expect(byCategory).toEqual(
      expect.arrayContaining([
        { categoryId: 1, totalPence: 2700 },
        { categoryId: 2, totalPence: 500 },
      ]),
    );
    expect(byCategory).toHaveLength(2);

    expect(await monthlyTotals(db, '2026-08', '2026-10')).toEqual([
      { month: '2026-08', totalPence: 1000 },
      { month: '2026-09', totalPence: 3200 },
      { month: '2026-10', totalPence: 9900 },
    ]);

    expect(await totalBetween(db, '2026-09-01', '2026-09-16')).toBe(2500);
    expect(await totalBetween(db, '2027-01-01', '2027-02-01')).toBe(0);
  });
});

describe('budgets', () => {
  it('upserts and removes monthly limits', async () => {
    await setBudget(db, 1, 45000);
    await setBudget(db, 1, 50000);
    await setBudget(db, 2, 20000);
    expect(await listBudgets(db)).toEqual(
      expect.arrayContaining([
        { categoryId: 1, monthlyLimitPence: 50000 },
        { categoryId: 2, monthlyLimitPence: 20000 },
      ]),
    );

    await removeBudget(db, 1);
    expect(await listBudgets(db)).toEqual([{ categoryId: 2, monthlyLimitPence: 20000 }]);
  });
});

describe('demo data', () => {
  it('fills the last months deterministically and can be cleared', async () => {
    const today = new Date(2026, 8, 19);
    const added = await loadDemoData(db, today);
    expect(added).toBeGreaterThan(50);

    const totals = await monthlyTotals(db, '2026-03', '2026-09');
    expect(totals.length).toBeGreaterThanOrEqual(6);
    expect(await listBudgets(db)).not.toHaveLength(0);

    const other = await createTestDb();
    expect(await loadDemoData(other, today)).toBe(added);
    other.close();

    await clearAllData(db);
    expect(await monthlyTotals(db, '2026-03', '2026-09')).toEqual([]);
    expect(await listBudgets(db)).toEqual([]);
    expect(await listCategories(db)).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});
