import { describe, expect, it } from '@jest/globals';

import { change, describeChange, movers } from '../compare';

const categories = [
  { id: 1, name: 'Groceries' },
  { id: 2, name: 'Eating out' },
  { id: 3, name: 'Transport' },
  { id: 4, name: 'Bills' },
];

describe('change', () => {
  it('measures the difference both ways', () => {
    expect(change(12000, 10000)).toEqual({
      currentPence: 12000,
      previousPence: 10000,
      differencePence: 2000,
      ratio: 0.2,
    });
  });

  it('has no percentage to give when there was nothing before', () => {
    expect(change(12000, 0).ratio).toBeNull();
    expect(change(12000, 0).differencePence).toBe(12000);
  });
});

describe('movers', () => {
  const current = [
    { categoryId: 1, totalPence: 20000 },
    { categoryId: 2, totalPence: 9000 },
    { categoryId: 3, totalPence: 5100 },
  ];
  const previous = [
    { categoryId: 1, totalPence: 15000 },
    { categoryId: 2, totalPence: 16000 },
    { categoryId: 3, totalPence: 5000 },
  ];

  it('puts the biggest change first, whichever way it went', () => {
    const rows = movers(categories, current, previous);
    expect(rows.map((r) => [r.item.name, r.differencePence])).toEqual([
      ['Eating out', -7000],
      ['Groceries', 5000],
    ]);
  });

  it('ignores categories that barely moved, and ones with nothing either side', () => {
    const names = movers(categories, current, previous).map((r) => r.item.name);
    expect(names).not.toContain('Transport');
    expect(names).not.toContain('Bills');
  });

  it('counts a category that is new this period', () => {
    const rows = movers(categories, [{ categoryId: 4, totalPence: 9000 }], []);
    expect(rows[0]).toMatchObject({ differencePence: 9000, previousPence: 0, ratio: null });
  });
});

describe('describeChange', () => {
  it.each([
    [12000, '£120 more than last month'],
    [-12050, '£120.50 less than last month'],
    [200, 'about the same as last month'],
  ])('reads %s as words', (difference, expected) => {
    expect(describeChange(difference, 'last month')).toBe(expected);
  });
});
