import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
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
  showSeparator: boolean;
  onPress: () => void;
}

/** One category: what was spent (the headline number), and how that compares with its budget. */
export function BudgetRow({
  category,
  spentPence,
  limitPence,
  showSeparator,
  onPress,
}: BudgetRowProps) {
  const theme = useTheme();
  const progress = budgetProgress(spentPence, limitPence);
  const statusColor =
    progress.status === 'over'
      ? theme.danger
      : progress.status === 'warning'
        ? theme.warning
        : theme.textSecondary;

  let status: string;
  if (progress.limitPence === null || progress.remainingPence === null) {
    status = 'No budget · tap to set one';
  } else if (progress.remainingPence >= 0) {
    status = `${formatPenceShort(progress.remainingPence)} left of ${formatPenceShort(progress.limitPence)}`;
  } else {
    status = `${formatPenceShort(-progress.remainingPence)} over the ${formatPenceShort(progress.limitPence)} budget`;
  }
  const spent = formatPence(spentPence);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${category.name}: ${spent} spent. ${status}`}
      accessibilityHint="Opens the monthly budget for this category"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      <CategoryBadge category={category} />
      <View
        style={[
          styles.body,
          showSeparator && {
            borderBottomColor: theme.separator,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <View style={styles.main}>
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
          {progress.limitPence !== null ? (
            <ProgressBar ratio={progress.ratio ?? 0} status={progress.status} height={8} />
          ) : null}
          <View style={styles.statusRow}>
            <ThemedText type="footnote" style={[styles.status, { color: statusColor }]}>
              {status}
            </ThemedText>
            {progress.ratio !== null ? (
              <ThemedText type="footnote" style={[styles.percent, { color: statusColor }]}>
                {Math.round(progress.ratio * 100)}%
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Icon
          name={{ ios: 'chevron.right', material: 'chevron_right' }}
          size={14}
          color={theme.textTertiary}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: Spacing.three,
    gap: Spacing.three,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three - 2,
    paddingRight: Spacing.three,
  },
  main: {
    flex: 1,
    gap: Spacing.two,
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
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  status: {
    flexShrink: 1,
  },
  percent: {
    fontVariant: ['tabular-nums'],
  },
});
