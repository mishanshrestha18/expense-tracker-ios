import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BudgetRow } from '@/components/budget-row';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { budgetOverview, dailyAllowancePence } from '@/domain/budget';
import { daysRemainingInMonth } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { useBudgets, useCategories, useMonthSpending } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedMonth } from '@/state/selected-month';

export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { month, setMonth } = useSelectedMonth();
  const { categories } = useCategories();
  const spending = useMonthSpending(month).data ?? [];
  const budgets = useBudgets().data ?? [];

  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  const overview = budgetOverview(spending, budgets);
  const { progress } = overview;
  const allowance = dailyAllowancePence(progress.remainingPence, daysRemainingInMonth(month));

  return (
    <Screen>
      <MonthSwitcher title="Budgets" month={month} onChange={setMonth} />

      <Card style={styles.summary}>
        {progress.limitPence !== null && progress.remainingPence !== null ? (
          <>
            <View>
              <ThemedText type="footnote" themeColor="textSecondary">
                {progress.remainingPence >= 0 ? 'Left to spend' : 'Over budget by'}
              </ThemedText>
              <ThemedText
                type="amountLarge"
                style={progress.status === 'over' ? { color: theme.danger } : undefined}>
                {formatPence(Math.abs(progress.remainingPence))}
              </ThemedText>
            </View>
            <ProgressBar ratio={progress.ratio ?? 0} status={progress.status} />
            <View style={styles.row}>
              <ThemedText type="footnote" themeColor="textSecondary">
                {formatPence(overview.budgetedSpentPence)} of {formatPence(progress.limitPence)}
              </ThemedText>
              {allowance !== null ? (
                <ThemedText type="footnote" themeColor="textSecondary">
                  {formatPence(allowance)}/day to stay on track
                </ThemedText>
              ) : null}
            </View>
          </>
        ) : (
          <View style={styles.intro}>
            <ThemedText type="headline">No budgets yet</ThemedText>
            <ThemedText type="callout" themeColor="textSecondary">
              Give a category a monthly limit and Expenses will track what is left, warning you at
              80%.
            </ThemedText>
          </View>
        )}
      </Card>

      <Section title="Categories">
        <Card flush>
          {categories.map((category, index) => (
            <BudgetRow
              key={category.id}
              category={category}
              spentPence={spentBy.get(category.id) ?? 0}
              limitPence={limitBy.get(category.id) ?? null}
              showSeparator={index < categories.length - 1}
              onPress={() => router.push(`/budget/${category.id}`)}
            />
          ))}
        </Card>
      </Section>

      {overview.unbudgetedSpentPence > 0 && progress.limitPence !== null ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          You also spent {formatPence(overview.unbudgetedSpentPence)} in categories without a
          budget.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  intro: {
    gap: Spacing.one,
  },
  footnote: {
    paddingHorizontal: Spacing.three,
  },
});
