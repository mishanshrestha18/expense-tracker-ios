/**
 * Turns the logged expenses into a CSV file. Pure: reading the database and
 * writing the file both happen in the caller.
 */
import type { Category, Expense } from '@/db/types';

import { toIsoDate } from './dates';
import { paidWithLabel } from './paid-with';

const HEADER: readonly string[] = ['Date', 'Amount', 'Category', 'Note', 'Paid with'];

/** Excel and Numbers both want CRLF; a lone LF leaves them with one long row. */
const LINE_END = '\r\n';

export function toCsv(expenses: readonly Expense[], categories: readonly Category[]): string {
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const rows = [...expenses]
    .sort(byDateThenId)
    .map((expense) => [
      expense.spentOn,
      poundsFromPence(expense.amountPence),
      names.get(expense.categoryId) ?? '',
      expense.note,
      expense.paidWith === '' ? '' : paidWithLabel(expense.paidWith),
    ]);
  return [HEADER, ...rows].map(toLine).join('');
}

/** `expenses-2026-09-20.csv` */
export function exportFileName(today: Date): string {
  return `expenses-${toIsoDate(today)}.csv`;
}

/** Oldest first, so the file reads like a statement. */
function byDateThenId(a: Expense, b: Expense): number {
  if (a.spentOn !== b.spentOn) return a.spentOn < b.spentOn ? -1 : 1;
  return a.id - b.id;
}

function toLine(fields: readonly string[]): string {
  return fields.map(escapeField).join(',') + LINE_END;
}

/**
 * Plain decimal pounds and never a currency symbol, so a spreadsheet reads the
 * column as numbers. Split off the integer pence rather than dividing, so no
 * amount can round.
 */
function poundsFromPence(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const absolute = Math.abs(pence);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`;
}

/** RFC 4180: quote a field holding a comma, a quote or a line break, and double inner quotes. */
function escapeField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
