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

/** A category the person has chosen by hand for a shop, remembered for next time. */
export interface LearnedRule {
  /** Normalised words of the shop name, e.g. `"shell"`. */
  words: string;
  categoryId: number;
}

/** Shop names arrive shouty and punctuated: "UBER *TRIP", "SAINSBURY'S". */
function tidy(merchant: string): string {
  return merchant
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // "Caffè" → "Caffe"
    .replace(/[&*/+.]/g, ' '); // Card statements join words with symbols.
}

/** Every phrase that points at a category: its name, its aliases and the chains above. */
export function matchPhrasesFor(category: CategoryMatcher): string[] {
  return [category.name, ...category.aliases, ...(MERCHANT_HINTS[category.name] ?? [])];
}

/**
 * The best category for a merchant, or `null` when nothing matches. Anything
 * the person has corrected before wins over the built-in lists.
 */
export function categoriseMerchant(
  merchant: string,
  categories: readonly CategoryMatcher[],
  rules: readonly LearnedRule[] = [],
): number | null {
  const text = tidy(merchant);

  const learned = matchCategory(
    text,
    rules.map((rule) => ({ id: rule.categoryId, name: '', aliases: [rule.words] })),
  );
  if (learned !== null) return learned;

  return matchCategory(text, withHints(categories));
}

function withHints<T extends CategoryMatcher>(categories: readonly T[]): T[] {
  return categories.map((category) => ({
    ...category,
    aliases: [...category.aliases, ...(MERCHANT_HINTS[category.name] ?? [])],
  }));
}

/** Categories for the quick-add parser, including what the app has learned. */
export function matchersWithRules<T extends CategoryMatcher>(
  categories: readonly T[],
  rules: readonly LearnedRule[],
): T[] {
  const byCategory = new Map<number, string[]>();
  for (const rule of rules) {
    byCategory.set(rule.categoryId, [...(byCategory.get(rule.categoryId) ?? []), rule.words]);
  }
  return withHints(categories).map((category) => ({
    ...category,
    aliases: [...(byCategory.get(category.id) ?? []), ...category.aliases],
  }));
}
