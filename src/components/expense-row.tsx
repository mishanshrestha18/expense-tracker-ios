import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryBadge } from '@/components/category-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Category, Expense } from '@/db/types';
import { formatPence } from '@/domain/money';
import { useTheme } from '@/hooks/use-theme';

interface ExpenseRowProps {
  expense: Expense;
  category: Category | undefined;
  onPress: () => void;
  showSeparator: boolean;
}

export function ExpenseRow({ expense, category, onPress, showSeparator }: ExpenseRowProps) {
  const theme = useTheme();
  const categoryName = category?.name ?? 'Uncategorised';
  const title = expense.note || categoryName;
  const amount = formatPence(expense.amountPence);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${amount}${expense.note ? `, ${categoryName}` : ''}`}
      accessibilityHint="Opens the expense to edit or delete it"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.backgroundSelected },
      ]}>
      {category && <CategoryBadge category={category} />}
      <View
        style={[
          styles.body,
          showSeparator && {
            borderBottomColor: theme.separator,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}>
        <View style={styles.text}>
          <ThemedText type="body" numberOfLines={1}>
            {title}
          </ThemedText>
          {expense.note ? (
            <ThemedText type="footnote" themeColor="textSecondary" numberOfLines={1}>
              {categoryName}
            </ThemedText>
          ) : null}
        </View>
        <ThemedText type="amount">{amount}</ThemedText>
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
    minHeight: 60,
  },
  text: {
    flex: 1,
  },
});
