/**
 * The small Swift module in `native/ExpensesNative.swift`, which lives in the
 * same app as the App Intents. It is missing on web and in Expo Go, so every
 * call falls back to doing nothing.
 */
import { requireOptionalNativeModule } from 'expo';

interface ExpensesNativeModule {
  /** Asks for permission to post "payment added" notifications. */
  requestNotificationPermission(): Promise<boolean>;
  /** Books the one nudge before the period ends, replacing any earlier one. */
  scheduleBudgetAlert(body: string, atEpochSeconds: number): Promise<boolean>;
  cancelBudgetAlert(): void;
}

const native = requireOptionalNativeModule<ExpensesNativeModule>('ExpensesNative');

export async function requestPaymentAlerts(): Promise<boolean> {
  return (await native?.requestNotificationPermission()) ?? false;
}

export async function scheduleBudgetAlert(body: string, at: Date): Promise<void> {
  await native?.scheduleBudgetAlert(body, Math.floor(at.getTime() / 1000));
}

export function cancelBudgetAlert(): void {
  native?.cancelBudgetAlert();
}
