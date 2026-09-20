import { File, Paths } from 'expo-file-system';

import type { Db } from '@/db/types';
import type { PaydayRule } from '@/domain/period';

import { setAlerts } from '@/native/expenses-native';
import { publishWidget } from '@/widget/publish';

import { alertsFor, readBudgetSnapshot } from './budget-snapshot';

/** Must match the file read by native/LogExpenseIntent.swift. */
const SNAPSHOT_FILE = 'budget-snapshot.json';

/**
 * Publishes the budget summary for the App Intents. Called after every change,
 * so what Siri says matches what the app shows.
 */
export async function publishBudgetSnapshot(
  db: Db,
  rule: PaydayRule,
  today: Date = new Date(),
): Promise<void> {
  const snapshot = await readBudgetSnapshot(db, rule, today);
  const file = new File(Paths.document, SNAPSHOT_FILE);
  if (!file.exists) file.create({ overwrite: true });
  file.write(JSON.stringify(snapshot));

  // Bills, price changes, the payday nudge and the Sunday summary, rebooked
  // whenever anything moves.
  await setAlerts(alertsFor(snapshot));

  // The Home Screen and Lock Screen widget, when one was built.
  publishWidget(snapshot);
}
