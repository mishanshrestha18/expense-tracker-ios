import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

import { listCategories } from '@/db/categories';
import { listExpensesInMonth } from '@/db/expenses';
import { DEFAULT_CATEGORIES } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test-utils/sqljs-db';

import { importInboxEntries, parseInboxEntry } from '../inbox';

describe('parseInboxEntry', () => {
  it('reads what the Swift intent writes', () => {
    const json = JSON.stringify({
      amountPence: 28500,
      category: 'Groceries',
      spentOn: '2026-09-19',
      createdAt: '2026-09-19T08:30:00Z',
    });
    expect(parseInboxEntry(json)).toEqual({
      amountPence: 28500,
      category: 'Groceries',
      spentOn: '2026-09-19',
    });
  });

  it.each([
    ['not json', '{oops'],
    ['not an object', '42'],
    [
      'fractional pence',
      JSON.stringify({ amountPence: 12.5, category: 'Bills', spentOn: '2026-09-19' }),
    ],
    ['zero amount', JSON.stringify({ amountPence: 0, category: 'Bills', spentOn: '2026-09-19' })],
    ['missing category', JSON.stringify({ amountPence: 100, spentOn: '2026-09-19' })],
    ['bad date', JSON.stringify({ amountPence: 100, category: 'Bills', spentOn: '19/09/2026' })],
  ])('rejects %s', (_label, text) => {
    expect(parseInboxEntry(text)).toBeNull();
  });
});

describe('importInboxEntries', () => {
  let db: Db & { close(): void };

  beforeEach(async () => {
    db = await createTestDb();
  });

  afterEach(() => {
    db.close();
  });

  it('adds expenses, matching categories case-insensitively', async () => {
    const added = await importInboxEntries(db, [
      { amountPence: 28500, category: 'groceries', spentOn: '2026-09-19' },
      { amountPence: 420, category: 'Eating out', spentOn: '2026-09-18' },
    ]);
    expect(added).toBe(2);

    const categories = await listCategories(db);
    const nameOf = (id: number) => categories.find((c) => c.id === id)?.name;
    const expenses = await listExpensesInMonth(db, '2026-09');
    expect(expenses.map((e) => [e.amountPence, nameOf(e.categoryId), e.spentOn])).toEqual([
      [28500, 'Groceries', '2026-09-19'],
      [420, 'Eating out', '2026-09-18'],
    ]);
  });

  it('files unknown categories under Other rather than losing them', async () => {
    await importInboxEntries(db, [{ amountPence: 999, category: 'Pets', spentOn: '2026-09-19' }]);
    const [expense] = await listExpensesInMonth(db, '2026-09');
    const other = (await listCategories(db)).find((c) => c.name === 'Other');
    expect(expense.categoryId).toBe(other?.id);
  });

  it('does nothing for an empty inbox', async () => {
    expect(await importInboxEntries(db, [])).toBe(0);
  });
});

describe('Siri categories', () => {
  it('match the categories in the database', () => {
    const swift = readFileSync(
      path.join(__dirname, '../../../native/LogExpenseIntent.swift'),
      'utf8',
    );
    const storedNames = [...swift.matchAll(/case \.\w+: return "([^"]+)"/g)].map((m) => m[1]);
    expect(storedNames).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
  });
});
