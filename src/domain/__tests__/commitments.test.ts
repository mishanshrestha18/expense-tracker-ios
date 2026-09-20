import { describe, expect, it } from '@jest/globals';

import type { Commitment, CommitmentAmount, CommitmentSettlement } from '@/db/types';

import {
  amountOn,
  committedTotals,
  dueDatesBetween,
  monthlySetAsidePence,
  nextAmountChange,
  type Occurrence,
  occurrencesIn,
} from '../commitments';
import type { IsoDate } from '../dates';

/** 19 September 2026: the day every test pretends it is. */
const TODAY = new Date(2026, 8, 19);
const SEPTEMBER = { start: '2026-09-01', end: '2026-10-01' };

const amounts = (...entries: readonly [IsoDate, number][]): CommitmentAmount[] =>
  entries.map(([effectiveFrom, amountPence]) => ({ effectiveFrom, amountPence }));

/** Rent by default: fixed, monthly, £500 on the 1st, running since January. */
const commitment = (overrides: Partial<Commitment> = {}): Commitment => ({
  id: 1,
  name: 'Rent',
  categoryId: 1,
  kind: 'fixed',
  dueDay: 1,
  everyMonths: 1,
  anchorMonth: '2026-01',
  endedOn: null,
  amounts: amounts(['2026-01-01', 50000]),
  ...overrides,
});

const settled = (
  commitmentId: number,
  dueOn: IsoDate,
  status: 'paid' | 'skipped',
  expenseId: number | null = null,
): CommitmentSettlement => ({ commitmentId, dueOn, status, expenseId });

describe('amountOn', () => {
  // £500 until the rent review, £700 from the day it takes effect.
  const rent = commitment({ amounts: amounts(['2026-01-01', 50000], ['2027-10-01', 70000]) });

  it('has no amount before the first one starts', () => {
    expect(amountOn(rent, '2025-12-31')).toBeNull();
    expect(amountOn(commitment({ amounts: [] }), '2026-09-19')).toBeNull();
  });

  it('applies an amount from its effective date, inclusive', () => {
    expect(amountOn(rent, '2026-01-01')).toBe(50000);
    expect(amountOn(rent, '2027-09-30')).toBe(50000);
    expect(amountOn(rent, '2027-10-01')).toBe(70000);
    expect(amountOn(rent, '2030-06-15')).toBe(70000);
  });

  it('reads the timeline by date rather than by position', () => {
    const jumbled = commitment({ amounts: amounts(['2027-10-01', 70000], ['2026-01-01', 50000]) });
    expect(amountOn(jumbled, '2026-06-01')).toBe(50000);
    expect(amountOn(jumbled, '2027-10-01')).toBe(70000);
  });
});

