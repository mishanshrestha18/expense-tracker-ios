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
import {
  addCommitment,
  deleteCommitment,
  getCommitment,
  listCommitments,
  listSettlements,
  removeCommitmentAmount,
  setCommitmentAmount,
  settleCommitment,
  unsettleCommitment,
  updateCommitment,
} from '../commitments';
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
import {
  addSavingsAdjustment,
  listCarriedPeriods,
  listSavingsEntries,
  recordCarry,
  removeSavingsEntry,
} from '../savings';
import { DEFAULT_CATEGORIES, MIGRATIONS } from '../schema';
import type { CommitmentInput, Db } from '../types';

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

describe('commitments', () => {
  const rent: CommitmentInput = {
    name: 'Rent',
    categoryId: 4,
    kind: 'fixed',
    dueDay: 1,
    everyMonths: 1,
    anchorMonth: '2026-09',
    endedOn: null,
  };

  it('upgrades an existing v4 database without losing data', async () => {
    const legacy = await createTestDb({ migrated: false });
    for (const migration of MIGRATIONS.slice(0, 4)) await legacy.execAsync(migration);
    await legacy.execAsync('PRAGMA user_version = 4');
    const expenseId = await addExpense(legacy, {
      amountPence: 90000,
      categoryId: 4,
      note: 'Rent',
      spentOn: '2026-09-01',
    });
    await setBudget(legacy, 4, 100000);

    await migrate(legacy);

    expect(await getExpense(legacy, expenseId)).toMatchObject({ amountPence: 90000 });
    expect(await listBudgets(legacy)).toEqual([{ categoryId: 4, monthlyLimitPence: 100000 }]);
    expect(await listCommitments(legacy)).toEqual([]);
    legacy.close();
  });

  it('stores a commitment with the amount it starts on', async () => {
    const id = await addCommitment(db, { ...rent, name: '  Rent  ' }, 90000, '2026-09-01');

    expect(await getCommitment(db, id)).toEqual({
      id,
      ...rent,
      amounts: [{ effectiveFrom: '2026-09-01', amountPence: 90000 }],
    });
    expect(await getCommitment(db, id + 1)).toBeNull();
  });

  it('lists commitments oldest first with the ended ones last', async () => {
    const rentId = await addCommitment(db, rent, 90000, '2026-09-01');
    const gymId = await addCommitment(
      db,
      { ...rent, name: 'Gym', categoryId: 7, dueDay: 15, endedOn: '2026-08-31' },
      3500,
      '2026-01-01',
    );
    const insuranceId = await addCommitment(
      db,
      { ...rent, name: 'Car insurance', categoryId: 3, dueDay: 12, everyMonths: 12 },
      42000,
      '2026-03-12',
    );

    const all = await listCommitments(db);
    expect(all.map((c) => c.id)).toEqual([rentId, insuranceId, gymId]);
    expect(all.map((c) => c.amounts)).toEqual([
      [{ effectiveFrom: '2026-09-01', amountPence: 90000 }],
      [{ effectiveFrom: '2026-03-12', amountPence: 42000 }],
      [{ effectiveFrom: '2026-01-01', amountPence: 3500 }],
    ]);
    expect(all[1].everyMonths).toBe(12);
  });

  it('keeps a future amount alongside the current one', async () => {
    const id = await addCommitment(db, rent, 50000, '2026-09-01');

    await setCommitmentAmount(db, id, '2027-10-01', 70000);
    expect((await getCommitment(db, id))?.amounts).toEqual([
      { effectiveFrom: '2026-09-01', amountPence: 50000 },
      { effectiveFrom: '2027-10-01', amountPence: 70000 },
    ]);

    // Correcting a dated change replaces it rather than adding a second row.
    await setCommitmentAmount(db, id, '2027-10-01', 72500);
    expect((await getCommitment(db, id))?.amounts).toEqual([
      { effectiveFrom: '2026-09-01', amountPence: 50000 },
      { effectiveFrom: '2027-10-01', amountPence: 72500 },
    ]);
    await expect(setCommitmentAmount(db, id, '2028-01-01', 0)).rejects.toThrow();

    await removeCommitmentAmount(db, id, '2027-10-01');
    expect((await getCommitment(db, id))?.amounts).toEqual([
      { effectiveFrom: '2026-09-01', amountPence: 50000 },
    ]);
  });

  it('updates a commitment and deletes it with everything hanging off it', async () => {
    const id = await addCommitment(db, rent, 90000, '2026-09-01');
    await setCommitmentAmount(db, id, '2027-10-01', 95000);
    await settleCommitment(db, {
      commitmentId: id,
      dueOn: '2026-09-01',
      status: 'paid',
      expenseId: null,
    });

    await updateCommitment(db, id, {
      ...rent,
      name: 'Rent (new flat)',
      dueDay: 5,
      endedOn: '2027-03-31',
    });
    expect(await getCommitment(db, id)).toMatchObject({
      name: 'Rent (new flat)',
      dueDay: 5,
      endedOn: '2027-03-31',
      amounts: [
        { effectiveFrom: '2026-09-01', amountPence: 90000 },
        { effectiveFrom: '2027-10-01', amountPence: 95000 },
      ],
    });

    await deleteCommitment(db, id);
    expect(await getCommitment(db, id)).toBeNull();
    expect(await listSettlements(db, '2026-01-01', '2028-01-01')).toEqual([]);
    const row = await db.getFirstAsync<{ rows: number }>(
      'SELECT COUNT(*) AS rows FROM commitment_amounts',
      [],
    );
    expect(row?.rows).toBe(0);
  });

  it('settles, re-settles and unsettles one occurrence', async () => {
    const id = await addCommitment(db, rent, 90000, '2026-09-01');
    const expenseId = await addExpense(db, {
      amountPence: 90000,
      categoryId: 4,
      note: 'Rent',
      spentOn: '2026-09-01',
    });

    await settleCommitment(db, {
      commitmentId: id,
      dueOn: '2026-09-01',
      status: 'skipped',
      expenseId: null,
    });
    await settleCommitment(db, {
      commitmentId: id,
      dueOn: '2026-09-01',
      status: 'paid',
      expenseId,
    });
    expect(await listSettlements(db, '2026-09-01', '2026-10-01')).toEqual([
      { commitmentId: id, dueOn: '2026-09-01', status: 'paid', expenseId },
    ]);

    // Deleting the expense leaves the occurrence settled, just without a link.
    await deleteExpense(db, expenseId);
    expect(await listSettlements(db, '2026-09-01', '2026-10-01')).toEqual([
      { commitmentId: id, dueOn: '2026-09-01', status: 'paid', expenseId: null },
    ]);

    await unsettleCommitment(db, id, '2026-09-01');
    expect(await listSettlements(db, '2026-09-01', '2026-10-01')).toEqual([]);
  });

  it('lists settlements up to an exclusive end', async () => {
    const id = await addCommitment(db, rent, 90000, '2026-08-01');
    for (const dueOn of ['2026-08-01', '2026-09-01', '2026-10-01']) {
      await settleCommitment(db, { commitmentId: id, dueOn, status: 'paid', expenseId: null });
    }

    expect((await listSettlements(db, '2026-09-01', '2026-10-01')).map((s) => s.dueOn)).toEqual([
      '2026-09-01',
    ]);
    expect((await listSettlements(db, '2026-08-01', '2026-10-02')).map((s) => s.dueOn)).toEqual([
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ]);
    expect(await listSettlements(db, '2026-09-01', '2026-09-01')).toEqual([]);
  });
});

