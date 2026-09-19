import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/db/schema';
import type { Category } from '@/db/types';
import { CALENDAR_MONTHS, type PaydayRule, periodFor } from '@/domain/period';

import { buildSnapshot, SNAPSHOT_VERSION } from '../budget-snapshot';

const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({
  id: i + 1,
  name: c.name,
  icon: c.icon,
  color: c.color,
  aliases: c.aliases,
  sortOrder: i,
}));
const idOf = (name: string) => categories.find((c) => c.name === name)!.id;

const build = (rule: PaydayRule = CALENDAR_MONTHS) =>
  buildSnapshot({
    categories,
    budgets: [{ categoryId: idOf('Eating out'), monthlyLimitPence: 20000 }],
    monthlyLimitPence: 160000,
    spending: [
      { categoryId: idOf('Eating out'), totalPence: 15900 },
      { categoryId: idOf('Groceries'), totalPence: 21200 },
    ],
    period: periodFor('2026-09', rule),
    next: periodFor('2026-10', rule),
    rule,
    upcomingPence: 6400,
    paymentAlerts: true,
    today: new Date(2026, 8, 19),
  });

describe('buildSnapshot', () => {
  it('summarises the period the intents need', () => {
    const snapshot = build();
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(snapshot.today).toBe('2026-09-19');
    expect(snapshot.noun).toBe('month');
    expect(snapshot.period).toEqual({
      key: '2026-09',
      start: '2026-09-01',
      end: '2026-10-01',
      label: 'September',
    });
    expect(snapshot.next.start).toBe('2026-10-01');
    expect(snapshot.monthlyLimitPence).toBe(160000);
    expect(snapshot.spentPence).toBe(37100);
    expect(snapshot.upcomingPence).toBe(6400);
    expect(snapshot.paymentAlerts).toBe(true);
  });

  it('carries each category with its limit and spending', () => {
    const eatingOut = build().categories.find((c) => c.name === 'Eating out');
    expect(eatingOut).toMatchObject({ limitPence: 20000, spentPence: 15900 });

    const bills = build().categories.find((c) => c.name === 'Bills');
    expect(bills).toMatchObject({ limitPence: null, spentPence: 0 });
  });

  it('publishes the words that match a shop name, ready for Swift', () => {
    const eatingOut = build().categories.find((c) => c.name === 'Eating out')!;
    // Lower case, singular, one entry per word: "Uber Eats" → ["uber", "eat"].
    expect(eatingOut.phrases).toContainEqual(['uber', 'eat']);
    expect(eatingOut.phrases).toContainEqual(['pret']);
    expect(eatingOut.phrases[0]).toEqual(['eating', 'out']);
    expect(eatingOut.phrases.every((words) => words.length > 0)).toBe(true);
  });

  it('follows payday periods', () => {
    const snapshot = build({ kind: 'day', day: 25, weekendAdjust: false });
    expect(snapshot.noun).toBe('period');
    expect(snapshot.period.start).toBe('2026-09-25');
    expect(snapshot.next.start).toBe('2026-10-25');
  });
});
