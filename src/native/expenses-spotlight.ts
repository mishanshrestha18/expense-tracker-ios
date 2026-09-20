/**
 * The Spotlight bridge in `native/ExpensesSpotlight.swift`. Missing on web and
 * in Expo Go, where every call quietly does nothing.
 */
import { requireOptionalNativeModule } from 'expo';

interface ExpensesSpotlightModule {
  index(
    records: { id: number; title: string; detail: string; keywords: string }[],
  ): Promise<boolean>;
  forget(ids: number[]): Promise<boolean>;
  clear(): Promise<boolean>;
  takePending(): Promise<number>;
}

export interface SpotlightRecord {
  id: number;
  title: string;
  detail: string;
  keywords: string[];
}

const native = requireOptionalNativeModule<ExpensesSpotlightModule>('ExpensesSpotlight');

export async function indexInSpotlight(records: readonly SpotlightRecord[]): Promise<void> {
  if (records.length === 0) return;
  await native?.index(
    records.map((record) => ({ ...record, keywords: record.keywords.join(',') })),
  );
}

export async function forgetInSpotlight(ids: readonly number[]): Promise<void> {
  if (ids.length === 0) return;
  await native?.forget([...ids]);
}

export async function clearSpotlight(): Promise<void> {
  await native?.clear();
}

/** The expense a Spotlight result asked to open, once. `null` when there is none. */
export async function takePendingSpotlight(): Promise<number | null> {
  const id = (await native?.takePending()) ?? 0;
  return id > 0 ? id : null;
}
