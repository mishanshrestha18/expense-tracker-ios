/**
 * Search across every expense ever logged: free text, category, amount, how it
 * was paid and when.
 *
 * Nothing a person types is ever spliced into the SQL — the WHERE clause is
 * built from fixed fragments and `?` placeholders, and `%`, `_` and `\` in the
 * search text are escaped, so typing "50%" looks for those three characters
 * rather than matching every row.
 */
import type { ExpenseFilter } from '@/domain/search';

import type { Db, Expense, PaidWith, SqlValue } from './types';

/** Newest first, and no more than this many rows, however many matched. */
export const DEFAULT_SEARCH_LIMIT = 200;

/** Merchants to name in "you spend most at…". */
const DEFAULT_NOTE_LIMIT = 5;

/** SQLite gives LIKE no escape character unless one is named, so every LIKE names this one. */
const ESCAPE = '\\';

export interface SearchResult {
  expenses: Expense[];
  /** Total of EVERY match, not just the page of rows above. */
  totalPence: number;
  count: number;
}

export interface TopNote {
  note: string;
  totalPence: number;
  count: number;
}

interface ExpenseRow {
  id: number;
  amount_pence: number;
  category_id: number;
  note: string;
  spent_on: string;
  paid_with: string;
  created_at: string;
}

const COLUMNS =
  'e.id, e.amount_pence, e.category_id, e.note, e.spent_on, e.paid_with, e.created_at';

/** The category is joined in so the text can match its name; LEFT so a row is never lost. */
const FROM = 'FROM expenses e LEFT JOIN categories c ON c.id = e.category_id';

const toExpense = (row: ExpenseRow): Expense => ({
  id: row.id,
  amountPence: row.amount_pence,
  categoryId: row.category_id,
  note: row.note,
  spentOn: row.spent_on,
  paidWith: row.paid_with as PaidWith,
  createdAt: row.created_at,
});

export async function searchExpenses(
  db: Db,
  filter: ExpenseFilter,
  limit = DEFAULT_SEARCH_LIMIT,
): Promise<SearchResult> {
  const where = buildWhere(filter);

  // Two queries rather than one: the totals have to cover every match, while
  // the rows stop at the limit.
  const totals = await db.getFirstAsync<{ count: number; totalPence: number }>(
    `SELECT COUNT(*) AS count, COALESCE(SUM(e.amount_pence), 0) AS totalPence
     ${FROM}
     WHERE ${where.sql}`,
    where.params,
  );
  const rows = await db.getAllAsync<ExpenseRow>(
    `SELECT ${COLUMNS}
     ${FROM}
     WHERE ${where.sql}
     ORDER BY e.spent_on DESC, e.id DESC
     LIMIT ?`,
    [...where.params, limit],
  );

  return {
    expenses: rows.map(toExpense),
    totalPence: totals?.totalPence ?? 0,
    count: totals?.count ?? 0,
  };
}

/**
 * The merchants/notes seen most in the matches, biggest spend first. Notes are
 * grouped case-insensitively ("tesco" and "Tesco" are one shop) and blank ones
 * are left out, since "no note" is not a merchant.
 */
export async function searchTopNotes(
  db: Db,
  filter: ExpenseFilter,
  limit = DEFAULT_NOTE_LIMIT,
): Promise<TopNote[]> {
  const where = buildWhere(filter);
  return db.getAllAsync<TopNote>(
    `SELECT MIN(e.note) AS note, SUM(e.amount_pence) AS totalPence, COUNT(*) AS count
     ${FROM}
     WHERE ${where.sql} AND e.note <> ''
     GROUP BY e.note COLLATE NOCASE
     ORDER BY totalPence DESC, count DESC, note
     LIMIT ?`,
    [...where.params, limit],
  );
}

interface Where {
  /** Only fixed fragments and `?` placeholders — never a value. */
  sql: string;
  params: SqlValue[];
}

function buildWhere(filter: ExpenseFilter): Where {
  const clauses: string[] = [];
  const params: SqlValue[] = [];

  const text = filter.text.trim();
  if (text !== '') {
    clauses.push(`(e.note LIKE ? ESCAPE '${ESCAPE}' OR c.name LIKE ? ESCAPE '${ESCAPE}')`);
    params.push(contains(text), contains(text));
  }
  if (filter.categoryIds.length > 0) {
    // The placeholders are counted from the ids; the ids themselves are bound.
    clauses.push(`e.category_id IN (${filter.categoryIds.map(() => '?').join(', ')})`);
    params.push(...filter.categoryIds);
  }
  if (filter.paidWith !== null) {
    clauses.push('e.paid_with = ?');
    params.push(filter.paidWith);
  }
  if (filter.minPence !== null) {
    clauses.push('e.amount_pence >= ?');
    params.push(filter.minPence);
  }
  if (filter.maxPence !== null) {
    clauses.push('e.amount_pence <= ?');
    params.push(filter.maxPence);
  }
  if (filter.from !== null) {
    clauses.push('e.spent_on >= ?');
    params.push(filter.from);
  }
  if (filter.to !== null) {
    clauses.push('e.spent_on <= ?');
    params.push(filter.to);
  }

  return { sql: clauses.length === 0 ? '1 = 1' : clauses.join(' AND '), params };
}

/** A LIKE pattern matching `text` anywhere, with its wildcards taken literally. */
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (character) => ESCAPE + character)}%`;
}
