import { StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { BarChart } from '@/components/charts/bar-chart';
import { DonutChart } from '@/components/charts/donut-chart';
import { EmptyState } from '@/components/empty-state';
import { MonthSwitcher } from '@/components/month-switcher';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { formatMonthName, formatMonthShort } from '@/domain/dates';
import { change, describeDifference, movers } from '@/domain/compare';
import { formatPence, formatPenceCompact, formatPenceShort } from '@/domain/money';
import { paidWithSummary } from '@/domain/paid-with';
import {
  formatPeriodRange,
  periodNoun,
  periodsEndingAt,
  samePointLastPeriod,
  samePointLastYear,
} from '@/domain/period';
import { averageOfActiveMonths, breakdown, bucketByPeriod, percentChange } from '@/domain/summary';
import {
  useCategories,
  useDailyTotals,
  useOverallBudget,
  usePaidWithTotals,
  usePeriodSpending,
  useSpendingBetween,
  useTotalBetween,
} from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { useSelectedPeriod } from '@/state/period';

const TREND_PERIODS = 6;

export default function InsightsScreen() {
  const theme = useTheme();
  const { month, setMonth, rule, period, isCurrent } = useSelectedPeriod();
  const { categories } = useCategories();
  const spending = usePeriodSpending(period).data ?? [];
  const periods = periodsEndingAt(month, TREND_PERIODS, rule);
  const days = useDailyTotals(periods[0].start, period.end).data ?? [];
  const totals = bucketByPeriod(days, periods);
  const overallBudget = useOverallBudget().data ?? null;
  const paidWith = usePaidWithTotals(period).data ?? [];
  const noun = periodNoun(rule);

  const spentBy = new Map(spending.map((s) => [s.categoryId, s.totalPence]));
  const slices = breakdown(
    categories.map((c) => ({ item: c, totalPence: spentBy.get(c.id) ?? 0 })),
  );
  const totalPence = slices.reduce((sum, s) => sum + s.totalPence, 0);

  // Part-way through, compare with the same stretch of the last period rather
  // than all of it, otherwise day three always looks like a 90% drop.
  const lastPeriodSoFar = samePointLastPeriod(month, rule);
  const lastPeriodSoFarPence =
    useTotalBetween(lastPeriodSoFar.start, lastPeriodSoFar.end).data ?? 0;
  const previousPence = isCurrent
    ? lastPeriodSoFarPence
    : (totals[totals.length - 2]?.totalPence ?? 0);
  const lastYearSoFar = samePointLastYear(month, rule);
  const lastYearSoFarPence = useTotalBetween(lastYearSoFar.start, lastYearSoFar.end).data ?? 0;
  const lastPeriodSpending =
    useSpendingBetween(lastPeriodSoFar.start, lastPeriodSoFar.end).data ?? [];
  const biggestMovers = movers(categories, spending, lastPeriodSpending).slice(0, 3);
  const comparedNote = `Counts the same number of days into each ${noun}, so a part-finished ${noun} still compares fairly.`;

  const changeRatio = percentChange(totalPence, previousPence);
  const average = averageOfActiveMonths(totals);
  const top = slices[0];

  return (
    <Screen>
      <MonthSwitcher
        title="Insights"
        month={month}
        subtitle={rule.kind === 'calendar' ? undefined : formatPeriodRange(period)}
        isCurrent={isCurrent}
        noun={noun}
        onChange={setMonth}
      />

      {totalPence === 0 ? (
        <EmptyState
          icon={{ ios: 'chart.pie', material: 'pie_chart' }}
          title="Nothing to chart yet"
          message={`Add a few expenses for ${formatMonthName(month)} and your spending breakdown will appear here.`}
        />
      ) : (
        <Card style={styles.breakdown}>
          <DonutChart
            data={slices.map((s) => ({
              key: String(s.item.id),
              value: s.totalPence,
              color: s.item.color,
            }))}
            accessibilityLabel={`Spending by category: ${slices
              .map((s) => `${s.item.name} ${formatPence(s.totalPence)}`)
              .join(', ')}`}>
            <ThemedText type="footnote" themeColor="textSecondary">
              Spent
            </ThemedText>
            <ThemedText type="title" style={styles.tabular}>
              {formatPenceShort(totalPence)}
            </ThemedText>
          </DonutChart>

          <View style={styles.legend}>
            {slices.map((slice) => (
              <View key={slice.item.id} style={styles.legendRow}>
                <View style={[styles.dot, { backgroundColor: slice.item.color }]} />
                <ThemedText type="callout" style={styles.legendName} numberOfLines={1}>
                  {slice.item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.tabular}>
                  {Math.round(slice.share * 100)}%
                </ThemedText>
                <ThemedText type="amount" style={styles.legendAmount}>
                  {formatPence(slice.totalPence)}
                </ThemedText>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View style={styles.stats}>
        <Card style={styles.stat}>
          <ThemedText type="footnote" themeColor="textSecondary">
            {isCurrent ? `vs this time last ${noun}` : `vs previous ${noun}`}
          </ThemedText>
          {changeRatio === null ? (
            <ThemedText type="subtitle">—</ThemedText>
          ) : (
            <View style={styles.change}>
              <Icon
                name={
                  changeRatio > 0
                    ? { ios: 'arrow.up.right', material: 'trending_up' }
                    : { ios: 'arrow.down.right', material: 'trending_down' }
                }
                size={18}
                color={changeRatio > 0 ? theme.warning : theme.tint}
              />
              <ThemedText
                type="subtitle"
                style={{ color: changeRatio > 0 ? theme.warning : theme.tint }}>
                {Math.abs(Math.round(changeRatio * 100))}%
              </ThemedText>
            </View>
          )}
        </Card>
        <Card style={styles.stat}>
          <ThemedText type="footnote" themeColor="textSecondary">
            {`Average per ${noun}`}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.tabular}>
            {formatPenceShort(average)}
          </ThemedText>
        </Card>
      </View>

      <Section title="What changed">
        <Card flush>
          <CompareRow
            label={`Same point last ${noun}`}
            currentPence={totalPence}
            previousPence={lastPeriodSoFarPence}
          />
          <CompareRow
            label="Same point last year"
            currentPence={totalPence}
            previousPence={lastYearSoFarPence}
            last
          />
        </Card>

        {biggestMovers.length > 0 ? (
          <Card flush>
            {biggestMovers.map((row, index) => (
              <View
                key={row.item.id}
                style={[
                  styles.moverRow,
                  index < biggestMovers.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.separator,
                  },
                ]}>
                <CategoryBadge category={row.item} size={32} />
                <ThemedText type="callout" style={styles.moverName} numberOfLines={1}>
                  {row.item.name}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  style={{ color: row.differencePence > 0 ? theme.warning : theme.tint }}>
                  {describeDifference(row.differencePence)}
                </ThemedText>
              </View>
            ))}
          </Card>
        ) : null}

        <ThemedText type="footnote" themeColor="textSecondary" style={styles.comparedFootnote}>
          {comparedNote}
        </ThemedText>
      </Section>

      {top ? (
        <Card style={styles.topCategory}>
          <ThemedText type="footnote" themeColor="textSecondary">
            Biggest category
          </ThemedText>
          <ThemedText type="headline">
            {top.item.name} · {Math.round(top.share * 100)}% of spending
          </ThemedText>
          {paidWithSummary(paidWith) ? (
            <ThemedText type="footnote" themeColor="textSecondary">
              {`Paid with ${paidWithSummary(paidWith)}`}
            </ThemedText>
          ) : null}
        </Card>
      ) : null}

      <Section title={`Last ${TREND_PERIODS} ${noun}s`}>
        <Card>
          <BarChart
            data={totals.map((t) => ({
              key: t.month,
              label: formatMonthShort(t.month),
              value: t.totalPence,
              highlighted: t.month === month,
            }))}
            formatValue={formatPenceCompact}
            reference={
              overallBudget !== null
                ? {
                    value: overallBudget,
                    label: `Monthly budget ${formatPenceShort(overallBudget)}`,
                  }
                : undefined
            }
            accessibilityLabel={`Spending per ${noun}: ${totals
              .map((t) => `${formatMonthName(t.month)} ${formatPence(t.totalPence)}`)
              .join(', ')}`}
          />
        </Card>
      </Section>
    </Screen>
  );
}

interface CompareRowProps {
  label: string;
  currentPence: number;
  previousPence: number;
  last?: boolean;
}

/** One "then versus now" line: what was spent by this point, and the difference. */
function CompareRow({ label, currentPence, previousPence, last = false }: CompareRowProps) {
  const theme = useTheme();
  const { differencePence } = change(currentPence, previousPence);
  const nothingThen = previousPence === 0;

  return (
    <View
      style={[
        styles.compareRow,
        !last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
      ]}>
      <View style={styles.compareText}>
        <ThemedText type="callout">{label}</ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          {nothingThen ? 'Nothing recorded then' : formatPence(previousPence)}
        </ThemedText>
      </View>
      {nothingThen ? null : (
        <ThemedText
          type="smallBold"
          style={{ color: differencePence > 0 ? theme.warning : theme.tint }}>
          {describeDifference(differencePence)}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  compareText: {
    flex: 1,
    gap: 1,
  },
  moverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    minHeight: 52,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  moverName: {
    flex: 1,
  },
  comparedFootnote: {
    paddingHorizontal: Spacing.one,
  },
  breakdown: {
    alignItems: 'center',
    gap: Spacing.four,
    paddingVertical: Spacing.four,
  },
  legend: {
    alignSelf: 'stretch',
    gap: Spacing.three - 4,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendName: {
    flex: 1,
  },
  legendAmount: {
    minWidth: 90,
    textAlign: 'right',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  stat: {
    flex: 1,
    gap: Spacing.one,
  },
  topCategory: {
    gap: Spacing.one,
  },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
