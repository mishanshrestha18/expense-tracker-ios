import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/db/schema';

import { categoriseMerchant, matchersWithRules } from '../merchant';
import type { CategoryMatcher } from '../quick-add';

const categories: CategoryMatcher[] = DEFAULT_CATEGORIES.map((c, i) => ({
  id: i + 1,
  name: c.name,
  aliases: c.aliases,
}));
const nameOf = (id: number | null) => categories.find((c) => c.id === id)?.name ?? null;

describe('categoriseMerchant', () => {
  it.each([
    ['TESCO STORES 3021', 'Groceries'],
    ["Sainsbury's", 'Groceries'],
    ['SAINSBURYS S/MKTS', 'Groceries'],
    ['Pret A Manger', 'Eating out'],
    ['Caffè Nero', 'Eating out'],
    ["McDonald's", 'Eating out'],
    ['UBER *EATS', 'Eating out'],
    ['UBER *TRIP', 'Transport'],
    ['TfL Travel Charge', 'Transport'],
    ['BP CONNECT', 'Transport'],
    ['Boots', 'Health'],
    ['AMAZON.CO.UK', 'Shopping'],
    ['Vue Cinemas', 'Entertainment'],
  ])('files %s under %s', (merchant, category) => {
    expect(nameOf(categoriseMerchant(merchant, categories))).toBe(category);
  });

  it('returns null for a merchant it does not know', () => {
    expect(categoriseMerchant('Blue Door Ltd', categories)).toBeNull();
  });

  it("uses the category's own aliases", () => {
    const custom = [{ id: 42, name: 'Pets', aliases: ['pets at home'] }];
    expect(categoriseMerchant('PETS AT HOME 123', custom)).toBe(42);
  });
});

describe('what the app has learned', () => {
  const eatingOut = categories.find((c) => c.name === 'Eating out')!.id;

  it('beats the built-in word lists', () => {
    // "Shell" is a petrol station to the lists, but this person buys coffee there.
    expect(nameOf(categoriseMerchant('SHELL 4021', categories))).toBe('Transport');
    expect(
      categoriseMerchant('SHELL 4021', categories, [{ words: 'shell', categoryId: eatingOut }]),
    ).toBe(eatingOut);
  });

  it('is offered to the quick-add parser as another word for the category', () => {
    const matchers = matchersWithRules(categories, [{ words: 'shell', categoryId: eatingOut }]);
    expect(matchers.find((c) => c.id === eatingOut)?.aliases).toContain('shell');
    expect(matchers.find((c) => c.name === 'Groceries')?.aliases).toContain('tesco');
  });
});
