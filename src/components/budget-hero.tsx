import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetRing } from '@/components/charts/budget-ring';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius, Spacing, type Theme } from '@/constants/theme';
import { type BudgetOverview, budgetPace, type PaceStatus } from '@/domain/budget';
import { formatPence, formatPenceShort } from '@/domain/money';
import { daysInPeriod, daysRemainingInPeriod, type Period } from '@/domain/period';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'good' | 'warning' | 'danger';

const STATUS: Record<PaceStatus, { label: string; icon: IconName; tone: Tone }> = {
  'on-track': {
    label: 'On track',
    icon: { ios: 'checkmark.circle.fill', material: 'check_circle' },
    tone: 'good',
  },
  fast: {
    label: 'Spending fast',
    icon: { ios: 'gauge.with.dots.needle.67percent', material: 'speed' },
    tone: 'warning',
  },
  over: {
    label: 'Over budget',
    icon: { ios: 'exclamationmark.triangle.fill', material: 'warning' },
    tone: 'danger',
  },
  under: {
    label: 'Under budget',
    icon: { ios: 'checkmark.seal.fill', material: 'verified' },
    tone: 'good',
  },
  upcoming: {
    label: 'Upcoming',
    icon: { ios: 'calendar', material: 'calendar_today' },
    tone: 'good',
  },
};

/** The tone's ink and the wash behind it. */
function toneColors(theme: Theme, tone: Tone) {
  if (tone === 'danger') return { ink: theme.danger, wash: theme.dangerFill };
  if (tone === 'warning') return { ink: theme.warningFill, wash: theme.warningSoft };
  return { ink: theme.tint, wash: theme.tintSoft };
}

interface BudgetHeroProps {
  overview: BudgetOverview;
  period: Period;
  /** Name of the period, e.g. "September", for the spoken summary. */
  periodLabel: string;
  /** Spend per day left to stay on budget, for the current period. */
  allowancePence: number | null;
  /** Fees still expected this period, already taken off the allowance. */
  upcomingPence?: number;
  /** Where the period is heading at this pace; `null` when it is too early to say. */
  projectedPence?: number | null;
  onEditBudget: () => void;
}

/**
 * The headline: a ring showing what is left, on a plain card. The colour
 * belongs to the ring and the status pill, not the whole card, so the number
 * stays the loudest thing on the screen.
 */
