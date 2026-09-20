import { describe, expect, it } from '@jest/globals';

import {
  BACKUP_FORMAT,
  type BackupFile,
  backupFileName,
  describeBackup,
  parseBackup,
  serialiseBackup,
} from '../backup';

/** Midday here on 19 September 2026, so the day is the same in any time zone. */
const EXPORTED_AT = new Date(2026, 8, 19, 12, 0).toISOString();

const backup = (
  tables: BackupFile['tables'] = {},
  overrides: Partial<BackupFile> = {},
): BackupFile => ({
  app: 'expenses',
  format: BACKUP_FORMAT,
  schemaVersion: 8,
  exportedAt: EXPORTED_AT,
  tables,
  ...overrides,
});

/** `count` rows, enough for anything that only counts them. */
const rows = (count: number): Record<string, never>[] => Array.from({ length: count }, () => ({}));

/** A backup written by hand, the way a mangled file would arrive. */
const file = (value: unknown): string => JSON.stringify(value);

describe('serialiseBackup and parseBackup', () => {
  it('gives back exactly what it was handed', () => {
    const original = backup({
      categories: [{ id: 1, name: 'Groceries', aliases: 'tesco,aldi', sort_order: 0 }],
      expenses: [
        { id: 1, amount_pence: 1250, category_id: 1, note: 'Lunch', spent_on: '2026-09-19' },
        { id: 2, amount_pence: 7, category_id: 1, note: '', spent_on: '2026-09-20' },
      ],
      commitments: [{ id: 1, name: 'Rent', ended_on: null }],
    });

    expect(parseBackup(serialiseBackup(original))).toEqual(original);
  });

  it('keeps a note with quotes, commas and line breaks intact', () => {
    const original = backup({
      expenses: [{ id: 1, note: 'Coffee, cake and a "treat"\nwith Sam' }],
    });

    expect(parseBackup(serialiseBackup(original)).tables.expenses[0].note).toBe(
      'Coffee, cake and a "treat"\nwith Sam',
    );
  });

  it('rejects a file that is not JSON at all', () => {
    expect(() => parseBackup('Date,Amount\n2026-09-19,12.50')).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup('')).toThrow('That file is not an Expenses backup.');
  });

  it('rejects JSON that is not a backup', () => {
    expect(() => parseBackup(file({ hello: 'world' }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup(file([1, 2, 3]))).toThrow('That file is not an Expenses backup.');
    expect(() => parseBackup(file(null))).toThrow('That file is not an Expenses backup.');
  });

  it('rejects a backup belonging to another app', () => {
    const other = { ...backup(), app: 'notes' };
    expect(() => parseBackup(file(other))).toThrow('That file is not an Expenses backup.');
  });

  it('rejects a backup written by a newer version of the app', () => {
    const newer = file(backup({}, { format: BACKUP_FORMAT + 1 }));
    expect(() => parseBackup(newer)).toThrow(/newer version of Expenses/);
    // Not the same complaint: the file is fine, the app is behind.
    expect(() => parseBackup(newer)).not.toThrow('That file is not an Expenses backup.');
  });

  it('rejects a backup whose format or schema version is missing or nonsense', () => {
    expect(() => parseBackup(file({ ...backup(), format: '1' }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup(file({ ...backup(), format: 0 }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup(file({ ...backup(), schemaVersion: undefined }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup(file({ ...backup(), exportedAt: 1758283200000 }))).toThrow(
      'That file is not an Expenses backup.',
    );
  });

  it('rejects tables that do not hold rows of plain values', () => {
    expect(() => parseBackup(file({ ...backup(), tables: 'everything' }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() => parseBackup(file({ ...backup(), tables: { expenses: 42 } }))).toThrow(
      'That file is not an Expenses backup.',
    );
    expect(() =>
      parseBackup(file({ ...backup(), tables: { expenses: [{ note: { deep: true } }] } })),
    ).toThrow('That file is not an Expenses backup.');
  });

  it('accepts an older backup, tables and all', () => {
    const older = file(backup({ expenses: [{ id: 1 }] }, { schemaVersion: 3 }));
    expect(parseBackup(older).schemaVersion).toBe(3);
    expect(parseBackup(older).tables.expenses).toHaveLength(1);
  });
});

describe('describeBackup', () => {
  it('counts what a person would recognise, in a sentence', () => {
    const summary = describeBackup(
      backup({ expenses: rows(42), commitments: rows(3), budgets: rows(1) }),
    );
    expect(summary).toBe('42 expenses, 3 bills and a budget, saved 19 Sept 2026');
  });

  it('says "a" rather than "1" when there is one of something', () => {
    const summary = describeBackup(
      backup({ expenses: rows(1), commitments: rows(1), budgets: rows(1) }),
    );
    expect(summary).toBe('an expense, a bill and a budget, saved 19 Sept 2026');
  });

  it('leaves out anything there is none of', () => {
    expect(describeBackup(backup({ expenses: rows(42), commitments: [] }))).toBe(
      '42 expenses, saved 19 Sept 2026',
    );
  });

  it('says so plainly when the backup holds nothing yet', () => {
    expect(describeBackup(backup())).toBe('nothing yet, saved 19 Sept 2026');
    expect(describeBackup(backup({ categories: rows(8), expenses: [] }))).toBe(
      'nothing yet, saved 19 Sept 2026',
    );
  });

  it('counts the overall budget alongside the category ones', () => {
    expect(describeBackup(backup({ budgets: rows(2), overall_budget: rows(1) }))).toBe(
      '3 budgets, saved 19 Sept 2026',
    );
  });

  it('pluralises savings entries the awkward way round', () => {
    expect(describeBackup(backup({ savings_entries: rows(1) }))).toBe(
      'a savings entry, saved 19 Sept 2026',
    );
    expect(describeBackup(backup({ savings_entries: rows(4) }))).toBe(
      '4 savings entries, saved 19 Sept 2026',
    );
  });

  it('still says what is in a backup with an unreadable date on it', () => {
    expect(describeBackup(backup({ expenses: rows(2) }, { exportedAt: 'whenever' }))).toBe(
      '2 expenses',
    );
  });
});

describe('backupFileName', () => {
  it('names the file after the day the backup was taken', () => {
    expect(backupFileName(new Date(2026, 8, 20, 12, 0).toISOString())).toBe(
      'expenses-backup-2026-09-20.json',
    );
  });

  it('uses the local day rather than the UTC one', () => {
    expect(backupFileName(new Date(2026, 0, 1, 23, 30).toISOString())).toBe(
      'expenses-backup-2026-01-01.json',
    );
  });

  it('falls back to a plain name when the date makes no sense', () => {
    expect(backupFileName('whenever')).toBe('expenses-backup.json');
  });
});
