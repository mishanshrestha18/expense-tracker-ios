/**
 * Envelope budgeting on screen: whether it is switched on, and what each
 * category carries into the period being looked at. The maths lives in
 * `src/domain/envelopes.ts`; this joins it to the database.
 */
import { carriedInto, clearCategoryCarry } from '@/db/envelopes';
import { getEnvelopes, setEnvelopes } from '@/db/settings';
import type { MonthKey } from '@/domain/dates';
import type { PaydayRule } from '@/domain/period';

import { useDbMutation, useDbQuery } from './use-db-query';

/** Shared, so a screen with no carries does not get a new map every render. */
const NO_CARRY: ReadonlyMap<number, number> = new Map();

export interface EnvelopesSetting {
  enabled: boolean;
  loaded: boolean;
  /** Switching it off forgets every carry, so a stale chain cannot come back with it. */
  setEnabled: (enabled: boolean) => Promise<void>;
}

export interface EnvelopesResult extends EnvelopesSetting {
  /** Signed pence each category brings into the period, by category id. Empty while off. */
  carriedIn: ReadonlyMap<number, number>;
}

/** The setting on its own, for screens with no period on show. */
export function useEnvelopesSetting(): EnvelopesSetting {
  const mutate = useDbMutation();
  const { data } = useDbQuery('envelopes', getEnvelopes);

  return {
    enabled: data ?? false,
    loaded: data !== undefined,
    setEnabled: async (enabled) => {
      await mutate(async (db) => {
        await setEnvelopes(db, enabled);
        if (!enabled) await clearCategoryCarry(db);
      });
    },
  };
}

export function useEnvelopes(periodKey: MonthKey, rule: PaydayRule): EnvelopesResult {
  const setting = useEnvelopesSetting();
  const { enabled } = setting;
  // Nothing is carried while the setting is off, so there is nothing to read.
  const { data } = useDbQuery(`envelope-carry:${enabled}:${periodKey}`, (db) =>
    enabled ? carriedInto(db, periodKey, rule) : Promise.resolve(NO_CARRY),
  );

  return { ...setting, carriedIn: data ?? NO_CARRY };
}
