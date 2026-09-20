import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import type { BudgetBasis, BudgetProgress } from '@/domain/budget';
import { formatPence, formatPenceShort } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface SpendingSummaryProps {
  /** e.g. "Spent this month" or "Spent in August". */
  label: string;
  totalPence: number;
  expenseCount: number;
  /** Headline budget progress; see `budgetOverview`. */
  budget: BudgetProgress;
  budgetBasis: BudgetBasis | 'everyday';
  /** What the bills take this period, when any are set up. */
  committedPence?: number;
  dailyAllowancePence: number | null;
  /** How the spending was paid for, e.g. "£120 cash · £860 card". */
  paidWithText?: string;
  onSetBudget: () => void;
}

export function SpendingSummary({
  label,
  totalPence,
  expenseCount,
  budget,
  budgetBasis,
  committedPence = 0,
  dailyAllowancePence,
  paidWithText,
  onSetBudget,
}: SpendingSummaryProps) {
  const theme = useTheme();

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
          {paidWithText ? ` · ${paidWithText}` : ''}
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
              {committedPence > 0 ? ` · ${formatPenceShort(committedPence)} of bills` : ''}
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

function budgetText(
  remainingPence: number,
  limitPence: number,
  basis: BudgetBasis | 'everyday',
): string {
  const limit = formatPence(limitPence);
  if (basis === 'everyday') {
    return remainingPence >= 0
      ? `${formatPence(remainingPence)} left to spend after bills`
      : `${formatPence(-remainingPence)} over what was left after bills`;
  }
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
