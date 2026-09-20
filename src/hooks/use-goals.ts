/** The goals the savings balance is being kept for, and the writes that change them. */
import { addGoal, deleteGoal, listGoals, reorderGoals, updateGoal } from '@/db/goals';
import type { SavingsGoal, SavingsGoalInput } from '@/db/types';

import { useDbMutation, useDbQuery } from './use-db-query';

export interface GoalsResult {
  /** In the order they are filled from the balance. */
  goals: SavingsGoal[];
  loaded: boolean;
  /** Adds a goal at the end of the queue; returns its new id. */
  add: (input: SavingsGoalInput) => Promise<number>;
  update: (id: number, input: SavingsGoalInput) => Promise<void>;
  remove: (id: number) => Promise<void>;
  reorder: (idsInOrder: readonly number[]) => Promise<void>;
}

export function useGoals(): GoalsResult {
  const mutate = useDbMutation();
  const { data } = useDbQuery('goals', listGoals);

  return {
    goals: data ?? [],
    loaded: data !== undefined,
    add: (input) => mutate((db) => addGoal(db, input)),
    update: (id, input) => mutate((db) => updateGoal(db, id, input)),
    remove: (id) => mutate((db) => deleteGoal(db, id)),
    reorder: (idsInOrder) => mutate((db) => reorderGoals(db, idsInOrder)),
  };
}
