import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetHero } from '@/components/budget-hero';
import { BudgetRow } from '@/components/budget-row';
import { StackedBar } from '@/components/charts/stacked-bar';
import { MonthSwitcher } from '@/components/month-switcher';
import { OverdueBanner } from '@/components/overdue-banner';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import {
  type BudgetOverview,
  budgetOverview,
  dailyAllowancePence,
  forecast,
  safeToSpendPence,
} from '@/domain/budget';
import { formatMonthName } from '@/domain/dates';
import { describeCarry, envelopeLimit } from '@/domain/envelopes';
import { formatPence } from '@/domain/money';
import {
  daysInPeriod,
  daysRemainingInPeriod,
  formatPeriodRange,
  periodNoun,
} from '@/domain/period';
import {
  useBudgets,
  useCategories,
  useOverallBudget,
  usePeriodSpending,
} from '@/hooks/use-app-data';
import { usePeriodCommitments } from '@/hooks/use-commitments';
import { useEnvelopes } from '@/hooks/use-envelopes';
import { useUpcomingFees } from '@/hooks/use-recurring';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedPeriod } from '@/state/period';
import { UpcomingFees } from '@/components/upcoming-fees';

interface CategoryLine {
  category: Category;
  spentPence: number;
  /** The envelope limit while envelope budgeting is on, otherwise the budget itself. */
  limitPence: number | null;
  /** Signed pence brought in from the period before; 0 unless envelopes are on. */
  carriedInPence: number;
}

export default function BudgetsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { month, setMonth, rule, period, isCurrent } = useSelectedPeriod();
  const { categories } = useCategories();
  const spending = usePeriodSpending(period).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;
  const envelopes = useEnvelopes(period.key, rule);
  const bills = usePeriodCommitments(period);
  const upcoming = useUpcomingFees(period, bills.commitments);
  const [showIdle, setShowIdle] = useState(false);

  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const limitBy = new Map(budgets.map((b) => [b.categoryId, b.monthlyLimitPence]));
  const overview = budgetOverview(spending, budgets, overallBudget, bills.totals);
  // Once bills are set up they are the money already spoken for; before that,
  // the fees the app spotted by itself play the same part.
  const setAsidePence = overview.everyday ? bills.totals.outstandingPence : upcoming.totalPence;
  const daysLeft = daysRemainingInPeriod(period);
  const allowance = dailyAllowancePence(
    safeToSpendPence((overview.everyday ?? overview).progress.remainingPence, setAsidePence),
    daysLeft,
  );
  const projected =
    daysLeft === null
      ? null
      : forecast(
          overview.totalSpentPence,
          setAsidePence,
          daysInPeriod(period) - daysLeft + 1,
          daysLeft - 1,
          overview.progress.limitPence,
        );
  const totalSpent = overview.totalSpentPence;

  // Biggest spending first; categories with nothing spent keep their usual order.
  // With envelopes on, a limit is money the category keeps: what it did not
  // spend last period is still in it, and an overspend is a debt to pay off.
  const lines: CategoryLine[] = categories
    .map((category) => {
      const basePence = limitBy.get(category.id) ?? null;
      const carriedInPence = envelopes.carriedIn.get(category.id) ?? 0;
      return {
        category,
        spentPence: spentBy.get(category.id) ?? 0,
        limitPence: envelopes.enabled ? envelopeLimit(basePence, carriedInPence) : basePence,
        carriedInPence,
      };
    })
    .sort((a, b) => b.spentPence - a.spentPence);
  // Categories with no spending and no limit are tucked away until asked for.
  const idle = lines.filter((line) => line.spentPence === 0 && line.limitPence === null);
  const visible = showIdle ? lines : lines.filter((line) => !idle.includes(line));
  const spenders = lines.filter((line) => line.spentPence > 0);

  return (
    <Screen>
      <MonthSwitcher
        title="Budgets"
        month={month}
        subtitle={rule.kind === 'calendar' ? undefined : formatPeriodRange(period)}
        isCurrent={isCurrent}
        noun={periodNoun(rule)}
        onChange={setMonth}
      />

      <OverdueBanner
        count={bills.overdue.length}
        totalPence={bills.totals.overduePence}
        onPress={() => router.push('/bills')}
      />

      <BudgetHero
        overview={overview}
        period={period}
        periodLabel={formatMonthName(month)}
        allowancePence={allowance}
        upcomingPence={setAsidePence}
        projectedPence={projected?.projectedPence ?? null}
        onEditBudget={() => router.push('/budget/monthly')}
      />

      <UpcomingFees
        fees={upcoming.fees}
        totalPence={upcoming.totalPence}
        noun={periodNoun(rule)}
        onIgnore={upcoming.ignore}
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

          {visible.map((line, index) => {
            const separator = index < visible.length - 1 || idle.length > 0;
            const carry = describeCarry(line.carriedInPence, periodNoun(rule));
            return (
              <View key={line.category.id}>
                <BudgetRow
                  category={line.category}
                  spentPence={line.spentPence}
                  limitPence={line.limitPence}
                  share={totalSpent > 0 ? line.spentPence / totalSpent : 0}
                  showSeparator={carry === null && separator}
                  onPress={() => router.push(`/budget/${line.category.id}`)}
                />
                {carry === null ? null : (
                  <CarryNote
                    text={carry}
                    owed={line.carriedInPence < 0}
                    showSeparator={separator}
                  />
                )}
              </View>
            );
          })}

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

/**
 * What a category brought into this period under envelope budgeting. The tint
 * means money still sitting in the envelope and the warning ink means a debt to
 * pay off first, the same pairing the hero uses for a good or a worrying period.
 */
function CarryNote({
  text,
  owed,
  showSeparator,
}: {
  text: string;
  owed: boolean;
  showSeparator: boolean;
}) {
  const theme = useTheme();
  const color = owed ? theme.warning : theme.tint;
  return (
    <View
      style={[
        styles.carry,
        showSeparator && {
          borderBottomColor: theme.separator,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}>
      <Icon
        name={
          owed
            ? { ios: 'arrow.down.right', material: 'trending_down' }
            : { ios: 'arrow.up.right', material: 'trending_up' }
        }
        size={12}
        color={color}
      />
      <ThemedText type="footnote" numberOfLines={1} style={{ color }}>
        {text}
      </ThemedText>
    </View>
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
  carry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    // Lines the note and its separator up with the row above, past the badge.
    marginLeft: Spacing.three * 2 + 40 - 2,
    marginTop: -Spacing.two,
    paddingRight: Spacing.three,
    paddingBottom: Spacing.three - 2,
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
