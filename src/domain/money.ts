/**
 * Money is stored and computed as integer pence to avoid floating-point
 * rounding errors (0.1 + 0.2 !== 0.3). Only format at the edges.
 */

/** Upper bound for a single amount: £1,000,000. Guards against typos like "2850000". */
export const MAX_AMOUNT_PENCE = 100_000_000;

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const gbpWhole = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `28550` → `"£285.50"` */
export function formatPence(pence: number): string {
  return gbp.format(pence / 100);
}

/** Drops the pence when they are zero: `28500` → `"£285"`, `28550` → `"£285.50"`. */
export function formatPenceShort(pence: number): string {
  return pence % 100 === 0 ? gbpWhole.format(pence / 100) : formatPence(pence);
}

/** Compact label for chart axes: `123456` → `"£1.2k"`. */
export function formatPenceCompact(pence: number): string {
  const pounds = pence / 100;
  if (Math.abs(pounds) >= 1000) {
    const thousands = pounds / 1000;
    const digits = Math.abs(thousands) >= 100 ? 0 : 1;
    return `£${stripTrailingZero(thousands.toFixed(digits))}k`;
  }
  return gbpWhole.format(Math.round(pounds));
}

function stripTrailingZero(value: string): string {
  return value.endsWith('.0') ? value.slice(0, -2) : value;
}

/**
 * Parses a pounds amount typed by a person into pence.
 * Accepts `285`, `285.5`, `£1,234.56`, `12,50` (comma decimal) and `50p`.
 * Returns `null` for anything that is not a positive amount within range.
 */
export function parseAmountToPence(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (text === '') return null;

  const penceOnly = /^(\d+)(?:p|pence)$/.exec(text);
  if (penceOnly) {
    return validPence(Number(penceOnly[1]));
  }

  const match = /^£?(\d{1,3}(?:,\d{3})+|\d+)?(?:[.,](\d{1,2}))?$/.exec(text);
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;

  const pounds = Number((match[1] ?? '0').replace(/,/g, ''));
  const pence = match[2] === undefined ? 0 : Number(match[2].padEnd(2, '0'));
  return validPence(pounds * 100 + pence);
}

/**
 * Parses an amount as the Wallet "Transaction" automation passes it: formatted
 * text such as `"£3.50"`, `"£1,234.56"` or `"€12.00"`. `foreign` is true when
 * the amount is not in pounds, so the caller can flag it. Refunds (negative
 * amounts) and zero return `null`.
 */
export function parseWalletAmount(text: string): { pence: number; foreign: boolean } | null {
  const trimmed = text.trim();
  if (/[-−]/.test(trimmed)) return null;
  const withoutCode = trimmed.replace(/gbp/gi, '');
  const pence = parseAmountToPence(withoutCode.replace(/[^\d.,]/g, ''));
  return pence === null ? null : { pence, foreign: /[^\d\s.,£]/.test(withoutCode) };
}

function validPence(pence: number): number | null {
  return Number.isInteger(pence) && pence > 0 && pence <= MAX_AMOUNT_PENCE ? pence : null;
}

/** Formats pence for an editable text field: `28550` → `"285.50"`, `28500` → `"285"`. */
export function penceToInputValue(pence: number): string {
  const pounds = Math.floor(pence / 100);
  const rest = pence % 100;
  return rest === 0 ? String(pounds) : `${pounds}.${String(rest).padStart(2, '0')}`;
}
