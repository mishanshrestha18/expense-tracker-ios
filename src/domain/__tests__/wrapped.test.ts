import { describe, expect, it } from '@jest/globals';

import type { Category } from '@/db/types';

import { formatDate } from '../dates';
import { buildWrapped, MAX_MOVERS, MAX_SLICES, type WrappedInput, wrappedText } from '../wrapped';

const category = (id: number, name: string, color: string): Category => ({
  id,
  name,
  icon: 'tag',
  color,
  aliases: [],
  sortOrder: id,
});

const categories = [
  category(1, 'Groceries', '#16A34A'),
  category(2, 'Eating out', '#F97316'),
  category(3, 'Transport', '#2563EB'),
  category(4, 'Bills', '#7C3AED'),
];

const spend = (categoryId: number, totalPence: number) => ({ categoryId, totalPence });

/** September 2026: £1,240.50 spent against a £1,500 budget. */
const september: WrappedInput = {
  periodLabel: 'September 2026',
  noun: 'month',
  totalPence: 124_050,
  limitPence: 150_000,
  carryPence: 25_950,
  lastPeriodPence: 131_000,
  spending: [spend(1, 42_000), spend(2, 38_050), spend(3, 24_000), spend(4, 20_000)],
  lastSpending: [spend(1, 39_000), spend(2, 45_050), spend(3, 24_100), spend(4, 22_850)],
  categories,
  dayCount: 30,
  busiestDay: { date: '2026-09-12', totalPence: 9_620 },
};

const build = (overrides: Partial<WrappedInput> = {}) =>
  buildWrapped({ ...september, ...overrides });

describe('buildWrapped headline', () => {
  it('reads as one sentence when a budget says what was saved', () => {
    expect(build().headline).toBe('£1,240.50 spent, £259.50 saved.');
  });

  it('only reports the spending when there is no budget', () => {
    expect(build({ limitPence: null, carryPence: null }).headline).toBe('£1,240.50 spent.');
  });

  it('measures against the budget when the period has not been closed yet', () => {
    expect(build({ carryPence: null }).headline).toBe('£1,240.50 spent of £1,500.');
  });

  it('says how far over an overspent period went', () => {
    expect(build({ totalPence: 164_050, carryPence: -14_050 }).headline).toBe(
      '£1,640.50 spent, £140.50 over.',
    );
  });

  it('has a word for landing exactly on the budget', () => {
    expect(build({ totalPence: 150_000, carryPence: 0 }).headline).toBe(
      '£1,500 spent, exactly on budget.',
    );
  });
});

describe('buildWrapped carry', () => {
  it('sends a positive carry to savings in the stats and the footer', () => {
    const wrapped = build();
    expect(wrapped.stats).toContainEqual({
      label: 'Saved',
      value: '£259.50',
      detail: 'into savings',
    });
    expect(wrapped.footer).toBe('£259.50 went to savings.');
  });

  it('takes a negative carry back out again', () => {
    const wrapped = build({ totalPence: 164_050, carryPence: -14_050 });
    expect(wrapped.stats).toContainEqual({
      label: 'Over by',
      value: '£140.50',
      detail: 'out of savings',
    });
    expect(wrapped.footer).toBe('£140.50 came back out of savings.');
  });
});

describe('buildWrapped stats', () => {
  it('shows three or four, biggest news first', () => {
    const wrapped = build();
    expect(wrapped.stats).toHaveLength(4);
    expect(wrapped.stats.map((stat) => stat.label)).toEqual([
      'Spent',
      'Saved',
      'Busiest day',
      'A day',
    ]);
    expect(wrapped.stats[0]).toEqual({
      label: 'Spent',
      value: '£1,240.50',
      detail: 'of £1,500',
    });
    expect(wrapped.stats[2].detail).toBe(formatDate('2026-09-12'));
  });

  it('falls back to the comparison when there is no budget and no busiest day', () => {
    const wrapped = build({ limitPence: null, carryPence: null, busiestDay: null });
    expect(wrapped.stats.map((stat) => stat.label)).toEqual([
      'Spent',
      'A day',
      'vs last month',
      'Categories',
    ]);
    expect(wrapped.stats[1]).toEqual({ label: 'A day', value: '£41.35', detail: 'across 30 days' });
    expect(wrapped.stats[2]).toEqual({
      label: 'vs last month',
      value: '£69.50 less',
      detail: '£1,310 then',
    });
  });

  it('calls a period something other than a month when payday says so', () => {
    const wrapped = build({ noun: 'period', limitPence: null, carryPence: null, busiestDay: null });
    expect(wrapped.stats.map((stat) => stat.label)).toContain('vs last period');
  });
});

