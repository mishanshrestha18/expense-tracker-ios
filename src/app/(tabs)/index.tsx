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
import { budgetOverview, dailyAllowancePence } from '@/domain/budget';
import {
  daysRemainingInMonth,
  formatDayHeading,
  formatMonthName,
  monthKeyOf,
} from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { groupByDay } from '@/domain/summary';
import {
  useBudgets,
  useCategories,
  useMonthExpenses,
  useMonthSpending,
  useOverallBudget,
} from '@/hooks/use-app-data';
import { useDbMutation } from '@/hooks/use-db-query';
import { useSelectedMonth } from '@/state/selected-month';

export default function OverviewScreen() {
  const router = useRouter();
  const mutate = useDbMutation();
  const { month, setMonth } = useSelectedMonth();
  const { categories, byId } = useCategories();
  const expenses = useMonthExpenses(month).data ?? [];
  const spending = useMonthSpending(month).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;

  const totalPence = spending.reduce((sum, s) => sum + s.totalPence, 0);
  const { progress, basis } = budgetOverview(spending, budgets, overallBudget);
  const allowance = dailyAllowancePence(progress.remainingPence, daysRemainingInMonth(month));
  const days = groupByDay(expenses);

  async function quickAdd(input: ExpenseInput) {
    await mutate((db) => addExpense(db, input));
    // Jump to the month the expense landed in, e.g. "yesterday" on the 1st.
    setMonth(monthKeyOf(input.spentOn));
  }

  return (
    <Screen>
      <MonthSwitcher
        title="Overview"
        month={month}
        onChange={setMonth}
        accessory={
          <IconButton
            icon={{ ios: 'plus', material: 'add' }}
            label="Add expense"
            variant="filled"
            onPress={() => router.push('/expense/new')}
          />
        }
      />

      <SpendingSummary
        month={month}
        totalPence={totalPence}
        expenseCount={expenses.length}
        budget={progress}
        budgetBasis={basis}
        dailyAllowancePence={allowance}
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
