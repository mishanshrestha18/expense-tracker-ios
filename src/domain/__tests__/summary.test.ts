import { describe, expect, it } from '@jest/globals';

import { CALENDAR_MONTHS, periodFor, periodsEndingAt } from '../period';
import {
  averageOfActiveMonths,
  breakdown,
  bucketByPeriod,
  groupByDay,
  percentChange,
} from '../summary';

describe('bucketByPeriod', () => {
  it('sums days into each period and keeps the order', () => {
    const periods = periodsEndingAt('2026-09', 3, CALENDAR_MONTHS);
    expect(
      bucketByPeriod(
        [
          { day: '2026-07-04', totalPence: 100 },
          { day: '2026-09-01', totalPence: 200 },
          { day: '2026-09-30', totalPence: 100 },
        ],
        periods,
      ),
    ).toEqual([
      { month: '2026-07', totalPence: 100 },
      { month: '2026-08', totalPence: 0 },
      { month: '2026-09', totalPence: 300 },
    ]);
  });

  it('follows payday periods rather than calendar months', () => {
    const period = periodFor('2026-08', { kind: 'day', day: 25, weekendAdjust: false });
    expect(
      bucketByPeriod(
        [
          { day: '2026-08-24', totalPence: 500 },
          { day: '2026-08-25', totalPence: 100 },
          { day: '2026-09-24', totalPence: 200 },
          { day: '2026-09-25', totalPence: 900 },
        ],
        [period],
      ),
    ).toEqual([{ month: '2026-08', totalPence: 300 }]);
  });
});

describe('breakdown', () => {
  it('sorts by total, drops zeros and computes shares', () => {
    const result = breakdown([
      { item: 'a', totalPence: 100 },
      { item: 'b', totalPence: 0 },
      { item: 'c', totalPence: 300 },
    ]);
    expect(result.map((r) => r.item)).toEqual(['c', 'a']);
    expect(result.map((r) => r.share)).toEqual([0.75, 0.25]);
  });

  it('handles no spending', () => {
    expect(breakdown([{ item: 'a', totalPence: 0 }])).toEqual([]);
  });
});

describe('percentChange', () => {
  it('computes relative change', () => {
    expect(percentChange(120, 100)).toBeCloseTo(0.2);
    expect(percentChange(50, 100)).toBeCloseTo(-0.5);
  });

  it('is undefined without a baseline', () => {
    expect(percentChange(100, 0)).toBeNull();
  });
});

describe('averageOfActiveMonths', () => {
  it('ignores empty months', () => {
    expect(
      averageOfActiveMonths([
        { month: '2026-07', totalPence: 0 },
        { month: '2026-08', totalPence: 100 },
        { month: '2026-09', totalPence: 201 },
      ]),
    ).toBe(151);
    expect(averageOfActiveMonths([])).toBe(0);
  });
});

describe('groupByDay', () => {
  it('groups newest day first and totals each day', () => {
    const groups = groupByDay([
      { id: 1, spentOn: '2026-09-18', amountPence: 100 },
      { id: 2, spentOn: '2026-09-19', amountPence: 250 },
      { id: 3, spentOn: '2026-09-18', amountPence: 50 },
    ]);
    expect(groups.map((g) => [g.date, g.totalPence, g.items.map((i) => i.id)])).toEqual([
      ['2026-09-19', 250, [2]],
      ['2026-09-18', 150, [1, 3]],
    ]);
  });
});
