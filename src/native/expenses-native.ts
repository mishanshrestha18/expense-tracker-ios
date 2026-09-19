/**
 * The small Swift module in `native/ExpensesNative.swift`, which lives in the
 * same app as the App Intents. It is missing on web and in Expo Go, so every
 * call falls back to doing nothing.
 */
import { requireOptionalNativeModule } from 'expo';

interface ExpensesNativeModule {
  /** Asks for permission to post "payment added" notifications. */
  requestNotificationPermission(): Promise<boolean>;
}

const native = requireOptionalNativeModule<ExpensesNativeModule>('ExpensesNative');

export async function requestPaymentAlerts(): Promise<boolean> {
  return (await native?.requestNotificationPermission()) ?? false;
}
