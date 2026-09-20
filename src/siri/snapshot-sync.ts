import { File, Paths } from 'expo-file-system';

import type { Db } from '@/db/types';
import type { PaydayRule } from '@/domain/period';

import { cancelBudgetAlert, scheduleBudgetAlert } from '@/native/expenses-native';

import { forecastNudge, readBudgetSnapshot } from './budget-snapshot';

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

  // One nudge before payday, rebooked whenever the outlook changes.
  const nudge = forecastNudge(snapshot);
  if (nudge) await scheduleBudgetAlert(nudge.body, nudge.at);
  else cancelBudgetAlert();
}
