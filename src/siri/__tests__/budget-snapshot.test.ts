import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/db/schema';
import type { Category } from '@/db/types';
import { CALENDAR_MONTHS, type PaydayRule, periodFor } from '@/domain/period';

import { buildSnapshot, forecastNudge, SNAPSHOT_VERSION } from '../budget-snapshot';

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
    rules: [{ words: 'shell', categoryId: idOf('Eating out') }],
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

  it('publishes what the app has learned, for Swift to check first', () => {
    const eatingOut = build().categories.find((c) => c.name === 'Eating out')!;
    expect(eatingOut.learned).toEqual([['shell']]);
    expect(build().categories.find((c) => c.name === 'Bills')!.learned).toEqual([]);
  });

  it('says where the period is heading', () => {
    // £371 over 19 days is £19.53 a day; 11 days to come, plus £64 of fees.
    expect(build().forecastPence).toBe(64979);
  });

  it('follows payday periods', () => {
    const snapshot = build({ kind: 'day', day: 25, weekendAdjust: false });
    expect(snapshot.noun).toBe('period');
    expect(snapshot.period.start).toBe('2026-09-25');
    expect(snapshot.next.start).toBe('2026-10-25');
  });
});

describe('forecastNudge', () => {
  // The period ends on 30 September, so the warning lands on the 27th.
  const heading = () => ({ ...build(), monthlyLimitPence: 50000 });

  it('warns a few days before the period ends', () => {
    expect(forecastNudge(heading())).toEqual({
      body: 'On pace to finish £149.79 over, with £64.00 of fees still to come out.',
      at: new Date(2026, 8, 27, 10, 0, 0, 0),
    });
  });

  it('says nothing when the pace is fine', () => {
    expect(forecastNudge(build())).toBeNull();
  });

  it('says nothing with notifications turned off', () => {
    expect(forecastNudge({ ...heading(), paymentAlerts: false })).toBeNull();
  });

  it('says nothing once that day has passed', () => {
    const late = { ...heading(), generatedAt: new Date(2026, 8, 29).toISOString() };
    expect(forecastNudge(late)).toBeNull();
  });
});
