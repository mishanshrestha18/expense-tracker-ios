/**
 * An in-memory SQLite database for Jest, backed by sql.js (SQLite compiled to
 * WebAssembly). It implements the same `Db` interface as expo-sqlite, so the
 * real repositories and migrations run against a real SQL engine in tests.
 */
import initSqlJs from 'sql.js';

import { migrate } from '@/db/migrate';
import type { Db, SqlValue } from '@/db/types';

export async function createTestDb({ migrated = true } = {}): Promise<Db & { close(): void }> {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();

  const all = <T>(source: string, params: SqlValue[]): T[] => {
    const statement = raw.prepare(source);
    try {
      statement.bind(params);
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } finally {
      statement.free();
    }
  };

  const db: Db & { close(): void } = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params) {
      raw.run(source, params);
      const changes = raw.getRowsModified();
      const [row] = all<{ id: number }>('SELECT last_insert_rowid() AS id', []);
      return { lastInsertRowId: row.id, changes };
    },
    async getFirstAsync<T>(source: string, params: SqlValue[]) {
      return all<T>(source, params)[0] ?? null;
    },
    async getAllAsync<T>(source: string, params: SqlValue[]) {
      return all<T>(source, params);
    },
    async withTransactionAsync(task) {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
    close() {
      raw.close();
    },
  };

  if (migrated) await migrate(db);
  return db;
}
