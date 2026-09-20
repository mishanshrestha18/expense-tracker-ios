/** What iOS search needs to know about an expense: enough to recognise it. */
import type { IsoDate } from '@/domain/dates';

import type { Db, PaidWith } from './types';

export interface SpotlightRow {
  id: number;
  amountPence: number;
  note: string;
  spentOn: IsoDate;
  paidWith: PaidWith;
  categoryName: string;
}

interface Row {
  id: number;
  amount_pence: number;
  note: string;
  spent_on: string;
  paid_with: string;
  category_name: string;
}

/** The most recent expenses, newest first — what a search is most likely about. */
export async function listForSpotlight(db: Db, limit = 200): Promise<SpotlightRow[]> {
  const rows = await db.getAllAsync<Row>(
    `SELECT e.id, e.amount_pence, e.note, e.spent_on, e.paid_with, c.name AS category_name
     FROM expenses e
     JOIN categories c ON c.id = e.category_id
     ORDER BY e.spent_on DESC, e.id DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map((row) => ({
    id: row.id,
    amountPence: row.amount_pence,
    note: row.note,
    spentOn: row.spent_on,
    paidWith: row.paid_with as PaidWith,
    categoryName: row.category_name,
  }));
}
