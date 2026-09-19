/**
 * Parses free text like "285 groceries", "£4.20 coffee yesterday" or
 * "record 285 pounds 50 in groceries" into a structured expense.
 *
 * The same parser powers the quick-add bar today and will back Siri /
 * Shortcuts dictation later, so it is deliberately pure and exhaustively tested.
 */
import { addDays, type IsoDate, toIsoDate } from './dates';
import { MAX_AMOUNT_PENCE } from './money';

export interface CategoryMatcher {
  id: number;
  name: string;
  /** Extra words that map to this category, e.g. "tesco" → Groceries. */
  aliases: readonly string[];
}

export type QuickAddResult =
  | {
      ok: true;
      amountPence: number;
      /** `null` when no category word was recognised — the UI asks the person to pick one. */
      categoryId: number | null;
      note: string;
      spentOn: IsoDate;
    }
  | { ok: false; reason: 'empty' | 'no-amount' };

interface Token {
  /** Original text, used when rebuilding the note. */
  raw: string;
  /** Lowercased text without apostrophes, used for matching. */
  word: string;
}

const CURRENCY_WORDS = new Set(['pound', 'pounds', 'quid', 'gbp']);
const PENCE_WORDS = new Set(['p', 'pence', 'penny']);
const LEADING_FILLER = new Set([
  'record',
  'add',
  'log',
  'spent',
  'spend',
  'paid',
  'pay',
  'i',
  'ive',
  'just',
  'bought',
  'expense',
  'and',
]);
const CONNECTORS = new Set(['in', 'on', 'for', 'to', 'at', 'into', 'under']);

export function parseQuickAdd(
  text: string,
  categories: readonly CategoryMatcher[],
  today: Date = new Date(),
): QuickAddResult {
  const tokens = tokenize(text);
  if (tokens.length === 0) return { ok: false, reason: 'empty' };

  const used = new Set<number>();

  const todayIso = toIsoDate(today);
  let spentOn = todayIso;
  tokens.forEach((token, index) => {
    if (token.word === 'yesterday') {
      spentOn = addDays(todayIso, -1);
      used.add(index);
    } else if (token.word === 'today') {
      used.add(index);
    }
  });

  const amount = findAmount(tokens, used);
  if (!amount) return { ok: false, reason: 'no-amount' };
  amount.indices.forEach((i) => used.add(i));

  const category = findCategory(tokens, used, categories);
  if (category) {
    // Drop the category's own name from the note ("groceries"), but keep
    // alias words that carry meaning ("coffee" → Eating out, note "Coffee").
    if (category.byName) category.indices.forEach((i) => used.add(i));
    const before = previousUnused(category.indices[0], used);
    if (before !== null && CONNECTORS.has(tokens[before].word)) used.add(before);
  }

  const noteTokens = tokens.filter((_, i) => !used.has(i));
  // Leading verbs ("record", "I spent") and dangling connectors are never a useful note.
  while (
    noteTokens.length > 0 &&
    (LEADING_FILLER.has(noteTokens[0].word) || CONNECTORS.has(noteTokens[0].word))
  ) {
    noteTokens.shift();
  }
  while (noteTokens.length > 0 && CONNECTORS.has(noteTokens[noteTokens.length - 1].word)) {
    noteTokens.pop();
  }

  return {
    ok: true,
    amountPence: amount.pence,
    categoryId: category?.id ?? null,
    note: capitalize(noteTokens.map((t) => t.raw).join(' ')),
    spentOn,
  };
}

/** The category a piece of text mentions by name or alias, e.g. "Tesco Express" → Groceries. */
export function matchCategory(text: string, categories: readonly CategoryMatcher[]): number | null {
  return findCategory(tokenize(text), new Set(), categories)?.id ?? null;
}

