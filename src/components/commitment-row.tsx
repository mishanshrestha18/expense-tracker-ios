import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Radius, Spacing } from '@/constants/theme';
import type { Category, Commitment } from '@/db/types';
import type { Occurrence } from '@/domain/commitments';
import { formatDate } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface CommitmentRowProps {
  commitment: Commitment;
  occurrence: Occurrence;
  category?: Category;
  showSeparator: boolean;
  /** Opens the editor. */
  onPress: () => void;
  onPaid?: () => void;
  onSkip?: () => void;
  onUndo?: () => void;
}

/** One occurrence of a bill: what it is, when it lands, and what to do about it. */
export function CommitmentRow({
  commitment,
  occurrence,
  category,
  showSeparator,
  onPress,
  onPaid,
  onSkip,
  onUndo,
}: CommitmentRowProps) {
  const theme = useTheme();
  const overdue = occurrence.status === 'overdue';
  const settled = occurrence.status === 'paid' || occurrence.status === 'skipped';

  const when =
    occurrence.status === 'paid'
      ? 'Paid'
      : occurrence.status === 'skipped'
        ? 'Skipped'
        : overdue
          ? `Was due ${formatDate(occurrence.dueOn)}`
          : occurrence.status === 'due'
            ? 'Due today'
            : `Due ${formatDate(occurrence.dueOn)}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${commitment.name}, ${formatPence(occurrence.amountPence)}, ${when}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        showSeparator && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.separator,
        },
        pressed && styles.pressed,
      ]}>
      {category ? <CategoryBadge category={category} size={38} /> : null}

      <View style={styles.text}>
        <ThemedText type="callout" numberOfLines={1}>
          {commitment.name}
        </ThemedText>
        <ThemedText type="footnote" style={{ color: overdue ? theme.danger : theme.textSecondary }}>
          {when}
          {commitment.kind === 'variable' && !settled ? ' · estimate' : ''}
        </ThemedText>
      </View>

      <View style={styles.right}>
        <ThemedText type="amount" style={settled ? { color: theme.textSecondary } : undefined}>
          {commitment.kind === 'variable' && !settled ? '≈' : ''}
          {formatPence(occurrence.amountPence)}
        </ThemedText>

        {settled ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Undo ${commitment.name}`}
            hitSlop={10}
            onPress={onUndo}>
            <Icon
              name={
                occurrence.status === 'paid'
                  ? { ios: 'checkmark.circle.fill', material: 'check_circle' }
                  : { ios: 'minus.circle.fill', material: 'do_not_disturb_on' }
              }
              size={20}
              color={occurrence.status === 'paid' ? theme.tint : theme.textTertiary}
            />
          </Pressable>
        ) : (
          <View style={styles.actions}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Mark ${commitment.name} as paid`}
              onPress={onPaid}
              style={[styles.action, { backgroundColor: theme.tint }]}>
              <ThemedText type="caption" style={{ color: theme.onTint }}>
                Paid
              </ThemedText>
            </PressableScale>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Skip ${commitment.name} this time`}
              onPress={onSkip}
              style={[styles.action, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="caption" themeColor="textSecondary">
                Skip
              </ThemedText>
            </PressableScale>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    minHeight: 66,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  right: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.one + 2,
  },
  action: {
    paddingVertical: 5,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.pill,
  },
  pressed: {
    opacity: 0.6,
  },
});
