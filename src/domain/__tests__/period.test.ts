import { describe, expect, it } from '@jest/globals';

import { monthRange } from '../dates';
import {
  CALENDAR_MONTHS,
  currentPeriodKey,
  daysInPeriod,
  daysRemainingInPeriod,
  describePaydayRule,
  formatPeriodRange,
  type PaydayRule,
  periodElapsed,
  periodFor,
  periodKeyOf,
  periodsEndingAt,
  samePointLastPeriod,
} from '../period';

const payday25: PaydayRule = { kind: 'day', day: 25, weekendAdjust: false };
const payday25Adjusted: PaydayRule = { kind: 'day', day: 25, weekendAdjust: true };
const lastWorkingDay: PaydayRule = { kind: 'lastWorkingDay' };

describe('periodFor', () => {
  it('matches calendar months by default', () => {
    expect(periodFor('2026-09', CALENDAR_MONTHS)).toEqual({
      key: '2026-09',
      ...monthRange('2026-09'),
    });
  });

  it('runs from payday to the day before the next one', () => {
    expect(periodFor('2026-09', payday25)).toEqual({
      key: '2026-09',
      start: '2026-09-25',
      end: '2026-10-25',
    });
  });

  it('moves a weekend payday back to the Friday before', () => {
    // 25 October 2026 is a Sunday, 25 September a Friday.
    expect(periodFor('2026-09', payday25Adjusted)).toEqual({
      key: '2026-09',
      start: '2026-09-25',
      end: '2026-10-23',
    });
  });

  it('clamps a payday past the end of a short month', () => {
    const rule: PaydayRule = { kind: 'day', day: 31, weekendAdjust: false };
    expect(periodFor('2026-02', rule)).toEqual({
      key: '2026-02',
      start: '2026-02-28',
      end: '2026-03-31',
    });
  });

  it('uses the last working day of the month', () => {
    // 31 October 2026 is a Saturday, so payday is Friday the 30th.
    expect(periodFor('2026-10', lastWorkingDay)).toEqual({
      key: '2026-10',
      start: '2026-10-30',
      end: '2026-11-30',
    });
  });
});

describe('periodKeyOf', () => {
  it.each([
    ['2026-09-24', '2026-08'],
    ['2026-09-25', '2026-09'],
    ['2026-10-24', '2026-09'],
    ['2026-10-25', '2026-10'],
  ])('puts %s in period %s', (date, key) => {
    expect(periodKeyOf(date, payday25)).toBe(key);
  });

  it('is the calendar month when periods are calendar months', () => {
    expect(periodKeyOf('2026-09-24', CALENDAR_MONTHS)).toBe('2026-09');
  });

  it('reads the current period from today', () => {
    expect(currentPeriodKey(payday25, new Date(2026, 8, 24))).toBe('2026-08');
    expect(currentPeriodKey(payday25, new Date(2026, 8, 25))).toBe('2026-09');
  });
});

describe('lengths and progress', () => {
  const period = periodFor('2026-09', payday25); // 25 Sep – 24 Oct, 30 days

  it('counts the days in a period', () => {
    expect(daysInPeriod(period)).toBe(30);
    expect(daysInPeriod(periodFor('2026-09', CALENDAR_MONTHS))).toBe(30);
    expect(daysInPeriod(periodFor('2026-10', CALENDAR_MONTHS))).toBe(31);
  });

  it.each([
    [new Date(2026, 8, 25), 30],
    [new Date(2026, 9, 24), 1],
  ])('counts the days left including today', (today, expected) => {
    expect(daysRemainingInPeriod(period, today)).toBe(expected);
  });

  it('has no days left once the period is over', () => {
    expect(daysRemainingInPeriod(period, new Date(2026, 9, 25))).toBeNull();
  });

  it('counts a future period as untouched', () => {
    expect(daysRemainingInPeriod(period, new Date(2026, 8, 1))).toBe(30);
  });

  it('measures how much of the period has gone', () => {
    expect(periodElapsed(period, new Date(2026, 8, 25))).toBeCloseTo(1 / 30);
    expect(periodElapsed(period, new Date(2026, 9, 24))).toBe(1);
    expect(periodElapsed(period, new Date(2026, 9, 25))).toBeNull();
  });
});

describe('samePointLastPeriod', () => {
  it('covers the same number of days in the previous period', () => {
    // Five days into 25 Sep – 24 Oct, so 25–29 August.
    expect(samePointLastPeriod('2026-09', payday25, new Date(2026, 8, 29))).toEqual({
      start: '2026-08-25',
      end: '2026-08-30',
    });
  });

  it('never runs past the end of the previous period', () => {
    expect(samePointLastPeriod('2026-03', CALENDAR_MONTHS, new Date(2026, 2, 31))).toEqual({
      start: '2026-02-01',
      end: '2026-03-01',
    });
  });
});

describe('periodsEndingAt', () => {
  it('returns the periods oldest first', () => {
    const periods = periodsEndingAt('2026-09', 3, payday25);
    expect(periods.map((p) => p.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(periods[0].start).toBe('2026-07-25');
  });
});

describe('labels', () => {
  it('describes a period by its dates', () => {
    expect(formatPeriodRange(periodFor('2026-09', payday25))).toBe('25 Sept – 24 Oct');
  });

  it.each([
    [CALENDAR_MONTHS, 'Calendar months'],
    [payday25, 'From the 25th of the month'],
    [{ kind: 'day', day: 1, weekendAdjust: false } as PaydayRule, 'From the 1st of the month'],
    [{ kind: 'day', day: 2, weekendAdjust: false } as PaydayRule, 'From the 2nd of the month'],
    [{ kind: 'day', day: 3, weekendAdjust: false } as PaydayRule, 'From the 3rd of the month'],
    [lastWorkingDay, 'From the last working day of the month'],
  ])('describes a rule', (rule, expected) => {
    expect(describePaydayRule(rule)).toBe(expected);
  });
});
