/**
 * Reading the whole database into a backup file, and putting one back.
 *
 * Nothing here names a table: the list comes from `sqlite_master` and the
 * columns from `PRAGMA table_info`, so a migration added next year is backed
 * up and restored without anyone remembering to change this file.
 */
import { BACKUP_FORMAT, type BackupFile } from '@/domain/backup';

import type { Db, SqlValue } from './types';

type Row = Record<string, SqlValue>;

const FROM_A_NEWER_APP =
  'That backup was made by a newer version of Expenses. Update the app, then try again.';

/** Every table the app owns, parents before children. */
export async function dumpDatabase(db: Db): Promise<BackupFile> {
  const tables = await tablesParentsFirst(db);
  const dumped: Record<string, Row[]> = {};
  for (const table of tables) {
    dumped[table] = await db.getAllAsync<Row>(`SELECT * FROM ${quote(table)}`, []);
  }

  return {
    app: 'expenses',
    format: BACKUP_FORMAT,
    schemaVersion: await schemaVersion(db),
    exportedAt: new Date().toISOString(),
    tables: dumped,
  };
}

/**
 * Replaces everything with the backup, in one transaction: either the whole
 * file lands or the database is left exactly as it was.
 *
 * A backup from a newer schema is refused, because this app has no idea what
 * the extra columns meant. An older one is welcome: tables and columns the app
 * no longer has are skipped, and a column the backup never had keeps whatever
 * the migration made its default.
 */
export async function restoreDatabase(db: Db, backup: BackupFile): Promise<void> {
  if (backup.schemaVersion > (await schemaVersion(db))) throw new Error(FROM_A_NEWER_APP);

  const tables = await tablesParentsFirst(db);
  const columns = new Map<string, Set<string>>();
  for (const table of tables) columns.set(table, await columnNames(db, table));

  try {
    await db.withTransactionAsync(async () => {
      // Children first, so a row is never deleted while something points at it.
      for (const table of [...tables].reverse()) await db.execAsync(`DELETE FROM ${quote(table)}`);

      for (const table of tables) {
        const known = columns.get(table) ?? new Set<string>();
        for (const row of backup.tables[table] ?? []) {
          const fields = Object.keys(row).filter((column) => known.has(column));
          if (fields.length === 0) continue;
          await db.runAsync(
            `INSERT INTO ${quote(table)} (${fields.map(quote).join(', ')})
             VALUES (${fields.map(() => '?').join(', ')})`,
            fields.map((field) => row[field]),
          );
        }
      }
    });
  } catch (error) {
    // The transaction rolled back, so the app is as it was. SQLite's own
    // complaint is kept as the cause for the logs, never for the person.
    throw new Error('Some of that backup could not be put back.', { cause: error });
  }
}

async function schemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return row?.user_version ?? 0;
}

/**
 * The app's tables ordered so every table comes after the ones its foreign
 * keys point at — categories before expenses, commitments before their amounts
 * and settlements. Inserting in this order never trips a foreign key, and
 * deleting in reverse never leaves an orphan.
 */
async function tablesParentsFirst(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master
     WHERE type = 'table' AND substr(name, 1, 7) <> 'sqlite_'
     ORDER BY name`,
    [],
  );
  const names = rows.map((row) => row.name);
  const known = new Set(names);

  const parents = new Map<string, string[]>();
  for (const name of names) {
    const keys = await db.getAllAsync<{ table: string }>(
      `PRAGMA foreign_key_list(${quote(name)})`,
      [],
    );
    // A table pointing at itself has to be ordered row by row, which no table
    // here needs; leaving the edge out keeps the sort from stalling on it.
    parents.set(
      name,
      keys.map((key) => key.table).filter((parent) => parent !== name && known.has(parent)),
    );
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  const visit = (name: string) => {
    if (seen.has(name)) return;
    // Marked before the parents are walked, so a cycle stops instead of
    // recursing forever: the loop is broken at whichever edge is met last.
    seen.add(name);
    for (const parent of parents.get(name) ?? []) visit(parent);
    ordered.push(name);
  };
  for (const name of names) visit(name);
  return ordered;
}

async function columnNames(db: Db, table: string): Promise<Set<string>> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${quote(table)})`, []);
  return new Set(rows.map((row) => row.name));
}

/** Identifiers cannot be bound as parameters, so they are quoted instead. */
function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}
