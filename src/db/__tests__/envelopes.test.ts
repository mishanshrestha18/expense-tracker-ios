import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { CALENDAR_MONTHS } from '@/domain/period';

import {
  carriedInto,
  clearCategoryCarry,
  listCategoryCarry,
  recordCategoryCarry,
} from '../envelopes';
import type { Db } from '../types';

let db: Db & { close(): void };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  db.close();
});

/** Every carry in the table, however it was written. */
const rowCount = async () =>
  (await db.getAllAsync<{ total: number }>('SELECT COUNT(*) AS total FROM category_carry', []))[0]
    .total;

describe('category carry', () => {
  it('keeps one answer per category and period, oldest first', async () => {
    await recordCategoryCarry(db, 1, '2026-09', 3000);
    await recordCategoryCarry(db, 1, '2026-10', 8000);
    await recordCategoryCarry(db, 2, '2026-09', -1200);

    expect(await listCategoryCarry(db, 1)).toEqual([
      { categoryId: 1, periodKey: '2026-09', amountPence: 3000 },
      { categoryId: 1, periodKey: '2026-10', amountPence: 8000 },
    ]);
    expect(await listCategoryCarry(db, 2)).toEqual([
      { categoryId: 2, periodKey: '2026-09', amountPence: -1200 },
    ]);
  });

  it('replaces a carry rather than writing it twice', async () => {
    await recordCategoryCarry(db, 1, '2026-09', 3000);
    await recordCategoryCarry(db, 1, '2026-09', -500);

    expect(await listCategoryCarry(db, 1)).toEqual([
      { categoryId: 1, periodKey: '2026-09', amountPence: -500 },
    ]);
    expect(await rowCount()).toBe(1);
  });

  it('has nothing to say about a category that never carried', async () => {
    expect(await listCategoryCarry(db, 7)).toEqual([]);
  });
});

describe('carriedInto', () => {
  it('reads the rows stored against the period before', async () => {
    await recordCategoryCarry(db, 1, '2026-09', 3000);
    await recordCategoryCarry(db, 2, '2026-09', -1200);
    // The period being asked about has closed too; its own row is for the next one.
    await recordCategoryCarry(db, 1, '2026-10', 8000);

    expect(await carriedInto(db, '2026-10', CALENDAR_MONTHS)).toEqual(
      new Map([
        [1, 3000],
        [2, -1200],
      ]),
    );
    expect(await carriedInto(db, '2026-11', CALENDAR_MONTHS)).toEqual(new Map([[1, 8000]]));
  });

  it('carries nothing in when the period before was never closed', async () => {
    expect(await carriedInto(db, '2026-09', CALENDAR_MONTHS)).toEqual(new Map());

    await recordCategoryCarry(db, 1, '2026-09', 3000);
    // A gap year later: only the period immediately before counts.
    expect(await carriedInto(db, '2027-09', CALENDAR_MONTHS)).toEqual(new Map());
  });

  it('crosses the turn of the year', async () => {
    await recordCategoryCarry(db, 1, '2026-12', 4500);

    expect(await carriedInto(db, '2027-01', CALENDAR_MONTHS)).toEqual(new Map([[1, 4500]]));
  });
});

describe('clearCategoryCarry', () => {
  it('forgets every carry when envelope budgeting is switched off', async () => {
    await recordCategoryCarry(db, 1, '2026-09', 3000);
    await recordCategoryCarry(db, 2, '2026-09', -1200);

    await clearCategoryCarry(db);

    expect(await rowCount()).toBe(0);
    expect(await listCategoryCarry(db, 1)).toEqual([]);
    expect(await carriedInto(db, '2026-10', CALENDAR_MONTHS)).toEqual(new Map());
  });
});
