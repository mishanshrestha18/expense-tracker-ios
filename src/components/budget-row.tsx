import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/db/types';
import { budgetProgress } from '@/domain/budget';
import { formatPenceShort } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface BudgetRowProps {
  category: Category;
  spentPence: number;
  limitPence: number | null;
  showSeparator: boolean;
  onPress: () => void;
}

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

  let summary: string;
  if (progress.limitPence === null) {
    summary = spentPence > 0 ? `${formatPenceShort(spentPence)} spent · no budget` : 'No budget';
  } else if ((progress.remainingPence ?? 0) >= 0) {
    summary = `${formatPenceShort(progress.remainingPence ?? 0)} left`;
  } else {
    summary = `${formatPenceShort(-(progress.remainingPence ?? 0))} over`;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${category.name}. ${summary}`}
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
            <ThemedText type="body" numberOfLines={1} style={styles.name}>
              {category.name}
            </ThemedText>
            {progress.limitPence !== null ? (
              <ThemedText type="small" themeColor="textSecondary">
                {formatPenceShort(spentPence)} of {formatPenceShort(progress.limitPence)}
              </ThemedText>
            ) : null}
          </View>
          {progress.limitPence !== null ? (
            <ProgressBar ratio={progress.ratio ?? 0} status={progress.status} height={6} />
          ) : null}
          <ThemedText
            type="footnote"
            style={{ color: progress.limitPence === null ? theme.tint : statusColor }}>
            {progress.limitPence === null ? `${summary} · Set one` : summary}
          </ThemedText>
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
    gap: Spacing.one + 2,
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
});
