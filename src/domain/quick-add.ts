/**
 * Parses free text like "285 groceries", "£4.20 coffee yesterday",
 * "record 285 pounds 50 in groceries" or "a fiver on coffee" into a
 * structured expense.
 *
 * The same parser powers the quick-add bar today and will back Siri /
 * Shortcuts dictation later, so it is deliberately pure and exhaustively tested.
 */
import { addDays, type IsoDate, toIsoDate } from './dates';
import { MAX_AMOUNT_PENCE } from './money';
import type { PaidWith } from './paid-with';

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
      /** `''` unless the text said how it was paid, e.g. "a fiver cash". */
      paidWith: PaidWith;
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
/** "a fiver" is one amount: the article belongs to the money, not to the note. */
const ARTICLES = new Set(['a', 'an']);

/** Spoken whole numbers up to ninety-nine; anything bigger needs a scale word. */
const NUMBER_WORDS = new Map<string, number>([
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
]);

/** Multipliers. "grand" is slang, so saying it also means the number is money. */
const SCALE_WORDS = new Map<string, { multiplier: number; slang: boolean }>([
  ['hundred', { multiplier: 100, slang: false }],
  ['thousand', { multiplier: 1000, slang: false }],
  ['grand', { multiplier: 1000, slang: true }],
]);

/** Slang that names a whole amount on its own, in pence. */
const SLANG_AMOUNTS = new Map<string, number>([
  ['fiver', 500],
  ['tenner', 1000],
  ['ton', 10_000],
]);
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