function tokenize(text: string): Token[] {
  return text
    .replace(/£\s+(?=\d)/g, '£') // "£ 285" → "£285"
    .split(/\s+/)
    .map((raw) => raw.replace(/^[,;:!?"(]+|[,;:!?")]+$/g, '').replace(/\.$/, ''))
    .filter((raw) => raw.length > 0)
    .map((raw) => ({ raw, word: raw.toLowerCase().replace(/[’']/g, '') }));
}

interface AmountMatch {
  pence: number;
  indices: number[];
  /** Written with £, "pounds" or "p" — preferred over bare numbers like "2 tickets". */
  explicit: boolean;
}

/** `£285`, `285£`, `285`, `12.50`, `1,234.56`, `50p`. */
const NUMBER_TOKEN = /^(£)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(p|£)?$/;

function findAmount(tokens: Token[], used: Set<number>): AmountMatch | null {
  let firstBare: AmountMatch | null = null;
  for (let i = 0; i < tokens.length; i++) {
    if (used.has(i)) continue;
    const amount = amountAt(tokens, i);
    if (!amount) continue;
    if (amount.explicit) return amount;
    firstBare ??= amount;
  }
  return firstBare;
}

function amountAt(tokens: Token[], i: number): AmountMatch | null {
  const match = NUMBER_TOKEN.exec(tokens[i].word);
  if (!match) return null;

  const [, leadingPound, whole, fraction, suffix] = match;
  const hasPoundSign = leadingPound !== undefined || suffix === '£';
  const value = Number(whole.replace(/,/g, ''));
  const indices = [i];
  const nextWord = tokens[i + 1]?.word ?? '';

  const penceWordFollows = PENCE_WORDS.has(nextWord);
  if (!hasPoundSign && fraction === undefined && (suffix === 'p' || penceWordFollows)) {
    if (penceWordFollows) indices.push(i + 1);
    return withinRange({ pence: value, indices, explicit: true });
  }

  let pence = value * 100 + (fraction === undefined ? 0 : Number(fraction.padEnd(2, '0')));
  const currencyWordFollows = CURRENCY_WORDS.has(nextWord);
  if (currencyWordFollows) indices.push(i + 1);

  // "285 pounds 50" / "£3 and 50p" → add the pence part.
  if ((currencyWordFollows || hasPoundSign) && fraction === undefined) {
    const extra = trailingPence(tokens, i + (currencyWordFollows ? 2 : 1), currencyWordFollows);
    if (extra) {
      pence += extra.pence;
      indices.push(...extra.indices);
    }
  }

  return withinRange({ pence, indices, explicit: hasPoundSign || currencyWordFollows });
}

function withinRange(amount: AmountMatch): AmountMatch | null {
  return amount.pence > 0 && amount.pence <= MAX_AMOUNT_PENCE ? amount : null;
}

/**
 * The pence part after a pounds amount. A bare number ("285 pounds 50") only
 * counts when "pounds" was said; after a £ sign it needs an explicit "p", so
 * "£20 3 coffees" is not misread as £20.03.
 */
function trailingPence(
  tokens: Token[],
  start: number,
  allowBareNumber: boolean,
): { pence: number; indices: number[] } | null {
  let i = start;
  const indices: number[] = [];
  if (tokens[i]?.word === 'and') {
    indices.push(i);
    i += 1;
  }
  const match = /^(\d{1,2})(p)?$/.exec(tokens[i]?.word ?? '');
  if (!match) return null;
  indices.push(i);
  const penceWordFollows = PENCE_WORDS.has(tokens[i + 1]?.word ?? '');
  if (penceWordFollows) indices.push(i + 1);
  const explicitPence = match[2] !== undefined || penceWordFollows;
  if (!explicitPence && !allowBareNumber) return null;
  return { pence: Number(match[1]), indices };
}

interface CategoryMatch {
  id: number;
  indices: number[];
  byName: boolean;
}

function findCategory(
  tokens: Token[],
  used: Set<number>,
  categories: readonly CategoryMatcher[],
): CategoryMatch | null {
  let best: (CategoryMatch & { length: number }) | null = null;

  for (const category of categories) {
    const phrases = [
      { words: splitWords(category.name), byName: true },
      ...category.aliases.map((alias) => ({ words: splitWords(alias), byName: false })),
    ];
    for (const phrase of phrases) {
      if (phrase.words.length === 0) continue;
      const start = findPhrase(tokens, used, phrase.words);
      if (start === null) continue;
      // Prefer the longest phrase; on ties, prefer an exact category name.
      const isBetter =
        best === null ||
        phrase.words.length > best.length ||
        (phrase.words.length === best.length && phrase.byName && !best.byName);
      if (isBetter) {
        best = {
          id: category.id,
          byName: phrase.byName,
          length: phrase.words.length,
          indices: phrase.words.map((_, k) => start + k),
        };
      }
    }
  }

  return best && { id: best.id, indices: best.indices, byName: best.byName };
}

function splitWords(phrase: string): string[] {
  return phrase
    .toLowerCase()
    .replace(/[’']/g, '')
    .split(/[\s&/]+/)
    .filter((w) => w.length > 0 && w !== 'and');
}

function findPhrase(tokens: Token[], used: Set<number>, words: string[]): number | null {
  for (let start = 0; start + words.length <= tokens.length; start++) {
    const matches = words.every((word, k) => {
      const index = start + k;
      return !used.has(index) && sameWord(tokens[index].word, word);
    });
    if (matches) return start;
  }
  return null;
}

/** Case-insensitive comparison that tolerates simple plurals (grocery ↔ groceries). */
function sameWord(a: string, b: string): boolean {
  return a === b || singular(a) === singular(b);
}

function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function previousUnused(index: number, used: Set<number>): number | null {
  for (let i = index - 1; i >= 0; i--) {
    if (!used.has(i)) return i;
  }
  return null;
}

function capitalize(text: string): string {
  return text.length === 0 ? text : text[0].toUpperCase() + text.slice(1);
}
