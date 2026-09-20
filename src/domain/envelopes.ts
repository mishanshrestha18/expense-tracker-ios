/**
 * Envelope budgeting. A category limit stops being a fresh allowance every
 * period and becomes the category's own money: whatever an envelope does not
 * spend is still waiting in it next period, and an overspend is a debt the
 * next period has to pay off before anything else. Pure functions over
 * integer pence; what is carried is always signed.
 */
import { formatPence } from './money';

/**
 * The limit a category actually has this period: its budget plus what it
 * carried in. `null` without a budget. Never below 0, because a debt larger
 * than the budget leaves nothing to spend rather than a limit to spend past.
 */
export function envelopeLimit(basePence: number | null, carriedInPence: number): number | null {
  if (basePence === null) return null;
  return Math.max(0, basePence + carriedInPence);
}

/**
 * What the category carries out of a finished period: limit + carried in -
 * spent. `null` without a budget. Measured against the budget rather than the
 * clamped limit, so a debt is paid down by the full budget even when it wiped
 * the envelope out.
 */
export function nextCarry(
  basePence: number | null,
  carriedInPence: number,
  spentPence: number,
): number | null {
  if (basePence === null) return null;
  return basePence + carriedInPence - spentPence;
}

/** `"£30 carried in"` / `"£12 owed from last month"`; `null` when nothing is carried. */
export function describeCarry(carriedInPence: number, noun: string): string | null {
  if (carriedInPence === 0) return null;
  return carriedInPence > 0
    ? `${formatPence(carriedInPence)} carried in`
    : `${formatPence(-carriedInPence)} owed from last ${noun}`;
}
