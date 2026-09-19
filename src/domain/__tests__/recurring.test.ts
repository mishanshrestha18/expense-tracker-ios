import { describe, expect, it } from '@jest/globals';

import type { Expense } from '@/db/types';

import { daysInMonth, type IsoDate, type MonthKey } from '../dates';
import {
  detectRecurring,
  type RecurringSeries,
  totalUpcomingPence,
  upcomingFees,
} from '../recurring';

/** 19 September 2026: the day every test pretends it is. */
const TODAY = new Date(2026, 8, 19);
const SEPTEMBER = { start: '2026-09-01', end: '2026-10-01' };

let nextId = 0;

const expense = (spentOn: IsoDate, note: string, amountPence: number, categoryId = 1): Expense => ({
  id: (nextId += 1),
  amountPence,
  categoryId,
  note,
  spentOn,
  paidWith: 'card',
  createdAt: `${spentOn}T09:00:00.000Z`,
});

/** One payment per month on `day`, clamped to short months the way a real card is. */
const everyMonth = (
  months: readonly MonthKey[],
  day: number,
  note: string,
  amountPence: number,
  categoryId = 1,
): Expense[] =>
  months.map((month) => {
    const dayPart = String(Math.min(day, daysInMonth(month))).padStart(2, '0');
    return expense(`${month}-${dayPart}`, note, amountPence, categoryId);
  });

describe('detectRecurring', () => {
  it('finds a clean monthly subscription among one-off spending', () => {
    const expenses = [
      ...everyMonth(['2026-06', '2026-07', '2026-08', '2026-09'], 5, 'Netflix', 1099, 3),
      expense('2026-08-02', 'Coffee', 290),
      expense('2026-09-11', 'Coffee', 320),
    ];
    expect(detectRecurring(expenses, TODAY)).toEqual([
      {
        key: '3:netflix',
        label: 'Netflix',
        categoryId: 3,
        amountPence: 1099,
        dayOfMonth: 5,
        lastSeenOn: '2026-09-05',
        occurrences: 4,
      },
    ]);
  });

  it('groups past spelling and digits, and labels with the commonest spelling', () => {
    const series = detectRecurring(
      [
        expense('2026-06-05', 'Netflix', 1099, 3),
        expense('2026-07-05', 'netflix!', 1099, 3),
        expense('2026-08-05', 'Netflix 08/26', 1199, 3),
        expense('2026-09-05', 'Netflix', 1099, 3),
      ],
      TODAY,
    );
    expect(series).toHaveLength(1);
    expect(series[0].key).toBe('3:netflix');
    expect(series[0].label).toBe('Netflix');
    expect(series[0].amountPence).toBe(1099); // the median ignores the one dearer month
  });

  it('does not mistake irregular spending for a subscription', () => {
    const expenses = [
      expense('2026-03-02', 'Hardware shop', 4500, 5),
      expense('2026-04-20', 'Hardware shop', 4500, 5),
      expense('2026-07-11', 'Hardware shop', 4500, 5),
      expense('2026-09-01', 'Hardware shop', 4500, 5),
    ];
    expect(detectRecurring(expenses, TODAY)).toEqual([]);
  });

  it('rejects a monthly group whose amounts jump around', () => {
    const expenses = [
      expense('2026-06-10', 'Fuel', 5200, 4),
      expense('2026-07-10', 'Fuel', 5000, 4),
      expense('2026-08-10', 'Fuel', 4800, 4),
      expense('2026-09-10', 'Fuel', 15000, 4),
    ];
    expect(detectRecurring(expenses, TODAY)).toEqual([]);
  });

  it('accepts a price rise that stays within tolerance', () => {
    const expenses = [
      expense('2026-06-15', 'Gym', 2000, 6),
      expense('2026-07-15', 'Gym', 2000, 6),
      expense('2026-08-15', 'Gym', 2400, 6),
      expense('2026-09-15', 'Gym', 2400, 6),
    ];
    expect(detectRecurring(expenses, TODAY).map((s) => s.amountPence)).toEqual([2200]);
  });

  it('drops a series that stopped months ago', () => {
    const expenses = everyMonth(
      ['2026-01', '2026-02', '2026-03', '2026-04'],
      12,
      'Magazine',
      599,
      7,
    );
    expect(detectRecurring(expenses, TODAY)).toEqual([]);
  });

  it('keeps a series last seen exactly at the staleness cut-off', () => {
    const expenses = everyMonth(['2026-05', '2026-06', '2026-07'], 11, 'Magazine', 599, 7);
    expect(detectRecurring(expenses, TODAY).map((s) => s.lastSeenOn)).toEqual(['2026-07-11']);
  });

  it('needs three different months, not just three payments', () => {
    const expenses = [
      expense('2026-07-01', 'Window cleaner', 1500, 8),
      expense('2026-07-31', 'Window cleaner', 1500, 8),
      expense('2026-08-30', 'Window cleaner', 1500, 8),
    ];
    expect(detectRecurring(expenses, TODAY)).toEqual([]);
  });

  it('ignores expenses with nothing but blanks or digits in the note', () => {
    const expenses = [
      ...everyMonth(['2026-07', '2026-08', '2026-09'], 3, '   ', 2500, 9),
      ...everyMonth(['2026-07', '2026-08', '2026-09'], 4, '2026', 2500, 9),
    ];
    expect(detectRecurring(expenses, TODAY)).toEqual([]);
  });

  it('keeps the same note in different categories apart, dearest first', () => {
    const expenses = [
      ...everyMonth(['2026-07', '2026-08', '2026-09'], 6, 'Apple', 99, 2),
      ...everyMonth(['2026-07', '2026-08', '2026-09'], 6, 'Apple', 899, 3),
    ];
    expect(detectRecurring(expenses, TODAY).map((s) => s.key)).toEqual(['3:apple', '2:apple']);
  });

  it('reports the intended day of the month, not the one February clamped it to', () => {
    const expenses = everyMonth(['2025-12', '2026-01', '2026-02'], 31, 'Rent', 95000, 2);
    const series = detectRecurring(expenses, new Date(2026, 2, 15));
    expect(series).toHaveLength(1);
    expect(series[0].dayOfMonth).toBe(31);
    expect(series[0].lastSeenOn).toBe('2026-02-28');
  });
});

