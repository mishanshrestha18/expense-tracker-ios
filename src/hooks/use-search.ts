/**
 * The search screen's state: the filter as it is being typed, the same filter
 * with the text settled, and what the database says matches it.
 */
import { useEffect, useState } from 'react';

import { searchExpenses, searchTopNotes, type SearchResult, type TopNote } from '@/db/search';
import { EMPTY_FILTER, type ExpenseFilter, isEmptyFilter } from '@/domain/search';

import { useDbQuery } from './use-db-query';

/** Long enough that typing "tesco" is one query, short enough to feel live. */
export const SEARCH_DEBOUNCE_MS = 250;

const NO_MATCHES: SearchResult = { expenses: [], totalPence: 0, count: 0 };
const NO_NOTES: TopNote[] = [];

export interface SearchState {
  /** The filter as typed, which is what the controls show. */
  filter: ExpenseFilter;
  setFilter: (filter: ExpenseFilter) => void;
  clear: () => void;
  /** True while nothing has been asked for yet, so the screen can prompt instead. */
  isEmpty: boolean;
  result: SearchResult;
  /** Where the matched money went, biggest first. */
  topNotes: TopNote[];
  loaded: boolean;
}

export function useSearch(): SearchState {
  const [filter, setFilter] = useState<ExpenseFilter>(EMPTY_FILTER);
  const [searchText, setSearchText] = useState(EMPTY_FILTER.text);

  // Every other control changes the filter in one go, so only the text field
  // waits: one query for a typed word rather than one per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setSearchText(filter.text), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filter.text]);

  const applied: ExpenseFilter = { ...filter, text: searchText };
  const blank = isEmptyFilter(applied);
  const key = filterKey(applied);

  const result = useDbQuery(`search:${key}`, (db) =>
    blank ? Promise.resolve(NO_MATCHES) : searchExpenses(db, applied),
  );
  const notes = useDbQuery(`search-notes:${key}`, (db) =>
    blank ? Promise.resolve(NO_NOTES) : searchTopNotes(db, applied),
  );

  return {
    filter,
    setFilter,
    clear: () => setFilter(EMPTY_FILTER),
    isEmpty: blank,
    result: result.data ?? NO_MATCHES,
    topNotes: notes.data ?? NO_NOTES,
    loaded: result.data !== undefined,
  };
}

/** A stable key for one filter, so the query runs again exactly when it changes. */
function filterKey(filter: ExpenseFilter): string {
  return JSON.stringify([
    filter.text.trim().toLowerCase(),
    filter.categoryIds,
    filter.paidWith,
    filter.minPence,
    filter.maxPence,
    filter.from,
    filter.to,
  ]);
}
