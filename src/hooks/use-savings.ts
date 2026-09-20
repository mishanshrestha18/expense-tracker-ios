/** The savings pot: what has rolled in, what was moved by hand, and the balance. */
import { addSavingsAdjustment, listSavingsEntries, removeSavingsEntry } from '@/db/savings';
import type { SavingsEntry } from '@/db/types';
import { type SavingsSummary, summariseSavings } from '@/domain/savings';

import { useDbMutation, useDbQuery } from './use-db-query';

export interface SavingsResult {
  entries: SavingsEntry[];
  summary: SavingsSummary;
  loaded: boolean;
  /** Signed: positive puts money in, negative takes it out. */
  adjust: (amountPence: number, note: string) => Promise<void>;
  remove: (id: number) => Promise<void>;
}

export function useSavings(): SavingsResult {
  const mutate = useDbMutation();
  const { data } = useDbQuery('savings', listSavingsEntries);
  const entries = data ?? [];

  return {
    entries,
    summary: summariseSavings(entries),
    loaded: data !== undefined,
    adjust: async (amountPence, note) => {
      await mutate((db) => addSavingsAdjustment(db, amountPence, note));
    },
    remove: async (id) => {
      await mutate((db) => removeSavingsEntry(db, id));
    },
  };
}
