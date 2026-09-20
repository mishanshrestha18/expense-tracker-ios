import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { EMPTY_FILTER, type ExpenseFilter } from '@/domain/search';
import { createTestDb } from '@/test-utils/sqljs-db';

import { addExpense } from '../expenses';
import { searchExpenses, searchTopNotes } from '../search';
import type { Db } from '../types';

let db: Db & { close(): void };

/** Seeded category ids: 1 Groceries, 2 Eating out, 3 Transport, 5 Shopping. */
beforeEach(async () => {
  db = await createTestDb();
  await addExpense(db, {
    amountPence: 4250,
    categoryId: 1,
    note: 'Tesco big shop',
    spentOn: '2026-09-01',
    paidWith: 'card',
  });
  await addExpense(db, {
    amountPence: 1200,
    categoryId: 1,
    note: 'tesco meal deal',
    spentOn: '2026-09-10',
    paidWith: 'cash',
  });
  await addExpense(db, {
    amountPence: 800,
    categoryId: 2,
    note: 'Coffee',
    spentOn: '2026-09-15',
    paidWith: 'card',
  });
  await addExpense(db, {
    amountPence: 9900,
    categoryId: 5,
    note: 'Jacket, 50% off',
    spentOn: '2026-09-20',
    paidWith: 'apple-pay',
  });
  // No note, and nothing recorded about how it was paid.
  await addExpense(db, { amountPence: 2500, categoryId: 3, note: '', spentOn: '2026-08-31' });
});

afterEach(() => {
  db.close();
});

const filter = (patch: Partial<ExpenseFilter>): ExpenseFilter => ({ ...EMPTY_FILTER, ...patch });

const notesOf = async (patch: Partial<ExpenseFilter>) =>
  (await searchExpenses(db, filter(patch))).expenses.map((expense) => expense.note);

