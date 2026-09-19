import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import type { BudgetBasis, BudgetProgress } from '@/domain/budget';
import { currentMonthKey, formatMonthName, type MonthKey } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface SpendingSummaryProps {
  month: MonthKey;
  totalPence: number;
  expenseCount: number;
  /** Headline budget progress; see `budgetOverview`. */
  budget: BudgetProgress;
  budgetBasis: BudgetBasis;
  dailyAllowancePence: number | null;
  onSetBudget: () => void;
}

export function SpendingSummary({
  month,
  totalPence,
  expenseCount,
  budget,
  budgetBasis,
  dailyAllowancePence,
  onSetBudget,
}: SpendingSummaryProps) {
  const theme = useTheme();
  const label =
    month === currentMonthKey() ? 'Spent this month' : `Spent in ${formatMonthName(month)}`;

  return (
    <Card style={styles.card}>
      <View>
        <ThemedText type="footnote" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="amountLarge" accessibilityLabel={`${label}: ${formatPence(totalPence)}`}>
          {formatPence(totalPence)}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {expenseCount === 1 ? '1 expense' : `${expenseCount} expenses`}
        </ThemedText>
      </View>

      {budget.limitPence !== null && budget.remainingPence !== null ? (
        <View style={styles.budget}>
          <ProgressBar ratio={budget.ratio ?? 0} status={budget.status} />
          <View style={styles.budgetRow}>
            <ThemedText
              type="footnote"
              style={{ color: budget.status === 'over' ? theme.danger : theme.textSecondary }}>
              {budgetText(budget.remainingPence, budget.limitPence, budgetBasis)}
            </ThemedText>
            {dailyAllowancePence !== null ? (
              <ThemedText type="footnote" themeColor="textSecondary">
                {formatPence(dailyAllowancePence)}/day
              </ThemedText>
            ) : null}
          </View>
        </View>
      ) : (
        <Pressable accessibilityRole="link" onPress={onSetBudget} hitSlop={8}>
          <ThemedText type="linkPrimary">Set a monthly budget →</ThemedText>
        </Pressable>
      )}
    </Card>
  );
}

function budgetText(remainingPence: number, limitPence: number, basis: BudgetBasis): string {
  const limit = formatPence(limitPence);
  if (basis === 'monthly') {
    return remainingPence >= 0
      ? `${formatPence(remainingPence)} left of your ${limit} monthly budget`
      : `${formatPence(-remainingPence)} over your ${limit} monthly budget`;
  }
  return remainingPence >= 0
    ? `${formatPence(remainingPence)} left of ${limit} budgeted`
    : `${formatPence(-remainingPence)} over your ${limit} budget`;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  budget: {
    gap: Spacing.two,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
