import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Section } from '@/components/ui/section';
import { Spacing } from '@/constants/theme';
import { formatDate } from '@/domain/dates';
import { formatPence } from '@/domain/money';
import type { UpcomingFee } from '@/domain/recurring';
import { useCategories } from '@/hooks/use-app-data';
import { useTheme } from '@/hooks/use-theme';
import { confirmDestructive } from '@/utils/confirm';

interface UpcomingFeesProps {
  fees: readonly UpcomingFee[];
  totalPence: number;
  /** "month" or "period", depending on the payday setting. */
  noun: string;
  onIgnore: (key: string) => void;
}

/**
 * Regular payments the app has spotted and expects again before the period is
 * out, so nothing lands as a surprise.
 */
export function UpcomingFees({ fees, totalPence, noun, onIgnore }: UpcomingFeesProps) {
  const theme = useTheme();
  const { byId } = useCategories();
  if (fees.length === 0) return null;

  return (
    <Section title={`Still to come this ${noun}`} detail={formatPence(totalPence)}>
      <Card flush>
        {fees.map((fee, index) => {
          const category = byId.get(fee.categoryId);
          return (
            <View
              key={fee.key}
              style={[
                styles.row,
                index < fees.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.separator,
                },
              ]}>
              {category ? <CategoryBadge category={category} size={36} /> : null}
              <View style={styles.text}>
                <ThemedText type="callout" numberOfLines={1}>
                  {fee.label}
                </ThemedText>
                <ThemedText
                  type="footnote"
                  style={{ color: fee.overdue ? theme.warning : theme.textSecondary }}>
                  {fee.overdue
                    ? `Expected ${formatDate(fee.dueOn)}`
                    : `Due ${formatDate(fee.dueOn)}`}
                </ThemedText>
              </View>
              <ThemedText type="amount">{formatPence(fee.amountPence)}</ThemedText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Stop expecting ${fee.label}`}
                hitSlop={10}
                onPress={() =>
                  confirmDestructive({
                    title: 'Stop expecting this?',
                    message: `${fee.label} will no longer be counted as a regular payment.`,
                    confirmLabel: 'Stop expecting',
                    onConfirm: () => onIgnore(fee.key),
                  })
                }
                style={({ pressed }) => pressed && styles.pressed}>
                <Icon
                  name={{ ios: 'xmark', material: 'close' }}
                  size={14}
                  color={theme.textTertiary}
                />
              </Pressable>
            </View>
          );
        })}
      </Card>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 2,
    minHeight: 60,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  pressed: {
    opacity: 0.5,
  },
});
