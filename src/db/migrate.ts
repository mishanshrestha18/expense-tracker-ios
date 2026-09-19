import { MIGRATIONS } from './schema';
import type { Db } from './types';

/** Brings the database schema up to date. Safe to call on every launch. */
export async function migrate(db: Db): Promise<void> {
  // WAL keeps reads fast while writing; must be set outside a transaction.
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
