import { describe, expect, it } from '@jest/globals';

import {
  averageOfActiveMonths,
  breakdown,
  fillMonths,
  groupByDay,
  percentChange,
} from '../summary';

describe('fillMonths', () => {
  it('fills gaps with zero and keeps the requested order', () => {
    expect(
      fillMonths(
        ['2026-07', '2026-08', '2026-09'],
        [
          { month: '2026-09', totalPence: 300 },
          { month: '2026-07', totalPence: 100 },
        ],
      ),
    ).toEqual([
      { month: '2026-07', totalPence: 100 },
      { month: '2026-08', totalPence: 0 },
      { month: '2026-09', totalPence: 300 },
    ]);
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
