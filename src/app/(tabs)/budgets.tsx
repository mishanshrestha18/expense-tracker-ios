import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetHero } from '@/components/budget-hero';
import { BudgetRow } from '@/components/budget-row';
import { StackedBar } from '@/components/charts/stacked-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { type BudgetOverview, budgetOverview, dailyAllowancePence } from '@/domain/budget';
import { daysRemainingInMonth, formatMonthName } from '@/domain/dates';
import { formatPence } from '@/domain/money';
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

export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { month, setMonth } = useSelectedMonth();
  const { categories } = useCategories();
  const spending = useMonthSpending(month).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;
  const [showIdle, setShowIdle] = useState(false);

  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  const overview = budgetOverview(spending, budgets, overallBudget);
  const allowance = dailyAllowancePence(
    overview.progress.remainingPence,
    daysRemainingInMonth(month),
  );
  const totalSpent = overview.totalSpentPence;

  // Biggest spending first; categories with nothing spent keep their usual order.
  const lines: CategoryLine[] = categories
    .map((category) => ({
      category,
      spentPence: spentBy.get(category.id) ?? 0,
      limitPence: limitBy.get(category.id) ?? null,
    }))
    .sort((a, b) => b.spentPence - a.spentPence);
  // Categories with no spending and no limit are tucked away until asked for.
  const idle = lines.filter((line) => line.spentPence === 0 && line.limitPence === null);
  const visible = showIdle ? lines : lines.filter((line) => !idle.includes(line));
  const spenders = lines.filter((line) => line.spentPence > 0);

  return (
    <Screen>
      <MonthSwitcher title="Budgets" month={month} onChange={setMonth} />

      <BudgetHero
        overview={overview}
        month={month}
        allowancePence={allowance}
        onEditBudget={() => router.push('/budget/monthly')}
      />

      <Section title="Where it went" detail={formatPence(totalSpent)} variant="large">
        <Card flush>
          {spenders.length > 0 ? (
            <View style={styles.distribution}>
              <StackedBar
                items={spenders.map((line) => ({
                  key: String(line.category.id),
                  value: line.spentPence,
                  color: line.category.color,
                }))}
                capacity={totalSpent}
                height={10}
                accessibilityLabel={`Spending split: ${spenders
                  .map(
                    (line) =>
                      `${line.category.name} ${Math.round((line.spentPence / totalSpent) * 100)}%`,
                  )
                  .join(', ')}`}
              />
            </View>
          ) : (
            <ThemedText type="callout" themeColor="textSecondary" style={styles.empty}>
              Nothing spent in {formatMonthName(month)} yet.
            </ThemedText>
          )}

          {visible.map((line, index) => (
            <BudgetRow
              key={line.category.id}
              category={line.category}
              spentPence={line.spentPence}
              limitPence={line.limitPence}
              share={totalSpent > 0 ? line.spentPence / totalSpent : 0}
              showSeparator={index < visible.length - 1 || idle.length > 0}
              onPress={() => router.push(`/budget/${line.category.id}`)}
            />
          ))}

          {idle.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showIdle }}
              onPress={() => setShowIdle((shown) => !shown)}
              style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: theme.tint }}>
                {showIdle
                  ? 'Show less'
                  : `Show ${idle.length} more ${idle.length === 1 ? 'category' : 'categories'}`}
              </ThemedText>
              <Icon
                name={
                  showIdle
                    ? { ios: 'chevron.up', material: 'expand_less' }
                    : { ios: 'chevron.down', material: 'expand_more' }
                }
                size={12}
                color={theme.tint}
              />
            </Pressable>
          ) : null}
        </Card>
      </Section>

      <Footnote overview={overview} />
    </Screen>
  );
}

/** One line of context about how category limits relate to the headline budget. */
function Footnote({ overview }: { overview: BudgetOverview }) {
  const theme = useTheme();
  let text: string;
  let color: string = theme.textSecondary;

  if (overview.basis === 'monthly' && overview.categoryLimitsPence > 0) {
    const unallocated = overview.unallocatedPence ?? 0;
    if (unallocated < 0) {
      text = `Category limits add up to ${formatPence(overview.categoryLimitsPence)}, ${formatPence(-unallocated)} more than your monthly budget.`;
      color = theme.warning;
    } else {
      text = `Category limits use ${formatPence(overview.categoryLimitsPence)} of your ${formatPence(overview.monthlyLimitPence ?? 0)} monthly budget.`;
    }
  } else if (overview.basis === 'categories' && overview.unbudgetedSpentPence > 0) {
    text = `${formatPence(overview.unbudgetedSpentPence)} was spent in categories without a limit.`;
  } else {
    text = 'Tap a category to give it its own monthly limit.';
  }

  return (
    <ThemedText type="footnote" style={[styles.footnote, { color }]}>
      {text}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  distribution: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three - 4,
    paddingBottom: Spacing.one,
  },
  empty: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one + 2,
    minHeight: 48,
  },
  pressed: {
    opacity: 0.6,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
  },
});
