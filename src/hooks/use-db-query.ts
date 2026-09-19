import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useEffectEvent, useState } from 'react';

import type { Db } from '@/db/types';
import { useDataVersion } from '@/state/data-version';

export interface QueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
}

/**
 * Runs a read query and re-runs it when `key` changes or after any write
 * (see `useDbMutation`). Previous data stays visible while reloading.
 */
export function useDbQuery<T>(key: string, query: (db: Db) => Promise<T>): QueryResult<T> {
  const db = useSQLiteContext();
  const { version } = useDataVersion();
  const [result, setResult] = useState<QueryResult<T>>({ data: undefined, error: undefined });
  const runQuery = useEffectEvent(() => query(db));

  useEffect(() => {
    let active = true;
    runQuery().then(
      (data) => {
        if (active) setResult({ data, error: undefined });
      },
      (error: unknown) => {
        if (active) {
          setResult({
            data: undefined,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [key, version]);

  return result;
}

/** Returns a function that runs a write and then refreshes every query. */
export function useDbMutation() {
  const db = useSQLiteContext();
  const { invalidate } = useDataVersion();
  return async function mutate<T>(write: (db: Db) => Promise<T>): Promise<T> {
    const result = await write(db);
    invalidate();
    return result;
  };
}
