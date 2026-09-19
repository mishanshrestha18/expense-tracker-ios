/**
 * Expenses added through Siri or the Wallet (Apple Pay) automation arrive as
 * small JSON files written by the App Intents in native/LogExpenseIntent.swift.
 * This module validates them and adds them to the database. It is pure, so it
 * is unit tested; the file access lives in `inbox-sync.ts`.
 */
import { listCategories } from '@/db/categories';
import { addExpense } from '@/db/expenses';
import type { Db } from '@/db/types';
import type { IsoDate } from '@/domain/dates';
import { categoriseMerchant } from '@/domain/merchant';
import { MAX_AMOUNT_PENCE, parseWalletAmount } from '@/domain/money';

const MAX_MERCHANT_LENGTH = 100;

export interface InboxEntry {
  amountPence: number;
  /** Category name as Siri knows it, e.g. "Groceries". Empty for Apple Pay payments. */
  category: string;
  /** Where an Apple Pay payment was made. Picks the category when `category` is empty. */
  merchant: string;
  note: string;
  spentOn: IsoDate;
}

/**
 * Validates one inbox file. Siri writes `amountPence` and `category`; the
 * Apple Pay intent writes `amountText` exactly as Wallet formats it (e.g.
 * "£3.50") and `merchant`. Returns `null` for anything malformed, and for
 * refunds and zero amounts.
 */
export function parseInboxEntry(text: string): InboxEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const { amountPence, amountText, category, merchant, spentOn } = value as Record<string, unknown>;
  if (typeof spentOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return null;
  const categoryName = typeof category === 'string' ? category.trim() : '';
  const place = typeof merchant === 'string' ? merchant.trim().slice(0, MAX_MERCHANT_LENGTH) : '';

  if (amountPence !== undefined) {
    if (
      typeof amountPence !== 'number' ||
      !Number.isInteger(amountPence) ||
      amountPence <= 0 ||
      amountPence > MAX_AMOUNT_PENCE ||
      categoryName === ''
    ) {
      return null;
    }
    return { amountPence, category: categoryName, merchant: place, note: place, spentOn };
  }

  if (typeof amountText !== 'string') return null;
  const amount = parseWalletAmount(amountText);
  if (!amount) return null;
  // Foreign amounts are stored as if they were pounds, so keep the original in the note.
  const note = amount.foreign ? [place, `(${amountText.trim()})`].filter(Boolean).join(' ') : place;
  return { amountPence: amount.pence, category: categoryName, merchant: place, note, spentOn };
}

/**
 * Adds inbox entries as expenses in one transaction. Category names match
 * case-insensitively; without one, the merchant picks the category. Anything
 * unmatched falls back to "Other" so nothing is lost. Returns how many
 * expenses were added.
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
      const categoryId =
        idByName.get(entry.category.toLowerCase()) ??
        (entry.merchant === '' ? null : categoriseMerchant(entry.merchant, categories)) ??
        fallbackId;
      await addExpense(db, {
        amountPence: entry.amountPence,
        categoryId,
        note: entry.note,
        spentOn: entry.spentOn,
      });
      added++;
    }
  });
  return added;
}
