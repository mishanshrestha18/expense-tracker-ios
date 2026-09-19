/**
 * Expenses logged with Siri arrive as small JSON files written by the App
 * Intent in native/LogExpenseIntent.swift. This module validates them and adds
 * them to the database. It is pure, so it is unit tested; the file access
 * lives in `inbox-sync.ts`.
 */
import { listCategories } from '@/db/categories';
import { addExpense } from '@/db/expenses';
import type { Db } from '@/db/types';
import type { IsoDate } from '@/domain/dates';
import { MAX_AMOUNT_PENCE } from '@/domain/money';

export interface InboxEntry {
  amountPence: number;
  /** Category name as Siri knows it, e.g. "Groceries". */
  category: string;
  spentOn: IsoDate;
}

/** Validates one inbox file. Returns `null` for anything malformed. */
export function parseInboxEntry(text: string): InboxEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const { amountPence, category, spentOn } = value as Record<string, unknown>;
  if (
    typeof amountPence !== 'number' ||
    !Number.isInteger(amountPence) ||
    amountPence <= 0 ||
    amountPence > MAX_AMOUNT_PENCE
  ) {
    return null;
  }
  if (typeof category !== 'string' || category.trim() === '') return null;
  if (typeof spentOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return null;

  return { amountPence, category: category.trim(), spentOn };
}

/**
 * Adds inbox entries as expenses in one transaction. Category names match
 * case-insensitively; an unknown name falls back to "Other" so nothing is lost.
 * Returns how many expenses were added.
 */
export async function importInboxEntries(db: Db, entries: readonly InboxEntry[]): Promise<number> {
  if (entries.length === 0) return 0;

  const categories = await listCategories(db);
  const idByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const fallbackId = idByName.get('other') ?? categories[0]?.id;
  if (fallbackId === undefined) return 0;

  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await addExpense(db, {
        amountPence: entry.amountPence,
        categoryId: idByName.get(entry.category.toLowerCase()) ?? fallbackId,
        note: '',
        spentOn: entry.spentOn,
      });
      added++;
    }
  });
  return added;
}