export function BudgetHero({
  overview,
  period,
  periodLabel,
  allowancePence,
  upcomingPence = 0,
  projectedPence = null,
  onEditBudget,
}: BudgetHeroProps) {
  const theme = useTheme();
  const { basis, everyday } = overview;
  // With bills set up, the ring shows what is genuinely free to spend.
  const progress =
    everyday?.limitPence === null ? overview.progress : (everyday?.progress ?? overview.progress);

  if (basis === 'none' || progress.limitPence === null || progress.remainingPence === null) {
    return <SetBudgetHero onSetBudget={onEditBudget} />;
  }

  const limitPence = progress.limitPence;
  const spentPence = progress.spentPence;
  const remainingPence = progress.remainingPence;
  const pace = budgetPace(spentPence, limitPence, period);
  const status = STATUS[pace.status];
  const { ink, wash } = toneColors(theme, status.tone);
  const over = remainingPence < 0;
  const usedPercent = Math.round((progress.ratio ?? 0) * 100);
  const daysLeft = daysRemainingInPeriod(period);
  const isCurrent = pace.elapsed !== null;

  const stats: { label: string; value: string }[] = [
    { label: 'Spent', value: formatPenceShort(spentPence) },
    isCurrent
      ? {
          label: 'Per day',
          value: allowancePence === null ? '—' : formatPence(allowancePence),
        }
      : {
          label: pace.status === 'upcoming' ? 'Per day' : 'Daily average',
          value: formatPence(
            Math.round(
              (pace.status === 'upcoming' ? limitPence : spentPence) / daysInPeriod(period),
            ),
          ),
        },
    isCurrent
      ? { label: 'Days left', value: String(daysLeft ?? 0) }
      : { label: 'Budget', value: formatPenceShort(limitPence) },
  ];

  // What this period is heading for, and the money already spoken for.
  const outlook: string[] = [];
  if (projectedPence !== null) {
    const difference = projectedPence - limitPence;
    outlook.push(
      difference > 0
        ? `On pace to finish ${formatPenceShort(difference)} over`
        : `On pace to finish ${formatPenceShort(-difference)} under`,
    );
  }
  if (everyday) {
    outlook.push(`after ${formatPenceShort(everyday.committedPence)} of bills`);
  } else if (upcomingPence > 0) {
    outlook.push(`${formatPenceShort(upcomingPence)} of fees still to come`);
  }

  const summary =
    `${basis === 'monthly' ? 'Monthly budget' : 'Category budgets'} for ${periodLabel}: ` +
    `${formatPence(Math.abs(remainingPence))} ${over ? 'over' : 'left'} of ${formatPence(limitPence)}. ` +
    `${status.label}. ${usedPercent}% used.`;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.separator }]}>
      <View style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: wash }]}>
          <Icon name={status.icon} size={14} color={ink} />
          <ThemedText type="smallBold" style={{ color: ink }}>
            {status.label}
          </ThemedText>
        </View>
        {basis === 'monthly' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit monthly budget"
            hitSlop={10}
            onPress={onEditBudget}
            style={({ pressed }) => [
              styles.editButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}>
            <Icon name={{ ios: 'pencil', material: 'edit' }} size={16} color={theme.text} />
          </Pressable>
        ) : null}
      </View>

      <BudgetRing
        ratio={progress.ratio ?? 0}
        color={ink}
        trackColor={theme.backgroundElement}
        accessibilityLabel={summary}>
        <ThemedText type="caption" themeColor="textSecondary" style={styles.overline}>
          {over ? 'Over by' : 'Yours to spend'}
        </ThemedText>
        <ThemedText type="display" adjustsFontSizeToFit numberOfLines={1}>
          {formatPence(Math.abs(remainingPence))}
        </ThemedText>
        <ThemedText type="footnote" themeColor="textSecondary">
          of {formatPence(limitPence)}
        </ThemedText>
      </BudgetRing>

      <ThemedText type="footnote" themeColor="textSecondary" style={styles.caption}>
        {pace.elapsed !== null
          ? `${usedPercent}% used · ${Math.round(pace.elapsed * 100)}% of the period gone`
          : `${usedPercent}% of the ${basis === 'monthly' ? 'monthly budget' : 'budgets'} used`}
      </ThemedText>

      {isCurrent && outlook.length > 0 ? (
        <ThemedText type="caption" themeColor="textSecondary" style={styles.caption}>
          {outlook.join(' · ')}
        </ThemedText>
      ) : null}

      <View style={[styles.stats, { borderTopColor: theme.separator }]}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            style={[
              index > 0 && { borderLeftColor: theme.separator },
              styles.stat,
              index > 0 && styles.statDivider,
            ]}>
            <ThemedText type="caption" themeColor="textSecondary" style={styles.overline}>
              {stat.label}
            </ThemedText>
            <ThemedText type="amount" numberOfLines={1} adjustsFontSizeToFit>
              {stat.value}
            </ThemedText>
          </View>
        ))}
      </View>

      {basis === 'categories' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onEditBudget}
          style={({ pressed }) => [
            styles.linkButton,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <ThemedText type="smallBold">Set one monthly budget for everything</ThemedText>
          <Icon
            name={{ ios: 'arrow.right', material: 'arrow_forward' }}
            size={14}
            color={theme.text}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The invitation shown before any budget exists. */
function SetBudgetHero({ onSetBudget }: { onSetBudget: () => void }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.card,
        styles.emptyCard,
        { backgroundColor: theme.card, borderColor: theme.separator },
      ]}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.tintSoft }]}>
        <Icon
          name={{ ios: 'sterlingsign', material: 'account_balance_wallet' }}
          size={28}
          color={theme.tint}
        />
      </View>
      <ThemedText type="subtitle" style={styles.centered}>
        Set a monthly budget
      </ThemedText>
      <ThemedText type="callout" themeColor="textSecondary" style={styles.centered}>
        One limit for everything you spend. Expenses keeps you on pace through the month and warns
        you at 80%.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onSetBudget}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: theme.tint },
          pressed && styles.pressed,
        ]}>
        <ThemedText type="headline" style={{ color: theme.onTint }}>
          Set budget
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card + 6,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: Spacing.four - 4,
    paddingBottom: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyCard: {
    paddingVertical: Spacing.five,
    gap: Spacing.two + 4,
  },
  topRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one + 1,
    paddingHorizontal: Spacing.two + 4,
    borderRadius: Radius.pill,
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  caption: {
    marginTop: -Spacing.one,
    textAlign: 'center',
  },
  centered: {
    textAlign: 'center',
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingTop: Spacing.three - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.two + 4,
    paddingHorizontal: Spacing.five,
    borderRadius: Radius.pill,
  },
  linkButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.control,
  },
});
