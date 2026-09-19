import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { ExpenseRow } from '@/components/expense-row';
import { MonthSwitcher } from '@/components/month-switcher';
import { QuickAddBar } from '@/components/quick-add-bar';
import { SpendingSummary } from '@/components/spending-summary';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { loadDemoData } from '@/db/demo-data';
import { addExpense } from '@/db/expenses';
import type { ExpenseInput } from '@/db/types';
import { budgetOverview, dailyAllowancePence, safeToSpendPence } from '@/domain/budget';
import { formatDayHeading, formatMonthName } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { paidWithSummary } from '@/domain/paid-with';
import { daysRemainingInPeriod, formatPeriodRange, periodKeyOf, periodNoun } from '@/domain/period';
import { groupByDay } from '@/domain/summary';
import {
  useBudgets,
  useCategories,
  useOverallBudget,
  usePaidWithTotals,
  usePeriodExpenses,
  usePeriodSpending,
} from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useUpcomingFees } from '@/hooks/use-recurring';
import { useSelectedPeriod } from '@/state/period';

export default function OverviewScreen() {
  const router = useRouter();
  const mutate = useDbMutation();
  const { month, setMonth, rule, period, isCurrent } = useSelectedPeriod();
  const { categories, byId } = useCategories();
  const expenses = usePeriodExpenses(period).data ?? [];
  const spending = usePeriodSpending(period).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;
  const paidWith = usePaidWithTotals(period).data ?? [];
  const upcoming = useUpcomingFees(period);

  const totalPence = spending.reduce((sum, s) => sum + s.totalPence, 0);
  const { progress, basis } = budgetOverview(spending, budgets, overallBudget);
  const allowance = dailyAllowancePence(
    safeToSpendPence(progress.remainingPence, upcoming.totalPence),
    daysRemainingInPeriod(period),
  );
  const days = groupByDay(expenses);
  const noun = periodNoun(rule);

  async function quickAdd(input: ExpenseInput) {
    await mutate((db) => addExpense(db, input));
    // Jump to the period the expense landed in, e.g. "yesterday" on the 1st.
    setMonth(periodKeyOf(input.spentOn, rule));
  }

  return (
    <Screen>
      <MonthSwitcher
        title="Overview"
        month={month}
        subtitle={rule.kind === 'calendar' ? undefined : formatPeriodRange(period)}
        isCurrent={isCurrent}
        noun={noun}
        onChange={setMonth}
        accessory={
          <>
            <IconButton
              icon={{ ios: 'gearshape', material: 'settings' }}
              label="Settings"
              onPress={() => router.push('/settings')}
            />
            <IconButton
              icon={{ ios: 'plus', material: 'add' }}
              label="Add expense"
              variant="filled"
              onPress={() => router.push('/expense/new')}
            />
          </>
        }
      />

      <SpendingSummary
        label={isCurrent ? `Spent this ${noun}` : `Spent in ${formatMonthName(month)}`}
        totalPence={totalPence}
        expenseCount={expenses.length}
        budget={progress}
        budgetBasis={basis}
        dailyAllowancePence={allowance}
        paidWithText={paidWithSummary(paidWith)}
        onSetBudget={() => router.push('/budget/monthly')}
      />

      <QuickAddBar categories={categories} onAdd={quickAdd} />

      {days.length === 0 ? (
        <EmptyState
          icon={{ ios: 'tray', material: 'receipt_long' }}
          title="No expenses yet"
          message={`Nothing logged for ${formatMonthName(month)}. Type something like “12.50 coffee” above to add your first one.`}>
          {__DEV__ ? (
            <Button
              title="Load sample data"
              variant="secondary"
              onPress={() => void mutate((db) => loadDemoData(db))}
            />
          ) : null}
        </EmptyState>
      ) : (
        days.map((day) => (
          <Section
            key={day.date}
            title={formatDayHeading(day.date)}
            detail={formatPence(day.totalPence)}>
            <Card flush>
              {day.items.map((expense, index) => (
                <ExpenseRow
                  key={expense.id}
                  expense={expense}
                  category={byId.get(expense.categoryId)}
                  showSeparator={index < day.items.length - 1}
                  onPress={() => router.push(`/expense/${expense.id}`)}
                />
              ))}
            </Card>
          </Section>
        ))
      )}
    </Screen>
  );
}
