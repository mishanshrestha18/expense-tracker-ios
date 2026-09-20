import { describe, expect, it } from '@jest/globals';

import type { SavingsEntry, SavingsEntryKind, SavingsGoal } from '@/db/types';

import type { IsoDate, MonthKey } from '../dates';
import { allocateGoals, averageCarryPence, reordered } from '../goals';

/** 19 September 2026: the day every test pretends it is. */
const TODAY = new Date(2026, 8, 19);

let nextId = 0;

const goal = (
  name: string,
  targetPence: number,
  targetDate: IsoDate | null = null,
): SavingsGoal => ({
  id: (nextId += 1),
  name,
  targetPence,
  targetDate,
  note: '',
  sortOrder: nextId,
  createdAt: '2026-09-01T12:00:00.000Z',
});

const entry = (
  kind: SavingsEntryKind,
  amountPence: number,
  periodKey: MonthKey | null = null,
): SavingsEntry => ({
  id: (nextId += 1),
  kind,
  periodKey,
  amountPence,
  note: '',
  createdAt: '2026-09-19T12:00:00.000Z',
});

describe('allocateGoals', () => {
  it('fills the goals in order and stops where the balance runs out', () => {
    const goals = [goal('Japan', 200000), goal('Laptop', 120000), goal('Rainy day', 50000)];

    const [japan, laptop, rainy] = allocateGoals(goals, 250000, null, TODAY);

    expect(japan).toMatchObject({
      allocatedPence: 200000,
      remainingPence: 0,
      ratio: 1,
      done: true,
    });
    expect(laptop).toMatchObject({ allocatedPence: 50000, remainingPence: 70000, done: false });
    expect(laptop.ratio).toBeCloseTo(50000 / 120000);
    expect(rainy).toMatchObject({
      allocatedPence: 0,
      remainingPence: 50000,
      ratio: 0,
      done: false,
    });
  });

  it('saves every goal when the balance covers them all', () => {
    const progress = allocateGoals(
      [goal('Japan', 200000), goal('Laptop', 120000)],
      500000,
      50000,
      TODAY,
    );

    expect(progress.map((p) => p.done)).toEqual([true, true]);
    expect(progress.map((p) => p.remainingPence)).toEqual([0, 0]);
    expect(progress.map((p) => p.periodsAway)).toEqual([0, 0]);
    expect(progress.map((p) => p.etaLabel)).toEqual([null, null]);
    expect(progress.every((p) => p.behind)).toBe(false);
  });

  it('allocates nothing from a balance in the red', () => {
    const progress = allocateGoals(
      [goal('Japan', 200000), goal('Laptop', 120000)],
      -7500,
      50000,
      TODAY,
    );

    expect(progress.map((p) => p.allocatedPence)).toEqual([0, 0]);
    expect(progress.map((p) => p.remainingPence)).toEqual([200000, 120000]);
    expect(progress.map((p) => p.ratio)).toEqual([0, 0]);
  });

  it('has nothing to share out without goals', () => {
    expect(allocateGoals([], 250000, 50000, TODAY)).toEqual([]);
  });

  it('counts whole periods, so one period short lands next month', () => {
    const [japan] = allocateGoals([goal('Japan', 200000)], 150000, 50000, TODAY);

    expect(japan.periodsAway).toBe(1);
    expect(japan.etaLabel).toBe('October 2026');
  });

  it('rounds a part period up', () => {
    const [japan] = allocateGoals([goal('Japan', 200000)], 149999, 50000, TODAY);

    expect(japan.remainingPence).toBe(50001);
    expect(japan.periodsAway).toBe(2);
    expect(japan.etaLabel).toBe('November 2026');
  });

  it('has no ETA without a rate to count forward with', () => {
    for (const rate of [null, 0, -50000]) {
      const [japan] = allocateGoals([goal('Japan', 200000)], 150000, rate, TODAY);
      expect(japan.periodsAway).toBeNull();
      expect(japan.etaLabel).toBeNull();
      expect(japan.behind).toBe(false);
    }
  });

  it('is behind when the money lands after the date it is wanted for', () => {
    const [japan] = allocateGoals([goal('Japan', 200000, '2026-12-01')], 0, 50000, TODAY);

    expect(japan.periodsAway).toBe(4);
    expect(japan.etaLabel).toBe('January 2027');
    expect(japan.behind).toBe(true);
  });

  it('is not behind when it lands in the month it is wanted for', () => {
    const [japan] = allocateGoals([goal('Japan', 200000, '2027-01-20')], 0, 50000, TODAY);

    expect(japan.etaLabel).toBe('January 2027');
    expect(japan.behind).toBe(false);
  });

  it('is not behind once it is saved, whatever the date said', () => {
    const [japan] = allocateGoals([goal('Japan', 200000, '2026-01-01')], 200000, 50000, TODAY);

    expect(japan.done).toBe(true);
    expect(japan.behind).toBe(false);
  });
});

describe('averageCarryPence', () => {
  it('averages the newest periods and ignores money moved by hand', () => {
    const entries = [
      entry('adjustment', 20000),
      entry('carry', 10000, '2026-09'),
      entry('carry', 12000, '2026-06'),
      entry('adjustment', -5000),
      entry('carry', -4500, '2026-07'),
      entry('carry', 8000, '2026-08'),
    ];

    expect(averageCarryPence(entries, 3)).toBe(4500);
  });

  it('averages what there is when fewer periods have closed', () => {
    const entries = [entry('carry', 10000, '2026-09'), entry('carry', 5000, '2026-08')];

    expect(averageCarryPence(entries, 3)).toBe(7500);
  });

  it('has no rate before a period has been closed', () => {
    expect(averageCarryPence([])).toBeNull();
    expect(averageCarryPence([entry('adjustment', 20000)])).toBeNull();
  });

  it('lets an overspent period drag the rate down', () => {
    const entries = [entry('carry', 9000, '2026-09'), entry('carry', -3000, '2026-08')];

    expect(averageCarryPence(entries, 2)).toBe(3000);
  });
});

describe('reordered', () => {
  const ids = [7, 8, 9];

  it('moves a goal up a place, so it fills first', () => {
    expect(reordered(ids, 1, -1)).toEqual([8, 7, 9]);
  });

  it('moves a goal down a place', () => {
    expect(reordered(ids, 0, 1)).toEqual([8, 7, 9]);
  });

  it('leaves the order alone at either end', () => {
    expect(reordered(ids, 0, -1)).toEqual(ids);
    expect(reordered(ids, 2, 1)).toEqual(ids);
  });

  it('ignores an index that is not there', () => {
    expect(reordered(ids, 5, -1)).toEqual(ids);
    expect(reordered([], 0, 1)).toEqual([]);
  });

  it('never hands back the array it was given', () => {
    const result = reordered(ids, 0, 1);
    result.push(10);
    expect(ids).toEqual([7, 8, 9]);
  });
});
