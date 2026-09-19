import { describe, expect, it } from '@jest/globals';

import {
  addDays,
  currentMonthKey,
  daysInMonth,
  daysRemainingInMonth,
  formatDayHeading,
  formatMonth,
  fromIsoDate,
  isMonthKey,
  monthKeyOf,
  monthRange,
  monthsEndingAt,
  samePeriodLastMonth,
  shiftMonth,
  toIsoDate,
} from '../dates';

describe('iso dates', () => {
  it('formats local dates without time zone drift', () => {
    expect(toIsoDate(new Date(2026, 8, 19, 23, 59))).toBe('2026-09-19');
    expect(toIsoDate(new Date(2026, 0, 1, 0, 0))).toBe('2026-01-01');
  });

  it('parses iso dates as local dates', () => {
    const date = fromIsoDate('2026-03-29');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 29]);
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });
});

describe('months', () => {
  it('derives the month of a date', () => {
    expect(monthKeyOf('2026-09-19')).toBe('2026-09');
    expect(currentMonthKey(new Date(2026, 8, 19))).toBe('2026-09');
  });

  it('validates month keys', () => {
    expect(isMonthKey('2026-09')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-9')).toBe(false);
  });

  it('shifts months across years', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', -21)).toBe('2024-12');
  });

  it('returns an exclusive range for queries', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth('2026-09')).toBe(30);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-02')).toBe(28);
  });

  it('lists trailing months oldest first', () => {
    expect(monthsEndingAt('2026-02', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('finds the matching stretch of last month', () => {
    expect(samePeriodLastMonth(new Date(2026, 8, 19))).toEqual({
      start: '2026-08-01',
      end: '2026-08-20',
    });
    expect(samePeriodLastMonth(new Date(2026, 2, 31))).toEqual({
      start: '2026-02-01',
      end: '2026-03-01',
    });
    expect(samePeriodLastMonth(new Date(2026, 0, 5))).toEqual({
      start: '2025-12-01',
      end: '2025-12-06',
    });
  });

  it('counts the days left including today', () => {
    const today = new Date(2026, 8, 19);
    expect(daysRemainingInMonth('2026-09', today)).toBe(12);
    expect(daysRemainingInMonth('2026-10', today)).toBe(31);
    expect(daysRemainingInMonth('2026-08', today)).toBeNull();
  });
});

describe('labels', () => {
  it('names months', () => {
    expect(formatMonth('2026-09')).toBe('September 2026');
  });

  it('uses relative day headings', () => {
    const today = new Date(2026, 8, 19);
    expect(formatDayHeading('2026-09-19', today)).toBe('Today');
    expect(formatDayHeading('2026-09-18', today)).toBe('Yesterday');
    expect(formatDayHeading('2026-09-15', today)).toMatch(/^Tue,? 15 Sep/);
  });
});
