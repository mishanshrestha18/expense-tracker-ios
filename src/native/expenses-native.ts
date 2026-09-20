/**
 * The small Swift module in `native/ExpensesNative.swift`, which lives in the
 * same app as the App Intents. It is missing on web and in Expo Go, so every
 * call falls back to doing nothing.
 */
import { requireOptionalNativeModule } from 'expo';

import type { IsoDate } from '@/domain/dates';

interface ExpensesNativeModule {
  /** Asks for permission to post "payment added" notifications. */
  requestNotificationPermission(): Promise<boolean>;
  /** Replaces the whole reminder schedule. */
  setAlerts(
    alerts: {
      id: string;
      title: string;
      body: string;
      at: number;
      billId: number;
      billDueOn: string;
    }[],
  ): Promise<boolean>;
}

export interface ScheduledAlert {
  id: string;
  title: string;
  body: string;
  at: Date;
  /**
   * The bill this reminder is about. Reminders that have one grow a "Paid"
   * button, so a bill can be settled without opening the app.
   */
  bill?: { commitmentId: number; dueOn: IsoDate };
}

const native = requireOptionalNativeModule<ExpensesNativeModule>('ExpensesNative');

export async function requestPaymentAlerts(): Promise<boolean> {
  return (await native?.requestNotificationPermission()) ?? false;
}

/** Books every reminder the app wants, and cancels anything it booked before. */
export async function setAlerts(alerts: readonly ScheduledAlert[]): Promise<void> {
  await native?.setAlerts(
    alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      body: alert.body,
      at: Math.floor(alert.at.getTime() / 1000),
      billId: alert.bill?.commitmentId ?? 0,
      billDueOn: alert.bill?.dueOn ?? '',
    })),
  );
}
