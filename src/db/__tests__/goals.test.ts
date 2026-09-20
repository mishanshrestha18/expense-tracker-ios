import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { createTestDb } from '@/test-utils/sqljs-db';

import { addGoal, deleteGoal, getGoal, listGoals, reorderGoals, updateGoal } from '../goals';
import type { Db, SavingsGoalInput } from '../types';

let db: Db & { close(): void };

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(() => {
  db.close();
});

const input = (overrides: Partial<SavingsGoalInput> = {}): SavingsGoalInput => ({
  name: 'Japan',
  targetPence: 200000,
  targetDate: '2027-08-01',
  note: '',
  ...overrides,
});

describe('savings goals', () => {
  it('starts with nothing to save for', async () => {
    expect(await listGoals(db)).toEqual([]);
  });

  it('adds goals at the end of the queue', async () => {
    const japan = await addGoal(db, input());
    const laptop = await addGoal(db, input({ name: 'Laptop', targetPence: 120000 }));
    const rainy = await addGoal(db, input({ name: 'Rainy day', targetDate: null }));

    const goals = await listGoals(db);
    expect(goals.map((goal) => goal.id)).toEqual([japan, laptop, rainy]);
    expect(goals.map((goal) => goal.sortOrder)).toEqual([0, 1, 2]);
  });

  it('keeps everything the goal was given', async () => {
    const id = await addGoal(db, input({ name: '  Japan  ', note: '  Two weeks  ' }));

    expect(await getGoal(db, id)).toMatchObject({
      id,
      name: 'Japan',
      targetPence: 200000,
      targetDate: '2027-08-01',
      note: 'Two weeks',
      sortOrder: 0,
    });
  });

  it('has no goal to find once it is deleted', async () => {
    const id = await addGoal(db, input());
    await deleteGoal(db, id);

    expect(await getGoal(db, id)).toBeNull();
    expect(await listGoals(db)).toEqual([]);
  });

  it('edits a goal without moving it in the queue', async () => {
    await addGoal(db, input());
    const laptop = await addGoal(db, input({ name: 'Laptop', targetPence: 120000 }));

    await updateGoal(
      db,
      laptop,
      input({ name: 'Laptop', targetPence: 150000, targetDate: null, note: 'The 16 inch one' }),
    );

    expect(await getGoal(db, laptop)).toMatchObject({
      name: 'Laptop',
      targetPence: 150000,
      targetDate: null,
      note: 'The 16 inch one',
      sortOrder: 1,
    });
    expect((await listGoals(db)).map((goal) => goal.name)).toEqual(['Japan', 'Laptop']);
  });

  it('reorders the queue, because the first goal is filled first', async () => {
    const japan = await addGoal(db, input());
    const laptop = await addGoal(db, input({ name: 'Laptop' }));
    const rainy = await addGoal(db, input({ name: 'Rainy day' }));

    await reorderGoals(db, [rainy, japan, laptop]);

    const goals = await listGoals(db);
    expect(goals.map((goal) => goal.name)).toEqual(['Rainy day', 'Japan', 'Laptop']);
    expect(goals.map((goal) => goal.sortOrder)).toEqual([0, 1, 2]);
  });

  it('adds behind the goals already queued after a reorder', async () => {
    const japan = await addGoal(db, input());
    const laptop = await addGoal(db, input({ name: 'Laptop' }));
    await reorderGoals(db, [laptop, japan]);

    await addGoal(db, input({ name: 'Rainy day' }));

    expect((await listGoals(db)).map((goal) => goal.name)).toEqual([
      'Laptop',
      'Japan',
      'Rainy day',
    ]);
  });

  it('falls back to the id when two goals share a place', async () => {
    const japan = await addGoal(db, input());
    const laptop = await addGoal(db, input({ name: 'Laptop' }));
    await reorderGoals(db, [japan, laptop]);
    await db.runAsync('UPDATE savings_goals SET sort_order = 0', []);

    expect((await listGoals(db)).map((goal) => goal.id)).toEqual([japan, laptop]);
  });
});
