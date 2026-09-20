import { describe, expect, it } from '@jest/globals';

import type { SavingsEntry, SavingsEntryKind } from '@/db/types';

import type { MonthKey } from '../dates';
import { CALENDAR_MONTHS, type PaydayRule } from '../period';
import { carryPence, periodsToClose, summariseSavings } from '../savings';

/** 19 September 2026: the day every test pretends it is. */
const TODAY = new Date(2026, 8, 19);
const payday25: PaydayRule = { kind: 'day', day: 25, weekendAdjust: false };

let nextId = 0;

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

const keysOf = (periods: readonly { key: MonthKey }[]) => periods.map((p) => p.key);

describe('carryPence', () => {
  it('rolls what a period did not spend into savings', () => {
    expect(carryPence(160000, 142350)).toBe(17650);
  });

  it('takes money back out when the period went over', () => {
    expect(carryPence(160000, 171000)).toBe(-11000);
  });

  it('has nothing to measure without a budget', () => {
    expect(carryPence(null, 142350)).toBeNull();
    expect(carryPence(0, 142350)).toBeNull();
  });
});

describe('summariseSavings', () => {
  it('separates the carries from the money moved by hand', () => {
    const summary = summariseSavings([
      entry('carry', 12000, '2026-06'),
      entry('carry', -4500, '2026-07'),
      entry('carry', 8000, '2026-08'),
      entry('adjustment', 20000),
      entry('adjustment', -5000),
    ]);

    expect(summary).toEqual({
      balancePence: 30500,
      carriedPence: 15500,
      addedPence: 20000,
      takenPence: 5000,
      periodsCounted: 3,
    });
  });

  it('is all zeroes with nothing saved yet', () => {
    expect(summariseSavings([])).toEqual({
      balancePence: 0,
      carriedPence: 0,
      addedPence: 0,
      takenPence: 0,
      periodsCounted: 0,
    });
  });
});

describe('periodsToClose', () => {
  it('offers the finished periods oldest first when none are closed', () => {
    const periods = periodsToClose([], CALENDAR_MONTHS, TODAY, 3);

    expect(keysOf(periods)).toEqual(['2026-06', '2026-07', '2026-08']);
    expect(periods[2]).toEqual({ key: '2026-08', start: '2026-08-01', end: '2026-09-01' });
  });

  it('only offers the gap after the newest period already closed', () => {
    const closed = ['2026-04', '2026-05', '2026-06'];
    expect(keysOf(periodsToClose(closed, CALENDAR_MONTHS, TODAY))).toEqual(['2026-07', '2026-08']);
  });

  it('never offers the period in progress', () => {
    expect(keysOf(periodsToClose([], CALENDAR_MONTHS, TODAY))).not.toContain('2026-09');
    expect(periodsToClose(['2026-08'], CALENDAR_MONTHS, TODAY)).toEqual([]);
  });

  it('goes back no further than the limit', () => {
    expect(keysOf(periodsToClose([], CALENDAR_MONTHS, TODAY, 1))).toEqual(['2026-08']);
    expect(periodsToClose([], CALENDAR_MONTHS, TODAY, 0)).toEqual([]);

    // The default stops two years back rather than at the start of time.
    const all = periodsToClose([], CALENDAR_MONTHS, TODAY);
    expect(all).toHaveLength(24);
    expect(keysOf(all)[0]).toBe('2024-09');
  });

  it('follows payday periods, not calendar months', () => {
    // On the 19th the period that started on 25 August is still running, so
    // the newest one there is to close is July's.
    const periods = periodsToClose([], payday25, TODAY, 2);

    expect(keysOf(periods)).toEqual(['2026-06', '2026-07']);
    expect(periods[1]).toEqual({ key: '2026-07', start: '2026-07-25', end: '2026-08-25' });
  });
});
