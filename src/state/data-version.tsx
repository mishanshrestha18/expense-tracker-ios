import { createContext, type PropsWithChildren, useContext, useState } from 'react';

interface DataVersion {
  /** Increments after every write so queries know to reload. */
  version: number;
  invalidate: () => void;
}

const DataVersionContext = createContext<DataVersion | null>(null);

export function DataVersionProvider({ children }: PropsWithChildren) {
  const [version, setVersion] = useState(0);
  const invalidate = () => setVersion((v) => v + 1);
  return <DataVersionContext value={{ version, invalidate }}>{children}</DataVersionContext>;
}

export function useDataVersion(): DataVersion {
  const value = useContext(DataVersionContext);
  if (!value) throw new Error('useDataVersion must be used inside <DataVersionProvider>');
  return value;
}