describe('searchExpenses', () => {
  it('returns everything, newest first, when nothing is filtered', async () => {
    const result = await searchExpenses(db, EMPTY_FILTER);

    expect(result.count).toBe(5);
    expect(result.totalPence).toBe(18650);
    expect(result.expenses.map((expense) => expense.spentOn)).toEqual([
      '2026-09-20',
      '2026-09-15',
      '2026-09-10',
      '2026-09-01',
      '2026-08-31',
    ]);
  });

  it('puts the latest expense on a day on top', async () => {
    const id = await addExpense(db, {
      amountPence: 500,
      categoryId: 2,
      note: 'Later that day',
      spentOn: '2026-09-20',
    });

    const result = await searchExpenses(db, EMPTY_FILTER);
    expect(result.expenses[0].id).toBe(id);
    expect(result.expenses[1].note).toBe('Jacket, 50% off');
  });

  it('matches the note whatever the case, anywhere in it', async () => {
    expect(await notesOf({ text: 'tesco' })).toEqual(['tesco meal deal', 'Tesco big shop']);
    expect(await notesOf({ text: 'MEAL' })).toEqual(['tesco meal deal']);
    expect(await notesOf({ text: '  Coffee  ' })).toEqual(['Coffee']);
  });

  it('matches the category name, so an expense with no note is still found', async () => {
    expect(await notesOf({ text: 'transport' })).toEqual(['']);
    expect(await notesOf({ text: 'eating out' })).toEqual(['Coffee']);
    // The word can be in the note of one row and the category name of another.
    expect(await notesOf({ text: 'grocer' })).toEqual(['tesco meal deal', 'Tesco big shop']);
  });

  it('takes a wildcard in the search text literally', async () => {
    expect(await notesOf({ text: '50%' })).toEqual(['Jacket, 50% off']);
    // A bare "%" would match every row if it were passed through as a wildcard.
    expect(await notesOf({ text: '%' })).toEqual(['Jacket, 50% off']);
    expect(await notesOf({ text: '_' })).toEqual([]);
    expect(await notesOf({ text: 'Jacket_ 50%' })).toEqual([]);
  });

  it('finds nothing for text that is not there', async () => {
    const result = await searchExpenses(db, filter({ text: 'greggs' }));
    expect(result).toEqual({ expenses: [], totalPence: 0, count: 0 });
  });

  it('filters by category, and by several at once', async () => {
    expect(await notesOf({ categoryIds: [2] })).toEqual(['Coffee']);
    expect(await notesOf({ categoryIds: [2, 5] })).toEqual(['Jacket, 50% off', 'Coffee']);
    expect((await searchExpenses(db, filter({ categoryIds: [1] }))).totalPence).toBe(5450);
  });

  it('filters by how it was paid, including "not recorded"', async () => {
    expect(await notesOf({ paidWith: 'card' })).toEqual(['Coffee', 'Tesco big shop']);
    expect(await notesOf({ paidWith: 'cash' })).toEqual(['tesco meal deal']);
    expect(await notesOf({ paidWith: 'apple-pay' })).toEqual(['Jacket, 50% off']);
    expect(await notesOf({ paidWith: '' })).toEqual(['']);
  });

  it('bounds the amount, inclusive at both ends', async () => {
    expect(await notesOf({ minPence: 2500 })).toEqual(['Jacket, 50% off', 'Tesco big shop', '']);
    expect(await notesOf({ maxPence: 2500 })).toEqual(['Coffee', 'tesco meal deal', '']);
    expect(await notesOf({ minPence: 1200, maxPence: 4250 })).toEqual([
      'tesco meal deal',
      'Tesco big shop',
      '',
    ]);
    expect(await notesOf({ minPence: 4250, maxPence: 4250 })).toEqual(['Tesco big shop']);
  });

  it('bounds the dates, inclusive at both ends', async () => {
    expect(await notesOf({ from: '2026-09-01', to: '2026-09-20' })).toEqual([
      'Jacket, 50% off',
      'Coffee',
      'tesco meal deal',
      'Tesco big shop',
    ]);
    expect(await notesOf({ from: '2026-09-20' })).toEqual(['Jacket, 50% off']);
    expect(await notesOf({ to: '2026-08-31' })).toEqual(['']);
    expect(await notesOf({ from: '2026-09-01', to: '2026-09-01' })).toEqual(['Tesco big shop']);
    expect(await notesOf({ from: '2026-09-21' })).toEqual([]);
  });

  it('combines every filter with AND', async () => {
    expect(
      await notesOf({
        text: 'tesco',
        categoryIds: [1],
        paidWith: 'card',
        minPence: 4000,
        maxPence: 5000,
        from: '2026-09-01',
        to: '2026-09-30',
      }),
    ).toEqual(['Tesco big shop']);

    // One filter that rules it out is enough.
    expect(await notesOf({ text: 'tesco', paidWith: 'card', minPence: 5000 })).toEqual([]);
  });

  it('totals every match while the rows stop at the limit', async () => {
    const result = await searchExpenses(db, EMPTY_FILTER, 2);

    expect(result.expenses.map((expense) => expense.note)).toEqual(['Jacket, 50% off', 'Coffee']);
    expect(result.count).toBe(5);
    expect(result.totalPence).toBe(18650);
  });

  it('reads every column of a match', async () => {
    const result = await searchExpenses(db, filter({ text: 'meal' }));

    expect(result.expenses[0]).toMatchObject({
      amountPence: 1200,
      categoryId: 1,
      note: 'tesco meal deal',
      spentOn: '2026-09-10',
      paidWith: 'cash',
    });
    expect(result.expenses[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('searchTopNotes', () => {
  it('groups the matches by note, biggest spend first', async () => {
    await addExpense(db, {
      amountPence: 1000,
      categoryId: 1,
      note: 'Tesco',
      spentOn: '2026-09-02',
    });
    await addExpense(db, {
      amountPence: 2000,
      categoryId: 1,
      note: 'tesco',
      spentOn: '2026-09-03',
    });

    expect(await searchTopNotes(db, filter({ text: 'tesco' }))).toEqual([
      { note: 'Tesco big shop', totalPence: 4250, count: 1 },
      // The same shop typed two ways is one merchant.
      { note: 'Tesco', totalPence: 3000, count: 2 },
      { note: 'tesco meal deal', totalPence: 1200, count: 1 },
    ]);
  });

  it('leaves out expenses with no note', async () => {
    const notes = await searchTopNotes(db, EMPTY_FILTER);

    expect(notes.map((note) => note.note)).toEqual([
      'Jacket, 50% off',
      'Tesco big shop',
      'tesco meal deal',
      'Coffee',
    ]);
  });

  it('honours the filter and the limit', async () => {
    expect(await searchTopNotes(db, filter({ categoryIds: [1] }))).toEqual([
      { note: 'Tesco big shop', totalPence: 4250, count: 1 },
      { note: 'tesco meal deal', totalPence: 1200, count: 1 },
    ]);
    expect(await searchTopNotes(db, EMPTY_FILTER, 2)).toHaveLength(2);
    expect(await searchTopNotes(db, filter({ text: 'greggs' }))).toEqual([]);
  });
});
