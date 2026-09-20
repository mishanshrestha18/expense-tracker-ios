/**
 * Putting the expenses into iOS search. Everything here is a no-op away from
 * an iPhone, so the app behaves the same on web and in Expo Go.
 */
import { listForSpotlight, type SpotlightRow } from '@/db/spotlight';
import type { Db } from '@/db/types';
import { formatDate } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { indexInSpotlight, type SpotlightRecord } from '@/native/expenses-spotlight';

/** How many of the most recent expenses are searchable. */
export const SPOTLIGHT_LIMIT = 200;

/** One expense as a search result: what it was, what it cost, and when. */
export function spotlightRecord(row: SpotlightRow): SpotlightRecord {
  const note = row.note.trim();
  const words = note
    .toLowerCase()
    .split(/[^a-z0-9£.]+/i)
    .filter(Boolean);

  return {
    id: row.id,
    title: note || row.categoryName,
    detail: `${formatPence(row.amountPence)} · ${row.categoryName} · ${formatDate(row.spentOn)}`,
    keywords: [
      ...new Set([row.categoryName.toLowerCase(), ...words, row.paidWith].filter(Boolean)),
    ],
  };
}

/** Returns how many expenses were handed to Spotlight. */
export async function publishSpotlightIndex(db: Db, limit = SPOTLIGHT_LIMIT): Promise<number> {
  const rows = await listForSpotlight(db, limit);
  await indexInSpotlight(rows.map(spotlightRecord));
  return rows.length;
}
