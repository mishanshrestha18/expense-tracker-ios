/**
 * The savings ledger: one row for every period that has been closed and every
 * adjustment made by hand. Amounts are signed, so an overspent period is a
 * negative row rather than a separate kind of entry.
 */
import type { MonthKey } from '@/domain/dates';

import type { Db, SavingsEntry, SavingsEntryKind } from './types';

interface SavingsRow {
  id: number;
  kind: string;
  period_key: string | null;
  amount_pence: number;
  note: string;
  created_at: string;
}

const COLUMNS = 'id, kind, period_key, amount_pence, note, created_at';

const toEntry = (row: SavingsRow): SavingsEntry => ({
  id: row.id,
  kind: row.kind as SavingsEntryKind,
  periodKey: row.period_key,
  amountPence: row.amount_pence,
  note: row.note,
  createdAt: row.created_at,
});

/** Every entry, newest first. */
export async function listSavingsEntries(db: Db): Promise<SavingsEntry[]> {
  const rows = await db.getAllAsync<SavingsRow>(
    `SELECT ${COLUMNS} FROM savings_entries ORDER BY created_at DESC, id DESC`,
    [],
  );
  return rows.map(toEntry);
}

/** The periods already carried, so `periodsToClose` knows where to stop. */
export async function listCarriedPeriods(db: Db): Promise<MonthKey[]> {
  const rows = await db.getAllAsync<{ periodKey: string }>(
    `SELECT period_key AS periodKey FROM savings_entries
     WHERE kind = 'carry'
     ORDER BY period_key`,
    [],
  );
  return rows.map((row) => row.periodKey);
}

/**
 * Closes a period, rolling what it had left over into savings; a negative
 * amount is an overspend. A period can only be closed once, so a second call
 * for the same period does nothing.
 */
export async function recordCarry(db: Db, periodKey: MonthKey, amountPence: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO savings_entries (kind, period_key, amount_pence) VALUES ('carry', ?, ?)
     ON CONFLICT (period_key) WHERE kind = 'carry' DO NOTHING`,
    [periodKey, amountPence],
  );
}

/** Moves money in (positive) or out (negative) by hand. Returns the new id. */
export async function addSavingsAdjustment(
  db: Db,
  amountPence: number,
  note: string,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO savings_entries (kind, period_key, amount_pence, note)
     VALUES ('adjustment', NULL, ?, ?)`,
    [amountPence, note.trim()],
  );
  return result.lastInsertRowId;
}

/** Removes one entry; a removed carry leaves its period open to close again. */
export async function removeSavingsEntry(db: Db, id: number): Promise<void> {
  await db.runAsync('DELETE FROM savings_entries WHERE id = ?', [id]);
}
