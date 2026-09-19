/**
 * Picks a category for an Apple Pay payment from the merchant's name, e.g.
 * "TESCO STORES 3021" → Groceries or "Pret A Manger" → Eating out. It uses each
 * category's name and aliases (the same words the quick-add bar understands)
 * plus the common UK chains below.
 */
import { type CategoryMatcher, matchCategory } from './quick-add';

/** Chains that are not already aliases in `DEFAULT_CATEGORIES`, keyed by category name. */
const MERCHANT_HINTS: Readonly<Record<string, readonly string[]>> = {
  Groceries: ['iceland', 'spar', 'costco', 'farmfoods', 'nisa', 'budgens', 'one stop'],
  'Eating out': [
    'pret',
    'costa',
    'starbucks',
    'caffe nero',
    'greggs',
    'mcdonalds',
    'kfc',
    'burger king',
    'subway',
    'nandos',
    'wagamama',
    'dominos',
    'pizza',
    'wetherspoon',
  ],
  Transport: [
    'tfl',
    'trainline',
    'national rail',
    'bolt',
    'addison lee',
    'shell',
    'bp',
    'esso',
    'texaco',
  ],
  Bills: ['ee', 'vodafone', 'o2', 'bt', 'virgin media', 'octopus energy', 'british gas', 'edf'],
  Shopping: ['primark', 'argos', 'john lewis', 'ikea', 'currys', 'tk maxx', 'uniqlo', 'ebay'],
  Entertainment: ['odeon', 'vue', 'cineworld', 'ticketmaster', 'steam', 'playstation', 'xbox'],
  Health: ['superdrug', 'puregym', 'gym group', 'specsavers'],
};

/** The best category for a merchant, or `null` when nothing matches. */
export function categoriseMerchant(
  merchant: string,
  categories: readonly CategoryMatcher[],
): number | null {
  const matchers = categories.map((category) => ({
    ...category,
    aliases: [...category.aliases, ...(MERCHANT_HINTS[category.name] ?? [])],
  }));
  const text = merchant
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // "Caffè" → "Caffe"
    .replace(/[&*/+.]/g, ' '); // Card statements join words with symbols: "UBER *TRIP".
  return matchCategory(text, matchers);
}
