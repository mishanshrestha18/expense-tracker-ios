/**
 * The shape of a backup file and the plain words that go around it. Pure:
 * reading the database is `src/db/backup.ts`, and writing the file to disk is
 * the Settings screen's job.
 *
 * A backup is every table of the database as it stood, so restoring one on a
 * new phone gives back the same app rather than an approximation of it.
 */
import type { SqlValue } from '@/db/types';

import { formatDate, toIsoDate } from './dates';

/**
 * The layout of the file itself, which is not the database schema version.
 * Bump it only when an older app could no longer read a new file; adding a
 * table is a schema change, and `schemaVersion` already covers that.
 */
export const BACKUP_FORMAT = 1;

export interface BackupFile {
  app: 'expenses';
  format: number;
  /** `PRAGMA user_version` when the backup was taken. */
  schemaVersion: number;
  /** ISO 8601 instant, e.g. `2026-09-20T18:04:11.000Z`. */
  exportedAt: string;
  /** Table name to its rows, straight out of SQLite. */
  tables: Record<string, Record<string, SqlValue>[]>;
}

/** Every message here is shown to a person, so none of them mention JSON. */
const NOT_A_BACKUP = 'That file is not an Expenses backup.';
const FROM_A_NEWER_APP =
  'That backup was made by a newer version of Expenses. Update the app, then try again.';

/** Indented, because a backup is a file a person can open and read. */
export function serialiseBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Reads a file a person chose. Throws an `Error` whose message can go straight
 * into an alert, so nothing has to guess at what went wrong further up.
 */
export function parseBackup(text: string): BackupFile {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(NOT_A_BACKUP);
  }

  if (!isRecord(value) || value.app !== 'expenses') throw new Error(NOT_A_BACKUP);

  const { format, schemaVersion, exportedAt } = value;
  if (!isWholeNumber(format) || format < 1) throw new Error(NOT_A_BACKUP);
  if (format > BACKUP_FORMAT) throw new Error(FROM_A_NEWER_APP);
  if (!isWholeNumber(schemaVersion) || schemaVersion < 0) throw new Error(NOT_A_BACKUP);
  if (typeof exportedAt !== 'string') throw new Error(NOT_A_BACKUP);

  return { app: 'expenses', format, schemaVersion, exportedAt, tables: parseTables(value.tables) };
}

/** The things a person would recognise, in the order they would name them. */
const CONTENTS: readonly { tables: readonly string[]; one: string; many: string }[] = [
  { tables: ['expenses'], one: 'expense', many: 'expenses' },
  { tables: ['commitments'], one: 'bill', many: 'bills' },
  { tables: ['budgets', 'overall_budget'], one: 'budget', many: 'budgets' },
  { tables: ['savings_entries'], one: 'savings entry', many: 'savings entries' },
];

/** `"42 expenses, 3 bills and a budget, saved 19 Sept 2026"` */
export function describeBackup(backup: BackupFile): string {
  const parts = CONTENTS.map(({ tables, one, many }) => {
    const count = tables.reduce((total, table) => total + (backup.tables[table]?.length ?? 0), 0);
    if (count === 0) return null;
    return count === 1 ? `${article(one)} ${one}` : `${count} ${many}`;
  }).filter((part): part is string => part !== null);

  const contents = parts.length === 0 ? 'nothing yet' : joinWithAnd(parts);
  const taken = localDate(backup.exportedAt);
  return taken === null ? contents : `${contents}, saved ${formatDate(taken)}`;
}

/** `expenses-backup-2026-09-20.json`, dated in the phone's own time zone. */
export function backupFileName(exportedAt: string): string {
  const taken = localDate(exportedAt);
  return taken === null ? 'expenses-backup.json' : `expenses-backup-${taken}.json`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWholeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function parseTables(value: unknown): Record<string, Record<string, SqlValue>[]> {
  if (!isRecord(value)) throw new Error(NOT_A_BACKUP);
  return Object.fromEntries(
    Object.entries(value).map(([table, rows]) => {
      if (!Array.isArray(rows)) throw new Error(NOT_A_BACKUP);
      return [table, rows.map(parseRow)];
    }),
  );
}

/** A row is flat: one level of columns holding what SQLite can store. */
function parseRow(row: unknown): Record<string, SqlValue> {
  if (!isRecord(row)) throw new Error(NOT_A_BACKUP);
  return Object.fromEntries(
    Object.entries(row).map(([column, cell]) => {
      if (cell !== null && typeof cell !== 'string' && typeof cell !== 'number') {
        throw new Error(NOT_A_BACKUP);
      }
      return [column, cell];
    }),
  );
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** `["a", "b", "c"]` → `"a, b and c"` */
function joinWithAnd(parts: readonly string[]): string {
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** The calendar day an instant fell on here, or `null` if it is not a date. */
function localDate(exportedAt: string): string | null {
  const date = new Date(exportedAt);
  return Number.isNaN(date.getTime()) ? null : toIsoDate(date);
}
