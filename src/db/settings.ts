/**
 * Small key/value settings, stored as text so new settings never need a
 * migration. Each getter falls back to the default when the row is missing or
 * unreadable, so a bad value can never stop the app from starting.
 */
import { CALENDAR_MONTHS, type PaydayRule } from '@/domain/period';

import type { Db } from './types';

const PAYDAY_KEY = 'payday-rule';
const PAYMENT_ALERTS_KEY = 'payment-alerts';

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** Reads a stored payday rule, ignoring anything that is not a rule we understand. */
export function parsePaydayRule(value: string | null): PaydayRule {
  if (value === null) return CALENDAR_MONTHS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return CALENDAR_MONTHS;
  }
  if (typeof parsed !== 'object' || parsed === null) return CALENDAR_MONTHS;

  const { kind, day, weekendAdjust } = parsed as Record<string, unknown>;
  if (kind === 'lastWorkingDay') return { kind: 'lastWorkingDay' };
  if (kind === 'day' && typeof day === 'number' && Number.isInteger(day) && day >= 1 && day <= 31) {
    return { kind: 'day', day, weekendAdjust: weekendAdjust === true };
  }
  return CALENDAR_MONTHS;
}

export async function getPaydayRule(db: Db): Promise<PaydayRule> {
  return parsePaydayRule(await getSetting(db, PAYDAY_KEY));
}

export async function setPaydayRule(db: Db, rule: PaydayRule): Promise<void> {
  await setSetting(db, PAYDAY_KEY, JSON.stringify(rule));
}

/** Whether Apple Pay payments announce themselves with a notification. */
export async function getPaymentAlerts(db: Db): Promise<boolean> {
  return (await getSetting(db, PAYMENT_ALERTS_KEY)) === 'on';
}

export async function setPaymentAlerts(db: Db, enabled: boolean): Promise<void> {
  await setSetting(db, PAYMENT_ALERTS_KEY, enabled ? 'on' : 'off');
}
