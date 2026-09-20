import { describe, expect, it } from '@jest/globals';

import { CALENDAR_MONTHS, periodFor } from '../period';
import { buildRunway, type RunwayInput } from '../runway';

const period = periodFor('2026-09', CALENDAR_MONTHS);

const input = (over: Partial<RunwayInput> = {}): RunwayInput => ({
  period,
  today: new Date(2026, 8, 10),
  limitPence: 160000,
  daily: [],
  bills: [],
  fees: [],
  ...over,
});

describe('buildRunway', () => {
  it('has nothing to say without a budget', () => {
    expect(buildRunway(input({ limitPence: null }))).toBeNull();
    expect(buildRunway(input({ limitPence: 0 }))).toBeNull();
  });

  it('covers every day of the period', () => {
    const runway = buildRunway(input())!;
    expect(runway.days).toHaveLength(30);
    expect(runway.days[0].on).toBe('2026-09-01');
    expect(runway.days.at(-1)!.on).toBe('2026-09-30');
    expect(runway.days.filter((day) => day.past)).toHaveLength(10);
  });

  it('walks the budget down by what was really spent, then by the pace so far', () => {
    // £300 over the first ten days is £30 a day.
    const daily = Array.from({ length: 10 }, (_, index) => ({
      day: `2026-09-${String(index + 1).padStart(2, '0')}`,
      totalPence: 3000,
    }));

    const runway = buildRunway(input({ daily }))!;
    expect(runway.burnPence).toBe(3000);
    expect(runway.todayPence).toBe(160000 - 30000);
    // Twenty days left at £30 each.
    expect(runway.endPence).toBe(130000 - 20 * 3000);
    expect(runway.dryOn).toBeNull();
  });

  it('drops off a cliff on the day a bill leaves, and names it', () => {
    const runway = buildRunway(
      input({
        limitPence: 60000,
        // £100 over ten days is £10 a day: the spending alone would survive.
        daily: [{ day: '2026-09-05', totalPence: 10000 }],
        bills: [{ dueOn: '2026-09-25', amountPence: 50000, label: 'Rent' }],
      }),
    )!;

    expect(runway.cliffs).toHaveLength(1);
    expect(runway.cliffs[0]).toMatchObject({ label: 'Rent', kind: 'bill' });
    expect(runway.dryOn).toBe('2026-09-25');
    expect(runway.headline).toBe('Rent on 25 Sept 2026 is what tips it over.');
  });

  it('speaks in the past tense about a budget that has already gone', () => {
    const runway = buildRunway(
      input({
        today: new Date(2026, 8, 20),
        limitPence: 121000,
        daily: Array.from({ length: 20 }, (_, index) => ({
          day: `2026-09-${String(index + 1).padStart(2, '0')}`,
          totalPence: 7093,
        })),
      }),
    )!;

    expect(runway.dryOn).toBe('2026-09-18');
    expect(runway.headline).toBe("The budget ran out on 18 Sept 2026 — you're £208.60 past it.");
  });

  it('blames the pace, not a bill, when the spending is what sinks it', () => {
    const runway = buildRunway(
      input({ limitPence: 60000, daily: [{ day: '2026-09-05', totalPence: 40000 }] }),
    )!;

    expect(runway.dryOn).toBe('2026-09-16');
    expect(runway.headline).toBe('Carry on at £40 a day and it runs out on 16 Sept 2026.');
  });

  it('leaves out what has already been paid, so nothing is counted twice', () => {
    const runway = buildRunway(
      input({
        // The bill went out on the 5th and is in `daily` already.
        daily: [{ day: '2026-09-05', totalPence: 50000 }],
        bills: [{ dueOn: '2026-09-05', amountPence: 50000, label: 'Rent' }],
      }),
    )!;

    expect(runway.cliffs).toHaveLength(0);
    expect(runway.todayPence).toBe(110000);
  });

  it('counts fees the app spotted as cliffs of their own', () => {
    const runway = buildRunway(
      input({ fees: [{ dueOn: '2026-09-27', amountPence: 1199, label: 'Spotify' }] }),
    )!;

    expect(runway.cliffs.map((cliff) => cliff.kind)).toEqual(['fee']);
    expect(runway.endPence).toBe(160000 - 1199);
  });

  it('says the daily spend that lands exactly on nothing', () => {
    const runway = buildRunway(
      input({
        limitPence: 60000,
        daily: [{ day: '2026-09-01', totalPence: 0 }],
        bills: [{ dueOn: '2026-09-20', amountPence: 20000, label: 'Rent' }],
      }),
    )!;

    // £600 less the £200 bill, over the twenty days left.
    expect(runway.levelPence).toBe(2000);
    expect(runway.headline).toBe('£20 a day from here and you make it to the end.');
  });

  it('is honest when the bills have already claimed everything left', () => {
    const runway = buildRunway(
      input({
        limitPence: 50000,
        daily: [{ day: '2026-09-01', totalPence: 0 }],
        bills: [{ dueOn: '2026-09-28', amountPence: 50000, label: 'Rent' }],
      }),
    )!;

    expect(runway.levelPence).toBe(0);
    expect(runway.headline).toBe('What is left is already spoken for by the bills still to come.');
  });

  it('reports a finished period rather than projecting into it', () => {
    const runway = buildRunway(
      input({ today: new Date(2026, 9, 5), daily: [{ day: '2026-09-02', totalPence: 10000 }] }),
    )!;

    expect(runway.days.every((day) => day.past)).toBe(true);
    expect(runway.headline).toBe('All done, with £1,500 left over.');
  });
});
