import { describe, expect, it } from '@jest/globals';

import type { Category, Expense } from '@/db/types';

import { exportFileName, toCsv } from '../export';

const HEADER = 'Date,Amount,Category,Note,Paid with';

const CATEGORIES: Category[] = [
  { id: 1, name: 'Food', icon: 'fork', color: '#047857', aliases: [], sortOrder: 1 },
  { id: 2, name: 'Travel, rail', icon: 'train', color: '#1D4ED8', aliases: [], sortOrder: 2 },
];

const expense = (fields: Partial<Expense> = {}): Expense => ({
  id: 1,
  amountPence: 1250,
  categoryId: 1,
  note: 'Lunch',
  spentOn: '2026-09-19',
  paidWith: 'card',
  createdAt: '2026-09-19T09:00:00.000Z',
  ...fields,
});

/** The data rows, without the header and the trailing line break. */
const rowsOf = (csv: string): string[] => csv.split('\r\n').slice(1, -1);

describe('toCsv', () => {
  it('starts with the header row even when nothing has been logged', () => {
    expect(toCsv([], CATEGORIES)).toBe(`${HEADER}\r\n`);
  });

  it('writes pence as plain decimal pounds a spreadsheet can add up', () => {
    const csv = toCsv(
      [
        expense({ id: 1, amountPence: 1250 }),
        expense({ id: 2, amountPence: 2000 }),
        expense({ id: 3, amountPence: 7 }),
        expense({ id: 4, amountPence: 123456 }),
      ],
      CATEGORIES,
    );
    expect(rowsOf(csv).map((row) => row.split(',')[1])).toEqual([
      '12.50',
      '20.00',
      '0.07',
      '1234.56',
    ]);
    expect(csv).not.toContain('£');
  });

  it('quotes a note containing a comma or a quote, doubling the inner quotes', () => {
    const csv = toCsv([expense({ note: 'Coffee, cake and a "treat"' })], CATEGORIES);
    expect(rowsOf(csv)).toEqual(['2026-09-19,12.50,Food,"Coffee, cake and a ""treat""",Card']);
  });

  it('quotes a category name containing a comma', () => {
    const csv = toCsv([expense({ categoryId: 2 })], CATEGORIES);
    expect(rowsOf(csv)[0]).toContain('"Travel, rail"');
  });

  it('quotes a note broken over two lines', () => {
    const csv = toCsv([expense({ note: 'Lunch\nwith Sam' })], CATEGORIES);
    expect(csv).toContain('"Lunch\nwith Sam"');
  });

  it('orders rows oldest first, then by id', () => {
    const csv = toCsv(
      [
        expense({ id: 7, spentOn: '2026-09-19' }),
        expense({ id: 2, spentOn: '2026-10-01' }),
        expense({ id: 5, spentOn: '2026-09-19' }),
        expense({ id: 9, spentOn: '2026-08-31' }),
      ],
      CATEGORIES,
    );
    expect(rowsOf(csv).map((row) => row.split(',')[0])).toEqual([
      '2026-08-31',
      '2026-09-19',
      '2026-09-19',
      '2026-10-01',
    ]);
  });

  it('leaves the category cell empty for an id that no longer exists', () => {
    const csv = toCsv([expense({ categoryId: 99 })], CATEGORIES);
    expect(rowsOf(csv)).toEqual(['2026-09-19,12.50,,Lunch,Card']);
  });

  it('labels how it was paid, and leaves the cell empty when that was not recorded', () => {
    const csv = toCsv(
      [
        expense({ id: 1, paidWith: 'cash' }),
        expense({ id: 2, paidWith: 'apple-pay' }),
        expense({ id: 3, paidWith: '' }),
      ],
      CATEGORIES,
    );
    expect(rowsOf(csv).map((row) => row.split(',')[4])).toEqual(['Cash', 'Apple Pay', '']);
  });

  it('ends every line with CRLF', () => {
    const csv = toCsv([expense(), expense({ id: 2 })], CATEGORIES);
    expect(csv.split('\r\n')).toHaveLength(4);
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n');
    expect(csv.endsWith('\r\n')).toBe(true);
  });
});

describe('exportFileName', () => {
  it('names the file after the local day it was exported', () => {
    expect(exportFileName(new Date(2026, 8, 20))).toBe('expenses-2026-09-20.csv');
  });

  it('uses the local date rather than UTC late in the evening', () => {
    expect(exportFileName(new Date(2026, 0, 1, 23, 30))).toBe('expenses-2026-01-01.csv');
  });
});
