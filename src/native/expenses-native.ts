/**
 * The small Swift module in `native/ExpensesNative.swift`, which lives in the
 * same app as the App Intents. It is missing on web and in Expo Go, so every
 * call falls back to doing nothing.
 */
import { requireOptionalNativeModule } from 'expo';

interface ExpensesNativeModule {
  /** Asks for permission to post "payment added" notifications. */
  requestNotificationPermission(): Promise<boolean>;
  /** Replaces the whole reminder schedule. */
  setAlerts(alerts: { id: string; title: string; body: string; at: number }[]): Promise<boolean>;
}

export interface ScheduledAlert {
  id: string;
  title: string;
  body: string;
  at: Date;
}

const native = requireOptionalNativeModule<ExpensesNativeModule>('ExpensesNative');

export async function requestPaymentAlerts(): Promise<boolean> {
  return (await native?.requestNotificationPermission()) ?? false;
}

/** Books every reminder the app wants, and cancels anything it booked before. */
export async function setAlerts(alerts: readonly ScheduledAlert[]): Promise<void> {
  await native?.setAlerts(
    alerts.map((alert) => ({ ...alert, at: Math.floor(alert.at.getTime() / 1000) })),
  );
}
