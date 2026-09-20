import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing, type Theme } from '@/constants/theme';
import type { SavingsEntry } from '@/db/types';
import { budgetOverview } from '@/domain/budget';
import { formatDate, formatMonth, formatMonthName, monthKeyOf } from '@/domain/dates';
import { allocateGoals, averageCarryPence, type GoalProgress, reordered } from '@/domain/goals';
import { formatPence } from '@/domain/money';
import { periodNoun } from '@/domain/period';
import { carryPence, type SavingsSummary } from '@/domain/savings';
import { useBudgets, useOverallBudget, usePeriodSpending } from '@/hooks/use-app-data';
import { usePeriodCommitments } from '@/hooks/use-commitments';
import { useGoals } from '@/hooks/use-goals';
import { useSavings } from '@/hooks/use-savings';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedPeriod } from '@/state/period';

export default function SavingsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { month, rule, period, isCurrent } = useSelectedPeriod();
  const { entries, summary, loaded } = useSavings();
  const { goals, loaded: goalsLoaded, reorder } = useGoals();

  const spending = usePeriodSpending(period).data ?? [];
  const budgets = useBudgets().data ?? [];
  const overallBudget = useOverallBudget().data ?? null;
  const bills = usePeriodCommitments(period);
  const overview = budgetOverview(spending, budgets, overallBudget, bills.totals);

  const noun = periodNoun(rule);
  // What this period is on course to add, before it is closed for good.
  const onCourse = carryPence(overview.monthlyLimitPence, overview.totalSpentPence);
  // The balance shared out over the goals, at the rate recent periods have saved.
  const goalProgress = allocateGoals(goals, summary.balancePence, averageCarryPence(entries));

  /** Changes which goal the balance fills first. */
  function moveGoal(index: number, delta: number) {
    const ids = goals.map((goal) => goal.id);
    const next = reordered(ids, index, delta);
    if (next.every((id, at) => id === ids[at])) return;

    void Haptics.selectionAsync();
    void reorder(next);
  }
  const savedCount = goalProgress.filter((progress) => progress.done).length;

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

      {goalsLoaded ? (
        <Section
          title="Goals"
          detail={
            goalProgress.length > 0 ? `${savedCount} of ${goalProgress.length} saved` : undefined
          }>
          {goalProgress.length === 0 ? (
            <Card style={styles.goalsEmpty}>
              <ThemedText type="callout" themeColor="textSecondary" style={styles.centered}>
                Give the balance a job: a trip, a new laptop, a rainy day. Goals fill from the top,
                and I’ll say when each one is met at the rate you save.
              </ThemedText>
              <Button
                title="Add a goal"
                variant="secondary"
                icon={{ ios: 'plus', material: 'add' }}
                onPress={() => router.push('/savings/goal')}
              />
            </Card>
          ) : (
            <View style={styles.goals}>
              <Card flush>
                {goalProgress.map((progress, index) => (
                  <GoalRow
                    key={progress.goal.id}
                    progress={progress}
                    showSeparator={index < goalProgress.length - 1}
                    onPress={() => router.push(`/savings/goal?id=${progress.goal.id}`)}
                    onMove={goalProgress.length > 1 ? (delta) => moveGoal(index, delta) : undefined}
                    canMoveUp={index > 0}
                    canMoveDown={index < goalProgress.length - 1}
                  />
                ))}
              </Card>
              {goalProgress.length > 1 ? (
                <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
                  The balance fills these from the top. Move one up to have it filled first.
                </ThemedText>
              ) : null}
              <Button
                title="Add another goal"
                variant="secondary"
                icon={{ ios: 'plus', material: 'add' }}
                onPress={() => router.push('/savings/goal')}
              />
            </View>
          )}
        </Section>
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

type Tone = 'good' | 'warning' | 'neutral';

/** The tone's ink and the wash behind it, picked the way the budget hero picks them. */
function toneColors(theme: Theme, tone: Tone) {
  if (tone === 'warning') return { ink: theme.warningFill, wash: theme.warningSoft };
  if (tone === 'good') return { ink: theme.tint, wash: theme.tintSoft };
  return { ink: theme.textSecondary, wash: theme.backgroundElement };
}

/** What a goal is waiting on, in a line: when it lands, or what is still to go. */
function goalStatus({ goal, remainingPence, done, etaLabel, behind }: GoalProgress): string {
  const wanted = goal.targetDate === null ? null : formatMonth(monthKeyOf(goal.targetDate));
  if (done) return 'Saved';
  if (etaLabel === null) {
    const left = `${formatPence(remainingPence)} to go`;
    return wanted === null ? left : `${left}, wanted by ${wanted}`;
  }
  return behind && wanted !== null
    ? `Not until ${etaLabel}, past ${wanted}`
    : `On course for ${etaLabel}`;
}

/** One goal: what the balance covers of it, how far along, and when it is met. */
function GoalRow({
  progress,
  showSeparator,
  onPress,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  progress: GoalProgress;
  showSeparator: boolean;
  onPress: () => void;
  /** Left out when there is only one goal and nothing to reorder. */
  onMove?: (delta: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const theme = useTheme();
  const { goal, allocatedPence, ratio, done, behind } = progress;
  const { ink, wash } = toneColors(theme, done ? 'good' : behind ? 'warning' : 'neutral');
  const amounts = `${formatPence(allocatedPence)} of ${formatPence(goal.targetPence)}`;
  const status = goalStatus(progress);

  return (
    <View style={styles.goalRow}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${goal.name}: ${amounts}. ${status}`}
        accessibilityHint="Opens this goal"
        onPress={onPress}
        pressedScale={0.98}
        style={styles.goalTap}>
        <View style={[styles.dot, { backgroundColor: wash }]}>
          <Icon
            name={
              done
                ? { ios: 'checkmark', material: 'check' }
                : { ios: 'flag.fill', material: 'flag' }
            }
            size={14}
            color={ink}
          />
        </View>
        <View
          style={[
            styles.goalBody,
            showSeparator && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.separator,
            },
          ]}>
          <ThemedText type="headline" numberOfLines={1}>
            {goal.name}
          </ThemedText>
          <ThemedText type="amount">{amounts}</ThemedText>
          <ProgressBar ratio={ratio} status={behind ? 'warning' : 'ok'} height={6} />
          <View style={styles.goalStatus}>
            {behind ? (
              <Icon
                name={{ ios: 'exclamationmark.circle.fill', material: 'error' }}
                size={12}
                color={ink}
              />
            ) : null}
            <ThemedText
              type="footnote"
              numberOfLines={1}
              style={{ color: done || behind ? ink : theme.textSecondary }}>
              {status}
            </ThemedText>
          </View>
        </View>
      </PressableScale>
      {onMove ? (
        <View style={styles.goalMove}>
          <IconButton
            icon={{ ios: 'chevron.up', material: 'keyboard_arrow_up' }}
            label={`Move ${goal.name} up, so it is filled sooner`}
            size={40}
            disabled={!canMoveUp}
            onPress={() => onMove(-1)}
          />
          <IconButton
            icon={{ ios: 'chevron.down', material: 'keyboard_arrow_down' }}
            label={`Move ${goal.name} down, so it is filled later`}
            size={40}
            disabled={!canMoveDown}
            onPress={() => onMove(1)}
          />
        </View>
      ) : null}
    </View>
  );
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
  goals: {
    gap: Spacing.two,
  },
  goalsEmpty: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
  },
  centered: {
    textAlign: 'center',
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  goalTap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingLeft: Spacing.three,
  },
  goalBody: {
    flex: 1,
    gap: Spacing.one + 2,
    minHeight: 60,
    paddingVertical: Spacing.three - 4,
    paddingRight: Spacing.three,
  },
  goalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  goalMove: {
    gap: Spacing.one,
    paddingRight: Spacing.two,
  },
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
