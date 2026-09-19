import { StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { budgetProgress } from '@/domain/budget';
import { formatPence, formatPenceShort } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface BudgetRowProps {
  category: Category;
  spentPence: number;
  limitPence: number | null;
  /** This category's share of the month's spending, 0–1. */
  share: number;
  showSeparator: boolean;
  onPress: () => void;
}

/** One category: the amount spent leads, with its limit (if any) underneath. */
export function BudgetRow({
  category,
  spentPence,
  limitPence,
  share,
  showSeparator,
  onPress,
}: BudgetRowProps) {
  const theme = useTheme();
  const progress = budgetProgress(spentPence, limitPence);
  const isOver = progress.status === 'over';
  const isWarning = progress.status === 'warning';
  const statusColor = isOver ? theme.danger : isWarning ? theme.warning : theme.textSecondary;

  let status: string;
  if (progress.limitPence === null || progress.remainingPence === null) {
    status =
      spentPence > 0
        ? `${Math.round(share * 100)}% of spending · no limit`
        : 'No spending · no limit';
  } else if (progress.remainingPence >= 0) {
    status = `${formatPenceShort(progress.remainingPence)} left of ${formatPenceShort(progress.limitPence)}`;
  } else {
    status = `${formatPenceShort(-progress.remainingPence)} over the ${formatPenceShort(progress.limitPence)} limit`;
  }
  const spent = formatPence(spentPence);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${category.name}: ${spent} spent. ${status}`}
      accessibilityHint="Opens the monthly limit for this category"
      onPress={onPress}
      pressedScale={0.98}
      style={styles.row}>
      <CategoryBadge category={category} size={40} />
      <View
        style={[
          styles.body,
          showSeparator && {
            borderBottomColor: theme.separator,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <View style={styles.titleRow}>
          <ThemedText type="headline" numberOfLines={1} style={styles.name}>
            {category.name}
          </ThemedText>
          <ThemedText
            type="amount"
            style={spentPence === 0 ? { color: theme.textTertiary } : undefined}>
            {spent}
          </ThemedText>
        </View>

        {progress.ratio !== null ? (
          <ProgressBar
            ratio={progress.ratio}
            status={progress.status}
            color={category.color}
            height={6}
          />
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.status}>
            {isOver || isWarning ? (
              <Icon
                name={
                  isOver
                    ? { ios: 'exclamationmark.triangle.fill', material: 'warning' }
                    : { ios: 'exclamationmark.circle.fill', material: 'error' }
                }
                size={12}
                color={statusColor}
              />
            ) : null}
            <ThemedText type="footnote" numberOfLines={1} style={{ color: statusColor }}>
              {status}
            </ThemedText>
          </View>
          {progress.ratio !== null ? (
            <ThemedText type="footnote" style={[styles.percent, { color: statusColor }]}>
              {Math.round(progress.ratio * 100)}%
            </ThemedText>
          ) : null}
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    gap: Spacing.three - 2,
  },
  body: {
    flex: 1,
    gap: Spacing.two,
    paddingVertical: Spacing.three - 2,
    paddingRight: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  name: {
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  percent: {
    fontVariant: ['tabular-nums'],
  },
});
