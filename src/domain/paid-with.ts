/**
 * How an expense was paid for. Bank apps only ever see cards, so recording
 * cash here is what lets one app show everything that was spent.
 */
import { formatPenceShort } from './money';

export type PaidWith = '' | 'cash' | 'card' | 'apple-pay';

export const PAID_WITH_VALUES: readonly PaidWith[] = ['', 'cash', 'card', 'apple-pay'];

const LABELS: Record<PaidWith, string> = {
  '': 'Not recorded',
  cash: 'Cash',
  card: 'Card',
  'apple-pay': 'Apple Pay',
};

export function paidWithLabel(value: PaidWith): string {
  return LABELS[value] ?? LABELS[''];
}

export function isPaidWith(value: string): value is PaidWith {
  return (PAID_WITH_VALUES as readonly string[]).includes(value);
}

export interface PaidWithTotal {
  paidWith: PaidWith;
  totalPence: number;
}

/**
 * `"£120 cash · £860 card"`, counting Apple Pay as card. `undefined` when
 * nothing was recorded, so the interface can leave the line out.
 */
export function paidWithSummary(totals: readonly PaidWithTotal[]): string | undefined {
  let cashPence = 0;
  let cardPence = 0;
  for (const { paidWith, totalPence } of totals) {
    if (paidWith === 'cash') cashPence += totalPence;
    else if (paidWith === 'card' || paidWith === 'apple-pay') cardPence += totalPence;
  }
  const parts: string[] = [];
  if (cashPence > 0) parts.push(`${formatPenceShort(cashPence)} cash`);
  if (cardPence > 0) parts.push(`${formatPenceShort(cardPence)} card`);
  return parts.length === 0 ? undefined : parts.join(' · ');
}
