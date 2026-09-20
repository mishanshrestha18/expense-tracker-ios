/**
 * Bills marked paid from the notification itself. Tapping "Paid" on a reminder
 * cannot reach the database — the app may not even be running — so the answer
 * is written to a file by native/ExpensesNative.swift and imported here.
 */
import { Directory, File, Paths } from 'expo-file-system';

import { settleCommitment } from '@/db/commitments';
import type { Db } from '@/db/types';
import type { IsoDate } from '@/domain/dates';

/** Must match the folder written by native/ExpensesNative.swift. */
const INBOX_DIRECTORY = 'bill-inbox';

export interface BillInboxItem {
  commitmentId: number;
  dueOn: IsoDate;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** `null` for anything that is not a bill the app can settle. */
export function parseBillEntry(text: string): BillInboxItem | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const { commitmentId, dueOn } = parsed as Record<string, unknown>;
  if (typeof commitmentId !== 'number' || !Number.isInteger(commitmentId) || commitmentId <= 0) {
    return null;
  }
  if (typeof dueOn !== 'string' || !ISO_DATE.test(dueOn)) return null;
  return { commitmentId, dueOn };
}

/** Marks each one paid. Settling twice is harmless, so order does not matter. */
export async function importBillEntries(
  db: Db,
  entries: readonly BillInboxItem[],
): Promise<number> {
  let settled = 0;
  for (const entry of entries) {
    await settleCommitment(db, {
      commitmentId: entry.commitmentId,
      dueOn: entry.dueOn,
      status: 'paid',
      expenseId: null,
    });
    settled++;
  }
  return settled;
}

/**
 * Settles anything marked paid from a notification and deletes the files.
 * Cheap when the folder is empty, so it can run whenever the app opens.
 */
export async function drainBillInbox(db: Db): Promise<number> {
  const inbox = new Directory(Paths.document, INBOX_DIRECTORY);
  if (!inbox.exists) return 0;

  const files = inbox
    .list()
    .filter((item): item is File => item instanceof File && item.name.endsWith('.json'));
  if (files.length === 0) return 0;

  const entries: BillInboxItem[] = [];
  for (const file of files) {
    const entry = parseBillEntry(await file.text());
    if (entry) entries.push(entry);
  }

  const settled = await importBillEntries(db, entries);
  // Only after the imports committed; unreadable files are dropped too.
  for (const file of files) file.delete();
  return settled;
}
