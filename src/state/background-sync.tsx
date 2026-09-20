import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent } from 'react';
import { AppState, Platform } from 'react-native';

import { describePaydayRule } from '@/domain/period';
import { takePendingSpotlight } from '@/native/expenses-spotlight';
import { closeFinishedPeriods } from '@/savings/close-periods';
import { drainBillInbox } from '@/siri/bill-inbox';
import { drainSiriInbox } from '@/siri/inbox-sync';
import { publishBudgetSnapshot } from '@/siri/snapshot-sync';
import { publishSpotlightIndex } from '@/spotlight/sync';
import { useDataVersion } from '@/state/data-version';
import { useSelectedPeriod } from '@/state/period';

/**
 * Everything that has to happen while nobody is looking: close any budget
 * period that ended, import whatever Siri, Apple Pay or a notification logged,
 * keep the summary those intents read up to date, and keep iOS search current.
 */
export function BackgroundSync() {
  const db = useSQLiteContext();
  const router = useRouter();
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
      // Bills marked paid from a notification, while the app was not running.
      const settled = await drainBillInbox(db);
      if (added > 0 || settled > 0) invalidate();
    } catch (error) {
      console.warn('Could not import what was logged outside the app', error);
    }
  });

  const openFromSearch = useEffectEvent(async () => {
    try {
      // A tap on an iOS search result, waiting since before the app was up.
      const id = await takePendingSpotlight();
      if (id !== null) router.push({ pathname: '/expense/[id]', params: { id } });
    } catch (error) {
      console.warn('Could not open the expense iOS search asked for', error);
    }
  });

  const publish = useEffectEvent(async () => {
    try {
      await publishBudgetSnapshot(db, rule);
    } catch (error) {
      console.warn('Could not update the budget summary for Siri', error);
    }
  });

  const reindex = useEffectEvent(async () => {
    try {
      await publishSpotlightIndex(db);
    } catch (error) {
      console.warn('Could not put the expenses into iOS search', error);
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
    void openFromSearch();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void importInbox();
      void openFromSearch();
    });
    return () => subscription.remove();
  }, []);

  // Anything that changes the budget changes what Siri should say, and what
  // iOS search should find.
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void publish();
    void reindex();
  }, [version, ruleKey]);

  return null;
}
