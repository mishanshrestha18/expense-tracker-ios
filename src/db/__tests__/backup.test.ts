import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { dumpDatabase, restoreDatabase } from '../backup';
import { getOverallBudget, listBudgets, setBudget, setOverallBudget } from '../budgets';
import { listCategories } from '../categories';
import {
  addCommitment,
  listCommitments,
  listSettlements,
  setCommitmentAmount,
  settleCommitment,
} from '../commitments';
import { listCategoryCarry, recordCategoryCarry } from '../envelopes';
import { addExpense, listExpensesBetween } from '../expenses';
import { addGoal, listGoals } from '../goals';
import { listMerchantRules, rememberMerchantRule } from '../merchant-rules';
import { ignoreRecurring, listIgnoredRecurring } from '../recurring';
import { addSavingsAdjustment, listSavingsEntries, recordCarry } from '../savings';
import { MIGRATIONS } from '../schema';
import { getPaydayRule, getPaymentAlerts, setPaydayRule, setPaymentAlerts } from '../settings';
import type { Db, SqlValue } from '../types';

type Row = Record<string, SqlValue>;

const ALL_OF_2026 = ['2026-01-01', '2027-01-01'] as const;

let db: Db & { close(): void };
let seeded: Awaited<ReturnType<typeof seed>>;

beforeEach(async () => {
  db = await createTestDb();
  seeded = await seed(db);
});

afterEach(() => {
  db.close();
});

/** A year of the app: something in every table it writes to. */
async function seed(target: Db) {
  const categories = await listCategories(target);
  const groceries = categories.find((category) => category.name === 'Groceries')!;
  const bills = categories.find((category) => category.name === 'Bills')!;

  const lunch = await addExpense(target, {
    amountPence: 1250,
    categoryId: groceries.id,
    note: 'Lunch, "the good one"',
    spentOn: '2026-09-19',
    paidWith: 'apple-pay',
  });
  await addExpense(target, {
    amountPence: 95000,
    categoryId: bills.id,
    note: 'Rent',
    spentOn: '2026-09-01',
  });

  await setBudget(target, groceries.id, 45000);
  await setOverallBudget(target, 160000);

  const rent = await addCommitment(
    target,
    {
      name: 'Rent',
      categoryId: bills.id,
      kind: 'fixed',
      dueDay: 1,
      everyMonths: 1,
      anchorMonth: '2026-09',
      endedOn: null,
    },
    95000,
    '2026-01-01',
  );
  await setCommitmentAmount(target, rent, '2026-10-01', 97500);
  await settleCommitment(target, {
    commitmentId: rent,
    dueOn: '2026-09-01',
    status: 'paid',
    expenseId: lunch,
  });

  await addSavingsAdjustment(target, 25000, 'Birthday money');
  await recordCarry(target, '2026-08', 12345);
  await addGoal(target, {
    name: 'New laptop',
    targetPence: 120000,
    targetDate: '2027-03-01',
    note: '',
  });
  await recordCategoryCarry(target, groceries.id, '2026-08', -2500);
  await rememberMerchantRule(target, 'Pret a Manger', groceries.id);
  await ignoreRecurring(target, 'netflix');
  await setPaydayRule(target, { kind: 'day', day: 25, weekendAdjust: true });
  await setPaymentAlerts(target, true);

  return { groceries, bills, rent, lunch };
}

/** Everything the app can read back, so two databases can be compared whole. */
async function readEverything(target: Db) {
  return {
    categories: await listCategories(target),
    expenses: await listExpensesBetween(target, ...ALL_OF_2026),
    budgets: await listBudgets(target),
    overallBudget: await getOverallBudget(target),
    commitments: await listCommitments(target),
    settlements: await listSettlements(target, ...ALL_OF_2026),
    savings: await listSavingsEntries(target),
    goals: await listGoals(target),
    carry: await listCategoryCarry(target, seeded.groceries.id),
    merchantRules: await listMerchantRules(target),
    ignored: await listIgnoredRecurring(target),
    paydayRule: await getPaydayRule(target),
    alerts: await getPaymentAlerts(target),
  };
}

const withoutColumn = (rows: Row[], column: string): Row[] =>
  rows.map((row) => Object.fromEntries(Object.entries(row).filter(([name]) => name !== column)));

describe('dumpDatabase', () => {
  it('records the schema the backup was taken from', async () => {
    const backup = await dumpDatabase(db);
    expect(backup.app).toBe('expenses');
    expect(backup.schemaVersion).toBe(MIGRATIONS.length);
    expect(Date.parse(backup.exportedAt)).not.toBeNaN();
  });

  it('takes every table in the database, and no SQLite internals', async () => {
    const backup = await dumpDatabase(db);
    const live = await db.getAllAsync<{ name: string }>(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_'`,
      [],
    );

    expect(new Set(Object.keys(backup.tables))).toEqual(new Set(live.map((row) => row.name)));
    expect(Object.keys(backup.tables).some((name) => name.startsWith('sqlite_'))).toBe(false);
    expect(backup.tables.expenses).toHaveLength(2);
  });

  it('lists a table after the ones its foreign keys point at', async () => {
    const order = Object.keys((await dumpDatabase(db)).tables);
    const before = (parent: string, child: string) =>
      expect(order.indexOf(parent)).toBeLessThan(order.indexOf(child));

    before('categories', 'expenses');
    before('categories', 'budgets');
    before('categories', 'commitments');
    before('commitments', 'commitment_amounts');
    before('commitments', 'commitment_settlements');
    before('expenses', 'commitment_settlements');
  });
});

