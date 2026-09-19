import { Pressable, StyleSheet, View } from 'react-native';

import { BudgetRing } from '@/components/charts/budget-ring';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import {
  heroGradient,
  HeroGradients,
  type HeroTone,
  OnHero,
  Radius,
  Spacing,
} from '@/constants/theme';
import { type BudgetOverview, budgetPace, type PaceStatus } from '@/domain/budget';
import { daysInMonth, daysRemainingInMonth, formatMonthName, type MonthKey } from '@/domain/dates';
import { formatPence, formatPenceShort } from '@/domain/money';

const STATUS: Record<PaceStatus, { label: string; icon: IconName; tone: HeroTone }> = {
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

interface BudgetHeroProps {
  overview: BudgetOverview;
  month: MonthKey;
  /** Spend per day left to stay on budget, for the current month. */
  allowancePence: number | null;
  onEditBudget: () => void;
}

/**
 * The Budgets tab's headline: a gradient card whose colour follows the pace
 * (green on track, amber spending fast, red over), with a ring showing how
 * much of the budget is used.
 */
export function BudgetHero({ overview, month, allowancePence, onEditBudget }: BudgetHeroProps) {
  const { progress, basis } = overview;

  if (basis === 'none' || progress.limitPence === null || progress.remainingPence === null) {
    return <SetBudgetHero onSetBudget={onEditBudget} />;
  }

  const limitPence = progress.limitPence;
  const spentPence = progress.spentPence;
  const remainingPence = progress.remainingPence;
  const pace = budgetPace(spentPence, limitPence, month);
  const status = STATUS[pace.status];
  const over = remainingPence < 0;
  const usedPercent = Math.round((progress.ratio ?? 0) * 100);
  const daysLeft = daysRemainingInMonth(month);
  const isCurrent = pace.monthElapsed !== null;

  const stats: { label: string; value: string }[] = [
    { label: 'Spent', value: formatPenceShort(spentPence) },
    isCurrent
      ? {
          label: 'Per day left',
          value: allowancePence === null ? '—' : formatPence(allowancePence),
        }
      : {
          label: pace.status === 'upcoming' ? 'Per day' : 'Daily average',
          value: formatPence(
            Math.round((pace.status === 'upcoming' ? limitPence : spentPence) / daysInMonth(month)),
          ),
        },
    isCurrent
      ? { label: 'Days left', value: String(daysLeft ?? 0) }
      : { label: 'Budget', value: formatPenceShort(limitPence) },
  ];

  const summary =
    `${basis === 'monthly' ? 'Monthly budget' : 'Category budgets'} for ${formatMonthName(month)}: ` +
    `${formatPence(Math.abs(remainingPence))} ${over ? 'over' : 'left'} of ${formatPence(limitPence)}. ` +
    `${status.label}. ${usedPercent}% used.`;

  return (
    <View style={[styles.card, heroBackground(status.tone)]}>
      <Glow />

      <View style={styles.topRow}>
        <View style={styles.pill}>
          <Icon name={status.icon} size={14} color={OnHero.text} />
          <ThemedText type="smallBold" style={styles.onHero}>
            {status.label}
          </ThemedText>
        </View>
        {basis === 'monthly' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit monthly budget"
            hitSlop={10}
            onPress={onEditBudget}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
            <Icon name={{ ios: 'pencil', material: 'edit' }} size={16} color={OnHero.text} />
          </Pressable>
        ) : null}
      </View>

      <BudgetRing
        ratio={progress.ratio ?? 0}
        color={OnHero.text}
        trackColor={OnHero.track}
        accessibilityLabel={summary}>
        <ThemedText type="caption" style={[styles.onHeroSecondary, styles.overline]}>
          {over ? 'Over by' : 'Left to spend'}
        </ThemedText>
        <ThemedText type="display" style={styles.onHero} adjustsFontSizeToFit numberOfLines={1}>
          {formatPence(Math.abs(remainingPence))}
        </ThemedText>
        <ThemedText type="footnote" style={styles.onHeroSecondary}>
          of {formatPence(limitPence)}
        </ThemedText>
      </BudgetRing>

      <ThemedText type="footnote" style={[styles.onHeroSecondary, styles.caption]}>
        {pace.monthElapsed !== null
          ? `${usedPercent}% used · ${Math.round(pace.monthElapsed * 100)}% of the month gone`
          : `${usedPercent}% of the ${basis === 'monthly' ? 'monthly budget' : 'budgets'} used`}
      </ThemedText>

      <View style={styles.stats}>
        {stats.map((stat, index) => (
          <View key={stat.label} style={[styles.stat, index > 0 && styles.statDivider]}>
            <ThemedText type="caption" style={styles.onHeroSecondary}>
              {stat.label}
            </ThemedText>
            <ThemedText type="amount" style={styles.onHero} numberOfLines={1} adjustsFontSizeToFit>
              {stat.value}
            </ThemedText>
          </View>
        ))}
      </View>

      {basis === 'categories' ? (
        <Pressable
          accessibilityRole="button"
          onPress={onEditBudget}
          style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
          <ThemedText type="smallBold" style={styles.onHero}>
            Set one monthly budget for everything
          </ThemedText>
          <Icon
            name={{ ios: 'arrow.right', material: 'arrow_forward' }}
            size={14}
            color={OnHero.text}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The invitation shown before any budget exists. */
function SetBudgetHero({ onSetBudget }: { onSetBudget: () => void }) {
  return (
    <View style={[styles.card, styles.emptyCard, heroBackground('good')]}>
      <Glow />
      <View style={styles.emptyIcon}>
        <Icon
          name={{ ios: 'sterlingsign', material: 'account_balance_wallet' }}
          size={28}
          color={OnHero.text}
        />
      </View>
      <ThemedText type="subtitle" style={[styles.onHero, styles.centered]}>
        Set a monthly budget
      </ThemedText>
      <ThemedText type="callout" style={[styles.onHeroSecondary, styles.centered]}>
        One limit for everything you spend. Expenses keeps you on pace through the month and warns
        you at 80%.
      </ThemedText>
      <Pressable
        accessibilityRole="button"
        onPress={onSetBudget}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <ThemedText type="headline" style={styles.primaryButtonText}>
          Set budget
        </ThemedText>
      </Pressable>
    </View>
  );
}

/** The tone's gradient, over its deepest colour for platforms that cannot draw gradients. */
function heroBackground(tone: HeroTone) {
  return {
    backgroundColor: HeroGradients[tone][0],
    experimental_backgroundImage: heroGradient(tone),
  };
}

/** A soft light in the top corner that gives the card depth. */
function Glow() {
  return <View pointerEvents="none" style={styles.glow} />;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card + 6,
    borderCurve: 'continuous',
    overflow: 'hidden',
    padding: Spacing.four - 4,
    paddingBottom: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
    boxShadow: '0 12px 28px rgba(4, 47, 35, 0.28)',
  },
  emptyCard: {
    paddingVertical: Spacing.five,
    gap: Spacing.two + 4,
  },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -120,
    right: -90,
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
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
    backgroundColor: OnHero.surface,
  },
  editButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OnHero.surface,
  },
  pressed: {
    opacity: 0.7,
  },
  onHero: {
    color: OnHero.text,
  },
  onHeroSecondary: {
    color: OnHero.textSecondary,
  },
  overline: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  caption: {
    marginTop: -Spacing.one,
  },
  centered: {
    textAlign: 'center',
  },
  stats: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    paddingTop: Spacing.three - 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OnHero.divider,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.one,
  },
  statDivider: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: OnHero.divider,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.one,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OnHero.surface,
  },
  primaryButton: {
    marginTop: Spacing.two,
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: Radius.control + 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OnHero.text,
  },
  primaryButtonText: {
    color: '#065F46',
  },
});
