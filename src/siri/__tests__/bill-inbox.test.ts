import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { addCommitment, listSettlements } from '@/db/commitments';
import type { Db } from '@/db/types';
import { createTestDb } from '@/test-utils/sqljs-db';

import { importBillEntries, parseBillEntry } from '../bill-inbox';

let db: Db & { close(): void };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  db.close();
});

describe('parseBillEntry', () => {
  it('reads what the notification wrote', () => {
    expect(
      parseBillEntry('{"commitmentId":7,"dueOn":"2026-09-25","settledAt":"2026-09-25T09:01:00Z"}'),
    ).toEqual({ commitmentId: 7, dueOn: '2026-09-25' });
  });

  it('refuses anything it cannot settle', () => {
    expect(parseBillEntry('not json')).toBeNull();
    expect(parseBillEntry('"a string"')).toBeNull();
    expect(parseBillEntry('{"dueOn":"2026-09-25"}')).toBeNull();
    expect(parseBillEntry('{"commitmentId":0,"dueOn":"2026-09-25"}')).toBeNull();
    expect(parseBillEntry('{"commitmentId":7,"dueOn":"25 September"}')).toBeNull();
  });
});

describe('importBillEntries', () => {
  const rent = {
    name: 'Rent',
    categoryId: 4,
    kind: 'fixed' as const,
    dueDay: 25,
    everyMonths: 1,
    anchorMonth: '2026-09',
    endedOn: null,
  };

  it('marks the occurrence paid', async () => {
    const id = await addCommitment(db, rent, 50000, '2026-09-01');

    expect(await importBillEntries(db, [{ commitmentId: id, dueOn: '2026-09-25' }])).toBe(1);

    expect(await listSettlements(db, '2026-09-01', '2026-10-01')).toEqual([
      { commitmentId: id, dueOn: '2026-09-25', status: 'paid', expenseId: null },
    ]);
  });

  it('settles twice without complaining, in case a file is left behind', async () => {
    const id = await addCommitment(db, rent, 50000, '2026-09-01');
    const entry = { commitmentId: id, dueOn: '2026-09-25' };

    await importBillEntries(db, [entry]);
    await importBillEntries(db, [entry]);

    expect(await listSettlements(db, '2026-09-01', '2026-10-01')).toHaveLength(1);
  });
});
