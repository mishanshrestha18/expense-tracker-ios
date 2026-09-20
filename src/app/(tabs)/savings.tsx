import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { SavingsEntry } from '@/db/types';
import { budgetOverview } from '@/domain/budget';
import { formatDate, formatMonthName } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { periodNoun } from '@/domain/period';
import { carryPence, type SavingsSummary } from '@/domain/savings';
import { useBudgets, useOverallBudget, usePeriodSpending } from '@/hooks/use-app-data';
import { usePeriodCommitments } from '@/hooks/use-commitments';
import { useSavings } from '@/hooks/use-savings';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedPeriod } from '@/state/period';

export default function SavingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { month, rule, period, isCurrent } = useSelectedPeriod();
  const { entries, summary, loaded } = useSavings();

  const spending = usePeriodSpending(period).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;
  const bills = usePeriodCommitments(period);
  const overview = budgetOverview(spending, budgets, overallBudget, bills.totals);

  const noun = periodNoun(rule);
  // What this period is on course to add, before it is closed for good.
  const onCourse = carryPence(overview.monthlyLimitPence, overview.totalSpentPence);

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="largeTitle" accessibilityRole="header">
          Savings
        </ThemedText>
        <ThemedText type="headline" themeColor="textSecondary">
          What each {noun} left behind
        </ThemedText>
      </View>

      <Card style={styles.balance}>
        <ThemedText type="footnote" themeColor="textSecondary">
          Balance
        </ThemedText>
        <ThemedText
          type="amountLarge"
          style={{ color: summary.balancePence < 0 ? theme.danger : theme.text }}
          accessibilityLabel={`Savings balance ${formatPence(summary.balancePence)}`}>
          {formatPence(summary.balancePence)}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {balanceLine(summary, noun)}
        </ThemedText>

        <View style={styles.actions}>
          <Button
            title="Add money"
            variant="secondary"
            icon={{ ios: 'plus', material: 'add' }}
            onPress={() => router.push('/savings/adjust?direction=in')}
          />
          <Button
            title="Take out"
            variant="secondary"
            icon={{ ios: 'minus', material: 'remove' }}
            onPress={() => router.push('/savings/adjust?direction=out')}
          />
        </View>
      </Card>

      {isCurrent && onCourse !== null ? (
        <Card style={styles.onCourse}>
          <View style={styles.onCourseRow}>
            <Icon
              name={
                onCourse >= 0
                  ? { ios: 'arrow.down.circle.fill', material: 'savings' }
                  : { ios: 'arrow.up.circle.fill', material: 'trending_down' }
              }
              size={22}
              color={onCourse >= 0 ? theme.tint : theme.warningFill}
            />
            <View style={styles.onCourseText}>
              <ThemedText type="callout">
                {onCourse >= 0
                  ? `On course to add ${formatPence(onCourse)}`
                  : `On course to take ${formatPence(-onCourse)} back out`}
              </ThemedText>
              <ThemedText type="footnote" themeColor="textSecondary">
                {`${formatMonthName(month)} closes at the end of the ${noun}. Nothing moves until then.`}
              </ThemedText>
            </View>
          </View>
        </Card>
      ) : null}

      {entries.length === 0 ? (
        loaded ? (
          <EmptyState
            icon={{ ios: 'banknote', material: 'savings' }}
            title="Nothing saved yet"
            message={`Whatever your budget has left at the end of a ${noun} lands here. Go over, and the difference comes back out.`}
          />
        ) : null
      ) : (
        <Section
          title="History"
          detail={summary.periodsCounted > 0 ? formatPence(summary.carriedPence) : undefined}>
          <Card flush>
            {entries.map((entry, index) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                noun={noun}
                showSeparator={index < entries.length - 1}
              />
            ))}
          </Card>
        </Section>
      )}

      <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
        {`Each closed ${noun} adds your monthly budget minus everything you spent, bills included. An overspend is taken back out of the balance.`}
      </ThemedText>
    </Screen>
  );
}

/** What the balance is made of, in a line. */
function balanceLine(summary: SavingsSummary, noun: string): string {
  const byHand =
    summary.addedPence > 0 ? `${formatPence(summary.addedPence)} put in by hand` : null;
  if (summary.periodsCounted === 0) {
    const start = `The first ${noun} closes when it ends.`;
    return byHand ? `${byHand}. ${start}` : `Nothing carried over yet — ${start.toLowerCase()}`;
  }
  const closed = `${summary.periodsCounted} closed ${summary.periodsCounted === 1 ? noun : `${noun}s`}`;
  return byHand ? `From ${closed}, plus ${byHand}.` : `From ${closed}.`;
}

function EntryRow({
  entry,
  noun,
  showSeparator,
}: {
  entry: SavingsEntry;
  noun: string;
  showSeparator: boolean;
}) {
  const theme = useTheme();
  const positive = entry.amountPence >= 0;
  const title =
    entry.kind === 'carry' && entry.periodKey
      ? `${formatMonthName(entry.periodKey)} left over`
      : entry.note || (positive ? 'Added by hand' : 'Taken out');

  return (
    <View
      style={[
        styles.row,
        showSeparator && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
      ]}>
      <View style={[styles.dot, { backgroundColor: positive ? theme.tintSoft : theme.dangerFill }]}>
        <Icon
          name={
            positive
              ? { ios: 'arrow.down', material: 'arrow_downward' }
              : { ios: 'arrow.up', material: 'arrow_upward' }
          }
          size={14}
          color={positive ? theme.tint : theme.danger}
        />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="callout" numberOfLines={1}>
          {title}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {entry.kind === 'carry' ? `Closed ${noun}` : formatDate(entry.createdAt.slice(0, 10))}
        </ThemedText>
      </View>
      <ThemedText type="amount" style={{ color: positive ? theme.tint : theme.danger }}>
        {positive ? '+' : '−'}
        {formatPence(Math.abs(entry.amountPence))}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 2,
  },
  balance: {
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: Spacing.three - 4,
  },
  onCourse: {
    paddingVertical: Spacing.three,
  },
  onCourseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
  },
  onCourseText: {
    flex: 1,
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
  },
});