/** Words that say how something was paid for, which never belong in the note. */
const PAID_WITH_WORDS = new Map<string, PaidWith>([
  ['cash', 'cash'],
  ['card', 'card'],
  ['contactless', 'card'],
  ['applepay', 'apple-pay'],
]);

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

  // "apple pay" is two words; join them so it matches like any other word.
  let paidWith: PaidWith = '';
  tokens.forEach((token, index) => {
    const pair = token.word === 'apple' && tokens[index + 1]?.word === 'pay' ? 'applepay' : null;
    const match = PAID_WITH_WORDS.get(pair ?? token.word);
    if (match === undefined) return;
    paidWith = match;
    used.add(index);
    if (pair) used.add(index + 1);
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
    paidWith,
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
    const amount = amountAt(tokens, i) ?? spokenAmountAt(tokens, i);
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
 * The pence part after a pounds amount. A bare number ("285 pounds 50",
 * "twelve pounds fifty") only counts when "pounds" was said; after a £ sign it
 * needs an explicit "p", so "£20 3 coffees" is not misread as £20.03.
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
  const part = pencePartAt(tokens, i);
  if (!part) return null;
  indices.push(...indexRange(i, part.end));
  const penceWordFollows = PENCE_WORDS.has(tokens[part.end + 1]?.word ?? '');
  if (penceWordFollows) indices.push(part.end + 1);
  const explicitPence = part.suffixed || penceWordFollows;
  if (!explicitPence && !allowBareNumber) return null;
  return { pence: part.value, indices };
}

/** The pence half of "£3 and 50p" or "twelve pounds fifty": `50`, `50p`, "fifty". */
function pencePartAt(
  tokens: Token[],
  i: number,
): { value: number; end: number; suffixed: boolean } | null {
  const digits = /^(\d{1,2})(p)?$/.exec(tokens[i]?.word ?? '');
  if (digits) return { value: Number(digits[1]), end: i, suffixed: digits[2] !== undefined };
  const spoken = spokenNumberAt(tokens, i);
  return spoken && !spoken.slang && spoken.value >= 1 && spoken.value <= 99
    ? { value: spoken.value, end: spoken.end, suffixed: false }
    : null;
}

interface SpokenNumber {
  /** Whole pounds, or a plain count when no money word is involved. */
  value: number;
  /** Index of the last token the number used. */
  end: number;
  /** Said as slang ("two grand"), wording that only ever means money. */
  slang: boolean;
}

/**
 * Money said out loud: "forty quid", "twelve pounds fifty", "a fiver",
 * "two grand", "2k". Dictation spells these as words, so they are as explicit
 * as "£5" and outrank a bare number elsewhere in the sentence. A plain spoken
 * number ("two coffees") stays as weak as the digit "2".
 */
function spokenAmountAt(tokens: Token[], i: number): AmountMatch | null {
  const slang = slangAmountAt(tokens, i);
  if (slang) return slang;

  const pounds = spokenNumberAt(tokens, i);
  if (!pounds) return null;
  const indices = indexRange(i, pounds.end);
  const nextWord = tokens[pounds.end + 1]?.word ?? '';

  if (PENCE_WORDS.has(nextWord)) {
    indices.push(pounds.end + 1);
    return withinRange({ pence: pounds.value, indices, explicit: true });
  }

  if (CURRENCY_WORDS.has(nextWord)) {
    indices.push(pounds.end + 1);
    const extra = trailingPence(tokens, pounds.end + 2, true);
    if (extra) indices.push(...extra.indices);
    return withinRange({
      pence: pounds.value * 100 + (extra?.pence ?? 0),
      indices,
      explicit: true,
    });
  }

  // "twelve fifty" is £12.50 in speech. Only a second number of its own counts
  // as pence, so "two hundred" (one number) stays £200.
  const pence = pounds.value < 100 && !pounds.slang ? spokenNumberAt(tokens, pounds.end + 1) : null;
  if (pence && !pence.slang && pence.value >= 10 && pence.value <= 99) {
    return withinRange({
      pence: pounds.value * 100 + pence.value,
      indices: [...indices, ...indexRange(pounds.end + 1, pence.end)],
      explicit: true,
    });
  }

  return withinRange({ pence: pounds.value * 100, indices, explicit: pounds.slang });
}

/** Wording that is only ever an amount: "a fiver", "tenner", "a ton", "2k". */
function slangAmountAt(tokens: Token[], i: number): AmountMatch | null {
  const thousands = /^(\d+(?:\.\d+)?)k$/.exec(tokens[i].word);
  if (thousands) {
    const pence = Math.round(Number(thousands[1]) * 100_000);
    return withinRange({ pence, indices: [i], explicit: true });
  }
  const start = ARTICLES.has(tokens[i].word) ? i + 1 : i;
  const pence = SLANG_AMOUNTS.get(tokens[start]?.word ?? '');
  if (pence === undefined) return null;
  return withinRange({ pence, indices: indexRange(i, start), explicit: true });
}

/**
 * Reads one spoken number, e.g. "forty", "twenty-five", "a hundred and twenty".
 * It stops where the number stops, so "twelve fifty" reads as two numbers and
 * the caller is free to treat the second one as pence.
 */
function spokenNumberAt(tokens: Token[], start: number): SpokenNumber | null {
  let thousands = 0;
  let group = 0;
  /** The largest value that may still join the group being built. */
  let openMax = Number.POSITIVE_INFINITY;
  let slang = false;
  let article = false;
  let end = -1;

  for (const part of numberParts(tokens, start)) {
    if (part.word === 'and') {
      if (end < 0 || openMax === 0) break; // "twelve and" is two thoughts, not one number.
      continue;
    }
    if (ARTICLES.has(part.word)) {
      if (end >= 0) break;
      article = true; // "a hundred" is one hundred.
      continue;
    }
    const scale = SCALE_WORDS.get(part.word);
    if (scale) {
      if (scale.multiplier === 100 ? group >= 100 : thousands > 0) break;
      const multiplier = group === 0 ? 1 : group;
      if (scale.multiplier === 100) {
        group = multiplier * 100;
        openMax = 99;
      } else {
        thousands = multiplier * 1000;
        group = 0;
        openMax = 999;
      }
      slang ||= scale.slang;
      end = part.index;
      continue;
    }
    const value = NUMBER_WORDS.get(part.word);
    if (value === undefined || value > openMax) break;
    group += value;
    // Only a unit may follow a ten ("twenty five"); nothing follows a unit.
    openMax = value >= 20 ? 9 : 0;
    end = part.index;
  }

  // "a quid" is one pound: with no number of its own, the article is the one.
  if (end < 0) {
    return article && CURRENCY_WORDS.has(tokens[start + 1]?.word ?? '')
      ? { value: 1, end: start, slang: false }
      : null;
  }
  return { value: thousands + group, end, slang };
}

interface NumberPart {
  word: string;
  /** The token it came from: "twenty-five" is one token but two words. */
  index: number;
}

/** The run of number words starting at `start`; a token is only ever taken whole. */
function numberParts(tokens: Token[], start: number): NumberPart[] {
  const parts: NumberPart[] = [];
  for (let index = start; index < tokens.length; index++) {
    const words = tokens[index].word.split('-');
    if (!words.every(isNumberWord)) break;
    parts.push(...words.map((word) => ({ word, index })));
  }
  return parts;
}

function isNumberWord(word: string): boolean {
  return NUMBER_WORDS.has(word) || SCALE_WORDS.has(word) || ARTICLES.has(word) || word === 'and';
}

function indexRange(from: number, to: number): number[] {
  const indices: number[] = [];
  for (let i = from; i <= to; i++) indices.push(i);
  return indices;
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

/**
 * A phrase reduced to the words the matcher compares, e.g. "Uber Eats" →
 * `["uber", "eat"]`. The Swift side matches merchants the same way.
 */
export function phraseWords(phrase: string): string[] {
  return splitWords(phrase).map(singular);
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