const netflix: RecurringSeries = {
  key: '3:netflix',
  label: 'Netflix',
  categoryId: 3,
  amountPence: 1099,
  dayOfMonth: 5,
  lastSeenOn: '2026-08-05',
  occurrences: 5,
};

const gym: RecurringSeries = {
  key: '6:gym',
  label: 'Gym',
  categoryId: 6,
  amountPence: 2400,
  dayOfMonth: 28,
  lastSeenOn: '2026-08-28',
  occurrences: 4,
};

const rent: RecurringSeries = {
  key: '2:rent',
  label: 'Rent',
  categoryId: 2,
  amountPence: 95000,
  dayOfMonth: 31,
  lastSeenOn: '2026-08-31',
  occurrences: 6,
};

describe('upcomingFees', () => {
  it('lists what is still to come out, earliest first, flagging what is late', () => {
    const fees = upcomingFees([gym, rent, netflix], [], SEPTEMBER, TODAY);
    expect(fees.map((f) => [f.label, f.dueOn, f.overdue])).toEqual([
      ['Netflix', '2026-09-05', true],
      ['Gym', '2026-09-28', false],
      ['Rent', '2026-09-30', false],
    ]);
  });

  it('clamps the due date to the length of the month', () => {
    const due = (start: IsoDate, end: IsoDate) =>
      upcomingFees([rent], [], { start, end }, TODAY).map((f) => f.dueOn);
    expect(due('2027-01-01', '2027-02-01')).toEqual(['2027-01-31']);
    expect(due('2027-02-01', '2027-03-01')).toEqual(['2027-02-28']);
    expect(due('2026-11-01', '2026-12-01')).toEqual(['2026-11-30']);
  });

  it('drops a fee that has already been paid in the period', () => {
    const paid = [expense('2026-09-04', 'netflix 04/09', 1099, 3)];
    expect(upcomingFees([netflix, gym], paid, SEPTEMBER, TODAY).map((f) => f.key)).toEqual([
      '6:gym',
    ]);
  });

  it('ignores a matching payment outside the period', () => {
    const outside = [
      expense('2026-08-05', 'Netflix', 1099, 3),
      expense('2026-10-05', 'Netflix', 1099, 3), // the end of the period is exclusive
    ];
    expect(upcomingFees([netflix], outside, SEPTEMBER, TODAY).map((f) => f.dueOn)).toEqual([
      '2026-09-05',
    ]);
  });

  it('only counts a payment as made when the category matches too', () => {
    const elsewhere = [expense('2026-09-04', 'Netflix', 1099, 9)];
    expect(upcomingFees([netflix], elsewhere, SEPTEMBER, TODAY)).toHaveLength(1);
  });

  it('skips a series whose day does not fall inside the period', () => {
    const fortnight = { start: '2026-09-10', end: '2026-09-24' };
    expect(upcomingFees([netflix, gym, rent], [], fortnight, TODAY)).toEqual([]);
  });

  it('picks the right month for a period that straddles two', () => {
    const payCycle = { start: '2026-09-25', end: '2026-10-25' };
    expect(upcomingFees([netflix, gym], [], payCycle, TODAY).map((f) => f.dueOn)).toEqual([
      '2026-09-28',
      '2026-10-05',
    ]);
  });
});

describe('totalUpcomingPence', () => {
  it('adds up what is still to come out', () => {
    const fees = upcomingFees([netflix, gym, rent], [], SEPTEMBER, TODAY);
    expect(totalUpcomingPence(fees)).toBe(1099 + 2400 + 95000);
  });

  it('is zero when nothing is left', () => {
    expect(totalUpcomingPence([])).toBe(0);
  });
});
