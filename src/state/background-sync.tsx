import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent } from 'react';
import { AppState, Platform } from 'react-native';

import { describePaydayRule } from '@/domain/period';
import { closeFinishedPeriods } from '@/savings/close-periods';
import { drainSiriInbox } from '@/siri/inbox-sync';
import { publishBudgetSnapshot } from '@/siri/snapshot-sync';
import { useDataVersion } from '@/state/data-version';
import { useSelectedPeriod } from '@/state/period';

/**
 * Everything that has to happen while nobody is looking: close any budget
 * period that ended, import whatever Siri and Apple Pay logged, and keep the
 * summary those intents read up to date.
 */
export function BackgroundSync() {
  const db = useSQLiteContext();
  const { version, invalidate } = useDataVersion();
  const { rule } = useSelectedPeriod();
  // A plain string, so the effects below have a dependency React can check.
  const ruleKey = describePaydayRule(rule);

  const catchUp = useEffectEvent(async () => {
    try {
      // A period that ended while the app was shut rolls into savings now.
      const closed = await closeFinishedPeriods(db, rule);
      if (closed > 0) invalidate();
    } catch (error) {
      console.warn('Could not close the finished periods', error);
    }
  });

  const importInbox = useEffectEvent(async () => {
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

  // `version` too: setting the first budget is what starts savings off.
  useEffect(() => {
    void catchUp();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void catchUp();
    });
    return () => subscription.remove();
  }, [ruleKey, version]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void importInbox();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void importInbox();
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