describe('restoreDatabase', () => {
  it('rebuilds the whole app in an empty database', async () => {
    const backup = await dumpDatabase(db);
    const fresh = await createTestDb();
    try {
      await restoreDatabase(fresh, backup);
      expect(await readEverything(fresh)).toEqual(await readEverything(db));
    } finally {
      fresh.close();
    }
  });

  it('keeps ids, so a settlement still points at the expense that paid it', async () => {
    const fresh = await createTestDb();
    try {
      await restoreDatabase(fresh, await dumpDatabase(db));
      const [settlement] = await listSettlements(fresh, ...ALL_OF_2026);
      expect(settlement).toEqual({
        commitmentId: seeded.rent,
        dueOn: '2026-09-01',
        status: 'paid',
        expenseId: seeded.lunch,
      });
    } finally {
      fresh.close();
    }
  });

  it('replaces what is already there rather than merging into it', async () => {
    const backup = await dumpDatabase(db);
    const before = await readEverything(db);

    await addExpense(db, {
      amountPence: 999,
      categoryId: seeded.groceries.id,
      note: 'Logged after the backup',
      spentOn: '2026-09-20',
    });
    await setBudget(db, seeded.bills.id, 30000);
    await addGoal(db, { name: 'A holiday', targetPence: 200000, targetDate: null, note: '' });

    await restoreDatabase(db, backup);

    expect(await readEverything(db)).toEqual(before);
    expect((await listExpensesBetween(db, ...ALL_OF_2026)).map((one) => one.note)).not.toContain(
      'Logged after the backup',
    );
  });

  it('refuses a backup from a newer schema than this app knows', async () => {
    const backup = await dumpDatabase(db);
    const before = await readEverything(db);

    await expect(
      restoreDatabase(db, { ...backup, schemaVersion: backup.schemaVersion + 1 }),
    ).rejects.toThrow(/newer version of Expenses/);
    expect(await readEverything(db)).toEqual(before);
  });

  it('restores an older backup that never heard of a table this app has', async () => {
    const backup = await dumpDatabase(db);
    const older = {
      ...backup,
      schemaVersion: backup.schemaVersion - 2,
      tables: { ...backup.tables },
    };
    delete older.tables.category_carry;
    delete older.tables.savings_goals;

    const fresh = await createTestDb();
    try {
      await restoreDatabase(fresh, older);

      expect(await listExpensesBetween(fresh, ...ALL_OF_2026)).toHaveLength(2);
      expect(await listCommitments(fresh)).toHaveLength(1);
      expect(await listCategoryCarry(fresh, seeded.groceries.id)).toEqual([]);
      expect(await listGoals(fresh)).toEqual([]);
    } finally {
      fresh.close();
    }
  });

  it('skips a table and a column the app has no room for, and defaults the rest', async () => {
    const backup = await dumpDatabase(db);
    const strange = {
      ...backup,
      tables: {
        ...backup.tables,
        wishlist: [{ id: 1, name: 'A table from a version that never shipped' }],
        expenses: withoutColumn(backup.tables.expenses, 'paid_with').map((row) => ({
          ...row,
          mood: 'content',
        })),
      },
    };

    const fresh = await createTestDb();
    try {
      await restoreDatabase(fresh, strange);

      const expenses = await listExpensesBetween(fresh, ...ALL_OF_2026);
      expect(expenses.map((one) => one.amountPence).sort()).toEqual([1250, 95000].sort());
      // The column the backup never had falls back to the schema default.
      expect(expenses.map((one) => one.paidWith)).toEqual(['', '']);
    } finally {
      fresh.close();
    }
  });

  it('leaves the database exactly as it was when a row will not go in', async () => {
    const backup = await dumpDatabase(db);
    const before = await readEverything(db);
    const broken = {
      ...backup,
      tables: {
        ...backup.tables,
        expenses: [
          ...backup.tables.expenses,
          // A free lunch breaks CHECK (amount_pence > 0), part way through.
          {
            id: 99,
            amount_pence: 0,
            category_id: seeded.groceries.id,
            note: 'Free',
            spent_on: '2026-09-19',
          },
        ],
      },
    };

    await expect(restoreDatabase(db, broken)).rejects.toThrow();
    expect(await readEverything(db)).toEqual(before);
  });

  it('empties a table the backup has nothing for', async () => {
    const backup = await dumpDatabase(db);
    const withoutSavings = { ...backup, tables: { ...backup.tables, savings_entries: [] } };

    await restoreDatabase(db, withoutSavings);

    expect(await listSavingsEntries(db)).toEqual([]);
    expect(await listExpensesBetween(db, ...ALL_OF_2026)).toHaveLength(2);
  });
});