describe('buildWrapped slices', () => {
  it('puts the biggest category first, with shares that add up to one', () => {
    const wrapped = build();
    expect(wrapped.slices.map((slice) => slice.name)).toEqual([
      'Groceries',
      'Eating out',
      'Transport',
      'Bills',
    ]);
    expect(wrapped.slices[0]).toEqual({
      name: 'Groceries',
      color: '#16A34A',
      pence: 42_000,
      share: 42_000 / 124_050,
    });
    expect(sumOfShares(wrapped.slices)).toBeCloseTo(1, 10);
  });

  it('keeps the five biggest, and the shares then add up to their part of the total', () => {
    const many = [
      ...categories,
      category(5, 'Fun', '#DB2777'),
      category(6, 'Health', '#0891B2'),
      category(7, 'Gifts', '#CA8A04'),
    ];
    const spending = [
      spend(1, 40_000),
      spend(2, 30_000),
      spend(3, 20_000),
      spend(4, 10_000),
      spend(5, 6_000),
      spend(6, 3_000),
      spend(7, 1_000),
    ];
    const wrapped = build({ categories: many, spending, totalPence: 110_000 });

    expect(wrapped.slices).toHaveLength(MAX_SLICES);
    expect(wrapped.slices.map((slice) => slice.name)).toEqual([
      'Groceries',
      'Eating out',
      'Transport',
      'Bills',
      'Fun',
    ]);
    // The 4% left in Health and Gifts is what the card leaves as bare track.
    expect(sumOfShares(wrapped.slices)).toBeCloseTo(106_000 / 110_000, 10);
  });

  it('drops categories nothing was spent in', () => {
    const wrapped = build({ spending: [spend(2, 124_050)] });
    expect(wrapped.slices.map((slice) => slice.name)).toEqual(['Eating out']);
    expect(wrapped.slices[0].share).toBe(1);
  });
});

describe('buildWrapped movers', () => {
  it('names at most three, biggest change first', () => {
    const wrapped = build({
      spending: [spend(1, 52_000), spend(2, 38_050), spend(3, 24_000), spend(4, 10_000)],
      lastSpending: [spend(1, 39_000), spend(2, 45_050), spend(3, 21_000), spend(4, 22_850)],
    });

    expect(wrapped.movers).toHaveLength(MAX_MOVERS);
    expect(wrapped.movers).toEqual([
      'Groceries £130 more than last month',
      'Bills £128.50 less than last month',
      'Eating out £70 less than last month',
    ]);
  });

  it('has nothing to say when the period before is empty of comparisons', () => {
    expect(build({ spending: [], lastSpending: [] }).movers).toEqual([]);
  });
});

describe('buildWrapped with nothing recorded', () => {
  const empty = build({
    totalPence: 0,
    limitPence: null,
    carryPence: null,
    lastPeriodPence: null,
    spending: [],
    lastSpending: [],
    busiestDay: null,
  });

  it('says so in words rather than in zeroes', () => {
    expect(empty.headline).toBe('Nothing spent.');
    expect(empty.footer).toBe('Nothing recorded this month.');
    expect(empty.slices).toEqual([]);
    expect(empty.movers).toEqual([]);
  });

  it('still fills the stat row without a NaN in it', () => {
    expect(empty.stats).toHaveLength(3);
    expect(empty.stats.map((stat) => stat.value)).toEqual(['£0', '£0.00', '0']);
    expect(JSON.stringify(empty)).not.toContain('NaN');
  });

  it('refuses to divide by a period of no days', () => {
    const noDays = build({ totalPence: 0, dayCount: 0, spending: [], busiestDay: null });
    const perDay = noDays.stats.find((stat) => stat.label === 'A day');
    expect(perDay).toEqual({ label: 'A day', value: '—', detail: undefined });
    expect(JSON.stringify(noDays)).not.toContain('NaN');
  });

  it('keeps the budget in view when nothing was spent against it', () => {
    const untouched = build({
      totalPence: 0,
      carryPence: 150_000,
      spending: [],
      lastSpending: [],
      busiestDay: null,
    });
    expect(untouched.headline).toBe('Nothing spent, £1,500 saved.');
    expect(untouched.footer).toBe('Nothing spent — the whole £1,500 is still there.');
  });
});

describe('buildWrapped footer', () => {
  it('compares with the period before when there is no budget to score', () => {
    expect(build({ limitPence: null, carryPence: null }).footer).toBe(
      '£69.50 less than last month.',
    );
  });

  it('does not make a headline out of a few pounds either way', () => {
    expect(build({ limitPence: null, carryPence: null, lastPeriodPence: 124_200 }).footer).toBe(
      'About the same as last month.',
    );
  });

  it('nudges towards a budget when there is nothing at all to compare with', () => {
    expect(build({ limitPence: null, carryPence: null, lastPeriodPence: null }).footer).toBe(
      'Set a budget and next month counts what you saved.',
    );
  });
});

describe('wrappedText', () => {
  it('carries the headline, the stats, the split, the movers and the footer', () => {
    const wrapped = build();
    const text = wrappedText(wrapped);

    expect(text.startsWith('September 2026\n£1,240.50 spent, £259.50 saved.')).toBe(true);
    expect(text).toContain('Spent: £1,240.50 (of £1,500)');
    expect(text).toContain('Groceries £420 · 34%');
    for (const mover of wrapped.movers) expect(text).toContain(mover);
    expect(text.endsWith('£259.50 went to savings.')).toBe(true);
  });

  it('leaves out the parts an empty period does not have', () => {
    const text = wrappedText(
      build({
        totalPence: 0,
        limitPence: null,
        carryPence: null,
        lastPeriodPence: null,
        spending: [],
        lastSpending: [],
        busiestDay: null,
      }),
    );
    expect(text).toContain('Nothing spent.');
    expect(text).not.toContain('NaN');
    expect(text).not.toContain('·');
  });
});

function sumOfShares(slices: readonly { share: number }[]): number {
  return slices.reduce((sum, slice) => sum + slice.share, 0);
}
