/** Recurring series the person has dismissed, so they stay dismissed. */
import type { Db } from './types';

export async function listIgnoredRecurring(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ key: string }>('SELECT key FROM recurring_ignored', []);
  return rows.map((row) => row.key);
}

export async function ignoreRecurring(db: Db, key: string): Promise<void> {
  await db.runAsync('INSERT OR IGNORE INTO recurring_ignored (key) VALUES (?)', [key]);
}

export async function unignoreRecurring(db: Db, key: string): Promise<void> {
  await db.runAsync('DELETE FROM recurring_ignored WHERE key = ?', [key]);
}
