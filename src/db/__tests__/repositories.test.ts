import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import {
  getOverallBudget,
  listBudgets,
  removeBudget,
  removeOverallBudget,
  setBudget,
  setOverallBudget,
} from '../budgets';
import { listCategories } from '../categories';
import { clearAllData, loadDemoData } from '../demo-data';
import {
  addExpense,
  dailyTotals,
  deleteExpense,
  getExpense,
  listExpensesBetween,
  paidWithTotals,
  spendingByCategoryBetween,
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

  it('upgrades an existing v1 database without losing data', async () => {
    const legacy = await createTestDb({ migrated: false });
    await legacy.execAsync(MIGRATIONS[0]);
    await legacy.execAsync('PRAGMA user_version = 1');
    // The v1 schema has no paid_with column, so insert the way v1 did.
    await legacy.runAsync(
      'INSERT INTO expenses (amount_pence, category_id, note, spent_on) VALUES (?, ?, ?, ?)',
      [1234, 1, '', '2026-09-01'],
    );
    await setBudget(legacy, 1, 45000);

    await migrate(legacy);

    expect(await listExpensesBetween(legacy, '2026-09-01', '2026-10-01')).toHaveLength(1);
    expect(await listBudgets(legacy)).toEqual([{ categoryId: 1, monthlyLimitPence: 45000 }]);
    await setOverallBudget(legacy, 150000);
    expect(await getOverallBudget(legacy)).toBe(150000);
    legacy.close();
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

  it('lists a date range newest first and aggregates spending', async () => {
    const add = (amountPence: number, categoryId: number, spentOn: string) =>
      addExpense(db, { amountPence, categoryId, note: '', spentOn });
    await add(1000, 1, '2026-08-31');
    await add(2000, 1, '2026-09-01');
    await add(500, 2, '2026-09-15');
    await add(700, 1, '2026-09-30');
    await add(9900, 3, '2026-10-01');

    const september = await listExpensesBetween(db, '2026-09-01', '2026-10-01');
    expect(september.map((e) => e.spentOn)).toEqual(['2026-09-30', '2026-09-15', '2026-09-01']);

    const byCategory = await spendingByCategoryBetween(db, '2026-09-01', '2026-10-01');
    expect(byCategory).toEqual(
      expect.arrayContaining([
        { categoryId: 1, totalPence: 2700 },
        { categoryId: 2, totalPence: 500 },
      ]),
    );
    expect(byCategory).toHaveLength(2);

    expect(await dailyTotals(db, '2026-08-01', '2026-10-02')).toEqual([
      { day: '2026-08-31', totalPence: 1000 },
      { day: '2026-09-01', totalPence: 2000 },
      { day: '2026-09-15', totalPence: 500 },
      { day: '2026-09-30', totalPence: 700 },
      { day: '2026-10-01', totalPence: 9900 },
    ]);

    expect(await paidWithTotals(db, '2026-09-01', '2026-10-01')).toEqual([
      { paidWith: '', totalPence: 3200 },
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

  it('keeps a single overall monthly budget', async () => {
    expect(await getOverallBudget(db)).toBeNull();

    await setOverallBudget(db, 150000);
    await setOverallBudget(db, 160000);
    expect(await getOverallBudget(db)).toBe(160000);
    const row = await db.getFirstAsync<{ rows: number }>(
      'SELECT COUNT(*) AS rows FROM overall_budget',
      [],
    );
    expect(row?.rows).toBe(1);

    await expect(setOverallBudget(db, 0)).rejects.toThrow();

    await removeOverallBudget(db);
    expect(await getOverallBudget(db)).toBeNull();
  });
});

describe('demo data', () => {
  it('fills the last months deterministically and can be cleared', async () => {
    const today = new Date(2026, 8, 19);
    const added = await loadDemoData(db, today);
    expect(added).toBeGreaterThan(50);

    const totals = await dailyTotals(db, '2026-03-01', '2026-10-01');
    expect(totals.length).toBeGreaterThan(50);
    expect(await listBudgets(db)).not.toHaveLength(0);
    expect(await getOverallBudget(db)).toBe(160000);

    const other = await createTestDb();
    expect(await loadDemoData(other, today)).toBe(added);
    other.close();

    await clearAllData(db);
    expect(await dailyTotals(db, '2026-03-01', '2026-10-01')).toEqual([]);
    expect(await listBudgets(db)).toEqual([]);
    expect(await getOverallBudget(db)).toBeNull();
    expect(await listCategories(db)).toHaveLength(DEFAULT_CATEGORIES.length);
  });
});