describe('savings', () => {
  it('upgrades an existing v5 database without losing data', async () => {
    const legacy = await createTestDb({ migrated: false });
    for (const migration of MIGRATIONS.slice(0, 5)) await legacy.execAsync(migration);
    await legacy.execAsync('PRAGMA user_version = 5');
    const expenseId = await addExpense(legacy, {
      amountPence: 90000,
      categoryId: 4,
      note: 'Rent',
      spentOn: '2026-09-01',
    });
    await setOverallBudget(legacy, 160000);

    await migrate(legacy);

    expect(await getExpense(legacy, expenseId)).toMatchObject({ amountPence: 90000 });
    expect(await getOverallBudget(legacy)).toBe(160000);
    expect(await listSavingsEntries(legacy)).toEqual([]);
    legacy.close();
  });

  it('carries a period once, whatever it had left over', async () => {
    await recordCarry(db, '2026-07', 17650);
    await recordCarry(db, '2026-08', -11000);

    expect(await listCarriedPeriods(db)).toEqual(['2026-07', '2026-08']);
    expect(await listSavingsEntries(db)).toMatchObject([
      { kind: 'carry', periodKey: '2026-08', amountPence: -11000, note: '' },
      { kind: 'carry', periodKey: '2026-07', amountPence: 17650, note: '' },
    ]);

    // Closing the same period again leaves the first answer alone.
    await recordCarry(db, '2026-07', 500);
    const entries = await listSavingsEntries(db);
    expect(entries).toHaveLength(2);
    expect(entries[1].amountPence).toBe(17650);
  });

  it('moves money in and out by hand', async () => {
    const id = await addSavingsAdjustment(db, 20000, '  Birthday money  ');
    await addSavingsAdjustment(db, -5000, 'New tyres');

    expect(await listSavingsEntries(db)).toMatchObject([
      { kind: 'adjustment', periodKey: null, amountPence: -5000, note: 'New tyres' },
      { id, kind: 'adjustment', periodKey: null, amountPence: 20000, note: 'Birthday money' },
    ]);
    // Adjustments are not periods, so any number of them can sit side by side.
    expect(await listCarriedPeriods(db)).toEqual([]);
  });

  it('removes an entry, leaving its period free to close again', async () => {
    await recordCarry(db, '2026-08', -11000);
    const [carry] = await listSavingsEntries(db);

    await removeSavingsEntry(db, carry.id);
    expect(await listSavingsEntries(db)).toEqual([]);
    expect(await listCarriedPeriods(db)).toEqual([]);

    await recordCarry(db, '2026-08', 2500);
    expect(await listSavingsEntries(db)).toMatchObject([{ amountPence: 2500 }]);
  });

  it('lists entries newest first', async () => {
    await addSavingsAdjustment(db, 1000, 'One');
    const second = await addSavingsAdjustment(db, 2000, 'Two');
    await recordCarry(db, '2026-08', 3000);

    expect((await listSavingsEntries(db)).map((e) => e.amountPence)).toEqual([3000, 2000, 1000]);

    // Backdating an entry moves it down the list, id order notwithstanding.
    await db.runAsync('UPDATE savings_entries SET created_at = ? WHERE id = ?', [
      '2020-01-01T00:00:00.000Z',
      second,
    ]);
    expect((await listSavingsEntries(db)).map((e) => e.amountPence)).toEqual([3000, 1000, 2000]);
  });
});
