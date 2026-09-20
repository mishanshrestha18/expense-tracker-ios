/**
 * Commitments for the period on screen: what is due, what has been paid, and
 * what is overdue. The maths lives in `src/domain/commitments.ts`; this joins
 * it to the database and the selected period.
 */
import {
  listCommitments,
  listSettlements,
  settleCommitment,
  unsettleCommitment,
} from '@/db/commitments';
import type { Commitment } from '@/db/types';
import {
  type CommittedTotals,
  committedTotals,
  type Occurrence,
  occurrencesIn,
} from '@/domain/commitments';
import type { IsoDate } from '@/domain/dates';
import type { Period } from '@/domain/period';

import { useDbMutation, useDbQuery } from './use-db-query';

export interface PeriodCommitments {
  commitments: Commitment[];
  /** Every occurrence inside the period, oldest first. */
  occurrences: Occurrence[];
  overdue: Occurrence[];
  totals: CommittedTotals;
  markPaid: (commitmentId: number, dueOn: IsoDate, expenseId?: number) => Promise<void>;
  skip: (commitmentId: number, dueOn: IsoDate) => Promise<void>;
  undo: (commitmentId: number, dueOn: IsoDate) => Promise<void>;
}

export function useCommitments() {
  return useDbQuery('commitments', listCommitments);
}

export function usePeriodCommitments(period: Period): PeriodCommitments {
  const mutate = useDbMutation();
  const commitments = useCommitments().data ?? [];
  const settlements =
    useDbQuery(`settlements:${period.start}:${period.end}`, (db) =>
      listSettlements(db, period.start, period.end),
    ).data ?? [];

  const occurrences = occurrencesIn(commitments, settlements, period);
  const totals = committedTotals(commitments, occurrences);

  return {
    commitments,
    occurrences,
    overdue: occurrences.filter((o) => o.status === 'overdue'),
    totals,
    markPaid: async (commitmentId, dueOn, expenseId) => {
      await mutate((db) =>
        settleCommitment(db, {
          commitmentId,
          dueOn,
          status: 'paid',
          expenseId: expenseId ?? null,
        }),
      );
    },
    skip: async (commitmentId, dueOn) => {
      await mutate((db) =>
        settleCommitment(db, { commitmentId, dueOn, status: 'skipped', expenseId: null }),
      );
    },
    undo: async (commitmentId, dueOn) => {
      await mutate((db) => unsettleCommitment(db, commitmentId, dueOn));
    },
  };
}