describe('dueDatesBetween', () => {
  it('lands once a month, oldest first', () => {
    const gym = commitment({ dueDay: 15 });
    expect(dueDatesBetween(gym, '2026-09-01', '2026-12-01')).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
    ]);
  });

  it('clamps the due day to the length of the month', () => {
    const card = commitment({ dueDay: 31 });
    expect(dueDatesBetween(card, '2026-01-01', '2026-05-01')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
    // 2028 is a leap year, so the same bill falls a day later.
    expect(dueDatesBetween(card, '2028-02-01', '2028-03-01')).toEqual(['2028-02-29']);
  });

  it('keeps a quarterly bill on its anchor months', () => {
    const water = commitment({ everyMonths: 3, anchorMonth: '2026-02', dueDay: 15 });
    expect(dueDatesBetween(water, '2026-01-01', '2027-01-01')).toEqual([
      '2026-02-15',
      '2026-05-15',
      '2026-08-15',
      '2026-11-15',
    ]);
  });

  it('keeps an annual bill in its anchor month, year after year', () => {
    const insurance = commitment({ everyMonths: 12, anchorMonth: '2026-03', dueDay: 20 });
    expect(dueDatesBetween(insurance, '2026-01-01', '2028-01-01')).toEqual([
      '2026-03-20',
      '2027-03-20',
    ]);
  });

  it('works out the anchor by month difference, not by counting forwards', () => {
    // Anchored to a month in the future: the March before it still counts.
    const insurance = commitment({
      everyMonths: 12,
      anchorMonth: '2027-03',
      dueDay: 20,
      amounts: amounts(['2025-01-01', 60000]),
    });
    expect(dueDatesBetween(insurance, '2026-01-01', '2027-01-01')).toEqual(['2026-03-20']);
  });

  it('stops on the day the commitment ended', () => {
    const cancelled = commitment({ endedOn: '2026-04-01' });
    expect(dueDatesBetween(cancelled, '2026-01-01', '2026-07-01')).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('does not start before the first amount', () => {
    const newFlat = commitment({ amounts: amounts(['2026-03-15', 50000]) });
    expect(dueDatesBetween(newFlat, '2026-01-01', '2026-06-01')).toEqual([
      '2026-04-01',
      '2026-05-01',
    ]);
  });

  it('is empty for an empty or backwards range', () => {
    expect(dueDatesBetween(commitment(), '2026-09-01', '2026-09-01')).toEqual([]);
    expect(dueDatesBetween(commitment(), '2026-10-01', '2026-09-01')).toEqual([]);
  });
});

describe('occurrencesIn', () => {
  const rent = commitment({ id: 1, dueDay: 1, amounts: amounts(['2026-01-01', 50000]) });
  const phone = commitment({
    id: 2,
    name: 'Phone',
    dueDay: 10,
    amounts: amounts(['2026-01-01', 2000]),
  });
  const gym = commitment({
    id: 3,
    name: 'Gym',
    dueDay: 25,
    amounts: amounts(['2026-01-01', 3000]),
  });
  const broadband = commitment({
    id: 4,
    name: 'Broadband',
    dueDay: 19,
    amounts: amounts(['2026-01-01', 2500]),
  });

  it('dates the status from today and sorts oldest first', () => {
    expect(occurrencesIn([gym, rent, broadband, phone], [], SEPTEMBER, TODAY)).toEqual([
      {
        commitmentId: 1,
        dueOn: '2026-09-01',
        amountPence: 50000,
        status: 'overdue',
        expenseId: null,
      },
      {
        commitmentId: 2,
        dueOn: '2026-09-10',
        amountPence: 2000,
        status: 'overdue',
        expenseId: null,
      },
      { commitmentId: 4, dueOn: '2026-09-19', amountPence: 2500, status: 'due', expenseId: null },
      {
        commitmentId: 3,
        dueOn: '2026-09-25',
        amountPence: 3000,
        status: 'upcoming',
        expenseId: null,
      },
    ]);
  });

  it('prefers a settlement, paid or skipped, to the calendar', () => {
    const occurrences = occurrencesIn(
      [rent, phone, gym],
      [settled(1, '2026-09-01', 'paid', 77), settled(2, '2026-09-10', 'skipped')],
      SEPTEMBER,
      TODAY,
    );
    expect(occurrences.map((o) => [o.status, o.expenseId])).toEqual([
      ['paid', 77],
      ['skipped', null],
      ['upcoming', null],
    ]);
  });

  it('ignores a settlement for another date or another commitment', () => {
    const occurrences = occurrencesIn(
      [rent],
      [settled(1, '2026-08-01', 'paid', 77), settled(2, '2026-09-01', 'paid', 78)],
      SEPTEMBER,
      TODAY,
    );
    expect(occurrences).toEqual([
      {
        commitmentId: 1,
        dueOn: '2026-09-01',
        amountPence: 50000,
        status: 'overdue',
        expenseId: null,
      },
    ]);
  });

  it('breaks a tie on the same day with the commitment id', () => {
    const later = commitment({ id: 9, dueDay: 5 });
    const earlier = commitment({ id: 2, dueDay: 5 });
    expect(
      occurrencesIn([later, earlier], [], SEPTEMBER, TODAY).map((o) => o.commitmentId),
    ).toEqual([2, 9]);
  });

  it('prices each occurrence at the amount in force on its own due date', () => {
    const rising = commitment({
      dueDay: 20,
      amounts: amounts(['2026-01-01', 50000], ['2026-10-01', 70000]),
    });
    const occurrences = occurrencesIn(
      [rising],
      [],
      { start: '2026-09-01', end: '2026-11-01' },
      TODAY,
    );
    expect(occurrences.map((o) => [o.dueOn, o.amountPence])).toEqual([
      ['2026-09-20', 50000],
      ['2026-10-20', 70000],
    ]);
  });
});

describe('monthlySetAsidePence', () => {
  it('spreads a non-monthly cost over its cycle', () => {
    const insurance = commitment({
      everyMonths: 12,
      anchorMonth: '2026-03',
      amounts: amounts(['2026-01-01', 60000]),
    });
    expect(monthlySetAsidePence(insurance, '2026-09-19')).toBe(5000);
  });

  it('rounds to the nearest penny', () => {
    const quarterly = (amountPence: number) =>
      commitment({ everyMonths: 3, amounts: amounts(['2026-01-01', amountPence]) });
    expect(monthlySetAsidePence(quarterly(10000), '2026-09-19')).toBe(3333);
    expect(monthlySetAsidePence(quarterly(20000), '2026-09-19')).toBe(6667);
  });

  it('gives a monthly commitment its own amount, and nothing before it starts', () => {
    expect(monthlySetAsidePence(commitment(), '2026-09-19')).toBe(50000);
    expect(monthlySetAsidePence(commitment(), '2025-12-31')).toBe(0);
  });
});

describe('committedTotals', () => {
  const rent = commitment({ id: 1, dueDay: 1, amounts: amounts(['2026-01-01', 50000]) });
  const phone = commitment({
    id: 2,
    name: 'Phone',
    dueDay: 10,
    amounts: amounts(['2026-01-01', 2000]),
  });
  const gym = commitment({
    id: 3,
    name: 'Gym',
    dueDay: 25,
    amounts: amounts(['2026-01-01', 3000]),
  });
  const charity = commitment({
    id: 4,
    name: 'Charity',
    dueDay: 5,
    amounts: amounts(['2026-01-01', 1000]),
  });
  const insurance = commitment({
    id: 5,
    name: 'Car insurance',
    everyMonths: 12,
    anchorMonth: '2026-03',
    dueDay: 20,
    amounts: amounts(['2026-01-01', 60000]),
  });
  const all = [rent, phone, gym, charity, insurance];
  const settlements = [settled(1, '2026-09-01', 'paid', 77), settled(4, '2026-09-05', 'skipped')];

  it('splits a period into paid, outstanding, overdue and set aside', () => {
    const occurrences = occurrencesIn(all, settlements, SEPTEMBER, TODAY);
    expect(committedTotals(all, occurrences, TODAY)).toEqual({
      duePence: 55000, // rent paid, phone overdue, gym upcoming; the skipped charity is not owed
      paidPence: 50000,
      outstandingPence: 5000,
      overduePence: 2000, // only the phone is both unpaid and past its date
      setAsidePence: 5000, // a twelfth of the annual insurance, which is not due until March
    });
  });

  it('sets nothing aside for a commitment that is due this period, even if skipped', () => {
    const occurrences = occurrencesIn([charity], settlements, SEPTEMBER, TODAY);
    expect(committedTotals([charity], occurrences, TODAY)).toEqual({
      duePence: 0,
      paidPence: 0,
      outstandingPence: 0,
      overduePence: 0,
      setAsidePence: 0,
    });
  });

  it('sets nothing aside for a commitment that has ended', () => {
    const cancelled = commitment({
      id: 6,
      everyMonths: 12,
      anchorMonth: '2026-03',
      endedOn: '2026-08-01',
      amounts: amounts(['2026-01-01', 60000]),
    });
    expect(committedTotals([cancelled], [], TODAY).setAsidePence).toBe(0);
  });

  it('counts an occurrence due today as outstanding but not overdue', () => {
    const occurrences: Occurrence[] = [
      { commitmentId: 1, dueOn: '2026-09-19', amountPence: 2500, status: 'due', expenseId: null },
      {
        commitmentId: 2,
        dueOn: '2026-09-18',
        amountPence: 1500,
        status: 'overdue',
        expenseId: null,
      },
    ];
    expect(committedTotals([], occurrences, TODAY)).toEqual({
      duePence: 4000,
      paidPence: 0,
      outstandingPence: 4000,
      overduePence: 1500,
      setAsidePence: 0,
    });
  });
});

describe('nextAmountChange', () => {
  it('announces a known future rise', () => {
    const rent = commitment({ amounts: amounts(['2026-01-01', 50000], ['2027-10-01', 70000]) });
    expect(nextAmountChange(rent, TODAY)).toEqual({
      effectiveFrom: '2027-10-01',
      fromPence: 50000,
      toPence: 70000,
    });
  });

  it('announces the soonest change, from the amount in force just before it', () => {
    const rent = commitment({
      amounts: amounts(['2026-01-01', 50000], ['2026-12-01', 60000], ['2027-10-01', 70000]),
    });
    expect(nextAmountChange(rent, TODAY)).toEqual({
      effectiveFrom: '2026-12-01',
      fromPence: 50000,
      toPence: 60000,
    });
  });

  it('says nothing about a variable commitment, whose amount always moves', () => {
    const energy = commitment({
      kind: 'variable',
      amounts: amounts(['2026-01-01', 12000], ['2027-10-01', 14000]),
    });
    expect(nextAmountChange(energy, TODAY)).toBeNull();
  });

  it('is null when nothing is scheduled after today', () => {
    expect(nextAmountChange(commitment(), TODAY)).toBeNull();
    // A change taking effect today is already in force, so it is no longer news.
    const todayRise = commitment({
      amounts: amounts(['2026-01-01', 50000], ['2026-09-19', 60000]),
    });
    expect(nextAmountChange(todayRise, TODAY)).toBeNull();
  });

  it('treats a first amount in the future as a start, not a change', () => {
    const newDeal = commitment({ amounts: amounts(['2026-11-01', 50000]) });
    expect(nextAmountChange(newDeal, TODAY)).toBeNull();
  });

  it('ignores a change that lands after the commitment has ended', () => {
    const leaving = commitment({
      endedOn: '2027-06-30',
      amounts: amounts(['2026-01-01', 50000], ['2027-10-01', 70000]),
    });
    expect(nextAmountChange(leaving, TODAY)).toBeNull();
  });
});
