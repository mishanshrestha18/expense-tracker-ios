import { createContext, type PropsWithChildren, useContext, useState } from 'react';

import { getPaydayRule } from '@/db/settings';
import type { MonthKey } from '@/domain/dates';
import {
  CALENDAR_MONTHS,
  currentPeriodKey,
  type PaydayRule,
  type Period,
  periodFor,
} from '@/domain/period';
import { useDbQuery } from '@/hooks/use-db-query';

interface SelectedPeriod {
  /** The period on screen, keyed by the calendar month it starts in. */
  month: MonthKey;
  setMonth: (month: MonthKey) => void;
  /** How periods are cut: calendar months, or payday to payday. */
  rule: PaydayRule;
  period: Period;
  isCurrent: boolean;
}

const SelectedPeriodContext = createContext<SelectedPeriod | null>(null);

/** The period shown across the Overview, Budgets and Insights tabs. */
export function PeriodProvider({ children }: PropsWithChildren) {
  const rule = useDbQuery('payday-rule', getPaydayRule).data ?? CALENDAR_MONTHS;
  // Left unset until the person picks a period, so the default follows the
  // payday rule once it has loaded.
  const [picked, setPicked] = useState<MonthKey | null>(null);
  const current = currentPeriodKey(rule);
  const month = picked ?? current;

  const value: SelectedPeriod = {
    month,
    setMonth: setPicked,
    rule,
    period: periodFor(month, rule),
    isCurrent: month === current,
  };
  return <SelectedPeriodContext value={value}>{children}</SelectedPeriodContext>;
}

export function useSelectedPeriod(): SelectedPeriod {
  const value = useContext(SelectedPeriodContext);
  if (!value) throw new Error('useSelectedPeriod must be used inside <PeriodProvider>');
  return value;
}
