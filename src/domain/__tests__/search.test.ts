import { describe, expect, it } from '@jest/globals';

import type { Category } from '@/db/types';

import {
  describeFilter,
  EMPTY_FILTER,
  type ExpenseFilter,
  isEmptyFilter,
  summariseResult,
} from '../search';

const category = (id: number, name: string): Category => ({
  id,
  name,
  icon: 'other',
  color: '#8B8D98',
  aliases: [],
  sortOrder: id,
});

const CATEGORIES: Category[] = [
  category(1, 'Groceries'),
  category(2, 'Eating out'),
  category(3, 'Transport'),
];

const filter = (patch: Partial<ExpenseFilter>): ExpenseFilter => ({ ...EMPTY_FILTER, ...patch });

describe('EMPTY_FILTER', () => {
  it('asks for nothing in particular', () => {
    expect(EMPTY_FILTER).toEqual({
      text: '',
      categoryIds: [],
      paidWith: null,
      minPence: null,
      maxPence: null,
      from: null,
      to: null,
    });
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true);
    expect(describeFilter(EMPTY_FILTER, CATEGORIES)).toEqual([]);
  });

  it('cannot be edited by accident, since every screen shares it', () => {
    expect(Object.isFrozen(EMPTY_FILTER)).toBe(true);
    expect(Object.isFrozen(EMPTY_FILTER.categoryIds)).toBe(true);
  });
});

describe('isEmptyFilter', () => {
  it('ignores text that is only spaces', () => {
    expect(isEmptyFilter(filter({ text: '   ' }))).toBe(true);
    expect(isEmptyFilter(filter({ text: ' t ' }))).toBe(false);
  });

  it('counts any one filter', () => {
    expect(isEmptyFilter(filter({ text: 'tesco' }))).toBe(false);
    expect(isEmptyFilter(filter({ categoryIds: [1] }))).toBe(false);
    expect(isEmptyFilter(filter({ paidWith: 'cash' }))).toBe(false);
    expect(isEmptyFilter(filter({ minPence: 2000 }))).toBe(false);
    expect(isEmptyFilter(filter({ maxPence: 2000 }))).toBe(false);
    expect(isEmptyFilter(filter({ from: '2026-06-01' }))).toBe(false);
    expect(isEmptyFilter(filter({ to: '2026-06-30' }))).toBe(false);
  });

  it('counts the filters that look falsy', () => {
    // "Not recorded" is something to look for, and zero is a bound like any other.
    expect(isEmptyFilter(filter({ paidWith: '' }))).toBe(false);
    expect(isEmptyFilter(filter({ minPence: 0 }))).toBe(false);
    expect(isEmptyFilter(filter({ maxPence: 0 }))).toBe(false);
  });
});

describe('describeFilter', () => {
  it('says the whole filter back in chips', () => {
    expect(
      describeFilter(
        filter({ text: ' Tesco ', categoryIds: [1], minPence: 2000, from: '2026-06-01' }),
        CATEGORIES,
      ),
    ).toEqual(['Tesco', 'Groceries', 'over £20', 'since 1 Jun']);
  });

  it('names the categories in the order they were chosen', () => {
    expect(describeFilter(filter({ categoryIds: [3, 1] }), CATEGORIES)).toEqual([
      'Transport',
      'Groceries',
    ]);
  });

  it('leaves out a category that is no longer there', () => {
    expect(describeFilter(filter({ categoryIds: [99] }), CATEGORIES)).toEqual([]);
    expect(describeFilter(filter({ categoryIds: [99, 2] }), CATEGORIES)).toEqual(['Eating out']);
  });

  it('labels how it was paid', () => {
    expect(describeFilter(filter({ paidWith: 'cash' }), CATEGORIES)).toEqual(['Cash']);
    expect(describeFilter(filter({ paidWith: 'apple-pay' }), CATEGORIES)).toEqual(['Apple Pay']);
    expect(describeFilter(filter({ paidWith: '' }), CATEGORIES)).toEqual(['Not recorded']);
  });

  it('describes an amount as over, under or a range', () => {
    expect(describeFilter(filter({ minPence: 2000 }), CATEGORIES)).toEqual(['over £20']);
    expect(describeFilter(filter({ maxPence: 5050 }), CATEGORIES)).toEqual(['under £50.50']);
    expect(describeFilter(filter({ minPence: 2000, maxPence: 5000 }), CATEGORIES)).toEqual([
      '£20 – £50',
    ]);
  });

  it('describes dates as since, until or a range', () => {
    expect(describeFilter(filter({ from: '2026-06-01' }), CATEGORIES)).toEqual(['since 1 Jun']);
    expect(describeFilter(filter({ to: '2026-06-30' }), CATEGORIES)).toEqual(['until 30 Jun']);
    expect(describeFilter(filter({ from: '2026-06-01', to: '2026-06-30' }), CATEGORIES)).toEqual([
      '1 Jun – 30 Jun',
    ]);
  });

  it('keeps the chips in a fixed order', () => {
    expect(
      describeFilter(
        filter({
          text: 'coffee',
          categoryIds: [2],
          paidWith: 'card',
          minPence: 200,
          maxPence: 500,
          from: '2026-01-05',
          to: '2026-12-31',
        }),
        CATEGORIES,
      ),
    ).toEqual(['coffee', 'Eating out', 'Card', '£2 – £5', '5 Jan – 31 Dec']);
  });
});

describe('summariseResult', () => {
  it('gives the total, the count and the average', () => {
    expect(summariseResult(41230, 9)).toEqual({
      total: '£412.30',
      detail: '9 payments · £45.81 each',
      spoken: '£412.30 · 9 payments · £45.81 each',
    });
  });

  it('leaves out the average when there is only one payment', () => {
    expect(summariseResult(1250, 1)).toEqual({
      total: '£12.50',
      detail: '1 payment',
      spoken: '£12.50 · 1 payment',
    });
  });

  it('says nothing was found rather than dividing by zero', () => {
    expect(summariseResult(0, 0)).toEqual({
      total: '£0.00',
      detail: 'No payments',
      spoken: 'No payments',
    });
  });

  it('rounds the average to whole pence', () => {
    // 1000 / 3 is 333.33 pence.
    expect(summariseResult(1000, 3).detail).toBe('3 payments · £3.33 each');
  });
});
