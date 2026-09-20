import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CommitmentRow } from '@/components/commitment-row';
import { EmptyState } from '@/components/empty-state';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import type { Occurrence } from '@/domain/commitments';
import { formatPence } from '@/domain/money';
import { formatPeriodRange, periodNoun } from '@/domain/period';
import { useCategories } from '@/hooks/use-app-data';
import { usePeriodCommitments } from '@/hooks/use-commitments';
import { useSelectedPeriod } from '@/state/period';

/** A blank screen is where setting up a budget dies, so offer the usual suspects. */
const STARTERS: { name: string; category: string }[] = [
  { name: 'Rent', category: 'Bills' },
  { name: 'Council tax', category: 'Bills' },
  { name: 'Energy', category: 'Bills' },
  { name: 'Water', category: 'Bills' },
  { name: 'Broadband', category: 'Bills' },
  { name: 'Mobile', category: 'Bills' },
  { name: 'Car insurance', category: 'Transport' },
  { name: 'Season ticket', category: 'Transport' },
  { name: 'Gym', category: 'Health' },
  { name: 'Netflix', category: 'Entertainment' },
  { name: 'Spotify', category: 'Entertainment' },
];

export default function BillsScreen() {
  const router = useRouter();
  const { month, setMonth, rule, period, isCurrent } = useSelectedPeriod();
  const { byId } = useCategories();
  const { commitments, occurrences, overdue, totals, markPaid, skip, undo } =
    usePeriodCommitments(period);

  const noun = periodNoun(rule);
  const byCommitment = new Map(commitments.map((c) => [c.id, c]));
  const waiting = occurrences.filter((o) => o.status === 'due' || o.status === 'upcoming');
  const settled = occurrences.filter((o) => o.status === 'paid' || o.status === 'skipped');
  const paidRatio = totals.duePence === 0 ? 0 : totals.paidPence / totals.duePence;

  const rows = (list: readonly Occurrence[]) =>
    list.map((occurrence, index) => {
      const commitment = byCommitment.get(occurrence.commitmentId);
      if (!commitment) return null;
      return (
        <CommitmentRow
          key={`${occurrence.commitmentId}-${occurrence.dueOn}`}
          commitment={commitment}
          occurrence={occurrence}
          category={byId.get(commitment.categoryId)}
          showSeparator={index < list.length - 1}
          onPress={() => router.push(`/commitment/${commitment.id}`)}
          onPaid={() => void markPaid(occurrence.commitmentId, occurrence.dueOn)}
          onSkip={() => void skip(occurrence.commitmentId, occurrence.dueOn)}
          onUndo={() => void undo(occurrence.commitmentId, occurrence.dueOn)}
        />
      );
    });

  return (
    <Screen>
      <MonthSwitcher
        title="Bills"
        month={month}
        subtitle={rule.kind === 'calendar' ? undefined : formatPeriodRange(period)}
        isCurrent={isCurrent}
        noun={noun}
        onChange={setMonth}
        accessory={
          <IconButton
            icon={{ ios: 'plus', material: 'add' }}
            label="Add a bill"
            variant="filled"
            onPress={() => router.push('/commitment/new')}
          />
        }
      />

      {commitments.length === 0 ? (
        <EmptyState
          icon={{ ios: 'calendar.badge.clock', material: 'event_repeat' }}
          title="Nothing set up yet"
          message="Add what leaves every month — rent, the car, subscriptions — and the rest of the app stops counting that money as yours to spend.">
          <View style={styles.starters}>
            {STARTERS.map((starter) => (
              <Chip
                key={starter.name}
                label={starter.name}
                onPress={() =>
                  router.push(
                    `/commitment/new?name=${encodeURIComponent(starter.name)}&category=${encodeURIComponent(starter.category)}`,
                  )
                }
              />
            ))}
          </View>
        </EmptyState>
      ) : (
        <>
          <Card style={styles.summary}>
            <ThemedText type="footnote" themeColor="textSecondary">
              {`Bills this ${noun}`}
            </ThemedText>
            <ThemedText type="amountLarge">{formatPence(totals.duePence)}</ThemedText>
            <ProgressBar ratio={paidRatio} status="ok" />
            <View style={styles.summaryRow}>
              <ThemedText type="footnote" themeColor="textSecondary">
                {`${formatPence(totals.paidPence)} paid`}
              </ThemedText>
              <ThemedText type="footnote" themeColor="textSecondary">
                {`${formatPence(totals.outstandingPence)} still to go out`}
              </ThemedText>
            </View>
            {totals.setAsidePence > 0 ? (
              <ThemedText type="footnote" themeColor="textSecondary">
                {`Plus ${formatPence(totals.setAsidePence)} a ${noun} set aside for bills that don’t come every ${noun}.`}
              </ThemedText>
            ) : null}
          </Card>

          {overdue.length > 0 ? (
            <Section title="Overdue" detail={formatPence(totals.overduePence)}>
              <Card flush>{rows(overdue)}</Card>
            </Section>
          ) : null}

          {waiting.length > 0 ? (
            <Section title={`Still to come this ${noun}`}>
              <Card flush>{rows(waiting)}</Card>
            </Section>
          ) : null}

          {settled.length > 0 ? (
            <Section title="Done">
              <Card flush>{rows(settled)}</Card>
            </Section>
          ) : null}

          <ThemedText type="footnote" themeColor="textSecondary" style={styles.footnote}>
            Tap a bill to change the amount, the day, or to pencil in a rise before it happens.
          </ThemedText>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  starters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  footnote: {
    paddingHorizontal: Spacing.one,
  },
});
