import type { IsoDate } from '@/domain/dates';

export type SqlValue = string | number | null;

/**
 * The subset of `expo-sqlite`'s `SQLiteDatabase` the app relies on.
 * Repositories depend on this interface rather than the concrete class so
 * they can run against an in-memory SQLite (sql.js) in unit tests.
 */
export interface Db {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params: SqlValue[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getFirstAsync<T>(source: string, params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, params: SqlValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface Category {
  id: number;
  name: string;
  /** Key into the category icon map (see `components/category-icon`). */
  icon: string;
  color: string;
  aliases: string[];
  sortOrder: number;
}

export interface Expense {
  id: number;
  amountPence: number;
  categoryId: number;
  note: string;
  spentOn: IsoDate;
  createdAt: string;
}

export type ExpenseInput = Pick<Expense, 'amountPence' | 'categoryId' | 'note' | 'spentOn'>;

export interface Budget {
  categoryId: number;
  monthlyLimitPence: number;
}
