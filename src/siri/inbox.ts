/**
 * Expenses added through Siri, the Apple Pay automation or the quick-add
 * command arrive as small JSON files written by the App Intents in
 * native/LogExpenseIntent.swift. This module validates them and adds them to
 * the database. It is pure, so it is unit tested; the file access lives in
 * `inbox-sync.ts`.
 */
import { listCategories } from '@/db/categories';
import { addExpense } from '@/db/expenses';
import type { Db } from '@/db/types';
import { fromIsoDate, type IsoDate } from '@/domain/dates';
import { categoriseMerchant } from '@/domain/merchant';
import { MAX_AMOUNT_PENCE, parseWalletAmount } from '@/domain/money';
import type { PaidWith } from '@/domain/paid-with';
import { parseQuickAdd } from '@/domain/quick-add';

const MAX_TEXT_LENGTH = 200;

/** An expense the intent already understood. */
export interface InboxExpense {
  kind: 'expense';
  amountPence: number;
  /** `apple-pay` for Wallet payments, empty for anything Siri was told. */
  paidWith: PaidWith;
  /** Category name as Siri knows it, e.g. "Groceries". Empty when unknown. */
  category: string;
  /** Where an Apple Pay payment was made. Picks the category when `category` is empty. */
  merchant: string;
  note: string;
  spentOn: IsoDate;
}

/** Something said out loud that the phone could not read; the app's parser has a go. */
export interface InboxText {
  kind: 'text';
  text: string;
  spentOn: IsoDate;
}

export type InboxItem = InboxExpense | InboxText;

/**
 * Validates one inbox file. Siri writes `amountPence` and `category`; the
 * Apple Pay intent writes `amountText` exactly as Wallet formats it (e.g.
 * "£3.50") and `merchant`; quick add can write plain `text`. Returns `null`
 * for anything malformed, and for refunds and zero amounts.
 */
export function parseInboxEntry(raw: string): InboxItem | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;

  const { amountPence, amountText, category, merchant, note, text, spentOn } = value as Record<
    string,
    unknown
  >;
  if (typeof spentOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) return null;

  const categoryName = typeof category === 'string' ? category.trim() : '';
  const place = typeof merchant === 'string' ? merchant.trim().slice(0, MAX_TEXT_LENGTH) : '';
  const written = typeof note === 'string' ? note.trim().slice(0, MAX_TEXT_LENGTH) : '';

  if (amountPence !== undefined) {
    if (
      typeof amountPence !== 'number' ||
      !Number.isInteger(amountPence) ||
      amountPence <= 0 ||
      amountPence > MAX_AMOUNT_PENCE ||
      (categoryName === '' && place === '')
    ) {
      return null;
    }
    return {
      kind: 'expense',
      amountPence,
      paidWith: '',
      category: categoryName,
      merchant: place,
      note: written === '' ? place : written,
      spentOn,
    };
  }

  if (typeof amountText === 'string') {
    const amount = parseWalletAmount(amountText);
    if (!amount) return null;
    // Foreign amounts are stored as if they were pounds, so keep the original in the note.
    const note = amount.foreign ? `${place} (${amountText.trim()})`.trim() : place;
    return {
      kind: 'expense',
      amountPence: amount.pence,
      paidWith: 'apple-pay',
      category: categoryName,
      merchant: place,
      note,
      spentOn,
    };
  }

  if (typeof text === 'string' && text.trim() !== '') {
    return { kind: 'text', text: text.trim().slice(0, MAX_TEXT_LENGTH), spentOn };
  }

  return null;
}

/**
 * Adds inbox items as expenses in one transaction. Category names match
 * case-insensitively; without one, the merchant picks the category. Anything
 * unmatched falls back to "Other" so nothing is lost. Returns how many
 * expenses were added.
 */
export async function importInboxEntries(db: Db, items: readonly InboxItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const categories = await listCategories(db);
  const idByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
  const fallbackId = idByName.get('other') ?? categories[0]?.id;
  if (fallbackId === undefined) return 0;

  let added = 0;
  await db.withTransactionAsync(async () => {
    for (const item of items) {
      if (item.kind === 'text') {
        // Said out loud on an iPhone without Apple Intelligence, so read it here.
        const parsed = parseQuickAdd(item.text, categories, fromIsoDate(item.spentOn));
        if (!parsed.ok) continue;
        await addExpense(db, {
          amountPence: parsed.amountPence,
          categoryId: parsed.categoryId ?? fallbackId,
          note: parsed.note,
          spentOn: parsed.spentOn,
          paidWith: parsed.paidWith,
        });
        added++;
        continue;
      }

      const categoryId =
        idByName.get(item.category.toLowerCase()) ??
        (item.merchant === '' ? null : categoriseMerchant(item.merchant, categories)) ??
        fallbackId;
      await addExpense(db, {
        amountPence: item.amountPence,
        categoryId,
        note: item.note,
        spentOn: item.spentOn,
        paidWith: item.paidWith,
      });
      added++;
    }
  });
  return added;
}
