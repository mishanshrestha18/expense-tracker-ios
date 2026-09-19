import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent } from 'react';
import { AppState, Platform } from 'react-native';

import { describePaydayRule } from '@/domain/period';
import { useDataVersion } from '@/state/data-version';
import { useSelectedPeriod } from '@/state/period';

import { drainSiriInbox } from './inbox-sync';
import { publishBudgetSnapshot } from './snapshot-sync';

/**
 * The bridge to the App Intents: imports whatever Siri and Apple Pay logged
 * while the app was closed, and keeps the budget summary they read up to date.
 */
export function SiriInboxSync() {
  const db = useSQLiteContext();
  const { version, invalidate } = useDataVersion();
  const { rule } = useSelectedPeriod();
  // A plain string, so the effect below has a dependency React can check.
  const ruleKey = describePaydayRule(rule);

  const sync = useEffectEvent(async () => {
    try {
      const added = await drainSiriInbox(db);
      if (added > 0) invalidate();
    } catch (error) {
      console.warn('Could not import expenses from Siri', error);
    }
  });

  const publish = useEffectEvent(async () => {
    try {
      await publishBudgetSnapshot(db, rule);
    } catch (error) {
      console.warn('Could not update the budget summary for Siri', error);
    }
  });

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void sync();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void sync();
    });
    return () => subscription.remove();
  }, []);

  // Anything that changes the budget changes what Siri should say.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void publish();
  }, [version, ruleKey]);

  return null;
}
