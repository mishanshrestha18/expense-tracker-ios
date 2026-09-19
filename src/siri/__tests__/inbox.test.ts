import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

import { listCategories } from '@/db/categories';
import { listExpensesBetween } from '@/db/expenses';
import { DEFAULT_CATEGORIES } from '@/db/schema';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test-utils/sqljs-db';

import { importInboxEntries, type InboxItem, parseInboxEntry } from '../inbox';

const siri = (amountPence: number, category: string, spentOn: string): InboxItem => ({
  kind: 'expense',
  amountPence,
  paidWith: '',
  category,
  merchant: '',
  note: '',
  spentOn,
});

const payment = (amountPence: number, merchant: string, note = merchant): InboxItem => ({
  kind: 'expense',
  amountPence,
  paidWith: 'apple-pay',
  category: '',
  merchant,
  note,
  spentOn: '2026-09-19',
});

describe('parseInboxEntry', () => {
  it('reads what the Swift intent writes', () => {
    const json = JSON.stringify({
      amountPence: 28500,
      category: 'Groceries',
      spentOn: '2026-09-19',
      createdAt: '2026-09-19T08:30:00Z',
    });
    expect(parseInboxEntry(json)).toEqual(siri(28500, 'Groceries', '2026-09-19'));
  });

  it('reads an Apple Pay payment, amount as Wallet formats it', () => {
    const json = JSON.stringify({
      amountText: '£3.50',
      merchant: ' Pret A Manger ',
      spentOn: '2026-09-19',
      createdAt: '2026-09-19T08:30:00Z',
    });
    expect(parseInboxEntry(json)).toEqual(payment(350, 'Pret A Manger'));
  });

  it('keeps a foreign amount in the note', () => {
    const json = JSON.stringify({ amountText: '€12.00', merchant: 'Café', spentOn: '2026-09-19' });
    expect(parseInboxEntry(json)).toEqual(payment(1200, 'Café', 'Café (€12.00)'));
  });

  it('reads dictation the phone could not understand', () => {
    const json = JSON.stringify({ text: ' a tenner on lunch ', spentOn: '2026-09-19' });
    expect(parseInboxEntry(json)).toEqual({
      kind: 'text',
      text: 'a tenner on lunch',
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
    ['a refund', JSON.stringify({ amountText: '-£3.50', merchant: 'Pret', spentOn: '2026-09-19' })],
    [
      'a zero payment',
      JSON.stringify({ amountText: '£0.00', merchant: 'TfL', spentOn: '2026-09-19' }),
    ],
    ['no amount at all', JSON.stringify({ merchant: 'Pret', spentOn: '2026-09-19' })],
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
      siri(28500, 'groceries', '2026-09-19'),
      siri(420, 'Eating out', '2026-09-18'),
    ]);
    expect(added).toBe(2);

    const categories = await listCategories(db);
    const nameOf = (id: number) => categories.find((c) => c.id === id)?.name;
    const expenses = await listExpensesBetween(db, '2026-09-01', '2026-10-01');
    expect(expenses.map((e) => [e.amountPence, nameOf(e.categoryId), e.spentOn])).toEqual([
      [28500, 'Groceries', '2026-09-19'],
      [420, 'Eating out', '2026-09-18'],
    ]);
  });

  it('files unknown categories under Other rather than losing them', async () => {
    await importInboxEntries(db, [siri(999, 'Pets', '2026-09-19')]);
    const [expense] = await listExpensesBetween(db, '2026-09-01', '2026-10-01');
    const other = (await listCategories(db)).find((c) => c.name === 'Other');
    expect(expense.categoryId).toBe(other?.id);
  });

  it('picks the category of an Apple Pay payment from the merchant', async () => {
    await importInboxEntries(db, [
      payment(6420, 'TESCO STORES 3021'),
      payment(350, 'Pret A Manger'),
      payment(1500, 'Blue Door Ltd'),
    ]);
    const categories = await listCategories(db);
    const nameOf = (id: number) => categories.find((c) => c.id === id)?.name;
    const expenses = await listExpensesBetween(db, '2026-09-01', '2026-10-01');
    expect(expenses.map((e) => [e.amountPence, nameOf(e.categoryId), e.note])).toEqual(
      expect.arrayContaining([
        [6420, 'Groceries', 'TESCO STORES 3021'],
        [350, 'Eating out', 'Pret A Manger'],
        [1500, 'Other', 'Blue Door Ltd'],
      ]),
    );
    expect(expenses).toHaveLength(3);
  });

  it('reads free text with the quick-add parser', async () => {
    const added = await importInboxEntries(db, [
      { kind: 'text', text: 'a tenner on lunch', spentOn: '2026-09-19' },
      { kind: 'text', text: 'nothing useful here', spentOn: '2026-09-19' },
    ]);
    expect(added).toBe(1);

    const categories = await listCategories(db);
    const [expense] = await listExpensesBetween(db, '2026-09-01', '2026-10-01');
    expect(expense.amountPence).toBe(1000);
    expect(categories.find((c) => c.id === expense.categoryId)?.name).toBe('Eating out');
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
