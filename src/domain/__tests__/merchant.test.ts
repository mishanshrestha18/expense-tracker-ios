import { describe, expect, it } from '@jest/globals';

import { DEFAULT_CATEGORIES } from '@/db/schema';

import { categoriseMerchant } from '../merchant';
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
