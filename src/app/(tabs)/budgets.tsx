import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetRow } from '@/components/budget-row';
import { StackedBar } from '@/components/charts/stacked-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { type BudgetOverview, budgetOverview, dailyAllowancePence } from '@/domain/budget';
import { daysRemainingInMonth } from '@/domain/dates';
import { formatPence, formatPenceShort } from '@/domain/money';
import {
  useBudgets,
  useCategories,
  useMonthSpending,
  useOverallBudget,
} from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedMonth } from '@/state/selected-month';

interface CategoryLine {
  category: Category;
  spentPence: number;
  limitPence: number | null;
}

const LEGEND_ITEMS = 3;

export default function BudgetsScreen() {
  const router = useRouter();
  const { month, setMonth } = useSelectedMonth();
  const { categories } = useCategories();
  const spending = useMonthSpending(month).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;

  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  const overview = budgetOverview(spending, budgets, overallBudget);
  const allowance = dailyAllowancePence(
    overview.progress.remainingPence,
    daysRemainingInMonth(month),
  );

  // Biggest spending first; categories with nothing spent keep their usual order.
  const lines: CategoryLine[] = categories
    .map((category) => ({
      category,
      spentPence: spentBy.get(category.id) ?? 0,
      limitPence: limitBy.get(category.id) ?? null,
    }))
    .sort((a, b) => b.spentPence - a.spentPence);

  // The summary bar shows whatever its headline figure counts.
  const counted = lines.filter(
    (line) => line.spentPence > 0 && (overview.basis === 'monthly' || line.limitPence !== null),
  );

  return (
    <Screen>
      <MonthSwitcher title="Budgets" month={month} onChange={setMonth} />

      <BudgetSummary
        overview={overview}
        lines={counted}
        allowancePence={allowance}
        onEditMonthly={() => router.push('/budget/monthly')}
      />

      <Section
        title="Spending by category"
        detail={
          overview.categoryLimitsPence > 0
            ? `${formatPence(overview.categoryLimitsPence)} budgeted`
            : undefined
        }>
        <Card flush>
          {lines.map((line, index) => (
            <BudgetRow
              key={line.category.id}
              category={line.category}
              spentPence={line.spentPence}
              limitPence={line.limitPence}
              showSeparator={index < lines.length - 1}
              onPress={() => router.push(`/budget/${line.category.id}`)}
            />
          ))}
        </Card>
      </Section>

      {overview.basis === 'categories' && overview.unbudgetedSpentPence > 0 ? (
        <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
          You also spent {formatPence(overview.unbudgetedSpentPence)} in categories without a
          budget.
        </ThemedText>
      ) : null}
    </Screen>
  );
}

interface BudgetSummaryProps {
  overview: BudgetOverview;
  /** Spending that counts towards the headline figure, biggest first. */
  lines: readonly CategoryLine[];
  allowancePence: number | null;
  onEditMonthly: () => void;
}

/** The headline card: the monthly budget when set, otherwise the category budgets combined. */
function BudgetSummary({ overview, lines, allowancePence, onEditMonthly }: BudgetSummaryProps) {
  const theme = useTheme();
  const { basis, progress } = overview;

  if (basis === 'none' || progress.limitPence === null || progress.remainingPence === null) {
    return (
      <Card style={styles.summary}>
        <View style={styles.intro}>
          <ThemedText type="headline">No budgets yet</ThemedText>
          <ThemedText type="callout" themeColor="textSecondary">
            Set one monthly budget for everything you spend, give categories their own limits below,
            or both. Expenses warns you at 80%.
          </ThemedText>
        </View>
        <Button
          title="Set monthly budget"
          icon={{ ios: 'plus', material: 'add' }}
          onPress={onEditMonthly}
        />
      </Card>
    );
  }

  const isMonthly = basis === 'monthly';
  const over = progress.remainingPence < 0;
  const heading = isMonthly
    ? over
      ? 'Over your monthly budget by'
      : 'Left in your monthly budget'
    : over
      ? 'Over your category budgets by'
      : 'Left in your category budgets';
  const hiddenCount = lines.length - LEGEND_ITEMS;

  return (
    <Card style={styles.summary}>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <ThemedText type="footnote" themeColor="textSecondary">
            {heading}
          </ThemedText>
          <ThemedText type="amountLarge" style={over ? { color: theme.danger } : undefined}>
            {formatPence(Math.abs(progress.remainingPence))}
          </ThemedText>
        </View>
        {isMonthly ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit monthly budget"
            hitSlop={8}
            onPress={onEditMonthly}>
            <ThemedText type="linkPrimary">Edit</ThemedText>
          </Pressable>
        ) : null}
      </View>

      <StackedBar
        items={lines.map((line) => ({
          key: String(line.category.id),
          value: line.spentPence,
          color: line.category.color,
        }))}
        capacity={progress.limitPence}
        accessibilityLabel={`${formatPence(progress.spentPence)} of ${formatPence(progress.limitPence)} spent: ${lines
          .map((line) => `${line.category.name} ${formatPence(line.spentPence)}`)
          .join(', ')}`}
      />

      {lines.length > 0 ? (
        <View style={styles.legend}>
          {lines.slice(0, LEGEND_ITEMS).map((line) => (
            <View key={line.category.id} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: line.category.color }]} />
              <ThemedText type="footnote">
                {line.category.name}{' '}
                <ThemedText type="footnote" themeColor="textSecondary">
                  {formatPenceShort(line.spentPence)}
                </ThemedText>
              </ThemedText>
            </View>
          ))}
          {hiddenCount > 0 ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              +{hiddenCount} more
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <ThemedText type="footnote" themeColor="textSecondary">
          {formatPence(progress.spentPence)} of {formatPence(progress.limitPence)} spent
        </ThemedText>
        {allowancePence !== null ? (
          <ThemedText type="footnote" themeColor="textSecondary">
            {formatPence(allowancePence)}/day to stay on track
          </ThemedText>
        ) : null}
      </View>

      {isMonthly && overview.unallocatedPence !== null && overview.categoryLimitsPence > 0 ? (
        <ThemedText
          type="footnote"
          style={{ color: overview.unallocatedPence < 0 ? theme.warning : theme.textSecondary }}>
          {overview.unallocatedPence < 0
            ? `Your category budgets add up to ${formatPence(overview.categoryLimitsPence)}, ${formatPence(-overview.unallocatedPence)} more than this budget.`
            : `${formatPence(overview.categoryLimitsPence)} of this is split across category budgets.`}
        </ThemedText>
      ) : null}

      {!isMonthly ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onEditMonthly}>
          <ThemedText type="linkPrimary">Set an overall monthly budget →</ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
    marginTop: -Spacing.one,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
