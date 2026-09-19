import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent } from 'react';
import { AppState, Platform } from 'react-native';

import { useDataVersion } from '@/state/data-version';

import { drainSiriInbox } from './inbox-sync';

/**
 * Imports expenses logged with Siri when the app starts and every time it
 * comes back to the foreground, then refreshes the screens.
 */
export function SiriInboxSync() {
  const db = useSQLiteContext();
  const { invalidate } = useDataVersion();

  const sync = useEffectEvent(async () => {
    try {
      const added = await drainSiriInbox(db);
      if (added > 0) invalidate();
    } catch (error) {
      console.warn('Could not import expenses from Siri', error);
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

  return null;
}
