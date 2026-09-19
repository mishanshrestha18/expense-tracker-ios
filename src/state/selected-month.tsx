import { createContext, type PropsWithChildren, useContext, useState } from 'react';

import { currentMonthKey, type MonthKey } from '@/domain/dates';

interface SelectedMonth {
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
}

const SelectedMonthContext = createContext<SelectedMonth | null>(null);

/** The month shown across the Overview, Budgets and Insights tabs. */
export function SelectedMonthProvider({ children }: PropsWithChildren) {
  const [month, setMonth] = useState(() => currentMonthKey());
  return <SelectedMonthContext value={{ month, setMonth }}>{children}</SelectedMonthContext>;
}

export function useSelectedMonth(): SelectedMonth {
  const value = useContext(SelectedMonthContext);
  if (!value) throw new Error('useSelectedMonth must be used inside <SelectedMonthProvider>');
  return value;
}
